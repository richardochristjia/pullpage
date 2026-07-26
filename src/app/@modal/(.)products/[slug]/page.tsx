import { Suspense } from "react";
import { getCatalogProduct } from "@/catalog/catalog";
import { ProductDetail } from "@/app/product-detail";
import { ProductModal } from "@/app/modal";
import { generateCatalogProductMetadata } from "@/catalog/product-metadata";
import { ProductNotFound } from "@/app/product-not-found";

type ProductPageProps = { params: Promise<{ slug: string }> };

export const generateMetadata = generateCatalogProductMetadata;

async function ModalContent({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  const headingId = "modal-product-heading";
  return (
    <ProductModal headingId={headingId} slug={slug}>
      {product
        ? <ProductDetail product={product} headingId={headingId} modal />
        : <ProductNotFound headingId={headingId} modal />}
    </ProductModal>
  );
}

export default function InterceptedProductPage(props: ProductPageProps) {
  return (
    <Suspense fallback={<p role="status">Loading Catalog Product…</p>}>
      <ModalContent {...props} />
    </Suspense>
  );
}
