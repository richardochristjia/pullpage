"use client";

import { Maximize2 } from "lucide-react";
import { isHttpsProductPreview } from "@/catalog/product-preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import styles from "./product-detail.module.css";
import { ProductPreview } from "./product-preview";

export function ProductPreviewLightbox({ url, alt }: { url: string | null; alt: string }) {
  return (
    <div className={styles.previewBlock}>
      <ProductPreview url={url} alt={alt} sizes="(max-width: 760px) calc(100vw - 32px), 520px" />
      {url && isHttpsProductPreview(url) && (
        <Dialog>
          <DialogTrigger asChild>
            <Button className={styles.fullImageButton} type="button" variant="secondary">
              <Maximize2 aria-hidden="true" /> View full image
            </Button>
          </DialogTrigger>
          <DialogContent className={styles.lightboxContent} onEscapeKeyDown={(event) => event.stopPropagation()}>
            <DialogHeader className="sr-only">
              <DialogTitle>Full Product Preview</DialogTitle>
              <DialogDescription>Complete uncropped Product Preview. Use native browser zoom gestures to inspect it.</DialogDescription>
            </DialogHeader>
            <div className={styles.lightboxImage}>
              <ProductPreview url={url} alt={alt} sizes="90vw" />
            </div>
            <p className={styles.zoomHint}>Complete image · Pinch or use browser zoom to inspect details</p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
