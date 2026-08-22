# BINZI V1 — Drizzle Schema Specification

## Status

Drafted from the approved BINZI V1 database specification.

This document defines how the PostgreSQL database should be represented in Drizzle ORM. It is an implementation specification for the coding phase; business rules remain explicitly documented rather than being hidden inside ORM definitions.

---

## 1. Stack

- PostgreSQL via Supabase
- Drizzle ORM
- TypeScript
- Zod for application/input validation
- Supabase Auth for authentication
- Supabase Storage for media

---

## 2. Schema Organization

Recommended structure:

```text
src/
└── db/
    ├── index.ts
    ├── schema/
    │   ├── users.ts
    │   ├── courses.ts
    │   ├── contents.ts
    │   ├── quizzes.ts
    │   ├── questions.ts
    │   ├── learning.ts
    │   └── media.ts
    └── migrations/
```

Domain separation is preferred over one large schema file.

---

## 3. PostgreSQL Enums

### user_role

```text
USER
ADMIN
```

### course_difficulty

```text
BEGINNER
INTERMEDIATE
ADVANCED
```

### publication_status

```text
DRAFT
PUBLISHED
```

This enum can be reused by Course, Lesson, and Content.

### content_type

```text
ARTICLE
VIDEO
INFOGRAPHIC
TEXT
TIP
```

### quiz_type

```text
LESSON
FINAL
```

### enrollment_status

```text
ACTIVE
COMPLETED
```

### lesson_progress_status

```text
NOT_STARTED
IN_PROGRESS
COMPLETED
```

---

## 4. UUID Strategy

Use UUID primary keys.

For new application-created records, use UUID v7 where the selected PostgreSQL/Drizzle setup supports it cleanly.

If the exact UUID v7 generation strategy is delegated to PostgreSQL, keep the generation implementation centralized rather than mixing multiple UUID generation approaches across tables.

Supabase Auth user IDs are the exception: `public.users.id` must equal `auth.users.id`.

---

## 5. Users

```text
users
├── id UUID PK
├── email TEXT NOT NULL
├── display_name TEXT NOT NULL
├── avatar_url TEXT NULL
├── role user_role NOT NULL DEFAULT USER
├── created_at TIMESTAMPTZ NOT NULL
└── updated_at TIMESTAMPTZ NOT NULL
```

### Relationship

```text
auth.users.id
      │
      │ 1:1
      ▼
public.users.id
```

Do not create a separate application authentication identity.

---

## 6. Courses

```text
courses
├── id UUID PK
├── title TEXT NOT NULL
├── slug TEXT UNIQUE NOT NULL
├── description TEXT NOT NULL
├── thumbnail_url TEXT NULL
├── difficulty course_difficulty NOT NULL
├── estimated_duration INTEGER NULL
├── status publication_status NOT NULL DEFAULT DRAFT
├── created_at TIMESTAMPTZ NOT NULL
├── updated_at TIMESTAMPTZ NOT NULL
└── published_at TIMESTAMPTZ NULL
```

### Constraints

- `slug` UNIQUE
- `estimated_duration >= 0` when not null
- `published_at` should be populated when status is PUBLISHED

The status/published_at consistency should be validated by the application and can also be protected with a database CHECK if desired.

---

## 7. Lessons

```text
lessons
├── id UUID PK
├── course_id UUID NOT NULL FK → courses.id
├── title TEXT NOT NULL
├── slug TEXT NOT NULL
├── description TEXT NULL
├── sort_order INTEGER NOT NULL
├── status publication_status NOT NULL DEFAULT DRAFT
├── created_at TIMESTAMPTZ NOT NULL
├── updated_at TIMESTAMPTZ NOT NULL
└── published_at TIMESTAMPTZ NULL
```

### Constraints

```text
UNIQUE(course_id, slug)
UNIQUE(course_id, sort_order)
CHECK(sort_order > 0)
```

### Delete behavior

Do not use `CASCADE` from Course → Lesson for destructive admin operations.

Recommended FK behavior is `RESTRICT`/`NO ACTION`.

The application must reject deletion of a published Lesson.

---

## 8. Contents

```text
contents
├── id UUID PK
├── type content_type NOT NULL
├── title TEXT NOT NULL
├── slug TEXT NULL
├── body JSONB NOT NULL
├── metadata JSONB NULL
├── status publication_status NOT NULL DEFAULT DRAFT
├── created_by UUID NOT NULL FK → users.id
├── updated_by UUID NOT NULL FK → users.id
├── created_at TIMESTAMPTZ NOT NULL
├── updated_at TIMESTAMPTZ NOT NULL
└── published_at TIMESTAMPTZ NULL
```

### Tiptap

`body` stores the Tiptap JSON document.

`metadata` is reserved for type-specific metadata.

Example:

```json
{
  "provider": "youtube",
  "videoId": "abc123"
}
```

for a VIDEO content item.

Do not create separate tables for Article, Video, Infographic, Text, and Tip in V1.

---

## 9. Lesson Contents

```text
lesson_contents
├── id UUID PK
├── lesson_id UUID NOT NULL FK → lessons.id
├── content_id UUID NOT NULL FK → contents.id
├── sort_order INTEGER NOT NULL
└── created_at TIMESTAMPTZ NOT NULL
```

### Constraints

```text
UNIQUE(content_id)
UNIQUE(lesson_id, sort_order)
CHECK(sort_order > 0)
```

The UNIQUE(content_id) constraint is intentional.

A Content can belong to only one Lesson.

The CMS should prevent duplicate selection in its UI, while the database constraint remains the final safety net.

---

## 10. Quizzes

```text
quizzes
├── id UUID PK
├── title TEXT NOT NULL
├── type quiz_type NOT NULL
├── lesson_id UUID NULL FK → lessons.id
├── course_id UUID NULL FK → courses.id
├── created_at TIMESTAMPTZ NOT NULL
└── updated_at TIMESTAMPTZ NOT NULL
```

### Relationship rules

For `type = LESSON`:

```text
lesson_id MUST NOT BE NULL
course_id MUST BE NULL
```

For `type = FINAL`:

```text
course_id MUST NOT BE NULL
lesson_id MUST BE NULL
```

These rules should be represented by a PostgreSQL CHECK constraint so invalid combinations cannot be inserted.

### One quiz per Lesson

The database should enforce:

```text
UNIQUE(lesson_id)
```

for non-null Lesson quiz relationships.

Because PostgreSQL UNIQUE allows multiple NULLs, this naturally allows multiple Final quizzes at the database level, so a separate Course-level uniqueness rule is required.

Recommended:

```text
UNIQUE(course_id)
```

for non-null Course quiz relationships.

This means:

- one Lesson → one Lesson Quiz
- one Course → one Final Quiz

---

## 11. Questions

```text
questions
├── id UUID PK
├── question_text TEXT NOT NULL
├── explanation TEXT NULL
├── created_at TIMESTAMPTZ NOT NULL
└── updated_at TIMESTAMPTZ NOT NULL
```

Questions are reusable.

A Question can be attached to multiple Quizzes.

---

## 12. Question Options

```text
question_options
├── id UUID PK
├── question_id UUID NOT NULL FK → questions.id
├── option_text TEXT NOT NULL
├── sort_order INTEGER NOT NULL
└── is_correct BOOLEAN NOT NULL DEFAULT FALSE
```

### Constraints

```text
UNIQUE(question_id, sort_order)
CHECK(sort_order > 0)
```

Each published Question must have exactly one correct Option.

That rule is primarily application/service-layer validation because a simple row-level CHECK cannot count related rows.

---

## 13. Quiz Questions

```text
quiz_questions
├── id UUID PK
├── quiz_id UUID NOT NULL FK → quizzes.id
├── question_id UUID NOT NULL FK → questions.id
└── sort_order INTEGER NOT NULL
```

### Constraints

```text
UNIQUE(quiz_id, question_id)
UNIQUE(quiz_id, sort_order)
CHECK(sort_order > 0)
```

Question reuse is allowed across Quizzes.

Duplicate use within the same Quiz is not allowed.

---

## 14. Enrollments

```text
enrollments
├── id UUID PK
├── user_id UUID NOT NULL FK → users.id
├── course_id UUID NOT NULL FK → courses.id
├── status enrollment_status NOT NULL DEFAULT ACTIVE
├── enrolled_at TIMESTAMPTZ NOT NULL
└── completed_at TIMESTAMPTZ NULL
```

### Constraints

```text
UNIQUE(user_id, course_id)
```

Recommended status rule:

```text
ACTIVE     → completed_at IS NULL
COMPLETED  → completed_at IS NOT NULL
```

---

## 15. Lesson Progress

```text
lesson_progress
├── id UUID PK
├── enrollment_id UUID NOT NULL FK → enrollments.id
├── lesson_id UUID NOT NULL FK → lessons.id
├── status lesson_progress_status NOT NULL DEFAULT NOT_STARTED
├── started_at TIMESTAMPTZ NULL
└── completed_at TIMESTAMPTZ NULL
```

### Constraints

```text
UNIQUE(enrollment_id, lesson_id)
```

A Lesson is completed only after its Lesson Quiz is passed.

---

## 16. Quiz Attempts

```text
quiz_attempts
├── id UUID PK
├── user_id UUID NOT NULL FK → users.id
├── quiz_id UUID NOT NULL FK → quizzes.id
├── score INTEGER NOT NULL
├── passed BOOLEAN NOT NULL
├── started_at TIMESTAMPTZ NOT NULL
└── completed_at TIMESTAMPTZ NULL
```

### Constraints

```text
CHECK(score >= 0 AND score <= 100)
```

There is no attempt limit in V1.

Passing score is determined by the global rule:

```text
QUIZ_PASSING_SCORE = 80
```

The application calculates and stores the resulting `score` and `passed` state.

---

## 17. Quiz Answers

```text
quiz_answers
├── id UUID PK
├── attempt_id UUID NOT NULL FK → quiz_attempts.id
├── question_id UUID NOT NULL FK → questions.id
├── selected_option_id UUID NOT NULL FK → question_options.id
└── is_correct BOOLEAN NOT NULL
```

Recommended constraint:

```text
UNIQUE(attempt_id, question_id)
```

This prevents a single attempt from storing multiple answers for the same question.

The service layer must also verify that:

- question belongs to the quiz being attempted
- selected option belongs to the question

---

## 18. Media

```text
media
├── id UUID PK
├── storage_path TEXT NOT NULL
├── file_name TEXT NOT NULL
├── mime_type TEXT NOT NULL
├── file_size BIGINT NOT NULL
├── width INTEGER NULL
├── height INTEGER NULL
├── created_by UUID NOT NULL FK → users.id
└── created_at TIMESTAMPTZ NOT NULL
```

### Constraints

```text
CHECK(file_size >= 0)
CHECK(width > 0 OR width IS NULL)
CHECK(height > 0 OR height IS NULL)
```

Actual files are stored in Supabase Storage.

---

## 19. FK Delete Strategy

Avoid broad cascade deletes because educational records may be referenced by learning history.

Recommended approach:

### Courses → Lessons

`RESTRICT`

### Lessons → Lesson Contents

`RESTRICT` or explicit application-controlled deletion

### Contents → Lesson Contents

`RESTRICT`

### Lessons → Quiz

`RESTRICT`

### Quizzes → Quiz Attempts

`RESTRICT`

### Questions → Quiz Questions

`RESTRICT`

### Questions → Question Options

`RESTRICT`

### Enrollments → Lesson Progress

Application-controlled deletion; avoid accidental cascading deletion of learning history.

The general principle is:

**Do not allow deleting an entity to silently destroy educational history.**

---

## 20. Important Indexes

Recommended indexes:

```text
courses.slug

lessons.course_id
lessons.course_id + sort_order

contents.status
contents.type

lesson_contents.lesson_id
lesson_contents.content_id

quizzes.lesson_id
quizzes.course_id

quiz_questions.quiz_id
quiz_questions.question_id

question_options.question_id

enrollments.user_id
enrollments.course_id

lesson_progress.enrollment_id
lesson_progress.lesson_id

quiz_attempts.user_id
quiz_attempts.quiz_id

quiz_answers.attempt_id
quiz_answers.question_id

media.created_by
```

Unique constraints may automatically create indexes; do not create duplicate indexes unnecessarily.

---

## 21. Business Rules Not Fully Enforced by Drizzle

Drizzle defines the database structure. It should not be treated as the entire business-rule engine.

These rules belong in application/service logic:

### Lesson Quiz

Exactly 10 questions.

### Final Quiz

10–30 questions.

### Passing Score

80%.

### Question correctness

Exactly one correct option for a published Question.

### Lesson unlocking

Lesson N+1 is unavailable until Lesson N is completed.

### Final Quiz unlocking

Final Quiz is unavailable until all Lessons are completed.

### Course completion

All Lessons completed + Final Quiz passed.

### Published Lesson deletion

Rejected.

### Course publishing

Rejected when required structure is invalid.

---

## 22. Recommended Service Boundaries

Business logic should eventually be separated into services such as:

```text
course.service.ts
lesson.service.ts
content.service.ts
quiz.service.ts
question.service.ts
enrollment.service.ts
progress.service.ts
```

Examples:

```text
quiz.service.ts
├── validateQuizForPublish()
├── calculateScore()
├── submitAttempt()
└── canStartQuiz()

progress.service.ts
├── canAccessLesson()
├── completeLesson()
├── canAccessFinalQuiz()
└── completeCourse()
```

This keeps business rules out of React components and route handlers.

---

## 23. Drizzle Relations

Relations should be explicitly defined for developer ergonomics.

Examples:

```text
course
 ├── lessons
 ├── enrollments
 └── finalQuiz

lesson
 ├── course
 ├── contents
 ├── lessonQuiz
 └── progress

content
 ├── lesson
 ├── createdBy
 └── updatedBy

quiz
 ├── lesson
 ├── course
 ├── questions
 └── attempts

question
 ├── options
 └── quizzes
```

Relations are application-level Drizzle relations and do not replace PostgreSQL foreign keys.

---

## 24. Querying Principle

Use Drizzle relations for convenient reads, but avoid always loading deeply nested graphs.

Examples:

A Course page should not automatically load:

```text
Course
→ Lessons
→ Content
→ Quiz
→ Questions
→ Options
→ Attempts
→ Answers
```

Fetch only the data required by the page/use case.

This is especially important for public pages and CMS dashboards.

---

## 25. RLS Direction

Because Supabase is used, Row Level Security should be enabled for public-facing database access where appropriate.

However, the application should not rely on RLS alone for business rules.

Use:

- RLS for data-access boundaries.
- Server-side authorization for admin actions.
- Service-layer validation for business rules.

Admin operations should never trust a client-provided role.

---

## 26. V1 Constants

Keep educational rules centralized:

```text
QUIZ_PASSING_SCORE = 80

LESSON_QUIZ_QUESTION_COUNT = 10

FINAL_QUIZ_MIN_QUESTIONS = 10

FINAL_QUIZ_MAX_QUESTIONS = 30
```

Do not scatter these values throughout UI components, API routes, and services.

---

## 27. Final Drizzle Design Principle

The Drizzle schema should describe:

**What data is valid structurally.**

The service layer should describe:

**What the platform is allowed to do.**

The UI should describe:

**What the user/admin is allowed to interact with.**

Do not move all three responsibilities into one layer.
