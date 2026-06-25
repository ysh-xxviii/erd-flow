-- Playbook steps per diagram + workspace-owner helper.
-- Tightens diagram_migrations to owners only.

-- =====================================================================
-- Owner helper
-- =====================================================================

create or replace function public.is_workspace_owner(ws uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
  or exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = auth.uid()
  );
$$;

create or replace function public.is_diagram_workspace_owner(d uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.diagrams dg
    where dg.id = d
      and public.is_workspace_owner(dg.workspace_id)
  );
$$;

-- =====================================================================
-- Playbook steps
-- =====================================================================

create table if not exists public.diagram_playbook_steps (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references public.diagrams on delete cascade,
  ordinal integer not null default 0,
  title text not null,
  instructions text not null default '',
  check_type text not null default 'manual'
    check (check_type in ('manual', 'table_exists', 'column_exists', 'relationship_exists')),
  criteria jsonb not null default '{}',
  is_done boolean not null default false,
  done_at timestamptz,
  done_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_playbook_steps_diagram
  on public.diagram_playbook_steps (diagram_id, ordinal);

alter table public.diagram_playbook_steps enable row level security;

-- Members (and owners) can read steps for accessible diagrams.
drop policy if exists "playbook read" on public.diagram_playbook_steps;
create policy "playbook read" on public.diagram_playbook_steps
  for select using (public.is_diagram_accessible(diagram_id));

-- Owners manage step definitions.
drop policy if exists "playbook owner write" on public.diagram_playbook_steps;
create policy "playbook owner write" on public.diagram_playbook_steps
  for all using (public.is_diagram_workspace_owner(diagram_id))
  with check (public.is_diagram_workspace_owner(diagram_id));

-- Members can toggle manual steps only.
drop policy if exists "playbook member manual toggle" on public.diagram_playbook_steps;
create policy "playbook member manual toggle" on public.diagram_playbook_steps
  for update using (
    public.is_diagram_accessible(diagram_id)
    and check_type = 'manual'
    and not public.is_diagram_workspace_owner(diagram_id)
  )
  with check (
    public.is_diagram_accessible(diagram_id)
    and check_type = 'manual'
  );

-- =====================================================================
-- Tighten diagram_migrations to workspace owners only
-- =====================================================================

drop policy if exists "diagram migrations access" on public.diagram_migrations;

drop policy if exists "diagram migrations owner read" on public.diagram_migrations;
create policy "diagram migrations owner read" on public.diagram_migrations
  for select using (public.is_diagram_workspace_owner(diagram_id));

drop policy if exists "diagram migrations owner write" on public.diagram_migrations;
create policy "diagram migrations owner write" on public.diagram_migrations
  for all using (public.is_diagram_workspace_owner(diagram_id))
  with check (public.is_diagram_workspace_owner(diagram_id));
