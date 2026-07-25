import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCatalogProduct } from "@/catalog/catalog";
import { ProductDetail } from "@/app/product-detail";
import { ProductModal } from "@/app/modal";

type ProductPageProps = { params: Promise<{ slug: string }> };

async function ModalContent({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  if (!product) notFound();
  const headingId = "modal-product-heading";
  return (
    <ProductModal headingId={headingId} slug={slug}>
      <ProductDetail product={product} headingId={headingId} modal />
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
