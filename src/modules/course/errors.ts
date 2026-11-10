// Service-thrown field errors (card S1-01, revision 3 Nov; card S1-02 §6).
//
// Every input error leaves the service as a ZodError with a custom issue on
// the offending field's path, so toErrorResponse() gives it the exact same
// 400 VALIDATION_ERROR + fields shape as a schema failure — one response
// contract for every form. ConflictError (409) is the DRAFT-status lock of
// the builder endpoints (S1-02: PATCH kursus, POST materi); version
// conflicts may join it in S1-04. Module-internal (see
// src/modules/README.md).
import { ZodError } from "zod";

/** A 400-carrying field error: path ["slug"] / ["title"] + message. */
export function courseFieldError(
  path: "slug" | "title",
  message: string,
): ZodError {
  return new ZodError([{ code: "custom", path: [path], message }]);
}

/** Copy is agent-proposed (card S1-01, PR). */
export const SLUG_TAKEN_MESSAGE = (slug: string): string =>
  `Slug “${slug}” sudah dipakai kursus lain — ketik slug yang berbeda.`;

/** 21f copy verbatim, with the comparison course's title interpolated. */
export const SIMILAR_TITLE_MESSAGE = (otherTitle: string): string =>
  `Judul terlalu mirip dengan kursus “${otherTitle}”. Tambahkan pembeda — mis. trimesternya.`;

/**
 * 409 copy for the builder's DRAFT lock (card S1-02 §6, agent-proposed —
 * listed in the PR). The lesson module carries its own twin constant
 * (cross-module imports only go through service doors, and this is copy,
 * not behavior).
 */
export const NOT_DRAFT_MESSAGE =
  "Kursus sudah bukan draf — hanya draf yang bisa diubah.";

// ------------------------------------------ submit & publish (card S1-08 §2)
// All copy below is agent-proposed (card *(usulan)*) — listed in the PR's
// "Keputusan & asumsi".

/** 403: submit belongs to the ahli gizi exactly (EDITOR, not roleAtLeast). */
export const SUBMIT_FORBIDDEN_MESSAGE =
  "Hanya ahli gizi yang bisa mengirim kursus untuk persetujuan.";

/** 403 second layer for publish (service-side, after the route's ADMIN gate). */
export const PUBLISH_FORBIDDEN_MESSAGE =
  "Hanya admin yang bisa menyetujui dan menerbitkan kursus.";

/** 409: the submit lock — only a DRAFT can be sent for approval. */
export const NOT_DRAFT_SUBMIT_MESSAGE =
  "Kursus sudah dikirim atau terbit — hanya draf yang bisa dikirim.";

/** 409: the publish lock — only an IN_REVIEW course can be published. */
export const NOT_IN_REVIEW_MESSAGE =
  "Kursus tidak sedang menunggu persetujuan.";

/** 409: an IN_REVIEW row without a reviewer (legacy/SQL-touched data). */
export const REVIEWER_MISSING_MESSAGE =
  "Penggarap belum tercatat — kursus harus dikirim ulang dari draf.";

/** 409: the checklist gate, shared by submit and publish. */
export const CHECKLIST_INCOMPLETE_MESSAGE =
  "Syarat terbit belum lengkap — lihat daftar syarat di halaman kursus.";
