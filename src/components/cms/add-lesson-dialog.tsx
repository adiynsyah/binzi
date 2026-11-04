"use client";

/*
 * "Tambah materi" dialog (card S1-02 §4, screen 21h): one field — the
 * lesson title. Placement is FIXED text ("Di akhir — jadi materi n"):
 * "Setelah materi…" is S1-02b, so no chooser is rendered.
 *
 * Two 21h sentences are deliberately NOT shown (card §4, listed in the
 * PR): "Urutan tetap bisa diseret di outline kapan saja." (reordering is
 * S1-02b) and "Kursus yang sudah terbit tidak ikut berubah…" (the builder
 * locks outside DRAFT). The "(CRS-06)" in the design note is an
 * annotation, not copy.
 *
 * Client pattern of the S1-01 dialog: shared Zod contract via
 * standardSchemaResolver, server field errors through setError with focus
 * on the invalid field, softDisabled + loading with a handler-level
 * double-submit guard, and — after 201 — the guard and loading state stay
 * HELD until the route change lands (jsdom never navigates, so the unit
 * test exercises exactly that window).
 */

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FieldError, LabelRow } from "@/components/cms/form-fields";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createLessonInput,
  LESSON_TITLE_MAX,
} from "@/modules/lesson/schema";

type AddLessonValues = { title: string };

type ApiFieldError = { path: string; message: string };

// Agent copy (not from a design screen) — listed in the PR.
const GENERIC_ERROR_TITLE = "Materi belum bisa dibuat.";
const GENERIC_ERROR_DESCRIPTION =
  "Periksa koneksi Anda lalu coba lagi. Isian Anda masih ada di formulir ini.";

export type AddLessonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle: string;
  /** order_index the new lesson gets: outline length + 1 (card §4). */
  nextOrderIndex: number;
};

export function AddLessonDialog({
  open,
  onOpenChange,
  courseId,
  courseTitle,
  nextOrderIndex,
}: AddLessonDialogProps) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  // Set on 201 and NEVER reset: stays loading ("Membuat materi…") until
  // the route change lands; the double-submit guard holds the same window.
  const [navigating, setNavigating] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AddLessonValues>({
    resolver: standardSchemaResolver(createLessonInput),
    defaultValues: { title: "" },
    shouldFocusError: false,
  });

  // useWatch per field, not useForm's watch(): the returned function
  // cannot be memoized safely (react-hooks/compiler warning).
  const title = useWatch({ control, name: "title" }) ?? "";
  const { ref: registerTitleRef, ...titleProps } = register("title");
  const titleRef = useRef<HTMLInputElement | null>(null);

  function focusTitle(): void {
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  // Handler-level double-submit guard: softDisabled stays clickable.
  const inFlight = useRef(false);

  async function submitValidated(values: AddLessonValues): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setFailed(false);
    try {
      const response = await fetch(`/api/cms/courses/${courseId}/lessons`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });

      if (response.status === 201) {
        const json = (await response.json()) as { data: { id: string } };
        setNavigating(true);
        router.push(`/cms/kursus/${courseId}/materi/${json.data.id}`);
        return; // guard + loading stay held until navigation unmounts
      }

      if (response.status === 400) {
        const json = (await response.json()) as {
          error?: { fields?: ApiFieldError[] };
        };
        const fields = json.error?.fields ?? [];
        for (const field of fields) {
          setError(
            field.path as keyof AddLessonValues,
            { type: "server", message: field.message },
            { shouldFocus: false },
          );
        }
        if (fields.some((field) => field.path === "title")) focusTitle();
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    }
    // Every non-201 path lands here: only failures release the guard.
    inFlight.current = false;
  }

  function submitInvalid(clientErrors: Record<string, unknown>): void {
    if ("title" in clientErrors) focusTitle();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Tambah materi">
        {/* 21h eyebrow: course title · "Materi baru", mono uppercase, one
            truncated line — never wraps into a tall block. pr-11 on the
            wrapper clears the absolute ✕ (right-3 + 44px) exactly like the
            dialog Title; inside, only the COURSE TITLE truncates — the
            suffix is shrink-0 (whitespace-pre keeps its leading space,
            which a flex item would otherwise collapse). The ids anchor the
            w360 e2e no-underlap assertion. */}
        <div className="order-first pr-11">
          <p
            id="add-lesson-eyebrow"
            className="flex w-fit min-w-0 max-w-full font-mono text-xs uppercase tracking-wide text-text-subtle"
          >
            <span className="min-w-0 truncate">{courseTitle}</span>
            <span
              id="add-lesson-eyebrow-suffix"
              className="shrink-0 whitespace-pre"
            >
              {" · Materi baru"}
            </span>
          </p>
        </div>

        <form
          onSubmit={(event) => {
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
            <LabelRow
              htmlFor="add-lesson-title"
              label="Judul materi"
              used={title.length}
              max={LESSON_TITLE_MAX}
            />
            <Input
              id="add-lesson-title"
              className="mt-2"
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={
                errors.title ? "add-lesson-title-error" : undefined
              }
              ref={(element) => {
                registerTitleRef(element);
                titleRef.current = element;
              }}
              {...titleProps}
            />
            <FieldError
              id="add-lesson-title-error"
              message={errors.title?.message}
            />
          </div>

          <div>
            <p className="text-sm font-bold text-text">Letakkan</p>
            {/* Fixed placement, styled like the SELECTED 21h option row: a
                thick radio-style dot at the left — NOT a bordered box,
                which read as a focused input. "Setelah materi…"
                (placement chooser) is S1-02b; the row stays
                non-interactive. */}
            <p className="mt-2 flex min-h-11 items-center gap-3 text-sm font-bold text-text">
              <span
                aria-hidden="true"
                className="size-6 shrink-0 rounded-pill border-[5px] border-text"
              />
              Di akhir — jadi materi {nextOrderIndex}
            </p>
          </div>

          <p className="rounded-control bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-text-muted">
            Setelah dibuat, materi ini otomatis punya{" "}
            <strong className="text-text">satu quiz kosong</strong>.
          </p>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row-reverse">
            <Button
              type="submit"
              loading={isSubmitting || navigating}
              loadingLabel="Membuat materi…"
              softDisabled={isSubmitting || navigating}
            >
              Buat &amp; buka editor →
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
