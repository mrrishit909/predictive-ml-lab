/**
 * scroll-storyboard.md "Accessible fallback (all beats)": a visually
 * hidden section with a heading and the same text as the captions plus a
 * textual summary of the visual state. The canvas is aria-hidden; this is
 * what screen readers and the "JS-rendered text only, no canvas" path get.
 */
export default function AccessibleFallback({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="visually-hidden">
      <h2>{heading}</h2>
      <p>{children}</p>
    </section>
  )
}
