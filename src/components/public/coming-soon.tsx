import Link from "next/link";

import { PUBLIC_HREFS } from "@/components/shared/nav-items";
import { PageContainer } from "@/components/shared/page-container";
import { buttonVariants } from "@/components/ui/button-variants";

/*
 * "Segera hadir" page (card S6-01 §6): keeps the header links alive during
 * the demo instead of 404 — reverses the A-14a "no placeholder pages" note
 * by the owner's 8 Nov decision #6. Only the top-level pages use this;
 * /kursus/{slug} and /artikel/{slug} still 404 until their sprint.
 *
 * "Halaman ini sedang disiapkan." is proposed copy (PR "Keputusan &
 * asumsi"); robots noindex is set per-page, not here.
 */
export function ComingSoon({ title }: { title: string }) {
  return (
    <PageContainer className="pt-12 pb-16 sm:pt-16 sm:pb-20">
      <h1 className="text-[28px] font-black leading-[1.12] tracking-[-0.028em] text-text sm:text-[34px] lg:text-[40px]">
        {title}
      </h1>
      <p className="mt-3 text-[16px] leading-[1.65] text-text-muted text-pretty sm:text-[17px]">
        Halaman ini sedang disiapkan.
      </p>
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Link
          href={PUBLIC_HREFS.home}
          className={`${buttonVariants({ variant: "primary", size: "lg" })} w-full sm:w-auto`}
        >
          Kembali ke Beranda
        </Link>
        <Link
          href={PUBLIC_HREFS.konsultasi}
          className={`${buttonVariants({ variant: "secondary", size: "lg" })} w-full sm:w-auto`}
        >
          Tanya Ahli Gizi
        </Link>
      </div>
    </PageContainer>
  );
}
