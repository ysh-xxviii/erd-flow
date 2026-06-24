-- JSONB shape metadata for sidebar + schema drawer.

alter table public.erd_columns
  add column if not exists json_description text,
  add column if not exists json_schema text;
