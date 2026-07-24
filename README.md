# SecureVault Pro

Enterprise document management with a real, database-enforced clearance
model — rebuilt as a standalone React + Supabase + Vercel app (no Zite
runtime, no `.zite.so` link).

## What changed from the Zite prototype

| Prototype issue | Fix in this build |
|---|---|
| `deleteDocuments` / `getAllUsers` had no auth check (IDOR) | Every table has Postgres **Row Level Security**; there is no code path that can return/delete a row your clearance doesn't allow — even a compromised frontend can't bypass it |
| `searchDocuments` ignored classification & ownership | Search runs through the same RLS-scoped query as everything else — you only ever see what you're allowed to see |
| Clearance violations were logged, not blocked | `share_document()` **blocks** under-cleared recipients by default; only Admin/Manager can explicitly override, and the override itself is audited + alerted |
| Broadcast ignored clearance entirely | `broadcast_document()` filters recipients by clearance before sending |
| "Digital signature" was a 32-bit rolling hash of the filename | Real **SHA-256** hash + **HMAC-SHA256** signature, computed **server-side** in an Edge Function from the actual stored bytes (the client can't lie about what it uploaded), with a live re-verify button |
| Business rules (7-day suspension wait, ID range locking, admin protection) only lived in React | Enforced in `SECURITY DEFINER` Postgres functions, so they hold even if someone calls the API directly |

## Stack

- **Frontend**: Vite + React + TypeScript + Tailwind (no external UI kit — see `src/components/ui.tsx`)
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions)
- **Hosting**: Vercel

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run `supabase/schema.sql` in full. This creates every table, RLS policy, and business-logic function, plus a `documents` storage bucket.
3. **Deploy the two Edge Functions** (needs the [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set DOCUMENT_HMAC_SECRET=$(openssl rand -hex 32)
   supabase functions deploy sign-document
   supabase functions deploy verify-document
   ```
4. In **Authentication → Providers**, email/password is enabled by default. Turn on "Confirm email" if you want signup confirmation (recommended for a real deployment; optional for a demo).
5. Create your first account by signing up through the app itself, then in the SQL editor run:
   ```sql
   update profiles set role = 'Administrator' where email = 'you@example.com';
   ```
   Every other role (Manager, Security Officer, etc.) is then assignable from the admin console.
6. Copy your **Project URL** and **anon public key** from Settings → API — you'll need them next.

## 2. Run locally

```bash
npm install
cp .env.example .env      # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "SecureVault Pro"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/securevault-pro.git
git push -u origin main
```

## 4. Deploy to Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import the GitHub repo.
2. Framework preset: **Vite**. Build command `npm run build`, output directory `dist` (Vercel usually detects this automatically).
3. Add environment variables (same two as your `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. You'll get a real `your-project.vercel.app` URL — swap in a custom domain any time under Project → Domains.

## Project structure

```
supabase/schema.sql              Postgres schema, RLS policies, RPC functions
supabase/functions/sign-document Edge Function: SHA-256 + HMAC signing on upload
supabase/functions/verify-document  Edge Function: on-demand integrity re-check
src/lib/api.ts                   All data access (replaces zite-endpoints-sdk)
src/lib/auth.tsx                 Supabase Auth context (replaces zite-auth-sdk)
src/components/ui.tsx            Dependency-free UI primitives
src/pages/                       16 pages: dashboard, documents, sharing, search,
                                  notifications, profile, and 8 admin pages
```

## For your defense

Worth calling out explicitly: clearance enforcement now happens at the
**database** layer (RLS + `SECURITY DEFINER` functions), not just in React
components. That's the architecturally important fix — in the original
prototype, every access rule was something the frontend *chose* to check,
which is why `deleteDocuments`, `getAllUsers`, and `searchDocuments` could
skip it. Here, Postgres itself refuses the query regardless of what the
client sends. That's the difference between "the app enforces security"
and "the app *cannot help but* enforce security."

The one thing still worth being upfront about: the HMAC secret lives in
the Edge Function's environment, so trust ultimately roots in your
Supabase project's service-role key and secret storage — same as any
server-side signing scheme without a hardware security module. That's a
reasonable, honest limitation to name if asked.
