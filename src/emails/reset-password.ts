// Email atur ulang password (card A-10, layar 15a — copy final).
//
// Token sekali pakai, berlaku 1 jam (AUTH-04); kotak peringatan menyebut
// masa berlaku plus perangkat dan waktu permintaan. Perangkat hanya
// kategori kasar dari User-Agent (browser/OS) — tidak ada geo, jadi kota
// tidak disebut (data kota tidak boleh dikarang).
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

/** Formats a timestamp in WIB as "3 Okt 2026 14.05 WIB" (design 15a). */
export function formatWib(date: Date): string {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date);
  return `${formatted.replace(/,\s*/, " ")} WIB`;
}

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
