import type { Metadata } from "next";
import { getCatalogProduct } from "@/catalog/catalog";
import { indexingPolicy, productCanonical, productDiscoverability, SOCIAL_FALLBACK_URL } from "@/catalog/discoverability";

export type ProductMetadataProps = { params: Promise<{ slug: string }> };

export function productSocialMetadataImage(
  previewUrl: string | null,
  socialImage: string,
  title: string,
) {
  const alt = socialImage === SOCIAL_FALLBACK_URL
    ? "Pullpage — Pull The Art. Own The Page."
    : `Pullpage Product Preview for ${title}`;
  const image = { url: socialImage, alt };

  if (socialImage === SOCIAL_FALLBACK_URL) {
    return { ...image, width: 1200, height: 630, type: "image/png" as const };
  }
  if (previewUrl && socialImage !== previewUrl) {
    return { ...image, width: 1200, height: 630, type: "image/jpeg" as const };
  }
  return image;
}

export async function generateCatalogProductMetadata({ params }: ProductMetadataProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  if (!product) {
    return {
      title: { absolute: "Pullpage" },
      alternates: { canonical: productCanonical(slug) },
      robots: {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
      },
    };
  }

  const content = productDiscoverability(product);
  const image = productSocialMetadataImage(product.previewUrl, content.socialImage, content.title);
  return {
    title: content.title,
    description: content.description,
    alternates: { canonical: content.canonical },
    robots: {
      ...indexingPolicy(),
      googleBot: {
        ...indexingPolicy(),
        "max-image-preview": "large",
      },
    },
    openGraph: {
      type: "website",
      siteName: "Pullpage",
      locale: "en_US",
      title: content.documentTitle,
      description: content.description,
      url: content.canonical,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: content.documentTitle,
      description: content.description,
      images: [{ url: content.socialImage, alt: image.alt }],
    },
  };
}
