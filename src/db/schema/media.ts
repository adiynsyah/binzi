import { relations, sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * BINZI Media metadata (Drizzle Spec §18).
 *
 * Metadata only — actual files live in Supabase Storage (approved
 * decision #25). No FK to contents: media references are embedded in
 * Tiptap JSON bodies, a documented V1 limitation.
 */
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storagePath: text("storage_path").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id), // RESTRICT (default)
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("media_file_size_check", sql`${t.fileSize} >= 0`),
    check("media_width_check", sql`${t.width} IS NULL OR ${t.width} > 0`),
    check("media_height_check", sql`${t.height} IS NULL OR ${t.height} > 0`),
    index("media_created_by_idx").on(t.createdBy),
  ],
);

export const mediaRelations = relations(media, ({ one }) => ({
  createdBy: one(users, {
    fields: [media.createdBy],
    references: [users.id],
  }),
}));

export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
