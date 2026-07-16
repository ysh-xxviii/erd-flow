# ERD Flow / codecontext MVP

A multi-tenant **backend visibility & control plane** prototype. Connect a project
(diagram), explore schemas as an ERD, endpoints as writeups + runner, a demo database
grid, and reviewable **plans** for change sets.

## Features

- **Project shell** — section rail: Project · Backend · Frontend · Database · Plans
- **Environments** — `dev` / `staging` / `prod` pill with a typed **prod gate**
- **Connections** — repo + DB connect modals (fake test); empty states until connected
- **Backend / Schemas** — existing ERD canvas, AI suggest, playbook, comments, migrations
- **Backend / Endpoints** — writeup (inline edit + sense-check) · payload · health · runner
- **Backend / Files** — mock repo tree; edits queue plan items
- **Database** — Beekeeper-style demo grid, AI SQL stub, bulk-edit preview
- **Frontend** — browser-chrome preview mapped to API calls
- **Plans** — unsaved changes → Save to plan → review walkthrough → Approve & ship
- **API testing** — Postman-style panel still available from the schemas toolbar
- **Auth / multi-tenant** — Supabase Auth + RLS workspaces

## Demo shortcuts

- Append `?connected=1` to a diagram URL to skip the connect gate locally.
- Project section → “Force demo connected” for a non-persisted override.

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, RLS)
- React Flow (`@xyflow/react`)
- OpenAI-compatible AI routes

## Getting started

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. In the dashboard, open **SQL Editor** and run migrations **in order** from
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) through
   [`supabase/migrations/0014_endpoint_writeups.sql`](supabase/migrations/0014_endpoint_writeups.sql).

   Notable later migrations:
   - `0011_api_testing.sql` — API environments / collections / requests
   - `0012_project_connections.sql` — repo/DB connection fields + `active_env`
   - `0013_diagram_plans.sql` — plans, plan items, plan comments
   - `0014_endpoint_writeups.sql` — writeup columns on requests

3. Under **Authentication > Providers**, ensure **Email** is enabled. For quick local testing
   you may disable "Confirm email" so new accounts can sign in immediately.

### 2. Configure environment variables

Copy the example file and fill in your keys:

```bash
cp .env.local.example .env.local
```

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings > API > anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings > API > service_role key |
| `OPENAI_API_KEY` | AI key. Free option: Groq ([console.groq.com/keys](https://console.groq.com/keys), `gsk_...`). Or OpenAI (`sk-...`) |
| `OPENAI_BASE_URL` | OpenAI-compatible endpoint. Groq: `https://api.groq.com/openai/v1`. Leave blank for OpenAI |
| `OPENAI_MODEL` | Groq: `llama-3.3-70b-versatile`. OpenAI: `gpt-4o-mini` |

### 3. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  (auth)/login, (auth)/signup   Auth pages
  (app)/dashboard               Workspaces + diagrams
  (app)/diagram/[id]            ProjectShell (codecontext MVP)
  api/ai/*, api/http/send       AI + HTTP proxy
components/
  project/                      Shell, sections, modals, plans UI
  erd/                          ERD canvas + API panel
lib/
  projectStore.tsx              Section / env / connection state
  pendingChanges.tsx            Unsaved change queue + toasts
  plans.ts                      Plan CRUD
  writeup.ts                    Endpoint writeup helpers
  mockData.ts                   Fake rows / files / SQL stubs
supabase/migrations/            SQL schema + RLS through 0014
```

## MVP honesty

Repo connect, DB connect tests, health sparklines, AI SQL, bulk edit, and frontend
preview use **stubbed / demo data**. Real HTTP runner and ERD persistence remain live.
Approving a plan shows a shipped toast and does **not** apply SQL to a customer database.
