import Link from "next/link";

import { courseDifficulty } from "@/db/schema/enums";
import { Badge } from "@/components/ui/Badge/Badge";
import { Card } from "@/components/ui/Card/Card";
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
 */

const DIFFICULTY_LABELS: Record<
  (typeof courseDifficulty.enumValues)[number],
  string
> = {
  BEGINNER: "Pemula",
  INTERMEDIATE: "Menengah",
  ADVANCED: "Lanjutan",
};

const WHY_BINZI = [
  {
    title: "Jalur Belajar Terstruktur",
    description:
      "Setiap kursus tersusun dari pelajaran berurutan — dari dasar hingga penerapan, langkah demi langkah.",
  },
  {
    title: "Materi yang Beragam",
    description:
      "Artikel, video, infografis, dan tips dikombinasikan dalam satu alur belajar yang mudah diikuti.",
  },
  {
    title: "Kuis Interaktif",
    description:
      "Setiap pelajaran ditutup dengan kuis untuk memastikan Anda benar-benar memahami materi sebelum lanjut.",
  },
] as const;

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeZone: "Asia/Jakarta",
});

export default async function HomePage() {
  const [featuredCourses, featuredArticles] = await Promise.all([
    getFeaturedCourses(),
    listPublishedArticles(),
  ]);

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <h1 className={styles.heroTitle} id="hero-title">
          Belajar Gizi dengan Cara yang Lebih Mudah.
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
      </section>

      <section
        className={styles.section}
        aria-labelledby="featured-courses-title"
      >
        <h2 className={styles.sectionTitle} id="featured-courses-title">
          Kursus Unggulan
        </h2>
        {featuredCourses.length === 0 ? (
          <p className={styles.empty}>
            Belum ada kursus yang tersedia. Silakan kembali lagi nanti.
          </p>
        ) : (
          <ul className={styles.grid}>
            {featuredCourses.map((course) => (
              <li key={course.id}>
                <Card className={styles.courseCard}>
                  <Badge>{DIFFICULTY_LABELS[course.difficulty]}</Badge>
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
                    Lihat Kursus
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="why-binzi-title">
        <h2 className={styles.sectionTitle} id="why-binzi-title">
          Kenapa BINZI?
        </h2>
        <ul className={styles.grid}>
          {WHY_BINZI.map((reason) => (
            <li key={reason.title}>
              <Card className={styles.whyCard}>
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
        <h2 className={styles.sectionTitle} id="featured-articles-title">
          Artikel Pilihan
        </h2>
        {featuredArticles.length === 0 ? (
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
                    <Link href={`/articles/${article.slug}`}>
                      {article.title}
                    </Link>
                  </h3>
                  <p className={styles.cardMeta}>
                    Diterbitkan {dateFormatter.format(article.publishedAt)} WIB
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.ctaBand} aria-labelledby="cta-title">
        <h2 className={styles.ctaTitle} id="cta-title">
          Siap Mulai Belajar Gizi?
        </h2>
        <p className={styles.ctaTagline}>
          Mulai dari kursus pertama Anda — gratis dan bisa diikuti kapan saja.
        </p>
        <Link className={styles.ctaPrimary} href="/courses">
          Mulai Belajar
        </Link>
      </section>
    </div>
  );
}
