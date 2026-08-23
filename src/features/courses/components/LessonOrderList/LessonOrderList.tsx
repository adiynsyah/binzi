"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge/Badge";

import type { BuilderLesson } from "../../queries/getCourseLessons";

import styles from "./LessonOrderList.module.scss";

/**
 * Orderable lesson list for the Course Builder (TASK 026, CMS Spec §7
 * "Lesson ordering should use drag-and-drop", Blueprint §24 "drag/drop
 * + accessible move up/down fallback"; deletion added by TASK 027).
 *
 * TASK 028: each lesson title links to the Lesson Editor
 * (/admin/courses/[courseId]/lessons/[lessonId]) so Content can be
 * assigned from the Builder.
 *
 * Ways to act on a lesson, each persisting through its own server
 * action (both bound to the course id by the server panel — the
 * course binding is never client input):
 *
 * 1. Native HTML5 drag-and-drop (no library, per the zero-dependency
 *    guardrail; Blueprint §5 permits one maintained library but does
 *    not require one). Pointer-only by nature.
 * 2. "Naik"/"Turun" buttons — the accessible, keyboard-usable fallback
 *    required by the Task Plan. Each button is a plain <form> posting
 *    the minimal reorder contract (lessonId + targetPosition), so it
 *    ALSO works without JavaScript (MPA post → redirect back to the
 *    builder); with JavaScript the submit is intercepted for an
 *    optimistic reorder before the action runs.
 * 3. "Hapus" button (TASK 027): a sibling plain <form> posting only
 *    lessonId to deleteLessonAction. Only DRAFT lessons offer a live
 *    button — a PUBLISHED lesson in a DRAFT course renders the button
 *    disabled with an explanatory note (CMS §32), because BR §3.4/§28
 *    forbid deleting published lessons. With JavaScript the submit is
 *    gated by a native confirmation dialog (CMS §33: "This action
 *    cannot be undone"); without JavaScript the form posts directly
 *    and the server-side rules remain mandatory either way.
 *
 * Drop semantics: dropping a lesson onto row T moves it to T's
 * current 1-based position (remove + insert), which the server
 * recomputes authoritatively. The optimistic local state is replaced
 * by fresh server data after the action's redirect revalidates the
 * builder page.
 *
 * The three per-row forms are SIBLINGS inside the row (never nested
 * — nested <form> is invalid HTML). Rendering stays text-only (no
 * dangerouslySetInnerHTML). This component never touches the
 * database — it only calls the actions.
 */

const STATUS_LABELS: Record<BuilderLesson["status"], string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
};

type MoveAction = (formData: FormData) => Promise<void>;

export function LessonOrderList({
  lessons,
  courseId,
  action,
  deleteAction,
}: {
  /** Persisted order (BR §3.2), passed by the server panel. */
  lessons: BuilderLesson[];
  /** Route context for the per-lesson editor links (TASK 028). */
  courseId: string;
  /** reorderLessonAction bound to the course id. */
  action: MoveAction;
  /** deleteLessonAction bound to the course id (TASK 027). */
  deleteAction: MoveAction;
}) {
  const [order, setOrder] = useState(lessons);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Fresh server data (a new array arrives after the action's redirect
  // revalidates the builder) wins over any optimistic local state —
  // the render-time adjustment pattern instead of an effect.
  const [syncedFrom, setSyncedFrom] = useState(lessons);
  if (syncedFrom !== lessons) {
    setSyncedFrom(lessons);
    setOrder(lessons);
  }

  function submitMove(lessonId: string, targetPosition: number) {
    // Optimistic: remove + insert at the target position.
    setOrder((current) => {
      const next = [...current];
      const from = next.findIndex((lesson) => lesson.id === lessonId);
      if (from === -1) return current;
      const clamped = Math.min(Math.max(targetPosition - 1, 0), next.length - 1);
      const [moved] = next.splice(from, 1);
      next.splice(clamped, 0, moved);
      return next;
    });
    startTransition(async () => {
      const formData = new FormData();
      formData.set("lessonId", lessonId);
      formData.set("targetPosition", String(targetPosition));
      await action(formData);
    });
  }

  function submitDelete(lessonId: string) {
    // No optimistic removal: deletion is destructive, so the persisted
    // server state after the action's redirect is the only truth.
    const formData = new FormData();
    formData.set("lessonId", lessonId);
    startTransition(async () => {
      await deleteAction(formData);
    });
  }

  return (
    <>
      <ol className={styles.lessonList}>
      {order.map((lesson, index) => {
        const isFirst = index === 0;
        const isLast = index === order.length - 1;
        const isDragging = draggingId === lesson.id;
        const isOver = overId === lesson.id && draggingId !== null && !isDragging;

        return (
          <li
            key={lesson.id}
            className={
              isDragging
                ? styles.lessonDragging
                : isOver
                  ? styles.lessonDropTarget
                  : styles.lessonItem
            }
            draggable
            onDragStart={(event) => {
              setDraggingId(lesson.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", lesson.id);
            }}
            onDragOver={(event) => {
              if (draggingId !== null && draggingId !== lesson.id) {
                event.preventDefault();
                setOverId(lesson.id);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setOverId(null);
              const sourceId = draggingId ?? event.dataTransfer.getData("text/plain");
              if (!sourceId || sourceId === lesson.id) {
                setDraggingId(null);
                return;
              }
              // Dropping onto this row = taking its current position.
              submitMove(sourceId, index + 1);
              setDraggingId(null);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setOverId(null);
            }}
          >
            <span className={styles.dragHandle} aria-hidden="true">
              ≡
            </span>
            <Link
              className={styles.lessonTitle}
              href={`/admin/courses/${courseId}/lessons/${lesson.id}`}
            >
              {lesson.title}
            </Link>
            <Badge
              tone={lesson.status === "PUBLISHED" ? "success" : "warning"}
            >
              {STATUS_LABELS[lesson.status]}
            </Badge>
            <div className={styles.moveControls}>
              <form
                action={action}
                onSubmit={(event) => {
                  event.preventDefault();
                  submitMove(lesson.id, index);
                }}
              >
                <input type="hidden" name="lessonId" value={lesson.id} />
                <input type="hidden" name="targetPosition" value={index} />
                <button
                  type="submit"
                  className={styles.moveButton}
                  disabled={isFirst || isPending}
                  aria-label={`Pindahkan pelajaran ${lesson.title} ke atas`}
                >
                  Naik
                </button>
              </form>
              <form
                action={action}
                onSubmit={(event) => {
                  event.preventDefault();
                  submitMove(lesson.id, index + 2);
                }}
              >
                <input type="hidden" name="lessonId" value={lesson.id} />
                <input type="hidden" name="targetPosition" value={index + 2} />
                <button
                  type="submit"
                  className={styles.moveButton}
                  disabled={isLast || isPending}
                  aria-label={`Pindahkan pelajaran ${lesson.title} ke bawah`}
                >
                  Turun
                </button>
              </form>
              {/* TASK 027: sibling form (never nested) — DRAFT-only
                  deletion, confirmed via native dialog (CMS §33). */}
              <form
                action={deleteAction}
                onSubmit={(event) => {
                  event.preventDefault();
                  const confirmed = window.confirm(
                    `Hapus pelajaran draf "${lesson.title}"? Tindakan ini tidak dapat dibatalkan.`,
                  );
                  if (confirmed) {
                    submitDelete(lesson.id);
                  }
                }}
              >
                <input type="hidden" name="lessonId" value={lesson.id} />
                <button
                  type="submit"
                  className={styles.deleteButton}
                  disabled={lesson.status === "PUBLISHED" || isPending}
                  aria-label={`Hapus pelajaran ${lesson.title}`}
                >
                  Hapus
                </button>
              </form>
            </div>
          </li>
        );
      })}
      </ol>
      {order.some((lesson) => lesson.status === "PUBLISHED") ? (
        <p className={styles.publishedNote}>
          Pelajaran yang sudah terbit tidak dapat dihapus (BR §3.4);
          tombol Hapus nonaktif untuk pelajaran terbit.
        </p>
      ) : null}
    </>
  );
}
