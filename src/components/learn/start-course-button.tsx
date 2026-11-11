"use client";

// StartCourseButton (card S5-01 §4) — the ONE control behind "Mulai materi 1":
// POST /api/progress/courses/{id}/enroll, then router.push(startHref).
//
// Guard is IN THE HANDLER (inFlight ref), not just the disabled attribute:
// loading sets disabled only after the state commit, so a fast second click
// inside that window must still be caught here (lesson 7 Nov no. 6). The
// API is idempotent anyway — the guard keeps it to ONE request.
//
// The error live region is ALWAYS MOUNTED (C-08 pattern): empty while idle
// so it occupies no space, filled on failure; the button's
// aria-describedby then points at "{course title} {error}" so screen
// readers keep the course context AND hear the reason.
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const COURSE_GONE_MESSAGE =
  "Kursus ini tidak lagi tersedia. Muat ulang halaman untuk melihat daftar terbaru.";
const SESSION_ENDED_MESSAGE =
  "Sesi Anda berakhir. Muat ulang halaman untuk masuk lagi.";
const GENERIC_MESSAGE =
  "Kursus belum bisa dibuka. Periksa koneksi Anda lalu coba lagi.";

export type StartCourseButtonProps = Omit<
  ComponentProps<typeof Button>,
  "onClick"
> & {
  courseId: string;
};

export function StartCourseButton({
  courseId,
  ref,
  loading,
  loadingLabel,
  "aria-describedby": describedBy,
  ...props
}: StartCourseButtonProps) {
  const router = useRouter();
  const errorId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const inFlight = useRef(false);
  const [opening, setOpening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleStart() {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/progress/courses/${courseId}/enroll`,
        { method: "POST" },
      );
      if (response.ok) {
        const json = (await response.json()) as {
          data?: { startHref?: string };
        };
        const startHref = json.data?.startHref;
        if (startHref) {
          router.push(startHref);
          // Loading + inFlight stay ON until the navigation lands
          // (add-lesson-dialog pattern) — no re-tap, no flicker back.
          return;
        }
        setErrorMessage(GENERIC_MESSAGE);
      } else if (response.status === 404) {
        // The course vanished between render and click (unpublished /
        // deleted). NO router.refresh() — owner decision 11 Nov: a silent
        // server re-render would reshuffle the page under the participant;
        // the message tells them what to do instead.
        setErrorMessage(COURSE_GONE_MESSAGE);
      } else if (response.status === 401) {
        setErrorMessage(SESSION_ENDED_MESSAGE);
      } else {
        setErrorMessage(GENERIC_MESSAGE);
      }
    } catch {
      setErrorMessage(GENERIC_MESSAGE);
    }
    setOpening(false);
    inFlight.current = false;
  }

  // Focus returns to the button AFTER the re-render that clears `loading`:
  // the disabled attribute native to loading drops focus to <body>, and
  // focusing a still-disabled button is a no-op (lesson 4 Nov).
  useEffect(() => {
    if (errorMessage !== null) {
      buttonRef.current?.focus();
    }
  }, [errorMessage]);

  // Compose the caller's ref (React 19 ref-as-prop: function | object).
  function composeRef(node: HTMLButtonElement | null) {
    buttonRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }

  const describedByWithError =
    errorMessage === null
      ? describedBy
      : [describedBy, errorId].filter(Boolean).join(" ");

  return (
    <>
      <Button
        {...props}
        ref={composeRef}
        onClick={handleStart}
        loading={opening || loading}
        loadingLabel={loadingLabel ?? "Membuka…"}
        aria-describedby={describedByWithError}
      />
      {/* Always mounted, empty (zero-height, unstyled) while idle — never
          display:none, so it stays in the accessibility tree for the
          role="alert" announcement the moment content arrives. */}
      <p
        role="alert"
        id={errorId}
        className={
          errorMessage === null ? undefined : "mt-2 text-sm text-danger"
        }
      >
        {errorMessage}
      </p>
    </>
  );
}
