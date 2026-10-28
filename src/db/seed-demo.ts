// Demo seed (card C-05 §2) — run with: npm run db:seed:demo
//
// Clearly-dummy, neutral content ONLY, never real content (CLAUDE.md, PRD
// §13.4): titles, summaries, descriptions, lesson texts and quiz
// instructions are prefixed "[DEMO]"; questions, explanations and options
// carry dummy wording ("Pertanyaan demo n?", "Pembahasan demo n.",
// "Opsi A"–"Opsi D"). Nothing here is a nutrition/health term, number, or
// claim. This is data to LOOK at screens with.
//
// Idempotent: every row carries a FIXED UUID and is inserted with
// onConflictDoNothing on its primary key — re-running never duplicates.
//
// Fail-closed BEFORE the first connection: the guard
// (assertLocalDemoDatabaseUrl) only ever accepts a LOCAL host with the
// database name exactly `binzi_local` or `binzi_e2e`, so this seed can
// never write to binzi-dev (shared with Production).
//
// Insert order respects the FK graph without insert-then-update:
// users → quizzes → courses (final_quiz_id) → lessons (quiz_id) →
// questions → question_options.
import { config } from "dotenv";
import { count, inArray } from "drizzle-orm";

import { createDb } from "./client";
import { assertLocalDemoDatabaseUrl, formatDatabaseTarget } from "./local-guard";
import {
  courses,
  lessons,
  questionOptions,
  questions,
  quizzes,
  users,
} from "./schema";

// ---- Fixed identifiers (hex-only, deterministic — idempotency depends on them)

const DEMO_AUTHOR_ID = "de000000-0000-4000-8000-000000000001";
const courseId = (i: number) => `c0a10000-0000-4000-8000-00000000000${i}`;
const lessonId = (i: number, j: number) =>
  `1e5a0000-0000-4000-8000-${i}0000000000${j}`;
const lessonQuizId = (i: number, j: number) =>
  `9e510000-0000-4000-8000-${i}0000000000${j}`;
const finalQuizId = (i: number) => `f1a10000-0000-4000-8000-00000f00000${i}`;

// Questions/options exist only for course 3's quizzes (card C-05 §2).
const QUIZ_CODES = { l1: "21", l2: "22", l3: "23", f0: "2f" } as const;
type QuizKey = keyof typeof QUIZ_CODES;
const hex2 = (n: number) => n.toString(16).padStart(2, "0");
const questionId = (key: QuizKey, n: number) =>
  `e5110000-0000-4000-8000-${QUIZ_CODES[key]}00000000${hex2(n)}`;
const optionId = (key: QuizKey, n: number, k: number) =>
  `0f510000-0000-4000-8000-${QUIZ_CODES[key]}${hex2(n)}0000000${k}`;

// ---- Minimal TipTap documents (doc → paragraph → text)

type TipTapDoc = {
  type: "doc";
  content: {
    type: "paragraph";
    content: { type: "text"; text: string }[];
  }[];
};

function tipTapDoc(text: string): TipTapDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

// ---- Demo dataset

const DEMO_AUTHOR = {
  id: DEMO_AUTHOR_ID,
  name: "[DEMO] Penulis Demo",
  email: "demo.penulis@example.com",
  role: "EDITOR" as const,
  // Deliberately NO accounts row: this user can never sign in — it only
  // fills created_by/updated_by (card C-05 §2).
};

const COURSE_STATUS = { 1: "DRAFT", 2: "DRAFT", 3: "IN_REVIEW" } as const;
const COURSE_LEVEL = {
  1: "BEGINNER",
  2: "INTERMEDIATE",
  3: "ADVANCED",
} as const;

// Course 3 (IN_REVIEW) also gets summary + description so the ONLY unmet
// publish requirement is the cover/thumbnail — a complete case for the
// S1-08 publish checklist.
const COURSE_SUMMARY: Record<number, string | null> = {
  1: null,
  2: null,
  3: "[DEMO] Ringkasan kursus contoh 3 — bukan konten nyata.",
};
const COURSE_DESCRIPTION: Record<number, TipTapDoc | null> = {
  1: null,
  2: null,
  3: tipTapDoc("[DEMO] Deskripsi kursus contoh 3 — bukan konten nyata."),
};

const COURSE_QUIZ_KEYS: QuizKey[] = ["l1", "l2", "l3", "f0"];
const quizIdForKey = (key: QuizKey): string =>
  key === "f0" ? finalQuizId(3) : lessonQuizId(3, Number(key[1]));

const OPTION_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Opsi A",
  2: "Opsi B",
  3: "Opsi C",
  4: "Opsi D",
};

function courseRows() {
  return ([1, 2, 3] as const).map((i) => ({
    id: courseId(i),
    title: `[DEMO] Kursus contoh ${i}`,
    slug: `demo-kursus-contoh-${i}`,
    summary: COURSE_SUMMARY[i],
    description: COURSE_DESCRIPTION[i],
    level: COURSE_LEVEL[i],
    estimatedMinutes: 30 + i * 15,
    status: COURSE_STATUS[i],
    finalQuizId: finalQuizId(i),
    createdBy: DEMO_AUTHOR_ID,
    updatedBy: DEMO_AUTHOR_ID,
  }));
}

function quizRows() {
  const rows = [];
  for (let i = 1; i <= 3; i++) {
    for (let j = 1; j <= 3; j++) {
      rows.push({
        id: lessonQuizId(i, j),
        type: "LESSON" as const,
        title: `[DEMO] Quiz materi ${j} kursus ${i}`,
        instructions: "[DEMO] Instruksi quiz — bukan konten nyata.",
        durationMinutes: 10, // within the 1–180 CHECK
      });
    }
    rows.push({
      id: finalQuizId(i),
      type: "FINAL" as const,
      title: `[DEMO] Quiz akhir kursus ${i}`,
      instructions: "[DEMO] Instruksi quiz — bukan konten nyata.",
      durationMinutes: 30,
    });
  }
  return rows;
}

function lessonRows() {
  const rows = [];
  for (let i = 1; i <= 3; i++) {
    for (let j = 1; j <= 3; j++) {
      rows.push({
        id: lessonId(i, j),
        courseId: courseId(i),
        title: `[DEMO] Materi ${j} kursus ${i}`,
        slug: `demo-materi-${j}`,
        orderIndex: j,
        content: tipTapDoc(
          `[DEMO] Teks materi ${j} kursus ${i} — bukan konten nyata.`,
        ),
        quizId: lessonQuizId(i, j),
        isFreePreview: j === 1,
        estimatedMinutes: 10,
      });
    }
  }
  return rows;
}

type QuestionSeed = {
  id: string;
  quizId: string;
  orderIndex: number;
  type: "SINGLE_CHOICE";
  text: TipTapDoc;
  explanation: TipTapDoc;
  points: number;
  /** 1–4, only used to build option rows. */
  correctOption: 1 | 2 | 3 | 4;
};

// 10 questions per quiz on course 3 (4 options, exactly 1 correct,
// explanation always present — rule Q40). The correct option rotates so
// every position occurs.
/** Correct option rotates (A→B→C→D→A…) so every position occurs. */
const correctOptionFor = (n: number) => (((n - 1) % 4) + 1) as 1 | 2 | 3 | 4;

function questionRows(): QuestionSeed[] {
  const rows: QuestionSeed[] = [];
  for (const key of COURSE_QUIZ_KEYS) {
    for (let n = 1; n <= 10; n++) {
      rows.push({
        id: questionId(key, n),
        quizId: quizIdForKey(key),
        orderIndex: n,
        type: "SINGLE_CHOICE",
        text: tipTapDoc(`Pertanyaan demo ${n}?`),
        explanation: tipTapDoc(`Pembahasan demo ${n}.`),
        points: 1,
        correctOption: correctOptionFor(n),
      });
    }
  }
  return rows;
}

// Options are generated from the same (key, n) space as their question ids,
// with their own UUID prefix — independent of the questions array.
function optionRows() {
  const rows = [];
  for (const key of COURSE_QUIZ_KEYS) {
    for (let n = 1; n <= 10; n++) {
      for (const k of [1, 2, 3, 4] as const) {
        rows.push({
          id: optionId(key, n, k),
          questionId: questionId(key, n),
          orderIndex: k,
          text: OPTION_LABELS[k],
          isCorrect: k === correctOptionFor(n),
        });
      }
    }
  }
  return rows;
}

// ---- Runner

async function main() {
  // drizzle-kit/tsx run outside Next.js; same env precedence as
  // drizzle.config.ts (.env.local wins over .env; a value already in the
  // process env wins over both).
  config({ path: ".env.local" });
  config();

  const url = assertLocalDemoDatabaseUrl(process.env.DATABASE_URL);
  console.log(`[db:seed:demo] target: ${formatDatabaseTarget(url)}`);

  const { db, client } = createDb(url);
  try {
    const report = await db.transaction(async (tx) => {
      const allQuizzes = quizRows();
      const course3QuizIds = COURSE_QUIZ_KEYS.map(quizIdForKey);
      const qData = questionRows();

      // "baru n · total demo m" — m counts the demo rows now in the table
      // (already present + just inserted), so a second run must print
      // "baru 0" with the same totals (card C-05 §2).
      const stat = (label: string, existing: number, inserted: number) => {
        console.log(
          `${label}: baru ${inserted} · total demo ${existing + inserted}`,
        );
      };

      const usersBefore = await tx
        .select({ n: count() })
        .from(users)
        .where(inArray(users.id, [DEMO_AUTHOR_ID]));
      const usersInserted = await tx
        .insert(users)
        .values(DEMO_AUTHOR)
        .onConflictDoNothing({ target: users.id })
        .returning({ id: users.id });
      stat("users", usersBefore[0]?.n ?? 0, usersInserted.length);

      const quizzesBefore = await tx
        .select({ n: count() })
        .from(quizzes)
        .where(
          inArray(
            quizzes.id,
            allQuizzes.map((q) => q.id),
          ),
        );
      const quizzesInserted = await tx
        .insert(quizzes)
        .values(allQuizzes)
        .onConflictDoNothing({ target: quizzes.id })
        .returning({ id: quizzes.id });
      stat("quizzes", quizzesBefore[0]?.n ?? 0, quizzesInserted.length);

      const courseValues = courseRows();
      const coursesBefore = await tx
        .select({ n: count() })
        .from(courses)
        .where(
          inArray(
            courses.id,
            courseValues.map((c) => c.id),
          ),
        );
      const coursesInserted = await tx
        .insert(courses)
        .values(courseValues)
        .onConflictDoNothing({ target: courses.id })
        .returning({ id: courses.id });
      stat("courses", coursesBefore[0]?.n ?? 0, coursesInserted.length);

      const lessonValues = lessonRows();
      const lessonsBefore = await tx
        .select({ n: count() })
        .from(lessons)
        .where(
          inArray(
            lessons.id,
            lessonValues.map((l) => l.id),
          ),
        );
      const lessonsInserted = await tx
        .insert(lessons)
        .values(lessonValues)
        .onConflictDoNothing({ target: lessons.id })
        .returning({ id: lessons.id });
      stat("lessons", lessonsBefore[0]?.n ?? 0, lessonsInserted.length);

      const questionsBefore = await tx
        .select({ n: count() })
        .from(questions)
        .where(inArray(questions.quizId, course3QuizIds));
      const questionsInserted = await tx
        .insert(questions)
        .values(
          qData.map((q) => ({
            id: q.id,
            quizId: q.quizId,
            orderIndex: q.orderIndex,
            type: q.type,
            text: q.text,
            explanation: q.explanation,
            points: q.points,
          })),
        )
        .onConflictDoNothing({ target: questions.id })
        .returning({ id: questions.id });
      stat("questions", questionsBefore[0]?.n ?? 0, questionsInserted.length);

      const optionValues = optionRows();
      const optionsBefore = await tx
        .select({ n: count() })
        .from(questionOptions)
        .where(
          inArray(
            questionOptions.questionId,
            qData.map((q) => q.id),
          ),
        );
      const optionsInserted = await tx
        .insert(questionOptions)
        .values(optionValues)
        .onConflictDoNothing({ target: questionOptions.id })
        .returning({ id: questionOptions.id });
      stat(
        "question_options",
        optionsBefore[0]?.n ?? 0,
        optionsInserted.length,
      );

      return {
        users: usersInserted.length,
        courses: coursesInserted.length,
        lessons: lessonsInserted.length,
        quizzes: quizzesInserted.length,
        questions: questionsInserted.length,
        options: optionsInserted.length,
      };
    });
    console.log(
      `Seed demo selesai (idempoten — jalankan ulang kapan saja): ` +
        `${report.users} user, ${report.courses} kursus, ${report.lessons} materi, ` +
        `${report.quizzes} quiz, ${report.questions} soal, ${report.options} opsi baru.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
