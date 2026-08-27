# BINZI V1 — UI/UX Specification

## Status

Baseline UI/UX specification for BINZI V1.

This document translates the product, CMS, architecture, and business rules into user-facing flows.

The provided rough wireframes are treated as the starting point, not a final design. The visual direction may be refined during implementation.

---

# 1. UX Principles

BINZI should feel:

- Educational
- Friendly
- Calm
- Trustworthy
- Easy to understand
- Motivating without being overly gamified

The platform is about nutrition education, not competition.

V1 should prioritize:

```text
Clarity
  >
Content quality
  >
Learning flow
  >
Motivation
  >
Visual decoration
```

---

# 2. Primary User Types

## Guest

Goal:

- Discover BINZI
- Read public Articles
- Discover Courses
- Understand course value
- Preview learning content

Primary CTA:

```text
Login / Start Learning
```

## Authenticated User

Goal:

- Continue Courses
- Read Lessons
- Complete Quizzes
- Track Course progress
- Read Articles

Primary CTA:

```text
Continue Learning
```

## Admin

Goal:

- Create educational content
- Build Courses
- Build Lessons
- Create Questions
- Publish educational material

CMS is optimized for desktop/tablet authoring.

---

# 3. Global Navigation

Recommended public navigation:

```text
Logo
Courses
Articles
Search
                    Login
```

After login:

```text
Logo
Courses
Articles
                    Profile
```

Mobile:

```text
Logo
        Menu
```

Do not overload the navigation with future gamification features in V1.

---

# 4. Homepage

The Homepage should answer within a few seconds:

1. What is BINZI?
2. What can I learn?
3. Where should I start?

Recommended structure:

```text
Hero
  ↓
Featured / Popular Courses
  ↓
Why BINZI
  ↓
Featured Articles
  ↓
Learning CTA
```

---

# 5. Homepage Hero

Hero should have:

```text
Headline
Short explanation
Primary CTA
Secondary CTA
Visual
```

Example structure:

```text
Belajar Gizi dengan Cara
yang Lebih Mudah.

Materi gizi yang ...
[Mulai Belajar]

[Explore Articles]
```

Avoid excessive marketing copy.

The first screen should communicate the educational value clearly.

---

# 6. Course Catalog

Route:

```text
/courses
```

Purpose:

Help users discover Courses.

Recommended:

```text
Page title
Short description

Search
Filter

Course Grid
```

Course card:

```text
Thumbnail
Category / Difficulty
Title
Short description
Duration
Lesson count
CTA
```

Avoid putting too many metadata fields on the card.

---

# 7. Course Detail

Route:

```text
/courses/[slug]
```

Course detail should sell the learning outcome, not simply display database information.

Recommended structure:

```text
Course Header
├── Thumbnail
├── Title
├── Description
├── Difficulty
├── Duration
└── CTA

What You Will Learn

Course Curriculum
├── Lesson 1
├── Lesson 2
├── Lesson 3
└── ...

About This Course

CTA
```

---

# 8. Course Curriculum

For guests:

```text
Lesson 1
Lesson 2 🔒
Lesson 3 🔒
```

Lesson titles can be visible.

Some lesson content may be previewed.

For authenticated enrolled users:

```text
✓ Lesson 1
🔒 Lesson 2
🔒 Lesson 3
```

After Lesson 1 is completed:

```text
✓ Lesson 1
→ Lesson 2
🔒 Lesson 3
```

The visual lock state is UX only. Server-side authorization remains authoritative.

---

# 9. Enrollment CTA

Guest:

```text
[Start Learning]
```

If login is required:

```text
Login to Start Learning
```

Authenticated but not enrolled:

```text
Start Course
```

Already enrolled:

```text
Continue Course
```

Completed:

```text
Review Course
```

Do not create a complex enrollment funnel in V1.

---

# 10. Learning Experience

Recommended route:

```text
/courses/[slug]/learn
```

The learning experience should minimize distractions.

Desktop:

```text
┌─────────────────────────────────────────────┐
│ BINZI        Course Title       Progress    │
├──────────────┬──────────────────────────────┤
│ Lessons      │                              │
│              │ Lesson Content               │
│ ✓ Lesson 1   │                              │
│ → Lesson 2   │                              │
│ 🔒 Lesson 3  │                              │
│              │                              │
│              │ [Continue]                   │
└──────────────┴──────────────────────────────┘
```

Mobile:

```text
Header
Progress
Lesson Content
Quiz / Continue
```

The lesson navigation should become a collapsible drawer/sheet on mobile.

---

# 11. Lesson Header

Show:

```text
Course Name
Lesson X of Y
Lesson Title
Progress
```

Example:

```text
Dasar-Dasar Gizi
Lesson 2 of 6

Memahami Karbohidrat

██████░░░░ 33%
```

Progress should communicate learning position, not gamification.

---

# 12. Lesson Content

Content is rendered in its configured order.

Example:

```text
Lesson Title

Article
↓
Video
↓
Tip
↓
Infographic
↓
Lesson Quiz
```

The user should not need to understand Content Types.

Content should visually feel like one coherent lesson.

---

# 13. Article Content

Article reading experience:

```text
Title
Reading metadata
Content
```

Typography is important.

Recommended:

- Comfortable line length
- Large enough body text
- Strong heading hierarchy
- Adequate paragraph spacing
- Good contrast

Do not use overly narrow content columns on desktop.

---

# 14. Video Content

Video should be embedded naturally inside the Lesson.

Recommended:

```text
Video
Title / caption
Optional description
```

If video cannot load:

```text
We couldn't load this video.
Please try again.
```

Do not break the entire Lesson.

---

# 15. Tip Content

Tips should visually stand apart from ordinary article paragraphs.

Example:

```text
┌──────────────────────────────┐
│ 💡 Tips                      │
│                              │
│ Cobalah ...                  │
└──────────────────────────────┘
```

Avoid overusing decorative cards.

---

# 16. Infographic Content

Infographic should:

- Preserve aspect ratio
- Be responsive
- Be zoomable/openable where appropriate
- Have alternative text

On mobile, images must not overflow the viewport.

---

# 17. Lesson Completion

Do not show Lesson as completed merely because the user reached the bottom.

The completion CTA should lead to the Quiz.

```text
Lesson Content
      ↓
Ready to test your understanding?
      ↓
[Take Quiz]
```

After passing:

```text
✓ Lesson Completed

Great job!

[Continue to Lesson 2]
```

---

# 18. Lesson Quiz UX

Quiz should feel focused.

Recommended:

```text
Lesson Quiz

Question 3 of 10

What is ...?

○ Answer A
○ Answer B
○ Answer C
○ Answer D

[Next]
```

Avoid showing the correct answer immediately after every question unless explicitly chosen as a future learning mode.

---

# 19. Quiz Navigation

V1 should use sequential answering.

Recommended:

```text
Question 1
[Next]

Question 2
[Next]

...

Question 10
[Submit Quiz]
```

Do not introduce complex question navigation in V1 unless usability testing shows a need.

---

# 20. Quiz Answer State

Only one option may be selected.

Selected state must be visually obvious.

The Next button should remain disabled until an answer is selected, unless unanswered questions are intentionally supported.

Recommended V1 behavior:

```text
No answer
→ Next disabled
```

This avoids accidental unanswered submissions.

---

# 21. Quiz Result

Result screen should immediately communicate:

```text
Passed / Not Passed
Score
Correct answers
Next action
```

Passed:

```text
🎉 Great job!

80%

You passed the quiz.

[Continue to Next Lesson]
```

Failed:

```text
Keep Learning

70%

You need 80% to pass.

[Try Again]
```

Do not shame users for failing.

---

# 22. Quiz Score Display

Passing score:

```text
80%
```

Lesson Quiz always has 10 Questions.

Useful display:

```text
8 / 10 correct
80%
PASSED
```

Final Quiz may have 10–30 Questions.

Display both:

```text
24 / 30 correct
80%
PASSED
```

---

# 23. Retry Experience

After failing:

```text
Your score: 70%

You need 80% to pass.

Review the Lesson and try again.

[Review Lesson]
[Try Quiz Again]
```

Users can retry without an attempt limit.

---

# 24. Locked Lesson UX

When a Lesson is locked:

```text
🔒
Complete Lesson 1 to unlock this lesson.
```

Do not simply say:

```text
Access denied
```

Explain why.

---

# 25. Final Quiz UX

Before Final Quiz:

```text
You completed all Lessons!

Ready for the Final Quiz?

10–30 questions
Passing score: 80%

[Start Final Quiz]
```

Final Quiz should feel like a meaningful milestone but not an intimidating exam.

---

# 26. Course Completion UX

After passing Final Quiz:

```text
🎉 Course Completed!

You've successfully completed:

[Course Name]

Final Score
90%

[Back to Courses]
[Review Course]
```

V1 should not add XP, Badge, Level, Streak, or Leaderboard rewards here.

Those belong to the future gamification layer.

---

# 27. Progress UI

Progress should be simple.

Recommended:

```text
Course Progress
████████░░ 80%

4 of 5 Lessons completed
```

Do not expose technical progress fields.

---

# 28. Article Experience

Route:

```text
/articles/[slug]
```

Article page:

```text
Category / metadata
Title
Short introduction
Article body
Related Articles
CTA to Course
```

Articles are independent of Course progress.

---

# 29. Article → Course Connection

If an Article is also used as Course material, the public Article may optionally include:

```text
Want to learn more?

Explore the related course.

[View Course]
```

This connection should be contextual, not intrusive.

---

# 30. Authentication UX

Routes:

```text
/login
/register
```

Login should remain simple.

Recommended:

```text
Email
Password

[Login]

Forgot password?

Don't have an account?
[Register]
```

Do not put unnecessary profile fields into registration.

---

# 31. Registration

V1 registration requires only what is necessary for account creation.

Recommended:

```text
Email
Password
Confirm Password
```

Additional profile information can be collected later.

---

# 32. Profile

V1 Profile can remain minimal.

Show:

```text
Name / Email
Courses
Completed Courses
Current Learning
```

Future gamification should not dominate the profile.

---

# 33. Mobile UX

Public website must be fully responsive.

Breakpoints should be based on content needs, not arbitrary device names.

Important mobile priorities:

1. Readability
2. Touch targets
3. Quiz interaction
4. Video
5. Course navigation
6. Progress visibility

---

# 34. Touch Targets

Interactive controls should have comfortable touch areas.

Avoid tiny:

```text
icon-only buttons
```

when the action is important.

For destructive or critical actions, use explicit labels.

---

# 35. Loading States

Public:

- Skeleton course cards
- Skeleton article
- Lesson content loading
- Quiz loading

CMS:

- Table skeleton
- Editor loading
- Mutation button loading
- Upload progress

Avoid blank screens while data is loading.

---

# 36. Empty States

Example Course:

```text
No courses found.

Try another search or browse all courses.
```

Example CMS:

```text
No lessons yet.

Add your first lesson to start building this course.

[Add Lesson]
```

---

# 37. Error States

Errors should explain what happened and what to do next.

Example:

```text
We couldn't load this lesson.

[Try Again]
```

For permission:

```text
You don't have access to this lesson.

Complete the previous lesson to continue.
```

---

# 38. Toast vs Inline Feedback

Use Toast for:

- Saved successfully
- Copied
- Uploaded
- Minor background success

Use Inline feedback for:

- Form validation
- Quiz errors
- Publish blockers
- Access restrictions

Do not rely on Toast alone for critical information.

---

# 39. Visual Design Direction

The provided rough wireframes can be refined toward a modern educational product.

Recommended characteristics:

- Warm but trustworthy visual identity
- Generous whitespace
- Rounded cards used selectively
- Strong typography
- Clear primary CTA
- Soft visual hierarchy
- Nutrition-related imagery/illustration used intentionally

Avoid:

- Excessive gradients
- Excessive glassmorphism
- Too many floating cards
- Excessive animation
- Game-like visuals that undermine credibility

---

# 40. Color System

Create semantic design tokens rather than hardcoding colors throughout components.

Example:

```text
--color-primary
--color-primary-hover
--color-background
--color-surface
--color-text
--color-text-muted
--color-border
--color-success
--color-warning
--color-danger
```

The exact palette should be established during visual design.

---

# 41. Typography

Typography should optimize for education and reading.

Hierarchy:

```text
Display
H1
H2
H3
Body
Small
Caption
```

Article body should use a dedicated readable text style.

Avoid overly decorative fonts for long-form educational content.

---

# 42. Animation

Animation should support comprehension.

Good uses:

- Quiz answer selection
- Progress transitions
- Modal entrance
- Toast
- Accordion
- Course state transition

Avoid animation that delays content access.

Respect reduced-motion preferences.

---

# 43. Accessibility

Public website must support:

- Keyboard navigation
- Focus states
- Semantic HTML
- Form labels
- Accessible buttons
- Accessible error messages
- Image alt text
- Video captions where available
- Sufficient color contrast
- Reduced motion

Quiz options must be keyboard accessible.

---

# 44. SEO

Public Article pages should be indexable when published.

Course pages should have:

- Title
- Description
- Canonical URL
- Open Graph metadata

Draft content must not be indexed.

Use appropriate metadata per route.

---

# 45. UX Metrics for V1

Do not build a large analytics platform yet.

The most useful behavioral questions are:

- Do users start Courses?
- Do users finish Lesson 1?
- Where do users stop?
- What percentage pass quizzes?
- Do users return to continue Courses?
- Which Articles lead users toward Courses?

These can be instrumented later without changing the core UX.

---

# 46. Future Gamification Boundary

V1 intentionally excludes:

```text
XP
Level
Badge
Daily Mission
Streak
Leaderboard
```

However, the UI should leave enough visual flexibility to introduce these later.

Do not create fake gamification placeholders.

---

# 47. UX Definition of Done

Public learning UX is functionally complete when a user can:

```text
Discover BINZI
   ↓
Browse Courses
   ↓
View Course Detail
   ↓
Register / Login
   ↓
Start Course
   ↓
Read Lesson
   ↓
Take 10-question Quiz
   ↓
Pass at 80%
   ↓
Unlock next Lesson
   ↓
Complete all Lessons
   ↓
Take Final Quiz
   ↓
Pass at 80%
   ↓
See Course Completed
```

The user should understand what to do next at every major step.

---

# 48. Design Principle

The most important UX rule for BINZI V1:

> The interface should make the next learning action obvious.

At every point, the user should know:

```text
Where am I?
What have I completed?
What can I do now?
What do I need to do next?
```

The platform should reduce cognitive load so the user's attention remains on learning.
