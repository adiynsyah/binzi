// Playback timestamp formatting (card S2-02 §5.A; screen 13d "BERHENTI DI
// 01:24"). A pure module with no "use client" on purpose: the same format
// is reused by the server-rendered dashboard (13d) later.
//
// mm:ss below one hour (01:24), h:mm:ss from one hour up (1:01:01).

/** Floor to whole seconds, never negative. */
export function formatPlaybackClock(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours >= 1 ? `${hours}:${mmss}` : mmss;
}
