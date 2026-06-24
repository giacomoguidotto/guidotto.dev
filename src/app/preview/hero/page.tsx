import { Hero } from "~/components/hero";

// Standalone preview of the hero (Vitrine) at rest so the section is
// independently verifiable by eye at /preview/hero. The Hero mounts its own
// ShowcaseRoot (the reactivity root that earns color on focus and drives the
// pointer parallax), so this route just renders it on the page shell. Composing
// the hero into the home page itself is the later capstone slice (#10), which is
// why this lives behind a thin preview route rather than re-touching
// src/app/page.tsx.

export default function HeroPreview() {
  return (
    <main className="page">
      <Hero />
    </main>
  );
}
