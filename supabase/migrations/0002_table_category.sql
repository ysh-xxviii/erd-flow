-- Adds a category to tables so the sidebar can group them like the reference
-- design: core domain, enums, and framework/infra.
-- Run this in the Supabase SQL editor after 0001_init.sql.

alter table public.erd_tables
  add column if not exists category text not null default 'core';

-- allowed values: 'core' | 'framework' | 'enum'
