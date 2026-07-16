-- Project connections + active environment on diagrams (codecontext MVP).

alter table public.diagrams
  add column if not exists repo_url text,
  add column if not exists db_host text,
  add column if not exists db_name text,
  add column if not exists db_connection_hint text,
  add column if not exists repo_connected boolean not null default false,
  add column if not exists db_connected boolean not null default false,
  add column if not exists active_env text not null default 'dev';

alter table public.diagrams
  drop constraint if exists diagrams_active_env_check;

alter table public.diagrams
  add constraint diagrams_active_env_check
  check (active_env in ('dev', 'staging', 'prod'));
