CREATE TYPE "public"."video_provider" AS ENUM('R2', 'YOUTUBE');--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "video_provider" "video_provider";--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "video_external_id" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_video_source_check" CHECK ("lessons"."video_status" <> 'READY' or coalesce(
        ("lessons"."video_provider" = 'R2' and "lessons"."video_key" is not null)
        or ("lessons"."video_provider" = 'YOUTUBE' and "lessons"."video_external_id" ~ '^[A-Za-z0-9_-]{11}$'),
        false));