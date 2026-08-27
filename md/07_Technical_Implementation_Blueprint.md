# BINZI V1 — Technical Implementation Blueprint

## Status

Implementation blueprint for BINZI V1.

This document translates the approved product, database, architecture, business-rule, CMS, and UI/UX specifications into an implementation sequence suitable for a solo developer working with GLM-5.

The goal is not to generate the entire application in one pass.

The goal is to create a sequence of small, verifiable implementation tasks.

---

# 1. Implementation Philosophy

BINZI V1 is implemented as a modular monolith.

```text
One Next.js application
├── Public Website
├── Learning Experience
├── Admin CMS
├── Feature Modules
├── Services
├── Drizzle Database Layer
└── Supabase
```

Avoid premature complexity.

Do not introduce:

- Microservices
- Separate backend application
- GraphQL
- Event bus
- CQRS
- Kubernetes
- Dedicated CMS application
- Unnecessary state-management framework

---

# 2. Recommended Initial Stack

```text
Next.js
TypeScript
React
SCSS Modules
Supabase
PostgreSQL
Drizzle ORM
Zod
Tiptap
Vercel
```

Supporting libraries should be added only when a concrete requirement exists.

---

# 3. Project Structure

Recommended:

```text
src/
├── app/
│   ├── (public)/
│   ├── (auth)/
│   ├── (learning)/
│   └── admin/
│
├── components/
│   ├── ui/
│   ├── layout/
│   └── feedback/
│
├── features/
│   ├── auth/
│   ├── courses/
│   ├── lessons/
│   ├── contents/
│   ├── quizzes/
│   ├── questions/
│   ├── enrollment/
│   └── progress/
│
├── db/
│   ├── schema/
│   ├── relations/
│   ├── queries/
│   └── index.ts
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── validation/
│   └── errors/
│
├── styles/
│   ├── globals.scss
│   ├── tokens.scss
│   └── mixins.scss
│
└── types/
```

Do not create empty abstractions merely to make the folder structure look complete.

---

# 4. Route Groups

Use Next.js route groups to separate concerns without affecting URLs.

Recommended:

```text
app/
├── (public)/
│   ├── page.tsx
│   ├── articles/
│   └── courses/
│
├── (auth)/
│   ├── login/
│   └── register/
│
├── (learning)/
│   └── courses/
│       └── [slug]/
│           └── learn/
│
└── admin/
```

The exact routing can evolve with implementation.

---

# 5. Dependency Installation Strategy

Install the minimum required dependencies first.

Core:

```text
next
react
react-dom
typescript
sass
zod
drizzle-orm
@supabase/ssr
@supabase/supabase-js
```

Tiptap:

```text
@tiptap/react
@tiptap/starter-kit
```

Additional Tiptap extensions should be installed only when used.

For drag-and-drop, select one maintained library when implementation begins rather than pre-installing multiple alternatives.

---

# 6. Environment Variables

Expected:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

Rules:

- Public variables may be exposed to the browser.
- Service-role key must be server-only.
- Database credentials must be server-only.
- `.env.local` must not be committed.

Provide:

```text
.env.example
```

with variable names but no secrets.

---

# 7. Supabase Setup

Create:

- Supabase project
- PostgreSQL database
- Auth configuration
- Storage buckets

Recommended initial storage concept:

```text
media
```

Storage policies must prevent unauthorized writes.

Admin media operations should be authorized server-side.

---

# 8. Database Setup

Drizzle should be the application's database schema source.

Recommended:

```text
src/db/schema/
├── users.ts
├── courses.ts
├── lessons.ts
├── contents.ts
├── quizzes.ts
├── questions.ts
├── enrollment.ts
└── progress.ts
```

Actual files may be combined where relationships are tightly coupled.

---

# 9. Migration Workflow

Use:

```text
Edit Drizzle schema
        ↓
Generate migration
        ↓
Review migration
        ↓
Apply migration
        ↓
Test
```

Never let an AI agent blindly reset a production database.

Database reset commands should be explicitly confirmed when data may exist.

---

# 10. Database Seed

Create development seed data.

Minimum seed:

```text
1 Admin
1 User

1 Published Course
3 Lessons
Each Lesson:
  multiple Content
  1 Lesson Quiz
  10 Questions

1 Final Quiz
10 Questions

Additional Draft Course
```

Seed should help test:

- Public pages
- Locked Lessons
- Passed Quiz
- Failed Quiz
- Final Quiz
- CMS editing
- Draft/Published states

---

# 11. Supabase Auth Architecture

Use Supabase Auth for identity.

Server:

```text
Supabase SSR client
        ↓
authenticated session
        ↓
application user
```

Do not create a second password/authentication system.

---

# 12. Auth Middleware / Protection

Protected areas:

```text
/profile
/courses/*/learn/*
/admin/*
```

Admin routes require:

```text
authenticated
+
ADMIN role
```

Important business authorization must still happen inside server actions/services.

Middleware is not the only security boundary.

---

# 13. Feature Module Pattern

Each major domain may use:

```text
features/courses/
├── components/
├── queries/
├── mutations/
├── services/
├── schemas/
└── types.ts
```

Example:

```text
features/quizzes/
├── components/
│   ├── QuizPlayer/
│   └── QuizResult/
├── queries/
│   └── getQuizForAttempt.ts
├── mutations/
│   └── submitQuiz.ts
├── services/
│   └── quiz.service.ts
└── schemas/
    └── quiz.schema.ts
```

---

# 14. Validation Pattern

Use Zod at external boundaries.

Examples:

```text
createCourseSchema
updateCourseSchema
createLessonSchema
contentSchema
questionSchema
quizSubmissionSchema
```

Validation should happen before business logic.

---

# 15. Service Pattern

Services own business rules.

Example:

```text
submitQuiz()
    ↓
validate submission
    ↓
verify access
    ↓
load authoritative quiz data
    ↓
calculate score
    ↓
store attempt
    ↓
complete Lesson if passed
```

Services should not depend on React components.

---

# 16. Query Pattern

Queries retrieve data.

Examples:

```text
getPublishedCourses()
getCourseBySlug()
getCourseForLearning()
getLessonForLearning()
getQuizForAttempt()
getAdminCourse()
```

Queries should not mutate state.

---

# 17. Mutation Pattern

Mutations change state.

Examples:

```text
createCourse()
updateCourse()
publishCourse()
createLesson()
deleteDraftLesson()
assignContent()
assignQuestion()
publishLesson()
submitQuiz()
```

Mutations must:

1. Authenticate.
2. Authorize.
3. Validate input.
4. Execute service logic.
5. Return a safe result.

---

# 18. Result Pattern

For important mutations, prefer structured results.

Example:

```text
{
  success: true,
  data: ...
}
```

or:

```text
{
  success: false,
  error: {
    code: "QUIZ_NOT_READY",
    message: "Lesson Quiz needs 2 more questions."
  }
}
```

Do not expose raw database errors.

---

# 19. CMS Implementation Order

Build CMS in this order:

```text
Admin shell
  ↓
Content
  ↓
Course
  ↓
Lesson
  ↓
Question Bank
  ↓
Lesson Quiz
  ↓
Final Quiz
  ↓
Publish Validation
  ↓
Media Library
```

This order reduces dependency complexity.

---

# 20. Content Implementation

Start with Content CRUD.

Requirements:

- Create
- Read
- Update
- Draft
- Publish
- Preview
- Delete according to reference rules

Tiptap belongs inside the Content feature.

---

# 21. Tiptap Implementation Boundary

Recommended:

```text
ContentEditor
    ↓
TiptapEditor
    ↓
JSON document
    ↓
Zod validation / normalization
    ↓
Content Service
    ↓
PostgreSQL JSONB
```

Do not store raw HTML as the primary content representation.

---

# 22. Tiptap V1 Extensions

Start with:

- StarterKit
- Image
- Link
- Underline if needed
- Placeholder

Do not implement custom nodes immediately.

Custom nutrition components can be added later.

---

# 23. Course Builder Implementation

Course Builder should support:

```text
Course metadata
Lesson list
Lesson ordering
Final Quiz access
Publish state
```

Course builder should not directly manipulate unrelated database tables from the client.

---

# 24. Lesson Builder Implementation

Lesson Builder:

```text
Lesson metadata
Content list
Content ordering
Lesson Quiz
Publish status
```

Ordering:

```text
drag/drop
+
accessible move up/down fallback
```

---

# 25. Content Picker

When adding Content to a Lesson:

```text
Search Content
Filter Type
Select Content
```

Already-assigned Content should be excluded or clearly disabled.

The server must still enforce:

```text
UNIQUE(content_id)
```

---

# 26. Question Bank Implementation

Question CRUD:

```text
Question text
Options
Correct option
Explanation
```

Validation:

```text
at least 2 options
exactly 1 correct option
```

The exact minimum number of options should be treated as an implementation detail unless explicitly changed later.

---

# 27. Quiz Builder

Quiz Builder supports:

```text
Select Questions
Reorder Questions
Remove Questions
```

Lesson Quiz:

```text
exactly 10
```

Final Quiz:

```text
10–30
```

Publish validation must enforce these rules.

---

# 28. Learning Engine

The Learning Engine handles:

```text
Enrollment
Lesson access
Lesson completion
Quiz access
Final Quiz access
Course completion
```

This should live primarily in:

```text
features/enrollment/
features/progress/
features/quizzes/
```

---

# 29. Lesson Access Function

Create a centralized server-side function conceptually similar to:

```text
canAccessLesson(userId, lessonId)
```

It should determine:

- Authenticated?
- Enrolled?
- Lesson exists?
- Lesson belongs to enrolled Course?
- Previous Lesson completed?
- Is Course/lesson in an accessible publication state?

Do not duplicate this logic across pages.

---

# 30. Final Quiz Access Function

Centralize:

```text
canAccessFinalQuiz(userId, courseId)
```

Rule:

```text
All Lessons completed
```

If not:

```text
Forbidden / Locked
```

---

# 31. Quiz Submission Implementation

Authoritative server flow:

```text
submitQuiz()
    ↓
Auth
    ↓
Access check
    ↓
Payload validation
    ↓
Load quiz
    ↓
Load questions/options
    ↓
Validate submitted option IDs
    ↓
Calculate score
    ↓
Create attempt
    ↓
Create answers
    ↓
If passed:
    update lesson progress
    possibly unlock next lesson
    possibly complete course
```

Use a database transaction for related writes.

---

# 32. Quiz Transaction

Quiz submission should use a transaction for:

```text
quiz_attempt
quiz_answers
lesson completion
course completion where applicable
```

The operation should not leave partially recorded attempts when an unexpected database failure occurs.

---

# 33. Progress Implementation

Progress should be derived from authoritative records.

Do not store redundant progress values unless there is a clear performance reason.

Example:

```text
Lesson completed
→ based on passed Lesson Quiz / progress record
```

Course completion:

```text
all Lessons completed
+
Final Quiz passed
```

---

# 34. Public Article Implementation

Published Article Content should be accessible through:

```text
/articles/[slug]
```

Draft Article:

- Admin preview only
- Not publicly indexed

Article does not create Course progress.

---

# 35. Public Course Implementation

Course page should load:

```text
Course
Lessons
Public metadata
```

Guests can see permitted information.

Authenticated users can enter the Learning Experience after enrollment/access conditions are satisfied.

---

# 36. Learning Page Implementation

Learning page loads:

```text
Course
Current Lesson
Ordered Content
Quiz state
Progress
Navigation state
```

Server determines access.

Client handles interactive presentation.

---

# 37. Client State

Avoid a global state manager in V1 unless a concrete requirement appears.

Use:

- Server Components
- URL state
- Local React state
- Server Actions
- Form state

for most interactions.

Do not introduce Redux/Zustand/etc. by default.

---

# 38. Forms

Use server-side validation as the source of truth.

Client-side validation may improve UX.

Example:

```text
Client Zod
+
Server Zod
```

Do not remove server validation just because client validation exists.

---

# 39. Styling Architecture

Use SCSS Modules.

Example:

```text
CourseCard/
├── CourseCard.tsx
└── CourseCard.module.scss
```

Global styles only for:

- reset
- typography base
- CSS variables/tokens
- global utility classes if truly necessary

Do not create one giant global stylesheet.

---

# 40. Design Tokens

Create:

```text
styles/tokens.scss
```

Containing:

- Colors
- Typography sizes
- Spacing
- Radius
- Shadows
- Breakpoints
- Transition durations

Components consume tokens rather than hardcoded repeated values.

---

# 41. Responsive Implementation

Public website:

```text
Mobile
Tablet
Desktop
```

should be treated as one responsive system.

Avoid building three separate UIs.

CMS:

```text
Desktop-first
Responsive enough for tablet/mobile
```

---

# 42. Image Handling

Use Next.js image optimization where appropriate.

Images should:

- Have dimensions/aspect ratio
- Have alt text
- Avoid layout shift
- Be responsive

CMS-uploaded images should reference Supabase Storage.

---

# 43. Performance Priorities

Prioritize:

1. Server rendering where useful
2. Small client component boundaries
3. Optimized images
4. Efficient database queries
5. Avoiding unnecessary client-side fetching
6. Proper indexes

Do not optimize prematurely.

---

# 44. SEO Implementation

Public published:

- Articles
- Courses

should have metadata.

Draft pages should not be indexed.

Use:

```text
metadata
sitemap
robots
canonical URLs
Open Graph
```

where appropriate.

---

# 45. Testing Layers

Minimum test strategy:

```text
Unit
  ↓
Business rules

Integration
  ↓
Database + services

E2E
  ↓
Critical user flows
```

Critical E2E flows:

```text
Register
Login
Enroll
Complete Lesson
Pass Quiz
Unlock Lesson
Complete Final Quiz
CMS Publish
```

---

# 46. Development Environment

Recommended scripts:

```text
dev
build
start
lint
typecheck
test
test:e2e
db:generate
db:migrate
db:seed
```

Exact commands depend on final package setup.

---

# 47. Git Workflow

Keep commits small and meaningful.

Examples:

```text
feat(auth): add Supabase login
feat(cms): add content editor
feat(quiz): add lesson quiz submission
fix(progress): prevent locked lesson access
refactor(course): simplify course query
```

Avoid giant commits such as:

```text
build entire app
```

---

# 48. GLM-5 Task Protocol

Every coding task given to GLM-5 should contain:

```text
Context
Goal
Relevant Specification
Files/Area
Requirements
Constraints
Acceptance Criteria
Validation
```

Example:

```text
Context:
BINZI uses Supabase Auth and ADMIN role.

Goal:
Protect /admin routes.

Relevant Specification:
Architecture §12
Business Rules §7

Requirements:
- Unauthenticated users cannot access /admin.
- USER role cannot access /admin.
- ADMIN can access /admin.

Constraints:
- Do not introduce another auth library.
- Keep authorization server-side.

Acceptance Criteria:
- Guest → redirected to login.
- USER → forbidden.
- ADMIN → dashboard.

Validation:
- typecheck
- relevant auth tests
```

---

# 49. GLM-5 Do Not Rules

GLM-5 must not:

- Rewrite architecture without approval.
- Change database schema casually.
- Remove constraints to make tests pass.
- Trust client score.
- Trust client role.
- Put secrets into client code.
- Add dependencies without justification.
- Create duplicate business logic.
- Build unused future features.
- Replace SCSS with Tailwind without approval.
- Replace Tiptap without approval.
- Add gamification in V1.
- Add AI Nutrition Assistant in V1.

---

# 50. GLM-5 Escalation Rules

GLM-5 should stop and ask for clarification when:

- Two specifications conflict.
- A database migration would destroy existing data.
- A business rule needs to change.
- A new entity appears necessary but is not specified.
- A dependency would significantly change architecture.
- Authentication/authorization assumptions are unclear.

It should not silently invent a solution.

---

# 51. Implementation Milestones

## Milestone 1 — Foundation

Deliver:

- Next.js project
- TypeScript
- SCSS
- linting
- formatting
- environment setup

## Milestone 2 — Database

Deliver:

- Drizzle schema
- migrations
- seed
- indexes
- constraints

## Milestone 3 — Auth

Deliver:

- Register
- Login
- Logout
- Protected routes
- Admin authorization

## Milestone 4 — CMS Content

Deliver:

- Content CRUD
- Tiptap
- Draft/Publish
- Preview

## Milestone 5 — CMS Course

Deliver:

- Course CRUD
- Lesson CRUD
- Ordering
- Content assignment

## Milestone 6 — CMS Quiz

Deliver:

- Question Bank
- Quiz Builder
- Lesson Quiz
- Final Quiz
- Validation

## Milestone 7 — Public Experience

Deliver:

- Homepage
- Articles
- Course catalog
- Course detail

## Milestone 8 — Learning Engine

Deliver:

- Enrollment
- Lesson access
- Progress
- Lesson completion

## Milestone 9 — Quiz Engine

Deliver:

- Quiz player
- Server scoring
- Attempts
- Retry
- Unlocking

## Milestone 10 — Completion

Deliver:

- Final Quiz
- Course completion

## Milestone 11 — Polish

Deliver:

- Responsive refinement
- Accessibility
- SEO
- Error states
- Loading states
- Performance

---

# 52. Acceptance Strategy

Every milestone must have acceptance criteria.

Do not mark a milestone complete merely because the UI exists.

Example:

```text
Lesson Unlocking

❌ Button exists
❌ Locked icon exists

✅ Server rejects unauthorized Lesson access
✅ Previous Lesson completion is checked
✅ Correct Lesson becomes accessible after passing
✅ Failed Quiz keeps Lesson incomplete
```

---

# 53. Database Safety

Before any migration that modifies existing data:

```text
1. Inspect migration
2. Identify destructive operations
3. Confirm data impact
4. Back up if required
5. Apply
6. Verify
```

Never use destructive reset commands against production.

---

# 54. Deployment Strategy

Recommended:

```text
Git repository
     ↓
Vercel
     ↓
Next.js application

Supabase
├── PostgreSQL
├── Auth
└── Storage
```

Use separate development and production environments when practical.

---

# 55. Production Checklist

Before production:

```text
Environment variables
Auth redirect URLs
Database migrations
RLS policies
Storage policies
Admin authorization
Error handling
SEO
Sitemap
Robots
Performance
Responsive UI
Accessibility
Backup strategy
```

---

# 56. V1 Technical Definition of Done

The application is technically ready for V1 when:

- Public website works.
- Authentication works.
- Admin CMS works.
- Content can be created and published.
- Courses can be created and published.
- Lessons can be ordered.
- Lesson Quizzes require exactly 10 Questions.
- Final Quiz requires 10–30 Questions.
- Passing score is 80%.
- Question reuse works.
- Content reuse restriction works.
- Lesson locking is enforced server-side.
- Quiz scoring is server-side.
- Course completion is server-side.
- Draft content is not public.
- Published Lesson deletion is blocked.
- Critical flows have automated tests.
- Production environment is configured safely.

---

# 57. Final Implementation Principle

Do not ask GLM-5:

```text
"Build BINZI."
```

Instead:

```text
Specification
    ↓
Milestone
    ↓
Small Task
    ↓
Implementation
    ↓
Validation
    ↓
Review
    ↓
Next Task
```

This keeps the AI inside a controlled architecture and makes the codebase easier to maintain.

BINZI should be built incrementally, with the specifications acting as the contract between product decisions and implementation.
