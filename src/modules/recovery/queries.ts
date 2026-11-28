// Database access for the recovery module (card S3-03 §2).
//
// NEVER import this from another module — go through service.ts (ESLint
// no-restricted-imports). Same table pattern as the attempt/progress
// modules: this file reads the quiz_attempts / quiz_answers / quizzes /
// lessons / courses / users TABLES it needs without importing any other
// module's files. It OWNS quiz_attempt_reports and the reset_* columns of
// quiz_attempts (decision 12); lesson_progress / enrollments are reverted
// through the progress module's service.
//
// Hand-written SQL (STATUS 19 Nov no. 3, card note e): no raw Date inside a
// `sql` fragment (timestamps go through typed columns), and every
// correlated subquery spells out its own alias AND the outer table name.
import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Db } from "@/db/client";
import { db } from "@/db";
import {
  auditLogs,
  courses,
  lessons,
  quizAnswers,
  quizAttemptReports,
  quizAttempts,
  quizzes,
  users,
} from "@/db/schema";

import type {
  AnswerTimeRow,
  AttemptStatus,
  ManualAttemptRow,
  ParticipantAttemptRow,
  ParticipantReportRow,
  QuizKind,
  ReportCountsDTO,
  ReportQueueRow,
  ReportReviewRow,
} from "./serializer";
import type { CreateReportInput, ReportStatus } from "./schema";

export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbOrTx = Db | DbTx;

/** Max rows per queue tab (decision 11 — no pagination). */
export const QUEUE_LIMIT = 50;

// ---------------------------------------------------------------- context

/** The course a LESSON quiz belongs to (via lessons.quiz_id). */
const lessonCourse = alias(courses, "lc");
/** The course a FINAL quiz belongs to (via courses.final_quiz_id). */
const finalCourse = alias(courses, "fc");

/**
 * The quiz context columns every staff read selects: attempt clock + score,
 * the saved-answer count, the question total, and "{kursus} · Materi n /
 * Final Quiz". The lesson position follows the outline order (order_index
 * asc, id asc — progress/queries.ts selectOutlineRows). Subquery aliases
 * (`lp`, `qa`) and the outer table names are written by hand.
 */
const contextColumns = {
  attemptId: quizAttempts.id,
  attemptNumber: quizAttempts.attemptNumber,
  attemptStatus: quizAttempts.status,
  startedAt: quizAttempts.startedAt,
  expiresAt: quizAttempts.expiresAt,
  submittedAt: quizAttempts.submittedAt,
  scorePercent: quizAttempts.scorePercent,
  questionTotal: sql<number>`cardinality(quiz_attempts.question_order)`.mapWith(
    Number,
  ),
  answered: sql<number>`(
    select count(*) from quiz_answers as qa
    where qa.attempt_id = quiz_attempts.id and qa.selected_option_id is not null
  )`.mapWith(Number),
  quizKind: quizzes.type,
  durationMinutes: quizzes.durationMinutes,
  courseTitle: sql<string>`coalesce(lc.title, fc.title)`,
  lessonPosition: sql<number | null>`case when lessons.id is null then null else (
    select count(*) from lessons as lp
    where lp.course_id = lessons.course_id
      and (lp.order_index, lp.id) <= (lessons.order_index, lessons.id)
  ) end`.mapWith((value) => (value === null ? null : Number(value))),
};

// ------------------------------------------------------------ participant

/** PUBLISHED course + its lesson by slugs; every miss is `undefined`. */
export async function selectPublishedLessonBySlugs(
  courseSlug: string,
  lessonSlug: string,
): Promise<{ lessonId: string; quizId: string | null } | undefined> {
  const rows = await db
    .select({ lessonId: lessons.id, quizId: lessons.quizId })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(
      and(
        eq(courses.slug, courseSlug),
        eq(courses.status, "PUBLISHED"),
        eq(lessons.slug, lessonSlug),
      ),
    )
    .limit(1);
  return rows[0];
}

/** Every attempt of the actor on this quiz (live AND reset rows), newest
 *  attempt number first. Ownership in the WHERE. */
export async function selectActorQuizAttempts(
  quizId: string,
  actorId: string,
): Promise<ParticipantAttemptRow[]> {
  return db
    .select({
      id: quizAttempts.id,
      attemptNumber: quizAttempts.attemptNumber,
      status: quizAttempts.status,
      questionOrder: quizAttempts.questionOrder,
      startedAt: quizAttempts.startedAt,
      expiresAt: quizAttempts.expiresAt,
      submittedAt: quizAttempts.submittedAt,
      scorePercent: quizAttempts.scorePercent,
      resetAt: quizAttempts.resetAt,
    })
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, actorId)),
    )
    .orderBy(desc(quizAttempts.attemptNumber));
}

/** Reports of the given attempts of the actor (participant columns only),
 *  newest first. */
export async function selectActorReports(
  attemptIds: string[],
  actorId: string,
): Promise<ParticipantReportRow[]> {
  if (attemptIds.length === 0) return [];
  return db
    .select({
      number: quizAttemptReports.number,
      attemptId: quizAttemptReports.attemptId,
      status: quizAttemptReports.status,
      decisionReason: quizAttemptReports.decisionReason,
      decidedAt: quizAttemptReports.decidedAt,
      createdAt: quizAttemptReports.createdAt,
    })
    .from(quizAttemptReports)
    .where(
      and(
        inArray(quizAttemptReports.attemptId, attemptIds),
        eq(quizAttemptReports.userId, actorId),
      ),
    )
    .orderBy(desc(quizAttemptReports.createdAt), desc(quizAttemptReports.id));
}

/** Saved (non-null) answers of one attempt. */
export async function countAnsweredAnswers(attemptId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(quizAnswers)
    .where(
      and(
        eq(quizAnswers.attemptId, attemptId),
        isNotNull(quizAnswers.selectedOptionId),
      ),
    );
  return rows[0]?.count ?? 0;
}

/** The report lock on the participant's attempt: FOR UPDATE, owner in the
 *  WHERE — another participant's id is `undefined` (404, V-05). */
export async function lockOwnedAttempt(
  tx: DbTx,
  attemptId: string,
  actorId: string,
): Promise<
  | {
      id: string;
      quizId: string;
      userId: string;
      status: AttemptStatus;
      resetAt: Date | null;
    }
  | undefined
> {
  const rows = await tx
    .select({
      id: quizAttempts.id,
      quizId: quizAttempts.quizId,
      userId: quizAttempts.userId,
      status: quizAttempts.status,
      resetAt: quizAttempts.resetAt,
    })
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, actorId)),
    )
    .limit(1)
    .for("update", { of: quizAttempts });
  return rows[0];
}

/** Decision 4: does this user's quiz already have a reset row? */
export async function quizHasResetRow(
  executor: DbOrTx,
  quizId: string,
  userId: string,
): Promise<boolean> {
  const rows = await executor
    .select({ id: quizAttempts.id })
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.quizId, quizId),
        eq(quizAttempts.userId, userId),
        sql`${quizAttempts.resetAt} is not null`,
      ),
    )
    .limit(1);
  return rows.length === 1;
}

/** The report insert; UNIQUE(attempt_id) is the race guard — `undefined`
 *  means another report already exists (409). */
export async function insertReport(
  tx: DbTx,
  input: CreateReportInput & { attemptId: string; userId: string },
): Promise<number | undefined> {
  const rows = await tx
    .insert(quizAttemptReports)
    .values({
      attemptId: input.attemptId,
      userId: input.userId,
      category: input.category,
      description: input.description,
    })
    .onConflictDoNothing({ target: quizAttemptReports.attemptId })
    .returning({ number: quizAttemptReports.number });
  return rows[0]?.number;
}

// ------------------------------------------------------------------ queue

/** Counts per status in ONE query (FILTER per status). */
export async function selectReportCounts(): Promise<ReportCountsDTO> {
  const rows = await db
    .select({
      PENDING: sql<number>`count(*) filter (where ${quizAttemptReports.status} = 'PENDING')`.mapWith(Number),
      APPROVED: sql<number>`count(*) filter (where ${quizAttemptReports.status} = 'APPROVED')`.mapWith(Number),
      REJECTED: sql<number>`count(*) filter (where ${quizAttemptReports.status} = 'REJECTED')`.mapWith(Number),
      ALL: sql<number>`count(*)`.mapWith(Number),
    })
    .from(quizAttemptReports);
  return rows[0] ?? { PENDING: 0, APPROVED: 0, REJECTED: 0, ALL: 0 };
}

const queueColumns = {
  ...contextColumns,
  number: quizAttemptReports.number,
  status: quizAttemptReports.status,
  category: quizAttemptReports.category,
  createdAt: quizAttemptReports.createdAt,
  reporterName: users.name,
};

/**
 * One queue tab: PENDING oldest first (nearest deadline, decision 9),
 * everything else most recently decided first (PENDING rows lead the ALL
 * tab — NULLS FIRST); `id` breaks every tie. At most QUEUE_LIMIT rows.
 */
export async function selectReportQueue(
  status: ReportStatus | "ALL",
): Promise<ReportQueueRow[]> {
  const rows = await db
    .select(queueColumns)
    .from(quizAttemptReports)
    .innerJoin(quizAttempts, eq(quizAttempts.id, quizAttemptReports.attemptId))
    .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
    .innerJoin(users, eq(users.id, quizAttemptReports.userId))
    .leftJoin(lessons, eq(lessons.quizId, quizzes.id))
    .leftJoin(lessonCourse, eq(lessonCourse.id, lessons.courseId))
    .leftJoin(finalCourse, eq(finalCourse.finalQuizId, quizzes.id))
    .where(
      status === "ALL" ? undefined : eq(quizAttemptReports.status, status),
    )
    .orderBy(
      ...(status === "PENDING"
        ? [asc(quizAttemptReports.createdAt), asc(quizAttemptReports.id)]
        : [
            sql`${quizAttemptReports.decidedAt} desc nulls first`,
            asc(quizAttemptReports.createdAt),
            asc(quizAttemptReports.id),
          ]),
    )
    .limit(QUEUE_LIMIT);
  return rows as ReportQueueRow[];
}

// ----------------------------------------------------------------- review

const decider = alias(users, "decider");

/** One report with everything the review page shows; `undefined` = 404. */
export async function selectReportReview(
  number: number,
): Promise<(ReportReviewRow & { attemptQuestionOrder: string[] }) | undefined> {
  const rows = await db
    .select({
      ...queueColumns,
      description: quizAttemptReports.description,
      reporterEmail: users.email,
      reporterOrdinal: sql<number>`(
        select count(*) from quiz_attempt_reports as r2
        where r2.user_id = quiz_attempt_reports.user_id
          and (r2.created_at, r2.id) <= (quiz_attempt_reports.created_at, quiz_attempt_reports.id)
      )`.mapWith(Number),
      decisionReason: quizAttemptReports.decisionReason,
      internalNote: quizAttemptReports.internalNote,
      decidedAt: quizAttemptReports.decidedAt,
      decidedByName: decider.name,
      attemptQuestionOrder: quizAttempts.questionOrder,
    })
    .from(quizAttemptReports)
    .innerJoin(quizAttempts, eq(quizAttempts.id, quizAttemptReports.attemptId))
    .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
    .innerJoin(users, eq(users.id, quizAttemptReports.userId))
    .leftJoin(decider, eq(decider.id, quizAttemptReports.decidedBy))
    .leftJoin(lessons, eq(lessons.quizId, quizzes.id))
    .leftJoin(lessonCourse, eq(lessonCourse.id, lessons.courseId))
    .leftJoin(finalCourse, eq(finalCourse.finalQuizId, quizzes.id))
    .where(eq(quizAttemptReports.number, number))
    .limit(1);
  return rows[0] as
    | (ReportReviewRow & { attemptQuestionOrder: string[] })
    | undefined;
}

/** answered_at of every saved answer of the attempt (for the timeline). */
export async function selectAnswerTimes(
  attemptId: string,
  questionOrder: readonly string[],
): Promise<AnswerTimeRow[]> {
  const rows = await db
    .select({
      questionId: quizAnswers.questionId,
      answeredAt: quizAnswers.answeredAt,
    })
    .from(quizAnswers)
    .where(
      and(
        eq(quizAnswers.attemptId, attemptId),
        isNotNull(quizAnswers.selectedOptionId),
        isNotNull(quizAnswers.answeredAt),
      ),
    );
  return rows.map((row) => ({
    position: questionOrder.indexOf(row.questionId) + 1,
    answeredAt: row.answeredAt!,
  }));
}

// --------------------------------------------------------- decide / reset

/** The decision lock: the report row FOR UPDATE by its display number. */
export async function lockReportByNumber(
  tx: DbTx,
  number: number,
): Promise<{ id: string; number: number; attemptId: string; status: ReportStatus } | undefined> {
  const rows = await tx
    .select({
      id: quizAttemptReports.id,
      number: quizAttemptReports.number,
      attemptId: quizAttemptReports.attemptId,
      status: quizAttemptReports.status,
    })
    .from(quizAttemptReports)
    .where(eq(quizAttemptReports.number, number))
    .limit(1)
    .for("update");
  return rows[0];
}

/** The manual path's report lock: the attempt's PENDING report (if any),
 *  FOR UPDATE — taken BEFORE the attempt lock, same order as decide. */
export async function lockPendingReportByAttempt(
  tx: DbTx,
  attemptId: string,
): Promise<{ id: string; number: number } | undefined> {
  const rows = await tx
    .select({ id: quizAttemptReports.id, number: quizAttemptReports.number })
    .from(quizAttemptReports)
    .where(
      and(
        eq(quizAttemptReports.attemptId, attemptId),
        eq(quizAttemptReports.status, "PENDING"),
      ),
    )
    .limit(1)
    .for("update");
  return rows[0];
}

/** The reset lock: the attempt row FOR UPDATE (staff path — no owner). */
export async function lockAttemptForReset(
  tx: DbTx,
  attemptId: string,
): Promise<
  | {
      id: string;
      quizId: string;
      userId: string;
      status: AttemptStatus;
      scorePercent: string | null;
      isPassed: boolean | null;
      submittedAt: Date | null;
      resetAt: Date | null;
    }
  | undefined
> {
  const rows = await tx
    .select({
      id: quizAttempts.id,
      quizId: quizAttempts.quizId,
      userId: quizAttempts.userId,
      status: quizAttempts.status,
      scorePercent: quizAttempts.scorePercent,
      isPassed: quizAttempts.isPassed,
      submittedAt: quizAttempts.submittedAt,
      resetAt: quizAttempts.resetAt,
    })
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .limit(1)
    .for("update", { of: quizAttempts });
  return rows[0];
}

/** What a quiz belongs to: its type, the lesson (LESSON) and the course. */
export async function selectQuizScope(
  tx: DbTx,
  quizId: string,
): Promise<
  { kind: QuizKind; lessonId: string | null; courseId: string | null } | undefined
> {
  const rows = await tx
    .select({
      kind: quizzes.type,
      lessonId: lessons.id,
      courseId: sql<string | null>`coalesce(lessons.course_id, fc.id)`,
    })
    .from(quizzes)
    .leftJoin(lessons, eq(lessons.quizId, quizzes.id))
    .leftJoin(finalCourse, eq(finalCourse.finalQuizId, quizzes.id))
    .where(eq(quizzes.id, quizId))
    .limit(1);
  return rows[0];
}

/** Decision 3: does the course's Final have a LIVE attempt of this user
 *  (any status)? */
export async function liveFinalAttemptExists(
  tx: DbTx,
  courseId: string,
  userId: string,
): Promise<boolean> {
  const rows = await tx
    .select({ id: quizAttempts.id })
    .from(quizAttempts)
    .innerJoin(courses, eq(courses.finalQuizId, quizAttempts.quizId))
    .where(
      and(
        eq(courses.id, courseId),
        eq(quizAttempts.userId, userId),
        sql`${quizAttempts.resetAt} is null`,
      ),
    )
    .limit(1);
  return rows.length === 1;
}

/** Decision 2's attempt write: reset_* filled; status from the locked row
 *  (IN_PROGRESS → EXPIRED, the caller computes it). Typed columns only. */
export async function markAttemptReset(
  tx: DbTx,
  input: {
    attemptId: string;
    status: AttemptStatus;
    resetBy: string;
    resetReason: string;
    resetAt: Date;
  },
): Promise<void> {
  await tx
    .update(quizAttempts)
    .set({
      status: input.status,
      resetBy: input.resetBy,
      resetReason: input.resetReason,
      resetAt: input.resetAt,
    })
    .where(eq(quizAttempts.id, input.attemptId));
}

/** Close a report with a decision (both CHECKs satisfied by construction). */
export async function markReportDecided(
  tx: DbTx,
  input: {
    reportId: string;
    status: "APPROVED" | "REJECTED";
    decisionReason: string;
    internalNote: string | null;
    decidedBy: string;
    decidedAt: Date;
  },
): Promise<void> {
  await tx
    .update(quizAttemptReports)
    .set({
      status: input.status,
      decisionReason: input.decisionReason,
      internalNote: input.internalNote,
      decidedBy: input.decidedBy,
      decidedAt: input.decidedAt,
    })
    .where(eq(quizAttemptReports.id, input.reportId));
}

/** One audit row inside the transaction (course-module pattern). */
export async function insertAuditLog(
  tx: DbTx,
  input: {
    actorId: string;
    action: "attempt.reset" | "attempt_report.reject";
    entityType: "quiz_attempt" | "quiz_attempt_report";
    entityId: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    ip: null,
  });
}

// ------------------------------------------------------------ manual (26c)

/** Exact email, not soft-deleted (decision 8). */
export async function selectUserByEmail(
  email: string,
): Promise<{ id: string; name: string; email: string } | undefined> {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.email, email), sql`${users.deletedAt} is null`))
    .limit(1);
  return rows[0];
}

/** Every attempt of the user (live AND reset) with its quiz context. */
export async function selectUserAttempts(
  userId: string,
): Promise<ManualAttemptRow[]> {
  const rows = await db
    .select({
      ...contextColumns,
      quizId: quizAttempts.quizId,
      courseId: sql<string>`coalesce(lc.id, fc.id)`,
      resetAt: quizAttempts.resetAt,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
    .leftJoin(lessons, eq(lessons.quizId, quizzes.id))
    .leftJoin(lessonCourse, eq(lessonCourse.id, lessons.courseId))
    .leftJoin(finalCourse, eq(finalCourse.finalQuizId, quizzes.id))
    .where(eq(quizAttempts.userId, userId))
    .orderBy(asc(quizAttempts.quizId), desc(quizAttempts.attemptNumber));
  return rows as ManualAttemptRow[];
}

/** The user's PENDING reports, keyed by attempt. */
export async function selectPendingReportsOfUser(
  userId: string,
): Promise<{ attemptId: string; number: number }[]> {
  return db
    .select({
      attemptId: quizAttemptReports.attemptId,
      number: quizAttemptReports.number,
    })
    .from(quizAttemptReports)
    .where(
      and(
        eq(quizAttemptReports.userId, userId),
        eq(quizAttemptReports.status, "PENDING"),
      ),
    );
}
