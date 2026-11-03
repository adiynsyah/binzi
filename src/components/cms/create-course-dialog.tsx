"use client";

/*
 * "Kursus baru" dialog (card S1-01, screen 21f): the short creation form —
 * title, slug (auto from the title, editable via "Ubah"), level, summary.
 * On success it routes straight into the empty builder (21g).
 *
 * Validation rules come from the SHARED server contract (createCourseInput
 * in @/modules/course/schema) via standardSchemaResolver, so the client and
 * the server enforce the exact same rules. Server field errors (400
 * VALIDATION_ERROR + fields) are attached with setError and focus moves to
 * the first invalid control (21f: "Galat baru muncul setelah tombol
 * ditekan, lalu fokus pindah ke isian pertama yang salah. Tombol tidak
 * pernah dinonaktifkan diam-diam."). A slug error first OPENS slug edit
 * mode, then focuses the slug input.
 *
 * The submit button is softDisabled + double-submit-guarded in the handler
 * (a ref, because softDisabled deliberately stays clickable) — never
 * silently disabled.
 */

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  COURSE_LEVELS,
  COURSE_LEVEL_LABELS,
  COURSE_SLUG_MAX,
  COURSE_SUMMARY_MAX,
  COURSE_TITLE_MAX,
  createCourseInput,
  slugifyCourseSlug,
  type CourseLevel,
} from "@/modules/course/schema";

type CreateCourseValues = {
  title: string;
  slug: string;
  level: CourseLevel;
  summary: string;
};

type ApiFieldError = { path: string; message: string };

// Agent copy (not from a design screen) — listed in the PR.
const GENERIC_ERROR_TITLE = "Kursus belum bisa dibuat.";
const GENERIC_ERROR_DESCRIPTION =
  "Periksa koneksi Anda lalu coba lagi. Isian tetap tersimpan di formulir ini.";

function LabelRow({
  htmlFor,
  label,
  used,
  max,
}: {
  htmlFor: string;
  label: string;
  used: number;
  max: number;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <label htmlFor={htmlFor} className="text-sm font-bold text-text">
        {label}
      </label>
      <span className="font-mono text-xs text-text-meta">
        {used} / {max}
      </span>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-sm text-danger">
      {message}
    </p>
  );
}

export type CreateCourseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateCourseDialog({ open, onOpenChange }: CreateCourseDialogProps) {
  const router = useRouter();
  const [slugEdited, setSlugEdited] = useState(false);
  const [failed, setFailed] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateCourseValues>({
    resolver: standardSchemaResolver(createCourseInput),
    defaultValues: { title: "", slug: "", level: "BEGINNER", summary: "" },
    // The focus pass below owns focus movement (21f) — including opening
    // slug edit mode first — so RHF's own focus-on-error stays off (it
    // would try to focus the hidden preview-mode slug input).
    shouldFocusError: false,
  });

  // 21f: the slug fills automatically from the title until "Ubah" is used.
  // useWatch (not formState/destructured watch) — safe to read per field.
  const title = useWatch({ control, name: "title" });
  const slug = useWatch({ control, name: "slug" });
  const summary = useWatch({ control, name: "summary" });
  useEffect(() => {
    if (!slugEdited) {
      setValue("slug", slugifyCourseSlug(title), { shouldValidate: false });
    }
  }, [title, slugEdited, setValue]);

  // Refs for the focus pass; each merges RHF's register ref.
  const titleRef = useRef<HTMLInputElement | null>(null);
  const slugRef = useRef<HTMLInputElement | null>(null);
  const levelRef = useRef<HTMLFieldSetElement | null>(null);
  const summaryRef = useRef<HTMLTextAreaElement | null>(null);

  const { ref: registerTitleRef, ...titleProps } = register("title");
  const { ref: registerSlugRef, ...slugProps } = register("slug");
  const { ref: registerSummaryRef, ...summaryProps } = register("summary");
  const { ref: registerLevelRef, ...levelProps } = register("level");

  function focusFirstInvalid(paths: string[]) {
    const order = ["title", "slug", "level", "summary"];
    const first = order.find((key) => paths.includes(key));
    if (first === undefined) return;
    if (first === "slug") {
      if (!slugEdited) setSlugEdited(true);
      requestAnimationFrame(() => slugRef.current?.focus());
      return;
    }
    if (first === "level") {
      requestAnimationFrame(() => {
        const fieldset = levelRef.current;
        const target =
          fieldset?.querySelector<HTMLInputElement>("input:checked") ??
          fieldset?.querySelector<HTMLInputElement>("input");
        target?.focus();
      });
      return;
    }
    requestAnimationFrame(() => {
      if (first === "title") titleRef.current?.focus();
      else summaryRef.current?.focus();
    });
  }

  // Handler-level double-submit guard: softDisabled keeps the button
  // clickable (C-08), so the guard lives here, not on the control.
  const inFlight = useRef(false);

  function beginSubmit(): boolean {
    if (inFlight.current) return false;
    inFlight.current = true;
    return true;
  }

  function endSubmit(): void {
    inFlight.current = false;
  }

  async function submitValidated(values: CreateCourseValues): Promise<void> {
    if (!beginSubmit()) return;
    setFailed(false);
    try {
      const response = await fetch("/api/cms/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });

      if (response.status === 201) {
        const json = (await response.json()) as { data: { id: string } };
        router.push(`/cms/kursus/${json.data.id}`);
        return;
      }

      if (response.status === 400) {
        const json = (await response.json()) as {
          error?: { fields?: ApiFieldError[] };
        };
        const fields = json.error?.fields ?? [];
        for (const field of fields) {
          setError(
            field.path as keyof CreateCourseValues,
            { type: "server", message: field.message },
            { shouldFocus: false },
          );
        }
        focusFirstInvalid(fields.map((field) => field.path));
        return;
      }

      // Network failure / 5xx / anything else: generic banner, values kept.
      setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      endSubmit();
    }
  }

  // Client-side validation failed: the same 21f focus pass runs against the
  // field names (this is also what opens slug edit mode when the auto-slug
  // itself is invalid).
  function submitInvalid(clientErrors: Record<string, unknown>): void {
    focusFirstInvalid(Object.keys(clientErrors));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Mulai kursus baru"
        description="Cukup tiga hal ini dulu. Materi, sampul, dan Final Quiz diisi di halaman kursus setelahnya."
      >
        <p className="order-first font-mono text-xs uppercase tracking-wide text-text-subtle">
          Kursus baru · Langkah 1 dari 1
        </p>

        <form
          onSubmit={(event) => {
            // Called inside the event handler so the ref reads in
            // submitValidated/beginSubmit are provably event-time (the
            // react-hooks/refs rule cannot see through handleSubmit()).
            void handleSubmit(submitValidated, submitInvalid)(event);
          }}
          className="mt-4 flex flex-col gap-5"
          noValidate
        >
          {failed ? (
            <Banner
              tone="error"
              title={GENERIC_ERROR_TITLE}
              description={GENERIC_ERROR_DESCRIPTION}
            />
          ) : null}

          <div>
            <LabelRow htmlFor="course-title" label="Judul kursus" used={title.length} max={COURSE_TITLE_MAX} />
            <Input
              id="course-title"
              className="mt-2"
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "course-title-error" : undefined}
              ref={(element) => {
                registerTitleRef(element);
                titleRef.current = element;
              }}
              {...titleProps}
            />
            <FieldError id="course-title-error" message={errors.title?.message} />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-text">Alamat kursus</span>
              <span className="font-mono text-xs text-text-meta">
                {slug.length} / {COURSE_SLUG_MAX}
              </span>
            </div>
            {slugEdited ? (
              <div className="mt-2 flex items-center gap-2">
                <span aria-hidden="true" className="font-mono text-sm text-text-muted">
                  /kursus/
                </span>
                <Input
                  id="course-slug"
                  aria-label="Slug kursus"
                  aria-invalid={errors.slug ? true : undefined}
                  aria-describedby={errors.slug ? "course-slug-error" : undefined}
                  ref={(element) => {
                    registerSlugRef(element);
                    slugRef.current = element;
                  }}
                  {...slugProps}
                />
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate font-mono text-sm text-text-muted">
                  /kursus/{slug || "…"}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSlugEdited(true);
                    requestAnimationFrame(() => slugRef.current?.focus());
                  }}
                >
                  Ubah
                </Button>
                {/* Keeps "slug" registered in preview mode so both client
                    validation and server errors have a live field. */}
                <input type="hidden" {...slugProps} ref={registerSlugRef} />
              </div>
            )}
            <FieldError id="course-slug-error" message={errors.slug?.message} />
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-text">Level</legend>
            <div className="mt-2 flex flex-col gap-2">
              {COURSE_LEVELS.map((level) => (
                <label
                  key={level}
                  className="flex min-h-11 items-center gap-3 text-sm text-text-body"
                >
                  <input
                    type="radio"
                    value={level}
                    className="size-4 accent-primary"
                    ref={(element) => {
                      registerLevelRef(element);
                      if (element && !levelRef.current) {
                        levelRef.current = element.closest("fieldset");
                      }
                    }}
                    {...levelProps}
                  />
                  {COURSE_LEVEL_LABELS[level]}
                </label>
              ))}
            </div>
            <FieldError id="course-level-error" message={errors.level?.message} />
          </fieldset>

          <div>
            <LabelRow htmlFor="course-summary" label="Ringkasan" used={summary.length} max={COURSE_SUMMARY_MAX} />
            <Textarea
              id="course-summary"
              className="mt-2"
              placeholder="Satu atau dua kalimat — tampil di kartu katalog"
              aria-invalid={errors.summary ? true : undefined}
              aria-describedby={
                errors.summary ? "course-summary-error" : "course-summary-hint"
              }
              ref={(element) => {
                registerSummaryRef(element);
                summaryRef.current = element;
              }}
              {...summaryProps}
            />
            {errors.summary ? (
              <FieldError id="course-summary-error" message={errors.summary?.message} />
            ) : (
              <p id="course-summary-hint" className="mt-2 text-sm text-text-meta">
                Tampil di kartu katalog &amp; hasil pencarian. Deskripsi lengkap
                diisi nanti.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
            <p className="text-sm text-text-muted sm:flex-1">
              Disimpan sebagai <strong className="text-text">Draf</strong> ·{" "}
              <strong className="text-text">penggarap: Anda</strong>
            </p>
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <Button
                type="submit"
                loading={isSubmitting}
                loadingLabel="Membuat kursus…"
                softDisabled={isSubmitting}
              >
                Buat &amp; lanjut isi materi →
              </Button>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
