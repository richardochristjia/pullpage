import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCatalog } from "@/catalog/catalog";
import { CatalogBrowser } from "./catalog-ui";
import styles from "./catalog.module.css";

async function CatalogShelf() {
  await connection();
  return <CatalogBrowser products={await getCatalog()} />;
}

function CatalogShelfLoading() {
  return (
    <section className={styles.loadingShelf} aria-labelledby="catalog-loading-heading">
      <h2 id="catalog-loading-heading">Catalog Products</h2>
      <p role="status" aria-live="polite">Loading Catalog Products…</p>
      <div className={styles.browserGrid}>
        <aside className={styles.sidebar} aria-label="Catalog discovery controls loading">
          <label className={styles.searchLabel}>
            <span>Search Catalog Products</span>
            <input type="search" disabled placeholder="Available when loading finishes" />
          </label>
          <p>Filters and sort will be available with the Catalog Products.</p>
        </aside>
        <div className={styles.loadingRows} aria-hidden="true"><span /><span /><span /></div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className={styles.catalog}>
      <header className={styles.header}>
        <Image
          src="/pullpage_logo.png"
          width={132}
          height={54}
          priority
          alt="Pullpage — Pull The Art. Own The Page."
        />
        <p>Extended art for collectors · Indonesia</p>
      </header>
      <main id="main-content">
        <section className={styles.intro}>
          <p className={styles.eyebrow}>Pull the art. Own the page.</p>
          <h1>The Pullpage Catalog</h1>
          <p>Extended-art surrounds made to turn a favorite card into a full-page moment.</p>
        </section>
        <Suspense fallback={<CatalogShelfLoading />}>
          <CatalogShelf />
        </Suspense>
      </main>
    </div>
  );
}
