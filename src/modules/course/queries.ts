// Database access for the course domain (card S1-01).
//
// NEVER import this from another module — go through service.ts. The
// no-restricted-imports rule in eslint.config.mjs enforces it.
//
// Every query selects an explicit column allowlist (never select *).
// createCourseWithFinalQuiz owns ONE transaction that writes the course,
// its empty FINAL quiz (via @/modules/quiz/service — the module's public
// door, called with this transaction's handle), and the audit row.
import "server-only";

import { isDeepStrictEqual } from "node:util";
import {
  aliasedTable,
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  courses,
  lessons,
  questions,
  quizzes,
  users,
} from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { isDocEmpty, type ContentDoc } from "@/lib/content-doc";
import { listLessonChecklistRows } from "@/modules/lesson/service";
import {
  createEmptyFinalQuiz,
  findQuestionRuleViolations,
  formatQuizRuleViolation,
  type DbTx,
  type LabeledQuiz,
} from "@/modules/quiz/service";

import { isUniqueViolation } from "./db-errors";
import {
  CHECKLIST_INCOMPLETE_MESSAGE,
  courseFieldError,
  NOT_DRAFT_MESSAGE,
  NOT_DRAFT_SUBMIT_MESSAGE,
  NOT_IN_REVIEW_MESSAGE,
  REVIEWER_MISSING_MESSAGE,
  SIMILAR_TITLE_MESSAGE,
  SLUG_TAKEN_MESSAGE,
} from "./errors";
import { evaluatePublishChecklist, publishChecklistInputFrom } from "./checklist";

import {
  descriptionAuditSummary,
  toCmsCourseBuilderDTO,
  toCmsCourseDetailDTO,
  toCourseApprovalQueueItemDTO,
  toCourseDescriptionEditorDTO,
  toUpdatedCourseDescriptionDTO,
  type CourseApprovalQueueItemDTO,
  type CourseBuilderRow,
  type CourseDescriptionEditorDTO,
  type UpdatedCourseDescriptionDTO,
} from "./serializer";
import type {
  CourseListItemRow,
  CourseDetailRow,
  CourseStatusCounts,
} from "./serializer";
import type {
  ContentStatus,
  CreateCourseInput,
  UpdateCourseInput,
} from "./schema";

// Subquery aggregates (no N+1): correlated counts resolved inside the one
// SELECT. mapWith(Number) — drivers hand back bigint counts as strings.
const lessonCountSql = sql<number>`(
  select count(*) from ${lessons} where ${lessons.courseId} = ${courses.id}
)`.mapWith(Number);

const finalQuizQuestionCountSql = sql<number>`(
  select count(*) from ${questions}
  where ${questions.quizId} = ${courses.finalQuizId}
)`.mapWith(Number);

// 21a "n soal · d menit · …": the FINAL quiz's duration rides the same
// single SELECT.
const finalQuizDurationSql = sql<number | null>`(
  select ${quizzes.durationMinutes} from ${quizzes}
  where ${quizzes.id} = ${courses.finalQuizId}
)`;

const ownerColumns = {
  ownerName: users.name,
  ownerEmail: users.email,
};

// The approval-queue's reviewer join (card S1-08 §6): users joined AGAIN
// under an alias (drizzle 0.45 exposes aliasedTable, not alias) — the
// owner join above already occupies the table.
const reviewer = aliasedTable(users, "reviewer");

// PG LIKE treats backslash as the escape character by default, so % and _
// typed by the user must be escaped to keep them literal.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** CMS list (21e), default sort "terakhir diubah". */
export async function listCourses(filter: {
  status?: ContentStatus;
  q?: string;
}): Promise<CourseListItemRow[]> {
  const conditions: SQL[] = [];
  if (filter.status !== undefined) {
    conditions.push(eq(courses.status, filter.status));
  }
  if (filter.q !== undefined) {
    conditions.push(ilike(courses.title, `%${escapeLike(filter.q)}%`));
  }

  return db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      level: courses.level,
      status: courses.status,
      enrollmentCount: courses.enrollmentCount,
      updatedAt: courses.updatedAt,
      ...ownerColumns,
      lessonCount: lessonCountSql,
      finalQuizQuestionCount: finalQuizQuestionCountSql,
    })
    .from(courses)
    .innerJoin(users, eq(courses.createdBy, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(courses.updatedAt), desc(courses.id));
}

/** Totals per status across ALL courses — never affected by the filter. */
export async function countCoursesByStatus(): Promise<CourseStatusCounts> {
  const rows = await db
    .select({ status: courses.status, value: count().mapWith(Number) })
    .from(courses)
    .groupBy(courses.status);

  const counts: CourseStatusCounts = {
    total: 0,
    DRAFT: 0,
    IN_REVIEW: 0,
    PUBLISHED: 0,
    ARCHIVED: 0,
  };
  for (const row of rows) {
    counts[row.status] = row.value;
    counts.total += row.value;
  }
  return counts;
}

/** Builder lookup (21g). */
export async function findCourseById(
  courseId: string,
): Promise<CourseDetailRow | undefined> {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      summary: courses.summary,
      description: courses.description,
      thumbnailUrl: courses.thumbnailUrl,
      level: courses.level,
      status: courses.status,
      estimatedMinutes: courses.estimatedMinutes,
      publishedAt: courses.publishedAt,
      finalQuizId: courses.finalQuizId,
      enrollmentCount: courses.enrollmentCount,
      updatedAt: courses.updatedAt,
      ...ownerColumns,
      finalQuizQuestionCount: finalQuizQuestionCountSql,
    })
    .from(courses)
    .innerJoin(users, eq(courses.createdBy, users.id))
    .where(eq(courses.id, courseId))
    .limit(1);
  return rows[0];
}

/** Duplicate-slug pre-check (the unique index remains the last line of
 *  defense for concurrent requests — see createCourseWithFinalQuiz). */
export async function slugExists(slug: string): Promise<boolean> {
  const rows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);
  return rows.length > 0;
}

/** Titles of ALL courses, any status (the similar-title rule compares
 *  against ARCHIVED courses too — card S1-01). */
export async function listCourseTitles(): Promise<
  { id: string; title: string }[]
> {
  return db.select({ id: courses.id, title: courses.title }).from(courses);
}

/**
 * Create course + empty FINAL quiz + audit row in ONE transaction.
 *
 * The unique violation on courses.slug (two concurrent requests that both
 * pass the service pre-check) is mapped here to the same field error the
 * pre-check produces; any OTHER 23505 is rethrown untouched.
 */
export async function createCourseWithFinalQuiz(
  input: CreateCourseInput,
  actorId: string,
): Promise<ReturnType<typeof toCmsCourseDetailDTO>> {
  return db.transaction(async (tx) => {
    const quiz = await createEmptyFinalQuiz(tx);

    let courseRows;
    try {
      courseRows = await tx
        .insert(courses)
        .values({
          title: input.title,
          slug: input.slug,
          summary: input.summary,
          level: input.level,
          status: "DRAFT",
          finalQuizId: quiz.id,
          createdBy: actorId,
          updatedBy: actorId,
        })
        // Explicit column list (src/modules/README.md): exactly what
        // CourseDetailRow consumes, never the whole table.
        .returning({
          id: courses.id,
          title: courses.title,
          slug: courses.slug,
          summary: courses.summary,
          description: courses.description,
          thumbnailUrl: courses.thumbnailUrl,
          level: courses.level,
          status: courses.status,
          estimatedMinutes: courses.estimatedMinutes,
          publishedAt: courses.publishedAt,
          finalQuizId: courses.finalQuizId,
          enrollmentCount: courses.enrollmentCount,
          updatedAt: courses.updatedAt,
        });
    } catch (error) {
      if (isUniqueViolation(error, "courses_slug_unique")) {
        throw courseFieldError("slug", SLUG_TAKEN_MESSAGE(input.slug));
      }
      throw error;
    }
    const course = courseRows[0];
    if (!course) {
      throw new Error("createCourseWithFinalQuiz: insert returned no row");
    }

    const [owner] = await tx
      .select(ownerColumns)
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1);

    const dto = toCmsCourseDetailDTO({
      ...course,
      ownerName: owner?.ownerName ?? "",
      ownerEmail: owner?.ownerEmail ?? "",
      finalQuizQuestionCount: 0,
    });

    await tx.insert(auditLogs).values({
      actorId,
      action: "course.create",
      entityType: "course",
      entityId: course.id,
      before: null,
      // The serialized DTO, not the raw row (CMS-12: after = what the API
      // would answer).
      after: dto,
      // Stays null in this card (card S1-01).
      ip: null,
    });

    return dto;
  });
}

// ------------------------------------------------- builder & update (S1-02)

/** Lowercase + collapsed spaces — the similar-title comparison form (21f). */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Is one normalized title a prefix of the other (equal counts too)? */
export function isSimilarTitle(candidate: string, existing: string): boolean {
  return existing.startsWith(candidate) || candidate.startsWith(existing);
}

/** Builder lookup (21a/21g): the settings audience's column set + reviewer
 * (card S1-08 §3 — an UNLOCKED read, so the reviewer left join is fine
 * here; the submit/publish lock statements carry courses columns only). */
export async function findCourseBuilderById(
  courseId: string,
): Promise<
  | (CourseBuilderRow & {
      reviewerId: string | null;
      reviewerName: string | null;
      reviewerEmail: string | null;
      reviewedAt: Date | null;
    })
  | undefined
> {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      summary: courses.summary,
      description: courses.description,
      level: courses.level,
      status: courses.status,
      isSequential: courses.isSequential,
      updatedAt: courses.updatedAt,
      finalQuizId: courses.finalQuizId,
      ...ownerColumns,
      finalQuizQuestionCount: finalQuizQuestionCountSql,
      finalQuizDurationMinutes: finalQuizDurationSql,
      reviewerId: courses.reviewerId,
      reviewedAt: courses.reviewedAt,
      reviewerName: reviewer.name,
      reviewerEmail: reviewer.email,
    })
    .from(courses)
    .innerJoin(users, eq(courses.createdBy, users.id))
    .leftJoin(reviewer, eq(courses.reviewerId, reviewer.id))
    .where(eq(courses.id, courseId))
    .limit(1);
  return rows[0];
}

export type UpdateCourseResult = {
  dto: ReturnType<typeof toCmsCourseBuilderDTO>;
  /** false = nothing changed: no write, no audit (card §2 step 4). */
  changed: boolean;
};

/**
 * Update the builder settings of a DRAFT course in ONE transaction (card
 * S1-02 §2). Order inside the lock:
 *   1. SELECT … FOR UPDATE (unknown id → 404; status ≠ DRAFT → 409);
 *   2. field errors in FORM order — similar title against OTHER courses
 *      first, then slug taken by OTHER courses (the unique-violation catch
 *      below maps the race to the same slug error);
 *   3. no actual change → current DTO back, no write, no audit;
 *   4. change → update + updated_by + ONE audit row with the before/after
 *      builder DTOs.
 *
 * The similar-title and slug checks only run when that field actually
 * changed: an untouched title is always "similar" to itself under the
 * prefix rule, and that must never block saving the level or summary
 * (review addition 4).
 */
export async function updateCourseIfDraft(input: {
  courseId: string;
  values: UpdateCourseInput;
  actorId: string;
}): Promise<UpdateCourseResult> {
  return db.transaction(async (tx) => {
    const lockedRows = await tx
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        summary: courses.summary,
        description: courses.description,
        level: courses.level,
        status: courses.status,
        isSequential: courses.isSequential,
        updatedAt: courses.updatedAt,
        finalQuizId: courses.finalQuizId,
        ...ownerColumns,
        finalQuizQuestionCount: finalQuizQuestionCountSql,
        finalQuizDurationMinutes: finalQuizDurationSql,
      })
      .from(courses)
      .innerJoin(users, eq(courses.createdBy, users.id))
      .where(eq(courses.id, input.courseId))
      .limit(1)
      // Lock ONLY the courses row: without `of`, FOR UPDATE also locks the
      // joined users row, stalling unrelated inserts that FK to that user
      // (sessions, audit_logs) for the whole transaction.
      .for("update", { of: courses });
    const current = lockedRows[0];
    if (!current) {
      throw new NotFoundError("Kursus tidak ditemukan");
    }
    if (current.status !== "DRAFT") {
      throw new ConflictError(NOT_DRAFT_MESSAGE);
    }

    const values = input.values;
    const titleChanged =
      normalizeTitle(values.title) !== normalizeTitle(current.title);
    if (titleChanged) {
      const similar = (
        await tx
          .select({ id: courses.id, title: courses.title })
          .from(courses)
          .where(ne(courses.id, input.courseId))
      ).find((course) =>
        isSimilarTitle(normalizeTitle(values.title), normalizeTitle(course.title)),
      );
      if (similar) {
        throw courseFieldError("title", SIMILAR_TITLE_MESSAGE(similar.title));
      }
    }

    if (values.slug !== current.slug) {
      const clash = await tx
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.slug, values.slug), ne(courses.id, input.courseId)))
        .limit(1);
      if (clash.length > 0) {
        throw courseFieldError("slug", SLUG_TAKEN_MESSAGE(values.slug));
      }
    }

    const before = toCmsCourseBuilderDTO(current);

    const changed =
      values.title !== current.title ||
      values.slug !== current.slug ||
      values.summary !== current.summary ||
      values.level !== current.level ||
      values.isSequential !== current.isSequential;
    if (!changed) {
      return { dto: before, changed: false };
    }

    let updatedRows;
    try {
      updatedRows = await tx
        .update(courses)
        .set({
          title: values.title,
          slug: values.slug,
          summary: values.summary,
          level: values.level,
          isSequential: values.isSequential,
          updatedBy: input.actorId,
        })
        .where(eq(courses.id, input.courseId))
        .returning({
          id: courses.id,
          title: courses.title,
          slug: courses.slug,
          summary: courses.summary,
          description: courses.description,
          level: courses.level,
          status: courses.status,
          isSequential: courses.isSequential,
          updatedAt: courses.updatedAt,
          finalQuizId: courses.finalQuizId,
        });
    } catch (error) {
      if (isUniqueViolation(error, "courses_slug_unique")) {
        throw courseFieldError("slug", SLUG_TAKEN_MESSAGE(values.slug));
      }
      throw error;
    }
    const updated = updatedRows[0];
    if (!updated) {
      throw new Error("updateCourseIfDraft: update returned no row");
    }

    const after = toCmsCourseBuilderDTO({
      ...updated,
      ownerName: current.ownerName,
      ownerEmail: current.ownerEmail,
      finalQuizQuestionCount: current.finalQuizQuestionCount,
      finalQuizDurationMinutes: current.finalQuizDurationMinutes,
    });

    await tx.insert(auditLogs).values({
      actorId: input.actorId,
      action: "course.update",
      entityType: "course",
      entityId: updated.id,
      // Builder DTOs on both sides (review addition 2a) — no TipTap
      // document in the audit trail.
      before,
      after,
      ip: null,
    });

    return { dto: after, changed: true };
  });
}

// ------------------------------------------------- description (card S1-04)

/**
 * Save the description of a DRAFT course in ONE transaction (card S1-04
 * §3). Steps inside the lock:
 *   1. SELECT … FOR UPDATE the course row → 404 / 409 NOT_DRAFT;
 *   2. no change → current DTO back, no write, no audit. The compare is
 *      deep-structural (jsonb re-orders keys) and a stored null is never
 *      deep-equal to any document, so a first save from "belum diisi"
 *      always writes;
 *   3. change → description = the VALIDATOR-REBUILT document (never the
 *      raw input) + updated_by + ONE audit row with { isDescriptionEmpty }
 *      summaries only.
 */
export async function updateCourseDescriptionIfDraft(input: {
  courseId: string;
  values: { description: ContentDoc };
  actorId: string;
}): Promise<{ dto: UpdatedCourseDescriptionDTO; changed: boolean }> {
  return db.transaction(async (tx) => {
    const lockedRows = await tx
      .select({
        id: courses.id,
        description: courses.description,
        status: courses.status,
        updatedAt: courses.updatedAt,
      })
      .from(courses)
      .where(eq(courses.id, input.courseId))
      .limit(1)
      .for("update");
    const current = lockedRows[0];
    if (!current) {
      throw new NotFoundError("Kursus tidak ditemukan");
    }
    if (current.status !== "DRAFT") {
      throw new ConflictError(NOT_DRAFT_MESSAGE);
    }

    if (isDeepStrictEqual(current.description, input.values.description)) {
      return {
        dto: toUpdatedCourseDescriptionDTO(current),
        changed: false,
      };
    }

    const before = descriptionAuditSummary(current.description);
    const updatedRows = await tx
      .update(courses)
      .set({
        description: input.values.description,
        updatedBy: input.actorId,
      })
      .where(eq(courses.id, input.courseId))
      .returning({
        id: courses.id,
        description: courses.description,
        updatedAt: courses.updatedAt,
      });
    const updated = updatedRows[0];
    if (!updated) {
      throw new Error("updateCourseDescriptionIfDraft: update returned no row");
    }

    await tx.insert(auditLogs).values({
      actorId: input.actorId,
      action: "course.update_description",
      entityType: "course",
      entityId: updated.id,
      // { isDescriptionEmpty } only — no TipTap document in the audit
      // trail (review rule 2a).
      before,
      after: descriptionAuditSummary(updated.description),
      ip: null,
    });

    return {
      dto: toUpdatedCourseDescriptionDTO(updated),
      changed: true,
    };
  });
}

/** The description editor page's lookup (card S1-04 §6). */
export async function findCourseDescriptionEditorById(
  courseId: string,
): Promise<CourseDescriptionEditorDTO | undefined> {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      description: courses.description,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return toCourseDescriptionEditorDTO(row);
}

// ------------------------------------------- submit & publish (card S1-08)

/**
 * What the submit/publish lock reads (card S1-08 §1–2, owner review
 * addition 1): courses columns + the owner join for the 200 DTO — and
 * NOTHING else. Count subqueries and lesson rows live in SEPARATE
 * statements issued AFTER the lock: under READ COMMITTED a subquery in a
 * lock-waiting statement evaluates on the statement's pre-wait snapshot,
 * so it can miss a 10th question another tab committed while we waited.
 * The reviewer is NOT joined here — reviewer_name is only needed by the
 * page's unlocked lookup (findCourseBuilderById).
 */
type ReviewLockedRow = Pick<
  typeof courses.$inferSelect,
  | "id"
  | "title"
  | "slug"
  | "summary"
  | "description"
  | "level"
  | "status"
  | "isSequential"
  | "updatedAt"
  | "finalQuizId"
  | "reviewerId"
  | "reviewedAt"
> & {
  ownerName: string;
  ownerEmail: string;
};

async function lockCourseForReview(
  tx: DbTx,
  courseId: string,
): Promise<ReviewLockedRow | undefined> {
  const rows = await tx
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      summary: courses.summary,
      description: courses.description,
      level: courses.level,
      status: courses.status,
      isSequential: courses.isSequential,
      updatedAt: courses.updatedAt,
      finalQuizId: courses.finalQuizId,
      reviewerId: courses.reviewerId,
      reviewedAt: courses.reviewedAt,
      ...ownerColumns,
    })
    .from(courses)
    .innerJoin(users, eq(courses.createdBy, users.id))
    .where(eq(courses.id, courseId))
    .limit(1)
    // Same discipline as updateCourseIfDraft: lock ONLY the courses row.
    .for("update", { of: courses });
  return rows[0];
}

/**
 * The publish gate's POST-LOCK reads (card §1 step 1–2): Final Quiz count +
 * duration and the lesson checklist rows, each its own statement inside
 * the same transaction — everything the checklist input and the 200 DTO
 * need, read fresh.
 */
async function readGateInputs(
  tx: DbTx,
  courseId: string,
  finalQuizId: string | null,
): Promise<{
  lessonRows: Awaited<ReturnType<typeof listLessonChecklistRows>>;
  finalQuizQuestionCount: number;
  finalQuizDurationMinutes: number | null;
}> {
  let finalQuizQuestionCount = 0;
  let finalQuizDurationMinutes: number | null = null;
  if (finalQuizId !== null) {
    const durationRows = await tx
      .select({ durationMinutes: quizzes.durationMinutes })
      .from(quizzes)
      .where(eq(quizzes.id, finalQuizId))
      .limit(1);
    finalQuizDurationMinutes = durationRows[0]?.durationMinutes ?? null;
    const countRows = await tx
      .select({ value: count().mapWith(Number) })
      .from(questions)
      .where(eq(questions.quizId, finalQuizId));
    finalQuizQuestionCount = countRows[0]?.value ?? 0;
  }
  const lessonRows = await listLessonChecklistRows(tx, courseId);
  return { lessonRows, finalQuizQuestionCount, finalQuizDurationMinutes };
}

/**
 * The shared gate (card §1), run INSIDE the caller's transaction after the
 * lock: checklist first, then the question rules — first failure throws
 * 409. minQuestions was read BEFORE the transaction by the service
 * (fail-closed 500, exactly like the builder).
 */
async function assertPublishGate(
  tx: DbTx,
  courseId: string,
  course: ReviewLockedRow,
  minQuestions: number,
): Promise<Awaited<ReturnType<typeof readGateInputs>>> {
  const inputs = await readGateInputs(tx, courseId, course.finalQuizId);

  // Same input builder as getCourseBuilder (owner review addition 2) —
  // builder and gate can never disagree.
  const checklist = evaluatePublishChecklist(
    publishChecklistInputFrom(
      {
        title: course.title,
        level: course.level,
        summary: course.summary,
        slug: course.slug,
        isDescriptionEmpty: isDocEmpty(course.description),
        lessons: inputs.lessonRows.map((row) => ({
          orderIndex: row.orderIndex,
          isContentEmpty: row.isContentEmpty,
          quizQuestionCount: row.quizQuestionCount,
        })),
        finalQuizQuestionCount: inputs.finalQuizQuestionCount,
      },
      minQuestions,
    ),
  );
  if (checklist.met < checklist.total) {
    throw new ConflictError(CHECKLIST_INCOMPLETE_MESSAGE);
  }

  // Rule pass, PRD §11.4 no. 12: lesson quizzes in order_index order,
  // then the Final Quiz (card §1 step 2).
  const labeledQuizzes: LabeledQuiz[] = [
    ...inputs.lessonRows.flatMap((row) =>
      row.quizId === null
        ? []
        : [{ quizId: row.quizId, label: `Quiz materi ${row.orderIndex}` }],
    ),
    ...(course.finalQuizId === null
      ? []
      : [{ quizId: course.finalQuizId, label: "Final Quiz" }]),
  ];
  const violations = await findQuestionRuleViolations(tx, labeledQuizzes);
  const first = violations[0];
  if (first !== undefined) {
    throw new ConflictError(formatQuizRuleViolation(first));
  }

  return inputs;
}

/**
 * Kirim (card §2): ONE transaction — lock → 404/409 → gate → update to
 * IN_REVIEW with reviewer = sender → ONE summary-only audit row → the
 * builder DTO built from the locked row + fresh post-lock counts.
 */
export async function submitCourseTx(input: {
  courseId: string;
  actorId: string;
  minQuestions: number;
}): Promise<ReturnType<typeof toCmsCourseBuilderDTO>> {
  return db.transaction(async (tx) => {
    const locked = await lockCourseForReview(tx, input.courseId);
    if (!locked) {
      throw new NotFoundError("Kursus tidak ditemukan");
    }
    if (locked.status !== "DRAFT") {
      throw new ConflictError(NOT_DRAFT_SUBMIT_MESSAGE);
    }

    const gate = await assertPublishGate(
      tx,
      input.courseId,
      locked,
      input.minQuestions,
    );

    const updatedRows = await tx
      .update(courses)
      .set({
        status: "IN_REVIEW",
        reviewerId: input.actorId,
        reviewedAt: new Date(),
        updatedBy: input.actorId,
      })
      .where(eq(courses.id, input.courseId))
      .returning({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        summary: courses.summary,
        description: courses.description,
        level: courses.level,
        status: courses.status,
        isSequential: courses.isSequential,
        updatedAt: courses.updatedAt,
        finalQuizId: courses.finalQuizId,
        reviewerId: courses.reviewerId,
        reviewedAt: courses.reviewedAt,
      });
    const updated = updatedRows[0];
    if (!updated) {
      throw new Error("submitCourseTx: update returned no row");
    }

    // Summary only (card §2 step 5) — before { status }, after
    // { status, reviewerId, reviewedAt }, no documents.
    await tx.insert(auditLogs).values({
      actorId: input.actorId,
      action: "course.submit",
      entityType: "course",
      entityId: updated.id,
      before: { status: locked.status },
      after: {
        status: updated.status,
        reviewerId: updated.reviewerId,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      },
      ip: null,
    });

    return toCmsCourseBuilderDTO({
      ...updated,
      ownerName: locked.ownerName,
      ownerEmail: locked.ownerEmail,
      finalQuizQuestionCount: gate.finalQuizQuestionCount,
      finalQuizDurationMinutes: gate.finalQuizDurationMinutes,
    });
  });
}

/**
 * Terbitkan (card §2): lock → 404 / 409 (not IN_REVIEW, reviewer missing)
 * → the gate AGAIN (settings or data may have moved since submit) →
 * update to PUBLISHED (reviewer untouched) → audit → builder DTO.
 */
export async function publishCourseTx(input: {
  courseId: string;
  actorId: string;
  minQuestions: number;
}): Promise<ReturnType<typeof toCmsCourseBuilderDTO>> {
  return db.transaction(async (tx) => {
    const locked = await lockCourseForReview(tx, input.courseId);
    if (!locked) {
      throw new NotFoundError("Kursus tidak ditemukan");
    }
    if (locked.status !== "IN_REVIEW") {
      throw new ConflictError(NOT_IN_REVIEW_MESSAGE);
    }
    if (locked.reviewerId === null) {
      throw new ConflictError(REVIEWER_MISSING_MESSAGE);
    }

    const gate = await assertPublishGate(
      tx,
      input.courseId,
      locked,
      input.minQuestions,
    );

    const updatedRows = await tx
      .update(courses)
      .set({
        status: "PUBLISHED",
        publishedAt: new Date(),
        updatedBy: input.actorId,
      })
      .where(eq(courses.id, input.courseId))
      .returning({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        summary: courses.summary,
        description: courses.description,
        level: courses.level,
        status: courses.status,
        isSequential: courses.isSequential,
        updatedAt: courses.updatedAt,
        finalQuizId: courses.finalQuizId,
        reviewerId: courses.reviewerId,
        reviewedAt: courses.reviewedAt,
        publishedAt: courses.publishedAt,
      });
    const updated = updatedRows[0];
    if (!updated) {
      throw new Error("publishCourseTx: update returned no row");
    }

    // Summary only (card §2 step 6): before { status }, after
    // { status, publishedAt } (owner review addition 12).
    await tx.insert(auditLogs).values({
      actorId: input.actorId,
      action: "course.publish",
      entityType: "course",
      entityId: updated.id,
      before: { status: locked.status },
      after: {
        status: updated.status,
        publishedAt: updated.publishedAt?.toISOString() ?? null,
      },
      ip: null,
    });

    return toCmsCourseBuilderDTO({
      ...updated,
      ownerName: locked.ownerName,
      ownerEmail: locked.ownerEmail,
      finalQuizQuestionCount: gate.finalQuizQuestionCount,
      finalQuizDurationMinutes: gate.finalQuizDurationMinutes,
    });
  });
}

/**
 * The approval queue (card §6): IN_REVIEW courses, oldest reviewed_at
 * first (ASC puts the NULL rows of legacy data last). ADMIN+ passes no
 * reviewer filter; an EDITOR only sees courses they sent themselves.
 */
export async function listApprovalQueue(filter: {
  reviewerId?: string;
}): Promise<CourseApprovalQueueItemDTO[]> {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      reviewerName: reviewer.name,
      reviewerEmail: reviewer.email,
      reviewedAt: courses.reviewedAt,
    })
    .from(courses)
    .leftJoin(reviewer, eq(courses.reviewerId, reviewer.id))
    .where(
      and(
        eq(courses.status, "IN_REVIEW"),
        filter.reviewerId === undefined
          ? undefined
          : eq(courses.reviewerId, filter.reviewerId),
      ),
    )
    .orderBy(asc(courses.reviewedAt), asc(courses.id));
  return rows.map(toCourseApprovalQueueItemDTO);
}
