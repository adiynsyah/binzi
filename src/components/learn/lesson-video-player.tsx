"use client";

// LessonVideoPlayer (card S2-02 §5.A, PERMANENT) — the 16:9 frame above the
// lesson h1 (7d), the "Melanjutkan dari mm:ss" row, and the wiring between
// engine and reporter. Source-agnostic: `playback.kind` picks the engine;
// the file engine arrives with S1-05.
//
// The engine mounts only AFTER the client is attached: the iframe src needs
// window.location.origin (Vercel preview origins differ per branch, so it
// is never taken from env). The 16:9 frame is server-rendered from the
// start — no layout jump.
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { Banner } from "@/components/ui/banner";
import type { PlaybackDTO } from "@/modules/progress/service";

import { formatPlaybackClock } from "./playback-clock";
import { YouTubePlayer, type YouTubeEngineHandle } from "./youtube-player";
import {
  createVideoProgressReporter,
  type VideoProgressReporter,
} from "./video-progress-reporter";

// Client-only value with NO store behind it: null during SSR and the
// hydration pass, window.location.origin right after (Vercel preview
// origins differ per branch, so it is never taken from env).
// useSyncExternalStore is the hydration-safe shape — a useState lazy
// initializer would render a DIFFERENT first client frame than the server.
const subscribeToNothing = () => () => {};

export function LessonVideoPlayer(props: {
  lessonId: string;
  lessonTitle: string;
  playback: PlaybackDTO;
  resumeFromSeconds: number;
  /**
   * Card S3-01 §3 (keputusan 9): the page passes 90 while the quiz is
   * locked behind the video; the FIRST recorded watchedPercent ≥ value
   * triggers ONE router.refresh() so the start button comes alive without
   * a reload. Undefined → no refresh watching at all.
   */
  refreshAtPercent?: number;
}) {
  const origin = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => null,
  );

  // The resume row shows when the stored position is worth resuming: at
  // least 5 s in, and (when the duration is known) at least 5 s before the
  // end. Otherwise the video simply starts at 0 (no start param).
  const knownDuration = props.playback.durationSeconds ?? null;
  const resumeRow =
    props.resumeFromSeconds >= 5 &&
    (knownDuration === null || props.resumeFromSeconds < knownDuration - 5);
  const [resumeVisible, setResumeVisible] = useState(resumeRow);
  const [engineReady, setEngineReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const handleRef = useRef<YouTubeEngineHandle | null>(null);

  // ---- the live quiz-unlock refresh (card S3-01 §3) -----------------------
  // router.refresh and refreshAtPercent both change AFTER the refresh lands
  // (new DTO), but the reporter effect below must keep depending on
  // lessonId ONLY: re-running it would dispose + recreate the reporter
  // mid-playback, and the new reporter never receives .playing() — progress
  // recording would silently stop. Both values cross that boundary through
  // refs updated by their own effects.
  const router = useRouter();
  const refreshRef = useRef(router.refresh);
  useEffect(() => {
    refreshRef.current = router.refresh;
  }, [router]);
  const refreshAtPercentRef = useRef(props.refreshAtPercent);
  useEffect(() => {
    refreshAtPercentRef.current = props.refreshAtPercent;
  }, [props.refreshAtPercent]);
  const refreshedRef = useRef(false);

  // One reporter per lessonId; lesson-page.tsx keys THIS component by
  // lesson.id, so moving between lessons disposes the old reporter and
  // mounts a fresh player (review item 3 / mutation 10).
  const reporterRef = useRef<VideoProgressReporter | null>(null);
  useEffect(() => {
    const reporter = createVideoProgressReporter({
      lessonId: props.lessonId,
      read: () =>
        handleRef.current?.read() ?? { positionSeconds: 0, durationSeconds: 0 },
      onRecorded: ({ watchedPercent }) => {
        const threshold = refreshAtPercentRef.current;
        if (threshold === undefined || refreshedRef.current) return;
        if (watchedPercent >= threshold) {
          refreshedRef.current = true;
          refreshRef.current();
        }
      },
    });
    reporterRef.current = reporter;
    return () => {
      reporter.dispose();
      reporterRef.current = null;
    };
  }, [props.lessonId]);

  let engine: ReactNode = null;
  if (origin !== null) {
    switch (props.playback.kind) {
      case "youtube":
        engine = (
          <YouTubePlayer
            videoId={props.playback.videoId}
            origin={origin}
            lessonTitle={props.lessonTitle}
            startSeconds={resumeRow ? props.resumeFromSeconds : 0}
            onReady={(handle) => {
              handleRef.current = handle;
              setEngineReady(true);
            }}
            onStateChange={(state) => {
              const reporter = reporterRef.current;
              if (!reporter) return;
              if (state === "playing") reporter.playing();
              else if (state === "paused") reporter.paused();
              else reporter.ended();
            }}
            onError={() => setVideoFailed(true)}
          />
        );
        break;
      case "file":
        // S1-05 (presigned GET, A-17): the file engine arrives HERE. Until
        // that card resolvePlayback answers null for R2 rows, so no file
        // DTO can reach the player — the placeholder keeps the switch
        // exhaustive without rendering anything.
        engine = null;
        break;
      default: {
        const _exhaustive: never = props.playback;
        engine = _exhaustive;
      }
    }
  }

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-card bg-ink-surface">
        {engine}
      </div>
      {resumeVisible ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-meta">
          <span>
            Melanjutkan dari {formatPlaybackClock(props.resumeFromSeconds)}
          </span>
          <button
            type="button"
            onClick={() => {
              handleRef.current?.seekTo(0, true);
              setResumeVisible(false);
            }}
            disabled={!engineReady}
            className="inline-flex min-h-11 items-center font-bold text-primary-deep underline underline-offset-2 disabled:text-text-subtle disabled:no-underline"
          >
            Mulai dari awal
          </button>
        </p>
      ) : null}
      {videoFailed ? (
        <Banner
          tone="info"
          className="mt-3"
          title="Video gagal dimuat di jaringan ini."
          description="Teks materi & quiz tetap bisa dikerjakan."
        />
      ) : null}
    </div>
  );
}
