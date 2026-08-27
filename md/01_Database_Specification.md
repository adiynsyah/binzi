# BINZI V1 — Database Specification

## 1. Product Scope

BINZI V1 is a responsive nutrition education platform for the general public.

Core learning structure:

**Course → Lesson → Content → Quiz**

A Course contains multiple Lessons. Each Lesson contains one or more Content items and exactly one Lesson Quiz. After all Lessons are completed, the user can take the Final Quiz.

Articles are a Content Type and can exist as standalone published articles or as course material.

## 2. Technology Decisions

- Framework: Next.js
- Language: TypeScript
- Styling: SCSS Modules
- Database: PostgreSQL
- Backend: Next.js
- Authentication: Supabase Auth
- Storage: Supabase Storage
- ORM: Drizzle ORM
- Validation: Zod
- Rich Text Editor: Tiptap
- Rich content format: Tiptap JSON stored as PostgreSQL JSONB
- Deployment target: Vercel
- Primary Key: UUID v7

## 3. Core Tables

1. users
2. courses
3. lessons
4. contents
5. lesson_contents
6. quizzes
7. questions
8. question_options
9. quiz_questions
10. enrollments
11. lesson_progress
12. quiz_attempts
13. quiz_answers
14. media

No separate Article table is required. Article is a Content Type.

## 4. Users

### users

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| email | TEXT | NOT NULL |
| display_name | TEXT | NOT NULL |
| avatar_url | TEXT | NULL |
| role | ENUM | USER / ADMIN |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

Authentication is handled by Supabase Auth. Passwords/password hashes are not stored in the application users table.

## 5. Courses

### courses

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| title | TEXT | NOT NULL |
| slug | TEXT | UNIQUE, NOT NULL |
| description | TEXT | NOT NULL |
| thumbnail_url | TEXT | NULL |
| difficulty | ENUM | BEGINNER / INTERMEDIATE / ADVANCED |
| estimated_duration | INTEGER | NULL, minutes |
| status | ENUM | DRAFT / PUBLISHED |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |
| published_at | TIMESTAMPTZ | NULL |

Course hard deletion should not be exposed once learning activity exists.

## 6. Lessons

### lessons

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| course_id | UUID | FK → courses.id |
| title | TEXT | NOT NULL |
| slug | TEXT | NOT NULL |
| description | TEXT | NULL |
| sort_order | INTEGER | NOT NULL |
| status | ENUM | DRAFT / PUBLISHED |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |
| published_at | TIMESTAMPTZ | NULL |

Constraints:

- UNIQUE(course_id, slug)
- UNIQUE(course_id, sort_order)

### Lesson deletion rule

- DRAFT Lesson: can be deleted.
- PUBLISHED Lesson: cannot be deleted.
- Published Lessons should not be moved to another Course.
- Deletion must be validated server-side, not only hidden in the UI.

## 7. Contents

### contents

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| type | ENUM | ARTICLE / VIDEO / INFOGRAPHIC / TEXT / TIP |
| title | TEXT | NOT NULL |
| slug | TEXT | NULL |
| body | JSONB | NOT NULL |
| status | ENUM | DRAFT / PUBLISHED |
| created_by | UUID | FK → users.id |
| updated_by | UUID | FK → users.id |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |
| published_at | TIMESTAMPTZ | NULL |

`body` stores Tiptap JSON.

Article is represented by `type = ARTICLE`.

A Content can be published as a standalone article and can also be used as course material.

## 8. Lesson Contents

### lesson_contents

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| lesson_id | UUID | FK → lessons.id |
| content_id | UUID | FK → contents.id, UNIQUE |
| sort_order | INTEGER | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

Constraints:

- UNIQUE(content_id)
- UNIQUE(lesson_id, sort_order)

The UNIQUE(content_id) rule guarantees that one Content cannot belong to multiple Lessons.

The CMS should also hide already-used Content from the Content picker. The database constraint acts as a safety net.

## 9. Quizzes

### quizzes

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| title | TEXT | NOT NULL |
| type | ENUM | LESSON / FINAL |
| lesson_id | UUID | NULL, FK → lessons.id |
| course_id | UUID | NULL, FK → courses.id |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

Rules:

- LESSON Quiz must reference a Lesson.
- FINAL Quiz must reference a Course.
- A Lesson has exactly one Lesson Quiz.
- A Course has one Final Quiz.
- These type/reference rules should be enforced through database checks where practical and application validation.

## 10. Quiz Rules — FINAL

### Lesson Quiz

- Exactly 10 questions.
- Passing score: 80%.
- Minimum correct answers: 8/10.

### Final Quiz

- Minimum 10 questions.
- Maximum 30 questions.
- Passing score: 80%.

Passing score is a global V1 business rule:

`QUIZ_PASSING_SCORE = 80`

It is not stored per quiz because admins should not configure different passing scores in V1.

For scoring:

`required_correct = ceil(total_questions × 0.80)`

## 11. Questions

### questions

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| question_text | TEXT | NOT NULL |
| explanation | TEXT | NULL |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

Questions can be reused across multiple quizzes.

The explanation is shown as educational feedback after answering.

## 12. Question Options

### question_options

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| question_id | UUID | FK → questions.id |
| option_text | TEXT | NOT NULL |
| sort_order | INTEGER | NOT NULL |
| is_correct | BOOLEAN | NOT NULL |

Quiz type is multiple choice with a single correct answer.

Each published question must have exactly one correct option.

## 13. Quiz Questions

### quiz_questions

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| quiz_id | UUID | FK → quizzes.id |
| question_id | UUID | FK → questions.id |
| sort_order | INTEGER | NOT NULL |

Constraints:

- UNIQUE(quiz_id, question_id)
- UNIQUE(quiz_id, sort_order)

A Question can be reused across different Quizzes.

## 14. Enrollments

### enrollments

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| course_id | UUID | FK → courses.id |
| status | ENUM | ACTIVE / COMPLETED |
| enrolled_at | TIMESTAMPTZ | NOT NULL |
| completed_at | TIMESTAMPTZ | NULL |

Constraint:

- UNIQUE(user_id, course_id)

Enrollment can be created automatically when an authenticated user starts a Course.

## 15. Lesson Progress

### lesson_progress

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| enrollment_id | UUID | FK → enrollments.id |
| lesson_id | UUID | FK → lessons.id |
| status | ENUM | NOT_STARTED / IN_PROGRESS / COMPLETED |
| started_at | TIMESTAMPTZ | NULL |
| completed_at | TIMESTAMPTZ | NULL |

Constraint:

- UNIQUE(enrollment_id, lesson_id)

A Lesson is completed only after its Lesson Quiz is passed.

## 16. Quiz Attempts

### quiz_attempts

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| quiz_id | UUID | FK → quizzes.id |
| score | INTEGER | 0–100 |
| passed | BOOLEAN | NOT NULL |
| started_at | TIMESTAMPTZ | NOT NULL |
| completed_at | TIMESTAMPTZ | NULL |

Quiz attempts are unlimited in V1.

Once the user passes, the Lesson remains completed even if a later retry scores lower.

## 17. Quiz Answers

### quiz_answers

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| attempt_id | UUID | FK → quiz_attempts.id |
| question_id | UUID | FK → questions.id |
| selected_option_id | UUID | FK → question_options.id |
| is_correct | BOOLEAN | NOT NULL |

Stores the answer selected during each attempt.

## 18. Media

### media

| Column | Type | Rules |
|---|---|---|
| id | UUID | PK |
| storage_path | TEXT | NOT NULL |
| file_name | TEXT | NOT NULL |
| mime_type | TEXT | NOT NULL |
| file_size | BIGINT | NOT NULL |
| width | INTEGER | NULL |
| height | INTEGER | NULL |
| created_by | UUID | FK → users.id |
| created_at | TIMESTAMPTZ | NOT NULL |

Actual files are stored in Supabase Storage. PostgreSQL stores metadata.

## 19. Learning Flow

### Course enrollment

Guest:
- Can browse Course details.
- Can see limited Course/Lesson preview.
- Must login to access full learning experience.

Authenticated user:
- Starts Course.
- Enrollment is created if none exists.
- Course progress is tracked.

### Lesson flow

`Lesson → Content → Quiz → Pass 80% → Lesson Completed → Next Lesson Unlocked`

A user cannot access Lesson N+1 until Lesson N has been completed.

### Final Quiz flow

`All Lessons Completed → Final Quiz Unlocked → 80%+ → Course Completed`

Course completion sets:

- enrollment.status = COMPLETED
- enrollment.completed_at = current timestamp

## 20. Course Updates

BINZI V1 does not implement Course versioning.

Users always access the current/latest state of the Course.

Existing progress is not automatically reset when the Course is updated.

Published Lessons should remain stable and cannot be deleted.

## 21. Draft and Publish

Draft content is invisible to public users.

Published content is visible to public users according to its access rules.

Admin can:

- Save Draft
- Edit Draft
- Publish
- Unpublish

Before publishing a Course, server-side validation must ensure the Course is structurally valid.

Example validation:

- Course has required metadata.
- Course has Lessons.
- Published Lessons have valid Content.
- Each Lesson has exactly one Lesson Quiz.
- Each Lesson Quiz has exactly 10 Questions.
- Final Quiz exists.
- Final Quiz has 10–30 Questions.
- Required referenced content is published.

Draft data is allowed to be incomplete.

## 22. Database Integrity

Database should enforce structural integrity through:

- Primary keys
- Foreign keys
- NOT NULL
- UNIQUE constraints
- CHECK constraints where practical
- Appropriate indexes

Application/service layer enforces business rules such as:

- Published Lesson cannot be deleted.
- Lesson Quiz must contain exactly 10 Questions.
- Final Quiz must contain 10–30 Questions.
- Passing score is 80%.
- Next Lesson remains locked until previous Quiz is passed.
- Final Quiz remains locked until all Lessons are completed.
- Course cannot be published while invalid.

## 23. Important Unique Constraints

At minimum:

- courses.slug
- UNIQUE(course_id, slug)
- UNIQUE(course_id, sort_order)
- UNIQUE(content_id) on lesson_contents
- UNIQUE(lesson_id, sort_order)
- UNIQUE(quiz_id, question_id)
- UNIQUE(quiz_id, sort_order)
- UNIQUE(user_id, course_id)
- UNIQUE(enrollment_id, lesson_id)

## 24. V1 Explicitly Does NOT Include

- XP
- Levels
- Badges
- Daily Missions
- Streaks
- Leaderboards
- AI Nutrition Assistant
- Course certificates
- Course versioning
- Advanced analytics
- Social/community features
- Payment/subscription system

These are intentionally deferred.

## 25. Architecture Principle

BINZI V1 should remain simple enough for a solo developer supported by AI coding tools.

Priorities:

1. Clear domain boundaries
2. Strong database integrity
3. Explicit business rules
4. Simple CMS workflows
5. Reusable Question Bank
6. Tiptap-based rich content
7. Server-side validation
8. Minimal premature abstraction

The architecture should allow future features such as an AI Nutrition Assistant and gamification without rewriting the core learning model.
