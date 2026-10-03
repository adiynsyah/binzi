// Email selamat datang (card A-10, layar 15a — copy final).
//
// Dikirim setelah verifikasi berhasil (AUTH-03 → afterEmailVerification).
// Kartu "DISARANKAN UNTUK ANDA" adalah blok berparameter; sampai modul
// kursus ada isinya, email dikirim TANPA kartu — judul kursus tidak boleh
// dikarang (PRD §13.4, isi desain hanya pengisi tata letak).
import {
  displayFirstName,
  escapeHtml,
  h1,
  httpUrl,
  numberedItem,
  p,
  primaryButton,
  renderEmail,
  sectionHeading,
} from "./layout";
import { t } from "./tokens";

export type WelcomeCourseCard = {
  /** Mono uppercase label, e.g. "DISARANKAN UNTUK ANDA". */
  label: string;
  title: string;
  /** Mono meta line, e.g. duration/material count. */
  meta: string;
  url: string;
};

export type WelcomeEmailInput = {
  recipientEmail: string;
  userName: string;
  /** Absolute app origin for the CTA button. */
  appUrl: string;
  /** Optional recommended-course card (omitted until course data exists). */
  course?: WelcomeCourseCard | null;
};

function courseCard(course: WelcomeCourseCard): string {
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;"><tr>`,
    `<td style="background-color:${t("surface-2")};border:1px solid ${t("border-soft")};border-radius:10px;padding:16px 18px;">`,
    `<p style="margin:0 0 6px;font-family:'IBM Plex Mono',ui-monospace,'SFMono-Regular',Menlo,monospace;font-size:11px;letter-spacing:2px;color:${t("text-meta")};">${escapeHtml(course.label)}</p>`,
    `<p style="margin:0 0 4px;font-size:19px;line-height:1.4;font-weight:700;color:${t("text")};">${escapeHtml(course.title)}</p>`,
    `<p style="margin:0;font-family:'IBM Plex Mono',ui-monospace,'SFMono-Regular',Menlo,monospace;font-size:12px;letter-spacing:1px;color:${t("text-meta")};">${escapeHtml(course.meta)}</p>`,
    "</td></tr></table>",
  ].join("");
}

export function welcomeEmail(input: WelcomeEmailInput) {
  const appUrl = httpUrl(input.appUrl);
  // Subject is plain text (no HTML escaping); the body copy below escapes.
  const first = displayFirstName(input.userName, input.recipientEmail);
  const name = escapeHtml(first);
  return renderEmail({
    subject: `Selamat datang di BINZI, ${first}`,
    preheader: "Mulai dari satu materi",
    recipientEmail: input.recipientEmail,
    content: [
      h1("Akun Anda aktif — mulai dari satu materi"),
      p(
        `Terima kasih sudah bergabung, ${name}. Semua kursus gratis, tidak ada sertifikat, yang dicatat adalah nilai dan progress Anda.`,
      ),
      input.course ? courseCard(input.course) : "",
      primaryButton("Mulai materi pertama", input.course?.url ?? appUrl),
      sectionHeading("Tiga hal yang perlu diketahui"),
      numberedItem(
        "01",
        "Setiap quiz hanya <strong>satu kesempatan</strong> — kerjakan saat siap.",
      ),
      numberedItem(
        "02",
        "<strong>Nilai Akhir</strong> = rata-rata quiz materi 60% + Final Quiz 40%.",
      ),
      numberedItem(
        "03",
        "Materi ditinjau nutrisionis <strong>ber-STR</strong>; untuk kondisi pribadi tetap periksakan ke tenaga kesehatan.",
      ),
      p(
        "Tidak ingin menerima pengingat belajar? Atur di Profil &amp; pengaturan — email penting soal akun tetap dikirim.",
      ),
    ].join(""),
  });
}
