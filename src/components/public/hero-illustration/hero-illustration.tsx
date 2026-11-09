// Hero illustration 6a (card S6-01 §3): the 720×520 stage, ported shape
// for shape from docs/design/screens/6a.html. Purely decorative — the whole
// subtree is aria-hidden, so its texts ("Gizi Seimbang", "72%", …) are
// artwork, not page copy, and stay verbatim from the screen.
//
// Geometry lives in inline styles (a direct transcription of the source
// markup); EVERY animation property lives in the module classes — inline
// style props never mention animation (see hero-illustration.module.css).
// Colors map to tokens where TOKENS.md has an exact match; the rest stay
// hex, allowed only inside this folder (check-hex.mjs).
import type { CSSProperties } from "react";

import styles from "./hero-illustration.module.css";

/** Absolute box at (left, top) with size w×h — the illustration's only layout vocabulary. */
function box(left: number, top: number, width: number, height: number): CSSProperties {
  return { position: "absolute", left, top, width, height };
}

/**
 * The learner-and-plate scene. The parent (illustration-frame.tsx) mounts
 * this inside an absolutely positioned, responsively scaled wrapper; the
 * stage itself always renders at the design size 720×520.
 */
export function HeroIllustration() {
  return (
    <div className={styles.stage} data-hero-illustration aria-hidden="true">
      {/* backdrop */}
      <div className={styles.wash} />
      <div className={styles.stripes} />
      <div className={styles.blobA} />
      <div className={styles.blobB} />
      <div className={styles.ground} />

      {/* plate: piring gizi seimbang */}
      <div className={styles.plate}>
        <div className={styles.plateRim}>
          <div className={styles.crossV} />
          <div className={styles.crossH} />
        </div>

        {/* karbo */}
        <div className={`${styles.food} ${styles.foodKarbo}`}>
          <div style={{ position: "relative", width: 92, height: 58 }}>
            <div
              style={{
                ...box(4, 20, 36, 26),
                borderRadius: "50% 50% 28% 28%",
                background: "#fdfaf3",
                border: "1px solid rgba(26, 22, 20, 0.2)",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{ ...box(13, 29, 4, 4), borderRadius: 999, background: "rgba(26, 22, 20, 0.14)" }}
            />
            <div
              style={{ ...box(23, 33, 4, 4), borderRadius: 999, background: "rgba(26, 22, 20, 0.14)" }}
            />
            <div style={{ ...box(44, 12, 15, 30), borderRadius: 999, background: "var(--warning)" }} />
            <div
              style={{ ...box(48, 18, 7, 18), borderRadius: 999, background: "rgba(255, 255, 255, 0.42)" }}
            />
            <div style={{ ...box(62, 10, 15, 15), borderRadius: 4, background: "#e08a4a" }} />
            <div style={{ ...box(74, 22, 15, 15), borderRadius: 4, background: "#d97c37" }} />
            <div style={{ ...box(46, 44, 12, 9), borderRadius: 999, background: "#b4763c" }} />
            <div style={{ ...box(58, 47, 12, 9), borderRadius: 999, background: "#caa070" }} />
          </div>
          <div className={styles.foodLabel}>KARBO</div>
        </div>

        {/* sayur */}
        <div className={`${styles.food} ${styles.foodSayur}`}>
          <div style={{ position: "relative", width: 92, height: 58 }}>
            <div
              style={{ ...box(2, 16, 18, 18), borderRadius: 999, background: "var(--success-tint-text)" }}
            />
            <div
              style={{ ...box(12, 9, 20, 20), borderRadius: 999, background: "var(--success)" }}
            />
            <div
              style={{ ...box(24, 17, 16, 16), borderRadius: 999, background: "var(--success-tint-text)" }}
            />
            <div style={{ ...box(18, 28, 8, 14), borderRadius: 3, background: "#d8e6c8" }} />
            <div
              style={{
                ...box(38, 30, 30, 20),
                borderRadius: "999px 999px 42% 42%",
                background: "#4f9c3f",
              }}
            />
            <div
              style={{ ...box(44, 36, 18, 10), borderRadius: 999, background: "rgba(255, 255, 255, 0.28)" }}
            />
            <div
              style={{
                ...box(66, 8, 17, 17),
                borderRadius: 999,
                background: "#c9e2a3",
                border: "2px solid #7fae4e",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                ...box(74, 24, 17, 17),
                borderRadius: 999,
                background: "#c9e2a3",
                border: "2px solid #7fae4e",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div className={styles.foodLabel}>SAYUR</div>
        </div>

        {/* buah */}
        <div className={`${styles.food} ${styles.foodBuah}`}>
          <div style={{ position: "relative", width: 92, height: 58 }}>
            <div
              style={{
                ...box(2, 18, 34, 20),
                borderRadius: "4px 4px 34px 34px",
                background: "#e0492b",
                borderBottom: "5px solid #2f8f4a",
                boxSizing: "border-box",
              }}
            />
            <div style={{ ...box(38, 14, 24, 24), borderRadius: 999, background: "#d6402c" }} />
            <div
              style={{
                ...box(47, 9, 12, 7),
                borderRadius: "999px 0",
                background: "var(--success)",
                transform: "rotate(-20deg)",
              }}
            />
            <div style={{ ...box(64, 22, 20, 20), borderRadius: 999, background: "#f0932b" }} />
            <div style={{ ...box(73, 22, 2, 20), background: "rgba(255, 255, 255, 0.68)" }} />
            <div style={{ ...box(64, 31, 20, 2), background: "rgba(255, 255, 255, 0.68)" }} />
          </div>
          <div className={styles.foodLabel}>BUAH</div>
        </div>

        {/* lauk */}
        <div className={`${styles.food} ${styles.foodLauk}`}>
          <div style={{ position: "relative", width: 92, height: 58 }}>
            <div
              style={{
                ...box(0, 22, 34, 24),
                borderRadius: 999,
                background: "var(--surface)",
                border: "1px solid rgba(26, 22, 20, 0.18)",
                boxSizing: "border-box",
              }}
            />
            <div style={{ ...box(12, 28, 11, 11), borderRadius: 999, background: "#f2b21e" }} />
            <div
              style={{
                ...box(34, 12, 26, 16),
                borderRadius: "999px 6px 6px 999px",
                background: "#b56a2e",
              }}
            />
            <div style={{ ...box(30, 13, 12, 14), borderRadius: 999, background: "#f6ead7" }} />
            <div
              style={{
                ...box(60, 30, 24, 16),
                borderRadius: "10px 12px 9px 11px",
                background: "#8d4a2c",
              }}
            />
            <div
              style={{ ...box(64, 34, 16, 3), borderRadius: 9, background: "rgba(255, 255, 255, 0.32)" }}
            />
            <div
              style={{ ...box(64, 39, 16, 3), borderRadius: 9, background: "rgba(255, 255, 255, 0.32)" }}
            />
          </div>
          <div className={styles.foodLabel}>LAUK</div>
        </div>
      </div>

      {/* breathing ring + center pill */}
      <div className={styles.breathe} />
      <div className={styles.centerPill}>
        Gizi <span className={styles.centerPillAccent}>Seimbang</span>
      </div>

      {/* chip: ditinjau ahli gizi */}
      <div className={styles.chipA}>
        <span className={styles.checkDot}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6.4l2.6 2.6L10 3.4"
              stroke="var(--surface)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.chipText}>Ditinjau ahli gizi</span>
      </div>

      {/* learner figure */}
      <div className={styles.person}>
        <div className={styles.personBob}>
          <div
            style={{
              ...box(22, 0, 98, 104),
              borderRadius: "999px 999px 46% 46%",
              background: "var(--primary)",
            }}
          />
          <div style={{ ...box(38, 20, 66, 66), borderRadius: 999, background: "#ecd9c2" }} />
          <div
            className={styles.eyes}
            style={{ ...box(54, 44, 6, 6), borderRadius: 999, background: "var(--text)" }}
          />
          <div
            className={styles.eyes}
            style={{ ...box(78, 44, 6, 6), borderRadius: 999, background: "var(--text)" }}
          />
          <div
            style={{
              ...box(60, 56, 18, 9),
              borderBottom: "2px solid var(--text)",
              borderRadius: "0 0 99px 99px",
            }}
          />
          <div
            style={{
              ...box(14, 92, 114, 114),
              borderRadius: "44px 44px 12px 12px",
              background: "var(--primary-deep)",
            }}
          />
          <div className={styles.arm} />
        </div>
      </div>

      {/* lesson player card */}
      <div className={styles.player}>
        <div className={styles.playerStripes} />
        <div className={styles.play}>
          <span
            style={{
              display: "block",
              width: 0,
              height: 0,
              borderLeft: "13px solid var(--primary)",
              borderTop: "8px solid transparent",
              borderBottom: "8px solid transparent",
              marginLeft: 4,
            }}
          />
        </div>
        <div className={styles.playerLabel}>MATERI 01 · 04:12</div>
        <div className={styles.track}>
          <div className={styles.bar} />
        </div>
      </div>

      {/* module stack */}
      <div className={styles.books}>
        <div
          className={`${styles.book} ${styles.book1}`}
          style={{ width: 176, background: "var(--success)" }}
        />
        <div
          className={`${styles.book} ${styles.book2}`}
          style={{ width: 150, marginTop: 6, background: "var(--text)" }}
        />
        <div
          className={`${styles.book} ${styles.book3}`}
          style={{ width: 166, marginTop: 6, background: "var(--warning)" }}
        />
      </div>

      {/* milk carton */}
      <div className={styles.milk}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "7px 7px 13px 13px",
            background: "#dfe8ee",
            border: "2px solid rgba(26, 22, 20, 0.42)",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 42,
              background: "var(--surface)",
              boxShadow: "rgba(26, 22, 20, 0.16) 0 2px 0 inset",
            }}
          />
          <div style={{ ...box(6, 26, 5, 20), borderRadius: 9, background: "#eef3f6" }} />
        </div>
        <div className={styles.milkLabel}>SUSU</div>
      </div>

      {/* cup with steam */}
      <div style={{ ...box(388, 370, 58, 52) }}>
        <div
          style={{
            ...box(0, 8, 44, 44),
            borderRadius: "8px 8px 16px 16px",
            background: "var(--primary-deep)",
          }}
        />
        <div
          style={{
            ...box(40, 18, 18, 18),
            border: "4px solid var(--primary-deep)",
            borderRadius: 999,
          }}
        />
        <div className={`${styles.steam} ${styles.steam1}`} />
        <div className={`${styles.steam} ${styles.steam2}`} />
      </div>

      {/* quiz score ring */}
      <div className={styles.score}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="42" fill="var(--surface)" stroke="var(--border)" strokeWidth="8" />
          <circle
            className={styles.ring}
            cx="48"
            cy="48"
            r="42"
            fill="none"
            stroke="var(--success)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="264"
            transform="rotate(-90 48 48)"
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div className={styles.scoreNumber}>72%</div>
            <div className={styles.scoreLabel}>nilai kuis</div>
          </div>
        </div>
      </div>

      {/* chip: zat besi */}
      <div className={styles.chipB}>
        <span className={styles.chipDot} />
        <span className={styles.chipText}>Zat besi 27 mg</span>
      </div>
    </div>
  );
}
