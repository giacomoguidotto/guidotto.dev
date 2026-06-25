"use client";

// ProofGrid — the four peer proof cards (Orray, Tempo, Scry, Ginevra), rendered
// straight from the canonical content surface. This is the plain standalone
// section; the scroll-morph that delivers these cards out of the hero contact
// sheet is a later slice and is deliberately not built here.
//
// ProofGrid is the single-active-card coordinator that enforces the reactivity
// law ("only one card loud at a time"). The loud state is keyed off one
// `activeKey`, never off each card's own :hover / :focus-visible, so two cards
// can never both answer loudly. Each card still uses useAccent() for the field
// bloom, which therefore follows the one active card too.
//
// Two layouts share that one coordinator:
//   - Desktop (fine pointer / wider viewport): a 2x2 grid. Hover and keyboard
//     focus set the active card.
//   - Mobile (<= 40rem): a vertical, center-focused scroll-snap carousel. The
//     card nearest the scroller's vertical center is the active one; an
//     IntersectionObserver watching a thin centre band sets it as the user
//     swipes, and scroll-snap settles to it. Hover never activates here (it is
//     gated off in the card), which is what kills the old
//     scroll-triggers-hover-for-a-second glitch on touch.
//
// Deep module: <ProofGrid /> is the entire interface; the cards, the glass, the
// media seam, the accent wiring, the carousel observer, and the touch/tap logic
// are all hidden inside.

import { useCallback, useEffect, useRef, useState } from "react";
import { content } from "~/content";
import { ProofCard } from "./proof-card";
import styles from "./proof-grid.module.css";

// The carousel layout and its observer-driven activation turn on at the same
// width the CSS switches to a single column, so JS behaviour and layout agree.
const MOBILE_QUERY = "(max-width: 40rem)";

export function ProofGrid() {
  // The single loud card: the only thing each card reads to decide "am I loud".
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Whether we are in the mobile carousel layout (drives which input sources may
  // set the active card, and whether blur is allowed to clear it).
  const [carousel, setCarousel] = useState(false);
  // Same flag for use inside stable callbacks without re-creating them.
  const carouselRef = useRef(false);
  // Which card holds keyboard focus (focus-visible only), so a desktop pointer
  // pass-over that ends restores it instead of stranding it dark.
  const focusedKeyRef = useRef<string | null>(null);
  // The scroll container (the carousel viewport / IntersectionObserver root).
  const scrollRef = useRef<HTMLUListElement>(null);

  // Track the mobile/desktop switch.
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const apply = () => {
      carouselRef.current = mql.matches;
      setCarousel(mql.matches);
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  // Mobile carousel: the card whose centre sits inside a thin band at the
  // scroller's vertical centre is the one loud card. Active is never cleared to
  // null here, so exactly one card stays loud between snaps. Disconnected (and
  // re-built) whenever we leave / enter the carousel layout.
  useEffect(() => {
    if (!carousel) {
      return;
    }
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>("[data-key]")
    );
    if (cards.length === 0) {
      return;
    }
    // Open focused on the first peer so the carousel never starts dark.
    setActiveKey((prev) => prev ?? cards[0].dataset.key ?? null);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const key = (entry.target as HTMLElement).dataset.key;
            if (key) {
              setActiveKey(key);
            }
          }
        }
      },
      // Shrink the root to a ~10% band at the vertical centre: a card lands in it
      // only when it is the centred one.
      { root: container, rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    for (const card of cards) {
      observer.observe(card);
    }
    return () => observer.disconnect();
  }, [carousel]);

  // Desktop hover / first-tap activation (not keyboard focus, so it leaves the
  // focused-card ref alone).
  const activate = useCallback((key: string) => {
    setActiveKey(key);
  }, []);

  // Keyboard (focus-visible) focus: remember it and make it loud.
  const focus = useCallback((key: string) => {
    focusedKeyRef.current = key;
    setActiveKey(key);
  }, []);

  // Blur clears the loud card on desktop; in the carousel the observer owns the
  // active card, so a blur must not blank it.
  const blur = useCallback((key: string) => {
    if (carouselRef.current) {
      return;
    }
    if (focusedKeyRef.current === key) {
      focusedKeyRef.current = null;
    }
    setActiveKey((prev) => (prev === key ? null : prev));
  }, []);

  // Ending a desktop hover restores the keyboard-focused card (or nothing); in
  // the carousel the observer keeps the centred card loud.
  const pointerLeave = useCallback((key: string) => {
    if (carouselRef.current) {
      return;
    }
    setActiveKey((prev) => (prev === key ? focusedKeyRef.current : prev));
  }, []);

  return (
    <section className={styles.section}>
      <h2 className={styles.label}>{content.work.label}</h2>
      <ul className={styles.grid} ref={scrollRef}>
        {content.projects.map((project) => (
          <li className={styles.item} data-key={project.key} key={project.key}>
            <ProofCard
              carousel={carousel}
              isActive={activeKey === project.key}
              onActivate={activate}
              onBlur={blur}
              onFocus={focus}
              onPointerLeave={pointerLeave}
              project={project}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
