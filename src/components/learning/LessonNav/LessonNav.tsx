"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

import type { LearningLessonNavItem } from "@/features/progress/queries/getCourseForLearning";

import styles from "./LessonNav.module.scss";

/**
 * BINZI learning lesson navigation (TASK 045, UI/UX §10 "Lesson
 * navigation" sidebar; Task Plan "Mobile: collapsible navigation").
 *
 * Renders the authoritative lesson list resolved server-side by the
 * learning layout (getCourseForLearning — statuses come from
 * lesson_progress, never from client state). The marker/clickability
 * derivation below is display affordance ONLY, computed from those
 * authoritative statuses: a lesson is reachable up to and including
 * the first not-yet-completed lesson (BR §9); later lessons render
 * as non-interactive locked rows. Enforcement is NOT done here — the
 * /learn/[lessonSlug] page re-checks every request with the ONE
 * centralized gate canAccessLesson (TASK 044, Blueprint §29 "Do not
 * duplicate this logic across pages"), so a tampered link still
 * cannot open a locked lesson.
 *
 * Mobile follows the collapsible pattern of the public header: a
 * labelled toggle button (never icon-only, §34) with
 * aria-expanded/aria-controls; the sidebar becomes persistent from
 * the "large" breakpoint up (tokens.scss maps large: 64em to the
 * learning layout per UI/UX §10). The active lesson is marked with
 * aria-current via the pathname, mirroring PublicHeader/AdminNav.
 * Props carry only renderable fields — slugs, titles, statuses; no
 * UUIDs or internal identifiers reach the client surface.
 */
export function LessonNav({
  courseSlug,
  items,
}: {
  courseSlug: string;
  items: LearningLessonNavItem[];
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const frontierIndex = items.findIndex((item) => item.status !== "COMPLETED");

  return (
    <>
      <button
        aria-controls="learning-lesson-navigation"
        aria-expanded={navOpen}
        className={styles.menuToggle}
        onClick={() => setNavOpen((open) => !open)}
        type="button"
      >
        Daftar Pelajaran
      </button>
      <nav
        aria-label="Navigasi pelajaran"
        className={navOpen ? styles.navOpen : styles.nav}
        id="learning-lesson-navigation"
      >
        <h2 className={styles.heading}>Pelajaran</h2>
        {items.length === 0 ? (
          <p className={styles.empty}>Belum ada pelajaran yang tersedia.</p>
        ) : (
          <ol className={styles.list}>
            {items.map((item, index) => {
              const reachable = frontierIndex === -1 || index <= frontierIndex;
              const href = `/courses/${courseSlug}/learn/${item.slug}`;
              const isActive = pathname === href;

              if (!reachable) {
                return (
                  <li className={styles.item} key={item.slug}>
                    <span className={styles.rowLocked}>
                      <span aria-hidden="true" className={styles.marker}>
                        🔒
                      </span>
                      <span className={styles.title}>{item.title}</span>
                      <span className={styles.statusLabel}>Terkunci</span>
                    </span>
                  </li>
                );
              }

              return (
                <li className={styles.item} key={item.slug}>
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={isActive ? styles.rowActive : styles.row}
                    href={href}
                    onClick={() => setNavOpen(false)}
                  >
                    {item.status === "COMPLETED" ? (
                      <>
                        <span aria-hidden="true" className={styles.markerDone}>
                          ✓
                        </span>
                        <span className={styles.title}>{item.title}</span>
                        <span className={styles.statusLabel}>Selesai</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true" className={styles.marker}>
                          →
                        </span>
                        <span className={styles.title}>{item.title}</span>
                        <span className={styles.statusLabel}>
                          Pelajaran saat ini
                        </span>
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </nav>
    </>
  );
}
