// Operational tables (PRD §11.2 "OPERASIONAL"): audit trail, rate limiting
// (PostgreSQL stands in for Redis at MVP scale, §11.1), and system settings.
import {
  bigserial,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: inet("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Admin-facing trail browsing.
    index("audit_logs_created_at_idx").on(table.createdAt.desc()),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    // Bucket key, e.g. "login:user@mail.com".
    key: text("key").primaryKey(),
    count: integer("count").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    // Swept by a cron job (PRD §11.2).
    index("rate_limits_expires_at_idx").on(table.expiresAt),
  ],
);

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  // Nullable so bootstrap seeds can run before any admin user exists.
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
