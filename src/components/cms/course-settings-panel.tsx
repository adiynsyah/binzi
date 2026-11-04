"use client";

/*
 * Builder settings panel (card S1-02 §2, screens 21a/21g): the right
 * column of the builder. In DRAFT it is a FORM — a conscious deviation
 * from 21a, which draws a read-only value list but never draws HOW the
 * values change (see the PR); outside DRAFT it falls back to exactly that
 * read-only list (S1-01 pattern), with one lock notice line (card §6).
 *
 * The form element lives here with the stable id "course-settings-form";
 * the page-heading "Simpan" button connects to it through the `form`
 * attribute. Field state comes from react-hook-form context — the owning
 * useForm lives in course-builder.tsx next to the submit logic and the
 * response banners, so the panel stays presentational.
 *
 * The slug does NOT auto-follow the title here (unlike the 21f dialog):
 * in the builder the slug is an existing value being edited, not a draft
 * being suggested (review item 10, listed in the PR).
 *
 * Field ids are stable ("settings-title" …) because course-builder's
 * focus pass targets them by id across the component boundary.
 */
import type { FormEventHandler } from "react";
import { useWatch, useFormContext } from "react-hook-form";

import { CourseLevelField } from "@/components/cms/course-level-field";
import { FieldError, LabelRow } from "@/components/cms/form-fields";
import { Banner } from "@/components/ui/banner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import {
  COURSE_LEVEL_LABELS,
  COURSE_SLUG_MAX,
  COURSE_SUMMARY_MAX,
  COURSE_TITLE_MAX,
} from "@/modules/course/schema";
import type { CmsCourseBuilderDTO, PublishChecklist } from "@/modules/course/service";

import type { SettingsValues } from "./course-builder";

export type CourseSettingsPanelProps = {
  course: CmsCourseBuilderDTO;
  checklist: PublishChecklist;
  /** DRAFT → the form; anything else → the locked value list (card §6). */
  editable: boolean;
  /** The RHF submit binding (handleSubmit(…)) from course-builder. */
  onSubmit: FormEventHandler<HTMLFormElement>;
  /** Response feedback rendered at the top of the panel. */
  banner: { tone: "success" | "error"; title: string; description?: string } | null;
  /** Clears the banner state when a success banner dismisses itself. */
  onBannerDismissed: () => void;
};

// Agent copy (not from a design screen) — listed in the PR.
const LOCKED_NOTICE =
  "Kursus sudah bukan draf — pengaturan dan materi terkunci.";

/** The rows that never change from the panel, both modes (card §2). */
function readonlyRows(
  course: CmsCourseBuilderDTO,
): readonly { label: string; value: string }[] {
  return [
    { label: "Preview", value: "Materi 1 gratis" },
    { label: "Durasi", value: "Dihitung otomatis dari video" },
    { label: "Penggarap", value: course.ownerName },
    {
      label: "Deskripsi",
      value: course.isDescriptionEmpty ? "Belum diisi" : "Sudah diisi",
    },
  ];
}

function ChecklistBlock({ checklist }: { checklist: PublishChecklist }) {
  return (
    <div className="relative mt-6 rounded-control bg-surface-2 p-4">
      <div className="flex items-center">
        <h3 className="text-sm font-bold text-text">Syarat sebelum dikirim</h3>
        <span className="ml-auto font-mono text-xs text-text-meta">
          {checklist.met} / {checklist.total}
        </span>
      </div>
      {/* Meaning never rides on color alone: each row says terpenuhi /
          belum terpenuhi in text for screen readers (card §5). */}
      <ul className="mt-1.5">
        {checklist.items.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-2.5 border-b border-border-soft py-2 last:border-b-0"
          >
            {item.met ? (
              <span
                aria-hidden="true"
                className="grid size-5 shrink-0 place-items-center rounded-pill bg-success text-[11px] font-bold text-surface"
              >
                ✓
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="grid size-5 shrink-0 place-items-center text-sm font-bold text-text-subtle"
              >
                ○
              </span>
            )}
            <span
              className={`text-[12.5px] leading-[1.45] ${
                item.met ? "text-text-muted" : "text-text"
              }`}
            >
              {item.label}
              <span className="sr-only">
                {" "}
                {item.met ? "terpenuhi" : "belum terpenuhi"}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {checklist.missing.length > 0 ? (
        <div className="mt-3 rounded-control bg-surface p-3">
          <p className="text-sm font-bold text-text">
            {checklist.missing.length} hal perlu dilengkapi
          </p>
          <ul className="mt-2 grid gap-1.5">
            {checklist.missing.map((line) => (
              <li
                key={line}
                className="text-[12px] leading-[1.5] text-text-muted"
              >
                · {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function CourseSettingsPanel({
  course,
  checklist,
  editable,
  onSubmit,
  banner,
  onBannerDismissed,
}: CourseSettingsPanelProps) {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<SettingsValues>();
  const { ref: registerTitleRef, ...titleProps } = register("title");
  const { ref: registerSummaryRef, ...summaryProps } = register("summary");
  const { ref: registerSlugRef, ...slugProps } = register("slug");

  const title = useWatch({ name: "title" }) ?? "";
  const summary = useWatch({ name: "summary" }) ?? "";
  const slug = useWatch({ name: "slug" }) ?? "";
  const isSequential = useWatch({ name: "isSequential" }) ?? false;

  return (
    <aside
      aria-labelledby="builder-settings-heading"
      className="min-w-0 rounded-card border border-border bg-surface p-6"
    >
      <h2
        id="builder-settings-heading"
        className="font-mono text-xs uppercase tracking-wide text-text-subtle"
      >
        Pengaturan kursus
      </h2>

      {banner ? (
        <div className="mt-4">
          <Banner
            tone={banner.tone}
            title={banner.title}
            description={banner.description}
            onDismissed={banner.tone === "success" ? onBannerDismissed : undefined}
          />
        </div>
      ) : null}

      {editable ? (
        <form
          id="course-settings-form"
          onSubmit={onSubmit}
          noValidate
          className="mt-4 flex flex-col gap-5"
        >
          <div>
            <LabelRow
              htmlFor="settings-title"
              label="Judul kursus"
              used={title.length}
              max={COURSE_TITLE_MAX}
            />
            <Input
              id="settings-title"
              className="mt-2"
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "settings-title-error" : undefined}
              ref={registerTitleRef}
              {...titleProps}
            />
            <FieldError id="settings-title-error" message={errors.title?.message} />
          </div>

          <div>
            <LabelRow
              htmlFor="settings-summary"
              label="Ringkasan"
              used={summary.length}
              max={COURSE_SUMMARY_MAX}
            />
            <Textarea
              id="settings-summary"
              className="mt-2"
              aria-invalid={errors.summary ? true : undefined}
              aria-describedby={
                errors.summary ? "settings-summary-error" : undefined
              }
              ref={registerSummaryRef}
              {...summaryProps}
            />
            <FieldError
              id="settings-summary-error"
              message={errors.summary?.message}
            />
          </div>

          <div>
            <LabelRow
              htmlFor="settings-slug"
              label="Slug"
              used={slug.length}
              max={COURSE_SLUG_MAX}
            />
            <div className="mt-2 flex items-center gap-2">
              <span aria-hidden="true" className="font-mono text-sm text-text-muted">
                /kursus/
              </span>
              <Input
                id="settings-slug"
                className="font-mono"
                aria-invalid={errors.slug ? true : undefined}
                aria-describedby={errors.slug ? "settings-slug-error" : undefined}
                ref={registerSlugRef}
                {...slugProps}
              />
            </div>
            <FieldError id="settings-slug-error" message={errors.slug?.message} />
          </div>

          <CourseLevelField
            errorId="settings-level-error"
            error={errors.level?.message}
            registration={register("level")}
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-text">Urutan</span>
            <div className="flex items-center gap-2.5">
              <Toggle
                checked={isSequential}
                onCheckedChange={(checked) =>
                  setValue("isSequential", checked, { shouldValidate: true })
                }
                aria-labelledby="settings-sequential-label"
              />
              {/* The feature name, not a state echo: the switch's on/off
                  state (announced by the switch role) says whether the
                  course IS "Wajib berurutan" (CRS-08). */}
              <span id="settings-sequential-label" className="text-sm text-text">
                Wajib berurutan
              </span>
            </div>
          </div>

          <dl className="flex flex-col gap-4 border-t border-border-soft pt-5">
            {readonlyRows(course).map((row) => (
              <div key={row.label}>
                <dt className="text-sm font-bold text-text">{row.label}</dt>
                <dd className="mt-1 text-sm text-text-muted">{row.value}</dd>
              </div>
            ))}
          </dl>

          <ChecklistBlock checklist={checklist} />
        </form>
      ) : (
        <>
          <p className="mt-4 text-sm text-text-muted">{LOCKED_NOTICE}</p>
          <dl className="mt-4 flex flex-col gap-4">
            <div>
              <dt className="text-sm font-bold text-text">Judul kursus</dt>
              <dd className="mt-1 wrap-anywhere text-sm text-text-muted">
                {course.title}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-text">Ringkasan</dt>
              <dd className="mt-1 text-sm text-text-muted">
                {course.summary ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-text">Slug</dt>
              <dd className="mt-1 wrap-anywhere font-mono text-sm text-text-muted">
                /kursus/{course.slug}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-text">Level</dt>
              <dd className="mt-1 text-sm text-text-muted">
                {COURSE_LEVEL_LABELS[course.level]}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-text">Urutan</dt>
              <dd className="mt-1 text-sm text-text-muted">
                {course.isSequential
                  ? "Wajib berurutan"
                  : "Tidak wajib berurutan"}
              </dd>
            </div>
            {readonlyRows(course).map((row) => (
              <div key={row.label}>
                <dt className="text-sm font-bold text-text">{row.label}</dt>
                <dd className="mt-1 text-sm text-text-muted">{row.value}</dd>
              </div>
            ))}
          </dl>
          <ChecklistBlock checklist={checklist} />
        </>
      )}
    </aside>
  );
}
