import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCatalog, type PublicCatalogProduct } from "@/catalog/catalog";
import styles from "./catalog.module.css";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function valueOr(value: string | null, fallback: string) {
  return value?.trim() || fallback;
}

function CatalogShelfRow({ product }: { product: PublicCatalogProduct }) {
  const cardName = valueOr(product.cardName, "No Name");
  const collectorNumber = valueOr(product.collectorNumber, "Unknown number");

  return (
    <article className={styles.product} aria-label={`${cardName} ${collectorNumber}`}>
      <div className={styles.preview} aria-label="Product Preview unavailable">
        <span className={styles.placeholderMark}>P</span>
        <strong>Preview coming soon</strong>
        <small>Pullpage extended art</small>
      </div>
      <div className={styles.identity}>
        <div className={styles.kicker}>
          <span>{valueOr(product.rarity, "Unknown rarity")}</span>
          <span>{collectorNumber}</span>
        </div>
        <h2>{cardName}</h2>
        <p className={styles.design}>{valueOr(product.designName, "Untitled design")}</p>
        <dl className={styles.facts}>
          <div><dt>Set</dt><dd>{valueOr(product.setName, "Unknown set")}</dd></div>
          <div><dt>Collector number</dt><dd>{collectorNumber}</dd></div>
        </dl>
      </div>
      <div className={styles.formats}>
        <p>Available format</p>
        {product.formatOptions.map((option) => (
          <div key={option.format} className={styles.formatOption}>
            <span>{option.format}</span>
            <strong>{idr.format(option.price)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

async function CatalogShelf() {
  await connection();
  const products = await getCatalog();

  return (
    <section className={styles.shelf} aria-labelledby="catalog-heading">
      <div className={styles.shelfHeading}>
        <div>
          <p className={styles.eyebrow}>Current collection</p>
          <h2 id="catalog-heading">Catalog Products</h2>
        </div>
        <span>{products.length} {products.length === 1 ? "design" : "designs"}</span>
      </div>
      <div className={styles.rows}>
        {products.map((product) => <CatalogShelfRow key={product.slug} product={product} />)}
      </div>
    </section>
  );
}

function CatalogShelfLoading() {
  return <p role="status" aria-live="polite">Loading Catalog Products…</p>;
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
      <main>
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
