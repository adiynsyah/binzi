"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";

import { FieldError } from "@/components/cms/form-fields";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  QUESTION_LIMITS,
  TRUE_FALSE_OPTIONS,
  questionInput,
  type QuestionType,
} from "@/modules/quiz/schema";
import type { QuizEditorQuestionDTO } from "@/modules/quiz/service";

/*
 * "Soal nn dari total" (card S1-09 §4, design 22b): the ONE form behind
 * "＋ Tambah soal" and every "Sunting soal nn". Server data seeds the state
 * on each open ONLY — the dialog is never keyed by it, so a
 * router.refresh() re-render never remounts (or resets) an open dialog.
 *
 * Type switch rules (decision 10): PG → B/S clears the key (B/S has its
 * own); B/S → PG restores the last PG key. PG option texts survive both
 * switches so an accidental toggle loses nothing. The B/S option texts are
 * always the fixed "Benar"/"Salah" (schema rule), never editable.
 *
 * Submits: "Simpan soal" (close) and "Simpan & tambah soal" (stay open,
 * cleared, title +1) share one form; the mode comes from
 * event.nativeEvent.submitter, so Enter in a textarea (submitter null →
 * newline is native; implicit submit gives no submitter → "Simpan soal")
 * can never produce add-mode.
 */

type ApiFieldError = { path: string; message: string };

const GENERIC_FAILURE = "Soal belum tersimpan — periksa koneksi lalu coba lagi.";
const CONFLICT_FALLBACK =
  "Kursus sudah bukan draf — soal quiz terkunci.";

type OptionTexts = [string, string, string, string];

type FieldErrors = {
  text?: string;
  explanation?: string;
  /** One slot per PG option (B/S never has per-option messages). */
  optionTexts: (string | null)[];
  /** Count / key / B-S-shape rules — rendered under the option list. */
  options?: string;
};

function emptyErrors(): FieldErrors {
  return { optionTexts: [null, null, null, null] };
}

function emptyOptionTexts(): OptionTexts {
  return ["", "", "", ""];
}

/** "01"–"99" — two digits everywhere (22b "SOAL 01 DARI 12", list rows). */
export function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export type QuestionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  /** The question being edited; null = a brand-new one. */
  question: QuizEditorQuestionDTO | null;
  /** Question count BEFORE this dialog's saves — the title's {total} base. */
  total: number;
  /**
   * The page h1 (tabIndex -1). On 409 the refresh flips the page to its
   * locked state, the opener button disappears, and closing the dialog
   * must land focus somewhere — there (card §4).
   */
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** "save" → the parent closes; "add" keeps the dialog open itself. */
  onSaved: (mode: "save" | "add") => void;
};

export function QuestionDialog({
  open,
  onOpenChange,
  quizId,
  question,
  total,
  headingRef,
  onSaved,
}: QuestionDialogProps) {
  const router = useRouter();

  const [type, setType] = useState<QuestionType>("SINGLE_CHOICE");
  const [text, setText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [optionTexts, setOptionTexts] = useState<OptionTexts>(
    emptyOptionTexts,
  );
  const [keyIndex, setKeyIndex] = useState<number | null>(null);
  const [seq, setSeq] = useState({ nn: 1, total: 1 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>(emptyErrors);
  const [conflict, setConflict] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Latest props, read by the open-transition effect without joining its
  // dependency array (a refresh mid-dialog must not re-seed the fields).
  const questionRef = useRef(question);
  questionRef.current = question;
  const totalRef = useRef(total);
  totalRef.current = total;

  const inFlight = useRef(false);
  const lastPgKey = useRef<number | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const explanationRef = useRef<HTMLTextAreaElement | null>(null);
  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);
  const firstKeyRadioRef = useRef<HTMLInputElement | null>(null);

  // Seed every field from the edited question on each OPEN. ✕/Esc close
  // without confirmation (card §4) — unsaved edits are deliberately lost.
  useEffect(() => {
    if (!open) return;
    const current = questionRef.current;
    if (current === null) {
      setEditingId(null);
      setType("SINGLE_CHOICE");
      setOptionTexts(emptyOptionTexts());
      setKeyIndex(null);
      lastPgKey.current = null;
      setText("");
      setExplanation("");
      setSeq({ nn: totalRef.current + 1, total: totalRef.current + 1 });
    } else {
      setEditingId(current.id);
      setType(current.type);
      setText(current.text);
      setExplanation(current.explanation);
      const correct = current.options.filter((o) => o.isCorrect);
      const firstKey = current.options.findIndex((o) => o.isCorrect);
      const key =
        correct.length === 1 && firstKey !== -1 ? firstKey : null;
      setKeyIndex(key);
      if (current.type === "SINGLE_CHOICE") {
        const [a = "", b = "", c = "", d = ""] = current.options.map(
          (o) => o.text,
        );
        setOptionTexts([a, b, c, d]);
        lastPgKey.current = key;
      } else {
        setOptionTexts(emptyOptionTexts());
        lastPgKey.current = null;
      }
      setSeq({ nn: current.orderIndex, total: totalRef.current });
    }
    setErrors(emptyErrors());
    setConflict(null);
    setFailed(false);
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }, [open]);

  function onTypeChange(next: QuestionType): void {
    if (next === type) return;
    if (type === "SINGLE_CHOICE") {
      lastPgKey.current = keyIndex;
    }
    setType(next);
    setKeyIndex(next === "TRUE_FALSE" ? null : lastPgKey.current);
  }

  function setOptionText(index: number, value: string): void {
    setOptionTexts((previous) => {
      const next = [...previous] as OptionTexts;
      next[index] = value;
      return next;
    });
  }

  function currentInput() {
    const options =
      type === "SINGLE_CHOICE"
        ? optionTexts.map((value, index) => ({
            text: value,
            isCorrect: keyIndex === index,
          }))
        : TRUE_FALSE_OPTIONS.map((value, index) => ({
            text: value,
            isCorrect: keyIndex === index,
          }));
    return { type, text, explanation, options };
  }

  /** First wrong field, card §4 order: pertanyaan → opsi → kunci → pembahasan. */
  function focusFirstError(next: FieldErrors): void {
    requestAnimationFrame(() => {
      if (next.text) {
        textRef.current?.focus();
        return;
      }
      const firstOption = next.optionTexts.findIndex((m) => m !== null);
      if (firstOption !== -1) {
        optionRefs.current[firstOption]?.focus();
        return;
      }
      if (next.options) {
        firstKeyRadioRef.current?.focus();
        return;
      }
      if (next.explanation) {
        explanationRef.current?.focus();
      }
    });
  }

  /** Map issues (client parse) or joined-path fields (server 400) onto the
   *  form. Returns false when nothing matched → the generic banner. */
  function applyFieldMessages(
    entries: Iterable<{ path: PropertyKey[] | string; message: string }>,
  ): boolean {
    const next = emptyErrors();
    let mapped = false;
    for (const entry of entries) {
      const segments = Array.isArray(entry.path)
        ? entry.path.map(String)
        : entry.path.split(".");
      const [root, index, leaf] = segments;
      if (root === "text" && !next.text) {
        next.text = entry.message;
        mapped = true;
      } else if (root === "explanation" && !next.explanation) {
        next.explanation = entry.message;
        mapped = true;
      } else if (
        root === "options" &&
        index !== undefined &&
        leaf !== undefined &&
        /^\d+$/.test(index) &&
        leaf === "text" &&
        Number(index) < next.optionTexts.length &&
        !next.optionTexts[Number(index)]
      ) {
        next.optionTexts[Number(index)] = entry.message;
        mapped = true;
      } else if (root === "options" && index === undefined && !next.options) {
        next.options = entry.message;
        mapped = true;
      }
    }
    if (!mapped) return false;
    setErrors(next);
    focusFirstError(next);
    return true;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlight.current) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const mode: "save" | "add" =
      submitter instanceof HTMLButtonElement && submitter.dataset.mode === "add"
        ? "add"
        : "save";

    // Client-side contract (CLAUDE.md: Zod on both sides) — same schema,
    // same messages as the server.
    const parsed = questionInput.safeParse(currentInput());
    if (!parsed.success) {
      if (
        !applyFieldMessages(
          parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        )
      ) {
        setFailed(true);
      }
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setFailed(false);
    setConflict(null);
    setErrors(emptyErrors());
    try {
      const response = await fetch(
        editingId === null
          ? `/api/cms/quizzes/${quizId}/questions`
          : `/api/cms/quizzes/${quizId}/questions/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      if (response.status === 201 || response.status === 200) {
        if (mode === "add") {
          // Stay open as the NEXT new question (card §4): count + title move
          // up, every input clears, the type stays, focus → Pertanyaan.
          setEditingId(null);
          setSeq((previous) => ({
            nn: previous.nn + 1,
            total: previous.total + 1,
          }));
          setText("");
          setExplanation("");
          setOptionTexts(emptyOptionTexts());
          setKeyIndex(null);
          lastPgKey.current = null;
          requestAnimationFrame(() => textRef.current?.focus());
        } else {
          onSaved("save");
        }
        router.refresh();
        return;
      }

      if (response.status === 400) {
        const json = (await response.json().catch(() => null)) as {
          error?: { fields?: ApiFieldError[] };
        } | null;
        const fields = json?.error?.fields ?? [];
        if (!applyFieldMessages(fields)) {
          setFailed(true);
        }
      } else if (response.status === 409) {
        // Course left DRAFT under us: banner with the server copy, inputs
        // stay filled, both save buttons hidden; the refresh flips the page
        // to its locked state while the dialog stays open.
        const json = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setConflict(json?.error?.message ?? CONFLICT_FALLBACK);
        router.refresh();
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  const keyRowClass = (isKey: boolean): string =>
    `flex items-center gap-3 rounded-control border p-2 ${
      isKey
        ? "border-success bg-success-tint"
        : "border-border-strong bg-surface"
    }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Soal ${twoDigits(seq.nn)} dari ${seq.total}`}
        className="sm:max-w-[760px]"
        onCloseAutoFocus={(event) => {
          // 409 refresh removes the opener ("Sunting soal nn" lives only in
          // the editable state): focus the h1 instead. Normal closes let
          // Radix return focus to the opener.
          if (openerRef.current?.isConnected !== true) {
            event.preventDefault();
            headingRef.current?.focus();
          }
        }}
      >
        <form
          className="mt-5 flex flex-col gap-5"
          noValidate
          onSubmit={(event) => void onSubmit(event)}
        >
          {conflict ? <Banner tone="error" title={conflict} /> : null}
          {failed ? <Banner tone="error" title={GENERIC_FAILURE} /> : null}

          {/* Type — fixed per quiz on the page; editable here so a legacy
              B/S question can become PG, but never silently. */}
          <div className="flex sm:justify-end">
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <label
                htmlFor="question-type"
                className="shrink-0 text-sm font-bold text-text"
              >
                Tipe soal
              </label>
              <select
                id="question-type"
                value={type}
                onChange={(event) =>
                  onTypeChange(event.target.value as QuestionType)
                }
                className="h-11 min-w-0 flex-1 rounded-control border border-border-strong bg-surface px-3 text-sm font-bold text-text sm:flex-none"
              >
                <option value="SINGLE_CHOICE">Pilihan ganda</option>
                <option value="TRUE_FALSE">Benar/salah</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="question-text"
              className="block font-mono text-[11.5px] font-medium uppercase tracking-[0.08em] text-text-meta"
            >
              Pertanyaan
            </label>
            <Textarea
              id="question-text"
              ref={textRef}
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={QUESTION_LIMITS.textMax}
              aria-invalid={errors.text ? true : undefined}
              aria-describedby={errors.text ? "question-text-error" : undefined}
              className="mt-2"
            />
            <FieldError id="question-text-error" message={errors.text} />
          </div>

          <div>
            <p className="font-mono text-[11.5px] font-medium uppercase tracking-[0.08em] text-text-meta">
              Opsi jawaban · klik lingkaran untuk menandai kunci
            </p>
            <div
              role="radiogroup"
              aria-label="Kunci jawaban"
              className="mt-2 flex flex-col gap-2"
            >
              {type === "SINGLE_CHOICE"
                ? optionTexts.map((value, index) => {
                    const label = optionLetter(index);
                    const isKey = keyIndex === index;
                    return (
                      <div key={label}>
                        <div className={keyRowClass(isKey)}>
                          {/* The label wraps ONLY the circle — clicking an
                              option's text edits it, never picks the key. */}
                          <label
                            className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-pill border-2 ${
                              isKey
                                ? "border-success"
                                : "border-border-strong"
                            }`}
                          >
                            <input
                              type="radio"
                              name="question-key"
                              checked={isKey}
                              onChange={() => setKeyIndex(index)}
                              className="sr-only"
                              aria-label={`Kunci: opsi ${label}`}
                              ref={
                                index === 0 ? firstKeyRadioRef : undefined
                              }
                            />
                            {isKey ? (
                              <span
                                aria-hidden="true"
                                className="grid size-[22px] place-items-center rounded-pill bg-success"
                              >
                                <Check
                                  className="size-3.5 text-surface"
                                  strokeWidth={3}
                                />
                              </span>
                            ) : null}
                          </label>
                          <input
                            value={value}
                            onChange={(event) =>
                              setOptionText(index, event.target.value)
                            }
                            maxLength={QUESTION_LIMITS.optionMax}
                            aria-label={`Opsi ${label}`}
                            aria-invalid={
                              errors.optionTexts[index] ? true : undefined
                            }
                            aria-describedby={
                              errors.optionTexts[index]
                                ? `question-option-${index}-error`
                                : undefined
                            }
                            ref={(element) => {
                              optionRefs.current[index] = element;
                            }}
                            className="h-11 min-w-0 flex-1 rounded-control border border-border-strong bg-surface px-3 text-base text-text transition-colors duration-200 ease-out hover:border-text-subtle aria-invalid:border-2 aria-invalid:border-danger"
                          />
                          {isKey ? (
                            <span className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-success-tint-text">
                              Kunci
                            </span>
                          ) : (
                            <span
                              aria-hidden="true"
                              className="shrink-0 font-mono text-[11.5px] font-medium text-text-subtle"
                            >
                              {label}
                            </span>
                          )}
                        </div>
                        <FieldError
                          id={`question-option-${index}-error`}
                          message={errors.optionTexts[index] ?? undefined}
                        />
                      </div>
                    );
                  })
                : TRUE_FALSE_OPTIONS.map((value, index) => {
                    const isKey = keyIndex === index;
                    return (
                      <div key={value} className={keyRowClass(isKey)}>
                        <label
                          className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-pill border-2 ${
                            isKey
                              ? "border-success"
                              : "border-border-strong"
                          }`}
                        >
                          <input
                            type="radio"
                            name="question-key"
                            checked={isKey}
                            onChange={() => setKeyIndex(index)}
                            className="sr-only"
                            aria-label={`Kunci: ${value}`}
                            ref={index === 0 ? firstKeyRadioRef : undefined}
                          />
                          {isKey ? (
                            <span
                              aria-hidden="true"
                              className="grid size-[22px] place-items-center rounded-pill bg-success"
                            >
                              <Check
                                className="size-3.5 text-surface"
                                strokeWidth={3}
                              />
                            </span>
                          ) : null}
                        </label>
                        <p className="min-w-0 flex-1 text-base font-bold text-text">
                          {value}
                        </p>
                        {isKey ? (
                          <span className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-success-tint-text">
                            Kunci
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
            </div>
            <FieldError id="question-key-error" message={errors.options} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="question-explanation"
                className="font-mono text-[11.5px] font-medium uppercase tracking-[0.08em] text-text-meta"
              >
                Pembahasan
              </label>
              <span className="rounded-pill bg-danger-tint px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-danger">
                Wajib
              </span>
            </div>
            <Textarea
              id="question-explanation"
              ref={explanationRef}
              rows={4}
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              maxLength={QUESTION_LIMITS.explanationMax}
              aria-invalid={errors.explanation ? true : undefined}
              aria-describedby={
                errors.explanation ? "question-explanation-error" : undefined
              }
              className="mt-2"
            />
            <FieldError
              id="question-explanation-error"
              message={errors.explanation}
            />
          </div>

          {/* "Simpan soal" is FIRST in the DOM (implicit Enter submits it);
              sm:flex-row-reverse shows it rightmost like 22b. A 409 hides
              both — nothing more can be saved (card §4). */}
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row-reverse">
            {conflict ? null : (
              <>
                <Button
                  type="submit"
                  loading={saving}
                  loadingLabel="Menyimpan…"
                  className="sm:flex-1"
                >
                  Simpan soal
                </Button>
                <Button
                  type="submit"
                  data-mode="add"
                  variant="secondary"
                  softDisabled={saving}
                  className="sm:flex-1"
                >
                  Simpan &amp; tambah soal
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
