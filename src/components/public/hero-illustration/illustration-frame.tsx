"use client";

// Frame + pause control for the hero illustration (card S6-01 §3, mounting
// per 6b): a wrapper sized to the SCALED artwork (324×234 / 576×416 /
// 560×404) around the fixed 720×520 stage. The outline is ring-1 (a real
// border would eat 2px of the scaled art on each side under
// overflow-hidden) and the rounded corners clip via the module's
// overflow: hidden.
//
// data-paused freezes every descendant animation through
// `.frame[data-paused] *` in the module. The button hides under
// motion-reduce (globals.css already kills animations); its state is
// deliberately NOT persisted — a reload resumes motion (card §3).
import { useState } from "react";
import { Pause, Play } from "lucide-react";

import { HeroIllustration } from "./hero-illustration";
import styles from "./hero-illustration.module.css";

export function IllustrationFrame() {
  const [paused, setPaused] = useState(false);

  return (
    <div
      className={`${styles.frame} relative w-[324px] h-[234px] sm:w-[576px] sm:h-[416px] lg:w-[560px] lg:h-[404px] rounded-[18px] ring-1 ring-border`}
      data-hero-frame
      data-paused={paused ? "" : undefined}
    >
      <div className="absolute left-0 top-0 origin-top-left scale-[0.45] sm:scale-[0.8] lg:scale-[0.7778]">
        <HeroIllustration />
      </div>
      <button
        type="button"
        className="motion-reduce:hidden absolute bottom-3 right-3 z-10 flex size-11 items-center justify-center rounded-full bg-surface text-primary-deep ring-1 ring-border"
        aria-label={paused ? "Putar animasi" : "Jeda animasi"}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
      </button>
    </div>
  );
}
