-- Reviewable change sets (plans) per diagram.

create table if not exists public.diagram_plans (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references public.diagrams on delete cascade,
  title text not null default 'Untitled plan',
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'approved', 'changes_requested')),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_diagram_plans_diagram
  on public.diagram_plans (diagram_id, created_at desc);

create table if not exists public.diagram_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diagram_plans on delete cascade,
  kind text not null
    check (kind in ('schema', 'endpoint', 'writeup', 'payload', 'file', 'db_row', 'cleanup')),
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  diff_hint text,
  sort_order integer not null default 0
);

create index if not exists idx_diagram_plan_items_plan
  on public.diagram_plan_items (plan_id, sort_order);

-- Simple plan review thread (MVP).
create table if not exists public.diagram_plan_comments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diagram_plans on delete cascade,
  author_id uuid references auth.users on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_diagram_plan_comments_plan
  on public.diagram_plan_comments (plan_id, created_at);

alter table public.diagram_plans enable row level security;
alter table public.diagram_plan_items enable row level security;
alter table public.diagram_plan_comments enable row level security;

drop policy if exists "plans read" on public.diagram_plans;
create policy "plans read" on public.diagram_plans
  for select using (public.is_diagram_accessible(diagram_id));

drop policy if exists "plans insert" on public.diagram_plans;
create policy "plans insert" on public.diagram_plans
  for insert with check (public.is_diagram_accessible(diagram_id));

drop policy if exists "plans update" on public.diagram_plans;
create policy "plans update" on public.diagram_plans
  for update using (public.is_diagram_accessible(diagram_id))
  with check (public.is_diagram_accessible(diagram_id));

drop policy if exists "plans delete" on public.diagram_plans;
create policy "plans delete" on public.diagram_plans
  for delete using (public.is_diagram_accessible(diagram_id));

drop policy if exists "plan items all" on public.diagram_plan_items;
create policy "plan items all" on public.diagram_plan_items
  for all using (
    exists (
      select 1 from public.diagram_plans p
      where p.id = plan_id and public.is_diagram_accessible(p.diagram_id)
    )
  )
  with check (
    exists (
      select 1 from public.diagram_plans p
      where p.id = plan_id and public.is_diagram_accessible(p.diagram_id)
    )
  );

drop policy if exists "plan comments all" on public.diagram_plan_comments;
create policy "plan comments all" on public.diagram_plan_comments
  for all using (
    exists (
      select 1 from public.diagram_plans p
      where p.id = plan_id and public.is_diagram_accessible(p.diagram_id)
    )
  )
  with check (
    exists (
      select 1 from public.diagram_plans p
      where p.id = plan_id and public.is_diagram_accessible(p.diagram_id)
    )
  );
