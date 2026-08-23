"use client";

import { useState, useTransition } from "react";

import type { AssignedQuizQuestionItem } from "../../queries/getLessonQuizForEditor";

import styles from "./QuizQuestionOrderList.module.scss";

/**
 * Orderable assigned-Question list for the Lesson Quiz builder (TASK
 * 033, CMS Spec §9/§25/§26 "Use drag-and-drop … The ordering UI should
 * update the server rather than relying only on local state" — the
 * §26 wording TASK 029 already mirrors for Content).
 *
 * Ways to reorder, both persisting through the SAME server action
 * (reorderQuizQuestionAction bound to (courseId, lessonId) by the
 * server panel — the bindings are never client input):
 *
 * 1. Native HTML5 drag-and-drop (no library, per the zero-dependency
 *    guardrail). Pointer-only by nature.
 * 2. "Naik"/"Turun" buttons — the accessible, keyboard-usable fallback
 *    the CMS accessibility section requires. Each button is a plain
 *    <form> posting the minimal reorder contract (questionId +
 *    targetPosition), so it ALSO works without JavaScript (MPA post →
 *    redirect back to the editor); with JavaScript the submit is
 *    intercepted for an optimistic reorder before the action runs.
 *
 * Each row additionally carries a "Hapus" form posting only
 * questionId to the bound removeQuestionFromLessonQuizAction — a
 * membership delete, never a Question Bank delete (CMS §23: the bank
 * Question and every OTHER quiz's use of it stay intact). The three
 * per-row forms are SIBLINGS (never nested — nested <form> is invalid
 * HTML).
 *
 * Drop semantics: dropping a Question onto row T moves it to T's
 * current 1-based position (remove + insert), which the server
 * recomputes authoritatively. The optimistic local state is replaced
 * by fresh server data after the action's redirect revalidates the
 * editor page. Rendering stays text-only (no dangerouslySetInnerHTML).
 */

type RowAction = (formData: FormData) => Promise<void>;

export function QuizQuestionOrderList({
  items,
  reorderAction,
  removeAction,
}: {
  /** Persisted order (CMS §25), passed by the server panel. */
  items: AssignedQuizQuestionItem[];
  /** reorderQuizQuestionAction bound to (courseId, lessonId). */
  reorderAction: RowAction;
  /** removeQuestionFromLessonQuizAction bound to (courseId, lessonId). */
  removeAction: RowAction;
}) {
  const [order, setOrder] = useState(items);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Fresh server data (a new array arrives after the action's redirect
  // revalidates the editor) wins over any optimistic local state —
  // the render-time adjustment pattern instead of an effect.
  const [syncedFrom, setSyncedFrom] = useState(items);
  if (syncedFrom !== items) {
    setSyncedFrom(items);
    setOrder(items);
  }

  function submitMove(questionId: string, targetPosition: number) {
    // Optimistic: remove + insert at the target position.
    setOrder((current) => {
      const next = [...current];
      const from = next.findIndex((item) => item.questionId === questionId);
      if (from === -1) return current;
      const clamped = Math.min(Math.max(targetPosition - 1, 0), next.length - 1);
      const [moved] = next.splice(from, 1);
      next.splice(clamped, 0, moved);
      return next;
    });
    startTransition(async () => {
      const formData = new FormData();
      formData.set("questionId", questionId);
      formData.set("targetPosition", String(targetPosition));
      await reorderAction(formData);
    });
  }

  function submitRemove(questionId: string) {
    // Optimistic: the membership disappears; the server's renumbered
    // sequence replaces this state after the redirect revalidates.
    setOrder((current) =>
      current.filter((item) => item.questionId !== questionId),
    );
    startTransition(async () => {
      const formData = new FormData();
      formData.set("questionId", questionId);
      await removeAction(formData);
    });
  }

  return (
    <ol className={styles.orderList}>
      {order.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === order.length - 1;
        const isDragging = draggingId === item.questionId;
        const isOver =
          overId === item.questionId && draggingId !== null && !isDragging;

        return (
          <li
            key={item.questionId}
            className={
              isDragging
                ? styles.itemDragging
                : isOver
                  ? styles.itemDropTarget
                  : styles.item
            }
            draggable
            onDragStart={(event) => {
              setDraggingId(item.questionId);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.questionId);
            }}
            onDragOver={(event) => {
              if (draggingId !== null && draggingId !== item.questionId) {
                event.preventDefault();
                setOverId(item.questionId);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setOverId(null);
              const sourceId =
                draggingId ?? event.dataTransfer.getData("text/plain");
              if (!sourceId || sourceId === item.questionId) {
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
            <span className={styles.itemTitle}>{item.questionText}</span>
            <div className={styles.rowControls}>
              <div className={styles.moveControls}>
                <form
                  action={reorderAction}
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitMove(item.questionId, index);
                  }}
                >
                  <input
                    type="hidden"
                    name="questionId"
                    value={item.questionId}
                  />
                  <input type="hidden" name="targetPosition" value={index} />
                  <button
                    type="submit"
                    className={styles.moveButton}
                    disabled={isFirst || isPending}
                    aria-label={`Pindahkan soal ke atas (posisi ${index})`}
                  >
                    Naik
                  </button>
                </form>
                <form
                  action={reorderAction}
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitMove(item.questionId, index + 2);
                  }}
                >
                  <input
                    type="hidden"
                    name="questionId"
                    value={item.questionId}
                  />
                  <input type="hidden" name="targetPosition" value={index + 2} />
                  <button
                    type="submit"
                    className={styles.moveButton}
                    disabled={isLast || isPending}
                    aria-label={`Pindahkan soal ke bawah (posisi ${index + 2})`}
                  >
                    Turun
                  </button>
                </form>
              </div>
              <form
                action={removeAction}
                onSubmit={(event) => {
                  event.preventDefault();
                  submitRemove(item.questionId);
                }}
              >
                <input type="hidden" name="questionId" value={item.questionId} />
                <button
                  type="submit"
                  className={styles.removeButton}
                  disabled={isPending}
                  aria-label="Hapus soal dari kuis ini"
                >
                  Hapus
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
