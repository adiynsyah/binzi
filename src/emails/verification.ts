// Email verifikasi (card A-10, layar 15a — copy final dari dokumen layar).
//
// Tautan kedaluwarsa 24 jam (AUTH-03); nilai itu ditulis jelas di subjek
// pratinjau, kotak cadangan, dan baris penenang.
import {
  displayFirstName,
  escapeHtml,
  fallbackLinkBox,
  h1,
  httpUrl,
  p,
  primaryButton,
  reassurance,
  renderEmail,
} from "./layout";

export type VerificationEmailInput = {
  recipientEmail: string;
  userName: string;
  /** Verification action URL built by Better Auth. */
  url: string;
};

export function verificationEmail(input: VerificationEmailInput) {
  const url = httpUrl(input.url);
  const name = escapeHtml(
    displayFirstName(input.userName, input.recipientEmail),
  );
  return renderEmail({
    subject: "Verifikasi email Anda untuk mengaktifkan akun BINZI",
    preheader: "Berlaku 24 jam",
    recipientEmail: input.recipientEmail,
    content: [
      h1(`Satu klik lagi, ${name}`),
      p(
        "Konfirmasi alamat email Anda untuk mengaktifkan akun BINZI. Setelah itu progress belajar dan nilai quiz Anda mulai tersimpan.",
      ),
      primaryButton("Verifikasi email saya", url),
      fallbackLinkBox(
        "Tautan berlaku 24 jam",
        "Kalau kedaluwarsa, minta tautan baru dari halaman masuk. Tombol tidak bekerja? Salin alamat ini:",
        url,
      ),
      reassurance(
        "Bukan Anda yang mendaftar?",
        "Abaikan email ini — akun tidak akan aktif tanpa verifikasi.",
      ),
    ].join(""),
  });
}
