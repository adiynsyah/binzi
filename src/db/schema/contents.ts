import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { contentType, publicationStatus } from "./enums";
import { users } from "./users";
import { lessonContents } from "./lessons";

/**
 * BINZI Content (Drizzle Spec §8).
 *
 * Unified model for ARTICLE / VIDEO / INFOGRAPHIC / TEXT / TIP.
 * Article is a Content type — there is no separate Article table
 * (approved decision #2).
 *
 * body stores the Tiptap JSON document; metadata stores type-specific
 * data (e.g. video provider + id). Typed narrowly when the Content
 * feature lands (Blueprint §21); left as JSONB here on purpose.
 *
 * slug is UNIQUE for non-null values (Decisions Log #5) — Postgres
 * unique constraints permit multiple NULLs.
 */
export const contents = pgTable(
  "contents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: contentType("type").notNull(),
    title: text("title").notNull(),
    slug: text("slug"),
    body: jsonb("body").notNull(),
    metadata: jsonb("metadata"),
    status: publicationStatus("status").notNull().default("DRAFT"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id), // RESTRICT (default)
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id), // RESTRICT (default)
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    unique("contents_slug_unique").on(t.slug),
    check(
      "contents_published_at_check",
      sql`${t.status} <> 'PUBLISHED' OR ${t.publishedAt} IS NOT NULL`,
    ),
    // CMS list filters (Drizzle Spec §20).
    index("contents_status_idx").on(t.status),
    index("contents_type_idx").on(t.type),
  ],
);

export const contentsRelations = relations(contents, ({ one, many }) => ({
  lessonContents: many(lessonContents),
  createdBy: one(users, {
    fields: [contents.createdBy],
    references: [users.id],
    relationName: "contents_created_by",
  }),
  updatedBy: one(users, {
    fields: [contents.updatedBy],
    references: [users.id],
    relationName: "contents_updated_by",
  }),
}));

export type Content = typeof contents.$inferSelect;
export type NewContent = typeof contents.$inferInsert;
