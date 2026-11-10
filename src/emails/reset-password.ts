// Email atur ulang password (card A-10, layar 15a — copy final).
//
// Token sekali pakai, berlaku 1 jam (AUTH-04); kotak peringatan menyebut
// masa berlaku plus perangkat dan waktu permintaan. Perangkat hanya
// kategori kasar dari User-Agent (browser/OS) — tidak ada geo, jadi kota
// tidak disebut (data kota tidak boleh dikarang).
import { formatWib } from "@/lib/datetime";

import {
  darkButton,
  escapeHtml,
  fallbackLinkBox,
  h1,
  httpUrl,
  p,
  reassurance,
  renderEmail,
  warningBox,
} from "./layout";

// Card S1-08 §6: formatWib moved to src/lib/datetime.ts (the CMS approval
// queue needs it server-side). Re-exported so src/emails/templates.test.ts
// keeps importing it from here unchanged.
export { formatWib };

export type RequestDevice = {
  browser: string;
  os: string;
};

export type ResetPasswordEmailInput = {
  recipientEmail: string;
  /** Reset action URL built by Better Auth. */
  url: string;
  /** Coarse browser/OS categories parsed from the requesting User-Agent. */
  device: RequestDevice | null;
  /** When the reset was requested (server clock). */
  requestedAt: Date;
};

function deviceLine(device: RequestDevice | null, requestedAt: Date): string {
  const when = formatWib(requestedAt);
  if (device) {
    return `Permintaan dibuat dari ${device.browser} di ${device.os} &middot; ${escapeHtml(when)}.`;
  }
  return `Permintaan dibuat pada ${escapeHtml(when)}.`;
}

export function resetPasswordEmail(input: ResetPasswordEmailInput) {
  const url = httpUrl(input.url);
  return renderEmail({
    subject: "Atur ulang password BINZI Anda",
    preheader: "Berlaku 1 jam",
    recipientEmail: input.recipientEmail,
    content: [
      h1("Atur ulang password Anda"),
      p(
        "Kami menerima permintaan atur ulang password untuk akun ini. Tekan tombol di bawah untuk membuat password baru.",
      ),
      darkButton("Buat password baru", url),
      warningBox(
        `<strong>Tautan berlaku 1 jam dan hanya bisa dipakai sekali</strong><br>${deviceLine(input.device, input.requestedAt)}`,
      ),
      fallbackLinkBox("Tombol tidak bekerja? Salin alamat ini:", null, url),
      reassurance(
        "Bukan Anda yang meminta?",
        "Abaikan email ini — password Anda tidak berubah. Kalau ini terjadi berulang, ganti password dan keluarkan sesi lain dari halaman Profil.",
      ),
    ].join(""),
  });
}
