-- Diagram comments / annotations.
-- Members of an accessible diagram can read and post comments; authors and
-- workspace owners can edit, resolve, or delete them.

create table if not exists public.diagram_comments (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references public.diagrams on delete cascade,
  table_id uuid references public.erd_tables on delete cascade,
  column_id uuid references public.erd_columns on delete cascade,
  author_id uuid references auth.users on delete set null,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_diagram_comments_diagram
  on public.diagram_comments (diagram_id, created_at);

create index if not exists idx_diagram_comments_table
  on public.diagram_comments (table_id);

alter table public.diagram_comments enable row level security;

-- Read for anyone who can access the diagram.
drop policy if exists "comments read" on public.diagram_comments;
create policy "comments read" on public.diagram_comments
  for select using (public.is_diagram_accessible(diagram_id));

-- Insert by accessible members; author must be the current user.
drop policy if exists "comments insert" on public.diagram_comments;
create policy "comments insert" on public.diagram_comments
  for insert with check (
    public.is_diagram_accessible(diagram_id)
    and author_id = auth.uid()
  );

-- Update by author or workspace owner (used for resolve/unresolve, edits).
drop policy if exists "comments update" on public.diagram_comments;
create policy "comments update" on public.diagram_comments
  for update using (
    author_id = auth.uid()
    or public.is_diagram_workspace_owner(diagram_id)
  )
  with check (
    author_id = auth.uid()
    or public.is_diagram_workspace_owner(diagram_id)
  );

-- Delete by author or workspace owner.
drop policy if exists "comments delete" on public.diagram_comments;
create policy "comments delete" on public.diagram_comments
  for delete using (
    author_id = auth.uid()
    or public.is_diagram_workspace_owner(diagram_id)
  );

-- Stream comment changes to collaborators in realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'diagram_comments'
  ) then
    alter publication supabase_realtime add table public.diagram_comments;
  end if;
end $$;

alter table public.diagram_comments replica identity full;
