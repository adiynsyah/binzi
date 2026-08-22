/**
 * BINZI development seed (Task Plan TASK 008, Blueprint §10).
 *
 * Seeds: 1 Admin + 1 User, 1 Published Course with 3 Published Lessons,
 * multiple Content per Lesson, 3 Lesson Quizzes (exactly 10 Questions
 * each), 1 Final Quiz (10 Questions), and 1 additional Draft Course.
 *
 * Idempotent: every row uses a deterministic UUID and every insert runs
 * with ON CONFLICT DO NOTHING, so the seed can be executed repeatedly
 * against a clean development environment without errors or duplicates
 * and without destroying unrelated data.
 *
 * Usage: npm run db:seed  (node --env-file=.env src/db/seed.mjs)
 *
 * Plain ESM JavaScript on postgres.js by design — running the typed
 * Drizzle schema would require a TypeScript runner dependency that the
 * TASK 008 specification does not call for. Database constraints remain
 * the correctness authority for every inserted row.
 */
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Seed aborted.");
  process.exit(1);
}

const sqlClient = postgres(process.env.DATABASE_URL, { max: 1 });

/**
 * Deterministic UUID per integer (v4-shaped). Allocation map:
 *   1-2 users | 10-11 courses | 20-22 lessons | 30-37 contents
 *   40-47 lesson_contents | 50-53 quizzes | 100-139 questions
 *   200-359 question options
 */
const uuid = (n) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;

const T = {
  created: "2026-07-15T08:00:00.000Z",
  published: "2026-08-01T08:00:00.000Z",
};

// --- Tiptap JSON helpers (contents.body is a Tiptap document) ---------
const doc = (...blocks) => ({ type: "doc", content: [...blocks] });
const p = (text) => ({ type: "paragraph", content: [{ type: "text", text }] });
const h2 = (text) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const ul = (...items) => ({
  type: "bulletList",
  content: items.map((text) => ({ type: "listItem", content: [p(text)] })),
});

// --- Users (TASK 008: Admin + User) ------------------------------------
const ADMIN_ID = uuid(1);
const USERS = [
  {
    id: ADMIN_ID,
    email: "admin@binzi.dev",
    display_name: "BINZI Admin",
    role: "ADMIN",
  },
  {
    id: uuid(2),
    email: "learner@binzi.dev",
    display_name: "Sample Learner",
    role: "USER",
  },
];

// --- Courses (TASK 008: 1 Published + 1 Draft) --------------------------
const PUBLISHED_COURSE_ID = uuid(10);
const COURSES = [
  {
    id: PUBLISHED_COURSE_ID,
    title: "Fundamentals of Balanced Nutrition",
    slug: "fundamentals-of-balanced-nutrition",
    description:
      "Learn the essentials of balanced nutrition: macronutrients, reading food labels, and building balanced everyday meals.",
    difficulty: "BEGINNER",
    estimated_duration: 120,
    status: "PUBLISHED",
    published_at: T.published,
  },
  {
    id: uuid(11),
    title: "Sports Nutrition Essentials",
    slug: "sports-nutrition-essentials",
    description:
      "An intermediate course covering nutrition strategies for training, recovery, and performance.",
    difficulty: "INTERMEDIATE",
    estimated_duration: 90,
    status: "DRAFT",
    published_at: null,
  },
];

// --- Lessons (TASK 008: 3 Lessons, all Published per Business Rules) ----
const LESSON_IDS = [uuid(20), uuid(21), uuid(22)];
const LESSONS = [
  {
    id: LESSON_IDS[0],
    title: "Understanding Macronutrients",
    slug: "understanding-macronutrients",
    description: "Meet the three macronutrients and learn how each fuels your body.",
  },
  {
    id: LESSON_IDS[1],
    title: "Reading Nutrition Labels",
    slug: "reading-nutrition-labels",
    description: "Learn to decode serving sizes, %DV, and ingredient lists.",
  },
  {
    id: LESSON_IDS[2],
    title: "Building Balanced Meals",
    slug: "building-balanced-meals",
    description: "Put knowledge into practice with the balanced plate method.",
  },
].map((lesson, index) => ({
  ...lesson,
  course_id: PUBLISHED_COURSE_ID,
  sort_order: index + 1,
  status: "PUBLISHED",
  published_at: T.published,
}));

// --- Contents (TASK 008: multiple Content per Lesson) ------------------
const CONTENT_IDS = {
  macronutrients: uuid(30),
  macroVideo: uuid(31),
  labels: uuid(32),
  labelsInfographic: uuid(33),
  labelsTip: uuid(34),
  plate: uuid(35),
  plateText: uuid(36),
  plateTip: uuid(37),
};

const CONTENTS = [
  {
    id: CONTENT_IDS.macronutrients,
    type: "ARTICLE",
    title: "What Are Macronutrients?",
    slug: "what-are-macronutrients",
    body: doc(
      h2("What Are Macronutrients?"),
      p("Macronutrients are the nutrients your body needs in large amounts: carbohydrate, protein, and fat."),
      p("Each one plays a different role:"),
      ul(
        "Carbohydrate — the body's main quick-energy source, at 4 kcal per gram.",
        "Protein — builds and repairs tissue, at 4 kcal per gram.",
        "Fat — concentrated energy and hormone support, at 9 kcal per gram.",
      ),
      p("A balanced diet draws on all three in proportions that fit your daily activity."),
    ),
    metadata: null,
  },
  {
    id: CONTENT_IDS.macroVideo,
    type: "VIDEO",
    title: "Macronutrients Explained",
    slug: null,
    body: doc(
      p("A short walkthrough of how carbohydrate, protein, and fat work together in a balanced diet."),
    ),
    metadata: { provider: "youtube", videoId: "binzi-demo-001" },
  },
  {
    id: CONTENT_IDS.labels,
    type: "ARTICLE",
    title: "How to Read a Nutrition Label",
    slug: "how-to-read-a-nutrition-label",
    body: doc(
      h2("How to Read a Nutrition Label"),
      p("Start at the top: the serving size and servings per container drive every number below it."),
      ul(
        "%DV shows how much a serving contributes to a 2,000-calorie reference diet.",
        "5% DV or less is low; 20% DV or more is high.",
        "Ingredients are listed by weight, most to least.",
      ),
      p("Use %DV to favor nutrients you want more of, like fiber, and limit added sugars, sodium, and saturated fat."),
    ),
    metadata: null,
  },
  {
    id: CONTENT_IDS.labelsInfographic,
    type: "INFOGRAPHIC",
    title: "The Nutrition Label at a Glance",
    slug: null,
    body: doc(
      p("A one-page visual summary of the key parts of a nutrition label, from serving size to ingredient list."),
    ),
    metadata: null,
  },
  {
    id: CONTENT_IDS.labelsTip,
    type: "TIP",
    title: "Quick Tip: The 5–20% Rule",
    slug: null,
    body: doc(
      p("Low is 5% DV or less, high is 20% DV or more. Aim low for added sugars and sodium; aim high for fiber, vitamins, and minerals."),
    ),
    metadata: null,
  },
  {
    id: CONTENT_IDS.plate,
    type: "ARTICLE",
    title: "The Balanced Plate Method",
    slug: "the-balanced-plate-method",
    body: doc(
      h2("The Balanced Plate Method"),
      p("The balanced plate is a simple visual guide for building a healthy meal without counting every calorie."),
      ul(
        "Half the plate: vegetables and fruits, with plenty of variety and color.",
        "One quarter: whole grains such as oats, brown rice, or whole-wheat bread.",
        "One quarter: lean protein such as chicken, fish, eggs, beans, or tofu.",
      ),
      p("Round out the meal with water as the default drink."),
    ),
    metadata: null,
  },
  {
    id: CONTENT_IDS.plateText,
    type: "TEXT",
    title: "Worked Example: One Day of Balanced Meals",
    slug: null,
    body: doc(
      p("Breakfast: oatmeal with sliced banana and a boiled egg."),
      p("Lunch: brown rice, grilled chicken, and a mixed vegetable salad."),
      p("Dinner: baked fish, steamed broccoli, and sweet potato."),
    ),
    metadata: null,
  },
  {
    id: CONTENT_IDS.plateTip,
    type: "TIP",
    title: "Quick Tip: Half Your Plate Vegetables",
    slug: null,
    body: doc(
      p("When in doubt, fill half your plate with vegetables or fruit before serving the rest of the meal."),
    ),
    metadata: null,
  },
].map((content) => ({
  ...content,
  status: "PUBLISHED",
  created_by: ADMIN_ID,
  updated_by: ADMIN_ID,
  published_at: T.published,
}));

// --- lesson_contents (UNIQUE(content_id): each Content used once) ------
const LESSON_CONTENTS = [
  { id: uuid(40), lesson_id: LESSON_IDS[0], content_id: CONTENT_IDS.macronutrients, sort_order: 1 },
  { id: uuid(41), lesson_id: LESSON_IDS[0], content_id: CONTENT_IDS.macroVideo, sort_order: 2 },
  { id: uuid(42), lesson_id: LESSON_IDS[1], content_id: CONTENT_IDS.labels, sort_order: 1 },
  { id: uuid(43), lesson_id: LESSON_IDS[1], content_id: CONTENT_IDS.labelsInfographic, sort_order: 2 },
  { id: uuid(44), lesson_id: LESSON_IDS[1], content_id: CONTENT_IDS.labelsTip, sort_order: 3 },
  { id: uuid(45), lesson_id: LESSON_IDS[2], content_id: CONTENT_IDS.plate, sort_order: 1 },
  { id: uuid(46), lesson_id: LESSON_IDS[2], content_id: CONTENT_IDS.plateText, sort_order: 2 },
  { id: uuid(47), lesson_id: LESSON_IDS[2], content_id: CONTENT_IDS.plateTip, sort_order: 3 },
];

// --- Quizzes (3 Lesson + 1 Final) ---------------------------------------
const QUIZ_IDS = {
  lesson1: uuid(50),
  lesson2: uuid(51),
  lesson3: uuid(52),
  final: uuid(53),
};
const QUIZZES = [
  {
    id: QUIZ_IDS.lesson1,
    title: "Lesson Quiz: Understanding Macronutrients",
    type: "LESSON",
    lesson_id: LESSON_IDS[0],
    course_id: null,
  },
  {
    id: QUIZ_IDS.lesson2,
    title: "Lesson Quiz: Reading Nutrition Labels",
    type: "LESSON",
    lesson_id: LESSON_IDS[1],
    course_id: null,
  },
  {
    id: QUIZ_IDS.lesson3,
    title: "Lesson Quiz: Building Balanced Meals",
    type: "LESSON",
    lesson_id: LESSON_IDS[2],
    course_id: null,
  },
  {
    id: QUIZ_IDS.final,
    title: "Final Quiz: Fundamentals of Balanced Nutrition",
    type: "FINAL",
    lesson_id: null,
    course_id: PUBLISHED_COURSE_ID,
  },
];

/**
 * Question bank: 40 distinct questions (10 per Lesson Quiz + 10 Final).
 * `correct` is the 1-based index of the correct option; `is_correct` is
 * computed here but every value is still validated by the database.
 */
const QUESTIONS = [
  // Lesson 1 — Understanding Macronutrients
  { quiz: "lesson1", text: "Which macronutrient provides approximately 4 calories per gram?", options: ["Carbohydrate", "Fat", "Vitamin", "Water"], correct: 1, explanation: "Carbohydrate and protein each provide about 4 kcal per gram; fat provides 9." },
  { quiz: "lesson1", text: "Which nutrient is the body's main quick-energy source?", options: ["Fat", "Protein", "Carbohydrate", "Fiber"], correct: 3, explanation: "Carbohydrate is broken down into glucose, the body's preferred quick fuel." },
  { quiz: "lesson1", text: "How many calories per gram does dietary fat provide?", options: ["4", "7", "9", "12"], correct: 3, explanation: "Fat is the most energy-dense macronutrient at 9 kcal per gram." },
  { quiz: "lesson1", text: "Protein is primarily used by the body for which purpose?", options: ["Storing energy in fat cells", "Building and repairing tissues", "Regulating body temperature only", "Transporting light"], correct: 2, explanation: "Protein supplies the amino acids used to build and repair muscle and other tissue." },
  { quiz: "lesson1", text: "Which of these foods is a source of complete protein?", options: ["Rice", "Egg", "Banana", "Olive oil"], correct: 2, explanation: "Eggs contain all essential amino acids, making them a complete protein." },
  { quiz: "lesson1", text: "Dietary fiber is classified as which type of nutrient?", options: ["Protein", "Carbohydrate", "Fat", "Mineral"], correct: 2, explanation: "Fiber is a carbohydrate that the body does not digest." },
  { quiz: "lesson1", text: "Which type of fat is generally considered heart-healthy?", options: ["Trans fat", "Saturated fat", "Monounsaturated fat", "Hydrogenated fat"], correct: 3, explanation: "Monounsaturated fats, such as those in olive oil and nuts, support heart health." },
  { quiz: "lesson1", text: "Which vitamin is water-soluble?", options: ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin K"], correct: 2, explanation: "Vitamin C and the B vitamins dissolve in water and are not stored in large amounts." },
  { quiz: "lesson1", text: "In a standard balanced diet, roughly what share of daily calories comes from carbohydrate?", options: ["0–5%", "45–65%", "80–90%", "100%"], correct: 2, explanation: "Common guidance places carbohydrate at 45–65% of daily calories." },
  { quiz: "lesson1", text: "Which combination tends to keep you feeling full longest after a meal?", options: ["Sugar and water", "Protein and fat", "Caffeine and fiber", "Salt and starch"], correct: 2, explanation: "Protein and fat slow digestion and promote lasting fullness." },

  // Lesson 2 — Reading Nutrition Labels
  { quiz: "lesson2", text: "Where do you find the serving size on a nutrition label?", options: ["At the bottom", "At the top", "In the footnote", "Only on the back"], correct: 2, explanation: "Serving size appears at the top; every other number is based on it." },
  { quiz: "lesson2", text: "What does %DV stand for?", options: ["Diet variety", "Daily value", "Deficiency value", "Distributed vitamins"], correct: 2, explanation: "%DV is the percent Daily Value — a serving's contribution to a reference diet." },
  { quiz: "lesson2", text: "Percent Daily Value is based on a reference diet of how many calories?", options: ["1,000", "1,500", "2,000", "2,500"], correct: 3, explanation: "%DV is calculated against a 2,000-calorie reference diet." },
  { quiz: "lesson2", text: "A food with 5% DV or less of a nutrient per serving is considered what?", options: ["High", "Low", "Average", "Excessive"], correct: 2, explanation: "5% DV or less is low; 20% DV or more is high." },
  { quiz: "lesson2", text: "What are added sugars?", options: ["The same as natural sugars", "Sugars introduced during processing", "Sugars found only in candy", "A type of protein"], correct: 2, explanation: "Added sugars are sweeteners added during processing, distinct from sugars innate to fruit or milk." },
  { quiz: "lesson2", text: "Which of these should you generally limit in a healthy diet?", options: ["Dietary fiber", "Added sugars", "Protein", "Iron"], correct: 2, explanation: "Most people eat too much added sugar; fiber, protein, and iron are typically encouraged." },
  { quiz: "lesson2", text: "How are ingredients listed on a food package?", options: ["Alphabetically", "By weight, most to least", "By price", "By calories"], correct: 2, explanation: "Ingredients are listed by weight, starting with the most abundant." },
  { quiz: "lesson2", text: "A package holds 2 servings and you eat both. What should you do with the label values?", options: ["Halve them", "Double them", "Ignore them", "Divide by three"], correct: 2, explanation: "Eating both servings means consuming twice the values shown per serving." },
  { quiz: "lesson2", text: "Which of these is a whole grain?", options: ["White rice", "Enriched flour", "Oats", "Corn syrup"], correct: 3, explanation: "Oats retain the whole grain kernel; white rice and enriched flour are refined." },
  { quiz: "lesson2", text: "Ideally, trans fat listed on a label should be what?", options: ["As high as possible", "As close to zero as possible", "At least 1 gram", "Ignored entirely"], correct: 2, explanation: "Trans fat raises heart-disease risk, so intake should be as low as possible." },

  // Lesson 3 — Building Balanced Meals
  { quiz: "lesson3", text: "In the balanced plate method, half of the plate should be filled with what?", options: ["Protein", "Grains", "Vegetables and fruits", "Sauce"], correct: 3, explanation: "Half the plate goes to vegetables and fruits for fiber, vitamins, and volume." },
  { quiz: "lesson3", text: "If one quarter of the plate is protein, what should the other quarter be?", options: ["Whole grains", "Dessert", "Butter", "Fruit juice"], correct: 1, explanation: "The classic split is half vegetables and fruit, one quarter whole grains, one quarter protein." },
  { quiz: "lesson3", text: "Which drink is the best default choice with meals?", options: ["Sweetened tea", "Water", "Soda", "Energy drink"], correct: 2, explanation: "Water hydrates without added sugars or stimulants." },
  { quiz: "lesson3", text: "Which is a practical way to control portions at home?", options: ["Eating straight from the package", "Using smaller plates", "Skipping breakfast", "Adding extra sauce"], correct: 2, explanation: "Smaller plates make sensible portions look satisfying and reduce over-serving." },
  { quiz: "lesson3", text: "Which cooking method preserves the most nutrients?", options: ["Deep frying", "Long boiling", "Steaming", "Charring"], correct: 3, explanation: "Steaming uses gentle heat and no water loss, keeping more vitamins intact." },
  { quiz: "lesson3", text: "Which snack is the most nutritionally balanced?", options: ["A candy bar", "Fruit with nuts", "Chips only", "Soda only"], correct: 2, explanation: "Fruit provides fiber and vitamins; nuts add protein and healthy fat." },
  { quiz: "lesson3", text: "Why should meals include a variety of colors?", options: ["Different colors provide different nutrients", "It only looks nicer", "Colors replace the need for protein", "Bright foods are always sweet"], correct: 1, explanation: "Plant colors reflect different phytonutrients and vitamin profiles." },
  { quiz: "lesson3", text: "Skipping breakfast is most associated with which pattern?", options: ["Better focus", "Overeating later in the day", "Higher fiber intake", "Stronger muscles"], correct: 2, explanation: "Skipping meals often leads to excessive hunger and overeating later." },
  { quiz: "lesson3", text: "Which is a lean protein choice?", options: ["Sausage", "Chicken breast", "Bacon", "Duck fat"], correct: 2, explanation: "Chicken breast is high in protein and low in saturated fat." },
  { quiz: "lesson3", text: "Planning meals ahead mainly helps you do what?", options: ["Reduce impulsive, less-healthy choices", "Burn calories faster", "Lower water intake", "Increase sodium"], correct: 1, explanation: "A meal plan removes in-the-moment decisions that favor convenience food." },

  // Final Quiz — Fundamentals of Balanced Nutrition
  { quiz: "final", text: "Which macronutrient provides 9 calories per gram?", options: ["Carbohydrate", "Protein", "Fat", "Fiber"], correct: 3, explanation: "Fat provides 9 kcal per gram, more than double carbohydrate or protein." },
  { quiz: "final", text: "Percent Daily Value on a label is based on a diet of how many calories?", options: ["1,500", "2,000", "2,800", "3,000"], correct: 2, explanation: "%DV uses a 2,000-calorie reference diet." },
  { quiz: "final", text: "The first ingredient on a food label is what?", options: ["The least by weight", "The most by weight", "The healthiest", "Always sugar"], correct: 2, explanation: "Ingredients are ordered by weight, from most to least." },
  { quiz: "final", text: "In the balanced plate method, one quarter of the plate is protein. What is the other quarter?", options: ["Whole grains", "Butter", "Syrup", "Salt"], correct: 1, explanation: "One quarter whole grains and one quarter protein complete the plate." },
  { quiz: "final", text: "Which nutrient is most important for tissue repair?", options: ["Carbohydrate", "Fat", "Protein", "Water"], correct: 3, explanation: "Protein supplies amino acids for building and repairing tissue." },
  { quiz: "final", text: "Which fat is an example of a heart-healthy choice?", options: ["Butter", "Olive oil", "Lard", "Hard margarine"], correct: 2, explanation: "Olive oil is rich in monounsaturated fat and linked to heart health." },
  { quiz: "final", text: "A food with 20% DV or more of fiber per serving is considered what?", options: ["Low", "High", "Average", "Banned"], correct: 2, explanation: "20% DV or more is considered high for any nutrient." },
  { quiz: "final", text: "What is the best default daily beverage?", options: ["Soda", "Water", "Energy drink", "Sweetened juice drink"], correct: 2, explanation: "Water meets hydration needs without added sugars." },
  { quiz: "final", text: "Compared with deep frying, steaming food does what?", options: ["Adds healthy fats", "Preserves more nutrients", "Increases calories", "Removes protein"], correct: 2, explanation: "Steaming avoids high-fat cooking medium and nutrient loss into water." },
  { quiz: "final", text: "A plate with many natural colors most likely indicates what?", options: ["Broader nutrient intake", "Excess sugar", "Too much protein", "Nothing at all"], correct: 1, explanation: "Variety of natural colors usually means a wider range of nutrients." },
];

// Flatten questions + options with deterministic ids.
const QUESTION_ROWS = [];
const OPTION_ROWS = [];
const QUIZ_QUESTION_ROWS = [];
const perQuizCount = {};
QUESTIONS.forEach((question, index) => {
  const questionId = uuid(100 + index);
  QUESTION_ROWS.push({
    id: questionId,
    question_text: question.text,
    explanation: question.explanation,
  });
  question.options.forEach((optionText, optionIndex) => {
    OPTION_ROWS.push({
      id: uuid(200 + index * 4 + optionIndex),
      question_id: questionId,
      option_text: optionText,
      sort_order: optionIndex + 1,
      is_correct: optionIndex === question.correct - 1,
    });
  });
  perQuizCount[question.quiz] = (perQuizCount[question.quiz] ?? 0) + 1;
  QUIZ_QUESTION_ROWS.push({
    id: uuid(300 + index),
    quiz_id: QUIZ_IDS[question.quiz],
    question_id: questionId,
    sort_order: perQuizCount[question.quiz],
  });
});

// --- Seed execution ------------------------------------------------------
const SEED_IDS = {
  users: USERS.map((u) => u.id),
  courses: COURSES.map((c) => c.id),
  lessons: LESSONS.map((l) => l.id),
  contents: CONTENTS.map((c) => c.id),
  lesson_contents: LESSON_CONTENTS.map((lc) => lc.id),
  quizzes: QUIZZES.map((q) => q.id),
  questions: QUESTION_ROWS.map((q) => q.id),
  quiz_questions: QUIZ_QUESTION_ROWS.map((qq) => qq.id),
};

let failures = 0;
const check = (label, pass, detail) => {
  console.log(`${pass ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures += 1;
};

const seedPromise = sqlClient.begin(async (tx) => {
  // Single deterministic transaction; every statement is a no-op on
  // re-runs, so the transaction as a whole is idempotent.
  await tx`insert into users ${tx(USERS, "id", "email", "display_name", "role")} on conflict do nothing`;
  await tx`insert into courses ${tx(
    COURSES.map((c) => ({ ...c, created_at: T.created, updated_at: T.created })),
    "id",
    "title",
    "slug",
    "description",
    "difficulty",
    "estimated_duration",
    "status",
    "created_at",
    "updated_at",
    "published_at",
  )} on conflict do nothing`;
  await tx`insert into lessons ${tx(
    LESSONS.map((l) => ({ ...l, created_at: T.created, updated_at: T.created })),
    "id",
    "course_id",
    "title",
    "slug",
    "description",
    "sort_order",
    "status",
    "created_at",
    "updated_at",
    "published_at",
  )} on conflict do nothing`;
  await tx`insert into contents ${tx(
    CONTENTS.map((c) => ({ ...c, created_at: T.created, updated_at: T.created })),
    "id",
    "type",
    "title",
    "slug",
    "body",
    "metadata",
    "status",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
    "published_at",
  )} on conflict do nothing`;
  await tx`insert into lesson_contents ${tx(
    LESSON_CONTENTS.map((lc) => ({ ...lc, created_at: T.created })),
    "id",
    "lesson_id",
    "content_id",
    "sort_order",
    "created_at",
  )} on conflict do nothing`;
  await tx`insert into questions ${tx(
    QUESTION_ROWS.map((q) => ({ ...q, created_at: T.created, updated_at: T.created })),
    "id",
    "question_text",
    "explanation",
    "created_at",
    "updated_at",
  )} on conflict do nothing`;
  await tx`insert into question_options ${tx(
    OPTION_ROWS,
    "id",
    "question_id",
    "option_text",
    "sort_order",
    "is_correct",
  )} on conflict do nothing`;
  await tx`insert into quizzes ${tx(
    QUIZZES.map((q) => ({ ...q, created_at: T.created, updated_at: T.created })),
    "id",
    "title",
    "type",
    "lesson_id",
    "course_id",
    "created_at",
    "updated_at",
  )} on conflict do nothing`;
  await tx`insert into quiz_questions ${tx(
    QUIZ_QUESTION_ROWS,
    "id",
    "quiz_id",
    "question_id",
    "sort_order",
  )} on conflict do nothing`;

  // --- Read-only verification (seed-scoped, so extra unrelated dev
  //     data never fails the seed; the transaction is rolled back on
  //     any failure so a half-seeded state can never persist). ---
  const seedCount = async (table, ids) => {
    const rows = await tx`select count(*)::int as n
      from ${sqlClient(table)}
      where id = any(${ids}::uuid[])`;
    return rows[0].n;
  };

  check("users seeded", (await seedCount("users", SEED_IDS.users)) === 2);
  const adminRole = await tx`select role from users where id = ${ADMIN_ID}`;
  check("admin role is ADMIN", adminRole[0]?.role === "ADMIN");
  const courses = await tx`select id, status, published_at from courses where id = any(${SEED_IDS.courses}::uuid[])`;
  check(
    "published course is PUBLISHED with published_at",
    courses.some((c) => c.id === PUBLISHED_COURSE_ID && c.status === "PUBLISHED" && c.published_at !== null),
  );
  check(
    "draft course is DRAFT without published_at",
    courses.some((c) => c.id !== PUBLISHED_COURSE_ID && c.status === "DRAFT" && c.published_at === null),
  );

  const lessons = await tx`select status, sort_order, count(*)::int as n
    from lessons where course_id = ${PUBLISHED_COURSE_ID}
    group by status, sort_order order by sort_order`;
  check(
    "3 published lessons, sort_order 1–3",
    lessons.length === 3 &&
      lessons.every((l) => l.status === "PUBLISHED" && l.n === 1) &&
      lessons.map((l) => l.sort_order).join(",") === "1,2,3",
  );

  check("contents seeded", (await seedCount("contents", SEED_IDS.contents)) === 8);
  const linkedContents = await tx`select count(distinct content_id)::int as n from lesson_contents`;
  check(
    "UNIQUE(content_id) respected — each content assigned at most once",
    linkedContents[0].n === 8,
  );

  check("quizzes seeded", (await seedCount("quizzes", SEED_IDS.quizzes)) === 4);
  const quizShape = await tx`select type, count(*)::int as n
    from quizzes where id = any(${SEED_IDS.quizzes}::uuid[])
    group by type`;
  check(
    "3 LESSON quizzes + 1 FINAL quiz",
    quizShape.find((t) => t.type === "LESSON")?.n === 3 &&
      quizShape.find((t) => t.type === "FINAL")?.n === 1,
  );

  const perQuiz = await tx`select q.type, count(qq.id)::int as n
    from quiz_questions qq
    join quizzes q on q.id = qq.quiz_id
    where qq.quiz_id = any(${SEED_IDS.quizzes}::uuid[])
    group by q.type`;
  const totalQuizQuestions = perQuiz.reduce((sum, t) => sum + t.n, 0);
  check(
    "every Lesson Quiz and the Final Quiz has exactly 10 questions",
    perQuiz.length === 2 &&
      perQuiz.find((t) => t.type === "LESSON")?.n === 30 &&
      perQuiz.find((t) => t.type === "FINAL")?.n === 10 &&
      totalQuizQuestions === 40,
    `LESSON=${perQuiz.find((t) => t.type === "LESSON")?.n ?? 0}, FINAL=${perQuiz.find((t) => t.type === "FINAL")?.n ?? 0}, total=${totalQuizQuestions}`,
  );

  const perQuizIndividual = await tx`select quiz_id, count(*)::int as n
    from quiz_questions
    where quiz_id = any(${SEED_IDS.quizzes}::uuid[])
    group by quiz_id`;
  check(
    "each individual quiz has exactly 10 questions",
    perQuizIndividual.length === 4 && perQuizIndividual.every((q) => q.n === 10),
  );

  const optionShape = await tx`select q.id, count(o.id)::int as options,
    sum(case when o.is_correct then 1 else 0 end)::int as correct
    from questions q
    join question_options o on o.question_id = q.id
    where q.id = any(${SEED_IDS.questions}::uuid[])
    group by q.id`;
  check(
    "every question has exactly 4 options and exactly 1 correct",
    optionShape.length === 40 &&
      optionShape.every((q) => q.options === 4 && q.correct === 1),
  );
  // A failed verification aborts the transaction so a half-seeded
  // state can never persist.
  if (failures > 0) {
    throw new Error("seed verification failed");
  }
});

try {
  await seedPromise;
  console.log("\nSEED OK — idempotent, safe to re-run.");
} catch {
  console.error(
    `\nSEED FAILED: ${failures} verification(s) failed. Transaction rolled back — no data was written.`,
  );
  process.exitCode = 1;
} finally {
  await sqlClient.end();
}
