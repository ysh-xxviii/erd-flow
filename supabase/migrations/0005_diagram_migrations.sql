-- Versioned migration history per diagram.
-- Stores generated SQL plus a name-based schema snapshot used to diff the next
-- version. Access is gated by the same diagram-membership rule as erd_tables.

create table if not exists public.diagram_migrations (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references public.diagrams on delete cascade,
  version integer not null,
  name text not null,
  sql text not null,
  snapshot jsonb not null default '{}',
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (diagram_id, version)
);

create index if not exists idx_diagram_migrations_diagram
  on public.diagram_migrations (diagram_id);

alter table public.diagram_migrations enable row level security;

drop policy if exists "diagram migrations access" on public.diagram_migrations;
create policy "diagram migrations access" on public.diagram_migrations
  for all using (public.is_diagram_accessible(diagram_id))
  with check (public.is_diagram_accessible(diagram_id));
