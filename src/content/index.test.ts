import { describe, expect, test } from "bun:test";
import { content } from "./index";

// These tests pin the content surface to the locked decisions: copy.md (verbatim
// strings, structure) and CONTEXT.md (locked accents, copy laws). They are a
// guardrail against drift and accidental invention, not a substitute for review.

const HTTPS = /^https:\/\//;
const GITHUB_REPO = /^https:\/\/github\.com\//;
const HEX6 = /^#[0-9A-Fa-f]{6}$/;

const ALL_STRINGS: string[] = collectStrings(content);

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

describe("site + SEO", () => {
  test("locked title and meta description", () => {
    expect(content.site.title).toBe("Giacomo Guidotto, Software Engineer");
    expect(content.site.description).toBe(
      "Software engineer working across backend platforms, native apps, and ML research. Chasing ideas to make an impact, and shipping them."
    );
  });

  test("wordmark and canonical url", () => {
    expect(content.site.wordmark).toBe("GIACOMO GUIDOTTO");
    expect(content.site.url).toBe("https://guidotto.dev");
  });

  test("sameAs are verified https identities", () => {
    expect(content.site.sameAs.length).toBeGreaterThan(0);
    for (const url of content.site.sameAs) {
      expect(url).toMatch(HTTPS);
    }
  });
});

describe("hero", () => {
  test("eyebrow, thesis, subline, scroll baton are present and locked", () => {
    expect(content.hero.eyebrow).toBe("PLATFORM · PRODUCT · AI & RESEARCH");
    expect(content.hero.thesis).toBe(
      "A physics library. A map for tangled systems. Two productivity apps. A love letter."
    );
    expect(content.hero.subline).toBe("Chasing ideas to make an impact.");
    expect(content.hero.scrollBaton).toBe("DIVE IN ↓");
  });

  test("thesis decomposes into a three-line display stanza", () => {
    expect(content.hero.thesisLines).toEqual([
      "A physics library",
      "A map for tangled systems",
      "Two productivity apps. A love letter",
    ]);
  });
});

describe("projects (the four grid peers)", () => {
  test("exactly four peers in locked order", () => {
    expect(content.projects.map((p) => p.key)).toEqual([
      "orray",
      "tempo",
      "scry",
      "ginevra",
    ]);
  });

  test("locked accents from CONTEXT.md", () => {
    const accents = Object.fromEntries(
      content.projects.map((p) => [p.key, p.accent])
    );
    expect(accents.orray).toBe("#2784D5");
    expect(accents.tempo).toBe("#C06730");
    expect(accents.scry).toBe("#5DE4C7");
    // Ginevra: assigned terracotta / warm-rose (CONTEXT locks the name, not a hex);
    // must be a hex distinct from Tempo's copper.
    expect(accents.ginevra).toMatch(HEX6);
    expect(accents.ginevra).not.toBe(accents.tempo);
  });

  test("every card carries a public github repo + a motif", () => {
    for (const project of content.projects) {
      expect(project.repoUrl).toMatch(GITHUB_REPO);
      expect(project.atRestLine.length).toBeGreaterThan(0);
      expect(project.tag.length).toBeGreaterThan(0);
      expect(project.onFocus.length).toBeGreaterThan(0);
      expect(project.motif).toBeDefined();
    }
  });
});

describe("showpiece (AnyPINN)", () => {
  test("locked accent, single badge, repo, deferred story", () => {
    expect(content.showpiece.accent).toBe("#22C55E");
    expect(content.showpiece.badge).toBe("JOSS submitted");
    expect(content.showpiece.repoUrl).toBe(
      "https://github.com/giacomoguidotto/anypinn"
    );
    // v1: story page deferred -> "see the story" affordance hidden.
    expect(content.showpiece.storyHref).toBeNull();
  });
});

describe("mission / human / cta", () => {
  test("mission body has three paragraphs", () => {
    expect(content.mission.body).toHaveLength(3);
  });

  test("human personal line names Jack", () => {
    expect(content.human.personalLine).toContain("I'm Jack.");
    expect(content.human.signature).toBe("Jack");
  });

  test("quiet rail keeps unsourced channels dark (never invented)", () => {
    const x = content.cta.rail.find((link) => link.label === "X");
    expect(x?.href).toBeNull();
  });
});

describe("copy laws (CONTEXT.md)", () => {
  test("no em dashes in any published string", () => {
    const offenders = ALL_STRINGS.filter((s) => s.includes("\u2014"));
    expect(offenders).toEqual([]);
  });
});
