CREATE TYPE "public"."attempt_report_category" AS ENUM('SUBMIT_ERROR', 'TIMER_ENDED_EARLY', 'CONTENT_MISSING', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."attempt_report_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "quiz_attempt_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "quiz_attempt_reports_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"attempt_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"category" "attempt_report_category" NOT NULL,
	"description" text NOT NULL,
	"status" "attempt_report_status" DEFAULT 'PENDING' NOT NULL,
	"decision_reason" text,
	"internal_note" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_attempt_reports_number_unique" UNIQUE("number"),
	CONSTRAINT "quiz_attempt_reports_attempt_unique" UNIQUE("attempt_id"),
	CONSTRAINT "quiz_attempt_reports_decided_at_check" CHECK (("quiz_attempt_reports"."status" = 'PENDING') = ("quiz_attempt_reports"."decided_at" is null)),
	CONSTRAINT "quiz_attempt_reports_decision_reason_check" CHECK ("quiz_attempt_reports"."status" = 'PENDING' or "quiz_attempt_reports"."decision_reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "quiz_attempt_reports" ADD CONSTRAINT "quiz_attempt_reports_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_reports" ADD CONSTRAINT "quiz_attempt_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_reports" ADD CONSTRAINT "quiz_attempt_reports_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_attempt_reports_status_created_idx" ON "quiz_attempt_reports" USING btree ("status","created_at");