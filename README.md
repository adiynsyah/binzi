# BINZI

BINZI is a nutrition education platform built as a structured online course
application: administrators publish courses, lessons, and rich learning
content; learners enroll, study sequentially, and prove mastery through
quizzes. The user-facing interface is in Indonesian (Bahasa Indonesia).

This repository contains the complete V1 implementation, developed and
verified against the specifications in [`md/`](md/) (database, schema,
architecture, CMS, business rules, UI/UX, technical blueprint, task plan,
and decisions log).

## Overview

- **Product**: nutrition education — a course is a sequence of lessons; each
  lesson combines rich-text articles, videos, infographics, and tips; mastery
  is measured by per-lesson quizzes and a course-final quiz.
- **Roles** (two, per the specifications): `USER` (learner) and `ADMIN`
  (content manager). Guests can browse published content without an account.
- **Release state**: the development task plan (TASK 001–071) is complete and
  the V1 release baseline is commit `9260aba` (`feat: release hardening`).
  See [V1 release status](#v1-release-status).

## Core capabilities

All capabilities below are implemented and were verified end-to-end during
the V1 acceptance process.

### Learner flow

- Register, log in, and log out (Supabase Auth, server actions).
- Browse the public homepage, course catalog, course detail pages, and
  published articles without an account.
- Enroll in a published course; progress is derived from completed lessons.
- Lessons unlock sequentially: a lesson becomes accessible when the previous
  published lesson's quiz is passed (enforced server-side).
- Per-lesson quizzes: exactly 10 questions, one question per step, single
  answer per question; scoring is 100% server-side.
- Final quiz: 10–30 questions, unlocked only after every published lesson is
  completed; passing it completes the enrollment.
- Passing score is 80%. Attempts are unlimited; a failed attempt never
  un-completes prior progress.
- Skeleton loading states, error boundaries, and not-found pages across
  public, learning, and admin surfaces.

### CMS / admin (`/admin`, ADMIN role only)

- Content management: create/edit rich-text content (Tiptap editor) with
  types for article, text, video, infographic, and tip; draft → publish
  workflow.
- Course management: create courses (auto-generated slug), order lessons,
  publish when quiz requirements are met.
- Lesson management: create lessons, assign and order content, build the
  lesson quiz from the shared question bank.
- Question bank: create/edit multiple-choice questions (2–10 options,
  exactly one correct), reused across quizzes.
- Final quiz builder per course, with publish validation (lesson quiz
  exactly 10 questions; final quiz 10–30).
- Draft/published lifecycle rules enforced server-side (e.g. published
  lessons cannot be deleted; draft entities never appear on public pages).

### Authentication & authorization

- Route protection at request time (`src/proxy.ts`): guests are redirected
  to login for learning/profile routes; non-admins get `403` on `/admin`.
- Every server action re-authenticates and authorizes server-side
  (`USER`/`ADMIN` role from the database); role or user identity is never
  trusted from the client.

## Tech stack

| Area | Choice |
|---|---|
| Framework | [Next.js](https://nextjs.dev) 16 (App Router, Turbopack) with React 19 |
| Language | TypeScript |
| Database | PostgreSQL (Supabase) |
| Data layer | Drizzle ORM + postgres.js, SQL migrations via drizzle-kit |
| Auth | Supabase Auth via `@supabase/ssr` (cookie-based sessions) |
| Rich text | Tiptap 3 (CMS editing + server-side rendering to HTML) |
| Styling | Sass/SCSS with design tokens, CSS Modules, no CSS framework |
| Validation | Zod (environment, forms, and action boundaries) |
| Tooling | ESLint 9 (flat config, `eslint-config-next`), `tsc --noEmit` |

## Project structure

```
src/
  app/
    (auth)/       login and register pages
    (public)/     public shell: homepage, catalogs, course/article detail
    (learning)/   learning shell: course learning area, lessons, quizzes
    admin/        CMS (admin-only)
  components/     ui primitives, layout, learning, and feedback components
  features/       feature modules (auth, contents, courses, enrollment,
                  progress, questions, quizzes) with queries, mutations,
                  schemas, and services
  db/             Drizzle schema, migrations, and the development seed
  lib/            environment validation, Supabase client/server factories,
                  authorization helpers
  styles/         design tokens, mixins, global styles (SCSS)
  proxy.ts        request-time route protection
md/               project specifications and decisions log
```

## Local development setup

Prerequisites: Node.js 20+ with npm, and a Supabase project (for the
database and auth values below).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    ...then fill .env with real values from your Supabase dashboard

# 3. Apply the database migration
npm run db:migrate

# 4. (Optional) seed deterministic development/demo data
npm run db:seed

# 5. Start the development server
npm run dev
```

Available scripts (from `package.json`):

| Command | Purpose |
|---|---|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint over the repository |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate a migration from Drizzle schema changes |
| `npm run db:migrate` | Apply generated migrations |
| `npm run db:seed` | Seed development data (idempotent) |

## Environment variables

Names and semantics come from [`.env.example`](.env.example); real values
live only in your gitignored `.env` (or `.env.local` / `.env.production`).

| Variable | Exposure | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser-safe) | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser-safe) | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Yes | Privileged server operations (bypasses RLS) |
| `DATABASE_URL` | Server-only | Yes | Direct PostgreSQL connection string used by Drizzle |
| `SITE_URL` | Server-only | No | Absolute origin for canonical URLs, sitemap, and robots; falls back to `http://localhost:3000` |

Server-only variables are validated through `src/lib/env.ts`, which is
guarded by `import "server-only"` so accidental imports from client
components fail the build.

## Database

- **Schema source of truth**: `src/db/schema/` (Drizzle).
- **Migrations**: generated into `src/db/migrations/` with
  `npm run db:generate`, applied with `npm run db:migrate`. The V1 schema
  is a single migration. Review generated SQL before applying it; never
  reset a database that may hold data.
- **Seed**: `npm run db:seed` inserts deterministic development data
  (an admin and a regular user, one published course with three lessons,
  lesson quizzes, a final quiz, and one draft course). It is idempotent
  (deterministic UUIDs, `ON CONFLICT DO NOTHING`) and intended for
  development/demo environments — do not seed a production database.

## Testing and verification

This repository intentionally ships **no permanent test-runner setup** and
no `npm test` / `npm run e2e` scripts. Quality gates that exist today:

```bash
npm run lint
npm run typecheck
npm run build
```

During V1 development, behavior was verified through the task plan's
acceptance process — including compile/run harnesses for the blueprint's
unit/integration layers and real-browser end-to-end runs of the critical
flows (register, login, enroll, lesson completion, quiz pass/unlock, final
quiz, course completion, and the CMS publish chain). The final verification
(TASK 071) passed with no known blocking errors.

## Production / deployment

Repository-side readiness is complete: validated environment contract,
origin-agnostic auth redirects, configurable `SITE_URL` for SEO URLs, and
a clean production build. Deployment follows the blueprint's recommended
topology (Git → Vercel → Next.js, with Supabase providing PostgreSQL,
Auth, and Storage) and is **owner-side provisioning**:

1. Create a Vercel project from this repository and set the environment
   variables from the table above (with production Supabase values and
   `SITE_URL` set to the public origin).
2. Use a separate production Supabase project; apply migrations with
   `npm run db:migrate` against it; configure auth redirect URLs.
3. Work through the blueprint's production checklist (md/
   07_Technical_Implementation_Blueprint.md, "Production Checklist").

No production deployment has been performed from this repository yet; no
production URL is claimed.

## Security notes

- Authorization is enforced server-side: request-time route protection in
  `src/proxy.ts` plus per-action authentication/role checks. The client
  never supplies role, user id, or permission.
- Quiz scoring and pass/fail decisions are computed exclusively on the
  server from the database's answer key; client-submitted scores are never
  read.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`) are confined to
  server-only modules and never reach client bundles; `.env*` files are
  gitignored and only `.env.example` (placeholders) is committed.

## V1 release status

- Development task plan TASK 001–071: **complete** (see
  [md/08_GLM5_Development_Task_Plan.md](md/08_GLM5_Development_Task_Plan.md)).
- Final build verification (TASK 071): **pass** — lint, typecheck, build,
  test-layer and end-to-end verification with no known blocking errors.
- V1 release baseline: commit `9260aba` (`feat: release hardening`).

This is a release baseline, not a claim of a live production deployment.
