// Consultation service (card S6-01 §4): resolves the wa.me redirect target
// from system_settings so the number is replaceable without a deploy
// (KSL-08) while the Beranda itself stays static. The opening-message
// template is passed IN by the route (it lives in the owner-editable
// beranda-content.ts) — this module never imports from src/components.
import "server-only";

import { AppError } from "@/lib/errors";

import { WHATSAPP_NUMBER_KEY, selectWhatsappNumberRaw } from "./queries";

/** Indonesian MSISDN without "+" (KSL-08): "62" + 8–13 digits. */
export const WHATSAPP_NUMBER_PATTERN = /^62\d{8,13}$/;

/** Is the stored value a usable WhatsApp number? (Pure — unit-tested.) */
export function isValidWhatsAppNumber(value: string): boolean {
  return WHATSAPP_NUMBER_PATTERN.test(value);
}

/** The wa.me deep link with the prefilled opening message (KSL-03/04). */
export function buildWhatsAppUrl(number: string, template: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(template)}`;
}

/** 503 domain error — no fallback number exists (card §4, fail-closed). */
export class ConsultationUnavailableError extends AppError {
  constructor() {
    super(
      503,
      "CONSULTATION_UNAVAILABLE",
      "Layanan konsultasi sedang tidak tersedia.",
    );
  }
}

/**
 * The redirect target for GET /api/konsultasi/whatsapp. Fail-closed: a
 * missing row, a non-string JSON value, or a string that fails the pattern
 * all reject with ConsultationUnavailableError. The failure is logged
 * WITHOUT the value — a wrong-format number in a log line invites
 * copy-paste mistakes, and the shape (type + pattern verdict) is all the
 * operator needs.
 */
export async function getConsultationWhatsAppUrl(
  template: string,
): Promise<string> {
  const row = await selectWhatsappNumberRaw();
  if (row && row.jsonType === "string" && isValidWhatsAppNumber(row.text)) {
    return buildWhatsAppUrl(row.text, template);
  }
  console.error(
    `[consultation] setting ${WHATSAPP_NUMBER_KEY} tidak sah atau hilang` +
      ` (tipe jsonb: ${row?.jsonType ?? "baris hilang"})`,
  );
  throw new ConsultationUnavailableError();
}
