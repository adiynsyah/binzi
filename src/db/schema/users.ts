import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userRole } from "./enums";
import { contents } from "./contents";
import { enrollments, quizAttempts } from "./learning";
import { media } from "./media";

/**
 * BINZI application user (Drizzle Spec §5).
 *
 * `id` has NO generated default: it must equal `auth.users.id`
 * (Supabase Auth) and is supplied by the signup synchronization
 * service. The 1:1 link is application-enforced in V1 — no
 * cross-schema FK (approved decision #22).
 *
 * email UNIQUE per Decisions Log #6. Supabase Auth remains the
 * authoritative authentication identity.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: userRole("role").notNull().default("USER"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
  enrollments: many(enrollments),
  quizAttempts: many(quizAttempts),
  createdContents: many(contents, { relationName: "contents_created_by" }),
  updatedContents: many(contents, { relationName: "contents_updated_by" }),
  media: many(media),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
