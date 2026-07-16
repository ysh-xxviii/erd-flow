# ERD Flow

A multi-tenant **backend visibility & control plane**: ERD schemas, endpoint writeups,
API runner, live customer Postgres, and reviewable plans that can ship SQL.

## Features

- **Project shell** — Project · Backend · Frontend · Database · Plans
- **Environments** — `dev` / `staging` / `prod` with UI + **server-enforced** prod gate
- **Live database** — encrypted Postgres URL, real table browser, SELECT runner, queued mutations
- **Plans** — unsaved changes → Save to plan → Approve & ship applies SQL in a transaction
- **Backend / Schemas** — ERD canvas, AI suggest, playbook, comments, migrations
- **Backend / Endpoints** — writeup · payload · health · HTTP runner
- **Backend / Files** — schema-derived file map (git clone not yet enabled)
- **Frontend** — preview chrome mapped to API calls
- **Auth / multi-tenant** — Supabase Auth + RLS

## Production setup

### 1. Migrations

Run SQL migrations **in order** through
[`0015_db_credentials.sql`](supabase/migrations/0015_db_credentials.sql).

| Migration | Purpose |
| --- | --- |
| `0012` | Connection metadata + `active_env` |
| `0013` | Plans / plan items / plan comments |
| `0014` | Endpoint writeups |
| `0015` | `diagram_db_secrets` (service-role only ciphertext) |

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only; reads DB secrets |
| `APP_ENCRYPTION_KEY` | yes for live DB | ≥16 chars; encrypts customer Postgres URLs |
| `OPENAI_API_KEY` | for AI features | Groq or OpenAI |
| `OPENAI_BASE_URL` | optional | e.g. Groq `https://api.groq.com/openai/v1` |
| `OPENAI_MODEL` | optional | e.g. `llama-3.3-70b-versatile` |

Add the same vars in Vercel (or your host). **Never** expose `SUPABASE_SERVICE_ROLE_KEY` or `APP_ENCRYPTION_KEY` to the client.

### 3. Connect a customer database

1. Open a diagram → **Project** → **Connect database**
2. Paste `postgresql://user:pass@host:5432/db?sslmode=require`
3. Server tests the connection, stores ciphertext in `diagram_db_secrets`, returns only host/db metadata

### 4. Ship a plan

1. Queue changes (cell edits, bulk SQL, writeups, etc.) → **Save to plan**
2. **Plans** → open plan → **Approve & ship**
3. Server applies SQL statements (plus ERD schema sync when schema items exist) in a transaction
4. On **prod** env, UI + API require `confirmProduction: "PRODUCTION"`

### 5. Install & run

```bash
npm install
npm run dev
```

## Security notes

- Customer DB passwords never round-trip to the browser after save
- Secrets table has RLS enabled with no anon/authenticated policies
- HTTP proxy blocks private IPs (SSRF protection)
- Plan ship is **owner-only** and prod-gated on the server
- `?connected=1` only unlocks UI empty-states for endpoints/files — it does **not** grant a live DB

## Still deferred

- Git clone / static analysis for Files & auto-writeups
- Real traffic health metrics (endpoint Health tab is illustrative)
- Frontend is a generated preview, not a crawled live site

## Project structure

```
app/api/db/*          Live Postgres connect / query / execute
app/api/plans/ship    Approve & apply plan SQL
lib/customerDb.ts     pg client helpers
lib/crypto.ts         AES-GCM credential encryption
lib/diagramAccess.ts  Authz + service-role secret load
components/project/   Control-plane shell
supabase/migrations/  Through 0015
```
