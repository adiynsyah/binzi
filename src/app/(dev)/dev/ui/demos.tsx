"use client";

import { useEffect, useState } from "react";
import { Banner } from "../../../../components/ui/banner";
import { Button } from "../../../../components/ui/button";
import { ChipFilter } from "../../../../components/ui/chip-filter";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "../../../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import { EmptyState } from "../../../../components/ui/empty-state";
import { PAGE_SIZE, Pagination } from "../../../../components/ui/pagination";
import {
  SkeletonCard,
  SkeletonList,
  useSkeletonDelay,
} from "../../../../components/ui/skeleton";

/*
 * Interactive demos for /dev/ui. Handler props cannot cross the
 * server/client boundary, so stateful demos live in this client
 * module and the (server) page composes them.
 */

const FILTERS = ["Semua", "Sedang berjalan", "Selesai", "Belum dimulai"] as const;

export function ChipToggleDemo() {
  const [active, setActive] = useState<string | null>("Sedang berjalan");
  return (
    <div className="flex flex-wrap items-center gap-3">
      {FILTERS.map((label) => (
        <ChipFilter
          key={label}
          label={label}
          count={label === "Semua" ? 3 : 1}
          active={active === label}
          onClick={() => setActive(active === label ? null : label)}
        />
      ))}
    </div>
  );
}

export function RemovableChipDemo() {
  const [filters, setFilters] = useState(["Gizi ibu hamil", "MP-ASI"]);
  const [active, setActive] = useState<string | null>("Gizi ibu hamil");
  if (filters.length === 0) {
    return <p className="text-sm text-text-meta">Semua filter sudah dihapus.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {filters.map((label) => (
        <ChipFilter
          key={label}
          label={label}
          active={active === label}
          onClick={() => setActive(active === label ? null : label)}
          onRemove={() => {
            setFilters(filters.filter((f) => f !== label));
            if (active === label) setActive(null);
          }}
        />
      ))}
    </div>
  );
}

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="danger">Hapus draft</Button>
      </DialogTrigger>
      <DialogContent
        title="Hapus draft artikel?"
        description="Draft yang dihapus tidak bisa dikembalikan. Versi terbit tidak terpengaruh."
      >
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="secondary">Biarkan</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="danger">Hapus draft</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DropdownMenuDemo() {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Urutkan: Terbaru</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Urutkan</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setPicked("Terbaru")}>
            Terbaru
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPicked("Terpopuler")}>
            Terpopuler
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPicked("Diunggah terlama")}>
            Diunggah terlama
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-sm text-text-meta">
        {picked ? `Terpilih: ${picked}` : "Pilih dari menu"}
      </span>
    </div>
  );
}

export function BannerDemo() {
  const [errorVisible, setErrorVisible] = useState(true);
  const [successVisible, setSuccessVisible] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      <Banner
        tone="info"
        title="Draf disimpan otomatis"
        description="Perubahan tersimpan setiap kali Anda berpindah soal."
      />
      {errorVisible ? (
        <Banner
          tone="error"
          title="2 jawaban belum tersimpan di server"
          description="Jawaban tersimpan sementara di perangkat ini dan terkirim otomatis saat koneksi kembali. Jangan tutup atau muat ulang halaman ini."
          action={
            <Button variant="danger" onClick={() => setErrorVisible(false)}>
              Coba kirim sekarang
            </Button>
          }
        />
      ) : (
        <p className="text-sm text-text-meta">
          Banner error menetap sampai keadaan berubah — di sini ditutup
          lewat aksinya.
        </p>
      )}
      {successVisible ? (
        <Banner
          tone="success"
          title="Tersambung. Jawaban soal 3 & 4 sudah tersimpan."
          onDismissed={() => setSuccessVisible(false)}
        />
      ) : (
        <Button variant="ghost" onClick={() => setSuccessVisible(true)}>
          Tampilkan banner sukses lagi
        </Button>
      )}
    </div>
  );
}

export function SkeletonDemo() {
  const [loading, setLoading] = useState(false);
  const showSkeleton = useSkeletonDelay(loading);

  // Simulates a fetch that lands after 3s — long enough to see the
  // 300ms delay pass and the skeletons take over the card grid.
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <div>
      <Button
        variant="secondary"
        onClick={() => setLoading(true)}
        disabled={loading}
      >
        Simulasi memuat ulang
      </Button>
      {loading ? (
        showSkeleton ? (
          <SkeletonList className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </SkeletonList>
        ) : null
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="rounded-card border border-border bg-surface p-4"
            >
              <div className="h-32 rounded-card bg-fill-soft" />
              <p className="mt-4 font-bold text-text">Kartu contoh 0{index}</p>
              <p className="mt-1 text-sm text-text-meta">
                Data dummy — bukan konten nyata.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PaginationDemo() {
  const [page, setPage] = useState(6);
  const totalPages = 20;
  return (
    <div className="flex flex-col gap-4">
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        label="Navigasi halaman"
      />
      <p className="font-mono text-xs uppercase tracking-wide text-text-subtle">
        Halaman {page} dari {totalPages} · {PAGE_SIZE} per halaman
      </p>
    </div>
  );
}

export function EmptyStateDemo() {
  return (
    <div className="flex flex-col gap-6">
      <EmptyState
        label="BELUM ADA KURSUS"
        title="Anda belum mengikuti kursus apa pun"
        description="Tiga kursus tersedia dan semuanya gratis. Materi pertama bisa ditonton dulu sebelum Anda memutuskan ikut."
        primaryAction={{ label: "Jelajahi semua kursus", onClick: () => {} }}
        alternativeAction={{ label: "Baca artikel dulu", onClick: () => {} }}
      />
      <EmptyState
        label="0 KURSUS"
        title="Belum ada kursus Menengah di bawah 30 menit"
        description="Satu-satunya kursus Menengah berdurasi 36 menit. Longgarkan satu filter:"
        primaryAction={{
          label: "Hapus filter durasi · 1 kursus",
          onClick: () => {},
        }}
        alternativeAction={{
          label: "Semua level < 30 menit · 1 kursus",
          onClick: () => {},
        }}
      />
      <EmptyState
        label="KONEKSI · KODE 503"
        title="Daftar kursus belum bisa dimuat"
        description="Biasanya karena sinyal lemah. Progress belajar Anda aman — tidak ada yang hilang."
        primaryAction={{ label: "Coba lagi", onClick: () => {} }}
        alternativeAction={{ label: "Baca artikel dulu", onClick: () => {} }}
      />
    </div>
  );
}
