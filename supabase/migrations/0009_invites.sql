-- Workspace invitations + auto-accept on signup.

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  token uuid not null default gen_random_uuid(),
  invited_by uuid references auth.users on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_workspace_invites_pending
  on public.workspace_invites (workspace_id, lower(email))
  where accepted_at is null;

create index if not exists idx_workspace_invites_email
  on public.workspace_invites (lower(email));

alter table public.workspace_invites enable row level security;

-- Owners of the workspace manage invites.
drop policy if exists "invites owner manage" on public.workspace_invites;
create policy "invites owner manage" on public.workspace_invites
  for all using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- An invitee can read invites addressed to their email.
drop policy if exists "invites invitee read" on public.workspace_invites;
create policy "invites invitee read" on public.workspace_invites
  for select using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Allow workspace owners to change member roles (no UPDATE policy existed).
drop policy if exists "members update by owner" on public.workspace_members;
create policy "members update by owner" on public.workspace_members
  for update using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- =====================================================================
-- Accept pending invites for the current (already-existing) user
-- =====================================================================
-- Profiles RLS prevents the server from resolving other users by email, so
-- invited existing users accept their own pending invites on next visit.

create or replace function public.accept_pending_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
  accepted_count integer := 0;
  inv record;
begin
  select email into user_email from auth.users where id = auth.uid();
  if user_email is null then
    return 0;
  end if;

  for inv in
    select * from public.workspace_invites
    where lower(email) = lower(user_email)
      and accepted_at is null
  loop
    insert into public.workspace_members (workspace_id, user_id, role)
    values (inv.workspace_id, auth.uid(), inv.role)
    on conflict (workspace_id, user_id) do nothing;

    update public.workspace_invites
      set accepted_at = now()
      where id = inv.id;

    accepted_count := accepted_count + 1;
  end loop;

  return accepted_count;
end;
$$;

grant execute on function public.accept_pending_invites() to authenticated;

-- =====================================================================
-- List members (with profile info) for a workspace the caller belongs to
-- =====================================================================
-- Profiles RLS only exposes the caller's own row, so co-member names need a
-- definer function guarded by workspace membership.

create or replace function public.list_workspace_members(ws uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select m.user_id, p.email, p.full_name, m.role, m.created_at
  from public.workspace_members m
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = ws
    and public.is_workspace_member(ws)
  order by m.created_at asc;
$$;

grant execute on function public.list_workspace_members(uuid) to authenticated;

-- =====================================================================
-- Auto-accept pending invites for matching emails on signup
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  display_name text;
  inv record;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, display_name);

  insert into public.workspaces (name, owner_id)
  values (display_name || '''s Workspace', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  -- Accept any pending invitations addressed to this email.
  for inv in
    select * from public.workspace_invites
    where lower(email) = lower(new.email)
      and accepted_at is null
  loop
    insert into public.workspace_members (workspace_id, user_id, role)
    values (inv.workspace_id, new.id, inv.role)
    on conflict (workspace_id, user_id) do nothing;

    update public.workspace_invites
      set accepted_at = now()
      where id = inv.id;
  end loop;

  return new;
end;
$$;
