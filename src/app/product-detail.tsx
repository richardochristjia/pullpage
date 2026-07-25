import Link from "next/link";
import type { PublicCatalogProduct } from "@/catalog/catalog";
import { displayCatalogValue } from "@/catalog/presentation";
import { ProductPlaceholder } from "./product-placeholder";
import styles from "./product-detail.module.css";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function productHeading(product: PublicCatalogProduct) {
  const cardName = displayCatalogValue(product.cardName, "No Name");
  return product.designName ? `${cardName} — ${product.designName}` : cardName;
}

export function ProductDetail({ product, headingId, modal = false }: {
  product: PublicCatalogProduct;
  headingId: string;
  modal?: boolean;
}) {
  const Heading = modal ? "h2" : "h1";
  return (
    <article className={styles.detail}>
      <ProductPlaceholder />
      <div className={styles.content}>
        <p className={styles.eyebrow}>Catalog Product</p>
        <Heading id={headingId}>{productHeading(product)}</Heading>
        <p className={styles.identity}>
          {displayCatalogValue(product.collectorNumber, "Unknown number")} · {displayCatalogValue(product.rarity, "Unknown rarity")}
        </p>
        <dl className={styles.facts}>
          <div><dt>Set Name</dt><dd>{displayCatalogValue(product.setName, "Unknown set")}</dd></div>
          <div><dt>Collector Number</dt><dd>{displayCatalogValue(product.collectorNumber, "Unknown number")}</dd></div>
          <div><dt>Rarity</dt><dd>{displayCatalogValue(product.rarity, "Unknown rarity")}</dd></div>
          {product.designName && <div><dt>Design Name</dt><dd>{product.designName}</dd></div>}
        </dl>
        <section className={styles.options} aria-labelledby={`${headingId}-formats`}>
          <h2 id={`${headingId}-formats`}>Supported Binder Formats</h2>
          {product.formatOptions.map((option) => (
            <div key={option.format}><span>{option.format}</span><strong>{idr.format(option.price)}</strong></div>
          ))}
        </section>
        <Link className={styles.shelfLink} href="/">Back to the Catalog shelf</Link>
      </div>
    </article>
  );
}
