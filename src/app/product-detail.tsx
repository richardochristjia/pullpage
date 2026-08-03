import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { PublicCatalogProduct } from "@/catalog/catalog";
import { productDiscoverability } from "@/catalog/discoverability";
import { displayCatalogValue } from "@/catalog/presentation";
import { Badge } from "@/components/ui/badge";
import { ProductPreviewLightbox } from "./product-preview-lightbox";
import { ShareProduct } from "./share-product";
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
  const discoverability = productDiscoverability(product);
  const previewAlt = `Finished Product Preview for ${productHeading(product)}`;

  return (
    <article className={styles.detail}>
      <ProductPreviewLightbox url={product.previewUrl} alt={previewAlt} />
      <div className={styles.content}>
        <p className={styles.eyebrow}>Catalog Product</p>
        <Heading id={headingId}>{productHeading(product)}</Heading>
        <div className={styles.identityBadges}>
          <Badge variant="secondary">{displayCatalogValue(product.rarity, "Unknown rarity")}</Badge>
          <Badge variant="outline">{displayCatalogValue(product.collectorNumber, "Unknown number")}</Badge>
        </div>
        <dl className={styles.facts}>
          <div><dt>Set Name</dt><dd>{displayCatalogValue(product.setName, "Unknown set")}</dd></div>
          <div><dt>Collector Number</dt><dd>{displayCatalogValue(product.collectorNumber, "Unknown number")}</dd></div>
          <div><dt>Rarity</dt><dd>{displayCatalogValue(product.rarity, "Unknown rarity")}</dd></div>
          {product.designName && <div><dt>Design Name</dt><dd>{product.designName}</dd></div>}
        </dl>
        <section className={styles.options} aria-labelledby={`${headingId}-formats`}>
          <h2 id={`${headingId}-formats`}>Supported Binder Formats</h2>
          <div className={styles.optionGrid}>
            {product.formatOptions.map((option) => (
              <div key={option.format}><span>{option.format}</span><strong>{idr.format(option.price)}</strong></div>
            ))}
          </div>
        </section>
        <ShareProduct canonical={discoverability.canonical} title={discoverability.documentTitle} />
        <Link className={styles.shelfLink} href="/"><ArrowLeft aria-hidden="true" /> Back to the Catalog</Link>
      </div>
    </article>
  );
}
