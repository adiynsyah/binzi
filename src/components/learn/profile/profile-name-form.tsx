"use client";

// ProfileNameForm (card S5-05 §5.3, screens 9c/9e) — the Data akun edit
// form: name (PATCH /api/user/profile, body exactly { name }) beside the
// read-only email display, plus the verified row. Two columns ≥ 640 (`sm:`,
// owner decision 22 Nov — `md:` stays reserved for the learn bottom nav),
// stacked below.
//
// 401 keeps the exact StartCourseButton session-ended copy; success
// banners "Nama disimpan." and router.refresh() re-renders the server
// tree so the identity row and the header pill pick the new name up.
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateNameInput } from "@/modules/user/schema";

const SESSION_ENDED_MESSAGE =
  "Sesi Anda berakhir. Muat ulang halaman untuk masuk lagi.";
const GENERIC_MESSAGE = "Terjadi kesalahan. Coba lagi.";

type NameValues = { name: string };

type Feedback = { tone: "success" | "error"; message: string };

export type ProfileNameFormProps = {
  name: string;
  email: string;
  emailVerified: boolean;
};

export function ProfileNameForm({
  name,
  email,
  emailVerified,
}: ProfileNameFormProps) {
  const router = useRouter();
  // In-flight guard IN the handler, not just the disabled attribute —
  // loading sets disabled only after the state commit (7 Nov lesson 6).
  const inFlight = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NameValues>({
    resolver: standardSchemaResolver(updateNameInput),
    defaultValues: { name },
  });
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Named handler + `void handleSubmit(...)(event)` in the JSX (the CMS
  // dialog pattern): react-hooks/refs flags a ref-reading closure passed
  // straight into handleSubmit during render.
  async function submitValidated(values: NameValues): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    // Fresh attempt: drop the old banner so a new failure remounts
    // role="alert" instead of mutating the old one.
    setFeedback(null);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: values.name }),
      });
      if (response.ok) {
        setFeedback({ tone: "success", message: "Nama disimpan." });
        router.refresh();
        return;
      }
      setFeedback(
        response.status === 401
          ? { tone: "error", message: SESSION_ENDED_MESSAGE }
          : { tone: "error", message: GENERIC_MESSAGE },
      );
    } catch {
      setFeedback({ tone: "error", message: GENERIC_MESSAGE });
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(submitValidated)(event);
      }}
      noValidate
    >
      {feedback ? (
        <div className="mb-4">
          <Banner tone={feedback.tone} title={feedback.message} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama lengkap" error={errors.name?.message}>
          <Input
            autoComplete="name"
            disabled={isSubmitting}
            {...register("name")}
          />
        </Field>
        {/* Display-only: readOnly, no name attribute (never submitted), and
            out of the tab order so keyboard users are not stopped on a
            field they cannot edit. */}
        <Field label="Email">
          <Input
            type="email"
            readOnly
            tabIndex={-1}
            value={email}
            className="bg-fill-soft"
          />
        </Field>
      </div>

      {emailVerified ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-success">
          <Check aria-hidden="true" className="size-4" />
          Email terverifikasi
        </p>
      ) : null}

      <div className="mt-5">
        <Button
          type="submit"
          className="w-full sm:w-auto"
          loading={isSubmitting}
          loadingLabel="Menyimpan…"
        >
          Simpan perubahan
        </Button>
      </div>
    </form>
  );
}
