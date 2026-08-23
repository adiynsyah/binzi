"use server";

import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { courses, questions, quizQuestions, quizzes } from "@/db/schema";
import { isUserAdmin } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

/**
 * BINZI Final Quiz add-Question server action (TASK 034, Task Plan
 * "Build Final Quiz", CMS Spec §7/§20/§23/§25, BR §16, Blueprint §27,
 * Decisions Log #11).
 *
 * Mutation order per the approved Mutation Pattern (TASK 025–029):
 * authenticate → authorize → validate → load/verify target (locked)
 * → execute atomically → safe result.
 *
 * LAZY QUIZ MATERIALIZATION: createCourse (TASK 023) writes no quiz
 * row — no spec defines an explicit creation moment for the "exactly
 * one Final Quiz per Course" invariant (BR §16 / Drizzle Spec §10;
 * the same approved interpretation as TASK 033). The first added
 * Question creates the quiz row INSIDE the same transaction:
 * {title: "Kuis Akhir: <course title>" (server-generated —
 * quizzes.title is NOT NULL and no spec source names final-quiz
 * titles), type FINAL, course_id, lesson_id NULL}. The row then
 * persists even when emptied again — 0 questions is simply "not
 * publishable" (CMS §29), and deleting/recreating it would only
 * fight UNIQUE(course_id).
 *
 * REUSABILITY (CMS §23, TASK 032): a Question may sit in MANY
 * Quizzes — the only rejection here is a duplicate within THIS quiz
 * (UNIQUE(quiz_id, question_id)). Cross-quiz usage (including the
 * same Question in a Lesson Quiz AND this Final Quiz) is never
 * checked, never blocked.
 *
 * No 10–30 enforcement here: BR §16 and Blueprint §27 place that
 * rule at publish validation (TASK 035); the builder displays the
 * count against the range (CMS §20) and accepts any membership
 * count.
 *
 * Lock ordering (deadlock-free, conventions of TASK 025–029/033 —
 * every course-scoped mutation takes the course-row lock first):
 * course FOR UPDATE (re-check DRAFT under the lock, Decisions #11)
 * → quiz row FOR UPDATE (looked up by course_id + type FINAL —
 * quizId is NEVER client input) → the quiz's quiz_questions rows
 * FOR UPDATE in sort_order order, which serializes the MAX+1 append
 * against concurrent adds/removes/reorders of the same quiz. The
 * course lock also makes the lazy quiz insert race-free;
 * UNIQUE(course_id) stays the final authority.
 *
 * Input contract — deliberately minimal. The client sends ONLY
 * `questionId`; the course binding comes from the action's
 * server-side bind (never hidden fields). NOTHING else is read from
 * the payload.
 *
 * Feedback (TASK 028/033 convention, panel-scoped): benign
 * rejections redirect back to the Course Builder with a
 * `finalQuizError` URL flag rendered inline by this panel — the
 * namespaced flag can never collide with another route's or panel's
 * feedback. Flags: `locked` (published course), `missing` (unknown
 * course/question), `duplicate` (question already in this quiz),
 * `invalid` (malformed input). Success redirects plainly; the
 * re-rendered quiz list is the success state.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const QUIZ_COURSE_UNIQUE = "quizzes_course_id_unique";
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

export async function addQuestionToFinalQuizAction(
  courseId: string,
  formData: FormData,
): Promise<void> {
  const builderHref = `/admin/courses/${courseId}/edit`;

  // 1. Authenticate — Supabase cookie session, validated server-side.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[final-quiz/add] rejected: no session");
    redirect("/login");
  }

  // 2. Authorize — role from public.users; never client input.
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    console.error("[final-quiz/add] rejected: not admin");
    redirect(builderHref);
  }

  // 3. Validate the minimal input contract.
  const questionId = formValue(formData, "questionId");

  if (!UUID_PATTERN.test(courseId)) {
    console.error("[final-quiz/add] rejected: malformed route id");
    redirect(`${builderHref}?finalQuizError=invalid`);
  }
  if (!questionId || !UUID_PATTERN.test(questionId)) {
    console.error("[final-quiz/add] rejected: malformed questionId");
    redirect(`${builderHref}?finalQuizError=invalid`);
  }

  // 4. Load/verify + execute — one transaction (see strategy above).
  try {
    await db.transaction(async (tx) => {
      // Lock the course row: serializes concurrent structural mutations
      // for this course and re-checks publish state under the lock
      // (Decisions #11). The title feeds the lazy materialization.
      const [course] = await tx
        .select({
          id: courses.id,
          status: courses.status,
          title: courses.title,
        })
        .from(courses)
        .where(eq(courses.id, courseId))
        .for("update")
        .limit(1);

      if (!course) {
        throw new FinalQuizRejected("missing", "course not found");
      }
      if (course.status === "PUBLISHED") {
        throw new FinalQuizRejected(
          "locked",
          "course is PUBLISHED (Decisions #11)",
        );
      }

      // Resolve THIS course's Final Quiz (identity is server-derived —
      // quizId is never client input). Lock it when it exists…
      let [quiz] = await tx
        .select({ id: quizzes.id })
        .from(quizzes)
        .where(and(eq(quizzes.courseId, courseId), eq(quizzes.type, "FINAL")))
        .for("update")
        .limit(1);

      // …or materialize it with the first membership (see header note).
      if (!quiz) {
        const inserted = await tx
          .insert(quizzes)
          .values({
            title: `Kuis Akhir: ${course.title}`,
            type: "FINAL",
            courseId,
            lessonId: null,
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
        throw new FinalQuizRejected("missing", "question not found");
      }

      // Duplicate within THIS quiz only (CMS §23 — cross-quiz reuse is
      // the intended behavior and is never rejected here).
      if (assignedRows.some((row) => row.questionId === questionId)) {
        throw new FinalQuizRejected("duplicate", "question already in this quiz");
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
          `[final-quiz/add] post-verification failed: ${JSON.stringify(quizRows.map((row) => row.sortOrder))}`,
        );
      }
    });
  } catch (error) {
    if (error instanceof FinalQuizRejected) {
      console.error(`[final-quiz/add] rejected: ${error.detail}`);
      redirect(`${builderHref}?finalQuizError=${error.flag}`);
    }
    if (isUniqueViolationOn(error, QUIZ_QUESTION_UNIQUE)) {
      // Lost a race against the constraint; the transaction already
      // rolled back with zero writes.
      console.error("[final-quiz/add] membership unique violation (race)");
      redirect(`${builderHref}?finalQuizError=duplicate`);
    }
    if (isUniqueViolationOn(error, QUIZ_COURSE_UNIQUE)) {
      // Unreachable while the course-row lock is held; fail safe.
      console.error("[final-quiz/add] quiz course unique violation (race)");
      redirect(`${builderHref}?finalQuizError=duplicate`);
    }
    console.error("[final-quiz/add] transaction failed:", error);
    redirect(`${builderHref}?finalQuizError=invalid`);
  }

  // 5. Success — back to the Course Builder, whose re-rendered quiz
  //    list is the success state. redirect() throws, so nothing
  //    returns.
  redirect(builderHref);
}

/** Control-flow marker for rejected (non-error) additions. */
class FinalQuizRejected extends Error {
  /** URL flag the builder renders as an actionable message. */
  readonly flag: "locked" | "missing" | "duplicate";
  readonly detail: string;

  constructor(flag: "locked" | "missing" | "duplicate", detail: string) {
    super(detail);
    this.name = "FinalQuizRejected";
    this.flag = flag;
    this.detail = detail;
  }
}
