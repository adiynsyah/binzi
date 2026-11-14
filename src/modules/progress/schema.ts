// Zod input contracts for the progress module (card S2-01 §3).
//
// Same rule as the course module's schema file: this MAY be imported from
// client bundles, so it stays pure Zod with no server imports (no
// "server-only", no db). strictObject — unknown keys are rejected, never
// silently stripped.
import { z } from "zod";

import { UUID_PATTERN } from "@/modules/course/schema";

/** One day in seconds — the ceiling for BOTH video fields (card §3.2). */
export const VIDEO_SECONDS_MAX = 86_400;

/** Player rounding tolerance: position may exceed duration by ≤ 5 s. */
export const VIDEO_TOLERANCE_SECONDS = 5;

export const videoProgressInput = z
  .strictObject({
    // UUID_PATTERN (the route-param rule), NOT z.uuid(): zod's uuid check
    // also validates the RFC version/variant nibbles, so an id that the
    // /open route answers 404 for could 400 here for a different reason.
    // One rule, one 404 (owner review of this card).
    lessonId: z.string().regex(UUID_PATTERN, "Id materi tidak valid."),
    positionSeconds: z
      .number()
      .int("Posisi video harus bilangan bulat detik.")
      .min(0, "Posisi video tidak boleh negatif.")
      .max(VIDEO_SECONDS_MAX, "Posisi video maksimal satu hari."),
    durationSeconds: z
      .number()
      .int("Durasi video harus bilangan bulat detik.")
      .min(1, "Durasi video minimal 1 detik.")
      .max(VIDEO_SECONDS_MAX, "Durasi video maksimal satu hari."),
  })
  .refine(
    (value) =>
      value.positionSeconds <= value.durationSeconds + VIDEO_TOLERANCE_SECONDS,
    {
      message: "Posisi video melebihi durasi video.",
      path: ["positionSeconds"],
    },
  );

export type VideoProgressInput = z.infer<typeof videoProgressInput>;
