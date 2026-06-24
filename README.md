# ERD Flow

A multi-tenant, AI-assisted **Entity-Relationship Diagram builder**. Sign up, get your own
workspace, define tables, receive AI-recommended related tables, and render a beautiful
dark-themed interactive schema diagram.

## Features

- **Auth** — email/password login & signup (Supabase Auth)
- **Multi-tenant** — every user gets a personal workspace on signup; all data is isolated per
  workspace via Postgres Row-Level Security
- **Visual ERD builder** — drag-and-drop entity cards with color-coded headers, columns with
  PK/FK markers, and relationship connectors (React Flow)
- **AI table suggestions** — describe your app or define a few tables and get recommended
  related tables, columns, and foreign keys (OpenAI)
- **Persistence** — tables, columns, positions, and relationships saved to Supabase

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, RLS)
- React Flow (`@xyflow/react`)
- OpenAI

## Getting started

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. In the dashboard, open **SQL Editor** and run the migration in
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). This creates all
   tables, RLS policies, and the signup trigger that provisions a personal workspace.
   Then run [`supabase/migrations/0002_table_category.sql`](supabase/migrations/0002_table_category.sql),
   which adds the `category` column used to group tables into Core domain / Enums / Framework.
   Then run [`supabase/migrations/0003_schema_metadata.sql`](supabase/migrations/0003_schema_metadata.sql),
   which adds table descriptions, column defaults/labels, and index/unique constraints.
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

> The AI suggestion route uses the OpenAI SDK pointed at `OPENAI_BASE_URL`, so any
> OpenAI-compatible provider works (Groq, Together, OpenRouter, local Ollama, etc.).
> Groq is recommended for a free, open-source option.

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
  (app)/diagram/[id]            The ERD builder
  api/ai/suggest-tables         OpenAI suggestion route
lib/
  supabase/                     Browser + server clients
  types.ts                      Shared domain types
supabase/migrations/            SQL schema + RLS + triggers
proxy.ts                        Route protection + session refresh
```
