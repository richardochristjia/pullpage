import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { PublicCatalogProduct } from "@/catalog/catalog";
import { productDiscoverability } from "@/catalog/discoverability";
import { displayCatalogValue } from "@/catalog/presentation";
import { catalogProductRegionalPrintings } from "@/catalog/regional-printing";
import { buildWhatsAppOrderLink } from "@/lib/whatsapp";
import { getWhatsAppNumber } from "@/lib/whatsapp-config";
import { ModalBackToCatalog } from "./modal-back-to-catalog";
import { ProductPreviewLightbox } from "./product-preview-lightbox";
import { ShareProduct } from "./share-product";
import { WhatsAppOrderCta } from "./whatsapp-order-cta";
import styles from "./product-detail.module.css";
import { RarityBadge, rarityDescription } from "./rarity-badge";

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
  const regionalPrintings = catalogProductRegionalPrintings(product);
  const RegionHeading = modal ? "h3" : "h2";
  const previewAlt = `Finished Product Preview for ${productHeading(product)}`;
  const whatsAppNumber = getWhatsAppNumber();
  const whatsAppLink = whatsAppNumber
    ? buildWhatsAppOrderLink({
        product,
        canonicalUrl: discoverability.canonical,
        whatsAppNumber,
      })
    : undefined;

  return (
    <article className={`${styles.detail} ${modal ? styles.modalDetail : ""}`}>
      <ProductPreviewLightbox url={product.previewUrl} alt={previewAlt} />
      <div className={styles.content}>
        <p className={styles.eyebrow}>Catalog Product</p>
        <Heading id={headingId}>{productHeading(product)}</Heading>
        <div className={styles.identityBadges}>
          <RarityBadge rarity={product.rarity} />
        </div>
        <div className={styles.regionalFacts}>
          {regionalPrintings.length > 0
            ? regionalPrintings.map((printing) => (
              <section key={printing.code}>
                <RegionHeading>{printing.label}</RegionHeading>
                <dl>
                  {printing.collectorNumber && (
                    <div><dt>Collector Number</dt><dd>{printing.collectorNumber}</dd></div>
                  )}
                  {printing.setName && <div><dt>Set Name</dt><dd>{printing.setName}</dd></div>}
                </dl>
              </section>
            ))
            : <p>Regional printing unknown</p>}
        </div>
        <dl className={styles.facts}>
          <div><dt>Rarity</dt><dd>{product.rarity === null ? "Unknown rarity" : rarityDescription(product.rarity)}</dd></div>
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
        <ShareProduct canonical={discoverability.canonical}>
          <WhatsAppOrderCta url={whatsAppLink?.url} />
        </ShareProduct>
        {modal
          ? <ModalBackToCatalog />
          : <Link className={styles.shelfLink} href="/"><ArrowLeft aria-hidden="true" /> Back to the Catalog</Link>}
      </div>
    </article>
  );
}
