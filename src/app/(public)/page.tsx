/*
 * Beranda placeholder (card A-14a): content arrives in S6. Only change here
 * — <main> moved up into the (public) layout, and the empty section anchor
 * is added as the target of the "Konsultasi" nav link. Its scroll margin
 * mirrors the sticky header height (68 / 80, see HEADER_HEIGHT in
 * nav-items.ts) so the section top is never covered (KSL-14).
 */
export default function HomePage() {
  return (
    <>
      BINZI
      <section
        id="tanya-ahli-gizi"
        aria-label="Tanya Ahli Gizi"
        className="scroll-mt-[68px] sm:scroll-mt-[80px]"
      />
    </>
  );
}
