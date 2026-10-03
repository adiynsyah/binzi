// Unit tests for the transactional email templates (card A-10).
//
// Security cases first: every interpolated value must be HTML-escaped and
// every action URL must be http(s) — an email is HTML rendered by a client,
// so an unescaped name is an XSS vector (PRD §12.1). Copy cases pin the
// final interface text from the screen documents (15a/15b).
import { describe, expect, it } from "vitest";

import { displayFirstName, escapeHtml, httpUrl } from "./layout";
import { formatWib, resetPasswordEmail } from "./reset-password";
import { verificationEmail } from "./verification";
import { welcomeEmail } from "./welcome";

const ATTACK_NAME = `<a href="https://jahat.example">klik</a><script>alert(1)</script>`;
// Space-free variant: displayFirstName() keeps only the first word, so a
// payload without spaces is what flows through a template intact.
const ATTACK_NAME_ONE_WORD = `<svg/onload=alert(1)>`;

describe("escaping and URL hygiene", () => {
  it("renders the injected name as escaped text, never as markup (verification)", () => {
    const { html } = verificationEmail({
      recipientEmail: "rina@example.com",
      userName: ATTACK_NAME,
      url: "https://binzi.example.com/api/auth/verify-email?token=abc",
    });

    // Only the first word of a name is used ("&lt;a"); the rest of the
    // payload is dropped entirely. Nothing survives as live markup and
    // the hostile host never appears.
    expect(html).toContain("Satu klik lagi, &lt;a");
    expect(html).not.toContain("jahat.example");
    expect(html).not.toContain("<script");
  });

  it("escapes a single-word payload end to end", () => {
    const { html } = verificationEmail({
      recipientEmail: "rina@example.com",
      userName: ATTACK_NAME_ONE_WORD,
      url: "https://binzi.example.com/api/auth/verify-email?token=abc",
    });
    expect(html).toContain("&lt;svg/onload=alert(1)&gt;");
    expect(html).not.toContain("<svg");
  });

  it("keeps the welcome subject plain text and escapes it for <title>", () => {
    const { subject, html } = welcomeEmail({
      recipientEmail: "rina@example.com",
      userName: ATTACK_NAME_ONE_WORD,
      appUrl: "https://binzi.example.com",
    });

    // A subject is a mail header rendered as text, never markup; the
    // HTML document escapes the same value for the <title> context.
    expect(subject).toContain(ATTACK_NAME_ONE_WORD);
    expect(html).toContain("&lt;svg/onload=alert(1)&gt;");
    expect(html).not.toMatch(/<title>[^<]*<svg/);
  });

  it("rejects non-http(s) action URLs", () => {
    expect(() =>
      verificationEmail({
        recipientEmail: "rina@example.com",
        userName: "Rina",
        url: "javascript:alert(1)",
      }),
    ).toThrow(/http\/https/);
    expect(() =>
      resetPasswordEmail({
        recipientEmail: "rina@example.com",
        url: "data:text/html;base64,SGVsbG8=",
        device: null,
        requestedAt: new Date("2026-09-19T02:14:00Z"),
      }),
    ).toThrow(/http\/https/);
  });

  it("accepts http and https URLs", () => {
    expect(httpUrl("https://binzi.id/verifikasi?token=x")).toContain(
      "https://",
    );
    expect(httpUrl("http://localhost:3000/reset")).toContain("http://");
  });

  it("falls back to the email local part when the name is empty", () => {
    expect(displayFirstName(null, "rina.kurnia@example.com")).toBe(
      "rina.kurnia",
    );
    expect(displayFirstName("  Rina Kurnia ", "x@example.com")).toBe("Rina");
  });
});

describe("verification email (15a)", () => {
  const url =
    "https://binzi.example.com/api/auth/verify-email?token=8f2c&callbackURL=%2F";

  it("carries the final subject, headline, and validity copy", () => {
    const { subject, preheader, html } = verificationEmail({
      recipientEmail: "rina@example.com",
      userName: "Rina Kurnia",
      url,
    });

    expect(subject).toBe("Verifikasi email Anda untuk mengaktifkan akun BINZI");
    expect(preheader).toBe("Berlaku 24 jam");
    expect(html).toContain("Satu klik lagi, Rina");
    expect(html).toContain("Verifikasi email saya");
    expect(html).toContain("Tautan berlaku 24 jam");
    expect(html).toContain("Bukan Anda yang mendaftar?");
    expect(html).toContain(
      "Abaikan email ini — akun tidak akan aktif tanpa verifikasi.",
    );
  });

  it("includes the full URL as the copyable fallback", () => {
    const { html } = verificationEmail({
      recipientEmail: "rina@example.com",
      userName: "Rina",
      url,
    });
    // Escaped for the HTML context ("&" → "&amp;"), but complete.
    expect(html).toContain(url.replace("&", "&amp;"));
  });
});

describe("reset password email (15a)", () => {
  it("carries the final copy including the one-hour single-use warning", () => {
    const { subject, preheader, html } = resetPasswordEmail({
      recipientEmail: "rina@example.com",
      url: "https://binzi.example.com/api/auth/reset-password/41ba?callbackURL=%2F",
      device: { browser: "Chrome", os: "Windows" },
      requestedAt: new Date("2026-09-19T02:14:00Z"),
    });

    expect(subject).toBe("Atur ulang password BINZI Anda");
    expect(preheader).toBe("Berlaku 1 jam");
    expect(html).toContain("Atur ulang password Anda");
    expect(html).toContain("Buat password baru");
    expect(html).toContain(
      "Tautan berlaku 1 jam dan hanya bisa dipakai sekali",
    );
    expect(html).toContain("Permintaan dibuat dari Chrome di Windows");
    expect(html).toContain("19 Sep 2026 09.14 WIB");
    expect(html).toContain("Bukan Anda yang meminta?");
    expect(html).toContain("password Anda tidak berubah.");
  });

  it("omits the device phrase when the user agent is unknown", () => {
    const { html } = resetPasswordEmail({
      recipientEmail: "rina@example.com",
      url: "https://binzi.example.com/api/auth/reset-password/41ba",
      device: null,
      requestedAt: new Date("2026-09-19T02:14:00Z"),
    });
    expect(html).toContain("Permintaan dibuat pada");
    expect(html).not.toContain("dari Chrome");
  });

  it("formats timestamps in WIB (UTC+7)", () => {
    expect(formatWib(new Date("2026-09-19T02:14:00Z"))).toBe(
      "19 Sep 2026 09.14 WIB",
    );
  });
});

describe("welcome email (15a)", () => {
  it("carries the three-facts list and the preference line", () => {
    const { subject, html } = welcomeEmail({
      recipientEmail: "rina@example.com",
      userName: "Rina Kurnia",
      appUrl: "https://binzi.example.com",
    });

    expect(subject).toBe("Selamat datang di BINZI, Rina");
    expect(html).toContain("Akun Anda aktif — mulai dari satu materi");
    expect(html).toContain("Terima kasih sudah bergabung, Rina");
    expect(html).toContain("Tiga hal yang perlu diketahui");
    expect(html).toMatch(/01 &middot;<\/strong> Setiap quiz hanya/);
    expect(html).toMatch(/02 &middot;<\/strong>/);
    expect(html).toMatch(/03 &middot;<\/strong>/);
    expect(html).toContain(
      "Tidak ingin menerima pengingat belajar? Atur di Profil &amp; pengaturan",
    );
  });

  it("omits the recommended-course card until course data exists (PRD §13.4)", () => {
    const { html } = welcomeEmail({
      recipientEmail: "rina@example.com",
      userName: "Rina",
      appUrl: "https://binzi.example.com",
    });
    expect(html).not.toContain("DISARANKAN UNTUK ANDA");
  });

  it("renders the course card when course data is provided", () => {
    const { html } = welcomeEmail({
      recipientEmail: "rina@example.com",
      userName: "Rina",
      appUrl: "https://binzi.example.com",
      course: {
        label: "DISARANKAN UNTUK ANDA",
        title: "Kursus contoh",
        meta: "1 MATERI · 1 MENIT",
        url: "https://binzi.example.com/kursus/contoh",
      },
    });
    expect(html).toContain("DISARANKAN UNTUK ANDA");
    expect(html).toContain("Kursus contoh");
  });
});

describe("escapeHtml", () => {
  it("escapes all five HTML metacharacters", () => {
    expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe(
      "&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;",
    );
  });
});
