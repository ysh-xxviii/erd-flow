-- ERD Flow — initial schema, RLS, and signup trigger.
-- Run this in the Supabase SQL editor (or via the Supabase CLI) for your project.

-- =====================================================================
-- Tables
-- =====================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.diagrams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null default 'Untitled Schema',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erd_tables (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references public.diagrams on delete cascade,
  name text not null,
  color text not null default 'blue',
  pos_x double precision not null default 0,
  pos_y double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.erd_columns (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.erd_tables on delete cascade,
  name text not null,
  data_type text not null default 'text',
  is_pk boolean not null default false,
  is_fk boolean not null default false,
  is_nullable boolean not null default true,
  ordinal integer not null default 0
);

create table if not exists public.erd_relationships (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references public.diagrams on delete cascade,
  source_table_id uuid not null references public.erd_tables on delete cascade,
  source_col_id uuid references public.erd_columns on delete set null,
  target_table_id uuid not null references public.erd_tables on delete cascade,
  target_col_id uuid references public.erd_columns on delete set null,
  cardinality text not null default 'one-to-many'
);

create index if not exists idx_members_user on public.workspace_members (user_id);
create index if not exists idx_diagrams_ws on public.diagrams (workspace_id);
create index if not exists idx_tables_diagram on public.erd_tables (diagram_id);
create index if not exists idx_columns_table on public.erd_columns (table_id);
create index if not exists idx_rels_diagram on public.erd_relationships (diagram_id);

-- =====================================================================
-- Access helper functions (SECURITY DEFINER avoids recursive RLS)
-- =====================================================================

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.is_diagram_accessible(d uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.diagrams dg
    join public.workspace_members m on m.workspace_id = dg.workspace_id
    where dg.id = d and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_table_accessible(t uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.erd_tables tb
    join public.diagrams dg on dg.id = tb.diagram_id
    join public.workspace_members m on m.workspace_id = dg.workspace_id
    where tb.id = t and m.user_id = auth.uid()
  );
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.diagrams enable row level security;
alter table public.erd_tables enable row level security;
alter table public.erd_columns enable row level security;
alter table public.erd_relationships enable row level security;

-- profiles: a user can read/update only their own profile.
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (id = auth.uid());

-- workspaces: members can read; users can create their own; owners manage.
drop policy if exists "workspace member read" on public.workspaces;
create policy "workspace member read" on public.workspaces
  for select using (public.is_workspace_member(id));

drop policy if exists "workspace create" on public.workspaces;
create policy "workspace create" on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists "workspace owner update" on public.workspaces;
create policy "workspace owner update" on public.workspaces
  for update using (owner_id = auth.uid());

drop policy if exists "workspace owner delete" on public.workspaces;
create policy "workspace owner delete" on public.workspaces
  for delete using (owner_id = auth.uid());

-- workspace_members: members can read membership; owners manage.
drop policy if exists "members read" on public.workspace_members;
create policy "members read" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "members insert by owner" on public.workspace_members;
create policy "members insert by owner" on public.workspace_members
  for insert with check (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
    or user_id = auth.uid()
  );

drop policy if exists "members delete by owner" on public.workspace_members;
create policy "members delete by owner" on public.workspace_members
  for delete using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

-- diagrams
drop policy if exists "diagram access" on public.diagrams;
create policy "diagram access" on public.diagrams
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- erd_tables
drop policy if exists "table access" on public.erd_tables;
create policy "table access" on public.erd_tables
  for all using (public.is_diagram_accessible(diagram_id))
  with check (public.is_diagram_accessible(diagram_id));

-- erd_columns
drop policy if exists "column access" on public.erd_columns;
create policy "column access" on public.erd_columns
  for all using (public.is_table_accessible(table_id))
  with check (public.is_table_accessible(table_id));

-- erd_relationships
drop policy if exists "relationship access" on public.erd_relationships;
create policy "relationship access" on public.erd_relationships
  for all using (public.is_diagram_accessible(diagram_id))
  with check (public.is_diagram_accessible(diagram_id));

-- =====================================================================
-- Signup trigger: create profile + personal workspace + owner membership
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Keep diagrams.updated_at fresh
-- =====================================================================

create or replace function public.touch_diagram_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_diagram_touch on public.diagrams;
create trigger trg_diagram_touch
  before update on public.diagrams
  for each row execute function public.touch_diagram_updated_at();
