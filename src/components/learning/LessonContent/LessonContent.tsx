import { renderTiptapHtml } from "@/features/contents/lib/renderTiptapHtml";
import type { LessonContentItem } from "@/features/progress/queries/getLessonForLearning";

import styles from "./LessonContent.module.scss";

/**
 * BINZI lesson Content renderer (TASK 046, Task Plan "Render Content
 * in persisted order"; UI/UX §12–§16).
 *
 * Server Component: the caller (lesson page) has already passed the
 * canAccessLesson gate (TASK 044) and passes the PUBLISHED contents
 * in persisted order (getLessonForLearning). This component only
 * presents them — no data access, no mutation, no client JS.
 *
 * UI/UX §12 governs the composition: content renders in its
 * configured order and "should visually feel like one coherent
 * lesson" — "the user should not need to understand Content Types".
 * So every block shares one structure (heading + body) and NO type
 * labels are rendered; the type only selects the presentation
 * affordance:
 * - ARTICLE / TEXT / INFOGRAPHIC — Tiptap body through the ONE
 *   existing safe serializer (renderTiptapHtml, TASK 020), the same
 *   boundary as the public article page and the admin preview. For
 *   INFOGRAPHIC, §16's responsive/aspect-ratio/alt rules apply to
 *   image nodes INSIDE that body (rendered max-width:100%,
 *   height:auto, with the Tiptap alt attribute) — the seed has no
 *   dedicated infographic image field (FLAG, see acceptance report).
 * - VIDEO (§14) — embedded naturally between title and the body text
 *   (the optional description), with the spec's graceful-failure
 *   message when the persisted metadata does not resolve to a known
 *   embeddable source. A failed embed never breaks the lesson.
 * - TIP (§15) — stands apart from ordinary paragraphs as a
 *   💡-labelled callout, without decorative overuse.
 *
 * Sections are keyed by sort_order (UNIQUE(lesson_id, sort_order))
 * and labelled via `content-{n}-title` ids — no internal uuids reach
 * the client.
 */

const VIDEO_FALLBACK_MESSAGE =
  "Video ini tidak dapat dimuat. Silakan coba lagi.";

/** The only embeddable source V1 knows (seed + CMS write "youtube"). */
type VideoSource = { videoId: string };

/**
 * Defensive parse of the VIDEO metadata jsonb (publish-gated to
 * non-empty { provider, videoId } strings, TASK 035; still never
 * trusted at render time). The videoId charset check plus the
 * hardcoded https origin make the iframe src construct-only — no
 * persisted string can inject attributes or a different origin.
 */
function parseYoutubeSource(metadata: unknown): VideoSource | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }
  const { provider, videoId } = metadata as Record<string, unknown>;
  if (provider !== "youtube") {
    return null;
  }
  if (
    typeof videoId !== "string" ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(videoId)
  ) {
    return null;
  }
  return { videoId };
}

function ContentBody({ body }: { body: LessonContentItem["body"] }) {
  /*
   * bodyHtml is produced by renderTiptapHtml from the stored Tiptap
   * JSON: every text/attribute boundary is escaped, node and mark
   * names allowlisted, and URLs are http(s)-only — the same
   * documented boundary as /articles/[slug] and ContentPreview.
   */
  const bodyHtml = renderTiptapHtml(body);
  return (
    <div
      className={styles.body}
      dangerouslySetInnerHTML={{ __html: bodyHtml }}
    />
  );
}

function LessonContentBlock({ item }: { item: LessonContentItem }) {
  const headingId = `content-${item.sortOrder}-title`;

  if (item.type === "VIDEO") {
    const video = parseYoutubeSource(item.metadata);
    return (
      <section className={styles.block} aria-labelledby={headingId}>
        <h2 className={styles.blockTitle} id={headingId}>
          {item.title}
        </h2>
        {video !== null ? (
          <div className={styles.videoFrame}>
            <iframe
              className={styles.videoIframe}
              src={`https://www.youtube-nocookie.com/embed/${video.videoId}`}
              title={item.title}
              loading="lazy"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <p role="note" className={styles.videoFallback}>
            {VIDEO_FALLBACK_MESSAGE}
          </p>
        )}
        {/* §14 "Optional description" — the Tiptap body under the embed. */}
        <ContentBody body={item.body} />
      </section>
    );
  }

  if (item.type === "TIP") {
    return (
      <section className={styles.tip} aria-labelledby={headingId}>
        <h2 className={styles.tipTitle} id={headingId}>
          <span aria-hidden="true">💡</span> {item.title}
        </h2>
        <ContentBody body={item.body} />
      </section>
    );
  }

  // ARTICLE, TEXT, INFOGRAPHIC — one coherent reading flow (§12).
  return (
    <section className={styles.block} aria-labelledby={headingId}>
      <h2 className={styles.blockTitle} id={headingId}>
        {item.title}
      </h2>
      <ContentBody body={item.body} />
    </section>
  );
}

/**
 * Renders the lesson's Content list in persisted order. An empty list
 * renders nothing — a lesson with zero published contents shows its
 * title and the (TASK 048+) quiz area only; no placeholder content.
 */
export function LessonContent({ items }: { items: LessonContentItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className={styles.list}>
      {items.map((item) => (
        <LessonContentBlock key={item.sortOrder} item={item} />
      ))}
    </div>
  );
}
