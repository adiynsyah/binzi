// CLI: npm run video:youtube -- --kursus <slug> --materi <slug> --video <id|url> --durasi <detik>
// (card S2-02 §8)
//
// Attaches a YouTube video to ONE lesson for the demo: sets video_source
// (provider YOUTUBE + external id), status READY, the duration, and clears
// a stale R2 key. There is deliberately NO web endpoint for this; the
// script is run by hand only (the CMS video UI is a later card).
//
// - --video accepts a bare 11-char id OR a youtube.com/youtu.be watch url
//   (src/lib/youtube.ts parses it — same acceptance as the lesson page).
// - --durasi is an integer 1..86400.
// - The target line `[video:youtube] target: host:port/nama-db` prints
//   BEFORE the connection is created (the db:migrate proof-of-target
//   pattern, card C-05 §3): read it before proceeding.
// - NO audit_logs row: actor_id is NOT NULL and a CLI run has no actor
//   (same owner decision as scripts/set-role.ts, A-12).
//
// Environment: loaded by the npm script via tsx --env-file-if-exists; the
// script itself only ever reads DATABASE_URL from process.env.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createDb } from "../src/db/client";
import { setLessonYouTubeVideo } from "../src/db/lesson-video";
import { formatDatabaseTarget } from "../src/db/local-guard";
import { parseYouTubeId } from "../src/lib/youtube";

function printUsage(): void {
  console.error(
    "Pemakaian: npm run video:youtube -- " +
      "--kursus <slug-kursus> --materi <slug-materi> " +
      "--video <id-youtube-11-karakter|url> --durasi <detik 1..86400>",
  );
}

/** Parse `--flag value` pairs; unknown flags and leftovers are errors. */
function parseFlags(argv: string[]): {
  flags: Record<string, string>;
  error?: string;
} {
  const known = new Set(["kursus", "materi", "video", "durasi"]);
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i]!;
    if (!flag.startsWith("--") || !known.has(flag.slice(2))) {
      return {
        flags,
        error: `flag tidak dikenal atau kurang argumen: ${flag}`,
      };
    }
    const value = argv[i + 1];
    if (value === undefined) {
      return { flags, error: `nilai untuk ${flag} belum diisi` };
    }
    flags[flag.slice(2)] = value;
  }
  return { flags };
}

/** Integer 1..86400 (a full day — longer than any demo video). */
function parseDuration(input: string): number {
  const seconds = Number(input);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86_400) {
    throw new Error(
      `Durasi tidak valid: "${input}". Harus bilangan bulat 1..86400 detik.`,
    );
  }
  return seconds;
}

async function main(): Promise<void> {
  const [, , ...args] = process.argv;
  const { flags, error } = parseFlags(args);
  const missing = ["kursus", "materi", "video", "durasi"].filter(
    (key) => !flags[key],
  );
  if (error || missing.length > 0) {
    if (error) console.error(error);
    if (missing.length > 0)
      console.error(`Flag wajib belum diisi: ${missing.join(", ")}`);
    printUsage();
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL belum diisi — muat lewat .env.local / .env (lihat docs/tasks/README.md).",
    );
    process.exit(1);
  }

  // Proof of target BEFORE connecting (never echoes user/password).
  console.log(`[video:youtube] target: ${formatDatabaseTarget(url)}`);

  // --video may be a watch url; the core only ever stores a bare id.
  const videoId = parseYouTubeId(flags.video!);
  if (!videoId) {
    console.error(
      `ID video tidak sah: "${flags.video}" — pakai id 11 karakter atau url youtube.com/youtu.be.`,
    );
    process.exit(1);
  }

  const { db, client } = createDb(url);
  try {
    const result = await setLessonYouTubeVideo(db, {
      courseSlug: flags.kursus!,
      lessonSlug: flags.materi!,
      videoId,
      durationSeconds: parseDuration(flags.durasi!),
    });
    const before = result.previous.videoExternalId
      ? `${result.previous.videoProvider} ${result.previous.videoExternalId}`
      : (result.previous.videoProvider ?? "tanpa sumber");
    console.log(
      `Kursus "${result.courseTitle}" · materi "${result.lessonTitle}"`,
    );
    console.log(
      `Sebelum : ${before} (status ${result.previous.videoStatus}` +
        `${result.previous.videoDurationSeconds === null ? "" : `, ${result.previous.videoDurationSeconds} dtk`})`,
    );
    console.log(
      `Sesudah: YOUTUBE ${videoId} (status READY, ${flags.durasi} dtk)`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// Run only when executed as a script (tsx), not when tests import the core.
const entry = process.argv[1];
const invokedAsScript =
  entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href;
if (invokedAsScript) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
