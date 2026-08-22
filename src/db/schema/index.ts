/**
 * Aggregated schema export — consumed by `drizzle(queryClient, { schema })`
 * in src/db/index.ts so relational queries can resolve every table and
 * relation (Drizzle Spec §2, §23).
 */
export * from "./enums";
export * from "./users";
export * from "./courses";
export * from "./lessons";
export * from "./contents";
export * from "./quizzes";
export * from "./questions";
export * from "./learning";
export * from "./media";
