-- Encrypted customer DB credentials in a secrets table.
-- RLS enabled with NO policies for authenticated/anon → only service role can read/write.

alter table public.diagrams
  add column if not exists db_connection_cipher text;

-- Prefer dedicated secrets table (service-role only).
create table if not exists public.diagram_db_secrets (
  diagram_id uuid primary key references public.diagrams on delete cascade,
  cipher text not null,
  updated_at timestamptz not null default now()
);

alter table public.diagram_db_secrets enable row level security;

-- Explicit deny: no policies for anon/authenticated (service role bypasses RLS).
drop policy if exists "db secrets deny all" on public.diagram_db_secrets;

comment on table public.diagram_db_secrets is
  'AES-GCM encrypted postgres URLs; readable only via service role on the server';
