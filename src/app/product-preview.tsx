"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { isHttpsProductPreview } from "@/catalog/product-preview";
import styles from "./catalog.module.css";
import { ProductPlaceholder } from "./product-placeholder";

type ProductPreviewProps = {
  url: string | null;
  alt: string;
  sizes: string;
};

const DELIVERY_TIMEOUT_MS = 10_000;

export function ProductPreview({ url, alt, sizes }: ProductPreviewProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const deliveryTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!url || !frame.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || deliveryTimeout.current) return;
      deliveryTimeout.current = setTimeout(() => setFailedUrl(url), DELIVERY_TIMEOUT_MS);
    }, { rootMargin: "300px" });
    observer.observe(frame.current);

    return () => {
      observer.disconnect();
      if (deliveryTimeout.current) clearTimeout(deliveryTimeout.current);
      deliveryTimeout.current = undefined;
    };
  }, [url]);

  if (!url || !isHttpsProductPreview(url) || failedUrl === url) return <ProductPlaceholder />;

  return (
    <div ref={frame} className={`${styles.preview} ${styles.previewAvailable}`} aria-busy={loadedUrl !== url}>
      <Image
        className={styles.previewImage}
        src={url}
        unoptimized
        alt={alt}
        width={600}
        height={840}
        sizes={sizes}
        loading="lazy"
        onLoad={() => {
          if (deliveryTimeout.current) clearTimeout(deliveryTimeout.current);
          deliveryTimeout.current = undefined;
          setLoadedUrl(url);
        }}
        onError={() => setFailedUrl(url)}
      />
    </div>
  );
}
