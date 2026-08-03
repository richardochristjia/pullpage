"use client";

import Image from "next/image";
import { useState } from "react";
import { isHttpsProductPreview } from "@/catalog/product-preview";
import styles from "./catalog.module.css";
import { ProductPlaceholder } from "./product-placeholder";

type ProductPreviewProps = {
  url: string | null;
  alt: string;
  sizes: string;
};

type PreviewDelivery = {
  url: string;
  status: "loaded" | "failed";
};

export function ProductPreview({ url, alt, sizes }: ProductPreviewProps) {
  const [delivery, setDelivery] = useState<PreviewDelivery | null>(null);
  const deliveryStatus = delivery?.url === url ? delivery.status : "loading";

  if (!url || !isHttpsProductPreview(url) || deliveryStatus === "failed") return <ProductPlaceholder />;

  return (
    <div className={`${styles.preview} ${styles.previewAvailable}`} aria-busy={deliveryStatus === "loading"}>
      <Image
        className={styles.previewImage}
        src={url}
        unoptimized
        alt={alt}
        fill
        sizes={sizes}
        loading="lazy"
        onLoad={() => setDelivery({ url, status: "loaded" })}
        onError={() => setDelivery((current) =>
          current?.url === url && current.status === "loaded"
            ? current
            : { url, status: "failed" }
        )}
      />
    </div>
  );
}
