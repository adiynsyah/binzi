// Core of the demo-video installer (card S2-02 §8, video-sumber.md §5).
// Lives in src/db — NOT scripts/ — because Vitest only picks up src/**
// (lesson C-05); the CLI in scripts/set-lesson-youtube.ts is a thin shell
// around this transaction.
//
// No audit_logs row on purpose: actor_id is NOT NULL and a CLI run has no
// actor (same decision as scripts/set-role.ts, stated in the PRs).
import { and, eq } from "drizzle-orm";

import { YOUTUBE_ID_PATTERN } from "../lib/youtube";
import type { Db } from "./client";
import { courses, lessons, videoProviderEnum, videoStatusEnum } from "./schema";

/** What the CLI prints as "lama → baru" (old values for the summary). */
export type SetLessonYouTubeResult = {
  courseTitle: string;
  lessonTitle: string;
  previous: {
    videoProvider: (typeof videoProviderEnum.enumValues)[number] | null;
    videoExternalId: string | null;
    videoStatus: (typeof videoStatusEnum.enumValues)[number];
    videoDurationSeconds: number | null;
  };
};

/**
 * Attach a YouTube video to one lesson, ONE transaction (card §8):
 * `video_provider = 'YOUTUBE'`, `video_external_id`,
 * `video_status = 'READY'`, `video_duration_seconds`, `video_key = NULL`.
 * The lesson is addressed by COURSE slug + LESSON slug — both readable
 * from the /belajar/{kursus}/{materi} URL (deviation from the video plan's
 * --lesson <uuid>, stated in the PR). `courses` is never touched.
 * Throws a clear Indonesian error for an unknown pair.
 */
export async function setLessonYouTubeVideo(
  db: Db,
  input: {
    courseSlug: string;
    lessonSlug: string;
    videoId: string;
    durationSeconds: number;
  },
): Promise<SetLessonYouTubeResult> {
  // Guard future callers too, not just the CLI: the CHECK would reject an
  // invalid id anyway, but a plain message beats a constraint error.
  if (!YOUTUBE_ID_PATTERN.test(input.videoId)) {
    throw new Error(
      `ID video tidak sah: "${input.videoId}" (harus 11 karakter A-Za-z0-9_-).`,
    );
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        lessonId: lessons.id,
        lessonTitle: lessons.title,
        courseTitle: courses.title,
        videoProvider: lessons.videoProvider,
        videoExternalId: lessons.videoExternalId,
        videoStatus: lessons.videoStatus,
        videoDurationSeconds: lessons.videoDurationSeconds,
      })
      .from(lessons)
      .innerJoin(courses, eq(lessons.courseId, courses.id))
      .where(
        and(
          eq(courses.slug, input.courseSlug),
          eq(lessons.slug, input.lessonSlug),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new Error(
        `Materi tidak ditemukan: kursus "${input.courseSlug}" / materi "${input.lessonSlug}".`,
      );
    }

    await tx
      .update(lessons)
      .set({
        videoProvider: "YOUTUBE",
        videoExternalId: input.videoId,
        videoStatus: "READY",
        videoDurationSeconds: input.durationSeconds,
        videoKey: null,
      })
      .where(eq(lessons.id, row.lessonId));

    return {
      courseTitle: row.courseTitle,
      lessonTitle: row.lessonTitle,
      previous: {
        videoProvider: row.videoProvider,
        videoExternalId: row.videoExternalId,
        videoStatus: row.videoStatus,
        videoDurationSeconds: row.videoDurationSeconds,
      },
    };
  });
}
