import { connection } from "next/server";
import { Suspense } from "react";
import { getCatalog, getCatalogRarityFilterOptions } from "@/catalog/catalog";
import {
  catalogStateFromSearchParams,
  catalogStateWithAvailableRarities,
  type CatalogUrlState,
} from "@/catalog/interactions";
import { SiteHeader } from "@/components/site-header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CatalogBrowser } from "./catalog-ui";
import styles from "./catalog.module.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function toUrlSearchParams(values: Awaited<SearchParams>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  });
  return params;
}

async function CatalogShelf({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const requestedState: CatalogUrlState = catalogStateFromSearchParams(toUrlSearchParams(await searchParams));
  const [products, rarities] = await Promise.all([
    getCatalog(),
    getCatalogRarityFilterOptions(),
  ]);
  const initialState = catalogStateWithAvailableRarities(requestedState, rarities);
  return <CatalogBrowser products={products} rarities={rarities} initialState={initialState} />;
}

function CatalogShelfLoading() {
  return (
    <section className={styles.loadingShelf} aria-labelledby="catalog-loading-heading">
      <div className={styles.shelfHeading}>
        <div>
          <p className={styles.eyebrow}>Current collection</p>
          <h2 id="catalog-loading-heading">Catalog Products</h2>
        </div>
        <p role="status" aria-live="polite">Loading Catalog Products…</p>
      </div>
      <div className={styles.discoveryBar}>
        <Input type="search" disabled aria-label="Search Catalog Products" placeholder="Available when loading finishes" />
      </div>
      <div className={styles.loadingGrid} aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className={styles.loadingCard} />)}
      </div>
    </section>
  );
}

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className={styles.catalog}>
      <SiteHeader />
      <main id="main-content">
        <section className={styles.intro}>
          <p className={styles.eyebrow}>The Pullpage collection</p>
          <h1>Art that completes the page.</h1>
          <p>Discover extended-art surrounds designed to turn a favorite Pokémon card into a full-page moment.</p>
        </section>
        <Suspense fallback={<CatalogShelfLoading />}>
          <CatalogShelf searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
