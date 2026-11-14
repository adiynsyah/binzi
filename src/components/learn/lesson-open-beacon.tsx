"use client";

// LessonOpenBeacon (card S2-01 §2.3) — records "materi dibuka" AFTER the
// page has rendered, exactly once per lessonId. GET never writes (a
// dashboard <Link> prefetch must not mark a lesson opened), so this is a
// client POST from a useEffect, invisible to prefetch. Failures are
// swallowed on purpose: reading is never blocked by the recording.
import { useEffect, useRef } from "react";

export function LessonOpenBeacon({ lessonId }: { lessonId: string }) {
  // The ref guard makes the double-invoked StrictMode effect fire once;
  // a lessonId change still sends one NEW post for the new lesson.
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    if (sentFor.current === lessonId) return;
    sentFor.current = lessonId;
    fetch(`/api/progress/lessons/${lessonId}/open`, {
      method: "POST",
    }).catch(() => {
      // Network failure / thrown rejection: ignored — next full load
      // sends it again. A non-2xx resolves, not rejects, and needs no
      // handler at all.
    });
  }, [lessonId]);

  return null;
}
