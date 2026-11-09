import Link from "next/link";

import { PUBLIC_HREFS } from "@/components/shared/nav-items";
import { PageContainer } from "@/components/shared/page-container";
import { buttonVariants } from "@/components/ui/button-variants";

/*
 * CTA penutup (card S6-01 §5 + keputusan tinjauan 8 Nov): a full-width
 * primary-tint ribbon with a primary/25 top hairline — NOT a bordered
 * card. 1a lays the copy and buttons on one space-between row that wraps;
 * below 640 the buttons stack full-width (1d). The 1a paragraph hex
 * #5a1c14 has no token (and must not get one); ink-surface is the
 * mapping table's nearest match.
 */
export function CtaPenutup() {
  return (
    <section className="border-t border-primary/25 bg-primary-tint py-7 sm:py-14">
      <PageContainer className="flex flex-wrap items-center justify-between gap-7 sm:gap-9">
        <div>
          <h2 className="text-[24px] font-black leading-[1.16] tracking-[-0.026em] text-text text-balance sm:text-[28px] lg:text-[34px]">
            Mulai dari satu materi hari ini
          </h2>
          <p className="mt-2.5 max-w-[52ch] text-[15px] leading-[1.6] text-ink-surface text-pretty sm:text-[16.5px]">
            Empat menit menonton, satu quiz singkat. Tidak perlu akun untuk
            materi pertama.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href={PUBLIC_HREFS.daftar}
            className={`${buttonVariants({ variant: "primary", size: "lg" })} w-full sm:w-auto`}
          >
            Mulai Belajar Gratis
          </Link>
          <Link
            href={PUBLIC_HREFS.artikel}
            className={`${buttonVariants({ variant: "secondary", size: "lg" })} w-full sm:w-auto`}
          >
            Baca Artikel
          </Link>
        </div>
      </PageContainer>
    </section>
  );
}
