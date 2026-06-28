import { Masthead } from "~/components/masthead";
import { content } from "~/content";
import styles from "./not-found.module.css";

// The global 404 (App Router not-found). It renders inside the root layout, so
// the fonts and globals.css are already in scope. It reuses the shared masthead
// chrome and the `.page` shell, then mirrors the hero composition on its own
// self-staging surface (eyebrow -> Fraunces line -> italic subline) and closes
// with one quiet pill back to the home page. Copy comes from the canonical
// content surface; nothing is invented here.

export default function NotFound() {
  const { eyebrow, title, subline, cta } = content.notFound;

  return (
    <main className="page">
      <Masthead />
      <section className={styles.stage}>
        <div aria-hidden="true" className={styles.vignette} />
        <div className={styles.copy}>
          <p className={styles.code}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subline}>{subline}</p>
          <a className={styles.home} href="/">
            <span aria-hidden="true" className={styles.homeArrow}>
              ←
            </span>
            {cta}
          </a>
        </div>
      </section>
    </main>
  );
}
