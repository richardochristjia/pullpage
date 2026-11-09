import type { PublicCatalogProduct } from "@/catalog/catalog";
import { productDiscoverability } from "@/catalog/discoverability";
import { displayCatalogValue } from "@/catalog/presentation";
import { getWhatsAppNumber } from "@/lib/whatsapp-config";
import { ProductExhibitionDossier } from "./product-exhibition-dossier";

export function productHeading(product: PublicCatalogProduct) {
  const cardName = displayCatalogValue(product.cardName, "No Name");
  return product.designName ? `${cardName} — ${product.designName}` : cardName;
}

export function ProductDetail({ product, headingId, modal = false }: {
  product: PublicCatalogProduct;
  headingId: string;
  modal?: boolean;
}) {
  const discoverability = productDiscoverability(product);
  const whatsAppNumber = getWhatsAppNumber();

  return (
    <ProductExhibitionDossier
      product={product}
      headingId={headingId}
      modal={modal}
      canonicalUrl={discoverability.canonical}
      whatsAppNumber={whatsAppNumber}
    />
  );
}
