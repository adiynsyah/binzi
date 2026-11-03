"use client";

/*
 * /cms/kursus list (card S1-01, screen 21e): search + "Kursus baru" +
 * status tabs + one table whose rows show completeness (materi, Final
 * Quiz) at a glance.
 *
 * Filtering is client-side (no pagination in the MVP — the whole list
 * arrives from the server). Tab badges always show the TOTAL per status,
 * unaffected by the active tab or the search box.
 *
 * Every TabsTrigger owns a TabsContent (Radix contract — aria-controls
 * must resolve), but only the active panel is mounted, so the table
 * exists once. The trigger strip scrolls sideways on very narrow
 * viewports (shrink-0) instead of stretching the page, and the table
 * wrapper is overflow-x-auto at ALL widths with a break-words title
 * cell: an 80-character no-space title must never force the PAGE to
 * scroll horizontally at 360 (A-19b).
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import { CMS_HEADING_CLASS } from "@/components/cms/cms-pages";
import { STATUS_BADGE } from "@/components/cms/course-status";
import { CreateCourseDialog } from "@/components/cms/create-course-dialog";
import { BadgeStatus } from "@/components/ui/badge-status";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COURSE_LEVEL_LABELS } from "@/modules/course/schema";
import type {
  CmsCourseListItemDTO,
  CourseStatusCounts,
} from "@/modules/course/service";

type ListTab = "ALL" | "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";

const TABS: readonly {
  value: ListTab;
  label: string;
  countKey: keyof CourseStatusCounts;
}[] = [
  { value: "ALL", label: "Semua", countKey: "total" },
  { value: "PUBLISHED", label: "Terbit", countKey: "PUBLISHED" },
  { value: "IN_REVIEW", label: "Menunggu", countKey: "IN_REVIEW" },
  { value: "DRAFT", label: "Draf", countKey: "DRAFT" },
  { value: "ARCHIVED", label: "Arsip", countKey: "ARCHIVED" },
];

export type CourseListProps = {
  courses: CmsCourseListItemDTO[];
  counts: CourseStatusCounts;
};

export function CourseList({ courses, counts }: CourseListProps) {
  const [tab, setTab] = useState<ListTab>("ALL");
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const query = q.trim().toLowerCase();
  const visible = useMemo(
    () =>
      courses.filter((course) => {
        if (tab !== "ALL" && course.status !== tab) return false;
        if (query && !course.title.toLowerCase().includes(query)) return false;
        return true;
      }),
    [courses, tab, query],
  );

  const openDialog = () => setDialogOpen(true);

  return (
    <div>
      <h1 className={CMS_HEADING_CLASS}>Kursus</h1>
      {/* 21e per-status summary — totals, like the tab badges. */}
      <p className="mt-2 text-[15px] text-text-muted">
        {counts.PUBLISHED} terbit · {counts.IN_REVIEW} menunggu persetujuan ·{" "}
        {counts.DRAFT} draf
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          aria-label="Cari kursus"
          placeholder="Cari kursus…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="sm:max-w-[320px]"
        />
        <div className="sm:ml-auto">
          <Button onClick={openDialog}>+ Kursus baru</Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as ListTab)}
        className="mt-6"
      >
        <TabsList className="overflow-x-auto">
          {TABS.map(({ value, label, countKey }) => (
            <TabsTrigger key={value} value={value} className="shrink-0 px-2 sm:px-4">
              <span>{label}</span>
              <span className="font-mono text-xs text-text-subtle">
                {counts[countKey]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ value }) => (
          <TabsContent key={value} value={value}>
            {/* The sort is a server constant (no selectable control here). */}
            <p className="mt-4 text-right text-sm text-text-meta">
              Urut: Terakhir diubah
            </p>

            {courses.length === 0 ? (
              <div className="mt-2">
                <EmptyState
                  label="KURSUS"
                  title="Belum ada kursus."
                  description="Kursus pertama dibuat lewat dialog singkat, lalu materinya diisi di halaman kursus."
                  primaryAction={{ label: "+ Kursus baru", onClick: openDialog }}
                  alternativeAction={{
                    label: "Kembali ke Ringkasan",
                    href: "/cms",
                  }}
                />
              </div>
            ) : visible.length === 0 ? (
              <div className="mt-2">
                <EmptyState
                  label="KURSUS"
                  title="Tidak ada kursus yang cocok."
                  description="Hapus pencarian atau buka tab lain."
                  primaryAction={{
                    label: "Hapus pencarian",
                    onClick: () => {
                      setQ("");
                      setTab("ALL");
                    },
                  }}
                  alternativeAction={{
                    label: "Kembali ke Ringkasan",
                    href: "/cms",
                  }}
                />
              </div>
            ) : (
              <div className="relative mt-2 overflow-x-auto rounded-card border border-border bg-surface">
                {/* relative is load-bearing: the sr-only course-title span in
                    the "Buka" link is position:absolute — without a positioned
                    ancestor its containing block is the viewport and it escapes
                    the overflow-x-auto clip, widening the PAGE (not the
                    wrapper) at every width. */}
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-border">
                      {["Kursus", "Materi", "Final Quiz", "Status", "Peserta", "Aksi"].map(
                        (heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className="px-4 py-3 font-mono text-xs font-medium uppercase tracking-wide text-text-subtle"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((course) => (
                      <tr
                        key={course.id}
                        className="border-b border-border-soft last:border-b-0"
                      >
                        <td className="px-4 py-4">
                          <p className="break-words font-bold text-text">
                            {course.title}
                          </p>
                          <p className="mt-1 text-sm text-text-muted">
                            {COURSE_LEVEL_LABELS[course.level]} · {course.ownerName}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-text-body">
                          {course.lessonCount} materi
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-text-body">
                          {course.finalQuizQuestionCount} / 20 soal
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <BadgeStatus status={STATUS_BADGE[course.status]} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-text-body">
                          {course.enrollmentCount > 0
                            ? course.enrollmentCount.toLocaleString("id-ID")
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {/* Course title in the accessible name so every
                              row's link is unique (screen readers offer a
                              link list; "Buka" ×N is useless there). */}
                          <Link
                            href={`/cms/kursus/${course.id}`}
                            className="font-bold text-primary-deep hover:underline"
                          >
                            Buka{" "}
                            <span className="sr-only">{course.title}</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <CreateCourseDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
