# BINZI V1 — Business Rules Specification

## Status

This document is the authoritative business-rule reference for BINZI V1.

It defines application behavior independently from UI implementation and database implementation.

If a UI decision, database design, or AI-generated implementation conflicts with this document, the business rule must win unless the specification is explicitly revised.

---

# 1. Core Learning Model

BINZI V1 uses:

```text
Course
  ↓
Lesson
  ↓
Content
  ↓
Lesson Quiz
```

After all Lessons are completed:

```text
Course
  ↓
Final Quiz
```

There is no Module entity in V1.

---

# 2. Course Rules

## 2.1 Course Structure

A Course:

- Must contain at least one Lesson before publication.
- Contains multiple Lessons.
- Has exactly one Final Quiz.
- Lessons have an explicit order.
- Course progress is tracked per enrolled user.

## 2.2 Course Status

A Course can be:

```text
DRAFT
PUBLISHED
```

Draft:

- Not publicly available as a normal published Course.
- Can be incomplete.
- Can be edited.

Published:

- Publicly discoverable.
- Must satisfy all publication validation rules.

## 2.3 Course Publication

A Course may be published only when:

- Required Course metadata is valid.
- At least one Lesson exists.
- Every Lesson intended for the published Course is Published.
- Every published Lesson is structurally valid.
- Every Lesson has exactly one Lesson Quiz.
- Every Lesson Quiz has exactly 10 Questions.
- Every Question used by a published Quiz has valid options.
- Every published Question has exactly one correct option.
- A Final Quiz exists.
- Final Quiz contains 10–30 Questions.

---

# 3. Lesson Rules

## 3.1 Lesson Ownership

Every Lesson belongs to exactly one Course.

A Lesson cannot be shared between Courses.

## 3.2 Lesson Ordering

Lessons have explicit `sort_order`.

Example:

```text
Lesson 1 → sort_order 1
Lesson 2 → sort_order 2
Lesson 3 → sort_order 3
```

Ordering may be changed by an Admin.

## 3.3 Lesson Content

A Lesson may contain multiple Content items.

Content can have different types:

```text
ARTICLE
VIDEO
INFOGRAPHIC
TEXT
TIP
```

Example:

```text
Lesson
├── Article
├── Video
├── Tip
└── Infographic
```

Content ordering is significant.

## 3.4 Lesson Deletion

Draft Lesson:

- May be deleted.

Published Lesson:

- May not be deleted.

This rule must be enforced server-side.

The UI should also disable/hide destructive actions where appropriate.

---

# 4. Content Rules

## 4.1 Content Types

V1 supports:

```text
ARTICLE
VIDEO
INFOGRAPHIC
TEXT
TIP
```

Article is not a separate database entity.

Article is a Content Type.

## 4.2 Article Behavior

An Article Content item can be:

- Published as a standalone public article.
- Used as material inside a Course Lesson.

The same Content item must not be assigned to more than one Lesson.

## 4.3 Content Reuse

Content:

```text
Maximum Lesson usage = 1
```

Question:

```text
Multiple Quiz usage allowed
```

These are intentionally different rules.

## 4.4 Content Ordering

Content within a Lesson has explicit ordering.

Example:

```text
1. Article
2. Video
3. Tip
4. Infographic
```

Ordering must be persisted.

## 4.5 Content Status

Content can be:

```text
DRAFT
PUBLISHED
```

Draft Content:

- Cannot be publicly viewed.
- Can be incomplete.
- Can be edited.

Published Content:

- Can be publicly viewed according to access rules.

---

# 5. Guest Access Rules

Users do not need to log in to discover BINZI.

Guests may:

- Browse published Articles.
- Browse Course information.
- View permitted Course/Lesson previews.

Guests may not access the full protected learning experience.

Conceptually:

```text
Guest
  ↓
Public discovery
  ↓
Preview
  ↓
Login required
  ↓
Full Course access
```

The exact preview amount is a product/UI decision.

---

# 6. Authentication Rules

Authentication is handled by Supabase Auth.

Application user identity is linked to:

```text
auth.users.id
      =
public.users.id
```

Roles in V1:

```text
USER
ADMIN
```

---

# 7. Authorization Rules

## 7.1 Guest

Can access public published information.

## 7.2 Authenticated User

Can:

- Enroll in Courses.
- Access full Course learning content.
- Complete Lessons.
- Take Quizzes.
- View own progress.
- View own profile.

## 7.3 Admin

Can:

- Manage Courses.
- Manage Lessons.
- Manage Content.
- Manage Questions.
- Manage Quizzes.
- Manage Media.
- Publish/unpublish entities where permitted.

Authorization must be checked server-side.

---

# 8. Enrollment Rules

Enrollment connects:

```text
User
+
Course
```

A user can have at most one enrollment for a Course.

```text
UNIQUE(user_id, course_id)
```

Enrollment may be created when an authenticated user starts a Course.

There is no payment requirement in V1.

---

# 9. Lesson Unlocking Rules

Lesson order determines unlocking.

Example:

```text
Lesson 1
  ↓
Lesson 1 Quiz passed
  ↓
Lesson 2 unlocked
```

A user cannot access Lesson N+1 until Lesson N is completed.

For Lesson 1:

```text
No previous Lesson
→ accessible
```

For Lesson 2+:

```text
Previous Lesson completed?
    YES → accessible
    NO  → locked
```

This must be enforced server-side.

Frontend locking is only an experience layer.

---

# 10. Lesson Completion Rules

A Lesson is completed only when its Lesson Quiz is passed.

Reading Content alone does not complete a Lesson.

Therefore:

```text
Read Content
     ↓
Take Lesson Quiz
     ↓
Score >= 80%
     ↓
Lesson Completed
```

A user cannot manually mark a Lesson as completed.

---

# 11. Lesson Quiz Rules

Every Lesson has exactly one Lesson Quiz.

A Lesson Quiz:

- Has exactly 10 Questions.
- Uses multiple-choice questions.
- Has exactly one correct answer per Question.
- Has an 80% passing score.
- Allows unlimited attempts in V1.

Minimum score required:

```text
8 / 10
```

---

# 12. Lesson Quiz Attempt Rules

When a user submits a Lesson Quiz:

1. Server authenticates the user.
2. Server verifies access to the Lesson.
3. Server loads the authoritative Questions and Options.
4. Server validates submitted Question/Option relationships.
5. Server calculates the score.
6. Server stores the Quiz Attempt.
7. Server stores the selected Answers.
8. If score >= 80%, the Lesson is completed.

The browser must never be the authority for:

```text
score
passed
lesson completion
```

---

# 13. Quiz Retry Rules

Users may retry a Quiz without a V1 attempt limit.

If a user:

```text
Attempt 1 → 60%
Attempt 2 → 70%
Attempt 3 → 80%
```

The Lesson becomes completed at Attempt 3.

After a Lesson is completed, later failed attempts must not revert it to incomplete.

---

# 14. Question Rules

Questions are reusable.

A Question may appear in:

```text
Quiz A
Quiz B
Quiz C
```

A Question contains:

- Question text
- Options
- Optional explanation

Every published Question must have exactly one correct Option.

---

# 15. Question Option Rules

Quiz format:

```text
Multiple Choice
Single Answer
```

Only one option can be correct.

Example:

```text
A ○
B ○  ← correct
C ○
D ○
```

The CMS must prevent multiple correct answers.

The server must validate the rule before publication.

---

# 16. Final Quiz Rules

Every Course has exactly one Final Quiz.

Final Quiz:

- Minimum 10 Questions.
- Maximum 30 Questions.
- Multiple choice.
- Single correct answer per Question.
- Passing score = 80%.
- Unlimited attempts in V1.

Examples:

```text
9 Questions  → invalid
10 Questions → valid
20 Questions → valid
30 Questions → valid
31 Questions → invalid
```

---

# 17. Final Quiz Unlock Rules

Final Quiz is locked until all Lessons in the Course are completed.

Example:

```text
Lesson 1 ✓
Lesson 2 ✓
Lesson 3 ✓
Lesson 4 ✗

Final Quiz → LOCKED
```

Only:

```text
All Lessons ✓
```

unlocks the Final Quiz.

---

# 18. Course Completion Rules

A Course is completed when:

```text
All Lessons completed
+
Final Quiz passed
```

Final Quiz passing requires:

```text
Score >= 80%
```

When both conditions are satisfied:

```text
enrollment.status = COMPLETED
```

and:

```text
completed_at = current timestamp
```

---

# 19. Passing Score

V1 uses one global passing score:

```text
80%
```

This applies to:

- Lesson Quiz
- Final Quiz

The Admin cannot configure a different passing score per Quiz in V1.

Central constant:

```text
QUIZ_PASSING_SCORE = 80
```

---

# 20. Score Calculation

Score is calculated on the server.

Conceptually:

```text
correct answers
---------------- × 100
total questions
```

For Lesson Quiz:

```text
8 / 10 = 80%
```

For Final Quiz:

```text
8 / 10 = 80%
24 / 30 = 80%
```

Passing threshold is:

```text
score >= 80
```

---

# 21. Course Update Rules

BINZI V1 does not implement Course versioning.

Users always access the latest/current Course state.

When an Admin updates a Course:

- Existing users are not automatically reset.
- Existing progress remains.
- Users can return to the latest Course state.

Because versioning is not implemented, major structural Course changes should be treated carefully by Admins.

---

# 22. Draft and Publish Rules

Saving a Draft does not publish.

```text
Save Draft
    ≠
Publish
```

Publishing is always explicit.

Draft:

```text
Admin only
```

Published:

```text
Public according to access rules
```

---

# 23. Publish Validation Rules

Validation is different from saving.

An entity may be saved incomplete as Draft.

An entity may be Published only if its required structure is valid.

Example:

```text
Draft Quiz
8/10 questions
→ allowed

Publish Quiz
8/10 questions
→ rejected
```

---

# 24. Published Content Mutation

Published entities may be edited according to their type and current relationships.

However:

```text
Published Lesson
→ cannot be deleted
```

V1 does not implement full immutable content versioning.

---

# 25. Content Assignment Rule

When assigning Content to a Lesson:

```text
Content already assigned?
    YES → reject
    NO  → assign
```

The CMS should prevent selecting already-used Content.

The database also protects the rule through:

```text
UNIQUE(content_id)
```

---

# 26. Question Assignment Rule

When assigning a Question to a Quiz:

```text
Question already used in this Quiz?
    YES → reject
    NO  → assign
```

A Question used in another Quiz is still selectable.

---

# 27. Ordering Rules

Three important orderings exist:

```text
Course
  → Lessons

Lesson
  → Contents

Quiz
  → Questions
```

Each uses an explicit `sort_order`.

Ordering must be persisted server-side.

---

# 28. Deletion Rules

## Draft Lesson

Allowed.

## Published Lesson

Not allowed.

## Content

Deletion depends on references and publication state.

If Content is referenced by a Lesson, deletion should be blocked unless the relationship is safely removed first.

## Question

Because Questions may be reused, deletion should be blocked when referenced by Quiz Questions unless a safe removal workflow exists.

V1 should prefer non-destructive behavior over automatic cascade deletion.

---

# 29. Media Rules

Actual media files live in Supabase Storage.

Database stores metadata.

Media upload must validate:

- File type
- File size
- Relevant dimensions

Incomplete uploads must not create misleading media records.

---

# 30. Security Rules

Never trust client-provided:

```text
role
userId
score
passed
lessonCompleted
courseCompleted
```

The server determines authoritative values.

Server-side authorization is mandatory for Admin operations.

---

# 31. Business Rule vs Database Rule

Database should protect structural integrity.

Examples:

```text
UNIQUE(content_id)
UNIQUE(user_id, course_id)
UNIQUE(quiz_id, question_id)
FOREIGN KEY
CHECK(score >= 0 AND score <= 100)
```

Application/service layer protects workflows.

Examples:

```text
Lesson must have exactly 10 quiz questions.
Final Quiz must have 10–30 questions.
Lesson 2 requires Lesson 1 completion.
Final Quiz requires all Lessons completed.
Published Lesson cannot be deleted.
```

---

# 32. Business Rule vs UI Rule

UI may guide the user but cannot be the final authority.

Example:

The UI may disable:

```text
[Publish]
```

when a Lesson has 8/10 questions.

But the server must also reject the publish request.

The same business rule must exist server-side.

---

# 33. V1 Gamification Rules

The following are explicitly NOT active in V1:

- XP
- Levels
- Badges
- Daily Missions
- Streaks
- Leaderboards

The architecture should not require these features to function.

They may be introduced later.

---

# 34. V1 AI Rules

AI is not a core V1 feature.

There is no AI Nutrition Assistant in the initial release.

Future AI functionality must not alter the authoritative learning/progress rules without explicit product decisions.

Potential future AI features should be isolated behind a dedicated module/service.

---

# 35. V1 Payment Rules

There is no payment/subscription system in V1.

Course access is not dependent on payment.

---

# 36. V1 Article Rules

Articles are Content items with:

```text
content.type = ARTICLE
```

An Article can be published independently.

An Article can also be referenced as course material for one Lesson.

Article progress is not tracked.

Only Course learning progress is tracked.

---

# 37. Progress Rules

Progress applies to:

```text
Course
Lesson
Quiz
```

Progress does NOT apply to standalone Articles.

Example:

```text
Read Article A
→ no progress record

Complete Lesson 1
→ lesson progress recorded

Pass Lesson Quiz
→ lesson completed
```

---

# 38. Latest Course State

If a user returns to a Course after an Admin has modified it:

```text
User sees latest published state
```

Existing progress remains unless an explicit future migration/versioning system is introduced.

V1 does not automatically recalculate or reset historical progress because of ordinary Course edits.

---

# 39. Error Handling Rules

Errors should be actionable.

Bad:

```text
Error 409
```

Good:

```text
This content is already assigned to another lesson.
```

Bad:

```text
Validation failed.
```

Good:

```text
Lesson Quiz needs 2 more questions before it can be published.
```

---

# 40. Rule Priority

When implementing a feature, use this priority:

```text
1. Security
2. Database integrity
3. Business rules
4. Product requirements
5. UX convenience
6. Implementation convenience
```

Implementation convenience must never override a business rule.

---

# 41. AI Coding Agent Rule

GLM-5 must treat this document as an authoritative business-rule reference.

Before implementing a feature:

1. Identify relevant business rules.
2. Check database constraints.
3. Check service-layer responsibilities.
4. Implement server-side enforcement.
5. Implement UI guidance.
6. Test both valid and invalid cases.

If an implementation requirement conflicts with this document, GLM-5 must not silently choose one.

It should surface the conflict for review.

---

# 42. V1 Definition of Done for Learning Flow

The core learning experience is considered functionally complete when:

```text
Guest
  ↓
Browse Course
  ↓
Login
  ↓
Enroll
  ↓
Lesson 1
  ↓
Content
  ↓
10-question Lesson Quiz
  ↓
80%+
  ↓
Lesson 2 unlocked
  ↓
...
  ↓
All Lessons completed
  ↓
Final Quiz
  ↓
10–30 questions
  ↓
80%+
  ↓
Course Completed
```

This is the central V1 business flow.
