"use client";

import Image from "next/image";
import styles from "./catalog.module.css";

export default function CatalogError({ unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className={styles.catalog}>
      <meta name="robots" content="noindex, nofollow" />
      <header className={styles.header}>
        <Image
          src="/pullpage_logo.png"
          width={132}
          height={54}
          priority
          alt="Pullpage — Pull The Art. Own The Page."
        />
      </header>
      <main id="main-content">
        <section className={styles.intro}>
          <p className={styles.eyebrow}>Pull the art. Own the page.</p>
          <h1>The Catalog is temporarily unavailable</h1>
          <p className={styles.errorDescription}>Pullpage could not load a safe Catalog generation. Please try again shortly.</p>
          <button className={styles.errorAction} type="button" onClick={() => unstable_retry()}>Retry loading the Catalog</button>
        </section>
      </main>
    </div>
  );
}
