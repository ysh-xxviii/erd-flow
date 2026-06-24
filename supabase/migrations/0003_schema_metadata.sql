-- Adds metadata fields for reference-style ERD cards:
-- table descriptions, column defaults/labels, and index/unique constraints.

alter table public.erd_tables
  add column if not exists description text not null default '';

alter table public.erd_columns
  add column if not exists default_value text,
  add column if not exists label text;

alter table public.erd_tables
  add column if not exists constraints jsonb not null default '[]';
