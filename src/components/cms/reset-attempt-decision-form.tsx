"use client";

// Decision form for a PENDING report (card S3-03 §6, screen 26b; owner
// decision 28 Nov). NOTHING is preselected — approving is an irreversible
// reset and each quiz can be reset once — which departs from 26b:
// - no choice yet: a `dark` button "Simpan keputusan"; submitting shows the
//   group error "Pilih keputusan." on the fieldset (aria-describedby +
//   aria-invalid), focuses the first radio, and never calls fetch;
// - a choice made: a `primary` button "Setujui & reset attempt" /
//   "Tolak laporan"; the consequence checklist shows for "Setujui" only.
// The rules are the server's own decideReportInput. 409 shows the server's
// message in a Banner; success resets the form and refreshes the page
// (which then renders the read-only decision). The radios are NOT disabled
// while submitting: a disabled radio drops focus, which would undo the
// focus-on-error move (the inFlight ref blocks a double submit instead).
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  decideReportInput,
  type DecideReportInput,
} from "@/modules/recovery/schema";

import { ReasonFields } from "./reset-attempt-reason-fields";

const SESSION_ENDED_MESSAGE =
  "Sesi Anda berakhir. Muat ulang halaman untuk masuk lagi.";
const GENERIC_MESSAGE = "Terjadi kesalahan. Coba lagi.";

type FormValues = z.input<typeof decideReportInput>;

export type ResetAttemptDecisionFormProps = {
  number: number;
  scorePercent: number;
  /** "quiz materi 2" / "quiz Final" — the approve option's consequence. */
  quizWords: string;
};

/** Reads `error.message` from a JSON error body; null when absent. */
async function serverMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    return typeof body.error?.message === "string" ? body.error.message : null;
  } catch {
    return null;
  }
}

export function ResetAttemptDecisionForm({
  number,
  scorePercent,
  quizWords,
}: ResetAttemptDecisionFormProps) {
  const router = useRouter();
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = `${useId()}-decision-error`;
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, DecideReportInput>({
    resolver: standardSchemaResolver(decideReportInput),
    defaultValues: { reason: "", internalNote: "" },
    shouldFocusError: false,
  });
  const decision = useWatch({ control, name: "decision" });
  const [error, setError] = useState<string | null>(null);

  async function submitValidated(values: DecideReportInput): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const response = await fetch(
        `/api/cms/reset-attempt/reports/${number}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            decision: values.decision,
            reason: values.reason,
            ...(values.internalNote ? { internalNote: values.internalNote } : {}),
          }),
        },
      );
      if (response.ok) {
        reset();
        router.refresh();
        return;
      }
      if (response.status === 409) {
        setError((await serverMessage(response)) ?? GENERIC_MESSAGE);
      } else {
        setError(response.status === 401 ? SESSION_ENDED_MESSAGE : GENERIC_MESSAGE);
      }
    } catch {
      setError(GENERIC_MESSAGE);
    } finally {
      inFlight.current = false;
    }
  }

  function focusFirstInvalid(invalid: Record<string, unknown>): void {
    const form = formRef.current;
    if (!form) return;
    const target = invalid.decision
      ? form.querySelector<HTMLInputElement>('input[name="decision"]')
      : invalid.reason
        ? form.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')
        : form.querySelector<HTMLTextAreaElement>('textarea[name="internalNote"]');
    target?.focus();
  }

  const decisionError = errors.decision?.message;
  const options = [
    {
      value: "APPROVE" as const,
      title: "Setujui reset",
      detail: `Nilai ${scorePercent} dihapus, ${quizWords} dibuka lagi dari awal.`,
    },
    {
      value: "REJECT" as const,
      title: "Tolak",
      detail: `Nilai ${scorePercent} tetap berlaku.`,
    },
  ];

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        void handleSubmit(submitValidated, focusFirstInvalid)(event);
      }}
    >
      {error ? (
        <div className="mb-4">
          <Banner tone="error" title={error} />
        </div>
      ) : null}

      <fieldset
        aria-describedby={decisionError ? errorId : undefined}
        aria-invalid={decisionError ? true : undefined}
      >
        <legend className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-text-meta">
          Keputusan
        </legend>
        <div className="mt-3 space-y-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex min-h-(--height-touch-min) cursor-pointer items-start gap-3 rounded-control border border-border-strong bg-surface px-4 py-3",
                "has-[:checked]:border-text",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              )}
            >
              <input
                type="radio"
                value={option.value}
                className="mt-0.5 size-5 shrink-0 accent-primary"
                {...register("decision")}
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-bold text-text">{option.title}</span>
                <span className="block text-sm text-text-muted">{option.detail}</span>
              </span>
            </label>
          ))}
        </div>
        {decisionError ? (
          <p id={errorId} className="mt-2 text-sm text-danger">
            {decisionError}
          </p>
        ) : null}
      </fieldset>

      <div className="mt-5">
        <ReasonFields
          reason={register("reason")}
          internalNote={register("internalNote")}
          reasonError={errors.reason?.message}
          internalNoteError={errors.internalNote?.message}
          disabled={isSubmitting}
        />
      </div>

      <div className="mt-5">
        {decision === "APPROVE" || decision === "REJECT" ? (
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={isSubmitting}
            loadingLabel="Menyimpan…"
          >
            {decision === "APPROVE" ? "Setujui & reset attempt" : "Tolak laporan"}
          </Button>
        ) : (
          <Button type="submit" variant="dark" className="w-full">
            Simpan keputusan
          </Button>
        )}
      </div>

      {decision === "APPROVE" ? (
        <ul className="mt-4 space-y-2 rounded-card border border-border bg-surface p-4 text-sm text-text-body">
          {[
            `Nilai ${scorePercent} hilang dari Nilai Saya`,
            "Nilai quiz lain tidak berubah",
            "Tercatat di audit log: admin, waktu, alasan",
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
