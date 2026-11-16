"use client";

// YouTube engine for the demo (card S2-02 §5.B) — SEMENTARA: this file is
// deleted in C-10 together with the CSP entries
// (docs/decisions/video-sumber.md §4). The permanent wrapper
// (lesson-video-player.tsx) and the reporter survive it.
//
// The iframe is REACT-OWNED: it renders with src right away, and the IFrame
// API ATTACHES to it (new YT.Player(iframeEl, …)) instead of creating its
// own node — the video still plays when the API script fails to load, React
// keeps owning the node, and e2e can assert src without a network.
//
// Minimal hand-written YT types (card: no @types/youtube dependency).
import { useEffect, useRef } from "react";

import { youtubeEmbedUrl } from "@/lib/youtube";

type YTPlayerEvent = { data: number };

type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement,
    config: {
      events?: {
        onReady?: () => void;
        onStateChange?: (event: YTPlayerEvent) => void;
        onError?: (event: YTPlayerEvent) => void;
      };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const IFRAME_API_SRC = "https://www.youtube.com/iframe_api";
const API_TIMEOUT_MS = 15_000;

let apiPromise: Promise<YTNamespace> | null = null;

/**
 * Loads https://www.youtube.com/iframe_api ONCE per page (card §5.B):
 * inserts a single <script>, resolves through window.onYouTubeIframeAPIReady
 * (a pre-existing handler, if any, still runs), rejects on script onerror or
 * after 15 s. Later callers share the SAME promise — including a rejected
 * one; a page that failed once stays "API-less" (the video still plays with
 * YouTube's own controls, only the position recording is lost).
 */
export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = setTimeout(() => {
      reject(new Error("YouTube IFrame API did not become ready in 15 s"));
    }, API_TIMEOUT_MS);
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      clearTimeout(timeout);
      if (window.YT) {
        resolve(window.YT);
      } else {
        reject(new Error("YouTube IFrame API ready without window.YT"));
      }
    };
    const script = document.createElement("script");
    script.src = IFRAME_API_SRC;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("YouTube IFrame API script failed to load"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** What the wrapper may do with an attached engine (card §5.A/§5.B). */
export type YouTubeEngineHandle = {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  read(): { positionSeconds: number; durationSeconds: number };
};

/**
 * The demo YouTube engine. Renders the iframe (nocookie, enablejsapi) and,
 * once the API is ready, attaches a YT.Player to it. Events after unmount
 * are ignored; the player is NEVER destroyed — on a React-owned iframe
 * YT.Player#destroy may detach the node and break React's unmount (card
 * note, deliberately not verified against the sandbox).
 */
export function YouTubePlayer(props: {
  videoId: string;
  origin: string;
  lessonTitle: string;
  startSeconds: number;
  onReady(handle: YouTubeEngineHandle): void;
  onStateChange(state: "playing" | "paused" | "ended"): void;
  onError(code: number): void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Latest callbacks without re-creating the player on every render.
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    let disposed = false;
    loadYouTubeIframeApi()
      .then((YT) => {
        if (disposed || !iframeRef.current) return;
        const player = new YT.Player(iframeRef.current, {
          events: {
            onReady: () => {
              if (disposed) return;
              propsRef.current.onReady({
                seekTo: (seconds, allowSeekAhead) =>
                  player.seekTo(seconds, allowSeekAhead),
                read: () => ({
                  positionSeconds: player.getCurrentTime(),
                  durationSeconds: player.getDuration(),
                }),
              });
            },
            onStateChange: (event) => {
              if (disposed) return;
              // 1 playing, 2 paused, 0 ended; 3 buffering and 5 cued ignored.
              if (event.data === 1) propsRef.current.onStateChange("playing");
              else if (event.data === 2)
                propsRef.current.onStateChange("paused");
              else if (event.data === 0)
                propsRef.current.onStateChange("ended");
            },
            onError: (event) => {
              if (disposed) return;
              propsRef.current.onError(event.data);
            },
          },
        });
      })
      .catch(() => {
        // API script failed to load: NO message on purpose (card §5.B) —
        // the video still plays with YouTube's own controls; only the
        // position recording is lost.
      });
    return () => {
      // No player.destroy() — see the file header. Just ignore events.
      disposed = true;
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={youtubeEmbedUrl(props.videoId, {
        origin: props.origin,
        startSeconds: props.startSeconds,
      })}
      title={"Video: " + props.lessonTitle}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className="absolute inset-0 size-full"
    />
  );
}
