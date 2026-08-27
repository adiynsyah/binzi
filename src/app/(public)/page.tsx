import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";

import { courseDifficulty } from "@/db/schema/enums";
import { Badge } from "@/components/ui/Badge/Badge";
import { Card } from "@/components/ui/Card/Card";
import { SkeletonCard } from "@/components/feedback/Loading/Skeleton";
import skeletonStyles from "@/components/feedback/Loading/Skeleton.module.scss";
import { listPublishedArticles } from "@/features/contents/queries/listPublishedArticles";
import { getFeaturedCourses } from "@/features/courses/queries/getFeaturedCourses";

import styles from "./page.module.scss";

/**
 * BINZI homepage (TASK 037, UI/UX §4 "Homepage" + §5 "Homepage Hero").
 *
 * Section order is fixed by UI/UX §4:
 *   Hero → Featured / Popular Courses → Why BINZI → Featured Articles
 *   → Learning CTA
 *
 * The page answers §4's three questions in order: what BINZI is
 * (Hero), what can be learned (Featured Courses + Why BINZI), and
 * where to start (CTAs → /courses, /articles).
 *
 * Data is server-rendered from the public queries, which enforce
 * publication status in the query itself — DRAFT courses, DRAFT
 * contents, and slug-less articles can never appear here (UI/UX §44,
 * Business Rules §5). The TASK 003 primitives showcase was removed by
 * its own documented contract ("remove when the real homepage is
 * implemented, Milestone 7"); the primitives live on in the CMS and
 * are reused here (Badge, Card).
 *
 * CTA destinations follow the TASK 036 honest-link pattern: /courses
 * and /courses/[slug] are Blueprint §12 routes owned by TASK 038/039,
 * while /articles/[slug] is already live (TASK 020).
 *
 * TASK 059: the §35 skeletons (TASK 058) moved from a segment
 * loading.tsx at (public)/ to in-page <Suspense> around each data
 * section. The homepage itself never calls notFound()/redirect(), so
 * streaming it is status-safe — but a segment loading.tsx at
 * (public)/ softened the 404s of every public detail page below it
 * (verified live: /courses/[unknown] flushed a 200 shell before the
 * page's notFound() landed). In-page boundaries keep the §35
 * skeletons scoped to this page only.
 *
 * TASK 063: canonical self-reference for the homepage (Blueprint §44
 * "canonical URLs ... where appropriate"); title/description still
 * inherit from the root layout's defaults.
 *
 * VISUAL PASS: composition now follows the approved reference design
 * (two-column hero with an abstract illustrated visual + floating
 * chips, service-style cards, coral CTA band). Everything added is
 * presentational and aria-hidden where decorative; every claim shown
 * is grounded in shipped behavior (BR §35 free access, BR §19 passing
 * score 80, persisted lesson progress). No new links beyond the
 * existing honest destinations, no images (V1 has no asset strategy)
 * — the hero visual is pure inline SVG/CSS decoration.
 */

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

const DIFFICULTY_LABELS: Record<
  (typeof courseDifficulty.enumValues)[number],
  string
> = {
  BEGINNER: "Pemula",
  INTERMEDIATE: "Menengah",
  ADVANCED: "Lanjutan",
};

/** Hero trust indicators — all three restate shipped, grounded behavior. */
const HERO_TRUST = [
  { title: "100% Gratis", description: "Semua kursus bebas diakses." },
  { title: "Kuis Interaktif", description: "Di setiap akhir pelajaran." },
  { title: "Progres Tersimpan", description: "Lanjutkan kapan saja." },
] as const;

/**
 * Why BINZI — the reference "services" row, mapped 1:1 onto real V1
 * capabilities only: structured path, varied content types, quizzes,
 * persisted progress, free access (BR §35). No links: these are
 * informational cards, not navigable services.
 */
const WHY_BINZI = [
  {
    icon: "path",
    title: "Jalur Belajar Terstruktur",
    description:
      "Setiap kursus tersusun dari pelajaran berurutan — dari dasar hingga penerapan, langkah demi langkah.",
  },
  {
    icon: "layers",
    title: "Materi yang Beragam",
    description:
      "Artikel, video, infografis, dan tips dikombinasikan dalam satu alur belajar yang mudah diikuti.",
  },
  {
    icon: "quiz",
    title: "Kuis Interaktif",
    description:
      "Setiap pelajaran ditutup dengan kuis untuk memastikan Anda benar-benar memahami materi sebelum lanjut.",
  },
  {
    icon: "chart",
    title: "Progres Tersimpan",
    description:
      "Setiap pelajaran yang selesai tercatat otomatis — lanjutkan belajar dari tempat Anda berhenti.",
  },
  {
    icon: "unlock",
    title: "Gratis Diakses",
    description:
      "Seluruh materi belajar dapat diakses gratis, kapan saja dan di mana saja.",
  },
] as const;

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeZone: "Asia/Jakarta",
});

// ---------------------------------------------------------------------------
// Decorative inline icons (presentational only — every consumer marks
// them aria-hidden). Stroke-based, sized via CSS.
// ---------------------------------------------------------------------------
function iconProps(className: string) {
  return {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: "false",
  } as const;
}

const SERVICE_ICONS: Record<
  (typeof WHY_BINZI)[number]["icon"],
  ReactNode
> = {
  path: (
    <svg {...iconProps("")}>
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <path d="M8.5 19h5a4 4 0 0 0 0-8h-3a4 4 0 0 1 0-8h5" />
    </svg>
  ),
  layers: (
    <svg {...iconProps("")}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  ),
  quiz: (
    <svg {...iconProps("")}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  chart: (
    <svg {...iconProps("")}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </svg>
  ),
  unlock: (
    <svg {...iconProps("")}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </svg>
  ),
};

/** §35 card-grid skeleton (TASK 058 composition) as a section fallback. */
function CardGridFallback() {
  return (
    <div role="status" aria-busy="true">
      <span className={skeletonStyles.srOnly}>Memuat…</span>
      <div className={skeletonStyles.gridCards}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

/**
 * Hero visual — abstract "balanced plate" composition in the reference
 * brand language (coral / peach tints / navy). Pure SVG decoration: no
 * photos exist in V1 (no asset strategy), so nothing here references a
 * remote or copyrighted asset. The surrounding .heroVisual also hosts
 * two floating chips with grounded micro-copy.
 */
function HeroVisual() {
  return (
    <div aria-hidden="true" className={styles.heroVisual}>
      <svg
        className={styles.heroIllustration}
        fill="none"
        focusable="false"
        viewBox="0 0 520 460"
      >
        <circle cx="270" cy="215" r="175" fill="#fde8e4" />
        <circle cx="205" cy="285" r="46" fill="#fde8e4" />
        <circle cx="270" cy="215" r="158" fill="none" opacity="0.5" stroke="#d63a24" strokeDasharray="0.1 16" strokeLinecap="round" strokeWidth="4" />
        <circle cx="315" cy="170" r="108" fill="#f1553f" />
        <circle cx="315" cy="170" r="80" fill="#ffffff" />
        <circle cx="315" cy="170" r="62" fill="none" stroke="#f1553f" strokeDasharray="1 8" strokeLinecap="round" strokeWidth="2" />
        <circle cx="295" cy="150" r="14" fill="#f1553f" />
        <circle cx="338" cy="158" r="10" fill="#1d2130" opacity="0.85" />
        <circle cx="300" cy="192" r="9" fill="#1d2130" opacity="0.6" />
        <circle cx="336" cy="196" r="12" fill="#f8c9be" />
        <rect fill="#1d2130" height="110" opacity="0.85" rx="6" width="12" x="52" y="180" />
        <rect fill="#d63a24" height="80" rx="6" width="12" x="76" y="210" />
        <rect fill="#f3a695" height="55" rx="6" width="12" x="100" y="235" />
        <path d="M420 320h20M430 310v20" stroke="#d63a24" strokeLinecap="round" strokeWidth="4" />
        <path d="M84 88h20M94 78v20" stroke="#d63a24" strokeLinecap="round" strokeWidth="4" />
        <circle cx="452" cy="96" fill="#1d2130" opacity="0.7" r="7" />
        <circle cx="140" cy="120" fill="#1d2130" opacity="0.5" r="5" />
      </svg>

      <div className={`${styles.heroChip} ${styles.heroChipOne}`}>
        <span className={styles.heroChipIcon}>
          <svg {...iconProps("")}>
            <circle cx="12" cy="12" r="9" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </span>
        <span className={styles.heroChipText}>
          <strong>Kuis Interaktif</strong>
          Nilai kelulusan 80%
        </span>
      </div>

      <div className={`${styles.heroChip} ${styles.heroChipTwo}`}>
        <span className={styles.heroChipIcon}>
          <svg {...iconProps("")}>
            <path d="m12 3 9 5-9 5-9-5 9-5Z" />
            <path d="m3 13 9 5 9-5" />
          </svg>
        </span>
        <span className={styles.heroChipText}>
          <strong>Materi Beragam</strong>
          Artikel · Video · Infografis
        </span>
      </div>
    </div>
  );
}

async function FeaturedCoursesSection() {
  const featuredCourses = await getFeaturedCourses();

  return featuredCourses.length === 0 ? (
    <p className={styles.empty}>
      Belum ada kursus yang tersedia. Silakan kembali lagi nanti.
    </p>
  ) : (
    <ul className={styles.grid}>
      {featuredCourses.map((course) => (
        <li key={course.id}>
          <Card className={styles.courseCard}>
            <div className={styles.cardTop}>
              <span aria-hidden="true" className={styles.cardIconChip}>
                <svg {...iconProps("")}>
                  <path d="m2 8 10-4 10 4-10 4L2 8Z" />
                  <path d="M6 10.5V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5" />
                  <path d="M22 8v6" />
                </svg>
              </span>
              <Badge>{DIFFICULTY_LABELS[course.difficulty]}</Badge>
            </div>
            <h3 className={styles.cardTitle}>
              <Link href={`/courses/${course.slug}`}>{course.title}</Link>
            </h3>
            <p className={styles.cardDescription}>
              {course.description}
            </p>
            <p className={styles.cardMeta}>
              {course.lessonCount} pelajaran
              {course.estimatedDuration !== null
                ? ` · ${course.estimatedDuration} menit`
                : ""}
            </p>
            <Link
              aria-label={`Lihat kursus: ${course.title}`}
              className={styles.cardCta}
              href={`/courses/${course.slug}`}
            >
              Lihat Kursus →
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}

async function FeaturedArticlesSection() {
  const featuredArticles = await listPublishedArticles();

  return featuredArticles.length === 0 ? (
    <p className={styles.empty}>
      Belum ada artikel yang tersedia. Silakan kembali lagi nanti.
    </p>
  ) : (
    <ul className={styles.grid}>
      {featuredArticles.map((article) => (
        <li key={article.id}>
          <Card className={styles.articleCard}>
            <p className={styles.articleType}>Artikel</p>
            <h3 className={styles.cardTitle}>
              <Link href={`/articles/${article.slug}`}>{article.title}</Link>
            </h3>
            <p className={styles.cardMeta}>
              Diterbitkan {dateFormatter.format(article.publishedAt)} WIB
            </p>
            <span aria-hidden="true" className={styles.cardArrow}>
              →
            </span>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>
            <svg {...iconProps("")}>
              <path d="m12 3 9 5-9 5-9-5 9-5Z" />
              <path d="m3 13 9 5 9-5" />
            </svg>
            Platform Edukasi Gizi
          </p>
          <h1 className={styles.heroTitle} id="hero-title">
            Belajar Gizi dengan{" "}
            <span className={styles.heroAccent}>
              Cara yang Lebih Mudah.
            </span>
          </h1>
          <p className={styles.heroTagline}>
            Materi gizi terstruktur — kursus, artikel, video, dan kuis
            interaktif — untuk memahami nutrisi dan menerapkannya dalam
            kehidupan sehari-hari.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.ctaPrimary} href="/courses">
              Mulai Belajar
            </Link>
            <Link className={styles.ctaSecondary} href="/articles">
              Jelajahi Artikel
            </Link>
          </div>
        </div>
        <HeroVisual />
        {/* Trust row spans the full panel bottom (grid child 1/-1) — the
            copy column alone cannot fit all three indicators on one line,
            which produced a 2+1 wrap staircase (measured defect). */}
        <ul className={styles.heroTrust}>
          {HERO_TRUST.map((item) => (
            <li key={item.title}>
              <span className={styles.trustIcon}>
                <svg {...iconProps("")}>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <span className={styles.trustText}>
                <strong>{item.title}</strong>
                {item.description}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        className={styles.section}
        aria-labelledby="featured-courses-title"
      >
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle} id="featured-courses-title">
            Kursus Unggulan
          </h2>
          <Link className={styles.sectionLink} href="/courses">
            Lihat Semua Kursus →
          </Link>
        </div>
        <Suspense fallback={<CardGridFallback />}>
          <FeaturedCoursesSection />
        </Suspense>
      </section>

      <section className={styles.section} aria-labelledby="why-binzi-title">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle} id="why-binzi-title">
            Kenapa BINZI?
          </h2>
        </div>
        <ul className={styles.grid}>
          {WHY_BINZI.map((reason) => (
            <li key={reason.title}>
              <Card className={styles.whyCard}>
                <span aria-hidden="true" className={styles.cardIconChip}>
                  {SERVICE_ICONS[reason.icon]}
                </span>
                <h3 className={styles.cardTitle}>{reason.title}</h3>
                <p className={styles.cardDescription}>{reason.description}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section
        className={styles.section}
        aria-labelledby="featured-articles-title"
      >
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle} id="featured-articles-title">
            Artikel Pilihan
          </h2>
          <Link className={styles.sectionLink} href="/articles">
            Lihat Semua Artikel →
          </Link>
        </div>
        <Suspense fallback={<CardGridFallback />}>
          <FeaturedArticlesSection />
        </Suspense>
      </section>

      <section className={styles.ctaBand} aria-labelledby="cta-title">
        <h2 className={styles.ctaTitle} id="cta-title">
          Siap Mulai Belajar Gizi?
        </h2>
        <p className={styles.ctaTagline}>
          Mulai dari kursus pertama Anda — gratis dan bisa diikuti kapan saja.
        </p>
        <Link className={styles.ctaBandButton} href="/courses">
          Mulai Belajar
        </Link>
      </section>
    </div>
  );
}
