"use client";

/*
 * Course builder page body (card S1-02, screens 21a/21g): heading row
 * (title + status badge + "Simpan"), the materi outline, and the settings
 * panel. The page.tsx stays a thin server guard; this component receives
 * the whole builder DTO via props (review item 1).
 *
 * "Simpan" (secondary, 21a) sits in the heading row and connects to the
 * panel's form through the form="course-settings-form" attribute (card
 * §2). Its state — loading, softDisabled, the handler-level double-submit
 * guard, and the focus return — lives HERE next to the useForm that owns
 * the fields; the panel reads field state through FormProvider.
 *
 * Focus rules (card §2): after a response that does NOT move focus to an
 * invalid field, focus RETURNS to "Simpan" — `loading` sets the native
 * disabled attribute, which drops keyboard focus, so it is restored
 * explicitly. Field errors run the focus pass in FORM order (judul,
 * ringkasan, slug, level), targeting the panel's stable element ids.
 *
 * Concurrent editing: last writer wins (no version check in this card —
 * see the PR).
 */

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useForm, FormProvider } from "react-hook-form";

import { CMS_HEADING_CLASS } from "@/components/cms/cms-pages";
import { STATUS_BADGE } from "@/components/cms/course-status";
import { BadgeStatus } from "@/components/ui/badge-status";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import {
  updateCourseInput,
  type CourseLevel,
} from "@/modules/course/schema";
import type {
  CmsCourseBuilderDTO,
  CourseBuilderDTO,
} from "@/modules/course/service";

import { AddLessonDialog } from "./add-lesson-dialog";
import {
  PublishCourseDialog,
  SubmitCourseDialog,
  type StatusBannerState,
} from "./course-publish-dialogs";
import { CourseSettingsPanel } from "./course-settings-panel";
import { LessonOutline } from "./lesson-outline";

export type SettingsValues = {
  title: string;
  slug: string;
  level: CourseLevel;
  summary: string;
  isSequential: boolean;
};

type ApiFieldError = { path: string; message: string };

// Agent copy (not from a design screen) — listed in the PR.
const GENERIC_ERROR_TITLE = "Pengaturan belum tersimpan.";
const GENERIC_ERROR_DESCRIPTION =
  "Periksa koneksi Anda lalu coba lagi. Isian Anda masih ada di formulir ini.";
const SAVED_BANNER = "Pengaturan tersimpan."; // card §2 copy usulan

/** Panel defaults from the builder DTO — also the reset target on 200. */
function settingsFrom(course: CmsCourseBuilderDTO): SettingsValues {
  return {
    title: course.title,
    slug: course.slug,
    level: course.level,
    summary: course.summary ?? "",
    isSequential: course.isSequential,
  };
}

export function CourseBuilder({ builder }: { builder: CourseBuilderDTO }) {
  const router = useRouter();
  const { course, outline, checklist, minQuestions, review, actions } = builder;
  const editable = course.status === "DRAFT";

  const [banner, setBanner] = useState<
    | { tone: "success" | "error"; title: string; description?: string }
    | null
  >(null);
  // Status banner under the heading row (card §4): the two gate dialogs,
  // the Simpan 409 lock (§5.1), and the add-lesson 409 (§5.2) report here —
  // in every width it sits next to the h1 that receives focus, unlike the
  // right-column panel banner that other Simpan results keep using.
  const [statusBanner, setStatusBanner] = useState<StatusBannerState | null>(
    null,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const form = useForm<SettingsValues>({
    resolver: standardSchemaResolver(updateCourseInput),
    defaultValues: settingsFrom(course),
    // The focus pass below owns focus movement, like the 21f dialog.
    shouldFocusError: false,
  });
  const {
    handleSubmit,
    setError,
    reset,
    formState: { isSubmitting, isDirty },
  } = form;

  // Focus pass by stable panel ids (the fields render in the panel across
  // the FormProvider boundary, so refs cannot be threaded through).
  function focusFirstInvalid(paths: string[]): void {
    const order = ["title", "summary", "slug", "level"];
    const first = order.find((key) => paths.includes(key));
    if (first === undefined) return;
    if (first === "level") {
      requestAnimationFrame(() => {
        const fieldset = document.getElementById("settings-level");
        const target =
          (fieldset?.querySelector<HTMLInputElement>("input:checked") ??
            fieldset?.querySelector<HTMLInputElement>("input")) ?? null;
        target?.focus();
      });
      return;
    }
    requestAnimationFrame(() => {
      document.getElementById(`settings-${first}`)?.focus();
    });
  }

  // Focus RETURN after responses that do not move focus to a field (card
  // §2). Only the response paths that own it ASK for it — a ref set where
  // the old focusSave() calls were (success, 409, generic, network). The
  // EFFECT consumes the ref after the commit that lifts `loading`'s
  // native disabled attribute (an in-handler rAF raced React's scheduler
  // and no-opped on the still-disabled button — caught by the CI e2e).
  // Gating on the banner alone would ALSO fire for client-invalid
  // submits (RHF toggles isSubmitting there too) and steal focus from
  // the first invalid field — the mutation-11 test pins that.
  const saveRef = useRef<HTMLButtonElement | null>(null);
  const pendingSaveFocus = useRef(false);
  useEffect(() => {
    if (pendingSaveFocus.current && !isSubmitting) {
      pendingSaveFocus.current = false;
      saveRef.current?.focus();
    }
  }, [isSubmitting, banner]);

  // Post-refresh focus (card §4/§5, owner review 5). ONE helper serves
  // every focus return: the opener while it is still connected, otherwise
  // the builder h1 (tabIndex -1) — a refresh that flips the page can
  // unmount the opener, and focus must never fall to <body>. The dialog
  // close paths call it through their focusReturn prop; the refresh paths
  // ALSO leave a request here, consumed when the refreshed props land.
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const publishRef = useRef<HTMLButtonElement | null>(null);
  const postRefreshFocus = useRef<{ pending: boolean; target: HTMLElement | null }>(
    { pending: false, target: null },
  );

  function focusOpenerElseHeading(target: HTMLElement | null): void {
    if (target !== null && target.isConnected) target.focus();
    else headingRef.current?.focus();
  }

  function requestPostRefreshFocus(target: HTMLElement | null): void {
    postRefreshFocus.current = { pending: true, target };
  }

  // Consumed on EVERY refresh: the dependency is the builder PROP identity
  // — each server render hands the page a new object, so this runs exactly
  // once per landed refresh (owner review 5).
  useEffect(() => {
    const request = postRefreshFocus.current;
    if (!request.pending) return;
    request.pending = false;
    focusOpenerElseHeading(request.target);
  }, [builder]);

  // The gate dialogs' response table (card §4): banner always, refresh +
  // post-refresh focus only for the statuses that can change the page.
  function handleGateOutcome(
    opener: HTMLElement | null,
    banner: StatusBannerState,
    refresh: boolean,
  ): void {
    setStatusBanner(banner);
    if (refresh) {
      router.refresh();
      requestPostRefreshFocus(opener);
    }
  }

  // Add-lesson 409 (§5.2): the dialog is gone after the status flip, so it
  // reports through this prop — status banner + refresh, focus to the h1
  // (every add button lives in now-read-only territory).
  function handleAddLessonConflict(message: string): void {
    setStatusBanner({ tone: "error", title: message });
    router.refresh();
    requestPostRefreshFocus(null);
  }

  // Handler-level double-submit guard: softDisabled stays clickable.
  const inFlight = useRef(false);

  async function submitValidated(values: SettingsValues): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setBanner(null);
    try {
      const response = await fetch(`/api/cms/courses/${course.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        const json = (await response.json()) as { data: CmsCourseBuilderDTO };
        // Reset to the SAVED values (not the typed ones): the server is
        // the source of truth, and reset() also clears the dirty state.
        reset(settingsFrom(json.data));
        setBanner({ tone: "success", title: SAVED_BANNER });
        router.refresh();
        pendingSaveFocus.current = true;
      } else if (response.status === 400) {
        const json = (await response.json()) as {
          error?: { fields?: ApiFieldError[] };
        };
        const fields = json.error?.fields ?? [];
        for (const field of fields) {
          setError(
            field.path as keyof SettingsValues,
            { type: "server", message: field.message },
            { shouldFocus: false },
          );
        }
        focusFirstInvalid(fields.map((field) => field.path));
      } else if (response.status === 409) {
        const json = (await response.json()) as {
          error?: { message?: string };
        };
        // §5.1: the lock message goes to the STATUS banner under the
        // heading — in 360 the settings panel sits far below the h1 that
        // receives focus, and the form is read-only after the refresh.
        setStatusBanner({
          tone: "error",
          title:
            json.error?.message ??
            "Kursus sudah bukan draf — hanya draf yang bisa diubah.",
        });
        // The refresh flips the page to its read-only shape (card §2).
        router.refresh();
        // TWO focus requests (owner review 4): Simpan right away — the
        // effect above — and a post-refresh one, because after the refresh
        // Simpan is unmounted and the h1 takes over.
        pendingSaveFocus.current = true;
        requestPostRefreshFocus(saveRef.current);
      } else {
        setBanner({
          tone: "error",
          title: GENERIC_ERROR_TITLE,
          description: GENERIC_ERROR_DESCRIPTION,
        });
        pendingSaveFocus.current = true;
      }
    } catch {
      setBanner({
        tone: "error",
        title: GENERIC_ERROR_TITLE,
        description: GENERIC_ERROR_DESCRIPTION,
      });
      pendingSaveFocus.current = true;
    }
    // No navigation on this form: every path releases the guard.
    inFlight.current = false;
  }

  function submitInvalid(clientErrors: Record<string, unknown>): void {
    focusFirstInvalid(Object.keys(clientErrors));
  }

  // Bound INSIDE the event handler (not at render level) so the
  // inFlight.current read in submitValidated is provably event-time — the
  // react-hooks/refs rule cannot see through handleSubmit() (same shape as
  // the 21f dialog).
  function onFormSubmit(event: FormEvent<HTMLFormElement>): void {
    void handleSubmit(submitValidated, submitInvalid)(event);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {/* min-w-0: an 80-char no-space title must not stretch the page
            sideways (A-19b). tabIndex -1: the post-refresh focus fallback
            lands here when an opener button unmounts. */}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className={`${CMS_HEADING_CLASS} min-w-0`}
        >
          {course.title}
        </h1>
        <BadgeStatus status={STATUS_BADGE[course.status]} />
        {(editable || actions.canSubmit || actions.canPublish) && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {editable ? (
              <Button
                ref={saveRef}
                type="submit"
                form="course-settings-form"
                variant="secondary"
                loading={isSubmitting}
                loadingLabel="Menyimpan…"
                softDisabled={isSubmitting}
              >
                Simpan
              </Button>
            ) : null}
            {actions.canSubmit ? (
              <Button
                ref={submitRef}
                type="button"
                variant="dark"
                onClick={() => setSubmitOpen(true)}
              >
                Kirim untuk persetujuan
              </Button>
            ) : null}
            {actions.canPublish ? (
              <Button
                ref={publishRef}
                type="button"
                variant="success"
                onClick={() => setPublishOpen(true)}
              >
                Setujui &amp; terbitkan
              </Button>
            ) : null}
          </div>
        )}
      </div>
      {statusBanner ? (
        <div className="mt-4">
          <Banner
            tone={statusBanner.tone}
            title={statusBanner.title}
            description={statusBanner.description}
            onDismissed={
              statusBanner.tone === "success"
                ? () => setStatusBanner(null)
                : undefined
            }
          />
        </div>
      ) : null}
      {course.summary ? (
        <p className="mt-2 max-w-(--width-measure) text-[15px] text-text-muted">
          {course.summary}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <LessonOutline
          courseId={course.id}
          outline={outline}
          isSequential={course.isSequential}
          minQuestions={minQuestions}
          finalQuiz={course.finalQuiz}
          editable={editable}
          onAddLesson={editable ? () => setAddOpen(true) : undefined}
        />

        <FormProvider {...form}>
          <CourseSettingsPanel
            course={course}
            checklist={checklist}
            editable={editable}
            onSubmit={onFormSubmit}
            banner={banner}
            onBannerDismissed={() => setBanner(null)}
          />
        </FormProvider>
      </div>

      {editable ? (
        <AddLessonDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          courseId={course.id}
          courseTitle={course.title}
          nextOrderIndex={outline.length + 1}
          onConflict={handleAddLessonConflict}
        />
      ) : null}

      {actions.canSubmit ? (
        <SubmitCourseDialog
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          courseId={course.id}
          checklist={checklist}
          settingsDirty={isDirty}
          focusReturn={() => focusOpenerElseHeading(submitRef.current)}
          onOutcome={(banner, refresh) =>
            handleGateOutcome(submitRef.current, banner, refresh)
          }
        />
      ) : null}
      {actions.canPublish ? (
        <PublishCourseDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          courseId={course.id}
          checklist={checklist}
          review={review}
          focusReturn={() => focusOpenerElseHeading(publishRef.current)}
          onOutcome={(banner, refresh) =>
            handleGateOutcome(publishRef.current, banner, refresh)
          }
        />
      ) : null}
    </div>
  );
}
