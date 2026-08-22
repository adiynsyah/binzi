# BINZI V1 — GLM-5 Development Task Plan

## Purpose

This document is the execution plan for building BINZI V1 with GLM-5.

It converts the approved specifications into small implementation tasks.

GLM-5 must not treat this as permission to redesign the product. The existing specifications remain authoritative.

---

# 0. How To Use This Plan

Work sequentially.

For each task:

```text
Read task
  ↓
Inspect existing code
  ↓
Implement only requested scope
  ↓
Run validation
  ↓
Review diff
  ↓
Commit
  ↓
Move to next task
```

Do not ask GLM-5 to implement multiple unrelated milestones at once.

---

# 1. Global GLM-5 Prompt Contract

Use this context at the beginning of coding sessions:

```text
You are implementing BINZI V1.

Treat the BINZI specification documents as authoritative:
1. Database Specification
2. Drizzle Schema Specification
3. Architecture Specification
4. CMS Specification
5. Business Rules Specification
6. UI/UX Specification
7. Technical Implementation Blueprint
8. GLM-5 Development Task Plan

Do not redesign approved business rules without explicit approval.

Do not add future features such as:
- XP
- Levels
- Badges
- Daily Missions
- Streaks
- Leaderboards
- AI Nutrition Assistant
- Payments

Implement only the requested task.

Before changing code:
- inspect relevant existing files
- identify dependencies
- explain the intended change briefly

After implementation:
- run typecheck
- run lint
- run relevant tests
- report failures honestly

Never:
- expose secrets
- trust client-provided score
- trust client-provided role
- bypass authorization
- use destructive database commands against production
- silently modify business rules
```

---

# 2. Task Format

Each task follows:

```text
TASK ID
Title
Goal
Requirements
Constraints
Acceptance Criteria
Validation
```

---

# Milestone 1 — Foundation

## TASK 001 — Initialize Next.js Application

### Goal

Create the BINZI V1 application foundation.

### Requirements

- Next.js
- TypeScript
- App Router
- ESLint
- Sass/SCSS
- Basic project metadata

### Constraints

- Do not add unnecessary libraries.
- Do not implement features yet.

### Acceptance Criteria

- Application starts locally.
- Home page renders.
- TypeScript works.
- SCSS works.
- Lint works.

### Validation

```text
npm run dev
npm run lint
npm run build
```

---

## TASK 002 — Establish SCSS Architecture

### Goal

Create the global styling foundation.

### Requirements

Create:

```text
styles/
├── globals.scss
├── tokens.scss
└── mixins.scss
```

Configure global import.

### Acceptance Criteria

- Global CSS reset/base works.
- Design tokens can be consumed.
- Component SCSS Modules work.

---

## TASK 003 — Create Base UI Primitives

### Goal

Create only reusable primitives required by the initial application.

Potential primitives:

```text
Button
Input
Textarea
Select
Modal
Badge
Card
Spinner
Skeleton
```

### Constraint

Do not build a massive design system.

### Acceptance Criteria

Each primitive:

- Is typed.
- Has accessible semantics.
- Supports required states.
- Has SCSS Module styling.

---

## TASK 004 — Configure Environment Variables

### Goal

Create safe environment configuration.

### Requirements

Create:

```text
.env.example
```

Expected variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
```

### Acceptance Criteria

- `.env.local` is ignored.
- Secrets are not committed.
- Server-only values are not imported into client components.

---

# Milestone 2 — Database

## TASK 005 — Configure Drizzle

### Goal

Configure Drizzle ORM and database connection.

### Requirements

- Drizzle config
- Server database client
- Migration directory
- npm scripts

### Acceptance Criteria

A simple database connection can be verified.

---

## TASK 006 — Implement Core Drizzle Schema

### Goal

Implement the approved database schema.

### Scope

Implement all approved V1 entities and relationships.

Do not invent new business entities.

### Acceptance Criteria

- Foreign keys correct.
- Required uniqueness constraints correct.
- Status fields correct.
- Ordering fields correct.
- Quiz/question relationships correct.
- Enrollment uniqueness correct.
- Content single-Lesson usage constraint correct.

---

## TASK 007 — Generate and Review Initial Migration

### Goal

Create initial database migration.

### Requirements

- Generate migration.
- Inspect SQL.
- Confirm indexes and constraints.

### Acceptance Criteria

Migration can be applied to a clean development database.

---

## TASK 008 — Create Development Seed

### Goal

Create realistic development data.

### Seed

```text
Admin
User

Published Course
3 Lessons
Lesson Contents
Lesson Quizzes
10 Questions per Lesson Quiz
Final Quiz
10 Questions

Draft Course
```

### Acceptance Criteria

Seed can be executed repeatedly in a clean development environment.

---

# Milestone 3 — Authentication

## TASK 009 — Configure Supabase Browser Client

### Goal

Create the browser-side Supabase client.

### Constraints

Use official Supabase SSR/client patterns.

---

## TASK 010 — Configure Supabase Server Client

### Goal

Create server-side authenticated Supabase client.

### Acceptance Criteria

Server can identify current authenticated user.

---

## TASK 011 — Implement Registration

### Goal

Create user registration.

### Requirements

- Email
- Password
- Confirm password
- Validation
- Supabase Auth

### Acceptance Criteria

New user can register and receive an application user record where required.

---

## TASK 012 — Implement Login and Logout

### Goal

Implement authentication lifecycle.

### Acceptance Criteria

- Login works.
- Logout works.
- Invalid credentials show useful feedback.
- Session persists correctly.

---

## TASK 013 — Protect Authenticated Routes

### Goal

Protect user learning routes.

### Acceptance Criteria

Guest cannot access protected learning experience.

---

## TASK 014 — Protect Admin Routes

### Goal

Restrict CMS to ADMIN.

### Acceptance Criteria

```text
Guest → login
USER → forbidden
ADMIN → allowed
```

Authorization must be server-side.

---

# Milestone 4 — Content CMS

## TASK 015 — Create Admin Shell

### Goal

Create CMS layout.

### Requirements

Navigation:

```text
Dashboard
Courses
Contents
Questions
```

### Acceptance Criteria

ADMIN can navigate CMS.

---

## TASK 016 — Build Content List

### Goal

Display Content records in CMS.

### Requirements

- Search
- Status
- Type
- Pagination if necessary
- Create CTA

---

## TASK 017 — Build Tiptap Editor

### Goal

Create the reusable rich text editor.

### Initial extensions

- StarterKit
- Link
- Image
- Placeholder

### Acceptance Criteria

Editor can:

- headings
- paragraphs
- bold
- italic
- lists
- links
- images

Content is represented as JSON.

---

## TASK 018 — Content Create

### Goal

Create Content as Draft.

### Requirements

- Title
- Slug
- Type
- Body
- Metadata required by schema

### Acceptance Criteria

Draft Content is saved and not publicly visible.

---

## TASK 019 — Content Edit

### Goal

Edit Draft/allowed Content.

### Acceptance Criteria

Existing Content can be opened, edited, and saved.

---

## TASK 020 — Content Publish

### Goal

Publish valid Content.

### Acceptance Criteria

- Publish action validates required fields.
- Published Content becomes publicly accessible.
- Invalid Content remains Draft.
- Server enforces validation.

---

## TASK 021 — Content Preview

### Goal

Allow Admin to preview Content.

### Constraint

Preview must not make Draft Content public.

---

# Milestone 5 — Course CMS

## TASK 022 — Course List

### Goal

Create Course management screen.

### Requirements

- Search
- Status
- Create Course

---

## TASK 023 — Course Create/Edit

### Goal

Manage Course metadata.

### Acceptance Criteria

Course can be saved as Draft.

---

## TASK 024 — Course Builder

### Goal

Create Course Builder experience.

### UI:

```text
Course information
Lessons
Lesson ordering
Final Quiz
Publish
```

---

## TASK 025 — Lesson Create

### Goal

Create Draft Lesson inside Course.

### Acceptance Criteria

Draft Lesson can be created and edited.

---

## TASK 026 — Lesson Ordering

### Goal

Reorder Lessons.

### Requirements

- Drag/drop
- Accessible move up/down fallback
- Persist sort order

---

## TASK 027 — Lesson Delete

### Goal

Implement deletion rules.

### Acceptance Criteria

```text
Draft Lesson → can delete
Published Lesson → cannot delete
```

Server must enforce the rule.

---

## TASK 028 — Content Assignment

### Goal

Assign Content to Lesson.

### Acceptance Criteria

- Content search
- Existing assigned Content disabled/hidden
- Content order supported
- UNIQUE(content_id) rule respected

---

## TASK 029 — Lesson Content Ordering

### Goal

Allow Admin to reorder Content within Lesson.

### Acceptance Criteria

Order persists after refresh.

---

# Milestone 6 — Question Bank and Quiz CMS

## TASK 030 — Question Bank List

### Goal

Create Question Bank.

### Requirements

- Search
- Question list
- Create Question

---

## TASK 031 — Question Create/Edit

### Goal

Create reusable multiple-choice Questions.

### Requirements

- Question text
- Options
- Exactly one correct option
- Optional explanation

### Acceptance Criteria

Invalid correct-answer configuration cannot be published.

---

## TASK 032 — Question Reuse

### Goal

Allow Questions to be used in multiple Quizzes.

### Acceptance Criteria

A Question used in Quiz A remains available for Quiz B.

---

## TASK 033 — Lesson Quiz Builder

### Goal

Build Lesson Quiz.

### Requirements

- Select Questions
- Reorder Questions
- Remove Questions

### Acceptance Criteria

Exactly 10 Questions required for publish.

---

## TASK 034 — Final Quiz Builder

### Goal

Build Final Quiz.

### Acceptance Criteria

Valid range:

```text
10–30 Questions
```

---

## TASK 035 — Quiz Publish Validation

### Goal

Centralize quiz publication rules.

### Rules

Lesson Quiz:

```text
10 Questions
```

Final Quiz:

```text
10–30 Questions
```

Each Question:

```text
exactly one correct option
```

Passing score:

```text
80%
```

---

# Milestone 7 — Public Website

## TASK 036 — Public Layout

### Goal

Create responsive public shell.

### Navigation

```text
Logo
Courses
Articles
Login/Profile
```

---

## TASK 037 — Homepage

### Goal

Implement Homepage based on UI/UX Specification.

### Sections

```text
Hero
Featured Courses
Why BINZI
Featured Articles
CTA
```

---

## TASK 038 — Course Catalog

### Goal

Build public Course listing.

### Requirements

- Course cards
- Search
- Basic filtering if approved

---

## TASK 039 — Course Detail

### Goal

Build public Course detail.

### Requirements

- Course metadata
- Learning outcomes
- Curriculum
- CTA
- Guest preview

---

## TASK 040 — Article Listing

### Goal

Build public Article listing.

---

## TASK 041 — Article Detail

### Goal

Build public Article page.

### Requirements

- Published Article only
- SEO metadata
- Related content where appropriate

---

# Milestone 8 — Enrollment and Learning

## TASK 042 — Enrollment

### Goal

Allow authenticated users to start a Course.

### Rules

One enrollment per:

```text
user + course
```

---

## TASK 043 — Course Progress Query

### Goal

Build authoritative Course progress retrieval.

### Acceptance Criteria

Progress reflects completed Lessons.

---

## TASK 044 — Lesson Access Service

### Goal

Implement centralized Lesson access logic.

### Rules

```text
Lesson 1 → accessible
Lesson N → requires previous Lesson completion
```

Server-side enforcement required.

---

## TASK 045 — Learning Layout

### Goal

Build learning experience layout.

### Desktop

```text
Lesson navigation | Content
```

### Mobile

Collapsible navigation.

---

## TASK 046 — Render Lesson Content

### Goal

Render Content in persisted order.

### Supported types

```text
ARTICLE
VIDEO
INFOGRAPHIC
TEXT
TIP
```

---

## TASK 047 — Lesson Progress UI

### Goal

Show:

```text
Lesson X of Y
Course progress
Completed state
```

---

# Milestone 9 — Quiz Engine

## TASK 048 — Quiz Access Service

### Goal

Centralize Quiz authorization.

### Rules

User must:

- Be authenticated
- Have Course access
- Have Lesson access

Final Quiz additionally requires all Lessons completed.

---

## TASK 049 — Quiz Player

### Goal

Implement sequential quiz experience.

### Requirements

```text
Question X of Y
Single answer
Next
Submit
```

---

## TASK 050 — Server Quiz Scoring

### Goal

Calculate score server-side.

### Critical Rule

Never trust:

```text
client score
client passed
```

Server loads authoritative Questions and correct Options.

---

## TASK 051 — Store Quiz Attempt

### Goal

Persist:

```text
Quiz Attempt
Quiz Answers
Score
Passed
```

Use a transaction.

---

## TASK 052 — Lesson Completion

### Goal

Complete Lesson when Quiz passes.

### Rule

```text
score >= 80%
```

Only then:

```text
Lesson completed
```

---

## TASK 053 — Quiz Retry

### Goal

Allow unlimited attempts.

### Rule

Failed attempt does not complete Lesson.

Passed Lesson remains completed even if a later attempt fails.

---

## TASK 054 — Lesson Unlocking

### Goal

Unlock next Lesson after previous completion.

### Acceptance Criteria

- Locked Lesson cannot be accessed by URL manipulation.
- Passing previous Quiz unlocks next Lesson.

---

# Milestone 10 — Final Quiz and Course Completion

## TASK 055 — Final Quiz Access

### Goal

Unlock Final Quiz only after all Lessons complete.

### Acceptance Criteria

Incomplete Course → Final Quiz locked.

---

## TASK 056 — Final Quiz Result

### Goal

Display Final Quiz result.

### Rule

```text
>= 80% → passed
< 80% → retry
```

---

## TASK 057 — Course Completion

### Goal

Complete enrollment.

### Rule

```text
All Lessons completed
+
Final Quiz passed
```

Then:

```text
enrollment.status = COMPLETED
completed_at = timestamp
```

---

# Milestone 11 — UX Polish

## TASK 058 — Loading States

Implement:

- Skeletons
- Button loading
- Editor loading
- Quiz loading

---

## TASK 059 — Error States

Implement useful:

- Network error
- Authorization error
- Validation error
- Not found
- Publish blocker

---

## TASK 060 — Empty States

Implement CMS/public empty states.

---

## TASK 061 — Responsive Refinement

Test:

```text
Mobile
Tablet
Desktop
```

Focus on:

- Learning
- Quiz
- Course cards
- CMS editor

---

## TASK 062 — Accessibility Pass

Check:

- Keyboard navigation
- Focus states
- Semantic HTML
- Labels
- Contrast
- Quiz options
- Reduced motion

---

## TASK 063 — SEO Pass

Implement:

- Metadata
- Sitemap
- Robots
- Canonicals
- Open Graph

---

# Milestone 12 — Testing

## TASK 064 — Business Rule Unit Tests

Test:

- 80% passing
- Lesson Quiz exactly 10
- Final Quiz 10–30
- Lesson unlock
- Final Quiz unlock
- Course completion

---

## TASK 065 — Service Integration Tests

Test:

- Quiz submission
- Attempt persistence
- Lesson completion
- Enrollment
- Content assignment
- Publish validation

---

## TASK 066 — Auth/Authorization Tests

Test:

```text
Guest
USER
ADMIN
```

against protected actions.

---

## TASK 067 — Critical E2E Tests

Minimum flows:

```text
Register
Login
Start Course
Complete Lesson
Pass Quiz
Unlock Lesson
Complete All Lessons
Pass Final Quiz
Course Completed
```

CMS:

```text
Create Content
Publish Content
Create Course
Create Lesson
Assign Content
Build Quiz
Publish Course
```

---

# Milestone 13 — Production Readiness

## TASK 068 — Security Review

Check:

- Secrets
- Auth
- Authorization
- Server actions
- Database permissions
- Storage policies
- Input validation
- XSS risks
- Draft exposure

---

## TASK 069 — Database Review

Check:

- Indexes
- Foreign keys
- Unique constraints
- Migration safety
- Query performance

---

## TASK 070 — Production Configuration

Configure:

- Vercel
- Supabase production
- Environment variables
- Auth redirects
- Storage
- Domain

---

## TASK 071 — Final Build Verification

Run:

```text
lint
typecheck
test
e2e
build
```

No known blocking errors.

---

# 3. Recommended First GLM-5 Session

Do not give GLM-5 all 71 tasks.

Start with:

```text
TASK 001
TASK 002
TASK 003
TASK 004
```

After completion and review, continue to:

```text
TASK 005
TASK 006
TASK 007
TASK 008
```

This creates a stable foundation before authentication and feature work.

---

# 4. Suggested Git Milestones

Recommended commits:

```text
chore: initialize BINZI project
chore: establish scss architecture
feat: add base ui primitives
chore: configure environment
feat: configure drizzle
feat: add database schema
chore: add initial migration
chore: add development seed
feat: configure supabase auth
feat: add authentication
feat: add admin authorization
feat: add content cms
feat: add tiptap editor
feat: add course builder
feat: add quiz cms
feat: add public course experience
feat: add learning engine
feat: add quiz engine
feat: add course completion
test: add core business rules
chore: production readiness
```

---

# 5. Task Completion Rule

A task is complete only when:

```text
Implementation
+
Typecheck
+
Lint
+
Relevant Tests
+
Manual Verification where needed
```

A visually complete UI is not sufficient.

---

# 6. When to Commit

Commit after a logically complete task or small group of tightly related tasks.

Avoid:

```text
100 changed files
1 giant commit
```

Prefer:

```text
1 feature
1 understandable commit
```

---

# 7. When GLM-5 Should Refuse to Continue

GLM-5 should stop and request clarification if:

- Requirements conflict.
- A task requires changing an approved business rule.
- A destructive migration is required.
- A security boundary is unclear.
- A new dependency substantially changes architecture.
- Existing code contradicts the specifications in a way that cannot safely be resolved.

---

# 8. Definition of V1 Completion

BINZI V1 is complete when the following complete journey works:

```text
Guest
 ↓
Homepage
 ↓
Course Catalog
 ↓
Course Detail
 ↓
Register/Login
 ↓
Start Course
 ↓
Lesson 1
 ↓
Content
 ↓
10-question Quiz
 ↓
80%+
 ↓
Lesson 2
 ↓
...
 ↓
All Lessons Completed
 ↓
Final Quiz
 ↓
10–30 Questions
 ↓
80%+
 ↓
Course Completed
```

And Admin can:

```text
Login
 ↓
Create Content
 ↓
Publish Content
 ↓
Create Course
 ↓
Create Lessons
 ↓
Order Lessons
 ↓
Assign Content
 ↓
Create Questions
 ↓
Build Lesson Quiz
 ↓
Build Final Quiz
 ↓
Publish Course
```

---

# 9. Final Rule

The AI is the implementation assistant.

The specifications are the product contract.

The human owner remains the final decision maker.

If GLM-5 suggests a technically better solution that changes product behavior, architecture, database relationships, or business rules, the suggestion should be reviewed before implementation.

Do not optimize the codebase by silently changing the product.
