-- Postman-style API testing per diagram.
-- Members of an accessible diagram can read and manage environments, request
-- collections, and requests; creators and workspace owners can delete them.

-- =====================================================================
-- Environments: named variable sets ({{baseUrl}}, {{token}}, ...).
-- =====================================================================
create table if not exists public.diagram_api_environments (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references public.diagrams on delete cascade,
  name text not null default 'Default',
  variables jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_envs_diagram
  on public.diagram_api_environments (diagram_id, created_at);

-- =====================================================================
-- Collections: folders that group requests.
-- =====================================================================
create table if not exists public.diagram_api_collections (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references public.diagrams on delete cascade,
  name text not null default 'New collection',
  sort_order integer not null default 0,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_collections_diagram
  on public.diagram_api_collections (diagram_id, sort_order);

-- =====================================================================
-- Requests: a single HTTP request definition within a collection.
-- =====================================================================
create table if not exists public.diagram_api_requests (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references public.diagrams on delete cascade,
  collection_id uuid references public.diagram_api_collections on delete cascade,
  table_id uuid references public.erd_tables on delete set null,
  name text not null default 'New request',
  method text not null default 'GET',
  url text not null default '',
  headers jsonb not null default '[]'::jsonb,
  body text not null default '',
  body_type text not null default 'none',
  sort_order integer not null default 0,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_requests_diagram
  on public.diagram_api_requests (diagram_id, sort_order);

create index if not exists idx_api_requests_collection
  on public.diagram_api_requests (collection_id);

create index if not exists idx_api_requests_table
  on public.diagram_api_requests (table_id);

-- =====================================================================
-- Row-level security: accessible members read/write; creators and
-- workspace owners delete. Mirrors diagram_comments policies.
-- =====================================================================
alter table public.diagram_api_environments enable row level security;
alter table public.diagram_api_collections enable row level security;
alter table public.diagram_api_requests enable row level security;

-- Environments
drop policy if exists "api envs read" on public.diagram_api_environments;
create policy "api envs read" on public.diagram_api_environments
  for select using (public.is_diagram_accessible(diagram_id));

drop policy if exists "api envs insert" on public.diagram_api_environments;
create policy "api envs insert" on public.diagram_api_environments
  for insert with check (public.is_diagram_accessible(diagram_id));

drop policy if exists "api envs update" on public.diagram_api_environments;
create policy "api envs update" on public.diagram_api_environments
  for update using (public.is_diagram_accessible(diagram_id))
  with check (public.is_diagram_accessible(diagram_id));

drop policy if exists "api envs delete" on public.diagram_api_environments;
create policy "api envs delete" on public.diagram_api_environments
  for delete using (
    created_by = auth.uid()
    or public.is_diagram_workspace_owner(diagram_id)
  );

-- Collections
drop policy if exists "api collections read" on public.diagram_api_collections;
create policy "api collections read" on public.diagram_api_collections
  for select using (public.is_diagram_accessible(diagram_id));

drop policy if exists "api collections insert" on public.diagram_api_collections;
create policy "api collections insert" on public.diagram_api_collections
  for insert with check (public.is_diagram_accessible(diagram_id));

drop policy if exists "api collections update" on public.diagram_api_collections;
create policy "api collections update" on public.diagram_api_collections
  for update using (public.is_diagram_accessible(diagram_id))
  with check (public.is_diagram_accessible(diagram_id));

drop policy if exists "api collections delete" on public.diagram_api_collections;
create policy "api collections delete" on public.diagram_api_collections
  for delete using (
    created_by = auth.uid()
    or public.is_diagram_workspace_owner(diagram_id)
  );

-- Requests
drop policy if exists "api requests read" on public.diagram_api_requests;
create policy "api requests read" on public.diagram_api_requests
  for select using (public.is_diagram_accessible(diagram_id));

drop policy if exists "api requests insert" on public.diagram_api_requests;
create policy "api requests insert" on public.diagram_api_requests
  for insert with check (public.is_diagram_accessible(diagram_id));

drop policy if exists "api requests update" on public.diagram_api_requests;
create policy "api requests update" on public.diagram_api_requests
  for update using (public.is_diagram_accessible(diagram_id))
  with check (public.is_diagram_accessible(diagram_id));

drop policy if exists "api requests delete" on public.diagram_api_requests;
create policy "api requests delete" on public.diagram_api_requests
  for delete using (
    created_by = auth.uid()
    or public.is_diagram_workspace_owner(diagram_id)
  );
