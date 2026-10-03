// Media assets (PRD §11.2 "OPERASIONAL") — metadata for Cloudflare R2
// objects uploaded through the CMS.
import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const mediaTypeEnum = pgEnum("media_type", [
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
]);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: mediaTypeEnum("type").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    url: text("url"),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    durationSeconds: integer("duration_seconds"),
    altText: text("alt_text"),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("media_assets_uploaded_by_idx").on(table.uploadedBy)],
);
