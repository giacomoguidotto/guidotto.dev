// The single canonical content surface for guidotto.dev.
//
// Every published string and per-project datum lives here. Copy mirrors
// `docs/copy.md` verbatim (never invented); accents are the locked values from
// `CONTEXT.md` (Design language -> Project accents). Later slices import from
// this module rather than hard-coding copy, so there is one place to change a
// word and one place to audit against Notion-sourced source material.
//
// Rules (see CONTEXT.md -> Voice and copy.md):
//   - Default voice is first-person narration; product pitch / chrome stay in
//     their own voice. No strict rule, judgment per line.
//   - No em dashes in published copy. Periods, commas, colons only.
//   - Badges stay dark until there are real KPIs (the showpiece keeps its one
//     `JOSS submitted` badge). Unsourced fields are `null`, never invented.

/** Abstract per-project media kind (stand-in art today, real recordings later). */
export type Motif = "neural" | "topology" | "mobile" | "macwindow" | "gallery";

export interface SiteContent {
  /** Meta description. */
  readonly description: string;
  /** Person job title (JSON-LD). */
  readonly jobTitle: string;
  /** BCP-47 language. */
  readonly locale: string;
  /** Person name (JSON-LD, author). */
  readonly name: string;
  /** Verified external identities for `Person.sameAs` (X omitted until sourced). */
  readonly sameAs: readonly string[];
  /** Document `<title>`. */
  readonly title: string;
  /** Canonical apex URL (owns apex-domain SEO; subdomains are per-project). */
  readonly url: string;
  /** Masthead wordmark. */
  readonly wordmark: string;
}

export interface HeroContent {
  /** Mono eyebrow. */
  readonly eyebrow: string;
  /** Mono scroll baton. */
  readonly scrollBaton: string;
  readonly subline: string;
  /** Fraunces thesis line (the LCP headline; verbatim canonical sentence). */
  readonly thesis: string;
  /**
   * The thesis as a display stanza: the sentence broken across lines, with the
   * line break standing in for the boundary periods. Visual layout of `thesis`;
   * `thesis` stays the canonical sentence for SEO and accessibility.
   */
  readonly thesisLines: readonly string[];
}

export interface Project {
  /** Full-strength locked accent (CONTEXT.md). */
  readonly accent: string;
  /** The single weighted at-rest line. */
  readonly atRestLine: string;
  readonly key: string;
  readonly label: string;
  readonly motif: Motif;
  /** The sentence(s) revealed on focus. */
  readonly onFocus: string;
  /** Primary card destination (v1 routes to the public repo). */
  readonly repoUrl: string;
  /** Mono `domain · stack` tag. */
  readonly tag: string;
}

export interface ShowpieceContent {
  readonly accent: string;
  /** The one live badge. */
  readonly badge: string;
  readonly caption: string;
  readonly eyebrow: string;
  readonly footer: string;
  readonly hud: {
    /** The settling knobs. */
    readonly parameters: string;
    /** Ticking down. */
    readonly loss: string;
  };
  /** Mono interaction micro-copy. */
  readonly interaction: string;
  readonly key: string;
  readonly label: string;
  /** Fraunces line. */
  readonly line: string;
  readonly motif: Motif;
  readonly repoUrl: string;
  /** v1: story page deferred, so the "see the story" link is hidden. */
  readonly storyHref: string | null;
}

export interface MissionContent {
  readonly body: readonly string[];
  /** Mono section label. */
  readonly label: string;
  /** Fraunces lead. */
  readonly lead: string;
}

export interface HumanContent {
  readonly personalLine: string;
  /** Script signature word (handwritten SVG pending Jack's source picture). */
  readonly signature: string;
}

export interface RailLink {
  /** `null` until a handle is sourced (never invented). */
  readonly href: string | null;
  readonly label: string;
}

export interface CtaContent {
  readonly button: string;
  readonly confirmation: string;
  readonly fields: {
    readonly name: string;
    readonly email: string;
    readonly message: string;
  };
  readonly rail: readonly RailLink[];
  readonly send: string;
}

export interface Content {
  readonly cta: CtaContent;
  readonly hero: HeroContent;
  readonly human: HumanContent;
  readonly mission: MissionContent;
  readonly projects: readonly Project[];
  readonly showpiece: ShowpieceContent;
  readonly site: SiteContent;
}

const GITHUB = "https://github.com/giacomoguidotto";
const LINKEDIN = "https://www.linkedin.com/in/giacomo-guidotto/";

export const content: Content = {
  site: {
    wordmark: "GIACOMO GUIDOTTO",
    name: "Giacomo Guidotto",
    jobTitle: "Software Engineer",
    title: "Giacomo Guidotto, Software Engineer",
    description:
      "Software engineer working across backend platforms, native apps, and ML research. Chasing ideas to make an impact, and shipping them.",
    url: "https://guidotto.dev",
    locale: "en",
    sameAs: [GITHUB, LINKEDIN],
  },

  hero: {
    eyebrow: "PLATFORM · PRODUCT · AI & RESEARCH",
    thesis:
      "A physics library. A map for tangled systems. Two productivity apps. A love letter.",
    thesisLines: [
      "A physics library",
      "A map for tangled systems",
      "Two productivity apps. A love letter",
    ],
    subline: "Chasing ideas to make an impact.",
    scrollBaton: "DIVE IN ↓",
  },

  // The four grid peers (2x2), in copy.md order. AnyPINN is the showpiece, not a
  // grid card. Accents are the locked CONTEXT.md values; Ginevra's terracotta /
  // warm-rose is assigned (CONTEXT locks the name, not a hex) and kept distinct
  // from Tempo's copper. Revisit if she adopts a brand color.
  projects: [
    {
      key: "orray",
      label: "Orray",
      atRestLine: "A new way to navigate your system.",
      tag: "Platform · Go · Kubernetes",
      onFocus:
        "Infrastructure you can finally see. A Go control plane and Kubernetes CRDs sit under a living canvas, so a cluster becomes a place you move through instead of a wall of dashboards. Still in early development.",
      accent: "#2784D5",
      repoUrl: "https://github.com/orray-proj/orray",
      motif: "topology",
    },
    {
      key: "tempo",
      label: "Tempo",
      atRestLine: "Find your rhythm during the day.",
      tag: "Product · Android · Expo",
      onFocus:
        "An open-source app that nudges you toward what matters through the day, then shows you how well you kept to it. Soon on the Play Store.",
      accent: "#C06730",
      repoUrl: "https://github.com/giacomoguidotto/tempo",
      motif: "mobile",
    },
    {
      key: "scry",
      label: "Scry",
      atRestLine: "Circle to Search for macOS.",
      tag: "Product · macOS · Swift",
      onFocus:
        "A native Swift app that talks straight to macOS: global hotkeys, screen capture, Vision OCR, a floating answer panel, and Sparkle auto-updates. Installable today.",
      accent: "#5DE4C7",
      repoUrl: "https://github.com/giacomoguidotto/scry",
      motif: "macwindow",
    },
    {
      key: "ginevra",
      label: "Ginevra Renier",
      atRestLine: "The home for my love's photography.",
      tag: "Product · Next.js · Convex",
      onFocus:
        "For her, the site becomes a canvas she can edit in real time. No friction between her and her work. My way of showing love through code.",
      accent: "#C16A56",
      repoUrl: "https://github.com/giacomoguidotto/ginevrarenier",
      motif: "gallery",
    },
  ],

  showpiece: {
    key: "anypinn",
    label: "AnyPINN",
    eyebrow: "THE CENTERPIECE",
    line: "As order rises from chaos.",
    caption:
      "AnyPINN. My machine learning library, running live in your browser. 300 real points, three little networks.",
    interaction: "drag to orbit · scrub through training",
    hud: {
      parameters: "PARAMETERS",
      loss: "LOSS",
    },
    badge: "JOSS submitted",
    footer:
      "Open-source physics-informed neural networks, grown from a funded thesis.",
    // v1: /stories/anypinn deferred -> the "see the story" link is hidden.
    storyHref: null,
    accent: "#22C55E",
    repoUrl: "https://github.com/giacomoguidotto/anypinn",
    motif: "neural",
  },

  mission: {
    label: "MISSION",
    lead: "To keep improving.",
    body: [
      "Software engineer at Danfoss since 2022, promoted from junior in two years. I kept pushing into new territory: frontend delivery, backend ownership, data pipelines, energy optimization, integration work.",
      "Now I'm building a Rust-based MQTT ingestion pipeline for datacenter cooling diagnostics, on a Kubernetes-hosted IoT platform large enough to matter for reliability.",
      "Outside work too, I chase the harder, broader problems and shape them into products that improve people's lives.",
    ],
  },

  human: {
    personalLine:
      "I'm Jack. Forever curious, always improving, never quite comfortable, and building something that matters.",
    signature: "Jack",
  },

  cta: {
    button: "Get in touch",
    fields: {
      name: "Name",
      email: "Email",
      message: "Message",
    },
    send: "Send",
    confirmation: "Got it. I'll get back to you soon.",
    rail: [
      { label: "LinkedIn", href: LINKEDIN },
      { label: "GitHub", href: GITHUB },
      // No public X handle in the source material yet -> dark until sourced.
      { label: "X", href: null },
    ],
  },
};
