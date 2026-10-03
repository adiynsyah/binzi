// System-only seed (A-07): system_settings plus clearly-dummy article
// categories. No user data, no nutrition content, no STR/WhatsApp real
// values.
//
// Idempotent and non-destructive: rows are only inserted when missing
// (onConflictDoNothing) — values already present are never overwritten, so
// changes made by an admin (e.g. the real consultation WhatsApp number)
// survive re-running the seed at any time.
//
// Run with: npm run db:seed
import { config } from "dotenv";

import { createDb } from "./client";
import { articleCategories, systemSettings } from "./schema";

// Dummy placeholder — the real number is maintained in system_settings by the
// product owner and is never hardcoded in components (KSL-08).
const DUMMY_WHATSAPP_NUMBER = "6280000000000";

const SETTINGS: { key: string; value: unknown }[] = [
  { key: "quiz.min_questions", value: 10 },
  { key: "score.lesson_weight", value: 60 },
  { key: "score.final_weight", value: 40 },
  { key: "consultation.whatsapp_number", value: DUMMY_WHATSAPP_NUMBER },
  { key: "consultation.operating_hours", value: "Senin-Jumat 09.00-17.00 WIB" },
  { key: "consultation.response_sla", value: "1x24 jam" },
];

const CATEGORIES = [
  {
    name: "Kategori Contoh 1 (dummy)",
    slug: "kategori-contoh-1-dummy",
    orderIndex: 1,
  },
  {
    name: "Kategori Contoh 2 (dummy)",
    slug: "kategori-contoh-2-dummy",
    orderIndex: 2,
  },
];

async function main() {
  // drizzle-kit/tsx run outside Next.js; load env files the same way
  // drizzle.config.ts does (.env.local wins over .env).
  config({ path: ".env.local" });
  config();

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Invalid database configuration: DATABASE_URL is not set. " +
        "The seed must run against the Supabase transaction pooler (port 6543).",
    );
  }

  const { db, client } = createDb(url);

  try {
    for (const setting of SETTINGS) {
      await db
        .insert(systemSettings)
        .values(setting)
        .onConflictDoNothing({ target: systemSettings.key });
    }

    for (const category of CATEGORIES) {
      await db
        .insert(articleCategories)
        .values(category)
        .onConflictDoNothing({ target: articleCategories.slug });
    }

    console.log(
      `Seeded ${SETTINGS.length} system settings and ${CATEGORIES.length} dummy article categories (existing rows left untouched).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
