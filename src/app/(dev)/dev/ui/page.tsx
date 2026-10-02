import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "../../../../components/ui/avatar";
import { BadgeStatus } from "../../../../components/ui/badge-status";
import { Button, type ButtonProps } from "../../../../components/ui/button";
import { Checkbox } from "../../../../components/ui/checkbox";
import { ChipFilter } from "../../../../components/ui/chip-filter";
import { Field } from "../../../../components/ui/field";
import { Input } from "../../../../components/ui/input";
import { PasswordField } from "../../../../components/ui/password-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Toggle } from "../../../../components/ui/toggle";
import { ChipToggleDemo, RemovableChipDemo } from "./demos";

/*
 * /dev/ui — control gallery (card A-05), mimicking screen 17b.
 * Development-only: renders notFound() in every other environment.
 *
 * Hover and focus cannot be "held" on a static page, so the Hover/Fokus
 * columns apply the SAME token values the real :hover / :focus-visible
 * styles resolve to, via inline styles. The interactive components keep
 * their genuine states; only the simulation columns are static.
 */

export const metadata = { title: "Galeri Kendali — BINZI Dev" };

const focusSim: CSSProperties = {
  outline: "2px solid var(--focus-ring)",
  outlineOffset: "3px",
};

const buttonHoverSim: Record<NonNullable<ButtonProps["variant"]>, CSSProperties> = {
  primary: { backgroundColor: "var(--primary-deep)" },
  secondary: { backgroundColor: "var(--fill)" },
  dark: { backgroundColor: "var(--ink-surface)" },
  ghost: { backgroundColor: "var(--fill)" },
  danger: { filter: "brightness(0.9)" },
};

const inputHoverSim: CSSProperties = { borderColor: "var(--text-subtle)" };

// Dev-only avatar photo placeholder — an inline SVG data URI. Colors are
// written as rgb() with the exact values of the `fill` and
// `ink-surface-text` tokens (hex literals are banned outside tokens.css).
const AVATAR_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88">' +
      '<rect width="88" height="88" fill="rgb(242,239,233)"/>' + // var(--fill)
      '<circle cx="44" cy="33" r="14" fill="rgb(168,159,149)"/>' + // ink-surface-text
      '<path d="M12 80c5-18 16-27 32-27s27 9 32 27z" fill="rgb(168,159,149)"/>' +
      "</svg>",
  );

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-lg font-bold text-text">{title}</h2>
      <div className="mt-4 rounded-card border border-border bg-surface p-[18px]">
        {children}
      </div>
    </section>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-28 flex-col gap-3">
      <p className="font-mono text-xs uppercase tracking-wide text-text-subtle">
        {title}
      </p>
      {children}
    </div>
  );
}

const buttonRows: {
  name: string;
  variant: NonNullable<ButtonProps["variant"]>;
  label: string;
  loadingLabel: string;
}[] = [
  { name: "Utama", variant: "primary", label: "Mulai quiz", loadingLabel: "Memulai…" },
  { name: "Sekunder", variant: "secondary", label: "Lihat nilai", loadingLabel: "Melihat…" },
  { name: "Gelap", variant: "dark", label: "Unduh", loadingLabel: "Mengunduh…" },
  { name: "Hantu", variant: "ghost", label: "Salin", loadingLabel: "Menyalin…" },
  { name: "Bahaya", variant: "danger", label: "Hapus akun", loadingLabel: "Menghapus…" },
];

export default function DevUiPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-content px-4 py-10">
      <h1 className="text-2xl font-black text-text">Galeri Kendali</h1>
      <p className="mt-2 max-w-(--width-measure) text-text-muted">
        Halaman development-only untuk memeriksa semua kendali dasar beserta
        lima state wajibnya. Cincin fokus 2px dengan jeda 3px dan warna
        nonaktif padat (tanpa opasitas) berlaku sama untuk semua kendali.
      </p>

      <Section title="Tombol">
        <div className="overflow-x-auto">
          <div className="flex min-w-max items-start gap-6">
            <div className="flex flex-col gap-3 pt-0">
              <p className="font-mono text-xs uppercase tracking-wide text-text-subtle">
                Varian
              </p>
              {buttonRows.map((row) => (
                <p key={row.variant} className="py-2 text-sm text-text-muted">
                  {row.name}
                </p>
              ))}
            </div>
            <Column title="Default">
              {buttonRows.map((row) => (
                <Button key={row.variant} variant={row.variant}>
                  {row.label}
                </Button>
              ))}
            </Column>
            <Column title="Hover">
              {buttonRows.map((row) => (
                <Button
                  key={row.variant}
                  variant={row.variant}
                  style={buttonHoverSim[row.variant]}
                >
                  {row.label}
                </Button>
              ))}
            </Column>
            <Column title="Fokus">
              {buttonRows.map((row) => (
                <Button
                  key={row.variant}
                  variant={row.variant}
                  style={focusSim}
                >
                  {row.label}
                </Button>
              ))}
            </Column>
            <Column title="Nonaktif">
              {buttonRows.map((row) => (
                <Button key={row.variant} variant={row.variant} disabled>
                  {row.label}
                </Button>
              ))}
            </Column>
            <Column title="Memuat">
              {buttonRows.map((row) => (
                <Button
                  key={row.variant}
                  variant={row.variant}
                  loading
                  loadingLabel={row.loadingLabel}
                >
                  {row.label}
                </Button>
              ))}
            </Column>
          </div>
        </div>
      </Section>

      <Section title="Input & Field">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <Column title="Default">
            <Field label="Email">
              <Input placeholder="Email Anda" />
            </Field>
          </Column>
          <Column title="Terisi">
            <Field label="Email">
              <Input defaultValue="rina.kurnia@email.com" />
            </Field>
          </Column>
          <Column title="Error per field">
            <Field
              label="Email"
              error="Format email belum lengkap"
            >
              <Input defaultValue="rina.kurnia@" />
            </Field>
          </Column>
          <Column title="Dengan hint">
            <Field label="Email" hint="Gunakan email aktif Anda.">
              <Input placeholder="Email Anda" />
            </Field>
          </Column>
          <Column title="Hover (simulasi)">
            <Field label="Email">
              <Input placeholder="Email Anda" style={inputHoverSim} />
            </Field>
          </Column>
          <Column title="Fokus (simulasi)">
            <Field label="Email">
              <Input placeholder="Email Anda" style={focusSim} />
            </Field>
          </Column>
          <Column title="Nonaktif">
            <Field label="Email">
              <Input placeholder="Email Anda" disabled />
            </Field>
          </Column>
          <Column title="Memuat (terkunci)">
            <Field label="Email">
              <Input placeholder="Email Anda" disabled aria-busy />
            </Field>
          </Column>
        </div>
      </Section>

      <Section title="Kata sandi">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <Column title="Live">
            <PasswordField />
            <p className="text-xs text-text-meta">
              Coba ketik — pil syarat berubah, dan live region hanya
              mengumumkan saat jumlah syarat terpenuhi berubah.
            </p>
          </Column>
          <Column title="Memuat (terkunci)">
            <PasswordField loading />
          </Column>
          <Column title="Nonaktif">
            <PasswordField disabled />
          </Column>
        </div>
      </Section>

      <Section title="Checkbox & Toggle">
        <div className="flex flex-wrap items-center gap-10">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Checkbox id="cb-default" />
              <label htmlFor="cb-default" className="text-sm text-text">
                Setuju dengan ketentuan
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="cb-checked" defaultChecked />
              <label htmlFor="cb-checked" className="text-sm text-text">
                Tercentang
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="cb-disabled" disabled />
              <label htmlFor="cb-disabled" className="text-sm text-text-meta">
                Nonaktif
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="cb-disabled-checked" disabled defaultChecked />
              <label
                htmlFor="cb-disabled-checked"
                className="text-sm text-text-meta"
              >
                Nonaktif tercentang
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Toggle id="tg-default" />
              <label htmlFor="tg-default" className="text-sm text-text">
                Izinkan notifikasi email
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Toggle id="tg-checked" defaultChecked />
              <label htmlFor="tg-checked" className="text-sm text-text">
                Aktif
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Toggle id="tg-disabled" disabled />
              <label htmlFor="tg-disabled" className="text-sm text-text-meta">
                Nonaktif
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Toggle id="tg-disabled-checked" disabled defaultChecked />
              <label
                htmlFor="tg-disabled-checked"
                className="text-sm text-text-meta"
              >
                Nonaktif menyala
              </label>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Chip filter">
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-wide text-text-subtle">
              Interaktif (aktif = pil gelap netral)
            </p>
            <ChipToggleDemo />
          </div>
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-wide text-text-subtle">
              Dengan ✕ (satu tombol: Hapus filter &lt;nama&gt;)
            </p>
            <RemovableChipDemo />
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <Column title="Hover (simulasi)">
              <ChipFilter label="Semua" count={3} style={{ backgroundColor: "var(--fill)" }} />
            </Column>
            <Column title="Fokus (simulasi)">
              <ChipFilter label="Semua" count={3} style={focusSim} />
            </Column>
            <Column title="Nonaktif">
              <ChipFilter label="Semua" count={3} disabled />
            </Column>
          </div>
        </div>
      </Section>

      <Section title="Badge status">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeStatus status="belum-dimulai" />
            <BadgeStatus status="sedang-berjalan" />
            <BadgeStatus status="selesai" />
            <BadgeStatus status="lulus" />
            <BadgeStatus status="menunggu-persetujuan" />
            <BadgeStatus status="siklus" cycle={2} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BadgeStatus status="selesai" />
            <BadgeStatus status="siklus" cycle={2} />
            <span className="text-xs text-text-meta">
              Siklus selalu di samping badge status (16c)
            </span>
          </div>
          <p className="text-xs text-text-meta">
            Lulus menggantikan Selesai — tidak pernah ditumpuk (16c).
          </p>
        </div>
      </Section>

      <Section title="Tabs (garis bawah)">
        <Tabs defaultValue="berjalan">
          <TabsList>
            <TabsTrigger value="berjalan">Sedang berjalan</TabsTrigger>
            <TabsTrigger value="selesai">Selesai</TabsTrigger>
            <TabsTrigger value="lulus" disabled>
              Nonaktif
            </TabsTrigger>
          </TabsList>
          <TabsContent value="berjalan">
            Panel aktif memakai garis bawah 2px warna utama.
          </TabsContent>
          <TabsContent value="selesai">Konten tab kedua.</TabsContent>
        </Tabs>
      </Section>

      <Section title="Avatar">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Avatar name="Rina Kurnia" />
            <span className="text-sm text-text-muted">Rina Kurnia → RK</span>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name="Budi Santoso" size="sm" />
            <Avatar name="Budi Santoso" size="md" />
            <Avatar name="Budi Santoso" size="lg" />
            <span className="text-sm text-text-muted">Ukuran sm / md / lg</span>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name="Rina Kurnia" src={AVATAR_PHOTO} />
            <span className="text-sm text-text-muted">
              Foto (placeholder hanya ada di halaman ini)
            </span>
          </div>
        </div>
      </Section>
    </main>
  );
}
