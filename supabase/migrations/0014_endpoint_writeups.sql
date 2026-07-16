-- Plain-English endpoint writeups on API requests.

alter table public.diagram_api_requests
  add column if not exists writeup_intro text,
  add column if not exists writeup_steps jsonb not null default '[]'::jsonb;
