import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCatalogProduct } from "@/catalog/catalog";
import { ProductDetail } from "@/app/product-detail";
import { generateCatalogProductMetadata } from "@/catalog/product-metadata";
import { SiteHeader } from "@/components/site-header";
import styles from "@/app/product-detail.module.css";

type ProductPageProps = { params: Promise<{ slug: string }> };

export const generateMetadata = generateCatalogProductMetadata;

async function ProductContent({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  if (!product) notFound();
  return <ProductDetail product={product} headingId="product-heading" />;
}

export default function ProductPage(props: ProductPageProps) {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main id="main-content" className={styles.pageMain}>
        <Suspense fallback={<div className={styles.loading} role="status">Loading Catalog Product…</div>}>
          <ProductContent {...props} />
        </Suspense>
      </main>
    </div>
  );
}
