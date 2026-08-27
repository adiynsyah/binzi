# BINZI V1 — CMS Specification

## Status

Functional specification for the BINZI V1 Admin CMS.

The CMS is part of the same Next.js application as the public website. It is designed primarily for admins/content creators and optimized for a nutrition education workflow.

Primary content authoring is expected to be performed by a nutrition professional, while the technical implementation is handled by a solo developer supported by AI coding tools.

---

## 1. CMS Goals

The CMS must make it easy to:

- Create and manage Courses
- Create and manage Lessons
- Create and manage Content
- Build Lesson Quizzes
- Build Final Quizzes
- Manage reusable Questions
- Upload and manage Media
- Save incomplete work as Draft
- Preview content
- Publish valid content
- Understand what is ready and what is blocking publication

The CMS should feel like an education-content authoring tool, not a database administration panel.

---

## 2. Core CMS Workflow

The primary authoring hierarchy is:

```text
Course
  ↓
Lesson
  ↓
Content
  ↓
Lesson Quiz

Course
  ↓
Final Quiz
```

There is no Module layer in V1.

---

## 3. CMS Navigation

Recommended main navigation:

```text
Dashboard
Courses
Content
Questions
Media
```

Optional later:

```text
Users
Analytics
Settings
```

Do not add deferred gamification or AI sections in V1.

---

## 4. Dashboard

The CMS Dashboard should provide a lightweight overview.

Recommended widgets:

- Total Courses
- Published Courses
- Draft Courses
- Published Articles
- Draft Content
- Questions in Question Bank
- Recent Activity

The dashboard is informational. It should not become an analytics system in V1.

---

## 5. Course Management

### Course List

Display:

- Title
- Status
- Difficulty
- Number of Lessons
- Estimated Duration
- Updated At
- Actions

Actions:

- Open
- Edit
- Preview
- Publish/Unpublish when allowed

Use filters:

- All
- Draft
- Published

Optional search by title.

---

## 6. Create Course

Required fields:

- Title
- Description
- Difficulty
- Estimated Duration

Optional:

- Thumbnail

Automatically generated:

- Slug
- Created timestamp

Recommended UX:

```text
Create Course
   ↓
Course Editor
   ↓
Save Draft
```

A newly created Course is always Draft.

---

## 7. Course Editor

Recommended layout:

```text
┌────────────────────────────────────────────┐
│ Course Title                    [Draft]    │
│ [Save Draft] [Preview] [Publish]           │
├────────────────────────────────────────────┤
│ Course Information                         │
│                                            │
│ Title                                      │
│ Description                                │
│ Difficulty                                 │
│ Duration                                   │
│ Thumbnail                                  │
├────────────────────────────────────────────┤
│ Lessons                                    │
│                                            │
│ ≡ Lesson 1                                 │
│ ≡ Lesson 2                                 │
│ ≡ Lesson 3                                 │
│                                            │
│ [+ Add Lesson]                             │
├────────────────────────────────────────────┤
│ Final Quiz                                 │
│ [Configure Final Quiz]                     │
└────────────────────────────────────────────┘
```

Lesson ordering should use drag-and-drop.

After reordering, the server must persist `sort_order`.

---

## 8. Lesson Management

A Lesson belongs to exactly one Course.

### Create Lesson

Required:

- Title

Optional:

- Description

A new Lesson starts as Draft.

---

## 9. Lesson Editor

Recommended structure:

```text
Lesson Editor
├── Basic Information
├── Content
├── Lesson Quiz
└── Publish Status
```

Content area:

```text
Content
────────────────────────
≡ Article
≡ Video
≡ Infographic
≡ Tip
[+ Add Content]
```

The order is controlled by drag-and-drop.

---

## 10. Content Assignment

A Lesson may contain multiple Content items.

A Lesson can contain different Content Types:

```text
Article
Video
Infographic
Text
Tip
```

Example:

```text
Lesson 1
  ├── Article
  ├── Video
  ├── Infographic
  ├── Tip
  └── Article
```

The order is meaningful and must be persisted.

---

## 11. Content Reuse Rule

A Content item may be used as:

- Standalone published Article
- Course material

But one Content item may belong to only one Lesson.

Database constraint:

```text
UNIQUE(content_id)
```

The CMS should prevent accidental reuse.

When selecting Content for a Lesson:

```text
Available
├── Article A
├── Video B
└── Tip C

Already assigned
└── Article D
```

Already-assigned Content should not be selectable.

If a race condition or API manipulation still attempts reuse, the database constraint must reject it gracefully.

---

## 12. Content Management

Content is a first-class CMS entity.

Content Types:

```text
ARTICLE
VIDEO
INFOGRAPHIC
TEXT
TIP
```

There is no separate Article table.

---

## 13. Content List

Display:

- Title
- Content Type
- Status
- Updated At
- Used In
- Actions

Filters:

- All
- Draft
- Published
- Article
- Video
- Infographic
- Text
- Tip

Search:

- Title

---

## 14. Content Editor

The Content Editor should contain:

```text
Content Type
Title
Slug
Editor
Metadata
Status
```

For Article:

```text
ARTICLE
 ├── Title
 ├── Slug
 └── Tiptap Editor
```

For Video:

```text
VIDEO
 ├── Title
 ├── Video Provider
 ├── Video ID / URL
 └── Optional description
```

The exact fields can differ slightly by Content Type while preserving a unified Content model.

---

## 15. Tiptap Editor

Tiptap is the selected rich-text editor.

The editor should support, at minimum:

- Paragraph
- Heading
- Bold
- Italic
- Underline
- Bullet List
- Ordered List
- Blockquote
- Link
- Image
- Horizontal Rule

Potential later extensions:

- Callout
- Table
- Highlight
- YouTube embed
- Custom nutrition components

Do not implement every Tiptap extension in V1.

---

## 16. Content Preview

Every Content item should have a preview mode.

Preview should render content as closely as possible to the public experience.

Recommended actions:

```text
[Edit] [Preview] [Save Draft] [Publish]
```

Draft preview is available to admins only.

Draft content must never become publicly accessible simply because a preview URL exists.

---

## 17. Content Status

Statuses:

```text
DRAFT
PUBLISHED
```

### Draft

- Editable
- Not publicly visible
- Can be incomplete
- Can be deleted when no protected references prevent it

### Published

- Publicly visible according to access rules
- Editable according to V1 workflow
- Unpublishable
- Not automatically deleted

---

## 18. Content Publish Validation

Before publishing Content:

- Title must exist
- Required content body must be valid
- Content-Type-specific required metadata must exist
- Slug must be valid where required

If validation fails, show actionable errors.

Example:

```text
Cannot publish this video.

Missing:
• Video URL
```

Do not show generic:

```text
Validation failed.
```

---

## 19. Lesson Publish Validation

A Lesson cannot be published unless:

1. Lesson metadata is valid.
2. At least one Content item exists.
3. All assigned Content items are published/usable according to the selected publishing model.
4. Exactly one Lesson Quiz exists.
5. Lesson Quiz contains exactly 10 Questions.
6. Every Question has valid options.
7. Every published Question has exactly one correct option.

If validation fails, show a checklist.

Example:

```text
Lesson is not ready to publish

✓ Basic information
✓ Content
✗ Lesson Quiz
  └── Quiz currently has 8/10 questions
```

---

## 20. Final Quiz CMS

Final Quiz is managed from the Course.

Recommended:

```text
Course
  └── Final Quiz
       ├── Questions
       └── Ordering
```

Rules:

- Minimum 10 Questions
- Maximum 30 Questions
- Passing score = 80%
- Multiple choice
- Single correct answer per Question

---

## 21. Lesson Quiz CMS

Every Lesson has exactly one Lesson Quiz.

Rules:

- Exactly 10 Questions
- Passing score = 80%
- Multiple choice
- Single correct answer per Question

The CMS should display:

```text
8 / 10 Questions
```

and prevent publication until exactly 10 are assigned.

---

## 22. Question Bank

Questions are reusable.

Question Bank list:

```text
Question
Number of options
Used in
Updated At
Actions
```

Question editor:

```text
Question
[Text]

Options
○ Option A
○ Option B
○ Option C
○ Option D

Explanation
[Text]
```

Only one option can be marked correct.

The CMS should enforce this interaction.

---

## 23. Question Reuse

A Question can be assigned to multiple Quizzes.

Example:

```text
Question A
 ├── Lesson Quiz 1
 ├── Lesson Quiz 5
 └── Final Quiz
```

This is intentional.

Question reuse is different from Content reuse.

Content:
- One Lesson maximum

Question:
- Multiple Quizzes allowed

---

## 24. Question Editing Warning

Because Questions are reusable, editing a Question can affect multiple Quizzes.

When an admin edits a reused Question, show:

```text
This question is currently used in 4 quizzes.

Changes will affect all quizzes using this question.

[Cancel] [Continue]
```

This is an important CMS safety feature.

---

## 25. Quiz Ordering

Questions inside a Quiz have an explicit order.

Use drag-and-drop.

Example:

```text
≡ Question 1
≡ Question 2
≡ Question 3
...
```

Persist ordering through `quiz_questions.sort_order`.

---

## 26. Lesson Content Ordering

Content inside a Lesson also has explicit ordering.

Use drag-and-drop.

Persist using:

```text
lesson_contents.sort_order
```

The ordering UI should update the server rather than relying only on local state.

---

## 27. Media Library

Media is managed through Supabase Storage.

CMS Media Library should show:

- Preview
- File name
- Type
- Size
- Uploaded At
- Uploaded By

Supported V1 categories:

- Images
- Video files only if explicitly needed

For large external video hosting, prefer storing provider references rather than uploading large video files directly.

---

## 28. Media Upload UX

Recommended:

```text
[Upload Media]

Drop files here
or
[Browse Files]
```

Validate:

- MIME type
- File size
- Image dimensions where applicable

Show upload progress.

If upload fails:

```text
Upload failed.
Please try again.
```

Do not create incomplete media records when storage upload fails.

---

## 29. Course Publish Validation

A Course cannot be published unless:

1. Course metadata is valid.
2. Course has at least one Lesson.
3. All Lessons intended to be part of the published Course are valid.
4. Each Lesson has exactly one Lesson Quiz.
5. Each Lesson Quiz has exactly 10 Questions.
6. Final Quiz exists.
7. Final Quiz has 10–30 Questions.
8. Required referenced content is published/valid.

The exact interpretation of whether every Lesson must itself be published should remain consistent with the selected Course publishing model.

For V1, the recommended rule is:

**All Lessons included in a published Course must be Published.**

---

## 30. Publish Workflow

Recommended:

```text
Draft
  ↓
Edit
  ↓
Save Draft
  ↓
Validate
  ↓
Preview
  ↓
Publish
  ↓
Published
```

Publish should be an explicit action.

---

## 31. Unpublish Workflow

Admin may unpublish published Course/Content where the business rules allow it.

Before unpublishing a Course, show a warning:

```text
Unpublishing this course will remove it from public discovery.

Existing users with access may be affected.

[Cancel] [Unpublish]
```

The exact treatment of users currently enrolled in an unpublished Course should be decided at the application policy level.

---

## 32. Published Lesson Deletion

A published Lesson cannot be deleted.

The CMS should:

- Hide/disable Delete
- Explain why
- Enforce the rule server-side

Example:

```text
Published lessons cannot be deleted.
```

If an admin wants to remove the Lesson from future Course structure, a future archival mechanism can be introduced rather than destructive deletion.

Archiving is not required for V1.

---

## 33. Draft Lesson Deletion

Draft Lessons can be deleted.

Before deletion:

```text
Delete this draft lesson?

This action cannot be undone.

[Cancel] [Delete]
```

Server-side validation remains mandatory.

---

## 34. Course Editing While Users Are Learning

V1 uses the latest Course state.

There is no Course versioning.

Admin may edit Course content according to the publication rules.

Existing users should be able to return to the latest Course state.

Existing progress should not be reset automatically.

---

## 35. Admin Feedback

Every major mutation should provide clear feedback:

Success:

```text
Course saved.
```

Error:

```text
Could not save the course.
Please try again.
```

Conflict:

```text
This content is already assigned to another lesson.
```

Validation:

```text
Lesson cannot be published.
Quiz needs 2 more questions.
```

Avoid technical error messages in the normal UI.

---

## 36. Autosave

Do not implement aggressive autosave in the first CMS version.

V1 should use explicit:

```text
Save Draft
```

Autosave can be added later if user research demonstrates the need.

Tiptap content should not be silently lost.

Warn before leaving a page with unsaved changes.

---

## 37. Unsaved Changes

For editors with unsaved changes:

```text
You have unsaved changes.

Leave without saving?
[Stay] [Leave]
```

This is especially important for Tiptap.

---

## 38. Admin Permissions

V1 has one administrative role:

```text
ADMIN
```

All admins have the same CMS permissions.

Do not build granular permissions such as:

```text
EDITOR
AUTHOR
REVIEWER
PUBLISHER
```

until the team actually requires them.

---

## 39. CMS Responsive Strategy

The CMS is primarily designed for desktop/tablet.

It should remain usable on smaller screens, but the public website has the stronger full-responsive requirement.

Do not optimize CMS around mobile-first interaction if it significantly complicates authoring.

---

## 40. Accessibility

CMS should support:

- Keyboard navigation
- Visible focus
- Proper labels
- Semantic buttons
- Accessible dialogs
- Accessible form errors
- Keyboard-accessible quiz/question ordering where practical

Drag-and-drop should not be the only possible ordering mechanism.

Provide move up/down controls as an accessible fallback.

---

## 41. CMS Security

All CMS routes must require:

```text
Authenticated user
+
ADMIN role
```

Server-side checks are mandatory.

Do not rely on:

```text
/admin hidden in navigation
```

as security.

Do not trust client-provided role information.

---

## 42. CMS Data Integrity

CMS actions must use service-layer validation.

Examples:

```text
publishCourse()
publishLesson()
publishContent()
deleteDraftLesson()
assignContentToLesson()
assignQuestionToQuiz()
submitQuizAttempt()
```

The UI can improve user experience, but the server remains authoritative.

---

## 43. CMS Empty States

Every list should have a useful empty state.

Example:

```text
No courses yet.

Create your first nutrition course to get started.

[Create Course]
```

Avoid empty screens.

---

## 44. CMS Loading States

Use appropriate loading UI:

- Skeleton for page/list loading
- Button loading state for mutations
- Upload progress for media
- Editor loading state when initializing Tiptap

Prevent duplicate submissions.

Example:

```text
[Publishing...]
```

instead of allowing repeated clicks.

---

## 45. CMS Error Boundaries

Important CMS sections should have error handling.

Example:

```text
Something went wrong.

We couldn't load this course.

[Try Again]
```

Do not expose stack traces to admins in the normal UI.

Detailed errors belong in server logs.

---

## 46. Recommended CMS Build Order

### CMS Phase 1

- Admin auth guard
- Admin layout
- Dashboard
- Navigation

### CMS Phase 2

- Content CRUD
- Tiptap
- Draft/Published
- Content Preview

### CMS Phase 3

- Course CRUD
- Lesson CRUD
- Lesson ordering
- Content assignment

### CMS Phase 4

- Question Bank
- Question CRUD
- Question options
- Question reuse

### CMS Phase 5

- Lesson Quiz
- Final Quiz
- Question ordering
- Quiz validation

### CMS Phase 6

- Course/Lesson publishing validation
- Publish workflow
- Unpublish workflow
- Admin feedback

### CMS Phase 7

- Media Library
- Upload flow
- Image integration with Tiptap

### CMS Phase 8

- Accessibility
- responsive refinement
- loading/error/empty states
- UX polish

---

## 47. CMS V1 Explicitly Excludes

- AI content generation
- AI nutrition review
- Collaborative editing
- Comments
- Version history
- Scheduled publishing
- Granular admin permissions
- Bulk content import
- Bulk question import
- Content localization/multilingual workflow
- Course versioning
- Advanced analytics
- Audit log UI
- Autosave

These may be evaluated after V1.

---

## 48. CMS Design Principle

The CMS should answer three questions clearly at all times:

### Where am I?

```text
Course → Lesson 2 → Content
```

### What is the current state?

```text
Draft
```

### What do I need to do next?

```text
Lesson Quiz: 8/10 questions
→ Add 2 questions before publishing
```

The CMS should guide the content creator instead of forcing them to understand the database model.
