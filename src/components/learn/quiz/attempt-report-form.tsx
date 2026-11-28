"use client";

// AttemptReportForm (card S3-03 §5, screens 7i-1 / 7l) — "Apa yang
// terjadi?" + the short story, posted to
// POST /api/quiz/attempts/{attemptId}/report with exactly
// { category, description }. The rules are the server's own Zod contract
// (createReportInput), so a short story never reaches fetch.
//
// Success resets the form (a reopened form is empty) and refreshes the
// server tree — the page becomes the "menunggu" state. 409 / 401 / other
// failures show one error banner; 401 keeps the StartCourseButton copy.
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  createReportInput,
  type CreateReportInput,
} from "@/modules/recovery/schema";

const SESSION_ENDED_MESSAGE =
  "Sesi Anda berakhir. Muat ulang halaman untuk masuk lagi.";
const GENERIC_MESSAGE = "Terjadi kesalahan. Coba lagi.";
const ALREADY_REPORTED_MESSAGE = "Attempt ini sudah dilaporkan.";

type FormValues = z.input<typeof createReportInput>;

export type AttemptReportFormProps = {
  attemptId: string;
  /** "Batal" — back to the quiz page (its result screen). */
  cancelHref: string;
};

export function AttemptReportForm({ attemptId, cancelHref }: AttemptReportFormProps) {
  const router = useRouter();
  const inFlight = useRef(false);
  const baseId = useId();
  const categoryErrorId = `${baseId}-category-error`;
  const descriptionId = `${baseId}-description`;
  const descriptionErrorId = `${baseId}-description-error`;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, CreateReportInput>({
    resolver: standardSchemaResolver(createReportInput),
    // No category preselected: the participant must choose (7i).
    defaultValues: { description: "" },
  });
  const [error, setError] = useState<string | null>(null);

  async function submitValidated(values: CreateReportInput): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const response = await fetch(`/api/quiz/attempts/${attemptId}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: values.category,
          description: values.description,
        }),
      });
      if (response.ok) {
        reset();
        router.refresh();
        return;
      }
      setError(
        response.status === 409
          ? ALREADY_REPORTED_MESSAGE
          : response.status === 401
            ? SESSION_ENDED_MESSAGE
            : GENERIC_MESSAGE,
      );
    } catch {
      setError(GENERIC_MESSAGE);
    } finally {
      inFlight.current = false;
    }
  }

  const categoryError = errors.category?.message;
  const descriptionError = errors.description?.message;

  return (
    <form
      className="mt-6"
      noValidate
      onSubmit={(event) => {
        void handleSubmit(submitValidated)(event);
      }}
    >
      {error ? (
        <div className="mb-4">
          <Banner tone="error" title={error} />
        </div>
      ) : null}

      <fieldset
        aria-describedby={categoryError ? categoryErrorId : undefined}
        aria-invalid={categoryError ? true : undefined}
      >
        <legend className="text-sm font-bold text-text">Apa yang terjadi?</legend>
        <div className="mt-3 space-y-2">
          {REPORT_CATEGORIES.map((category) => (
            <label
              key={category}
              className={cn(
                "flex min-h-(--height-touch-min) cursor-pointer items-center gap-3 rounded-control border border-border-strong bg-surface px-4 py-3 text-[15px] text-text",
                "has-[:checked]:border-text has-[:checked]:font-bold",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              )}
            >
              <input
                type="radio"
                value={category}
                className="size-5 shrink-0 accent-primary"
                disabled={isSubmitting}
                {...register("category")}
              />
              <span>{REPORT_CATEGORY_LABELS[category]}</span>
            </label>
          ))}
        </div>
        {categoryError ? (
          <p id={categoryErrorId} className="mt-2 text-sm text-danger">
            {categoryError}
          </p>
        ) : null}
      </fieldset>

      <div className="mt-6">
        <label htmlFor={descriptionId} className="block text-sm text-text-muted">
          <span className="font-bold text-text">Ceritakan singkat</span> (wajib,
          min. 20 karakter)
        </label>
        <Textarea
          id={descriptionId}
          rows={4}
          className="mt-2"
          disabled={isSubmitting}
          aria-describedby={descriptionError ? descriptionErrorId : undefined}
          aria-invalid={descriptionError ? true : undefined}
          {...register("description")}
        />
        {descriptionError ? (
          <p id={descriptionErrorId} className="mt-2 text-sm text-danger">
            {descriptionError}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          variant="dark"
          loading={isSubmitting}
          loadingLabel="Mengirim…"
        >
          Kirim laporan
        </Button>
        <Link
          href={cancelHref}
          className={buttonVariants({ variant: "secondary" })}
        >
          Batal
        </Link>
      </div>

      <p className="mt-4 text-sm text-text-muted">
        Satu laporan per attempt. Laporan palsu dapat berujung penonaktifan akun
        (lihat{" "}
        <Link
          href="/syarat-ketentuan"
          className="font-bold text-primary-deep underline-offset-2 hover:underline"
        >
          Syarat &amp; Ketentuan
        </Link>
        ).
      </p>
    </form>
  );
}
