"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/Badge/Badge";

import type { AssignedContentItem } from "../../queries/getLessonForEditor";

import styles from "./AssignedContentOrderList.module.scss";

/**
 * Orderable assigned-Content list for the Lesson Editor (TASK 029,
 * CMS Spec §9/§26 "Use drag-and-drop … The ordering UI should update
 * the server rather than relying only on local state").
 *
 * Ways to reorder, both persisting through the SAME server action
 * (reorderLessonContentAction bound to (courseId, lessonId) by the
 * server panel — the bindings are never client input):
 *
 * 1. Native HTML5 drag-and-drop (no library, per the zero-dependency
 *    guardrail). Pointer-only by nature.
 * 2. "Naik"/"Turun" buttons — the accessible, keyboard-usable fallback
 *    the CMS accessibility section requires ("Drag-and-drop should not
 *    be the only possible ordering mechanism"). Each button is a plain
 *    <form> posting the minimal reorder contract (contentId +
 *    targetPosition), so it ALSO works without JavaScript (MPA post →
 *    redirect back to the editor); with JavaScript the submit is
 *    intercepted for an optimistic reorder before the action runs.
 *
 * Drop semantics: dropping a Content onto row T moves it to T's
 * current 1-based position (remove + insert), which the server
 * recomputes authoritatively. The optimistic local state is replaced
 * by fresh server data after the action's redirect revalidates the
 * editor page.
 *
 * Boundaries: Naik is disabled on the first item, Turun on the last
 * (a single-Content lesson disables both). The two per-row forms are
 * SIBLINGS inside the row (never nested — nested <form> is invalid
 * HTML). Rendering stays text-only (no dangerouslySetInnerHTML). This
 * component never touches the database — it only calls the action.
 */

const TYPE_LABELS: Record<AssignedContentItem["type"], string> = {
  ARTICLE: "Artikel",
  VIDEO: "Video",
  INFOGRAPHIC: "Infografis",
  TEXT: "Teks",
  TIP: "Tips",
};

const STATUS_LABELS: Record<AssignedContentItem["status"], string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
};

type MoveAction = (formData: FormData) => Promise<void>;

export function AssignedContentOrderList({
  items,
  action,
}: {
  /** Persisted order (BR §4.4), passed by the server panel. */
  items: AssignedContentItem[];
  /** reorderLessonContentAction bound to (courseId, lessonId). */
  action: MoveAction;
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

  function submitMove(contentId: string, targetPosition: number) {
    // Optimistic: remove + insert at the target position.
    setOrder((current) => {
      const next = [...current];
      const from = next.findIndex((item) => item.contentId === contentId);
      if (from === -1) return current;
      const clamped = Math.min(Math.max(targetPosition - 1, 0), next.length - 1);
      const [moved] = next.splice(from, 1);
      next.splice(clamped, 0, moved);
      return next;
    });
    startTransition(async () => {
      const formData = new FormData();
      formData.set("contentId", contentId);
      formData.set("targetPosition", String(targetPosition));
      await action(formData);
    });
  }

  return (
    <ol className={styles.orderList}>
      {order.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === order.length - 1;
        const isDragging = draggingId === item.contentId;
        const isOver =
          overId === item.contentId && draggingId !== null && !isDragging;

        return (
          <li
            key={item.contentId}
            className={
              isDragging
                ? styles.itemDragging
                : isOver
                  ? styles.itemDropTarget
                  : styles.item
            }
            draggable
            onDragStart={(event) => {
              setDraggingId(item.contentId);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.contentId);
            }}
            onDragOver={(event) => {
              if (draggingId !== null && draggingId !== item.contentId) {
                event.preventDefault();
                setOverId(item.contentId);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setOverId(null);
              const sourceId =
                draggingId ?? event.dataTransfer.getData("text/plain");
              if (!sourceId || sourceId === item.contentId) {
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
            <span className={styles.itemTitle}>{item.title}</span>
            <Badge tone="neutral">{TYPE_LABELS[item.type]}</Badge>
            <Badge tone={item.status === "PUBLISHED" ? "success" : "warning"}>
              {STATUS_LABELS[item.status]}
            </Badge>
            <div className={styles.moveControls}>
              <form
                action={action}
                onSubmit={(event) => {
                  event.preventDefault();
                  submitMove(item.contentId, index);
                }}
              >
                <input type="hidden" name="contentId" value={item.contentId} />
                <input type="hidden" name="targetPosition" value={index} />
                <button
                  type="submit"
                  className={styles.moveButton}
                  disabled={isFirst || isPending}
                  aria-label={`Pindahkan konten ${item.title} ke atas`}
                >
                  Naik
                </button>
              </form>
              <form
                action={action}
                onSubmit={(event) => {
                  event.preventDefault();
                  submitMove(item.contentId, index + 2);
                }}
              >
                <input type="hidden" name="contentId" value={item.contentId} />
                <input type="hidden" name="targetPosition" value={index + 2} />
                <button
                  type="submit"
                  className={styles.moveButton}
                  disabled={isLast || isPending}
                  aria-label={`Pindahkan konten ${item.title} ke bawah`}
                >
                  Turun
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
