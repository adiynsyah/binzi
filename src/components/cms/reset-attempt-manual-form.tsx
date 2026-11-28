"use client";

// Manual reset form (card S3-03 §6, screen 26c; decision 8). The looked-up
// user's quizzes as one radio group — NOTHING preselected (owner decision
// 28 Nov, same stance as 26b). Rows that cannot be reset stay visible but
// disabled, with the reason (decision 3 / decision 4). Picking a row that
// has a PENDING report shows the 26c warning with a link to that report.
// Then the shared reason fields and "Reset attempt". Success: Banner
// "Attempt direset.", form reset, page refresh (the row turns disabled).
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { manualResetInput } from "@/modules/recovery/schema";
import type { ManualQuizItemDTO } from "@/modules/recovery/service";

import { ReasonFields } from "./reset-attempt-reason-fields";

const SESSION_ENDED_MESSAGE =
  "Sesi Anda berakhir. Muat ulang halaman untuk masuk lagi.";
const GENERIC_MESSAGE = "Terjadi kesalahan. Coba lagi.";
const PICK_MESSAGE = "Pilih attempt yang direset.";

/** Client form contract: the server contract + the chosen attempt (which
 *  travels in the URL, not the body). */
const manualResetForm = manualResetInput.extend({
  attemptId: z.string({ error: PICK_MESSAGE }).min(1, PICK_MESSAGE),
});

type FormInput = z.input<typeof manualResetForm>;
type FormOutput = z.output<typeof manualResetForm>;
type Feedback = { tone: "success" | "error"; message: string };

async function serverMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    return typeof body.error?.message === "string" ? body.error.message : null;
  } catch {
    return null;
  }
}

export function ResetAttemptManualForm({ quizzes }: { quizzes: ManualQuizItemDTO[] }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = `${useId()}-attempt-error`;
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: standardSchemaResolver(manualResetForm),
    defaultValues: { reason: "", internalNote: "" },
    shouldFocusError: false,
  });
  const selectedId = useWatch({ control, name: "attemptId" });
  const selected = quizzes.find((item) => item.attemptId === selectedId) ?? null;
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function submitValidated(values: FormOutput): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/cms/reset-attempt/attempts/${values.attemptId}/reset`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reason: values.reason,
            ...(values.internalNote ? { internalNote: values.internalNote } : {}),
          }),
        },
      );
      if (response.ok) {
        reset();
        setFeedback({ tone: "success", message: "Attempt direset." });
        router.refresh();
        return;
      }
      if (response.status === 409) {
        setFeedback({
          tone: "error",
          message: (await serverMessage(response)) ?? GENERIC_MESSAGE,
        });
      } else {
        setFeedback({
          tone: "error",
          message: response.status === 401 ? SESSION_ENDED_MESSAGE : GENERIC_MESSAGE,
        });
      }
    } catch {
      setFeedback({ tone: "error", message: GENERIC_MESSAGE });
    } finally {
      inFlight.current = false;
    }
  }

  function focusFirstInvalid(invalid: Record<string, unknown>): void {
    const form = formRef.current;
    if (!form) return;
    const target = invalid.attemptId
      ? form.querySelector<HTMLInputElement>('input[name="attemptId"]:not(:disabled)')
      : invalid.reason
        ? form.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')
        : form.querySelector<HTMLTextAreaElement>('textarea[name="internalNote"]');
    target?.focus();
  }

  const attemptError = errors.attemptId?.message;

  return (
    <form
      ref={formRef}
      noValidate
      className="mt-6"
      onSubmit={(event) => {
        void handleSubmit(submitValidated, focusFirstInvalid)(event);
      }}
    >
      {feedback ? (
        <div className="mb-4">
          <Banner tone={feedback.tone} title={feedback.message} />
        </div>
      ) : null}

      <fieldset
        aria-describedby={attemptError ? errorId : undefined}
        aria-invalid={attemptError ? true : undefined}
      >
        <legend className="text-sm font-bold text-text">Pilih attempt yang direset</legend>
        <div className="mt-3 space-y-2">
          {quizzes.map((item) => {
            const disabled = !item.selectable || item.attemptId === null;
            return (
              <label
                key={item.quizId}
                className={cn(
                  "flex min-h-(--height-touch-min) items-start gap-3 rounded-control border px-4 py-3",
                  disabled
                    ? "cursor-not-allowed border-border bg-surface-2"
                    : "cursor-pointer border-border-strong bg-surface has-[:checked]:border-text has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                )}
              >
                <input
                  type="radio"
                  value={item.attemptId ?? ""}
                  disabled={disabled}
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                  {...register("attemptId")}
                />
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block wrap-anywhere text-[15px] font-bold",
                      disabled ? "text-text-muted" : "text-text",
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="block font-mono text-[11px] uppercase tracking-[0.06em] text-text-meta">
                    {item.meta}
                  </span>
                  {item.blockedLabel !== null && item.blockedLabel !== item.meta ? (
                    <span className="block font-mono text-[11px] uppercase tracking-[0.06em] text-text-meta">
                      {item.blockedLabel}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
        {attemptError ? (
          <p id={errorId} className="mt-2 text-sm text-danger">
            {attemptError}
          </p>
        ) : null}
      </fieldset>

      {selected?.pendingReportNumber != null ? (
        <p className="mt-4 rounded-control border border-warning-tint-line bg-pending-tint p-4 text-sm text-pending-tint-text">
          User ini punya laporan menunggu untuk attempt yang sama (
          <Link
            href={`/cms/reset-attempt/${selected.pendingReportNumber}`}
            className="font-bold underline underline-offset-2"
          >
            R-{selected.pendingReportNumber}
          </Link>
          ). Lebih baik putuskan dari laporannya agar user mendapat jawaban di
          halaman laporan.
        </p>
      ) : null}

      <div className="mt-6">
        <ReasonFields
          reason={register("reason")}
          internalNote={register("internalNote")}
          reasonError={errors.reason?.message}
          internalNoteError={errors.internalNote?.message}
          disabled={isSubmitting}
        />
      </div>

      <div className="mt-6">
        <Button
          type="submit"
          variant="primary"
          className="w-full sm:w-auto"
          loading={isSubmitting}
          loadingLabel="Mereset…"
        >
          Reset attempt
        </Button>
      </div>
    </form>
  );
}
