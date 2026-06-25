# guidotto.dev

The personal portfolio site for Giacomo Guidotto. Its job is to make a hiring
decision-maker think "I need to talk to this person" — by showing overwhelming,
specific, verifiable proof rather than by making claims.

This file captures the site's resolved positioning and content language. It is
the canonical vocabulary for copy, structure, and design decisions. It is not
implementation detail. Source facts live in Notion (see `AGENTS.md`); this file
only records what we've *decided* about how to present them.

## Audience priority

1. **Hiring decision-maker** — eng manager, senior tech lead, or founder-as-hirer
   at a European/Swiss product-eng company or strong-remote team. The site is
   optimized to convert this person into reaching out.
2. **Founders & the tech crowd** — peers who confer reputation and inbound.
3. **Recruiters & sourcers** — served, not optimized for; they have their own tools.

## Language

**Range**:
The core claim. Depth across the whole stack — backend platforms, native apps,
and ML research — with the ability to go deep wherever the problem lives. This is
the one thing the site exists to prove.
_Avoid_: "generalist" (reads as "master of none"), "full-stack" alone (too small
for the actual breadth).

**Proof Artifact**:
A shipped, independently verifiable thing that demonstrates Range — a public repo,
a published library, a released app, a production service. The site argues by
stacking Proof Artifacts, not by asserting adjectives.

**Pillar**:
One of the three supporting angles beneath Range. Every Proof Artifact maps to at
least one Pillar.
- **Platform** — backend/systems: Go services, the graph service, Kubernetes,
  MQTT/Kafka/Rust ingestion. (The dump's conservative default positioning.)
- **Product** — shipped user-facing software: React/Next micro-frontends, the
  macOS app, the Android app, client portfolio work.
- **Research & AI** — CS-fundamentals-to-shipped-research: AnyPINN, the funded
  PINN work, the AI-native direction. Flexed as a differentiator, never led with.

**Show-don't-tell**:
The site's governing rule. "Most impressive SWE ever" is the *impression* a
visitor should form, never a sentence on the page. Artifacts brag; the copy stays
factual and adjective-light. Confidence, not arrogance.

**Voice (first-person narration; no strict rule)**:
The default register is **Giacomo narrating his own work in the first person** — it's
his portfolio, so "my machine learning library", "my love", "I learned Go in a week"
are on-voice, and the warmth of "I" is the *payoff* at the personal and ownership
beats. Three standing exceptions keep it from getting confessional: **product pitch**
(a product speaks for itself: "Find your rhythm", "Circle to Search for macOS"),
**infinitive/imperative product lines** and **site chrome / labels** (eyebrows,
taxonomy, section labels like `SELECTED WORK`, `COLLECTION`). There is **no strict
rule** — first person where *he* is narrating, product/label voice where the thing is
pitching or naming itself; judgment per line. Identity is still anchored by **name +
face**. (Revised 2026-06-22; relaxes the strict curatorial / no-first-person rule of
2026-06-21 once real copy showed first person was warmer and truer at the ownership
beats. Copy-craft rule from the same pass: **no em dashes in published copy** — they
read as AI-written; use periods, commas, colons.)

## Relationships

- The site proves exactly one **Range** claim.
- **Range** stands on three **Pillars**: Platform, Product, Research & AI.
- Each **Pillar** is evidenced by one or more **Proof Artifacts**.
- Every public statement obeys **Show-don't-tell** and the public-safe claim rules
  in `WEBSITE_INFO_DUMP.md`.

## Proof Artifact set (flagship)

Curation rule: **maximize domain coverage** — each flagship artifact is a different
platform/language so the breadth is visually undeniable. The home features these;
a fuller index of all stories can live at `/stories` later (deferred — the home grid
stays high-signal).

- **AnyPINN** — Research & AI · Python/PyTorch · published library. Hardest-to-fake
  credential (457 tests, JOSS, PyPI, docs). Carries the research flex without
  leading with it.
- **Orray** — Platform · Go + Kubernetes · spatial infra UI. Framed honestly as
  **pre-production / in active development** (mock topology); reads as momentum.
- **Tempo** — Product · Android · Expo/RN + design system. Ordered **before Scry**
  (roadmap: ship Tempo to Play Store before rebuilding Scry).
- **Scry** — Product · native macOS · Swift/AppKit. Showcase the artifact and what
  it does (an installable native Mac app); never claim clean internals (prototype
  slated for rewrite).
- **Ginevra Renier** — Product · web · the **love letter**. Framed as a gift built
  for his girlfriend to support her work as a photographer/artist — the human,
  emotional-attachment angle; the only artifact proving "ships for real people."
  Consent: explicit, informed, documented (2026-06-20). Wording is warm, one line,
  names the relationship, and does **not** restate her name in an appositive (it's
  already in the title).

**Danfoss** is the **trajectory anchor**, not a card: production-at-scale
credibility (frontend → full-stack owner, graph service, Go-in-a-week, MQTT/Kafka/
Rust, Kubernetes). Public-safe claims only.

**Blueprint** is excluded from the front page (conventional boilerplate, too thin).

## Centerpiece & visual hierarchy

The site has **at most two tentpoles**, at different scroll depths, never competing
for the same instant — this is the rule that protects clarity:

- **Breadth tentpole = the hero.** The first instant states **Range** across
  domains — a thesis line over the work itself. **Lightweight and reactive (no
  heavy WebGL)** so first paint is instant. Evergreen, true now, matches the
  T-shaped self-concept.
- **Depth tentpole = the crown jewel.** Exactly one Proof Artifact overdelivers as
  a *genuinely-live, interactive* showpiece — **AnyPINN solving the Lorenz system
  live in WebGL** (a neural network discovering the butterfly attractor from noisy
  data; full spec in **Showpiece — "The Attractor"** below). This is the **single
  3D/WebGL spend** (the scalpel). It lives **inside the proof section**, not the
  hero, so there is never a second front-door "wow" diluting the message.

Division of labor: **hero promises breadth, crown jewel proves depth → Range.**

### Hero concept (resolved: "Vitrine" — thesis over the work, under glass)

The hero's only job is to win the **first 5 seconds**, which happen *before any
scroll* — so the initial viewport must be self-sufficiently arresting (strong
static composition + subtle auto-motion), not dependent on scroll choreography.
It must land three things at frame 1: **instant clarity** (who/why, no confusion),
a **pattern-interrupt** (so a jaded viewer doesn't file it under "another dev
portfolio"), and a **reason to scroll** (visible promise of payoff below).

Form — **"Vitrine"**: the work sits under CSS-faked **glass** (museum vitrine /
contact sheet); a crisp horizontally-centered **thesis line** floats over it. The
work is the **setting**; the thesis is the **subject** — at frame 1 the words lead
and the work is soft-focus behind glass, so the message never blurs, yet the work
has presence and dignity (not a "quiet backdrop"). Foreground *says* Range; the
work *proves* it (show-don't-tell). Disciplines that keep it fast and senior:

- **LCP is the headline text** — server-rendered, instant. The work is optimized
  looping video / posters (cheap), **not** live apps, with zero layout shift.
- **Lightweight-reactive, not genuinely-live.** The hero *earns color through
  attention* — focusing a vessel (hover / keyboard / touch) blooms that project's
  accent — but it's CSS-faked: no running apps, no heavy compute, no WebGL.
  **Genuinely-live** (a real neural net in WebGL) is reserved for the crown jewel
  below; that stays the **single WebGL spend** (scalpel intact). The contrast —
  hero *reacts*, crown jewel *computes* — is itself a signal of judgment.
- The interaction is a **retention reward at second 6+**, not a first-5-seconds
  device: the static resting composition (thesis + blurred cool vitrine) wins the
  first impression on its own; the reactivity rewards engaging.
- The work must read as **"many different things"** at a glance (variety is the
  point), yet the thesis stays the subject so the message never blurs.
- **Human presence is a signature, not a centerpiece.** The hero carries the
  **name / wordmark + a small signature-scale avatar** (whose collection this is —
  attribution, subordinate to the work, like an artist's name at a gallery
  entrance). Present from frame 1 so the site is never faceless, but Giacomo is
  never the *subject* (the work and thesis are). This **begins the human
  escalation** that pays off as a full warm face before the CTA (see Lower-page
  arc); it adds **no first-person voice** (see Voice).

#### Hero assets & per-project identity

- Each plane is a **per-project screen recording**, planned/scripted/shot/edited
  individually. Planes are **pluggable and deployed incrementally** as each
  recording lands — the composition must read as **intentional with a partial set**
  (graceful degradation: deliberate from the first plane, never "broken until all 5
  exist"). A small **minimum viable set** ships the hero; the rest fill in.
- **Identity in the hero = accent color, not logo.** Each plane carries its
  project's **accent color** — restrained in the hero (the thesis stays the
  subject), saturating to full strength on that project's own card/page. Color is
  asset-free and instant, so it delivers the "distinct, intentional worlds" read
  with no dependency on logo art. (Discipline: one accent per plane over the cool
  near-black field, so multiple accents never go circus-y.)
- **Logos are identifiers, reserved for the proof cards, case-study headers, and
  the scroll-resolve moment** (a plane becoming a card) — not hero spectacle. A
  running-app loop is *proof*; a logo is *branding*, weaker for show-don't-tell.
  Logos standardize to **SVG** first (crisp at any scale, themeable to the accent,
  tiny, animatable); that work gates the **cards**, not the hero — so the hero ships
  on loops + accent colors independently.
- Real lightweight live embeds (Expo-web, Orray canvas) are **postponed**.

The crown-jewel slot is **pluggable and meant to evolve**: when a planned flagship
lands (production Tempo on the Play Store, generative UI in Orray, …) it can become
a second showpiece or be promoted into a depth-led hero. The breadth hero is the
stable default; depth showpieces are swappable. This is the "breadth now, depth as
a flagship lands" plan, built structurally so it never needs a rebuild.

Legibility: the live instrument carries a one-line plain caption; its chaos→order
motion reads as "solving" even without ML knowledge. Sitting below the breadth hero
keeps its legibility burden low (the audience has already engaged).

### Scroll handoff (contact sheet → grid → enlargement)

The hero pays off its own "vitrine / contact sheet" metaphor as you scroll — one
continuous idea, the *same work* developing through three states. **No scroll-jack,
no scroll-lock:** scroll is free from pixel one; the handoff is *scroll-position-
driven*, not time-gated (the "second 6" is narrative only).

1. **Contact sheet (hero).** All the work, small, under glass, blurred, parallaxed,
   overlapping in depth — including the **showpiece plane** (currently AnyPINN).
2. **Prints (proof grid).** On scroll the planes lose parallax + blur and **settle
   into a sharp, aligned grid** of proof cards — chaos→order, soft→sharp, depth→flat
   (rhyming with the showpiece's own chaos→order "solving"). The grid is **four
   peers** (Orray, Tempo, Scry, Ginevra → a clean 2×2). The **showpiece plane does
   NOT join the grid:** it gives a brief lift/brighten "wait for me" beat, then slides
   off-stage — a curatorial **set-aside, never a vanish** — seeding a "where did it
   go" open loop. The thesis hands the baton (rises/fades as the grid forms). Breadth
   is scanned here.
3. **Enlargement (the showpiece finale).** *After* the grid (**breadth-then-depth**,
   so the two tentpoles never share an instant), the set-aside plane **returns and
   enlarges into the full live WebGL instrument** — the *same plane that exited* comes
   back (shared-element through-line), paying off the loop. Its own generous stage,
   a **subtle spotlight** (CSS radial vignette, not a real light) pooling it out of
   the cool-dark field, carrying its earned accent. The finale says **"those are
   cool — now check this out"**: it is *the most demonstrable / live one*, a
   production choice — **not** the most important one, and **never** a research
   headline. Range is already established by the 2×2 above, so the finale *caps*
   range rather than claiming a headline.

This is **Option C** (showpiece excluded from the grid), chosen over A (showpiece
as a hidden grid peer that enlarges) to kill the duplication, give a clean 2×2,
and land a deliberate finale beat. It holds **only under three conditions**: (a) the
exit reads as a *deliberate* curatorial set-aside, never a glitch/loss; (b) the
finale **must not depend on the loop** — it lands fully for viewers who never
noticed the departure (the loop is a bonus for attentive ones); (c) the finale is
framed as *the live one, not the best one*, with the four peers reading as full
equals.

Mechanics (the morph): shared-element A→B — the vessels are the **same DOM
elements** in both states, re-placed by **transform/opacity only** (FLIP),
GPU-composited, zero reflow. The showpiece **exit + return is also transform/
opacity-only** (it parks off-viewport, cheap). Videos freeze to poster during the
~400ms settle, then resume. **Animated blur is the one costly thing** → don't animate
the radius; cross-fade a pre-blurred poster into the sharp frame ("develops like a
photograph"). Artistry lives in the **staggered cascade**, the depth→flat settle,
the set-aside, and the baton-pass — all under the reactivity law (*one physics, one
lead*).

The showpiece slot is **pluggable**: currently AnyPINN (it's the one that goes
genuinely live), swaps to Orray / Tempo / whatever flagship next earns "live" — no
rebuild. Its job description is **"the showpiece"** (the strongest *check-this-out*),
not "the research project."

Bounded + degrading: the settle happens over **~one viewport**, then it's a normal
scrollable grid (not a journey). Graceful degradation is built in: shared-element
morph → dissolve-and-reveal if janky → **`prefers-reduced-motion` always gets the
plain sectioned version** (hero, then 2×2 grid, then showpiece finale; no morph, no
set-aside).

#### Decision (2026-06-25): one DOM node per project — the unified `ProjectTile`

The "same DOM elements" mechanic above is realised literally: a project is **one
`<a>` element** that *is* the vitrine vessel at rest and *is* the proof card once
landed, never two elements that cross-fade. A single node can't be both the hero's
non-navigating `<button>` and the card's `<a href>`, so the node is **one `<a>`**
whose behaviour is swapped at the morph boundary (its `href` and click target are
**absent at rest / during flight, present only once resolved**; pointer events are
blocked mid-flight). The caption (title, weighted line, tag, on-focus copy, and the
future "see the story" slot — dark until `storyHref` is sourced, see Showpiece) is
always in the DOM and **assembles in** at the destination rather than dissolving.
All five planes (the four peers + the showpiece) are `<a>` for DOM consistency; the
showpiece is `href`-less throughout and sets itself aside as before. Soft → sharp
is the hero's own depth treatment carried onto the tile: the poster wears a
`filter: blur()` at the same per-depth radii the hero vessel uses, and the stage
fades that blur to none (and tightens the corner from a rounder vitrine radius to
the proof card's 1.4rem) across the morph.

**Blur mechanism (2026-06-25, revises line 229).** The first cut used a
constant-radius `backdrop-filter` veil whose opacity faded (to honour line 229's
"don't animate the radius"). On the deployed preview that read visibly weaker and
smeared than the hero, and `backdrop-filter` blur strength is GPU/compositor-
dependent. The tile now blurs the **poster content** with `filter: blur()` (the
hero's own, consistent mechanism) and **animates the radius** to none on landing.
This is a deliberate, bounded reversal of line 229: it animates blur on ≤5
GPU-composited tiles over a single one-shot scroll (the hero itself already
transitions `filter: blur()` on hover), which is acceptable for the fidelity gain.

**Rest fidelity + unified vessels (2026-06-25, supersedes the corner-morph and the
bespoke showpiece set-aside above).** The first unified-tile cut diverged from the
hero at rest in three ways: it scaled each peer tile down from its grid cell with
`transform: scale()`, which shrank the rasterised `filter: blur()` and
`border-radius` by that scale (blur read too soft, worst on the sharp foreground
Orray; corners too tight); the showpiece sat at natural size with a *different*
(2.4rem) corner; and the at-rest tiles dropped the hero's earn-colour-on-hover. The
corrected rule is that **the at-rest tile matches `<Hero/>` 1:1**:
- The corner is a **constant 1.4rem** (the hero vessel's and the proof card's shared
  value); the earlier "rounder vitrine radius that tightens to 1.4rem" is dropped.
- `drive()` **divides the blur radius and the corner by the live FLIP scale**, so the
  on-screen blur is exactly the hero's per-depth radius (1.5 / 4 / 8px) and the
  corner exactly 1.4rem no matter how far down a tile is scaled. The hero's per-depth
  recede opacity and `--scale` are reproduced too (the depth scale folds into the
  source size).
- At rest the tiles are **hover-reactive like the hero vessels** (a hovered/focused
  tile lifts, clears its blur, blooms its accent, and washes the field), driven
  through the same single-lit coordinator that lights the resolved grid.

And the **five vessels are now uniform**: every tile — the four peers and the AnyPINN
showpiece — is one rig with a **source** (its vitrine scatter point + size) and a
**target**, driven by the *same* `drive()` (no special-cased showpiece exit). Peers
target their own grid cell (source = vitrine, target = cell) and resolve into
navigable cards; the showpiece's DOM home *is* the contact sheet, so its source is
identity and its **target is a point just below the grid, off-screen** — the
curatorial set-aside, expressed as a plain target rather than a bespoke slide. That
below-grid target is a **placeholder**: the finale (#9) retargets the showpiece onto
the live attractor in the showpiece section instead of a card, by changing only its
target.

**Ownership note / integration contract.** This unified tile deliberately crosses
the old per-slice file-ownership boundary (it supersedes the separate `GlassVessel`
`<button>` hero and `ProofCard` `<a>` grid). It currently lives **only behind
`/preview/stage`** so the live homepage and the standalone `/preview/hero` +
`/preview/proof-grid` are untouched for now — **but this `ProjectTile` motion stage
is the canonical, final hero + grid.** The integration slice that wires the homepage
**must adopt this**, not rebuild the old two-node hero/grid. The plain
(reduced-motion / coarse / narrow / no-JS) fallback still composes the existing
`<Hero />` + `<ProofGrid />`; integration may later re-home those onto the same tile.

### Showpiece — "The Attractor" (AnyPINN · Lorenz)

The crown jewel is **AnyPINN solving the Lorenz system live in WebGL**, presented as
**"The Attractor."** Chosen for **spectacle that lands on a non-ML viewer** (audience
priority #1 isn't all ML people): the double-lobed butterfly is the most legible
beautiful object in dynamical systems, and watching a neural network *find* it from
noisy data is an emotional payoff that needs no physics background. (Decided
2026-06-22; supersedes the earlier defer-to-Phase-2 / recording-only plan — it ships
**genuinely live at launch**.)

**What it actually is (truthful framing).** AnyPINN's Lorenz example is an *inverse
problem*: the network is handed **noisy scatter** and recovers the hidden trajectory
(three neural fields x, y, z) plus the constants σ, ρ, β. The non-expert story is
**"noisy dots in, elegant order out"** — the machine finding the law behind the chaos.

- **The payoff is the trajectory, not parameter accuracy.** The state fit is excellent
  (hugs the data to the noise floor, both lobes, no divergence over the trained
  window). σ and β recover almost exactly (~10.13 and ~2.659), but **ρ recovers ~31%
  low** (19.28 vs 28.0) in the shipped run. This under-recovery is **structural, not a
  data-quality issue**: a lower-noise re-run (0.5 → 0.25, 2026-06-22) fit the points
  *tighter* yet pushed ρ *further* off (17.67), confirming ρ is genuinely
  under-identified at this horizon — noise is not the lever. So the spectacle is built
  on the butterfly *forming*; the recovered constants are a **quiet HUD garnish with no
  truth-claim** — never "it perfectly recovers the physical constants." **Shipped
  artifact = the canonical-config run** (`noise_std=0.5`, seed 42, 3000 epochs) in
  `.showpiece/lorenz/`.
- **Genuinely live, not a video.** The browser runs the real tiny tanh MLPs forward
  (~50 lines; `τ∈[0,1] → net → ×SCALE = physical xyz`) over **real per-epoch weight
  snapshots**, so "watch it converge" is literally true. Snapshots come from a one-off
  training re-run exported as a float32 binary + JSON manifest; the **AnyPINN library
  is untouched** and the export stays uncommitted (`/.showpiece`, gitignored). The
  forward recipe is verified to reproduce the model to float precision.

**The spectacle (`@react-three/fiber` + drei — the single WebGL spend):**

- Noisy **observations rain in** as faint cool-white motes in 3D — the data the net sees.
- The **learned field** is a glowing green (`#22C55E`) tube threading the motes;
  at the initial snapshot it's a tangled stub, and as epochs replay it **uncurls and
  snaps into the butterfly**, additive bloom peaking at convergence (the one loud
  answer per the reactivity law), then easing back.
- After convergence a **comet head traces the attractor forever** (fading additive
  trail) — the perpetual, hypnotic beauty that holds attention; this is the
  lower-energy denouement resting state.
- **Drag to orbit.** The object is genuinely 3D, so spinning it *is* the reward
  ("interactive 3D, not a 2D plot"); depth fog dims the far lobe for parallax.
- A slim **epoch scrubber** drags the convergence back and forth under the finger. It
  **auto-plays the convergence once on scroll-into-view** (not time-gated, no
  scroll-jack), then settles into the comet.

**HUD — "converging knobs" (legibility is load-bearing).** The corner readout makes the
abstract idea concrete for a non-ML viewer: **three knobs/dials for σ, ρ, β that
visibly settle into their slots** as training proceeds — "the machine finding hidden
numbers" made physical — plus the real **loss ticking down** and an epoch counter.
JetBrains Mono, quiet, never competing with the attractor. **No ground-truth target is
shown** on the knobs (ρ honesty): they settle to the values the net actually found, not
to a "correct" mark.

**Perf & degradation** (reactivity law): precompute each snapshot's trajectory once on
load via the live forward pass, cache, then morph/draw — all transform/opacity,
GPU-composited. The raw (~16 MB float32) export is **quantized + gzipped on ingest** and
**lazy-loaded only when the finale scrolls into view**. Degrades: full spectacle →
static converged butterfly (final weights only, Phase-2 fallback) →
`prefers-reduced-motion` shows the converged attractor with no auto-motion. The slot
stays **pluggable** (swaps to any flagship that later earns "live") — its job is "the
showpiece," not "the research project."

### Proof cards (card anatomy)

A proof card is **recording-forward with an earned caption** — the work speaks
first, words are minimal but *weighted*. The job of every card is to answer **"why
should I care"** without conflicting with a fast breadth scan. It proves three ways
without telling: the **motion** (it runs), the **artifact** (it's real/rigorous),
and the **craft of the card itself** (beautiful + fast). This anatomy governs the
**four grid peers** (Orray, Tempo, Scry, Ginevra); the **showpiece is not a grid
card** — it carries the live instrument's one-line plain caption instead (see Scroll
handoff), though the *one-badge* rule still applies to it.

- **At rest (the scannable layer):** the work under glass (sharp poster frame, no
  parallax) + **one weighted line** carrying the why-care, plus a small mono
  `domain · stack` tag for the breadth scan (domain coverage is the point of the
  flagship set). Single line, no paragraph, no pitch.
- **On focus / hover (the card "answers loudly," per the reactivity law):** the
  recording plays/sharpens, the **earned accent blooms** (saturated on cards), gloss
  sweeps the vessel, and the **bigger picture** surfaces — a sentence or two of
  context that fully lands the why-care + **exactly one proof badge** (the single
  hardest *artifact* — e.g. the showpiece's `457 tests · JOSS · PyPI`) + a secondary
  **"see the story"** button → `/stories/[slug]`. One badge: the work is the
  argument, the badge is a footnote of evidence.

**The card is a portal to the live product.** Primary action (click/tap the card) →
`<slug>.guidotto.dev` (the juice). The focus-revealed **"see the story"** is the
*secondary, opt-in depth* path → `/stories/[slug]`. Hierarchy is explicit: product
first, story second.

> **v1 (decided 2026-06-22):** the primary card click routes to each project's
> **GitHub repo** (uniformly, all four), not the subdomain — several subdomains are
> down and the repos are the always-on proof. The card *recording vessel* is
> unchanged (still the visual). Subdomain-portal routing returns post-v1.

Copy law: **"weighted words" = weighted by specificity, not intensifiers.** The
why-care is carried by a concrete **capability or outcome**, never an adjective or
unsupported claim (show-don't-tell, adjective-light). All card copy + every
badge/metric is a **Notion-sourced pass** — placeholder / `null` until sourced,
never invented.

The focused card's rest→focus state is also the **start frame of the "see the
story" transition** (the recording is the shared element into `/stories/[slug]`).
Reduced-motion: rest and focus collapse to a static legible card (line + tag + badge
+ both links visible, no play/bloom).

### Story page (`/stories/[slug]`)

> **v1 (decided 2026-06-22):** **all story pages are deferred** — none ship at
> launch. The architecture below stands for when they land; at v1 every
> "see the story" affordance is dropped or repointed (cards → GitHub repo).

**A story page is a room in the gallery** — same architecture as every other room
(the Vitrine language, plaques, lighting), unique directed art inside. It is **not a
second pitch page**: the live subdomain already sells the *product* to its users.
The story sells the *builder* to hiring decision-makers — **origin, the way of
thinking, the making-of, the proof.** It's a **narrative dossier**, not a feature
tour, kept show-don't-tell throughout (it *shows the thinking*, never asserts it).
Optional and **per-project**: built only where there's a real story/proof to tell;
otherwise the card just routes to the live product and no story page exists.

**Two web surfaces per project — different jobs, don't duplicate:**
- **`<slug>.guidotto.dev`** = the **product landing page**. Pitch + features + CTA,
  in the *product's* voice, for its *users*. The card's primary destination.
- **`guidotto.dev/stories/[slug]`** = the **story**. Origin + judgment + proof, in
  *Giacomo's* voice, for *hiring decision-makers*. The focus-revealed "see the
  story" destination. Also owns apex-domain SEO and covers projects without a strong
  subdomain.

This is a **templated spine of "exhibit slots" filled with bespoke directed
assets** — not five hand-built pages (won't ship), not one rigid form (feels
canned). The spine is fixed so it scales *and* gives the "see the story" transition
stable anchors; slots carry the bespoke art so no two rooms feel alike.

1. **Hero.** The card's recording arrives full-bleed as the **shared element**; accent
   now fully saturated (we're in its room). One weighted line + a clear **"see it"
   CTA** → `<slug>.guidotto.dev` (the live product is always one click away).
2. **Origin.** Where it came from — the itch, the constraint, the why-it-exists. The
   beat the subdomain never tells.
3. **The thinking.** How it was approached and built — key decisions and technical
   moves, **shown** (directed recordings/visuals/architecture), not narrated. The
   meat; variable-length per project (range and judgment live here).
4. **The proofs.** Hard artifacts expanded from the badge — tests, JOSS paper, store
   listing, repo, metrics — linked to the actual things.
5. **Keep it going.** The "go deeper" hub: **"see it"** (subdomain), repo, paper,
   docs, store — every real link.
6. **Discover other projects.** Path back to the gallery / on to the next room.

Transition split: the **"see the story"** path (card → `/stories/[slug]`) is
same-origin and gets the slick **shared-element morph** (the recording is the shared
element). The **primary card → `<slug>.guidotto.dev`** jump is cross-origin and gets
a simpler **launch** transition (no morph). The crafted morph is thus a reward for
projects deep enough to have a room.

#### Transition mechanics (decided)

Driver: the **browser View Transitions API** (Option A), not a JS FLIP library —
native, GPU-composited, off-main-thread.

- **Shared element:** the **recording vessel** carries the same `view-transition-name`
  on the card and the story hero; the browser snapshots + tweens position/size while
  everything else cross-fades. Next.js 16 App Router soft-nav (`/` ↔
  `/stories/[slug]`) is same-document, so this works via the experimental
  `viewTransition` flag / React 19 `<ViewTransition>`.
- **Video freeze for free:** the API snapshots the `<video>` as a frozen frame
  mid-morph (this *is* our "freeze to poster" rule), then it resumes playing in the
  hero. No animated blur anywhere.
- **Degradation (delight is a bonus, never load-bearing):** View Transitions API
  where supported → **plain cross-fade** where not (no JS FLIP of a live video) →
  **`prefers-reduced-motion` = instant cut**.
- **Back and forth:** forward morphs card → hero; **back** morphs hero → its grid
  slot, which requires **restoring the grid scroll position first** so the card
  target exists in the viewport (Next.js scroll restoration; we coordinate timing).
  If the target is offscreen, it **falls back to a fade** (never morph to nowhere).
  The grid's settled state is **preserved** across the round trip — returning never
  re-runs the contact-sheet settle.
- **Cross-origin launch:** card → `<slug>.guidotto.dev` can't share an element, so
  it gets a deliberate **launch gesture** (card lifts/brightens, field washes to its
  accent, then hard nav) — *leaving for the live thing*, distinct on purpose from
  *opening a room*.

## Lower-page arc (after the showpiece)

Everything below the showpiece finale is **denouement, not a third act**. The page
has already spent its two tentpoles (breadth hero, depth showpiece); the lower page
must **not** introduce a third spectacle — that breaks the "at most two tentpoles"
law and reads as trying too hard. Its job is **retention through earned curiosity**
("if this is what he's done, I want to keep knowing"), carried by **narration +
earned micro-motion**, never a new showstopper. A confident close: the proof has
landed; now we resolve.

### Trajectory (forward-slope, not a CV timeline)

The post-showpiece beat is **momentum**, framed as a **forward slope** — where this
is heading — **not** a backward-looking CV/work-history timeline. Anchored on
**Danfoss** as proof-of-slope (the trajectory anchor, not a card): production-at-
scale, learned-Go-in-a-week, owned the graph service. It must read as
*accelerating*, not as a résumé. Trajectory facts are a **Notion-sourced
cherry-pick** — placeholder until sourced, never invented.

### Distributed credibility (no dedicated block)

Giacomo already **has** third-party validation — **JOSS** peer review, **Danfoss**
institutional trust, the **degree**. A dedicated "credibility" block would
**double-spend** facts already working elsewhere, so credibility is **distributed**:
JOSS → the Proof badge, Danfoss → Trajectory, degree → the human anchor. What he
lacks (testimonials, KPIs/stars/downloads) is **not fabricated** — a **pluggable
testimonial / KPI slot** stays **dark until real** (same pattern as the deferred
Calendly slot). Never invent social proof.

### Human throughline & escalation (name + face)

Identity is woven through the whole page and **escalates**, carried by **name +
face**, with first-person warmth landing at the high note (see Voice).
- **In chrome / hero:** name / wordmark + a **small signature-scale avatar**
  (attribution scale, subordinate to the work). Present from frame 1 so the site is
  never faceless, the work still the subject.
- **Just before the CTA:** the **full, warm face + one personal line** — the larger
  human moment, the payoff the work has earned by now. The escalation's high note.
- An optional **/about** can hold the longer human story; the home page needs only
  the hint-then-payoff.

### CTA close (one loud owned door + a quiet rail)

The close obeys the reactivity law: **one loud door, a quiet rail of alternatives**
— never an equal-weight menu, which would dilute the action at the one moment it
matters most. The six-way channel question collapses once the channels are sorted by
job: **reach-me** (form), **presence + proof** (GitHub, X), **off-register**
(Instagram). Only one is the loud contact door.

- **Loud door = the direct line (contact form), surfaced as a single clean
  "Get in touch."** Highest-intent and *owned* — the finale stays on Giacomo's
  stage, not handed to LinkedIn's UI. You amplify the path that needs a nudge (the
  considered note), not the frictionless ones.
- **Reveal in place on click:** the button **transforms into the form's frame**
  (expand/FLIP, transform + opacity, ~200–300ms), **within the section — never a
  modal or a nav** (a modal would yank them off the stage at the climactic moment).
  Built on native **`<details>`/`<summary>`** so it **works with no JS** (static-
  first) and is accessible by default; the animation is enhancement. On open, **move
  focus to the first field**; on submit, resolve to a **warm confirmation** (the
  handshake completes, no dead form). **`prefers-reduced-motion` = instant** show.
- **Quiet rail (below the button) = LinkedIn · GitHub · X** — "or find me here."
  Covers everybody: LinkedIn (the priority audience's habitat, one tap), GitHub
  (doubles as *more proof*), X (audience #2). The rail catches the LinkedIn-
  preferrers without amplifying an already-frictionless path.
- **Anti-spam is load-bearing:** the form uses **Cloudflare Turnstile + honeypot +
  rate-limiting** (invisible, privacy-friendly, fits static-first) so the owned door
  isn't a spam funnel. **No raw `mailto:`** — the form *is* the spam-safe email.
- **Deferred / dark slots:** **Calendly is gated behind first contact** (real people
  get the link in the reply — a cold visitor hasn't earned a calendar slot, and a
  public link invites bots), reserved as a pluggable slot. The **resume is dropped on
  purpose** — a *telling* PDF (role labels, the banned headline) fights a show-don't-
  tell site; GitHub is the living CV.
- **Instagram is cut** (off-register, Linktree-cheapening) unless it ever becomes
  genuine portfolio work.

Copy: the CTA button is the **one place the direct register is allowed** (warm
imperative, e.g. "Get in touch"), still no self-superlative; finalized in the
Notion-sourced copy pass.

## Design language ("Vitrine")

The resolved visual language, decided via a throwaway prototype (2026-06-21).
Black/white is the foundation Giacomo loves; this is how it's expressed *without*
landing in the monochrome-dev-portfolio cliché — the differentiation comes from
**material, type, motion, and earned color**, not the palette itself.

### Three-temperature palette

B/W is the foundation; the system reads as three hierarchical temperatures that
never compete:
- **Cool stage** — a subtle **near-black blue** field. Reads as "black" with a
  *temperature*, not as a color; gives the project accents maximum room to pop.
- **Warm voice** — a **warm off-white / ivory** type color (not clinical white) +
  **Fraunces**'s optical warmth + warm-tinted glass highlights. This is the human,
  analog-film warmth Giacomo was drawn to.
- **Project accent** — each project's own color, *earned* (below). The only
  saturated color on screen.

Discipline: the field never drifts warm (would muddy accents); the type is never a
*saturated* warm (would compete). Cool ground, warm white, reserved accent — three
roles, not three rivals.

### Project accents (locked)

Each project carries **one** accent; **only one blooms at a time** (reactivity law).
Sourced from each project's real material where one exists, **assigned** where the
project is deliberately monochrome — assignment is honest (we don't fabricate a brand
story; we pick a distinguishing color):

- **AnyPINN** — periwinkle `#9B99F0` (the blue of its logo's wave). The showpiece
  attractor keeps its own green (`#22C55E`); the project accent is the logo's blue, not
  the attractor's green.
- **Tempo** — copper `#C06730` ("Warm Analog", from the app).
- **Scry** — mint `#5DE4C7` (from the app).
- **Orray** — white `#E7E6E5` — **sourced** from its logo's white ray. Orray's palette is
  intentionally B/W, so its accent is that white rather than an assigned color.
- **Ginevra Renier** — **terracotta / warm-rose** — **assigned**. Her site is
  deliberately high-contrast B/W; a literal color pulled from it (cream/ivory) would
  blend into our warm-white voice, so terracotta gives it a distinct bloom. Revisit if
  she adopts a brand color.

Full saturation is reserved for a project's own card/page; in the hero the accent is
restrained (the thesis stays the subject), one accent per plane over the cool
near-black field so multiple accents never go circus-y.

### Type

- **Fraunces** — display thesis (warm, optical, characterful; carries the analog
  warmth in its *forms*, regardless of color).
- **JetBrains Mono** — small labels, eyebrows, CTA (the engineering register).

### Earned color (three jobs)

Color is *earned through attention*, never ambient. A `--live-accent` is set when a
vessel is focused (hover / keyboard / touch — vessels are `<button>`s) and drives
**three** things, all restrained in the hero (full saturation reserved for project
cards/pages):
1. the **focused vessel's bloom** — it sharpens + blooms while the rest recede;
2. a restrained **field wash** toward that accent;
3. the **CTA** (neutral → that accent — the conversion-color moment). The CTA aims
   for layered depth: the accent arriving **directionally** from where the project
   sits on screen, plus a light pointer-reactive glass treatment (CSS / tiny canvas,
   **never** heavy WebGL — preserve the single-WebGL-spend rule).

### Reactivity law — "every surface answers attention; only one answers loudly"

Pervasive lightweight reactivity is a deliberate craft signature, but *governed* so
it reads as obsessive detail, not a circus:
- **One physics.** Every reaction shares a single easing/spring + timing language,
  so the page feels like *one material* answering — not stapled-together animations.
- **One lead at a time.** The element under attention reacts most; everything else
  reacts at a whisper. Never two loud reactions at once.
- **Content breathes; chrome answers.** Autonomous motion is *only* the recordings
  (the work breathing — always-on, subtle). Chrome (glass, CTA, field) never moves
  unprompted; it only *responds* to pointer / focus / scroll. Chrome that animates
  on its own is what tips into circus.
- **Cheap and respectful.** CSS/transform/opacity, pointer-driven, rAF-throttled,
  zero layout thrash; **`prefers-reduced-motion` collapses all of it to static** (an
  intentional regression, not an afterthought); coarse/touch pointers get tap/focus
  reactions, not hover. The balance to hold *simultaneously*: the 5-second hook,
  instant LCP, steady FPS, and the reduced-motion fallback.

### Glass

CSS-faked (rim light, gloss sweep, specular, inner shadow) as a **frame**, never a
lens that distorts the content. Gloss-sweep is clipped to the vessel. Real WebGL
stays reserved for the crown jewel.

## Flagged ambiguities

- "most impressive SWE ever" — resolved: a *goal for the visitor's impression*,
  achieved by proof density, **not** a literal claim. Stated hype repels the
  primary audience.
- Primary identity — resolved: lead with **Range** (supported by Platform). Do
  **not** lead with "AI engineer", "researcher", or "founder" (per dump
  guardrails). "Research & AI" is flexed as a Pillar, not the headline.
- "generalist" vs "Range" — resolved: never say "generalist"; demonstrate
  depth-at-range instead.
- **T-shaped breadth vs public proof** — Giacomo self-identifies as T-shaped with
  breadth into business, marketing, UX, and cognitive/behavioral domains. Resolved:
  the public site carries the broad bar through **proven technical range** only;
  product/business/UX sensibility shows up **implicitly** (the site's own craft, the
  love letter's empathy), never as a *stated* claim. PMP and business/founder
  framing are "do not use yet" in `WEBSITE_INFO_DUMP.md` and lack public proof —
  Show-don't-tell.
- **Human presence & first-person voice** — resolved (revised 2026-06-22): identity
  is anchored by **name + face**, and the **default voice is first-person narration**
  (it's Giacomo's own work), with product pitch and site chrome staying in their own
  voice — **no strict rule** (see Voice). Presence **escalates** — a signature-scale
  avatar + name in the hero → a full warm face + one personal line ("I'm Jack…")
  before the CTA — so the work stays the subject while the site is never faceless. The
  earlier strict curatorial / no-"I" rule was relaxed once real copy showed first
  person was warmer and truer at the ownership beats. Still rejected: a **big-portrait
  hero** (steals the subject, pays the personal-brand cliché tax). A **resume/CV
  download is dropped** — a telling PDF fights show-don't-tell; GitHub is the living CV.
- **"Backdrop subordinate / only feels alive" vs Vitrine's interactive hero** —
  resolved: the original hybrid principle held that the hero is a *quiet,
  subordinate* backdrop that *only feels* alive, with **all** interactivity reserved
  for the crown jewel. The prototype landed on **Vitrine**, where the work is the
  *setting* (more presence than "backdrop") and the chrome is **lightweight-
  reactive** (earns color on attention). Reconciled by upgrading the principle from
  *static-feels-alive vs live* to **lightweight-reactive vs genuinely-live**: cheap
  CSS reaction in the hero, expensive WebGL computation only in the crown jewel
  (scalpel intact). Clarity survives because at frame 1 the thesis still leads and
  the work is soft-focus; the reactivity is a **second-6 retention reward**, not a
  first-5-seconds device.

## Example dialogue

> **Giacomo:** "Should the hero just say I'm a senior full-stack engineer?"
> **Agent:** "That states a claim and undersells the breadth — it violates
> Show-don't-tell and shrinks Range to 'full-stack'. The hero should make the
> visitor *feel* the Range, then hand them Proof Artifacts to verify it."
