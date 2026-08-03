"use client";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import styles from "./catalog.module.css";

export default function CatalogError({ unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className={styles.catalog}>
      <meta name="robots" content="noindex, nofollow" />
      <SiteHeader />
      <main id="main-content">
        <section className={styles.intro}>
          <p className={styles.eyebrow}>Pull the art. Own the page.</p>
          <h1>The Catalog is temporarily unavailable</h1>
          <p className={styles.errorDescription}>Pullpage could not load the Catalog Products. Please try again shortly.</p>
          <Button className={styles.errorAction} type="button" onClick={() => unstable_retry()}>Retry loading the Catalog</Button>
        </section>
      </main>
    </div>
  );
}
