CREATE TYPE "public"."content_type" AS ENUM('ARTICLE', 'VIDEO', 'INFOGRAPHIC', 'TEXT', 'TIP');--> statement-breakpoint
CREATE TYPE "public"."course_difficulty" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('ACTIVE', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."lesson_progress_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."quiz_type" AS ENUM('LESSON', 'FINAL');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "content_type" NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"body" jsonb NOT NULL,
	"metadata" jsonb,
	"status" "publication_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "contents_slug_unique" UNIQUE("slug"),
	CONSTRAINT "contents_published_at_check" CHECK ("contents"."status" <> 'PUBLISHED' OR "contents"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"thumbnail_url" text,
	"difficulty" "course_difficulty" NOT NULL,
	"estimated_duration" integer,
	"status" "publication_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "courses_published_at_check" CHECK ("courses"."status" <> 'PUBLISHED' OR "courses"."published_at" IS NOT NULL),
	CONSTRAINT "courses_estimated_duration_check" CHECK ("courses"."estimated_duration" IS NULL OR "courses"."estimated_duration" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "lesson_contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_contents_content_id_unique" UNIQUE("content_id"),
	CONSTRAINT "lesson_contents_lesson_sort_order_unique" UNIQUE("lesson_id","sort_order"),
	CONSTRAINT "lesson_contents_sort_order_check" CHECK ("lesson_contents"."sort_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL,
	"status" "publication_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "lessons_course_slug_unique" UNIQUE("course_id","slug"),
	CONSTRAINT "lessons_course_sort_order_unique" UNIQUE("course_id","sort_order"),
	CONSTRAINT "lessons_sort_order_check" CHECK ("lessons"."sort_order" > 0),
	CONSTRAINT "lessons_published_at_check" CHECK ("lessons"."status" <> 'PUBLISHED' OR "lessons"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "quiz_questions_quiz_question_unique" UNIQUE("quiz_id","question_id"),
	CONSTRAINT "quiz_questions_quiz_sort_order_unique" UNIQUE("quiz_id","sort_order"),
	CONSTRAINT "quiz_questions_sort_order_check" CHECK ("quiz_questions"."sort_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" "quiz_type" NOT NULL,
	"lesson_id" uuid,
	"course_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quizzes_lesson_id_unique" UNIQUE("lesson_id"),
	CONSTRAINT "quizzes_course_id_unique" UNIQUE("course_id"),
	CONSTRAINT "quizzes_type_ownership_check" CHECK (("quizzes"."type" = 'LESSON' AND "quizzes"."lesson_id" IS NOT NULL AND "quizzes"."course_id" IS NULL) OR ("quizzes"."type" = 'FINAL' AND "quizzes"."course_id" IS NOT NULL AND "quizzes"."lesson_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"option_text" text NOT NULL,
	"sort_order" integer NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	CONSTRAINT "question_options_question_sort_order_unique" UNIQUE("question_id","sort_order"),
	CONSTRAINT "question_options_sort_order_check" CHECK ("question_options"."sort_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_text" text NOT NULL,
	"explanation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'ACTIVE' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "enrollments_user_course_unique" UNIQUE("user_id","course_id"),
	CONSTRAINT "enrollments_status_completed_at_check" CHECK (("enrollments"."status" = 'ACTIVE' AND "enrollments"."completed_at" IS NULL) OR ("enrollments"."status" = 'COMPLETED' AND "enrollments"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"status" "lesson_progress_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "lesson_progress_enrollment_lesson_unique" UNIQUE("enrollment_id","lesson_id"),
	CONSTRAINT "lesson_progress_completed_at_check" CHECK (("lesson_progress"."status" = 'COMPLETED') = ("lesson_progress"."completed_at" IS NOT NULL)),
	CONSTRAINT "lesson_progress_started_at_check" CHECK ("lesson_progress"."status" <> 'IN_PROGRESS' OR "lesson_progress"."started_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid NOT NULL,
	"is_correct" boolean NOT NULL,
	CONSTRAINT "quiz_answers_attempt_question_unique" UNIQUE("attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"correct_answers" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "quiz_attempts_counts_check" CHECK ("quiz_attempts"."total_questions" > 0 AND "quiz_attempts"."correct_answers" >= 0 AND "quiz_attempts"."correct_answers" <= "quiz_attempts"."total_questions"),
	CONSTRAINT "quiz_attempts_score_range_check" CHECK ("quiz_attempts"."score" >= 0 AND "quiz_attempts"."score" <= 100),
	CONSTRAINT "quiz_attempts_score_derived_check" CHECK ("quiz_attempts"."score" = CAST(round(100.0 * "quiz_attempts"."correct_answers" / "quiz_attempts"."total_questions") AS INTEGER)),
	CONSTRAINT "quiz_attempts_passed_derived_check" CHECK ("quiz_attempts"."passed" = ("quiz_attempts"."correct_answers" * 100 >= 80 * "quiz_attempts"."total_questions"))
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_file_size_check" CHECK ("media"."file_size" >= 0),
	CONSTRAINT "media_width_check" CHECK ("media"."width" IS NULL OR "media"."width" > 0),
	CONSTRAINT "media_height_check" CHECK ("media"."height" IS NULL OR "media"."height" > 0)
);
--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_contents" ADD CONSTRAINT "lesson_contents_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_contents" ADD CONSTRAINT "lesson_contents_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_selected_option_id_question_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."question_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contents_status_idx" ON "contents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contents_type_idx" ON "contents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "enrollments_course_id_idx" ON "enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_quiz_idx" ON "quiz_attempts" USING btree ("user_id","quiz_id");--> statement-breakpoint
CREATE INDEX "media_created_by_idx" ON "media" USING btree ("created_by");