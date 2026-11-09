import Image from "next/image";
import Link from "next/link";

import { PUBLIC_HREFS } from "@/components/shared/nav-items";
import { buttonVariants } from "@/components/ui/button-variants";
import { PageContainer } from "@/components/shared/page-container";

import { IllustrationFrame } from "../hero-illustration/illustration-frame";
import { AHLI_GIZI, STATISTIK_HERO, SUBJUDUL_HERO } from "./beranda-content";

/*
 * Hero (card S6-01 §2): copy from 1a at every width (Q37), visual =
 * illustration 6a mounted like 6b. Server component — no DB, no session,
 * the page stays static (○). One-column below 1024 (1t/1d) with the
 * illustration under the stats; two columns from lg with the illustration
 * column fixed at the scaled 560×404 (6b).
 *
 * Weight note: the design's 800 headings render as Lato 900 (TOKENS.md);
 * 600 labels render as 700.
 */
export function Hero() {
  return (
    <PageContainer className="pt-8 pb-10 sm:pt-14 sm:pb-16">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_560px] lg:gap-10">
        <div>
          <h1 className="text-[36px] font-black leading-[1.1] tracking-[-0.028em] text-text text-balance sm:text-[46px] min-[1280px]:text-[62px] min-[1280px]:leading-[1.06]">
            Belajar gizi dari penjelasan yang{" "}
            <span className="whitespace-nowrap rounded-[4px] bg-primary-tint px-1.5 text-primary-deep">
              benar
            </span>
          </h1>
          <p className="mt-5 max-w-[34ch] text-[16px] leading-[1.65] text-text-muted text-pretty sm:mt-6 sm:text-[18px]">
            {SUBJUDUL_HERO}
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:mt-8 sm:w-auto sm:flex-row sm:flex-wrap">
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
          <div className="mt-6 flex items-center gap-3 sm:mt-7">
            <Image
              src={AHLI_GIZI.foto.src}
              alt=""
              width={AHLI_GIZI.foto.width}
              height={AHLI_GIZI.foto.height}
              className="size-10 flex-none rounded-full object-cover object-[50%_30%]"
            />
            <p className="text-[14px] leading-[1.5] text-text-muted">
              Seluruh materi ditinjau{" "}
              <strong className="font-bold text-text">{AHLI_GIZI.nama}</strong>
              <br />
              {AHLI_GIZI.kredensial} · STR {AHLI_GIZI.str}
            </p>
          </div>
          <dl className="mt-10 flex gap-9 border-t border-border-soft pt-6">
            {STATISTIK_HERO.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-mono text-[26px] font-medium leading-none text-text sm:text-[34px]">
                  {stat.angka}
                </dd>
                <dd className="mt-1.5 text-[13px] text-text-muted sm:text-[13.5px]">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex justify-center lg:justify-start">
          <IllustrationFrame />
        </div>
      </div>
    </PageContainer>
  );
}
