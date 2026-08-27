# BINZI V1 — Architecture Specification

## Status

Architecture baseline for implementation with Next.js, TypeScript, Supabase, Drizzle ORM, Tiptap, and SCSS Modules.

The architecture is intentionally optimized for a solo developer supported by AI coding tools such as GLM-5.

---

## 1. Architecture Goals

BINZI V1 should prioritize:

1. Simple mental model
2. Strong separation of responsibilities
3. Fast development
4. Easy AI-assisted implementation
5. Safe database operations
6. Minimal premature abstraction
7. Good future extensibility
8. Responsive public website
9. Efficient CMS for nutrition-content management

Avoid microservices, event-driven infrastructure, Kubernetes, CQRS, and other infrastructure that does not provide enough value for V1.

---

## 2. High-Level Architecture

```text
                    BINZI WEB
                       │
          ┌────────────┴────────────┐
          │                         │
      PUBLIC SITE                  CMS
          │                         │
          └────────────┬────────────┘
                       │
                 Next.js App
                       │
          ┌────────────┼────────────┐
          │            │            │
       Server       Services       UI
       Layer        Layer          Layer
          │            │
          └──────┬─────┘
                 │
              Drizzle
                 │
            PostgreSQL
              Supabase
                 │
       ┌─────────┴─────────┐
       │                   │
   Supabase Auth      Supabase Storage
```

---

## 3. Recommended Stack

### Application

- Next.js
- TypeScript
- React

### Styling

- SCSS Modules
- Global SCSS only for tokens, resets, typography, and truly global styles

Tailwind CSS is NOT required.

### Database

- PostgreSQL
- Supabase

### ORM

- Drizzle ORM

### Validation

- Zod

### Authentication

- Supabase Auth

### Storage

- Supabase Storage

### Rich Text

- Tiptap

### Deployment

- Vercel

---

## 4. Next.js Architecture

Use the Next.js App Router.

Recommended top-level structure:

```text
src/
├── app/
├── components/
├── features/
├── lib/
├── db/
├── styles/
└── types/
```

Do not put all business logic directly inside `app/`.

---

## 5. Route Structure

Recommended public routes:

```text
/
├── articles/
│   ├── page.tsx
│   └── [slug]/
│       └── page.tsx
│
├── courses/
│   ├── page.tsx
│   └── [slug]/
│       ├── page.tsx
│       └── learn/
│           ├── page.tsx
│           └── lessons/
│               └── [lessonId]/
│                   └── page.tsx
│
├── login/
├── register/
└── profile/
```

Admin/CMS:

```text
/admin/
├── page.tsx
├── courses/
│   ├── page.tsx
│   ├── new/
│   └── [courseId]/
│       ├── page.tsx
│       ├── edit/
│       └── lessons/
│           ├── new/
│           └── [lessonId]/
│
├── contents/
│   ├── page.tsx
│   ├── new/
│   └── [contentId]/
│
├── questions/
│   ├── page.tsx
│   ├── new/
│   └── [questionId]/
│
└── media/
```

The exact route hierarchy can be adjusted during CMS UX design.

---

## 6. Feature-Based Organization

Do not create one giant `components/` folder containing every component.

Use domain-oriented features:

```text
src/
├── features/
│   ├── courses/
│   ├── lessons/
│   ├── contents/
│   ├── quizzes/
│   ├── questions/
│   ├── enrollment/
│   ├── progress/
│   └── auth/
```

Example:

```text
features/quizzes/
├── components/
├── queries/
├── mutations/
├── schemas/
├── services/
└── types.ts
```

This makes each domain easier for both humans and AI coding agents to understand.

---

## 7. Shared Components

Use `src/components/` for genuinely reusable UI primitives.

Example:

```text
src/components/
├── ui/
│   ├── Button/
│   ├── Input/
│   ├── Modal/
│   ├── Dropdown/
│   ├── Badge/
│   └── EmptyState/
├── layout/
│   ├── Header/
│   ├── Footer/
│   └── Container/
└── feedback/
    ├── Toast/
    ├── Alert/
    └── Loading/
```

Do not move a component into shared UI merely because it is used twice.

Domain-specific components should remain inside their feature.

---

## 8. Server vs Client Components

Default to Server Components.

Use Client Components only when interaction/state requires them.

### Good Server Component candidates

- Course detail
- Article detail
- Lesson content display
- Course list
- Admin tables
- CMS read-only views

### Client Component candidates

- Tiptap editor
- Quiz answering UI
- Drag-and-drop ordering
- Modal/dialog with interactive state
- Form interactions requiring browser state
- Progress interactions

Do not add `"use client"` to entire feature trees unnecessarily.

---

## 9. Data Access Layer

UI components must not directly write arbitrary Drizzle queries.

Recommended flow:

```text
UI
 ↓
Server Action / Route Handler
 ↓
Service
 ↓
Repository/query function
 ↓
Drizzle
 ↓
PostgreSQL
```

For simple read-only Server Components, direct use of a query function is acceptable:

```text
Server Component
 ↓
Query Function
 ↓
Drizzle
```

The important rule is:

**Business logic must not live in UI components.**

---

## 10. Services

Services own business rules.

Recommended services:

```text
src/features/
├── courses/services/
│   └── course.service.ts
├── lessons/services/
│   └── lesson.service.ts
├── contents/services/
│   └── content.service.ts
├── quizzes/services/
│   └── quiz.service.ts
├── questions/services/
│   └── question.service.ts
├── enrollment/services/
│   └── enrollment.service.ts
└── progress/services/
    └── progress.service.ts
```

Examples:

### quiz.service.ts

```text
validateLessonQuiz()
validateFinalQuiz()
calculateScore()
submitAttempt()
canStartQuiz()
```

### progress.service.ts

```text
canAccessLesson()
completeLesson()
canAccessFinalQuiz()
completeCourse()
```

---

## 11. Repository / Query Layer

Keep database access reusable.

Example:

```text
features/courses/queries/
├── getCourseBySlug.ts
├── getCourseById.ts
├── listPublishedCourses.ts
└── getCourseForAdmin.ts
```

These functions should primarily retrieve/shape data.

Do not put large business workflows inside query functions.

---

## 12. Mutations

Mutations should go through server-side code.

Preferred V1 approach:

- Server Actions for application-owned form mutations.
- Route Handlers when an actual HTTP endpoint is useful.
- No unnecessary REST API layer for every internal operation.

Examples:

```text
createCourse()
updateCourse()
publishCourse()
createLesson()
deleteDraftLesson()
publishLesson()
createContent()
updateContent()
publishContent()
submitQuizAttempt()
startEnrollment()
```

All mutations must validate input with Zod.

---

## 13. Server Action Rule

A Server Action is not automatically a business-rule layer.

Example:

```text
publishLessonAction()
      ↓
auth check
      ↓
Zod validation
      ↓
lesson.service.publishLesson()
      ↓
database
```

Do not put the complete publishing workflow directly inside the action.

This keeps the service reusable and testable.

---

## 14. Authentication

Supabase Auth handles identity.

Application user record:

```text
auth.users
    ↓
public.users
```

When a user signs up, create/synchronize the corresponding public user record.

The server must obtain the authenticated user from the Supabase server-side auth context.

Never trust:

```text
userId
role
isAdmin
```

sent from the client.

---

## 15. Authorization

V1 has two roles:

```text
USER
ADMIN
```

### Public

Guests can:

- Browse published Articles
- Browse Course information
- View allowed previews
- See public content

### Authenticated User

Can:

- Enroll in Courses
- Access full learning content
- Submit quizzes
- View own progress
- View own profile

### Admin

Can:

- Manage Courses
- Manage Lessons
- Manage Content
- Manage Questions
- Manage Quizzes
- Manage Media
- Publish/unpublish allowed entities

Authorization must be checked server-side.

---

## 16. Content Access

Guest access is intentionally limited.

Conceptually:

```text
Guest
  ↓
Course page
  ↓
Preview content
  ↓
"Login to continue"
```

Authenticated user:

```text
Login
  ↓
Enrollment
  ↓
Full Lesson Content
```

The exact amount of preview content belongs to the product/UI specification, not the database layer.

---

## 17. Learning Access Control

Do not rely on frontend route hiding for locked Lessons.

A user might manually request:

```text
/learn/lesson/lesson-3
```

Therefore the server must verify:

```text
User authenticated?
      ↓
Enrollment exists?
      ↓
Lesson belongs to Course?
      ↓
Previous Lesson completed?
      ↓
Allow access
```

The same principle applies to Final Quiz access.

---

## 18. Quiz Submission

Quiz submission flow:

```text
Client
  ↓
Submit answers
  ↓
Server Action
  ↓
Authenticate user
  ↓
Validate payload with Zod
  ↓
Load Quiz + Questions + Options
  ↓
Validate submitted question/option relationships
  ↓
Calculate score on server
  ↓
Create quiz_attempt
  ↓
Create quiz_answers
  ↓
If passed:
    complete Lesson / Course
  ↓
Return result
```

Never calculate the authoritative score only in the browser.

---

## 19. Quiz Anti-Tampering Principle

The client can send:

```text
questionId
selectedOptionId
```

The client must NOT send an authoritative:

```text
score = 100
passed = true
```

The server calculates these values.

The server should verify that each selected option belongs to the submitted question.

---

## 20. Lesson Progress

The browser may display optimistic progress, but the server is authoritative.

Completion:

```text
Quiz passed
  ↓
progress.service.completeLesson()
  ↓
lesson_progress.status = COMPLETED
```

The client should not directly update:

```text
lesson_progress.status = COMPLETED
```

---

## 21. Final Quiz and Course Completion

Final Quiz access:

```text
all course lessons completed?
       │
      YES
       ↓
Final Quiz accessible
```

Course completion:

```text
all lessons completed
        +
final quiz passed
        ↓
enrollment = COMPLETED
```

This entire operation should be handled server-side.

---

## 22. CMS Architecture

CMS is not a separate application in V1.

It is an authenticated/admin section of the same Next.js application.

```text
BINZI Next.js
├── Public
└── Admin CMS
```

Advantages:

- One deployment
- One authentication system
- Shared components
- Shared database
- Shared types
- Lower maintenance burden

A separate CMS application can be considered later if the team grows.

---

## 23. CMS Domain

CMS should be optimized for the actual content workflow:

```text
Course
  ↓
Lessons
  ↓
Content
  ↓
Lesson Quiz
  ↓
Final Quiz
  ↓
Publish
```

Content creators should not need to understand database relationships.

The UI should express domain concepts, not database tables.

---

## 24. Tiptap

Tiptap should be isolated inside the Content feature.

Example:

```text
features/contents/
├── components/
│   ├── ContentEditor/
│   ├── TiptapEditor/
│   ├── ContentPreview/
│   └── ContentTypeSelector/
├── schemas/
├── services/
└── queries/
```

The rest of the application should not know about Tiptap's internal editor state.

Only the Content boundary deals with:

```text
Tiptap JSON
```

---

## 25. Media Upload

Recommended flow:

```text
CMS
 ↓
Select file
 ↓
Validate file
 ↓
Upload to Supabase Storage
 ↓
Create media metadata
 ↓
Return media reference
 ↓
Insert reference into Content
```

Do not store binary files inside PostgreSQL.

---

## 26. Draft / Publish Architecture

Draft is a first-class state.

Example:

```text
Content
 ├── DRAFT
 └── PUBLISHED
```

Publishing should be an explicit mutation.

Do not make saving a draft automatically publish it.

For Course publishing:

```text
save draft
    ↓
validate
    ↓
publish
```

---

## 27. Error Handling

Use typed application errors where useful.

Examples:

```text
UnauthorizedError
ForbiddenError
NotFoundError
ValidationError
ConflictError
BusinessRuleError
```

Do not expose raw PostgreSQL errors to users.

Example:

Instead of:

```text
duplicate key value violates unique constraint...
```

show:

```text
This content is already assigned to another lesson.
```

---

## 28. Logging

V1 needs simple structured server logging.

Log important failures:

- authentication failures
- authorization failures
- publish failures
- quiz submission failures
- unexpected database errors
- storage failures

Do not log:

- passwords
- access tokens
- session secrets
- sensitive user data unnecessarily

---

## 29. Environment Variables

Expected categories:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
```

Secrets must never be exposed to client components.

`SUPABASE_SERVICE_ROLE_KEY` must remain server-only.

---

## 30. Testing Strategy

V1 does not need exhaustive testing infrastructure immediately.

Prioritize tests for business-critical rules:

### Unit tests

- quiz score calculation
- passing score calculation
- Lesson Quiz validation
- Final Quiz validation
- lesson unlock logic
- final quiz unlock logic
- course completion logic

### Integration tests

- quiz submission
- lesson completion
- enrollment creation
- publishing workflow

### UI tests

Focus later on critical CMS flows.

---

## 31. AI Coding Rules for GLM-5

GLM-5 should follow these rules when implementing BINZI:

1. Read the project specification before modifying architecture.
2. Do not invent new database entities without explicit justification.
3. Do not change business rules silently.
4. Do not move business logic into UI components.
5. Do not bypass service-layer validation.
6. Do not use client-side scoring as the authoritative quiz result.
7. Do not expose server secrets.
8. Do not add a new library when an existing dependency already solves the problem.
9. Prefer small, focused modules.
10. Avoid premature abstraction.
11. Preserve existing database constraints.
12. Run type checking and relevant tests after meaningful changes.
13. Explain architectural changes before making large structural modifications.
14. If requirements conflict with existing specification, stop and ask for clarification instead of guessing.

---

## 32. AI Implementation Workflow

For each feature, GLM-5 should follow:

```text
1. Read relevant specification
2. Inspect existing implementation
3. Identify affected domains
4. Propose implementation plan
5. Implement smallest coherent change
6. Run typecheck
7. Run relevant tests
8. Review for security/auth issues
9. Review database/business-rule consistency
10. Summarize changes
```

Do not ask GLM-5 to build the entire platform in one prompt.

---

## 33. Recommended Development Order

### Phase 1 — Foundation

- Next.js project
- TypeScript
- SCSS
- ESLint
- formatting
- environment configuration

### Phase 2 — Database

- Supabase project
- PostgreSQL enums
- Drizzle schema
- migrations
- seed data
- database indexes
- RLS baseline

### Phase 3 — Authentication

- Supabase Auth
- login
- register
- logout
- protected routes
- user profile synchronization
- admin authorization

### Phase 4 — Content CMS

- Content CRUD
- Tiptap
- media upload
- draft/publish
- Content preview

### Phase 5 — Course CMS

- Course CRUD
- Lesson CRUD
- Lesson ordering
- Content assignment
- Lesson publish validation

### Phase 6 — Quiz CMS

- Question bank
- Question options
- quiz creation
- question assignment
- question ordering
- quiz validation
- publish validation

### Phase 7 — Public Learning

- Course catalog
- Course detail
- preview access
- enrollment
- lesson viewer
- lesson locking

### Phase 8 — Quiz Experience

- quiz UI
- server-side scoring
- attempts
- result screen
- retry
- lesson completion

### Phase 9 — Final Quiz

- unlock logic
- final quiz
- course completion

### Phase 10 — Polish

- responsive refinement
- accessibility
- loading states
- empty states
- error states
- SEO
- performance

---

## 34. Explicitly Deferred Architecture

Do not build infrastructure for these features in V1:

- AI Nutrition Assistant
- XP system
- Levels
- Badges
- Daily Missions
- Streaks
- Leaderboards
- Payments
- Subscriptions
- Multi-tenant organizations
- Microservices
- Event bus
- Dedicated backend service
- Separate CMS application

Future AI features should integrate through a clearly isolated service/module rather than coupling AI logic to the learning domain.

---

## 35. Architecture Principle

BINZI V1 should be:

**A modular monolith.**

Not:

- microservices
- serverless spaghetti
- giant monolithic files

The target is:

```text
One Next.js application
        │
        ├── Public
        ├── CMS
        ├── Feature modules
        ├── Services
        ├── Database layer
        └── Shared UI
```

This is the intended architecture for the first production version.
