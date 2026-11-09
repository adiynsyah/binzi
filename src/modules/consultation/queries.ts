// Database access for the consultation domain (card S6-01 §4).
//
// NEVER import this from another module — go through service.ts. The
// no-restricted-imports rule in eslint.config.mjs enforces it.
import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { systemSettings } from "@/db/schema";

/** system_settings key of the consultation WhatsApp number (KSL-08). */
export const WHATSAPP_NUMBER_KEY = "consultation.whatsapp_number";

/**
 * The raw WhatsApp setting as { jsonType, text } — undefined when the row
 * is absent. Read with jsonb_typeof() + `value #>> '{}'`, NEVER `::text`:
 * for a stored JSON string, ::text returns the QUOTES (`"6280000000000"`),
 * so the pattern check would test the wrong string (verified in PGlite,
 * 8 Nov — see the card's review notes). The quiz module's
 * selectMinQuestionsText uses ::text safely because its values are JSON
 * numbers; a string setting needs the unquoted form.
 */
export async function selectWhatsappNumberRaw(): Promise<
  { jsonType: string; text: string } | undefined
> {
  const rows = await db
    .select({
      jsonType: sql<string | null>`jsonb_typeof(${systemSettings.value})`,
      text: sql<string | null>`${systemSettings.value} #>> '{}'`,
    })
    .from(systemSettings)
    .where(eq(systemSettings.key, WHATSAPP_NUMBER_KEY))
    .limit(1);
  const row = rows[0];
  if (!row || row.jsonType === null || row.text === null) {
    return undefined;
  }
  return { jsonType: row.jsonType, text: row.text };
}
