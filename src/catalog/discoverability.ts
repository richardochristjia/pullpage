import { isHttpsProductPreview } from "./product-preview";

export const PRODUCTION_ORIGIN = "https://pullpage.vercel.app";
export const SOCIAL_FALLBACK_URL = `${PRODUCTION_ORIGIN}/pullpage-social.png`;

const TITLE_SUFFIX = " | Pullpage";
const VERSIONED_PRODUCT_PREVIEW = /^(https:\/\/res[.]cloudinary[.]com\/[a-z0-9_-]+\/image\/upload\/)(v[1-9][0-9]*\/catalog-products\/[^?#]+[.](?:avif|gif|jpe?g|png|webp))$/;
const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

type DiscoverableCatalogProduct = {
  slug: string;
  cardName: string | null;
  collectorNumber: string | null;
  setName: string | null;
  rarity: string | null;
  designName: string | null;
  previewUrl: string | null;
  formatOptions: Array<{ format: "Binder Sleeve" | "Toploader"; price: number }>;
};

function normalizeMetadataText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateAtWord(value: string, maximum: number) {
  const normalized = normalizeMetadataText(value);
  if (normalized.length <= maximum) return normalized;
  const prefix = normalized.slice(0, maximum + 1);
  const boundary = prefix.lastIndexOf(" ");
  return prefix.slice(0, boundary > 0 ? boundary : maximum).replace(/[\s,;:.!?–—-]+$/u, "");
}

export function catalogCanonical() {
  return `${PRODUCTION_ORIGIN}/`;
}

export function productCanonical(slug: string) {
  return `${PRODUCTION_ORIGIN}/products/${slug}`;
}

export function indexingPolicy(environment = process.env.VERCEL_ENV) {
  const index = environment === "production";
  return { index, follow: index };
}

export function productSocialImage(previewUrl: string | null) {
  if (!previewUrl) return SOCIAL_FALLBACK_URL;
  const match = VERSIONED_PRODUCT_PREVIEW.exec(previewUrl);
  if (match) return `${match[1]}f_jpg,q_auto,c_pad,w_1200,h_630,b_rgb:08111f/${match[2]}`;
  return isHttpsProductPreview(previewUrl) ? previewUrl : SOCIAL_FALLBACK_URL;
}

export function productDiscoverability(product: DiscoverableCatalogProduct) {
  const cardName = product.cardName ? normalizeMetadataText(product.cardName) : "Extended Card Art";
  const designName = product.designName ? normalizeMetadataText(product.designName) : null;
  const unboundedTitle = designName ? `${cardName} — ${designName}` : cardName;
  const title = truncateAtWord(unboundedTitle, 65 - TITLE_SUFFIX.length);

  const identityFacts: string[] = [];
  if (product.collectorNumber) identityFacts.push(`Collector Number ${normalizeMetadataText(product.collectorNumber)}.`);
  if (product.setName) identityFacts.push(`Set Name ${normalizeMetadataText(product.setName)}.`);
  if (product.rarity) identityFacts.push(`Rarity ${normalizeMetadataText(product.rarity)}.`);
  const requiredFacts: string[] = [];
  const formats = product.formatOptions.map(({ format }) => format);
  if (formats.length) {
    requiredFacts.push(`Formats ${formats.join(" and ")}.`);
    const lowestPrice = Math.min(...product.formatOptions.map(({ price }) => price));
    requiredFacts.push(`Lowest price ${normalizeMetadataText(idr.format(lowestPrice))}.`);
  }
  const facts = ["Pullpage extended card art."];
  for (const fact of identityFacts) {
    if ([...facts, fact, ...requiredFacts].join(" ").length <= 160) facts.push(fact);
  }
  const description = [...facts, ...requiredFacts].join(" ");

  return {
    canonical: productCanonical(product.slug),
    title,
    documentTitle: `${title}${TITLE_SUFFIX}`,
    description,
    socialImage: productSocialImage(product.previewUrl),
  };
}
