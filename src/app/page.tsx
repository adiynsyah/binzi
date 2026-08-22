import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { Input } from "@/components/ui/Input/Input";
import styles from "./page.module.scss";

export default function HomePage() {
  return (
    <main className={styles.main}>
      <h1>BINZI</h1>
      <p>Belajar gizi dengan cara yang lebih mudah.</p>
      <p>Segera hadir &mdash; aplikasi sedang dalam pengembangan.</p>

      {/*
        TEMPORARY UI PRIMITIVES SHOWCASE — TASK 003 verification only.
        Remove when the real homepage is implemented (Milestone 7).
      */}
      <section className={styles.showcase} aria-label="Verifikasi primitif UI (sementara)">
        <Card>
          <h2>Verifikasi Primitif UI</h2>
          <p className={styles.showcaseNote}>
            Bagian sementara untuk verifikasi TASK 003 &mdash; akan dihapus
            saat halaman utama resmi diimplementasikan.
          </p>

          <div className={styles.showcaseRow}>
            <Button variant="primary">Mulai Belajar</Button>
            <Button variant="secondary">Jelajahi Artikel</Button>
            <Button variant="danger">Hapus Draf</Button>
            <Button variant="primary" disabled>
              Nonaktif
            </Button>
          </div>

          <div className={styles.showcaseRow}>
            <Badge tone="neutral">Pemula</Badge>
            <Badge tone="warning">DRAFT</Badge>
            <Badge tone="success">PUBLISHED</Badge>
            <Badge tone="success">LULUS</Badge>
            <Badge tone="danger">BELUM LULUS</Badge>
          </div>

          <div className={styles.showcaseForm}>
            <Input label="Email" type="email" placeholder="nama@contoh.com" />
            <Input
              label="Kata Sandi"
              type="password"
              error="Kata sandi minimal 8 karakter."
            />
          </div>
        </Card>
      </section>
    </main>
  );
}
