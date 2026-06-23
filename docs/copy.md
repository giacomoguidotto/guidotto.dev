# guidotto.dev — copy

The canonical home-page copy strings. Phase 1 wires components against this file.

Rules (see `CONTEXT.md` → Voice):

- Default voice is **first-person narration** (it's Giacomo's own work). Product
  pitch and site chrome stay in their own voice. No strict rule, judgment per line.
- **No em dashes** in published copy. Periods, commas, colons only.
- Badges stay **dark** until there are real KPIs (the showpiece keeps its one
  `JOSS submitted` badge). All copy is Notion-sourced, never invented.

Status: all sections **locked** (2026-06-22). Pending asset: Jack's signature picture.

## Links (v1) — decided 2026-06-22

- **Project cards** route to each project's **GitHub repo** on the primary click
  (all four, uniformly). The `<slug>.guidotto.dev` product-portal routing returns
  post-v1. All four repos are **public** (confirmed 2026-06-22).
- **Story pages (`/stories/[slug]`) are deferred** — none ship at v1. Every
  "see the story" affordance is therefore dropped or repointed at v1 (see §3).

---

## 0 · Masthead + SEO

- **Wordmark:** `GIACOMO GUIDOTTO`
- **`<title>`:** `Giacomo Guidotto, Software Engineer`
- **Meta description:** Software engineer working across backend platforms, native apps, and ML research. Chasing ideas to make an impact, and shipping them.

## 1 · Hero

- **Eyebrow (mono):** `PLATFORM · PRODUCT · AI & RESEARCH`
- **Thesis (Fraunces):** A physics library. A map for tangled systems. Two productivity apps. A love letter.
- **Subline:** Chasing ideas to make an impact.
- **Scroll baton (mono):** `DIVE IN ↓`

## 2 · Proof grid

Section label (mono): `SELECTED WORK`. Four peers, 2x2. No badges.

### Orray
- **At rest:** A new way to navigate your system.
- **Tag:** `Platform · Go · Kubernetes`
- **On focus:** Infrastructure you can finally see. A Go control plane and Kubernetes CRDs sit under a living canvas, so a cluster becomes a place you move through instead of a wall of dashboards. Still in early development.

### Tempo
- **At rest:** Find your rhythm during the day.
- **Tag:** `Product · Android · Expo`
- **On focus:** An open-source app that nudges you toward what matters through the day, then shows you how well you kept to it. Soon on the Play Store.

### Scry
- **At rest:** Circle to Search for macOS.
- **Tag:** `Product · macOS · Swift`
- **On focus:** A native Swift app that talks straight to macOS: global hotkeys, screen capture, Vision OCR, a floating answer panel, and Sparkle auto-updates. Installable today.

### Ginevra Renier
- **At rest:** The home for my love's photography.
- **Tag:** `Product · Next.js · Convex`
- **On focus:** For her, the site becomes a canvas she can edit in real time. No friction between her and her work. My way of showing love through code.

## 3 · Showpiece finale (AnyPINN · Lorenz)

- **Eyebrow (mono):** `THE CENTERPIECE`
- **Line (Fraunces):** As order rises from chaos.
- **Caption:** AnyPINN. My machine learning library, running live in your browser. 300 real points, three little networks.
- **Interaction micro-copy (mono):** `drag to orbit · scrub through training`
- **HUD (mono):** `PARAMETERS` (the settling knobs), `LOSS` (ticking down), epoch as a clean progress bar (no counter label).
- **Badge:** `JOSS submitted`
- **Footer:** Open-source physics-informed neural networks, grown from a funded thesis.
  - **v1:** story page deferred, so the **"→ see the story" affordance is hidden** at launch. The footer ships as the sentence alone. Restore the link when `/stories/anypinn` lands.

---

## 4 · Mission

- **Section label (mono):** `MISSION`
- **Lead (Fraunces):** To keep improving.
- **Body:**

  Software engineer at Danfoss since 2022, promoted from junior in two years. I kept pushing into new territory: frontend delivery, backend ownership, data pipelines, energy optimization, integration work.

  Now I'm building a Rust-based MQTT ingestion pipeline for datacenter cooling diagnostics, on a Kubernetes-hosted IoT platform large enough to matter for reliability.

  Outside work too, I chase the harder, broader problems and shape them into products that improve people's lives.

- **Close:** none.

## 5 · Human anchor

- **Personal line:** I'm Jack. Forever curious, always improving, never quite comfortable, and building something that matters.
- **Signature (script):** Jack. Handwritten SVG, animated to draw on (stroke-dashoffset) when it scrolls into view. `prefers-reduced-motion` shows the finished signature. Jack will provide a high-res picture of his signature to trace to SVG.

## 6 · CTA

- **Button:** `Get in touch`
- **Form fields:** Name, Email, Message
- **Send button:** `Send`
- **Confirmation:** Got it. I'll get back to you soon.
- **Quiet rail:** `LinkedIn` · `GitHub` · `X` (icons only, no label)
