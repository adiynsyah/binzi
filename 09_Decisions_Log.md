# BINZI V1 — Decisions Log

## Status

Approved by project owner.

These decisions resolve the implementation ambiguities identified during the initial review of the BINZI V1 specifications.

They are now part of the V1 product contract and should be treated as authoritative by implementation agents.

---

# 1. Guest Preview Scope

Guests may browse Courses, view full Course Detail, see Lesson titles/curriculum, and preview a limited portion of Lesson content.

Guests may NOT read the full Lesson, access Lesson Quiz, track Course progress, or access the full Learning Experience without authentication/access.

The exact visual amount of preview can be refined during UI implementation.

---

# 2. Course Unpublish and Existing Enrollments

When a published Course is unpublished:

- New users cannot enroll.
- Existing enrolled users retain access.
- Existing users can continue their learning progress.
- Existing progress is not reset.

---

# 3. Individual Lesson Unpublish

A Lesson cannot be independently unpublished while its Course is published.

If structural changes are required:

```text
Unpublish Course
    ↓
Modify Lessons
    ↓
Validate Course
    ↓
Publish Course
```

Invariant:

```text
Published Course
→ all Lessons are Published and valid
```

---

# 4. Published Content Deletion

Published Content cannot be hard-deleted in V1.

Draft Content may be deleted according to normal reference constraints.

Published Content remains available as historical educational content.

---

# 5. Content Slug Uniqueness

`contents.slug` must be UNIQUE for non-null values.

Published Articles use:

```text
/articles/[slug]
```

and therefore require deterministic slug resolution.

---

# 6. User Email Uniqueness

`users.email` must be UNIQUE.

Supabase Auth remains the authoritative authentication identity.

---

# 7. UUID Strategy

Use standard UUID generation for V1.

Do not introduce UUID v7-specific infrastructure unless a concrete requirement appears.

---

# 8. Database Access and RLS

Architecture:

```text
Browser
    ↓
Supabase Auth
    ↓
Next.js Server
    ↓
Service Layer
    ↓
Drizzle
    ↓
PostgreSQL
```

Responsibilities:

```text
Service Layer
→ Business authorization

PostgreSQL
→ Data integrity
→ Constraints
→ Foreign keys

RLS
→ Defense-in-depth
→ Direct Supabase/API data access protection where applicable
```

Drizzle remains server-side. Privileged credentials are never exposed to the browser.

---

# 9. Admin Navigation

CMS navigation:

```text
Dashboard
Courses
Content
Questions
Media
```

---

# 10. Quiz Score Storage

The source of truth for quiz results is:

```text
correct_answers
total_questions
```

Percentage is derived:

```text
correct_answers / total_questions × 100
```

Passing is determined from authoritative correct/total values, not from a client-supplied score.

For display, percentage may be rounded.

Example:

```text
9 / 11
= 81.818...
→ display 82%
```

Lesson Quiz:

```text
8 / 10 = 80% → PASS
```

Final Quiz:

```text
24 / 30 = 80% → PASS
```

---

# 11. Published Course Structural Changes

Once a Course is published, its Lesson structure is immutable in V1.

Admin cannot add or delete a Lesson while the Course remains published.

If major structural changes are required, the Course should first be unpublished and then modified according to the publication workflow.

Existing user completion must not be silently invalidated by structural changes.

V1 does not implement Course versioning.

---

# 12. Lesson Progress Creation

`lesson_progress` records are created lazily.

Enrollment creation does NOT require creating progress rows for every Lesson.

Flow:

```text
Enrollment
    ↓
User opens Lesson
    ↓
Create lesson_progress
status = IN_PROGRESS
    ↓
User passes Lesson Quiz
    ↓
status = COMPLETED
```

---

# 13. Updated V1 Invariants

### Course

```text
Course
├── many Lessons
└── one Final Quiz
```

### Lesson

```text
Lesson
├── many ordered Contents
└── one Lesson Quiz
```

### Content

```text
Content
├── one Content Type
└── at most one Lesson assignment
```

### Lesson Quiz

```text
exactly 10 Questions
passing = 80%
```

### Final Quiz

```text
10–30 Questions
passing = 80%
```

### Lesson Unlocking

```text
Previous Lesson completed
→ next Lesson unlocked
```

### Final Quiz

```text
All Lessons completed
→ Final Quiz unlocked
```

### Course Completion

```text
All Lessons completed
+
Final Quiz passed
→ Course completed
```

---

# 14. V1 Structural Philosophy

Published educational structure should be predictable.

V1 intentionally avoids:

- Course versioning
- Content versioning
- Lesson versioning
- Scheduled publishing
- Complex editorial workflows

The objective is a stable and maintainable first production version.

---

# 15. Priority When Rules Conflict

Use this priority:

```text
1. Security
2. Database Integrity
3. Approved Business Rules
4. Product Requirements
5. UX Requirements
6. Implementation Convenience
```

Implementation convenience must never override product/business rules.

---

# 16. AI Implementation Rule

GLM-5 and other implementation agents must treat this document as an approved decision record.

They must not reopen these decisions unless:

- A newly discovered technical constraint makes the decision infeasible, or
- The project owner explicitly requests reconsideration.

Any such issue must be reported before changing implementation.
