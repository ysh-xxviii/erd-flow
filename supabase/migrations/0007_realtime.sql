-- Enable Supabase Realtime for collaborative ERD editing.
-- Adds the ERD tables to the realtime publication so postgres_changes
-- events stream to connected clients. RLS still governs what each client
-- is allowed to receive.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'erd_tables'
  ) then
    alter publication supabase_realtime add table public.erd_tables;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'erd_columns'
  ) then
    alter publication supabase_realtime add table public.erd_columns;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'erd_relationships'
  ) then
    alter publication supabase_realtime add table public.erd_relationships;
  end if;
end $$;

-- Ensure full row data is available on updates/deletes for client merges.
alter table public.erd_tables replica identity full;
alter table public.erd_columns replica identity full;
alter table public.erd_relationships replica identity full;
