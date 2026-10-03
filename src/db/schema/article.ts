// Article tables (PRD §11.2 "ARTIKEL"). Categories exist for articles only.
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { contentStatusEnum, courses } from "./course";

// drizzle-orm has no built-in tsvector column; articles.search_vector needs
// one (PRD §11.2/§11.3). Kept as raw text input/output.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const articleCategories = pgTable("article_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    excerpt: text("excerpt"),
    content: jsonb("content").notNull(), // TipTap document
    coverUrl: text("cover_url"),
    // Exactly one category, NOT NULL (PRD §11.4 no. 1); deletion of a used
    // category is rejected (ON DELETE RESTRICT, §11.4 no. 2).
    categoryId: uuid("category_id")
      .notNull()
      .references(() => articleCategories.id, { onDelete: "restrict" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    reviewerId: text("reviewer_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    readingMinutes: integer("reading_minutes"),
    viewCount: integer("view_count").default(0).notNull(),
    relatedCourseId: uuid("related_course_id").references(() => courses.id),
    status: contentStatusEnum("status").default("DRAFT").notNull(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    searchVector: tsvector("search_vector"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // PRD §11.3: article listing by status + category, newest first.
    index("articles_status_category_published_idx").on(
      table.status,
      table.categoryId,
      table.publishedAt.desc(),
    ),
    // PRD §11.3: full-text search.
    index("articles_search_vector_idx").using("gin", table.searchVector),
  ],
);

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const articleTags = pgTable(
  "article_tags",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.tagId] })],
);
