"use server";

import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { courses, lessons, questions, quizQuestions, quizzes } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

/**
 * BINZI Lesson Quiz add-Question server action (TASK 033, Task Plan
 * "Select Questions", CMS Spec §9/§21/§23/§25, BR §14/§31, Blueprint
 * §27, Decisions Log #11).
 *
 * Mutation order per the approved Mutation Pattern (TASK 025–029):
 * authenticate → authorize → validate → load/verify target (locked)
 * → execute atomically → safe result.
 *
 * LAZY QUIZ MATERIALIZATION: lessons created by TASK 025 carry no
 * quiz row — no spec defines an explicit creation moment for the
 * "exactly one Lesson Quiz per Lesson" invariant (CMS §21/Drizzle
 * Spec §10). The first added Question creates the quiz row INSIDE
 * the same transaction: {title: "Kuis Pelajaran: <lesson title>"
 * (server-generated — quizzes.title is NOT NULL and no spec source
 * names lesson-quiz titles), type LESSON, lesson_id, course_id
 * NULL}. The row then persists even when emptied again — 0 questions
 * is simply "not publishable" (CMS §21), and deleting/recreating it
 * would only fight UNIQUE(lesson_id).
 *
 * REUSABILITY (CMS §23, TASK 032): a Question may sit in MANY
 * Quizzes — the only rejection here is a duplicate within THIS quiz
 * (UNIQUE(quiz_id, question_id)). Cross-quiz usage is never checked,
 * never blocked.
 *
 * No "exactly 10" enforcement here: BR §31 and Blueprint §27 place
 * that rule at publish validation (TASK 035); the builder displays
 * the N / 10 status (CMS §21) and accepts any membership count.
 *
 * Lock ordering (deadlock-free, conventions of TASK 025–029 — every
 * course-scoped mutation takes the course-row lock first):
 * course FOR UPDATE (re-check DRAFT under the lock, Decisions #11)
 * → lesson FOR UPDATE (ownership re-check) → quiz row FOR UPDATE
 * (looked up by lesson_id — quizId is NEVER client input) → the
 * quiz's quiz_questions rows FOR UPDATE in sort_order order, which
 * serializes the MAX+1 append against concurrent adds/removes/
 * reorders of the same quiz. The course lock also makes the lazy
 * quiz insert race-free; UNIQUE(lesson_id) stays the final
 * authority.
 *
 * Input contract — deliberately minimal. The client sends ONLY
 * `questionId`; course AND lesson bindings come from the action's
 * server-side bind (never hidden fields). NOTHING else is read from
 * the payload.
 *
 * Feedback (TASK 028 convention, panel-scoped): benign rejections
 * redirect back to the lesson editor with a `quizError` URL flag
 * rendered inline by the quiz panel — the route's `error` param
 * belongs to the Content panel, and shared flag names would render
 * misleading cross-panel alerts. Flags: `locked` (published course),
 * `missing` (unknown lesson/question), `duplicate` (question already
 * in this quiz), `invalid` (malformed input). Success redirects
 * plainly; the re-rendered quiz list is the success state.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const QUIZ_LESSON_UNIQUE = "quizzes_lesson_id_unique";
const QUIZ_QUESTION_UNIQUE = "quiz_questions_quiz_question_unique";

function formValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/**
 * Postgres unique-violation detection. drizzle-orm wraps query
 * failures in DrizzleQueryError, so the code/constraint live on the
 * .cause chain (TASK 031 lesson).
 */
function isUniqueViolationOn(error: unknown, constraint: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code?: unknown }).code === "23505" &&
      "constraint" in current &&
      (current as { constraint?: unknown }).constraint === constraint
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function addQuestionToLessonQuizAction(
  courseId: string,
  lessonId: string,
  formData: FormData,
): Promise<void> {
  const editorHref = `/admin/courses/${courseId}/lessons/${lessonId}`;

  // 1. Authenticate — Supabase cookie session, validated server-side.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[lesson-quiz/add] rejected: no session");
    redirect("/login");
  }

  // 2. Authorize — role from public.users; never client input.
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    console.error("[lesson-quiz/add] rejected: not admin");
    redirect(editorHref);
  }

  // 3. Validate the minimal input contract.
  const questionId = formValue(formData, "questionId");

  if (!UUID_PATTERN.test(courseId) || !UUID_PATTERN.test(lessonId)) {
    console.error("[lesson-quiz/add] rejected: malformed route ids");
    redirect(`${editorHref}?quizError=invalid`);
  }
  if (!questionId || !UUID_PATTERN.test(questionId)) {
    console.error("[lesson-quiz/add] rejected: malformed questionId");
    redirect(`${editorHref}?quizError=invalid`);
  }

  // 4. Load/verify + execute — one transaction (see strategy above).
  try {
    await db.transaction(async (tx) => {
      // Lock the course row: serializes concurrent structural mutations
      // for this course and re-checks publish state under the lock
      // (Decisions #11).
      const [course] = await tx
        .select({ id: courses.id, status: courses.status })
        .from(courses)
        .where(eq(courses.id, courseId))
        .for("update")
        .limit(1);

      if (!course) {
        throw new QuizRejected("missing", "course not found");
      }
      if (course.status === "PUBLISHED") {
        throw new QuizRejected(
          "locked",
          "course is PUBLISHED (Decisions #11)",
        );
      }

      // Load + lock the lesson row; ownership is re-verified under the
      // lock (courseId match), never trusted from the payload.
      const [lesson] = await tx
        .select({ id: lessons.id, courseId: lessons.courseId, title: lessons.title })
        .from(lessons)
        .where(eq(lessons.id, lessonId))
        .for("update")
        .limit(1);

      if (!lesson || lesson.courseId !== courseId) {
        throw new QuizRejected("missing", "lesson not in course");
      }

      // Resolve THIS lesson's Lesson Quiz (identity is server-derived —
      // quizId is never client input). Lock it when it exists…
      let [quiz] = await tx
        .select({ id: quizzes.id })
        .from(quizzes)
        .where(and(eq(quizzes.lessonId, lessonId), eq(quizzes.type, "LESSON")))
        .for("update")
        .limit(1);

      // …or materialize it with the first membership (see header note).
      if (!quiz) {
        const inserted = await tx
          .insert(quizzes)
          .values({
            title: `Kuis Pelajaran: ${lesson.title}`,
            type: "LESSON",
            lessonId,
            courseId: null,
          })
          .returning({ id: quizzes.id });
        quiz = inserted[0];
      }

      // Lock the quiz's membership rows in sort_order order so the
      // MAX+1 append below is serialized against concurrent
      // add/remove/reorder of the same quiz (UNIQUE(quiz_id,
      // sort_order) stays the final authority).
      const assignedRows = await tx
        .select({
          questionId: quizQuestions.questionId,
          sortOrder: quizQuestions.sortOrder,
        })
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quiz.id))
        .orderBy(asc(quizQuestions.sortOrder))
        .for("update");

      // The Question must exist (unknown ids die before any write).
      const [question] = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.id, questionId))
        .limit(1);

      if (!question) {
        throw new QuizRejected("missing", "question not found");
      }

      // Duplicate within THIS quiz only (CMS §23 — cross-quiz reuse is
      // the intended behavior and is never rejected here).
      if (assignedRows.some((row) => row.questionId === questionId)) {
        throw new QuizRejected("duplicate", "question already in this quiz");
      }

      // Append at the end of the persisted order (TASK 025/028
      // convention).
      const nextOrder =
        assignedRows.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;

      await tx.insert(quizQuestions).values({
        quizId: quiz.id,
        questionId,
        sortOrder: nextOrder,
      });

      // Post-verify inside the transaction: exactly one membership row
      // for this (quiz, question) pair, at the computed append
      // position, and the quiz's row count grew by exactly one.
      const quizRows = await tx
        .select({
          questionId: quizQuestions.questionId,
          sortOrder: quizQuestions.sortOrder,
        })
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quiz.id))
        .orderBy(asc(quizQuestions.sortOrder));
      const matches = quizRows.filter((row) => row.questionId === questionId);
      if (
        matches.length !== 1 ||
        matches[0].sortOrder !== nextOrder ||
        quizRows.length !== assignedRows.length + 1
      ) {
        throw new Error(
          `[lesson-quiz/add] post-verification failed: ${JSON.stringify(quizRows.map((row) => row.sortOrder))}`,
        );
      }
    });
  } catch (error) {
    if (error instanceof QuizRejected) {
      console.error(`[lesson-quiz/add] rejected: ${error.detail}`);
      redirect(`${editorHref}?quizError=${error.flag}`);
    }
    if (isUniqueViolationOn(error, QUIZ_QUESTION_UNIQUE)) {
      // Lost a race against the constraint; the transaction already
      // rolled back with zero writes.
      console.error("[lesson-quiz/add] membership unique violation (race)");
      redirect(`${editorHref}?quizError=duplicate`);
    }
    if (isUniqueViolationOn(error, QUIZ_LESSON_UNIQUE)) {
      // Unreachable while the course-row lock is held; fail safe.
      console.error("[lesson-quiz/add] quiz lesson unique violation (race)");
      redirect(`${editorHref}?quizError=duplicate`);
    }
    console.error("[lesson-quiz/add] transaction failed:", error);
    redirect(`${editorHref}?quizError=invalid`);
  }

  // 5. Success — back to the lesson editor, whose re-rendered quiz
  //    list is the success state. redirect() throws, so nothing
  //    returns.
  redirect(editorHref);
}

/** Control-flow marker for rejected (non-error) additions. */
class QuizRejected extends Error {
  /** URL flag the editor renders as an actionable message. */
  readonly flag: "locked" | "missing" | "duplicate";
  readonly detail: string;

  constructor(flag: "locked" | "missing" | "duplicate", detail: string) {
    super(detail);
    this.name = "QuizRejected";
    this.flag = flag;
    this.detail = detail;
  }
}
