"use client";

import { useRouter } from "next/navigation";

import { Dialog, DialogContent, type DialogProps } from "../../ui/dialog";
import { Button } from "../../ui/button";

import { POST_LOGIN_DEFAULT_PATH } from "./constants";
import { GoogleButton } from "./google-button";

// Login modal for the middle of a learning flow (card A-13, screen 2c,
// PRD §7.4 A): the page context stays visible behind the scrim, so progress
// is never "lost" by asking for a sign-in. Built now, CONSUMED in S2 when
// the material pages exist.
//
// GENERIC COPY DEFAULT (card note h): enrollment-dependent wording — the
// material in the heading, the progress line and the auto-enroll footer —
// is only shown when the S2 caller passes `context`; without it every line
// is the generic version below.

export type LoginModalProps = {
  /** Dialog open state (Radix controlled). */
  open: DialogProps["open"];
  onOpenChange: DialogProps["onOpenChange"];
  googleEnabled: boolean;
  /** Internal path the user was trying to reach, e.g. /belajar/…. */
  nextPath?: string | null;
  /** S2 context: names the material in the heading ("Masuk untuk lanjut ke {contextTitle}"). */
  contextTitle?: string;
  /** S2 context: course name for the auto-enroll footer sentence. */
  courseName?: string;
};

export function LoginModal({
  open,
  onOpenChange,
  googleEnabled,
  nextPath = null,
  contextTitle,
  courseName,
}: LoginModalProps) {
  const router = useRouter();
  const target = nextPath ?? POST_LOGIN_DEFAULT_PATH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={
          contextTitle
            ? `Masuk untuk lanjut ke ${contextTitle}`
            : "Masuk untuk lanjut"
        }
        description="Progres Anda tetap tersimpan. Setelah masuk, Anda kembali ke halaman ini."
      >
        <div className="mt-6 space-y-3">
          {googleEnabled ? (
            <GoogleButton
              label="Lanjut dengan Google"
              variant="primary"
              callbackURL={target}
              errorCallbackURL={
                nextPath === null
                  ? "/masuk"
                  : `/masuk?next=${encodeURIComponent(nextPath)}`
              }
            />
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() =>
              router.push(
                nextPath === null
                  ? "/masuk"
                  : `/masuk?next=${encodeURIComponent(nextPath)}`,
              )
            }
          >
            Masuk dengan email
          </Button>
          <p className="pt-1 text-sm text-text-muted">
            {courseName
              ? `Belum punya akun? Mendaftar otomatis mendaftarkan Anda ke kursus ${courseName} — gratis.`
              : "Belum punya akun? Mendaftar gratis."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
