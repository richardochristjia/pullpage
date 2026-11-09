"use client";

import { ArrowLeft, Check, Maximize2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { PublicCatalogProduct } from "@/catalog/catalog";
import { displayCatalogValue } from "@/catalog/presentation";
import { catalogProductRegionalPrintings } from "@/catalog/regional-printing";
import { isHttpsProductPreview } from "@/catalog/product-preview";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProductPlaceholder } from "./product-placeholder";
import { ShareProduct } from "./share-product";
import styles from "./product-detail.module.css";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function ProductExhibitionDossier({
  product,
  headingId,
  modal = false,
  canonicalUrl,
  whatsAppNumber,
}: {
  product: PublicCatalogProduct;
  headingId: string;
  modal?: boolean;
  canonicalUrl: string;
  whatsAppNumber?: string;
}) {
  const Heading = modal ? "h2" : "h1";
  const RegionHeading = modal ? "h3" : "h2";
  const cardName = displayCatalogValue(product.cardName, "No Name");
  const cardHeading = product.designName ? `${cardName} — ${product.designName}` : cardName;
  const regionalPrintings = catalogProductRegionalPrintings(product);
  const enPrinting = regionalPrintings.find((p) => p.code === "EN");
  const jpPrinting = regionalPrintings.find((p) => p.code === "JP");

  // Format selection
  const hasSleeve = product.formatOptions.some((opt) => opt.format.toLowerCase().includes("sleeve"));
  const hasToploader = product.formatOptions.some((opt) => opt.format.toLowerCase().includes("toploader"));
  const defaultFormat = hasSleeve ? "binder-sleeve" : hasToploader ? "toploader" : product.formatOptions[0]?.format || "binder-sleeve";

  const [selectedFormat, setSelectedFormat] = useState<string>(defaultFormat);
  const [previewMode, setPreviewMode] = useState<"binder-sleeve" | "toploader">(
    defaultFormat.toLowerCase().includes("toploader") ? "toploader" : "binder-sleeve",
  );

  // Active price
  const activeOption = product.formatOptions.find((opt) => {
    if (selectedFormat === "binder-sleeve") return opt.format.toLowerCase().includes("sleeve");
    if (selectedFormat === "toploader") return opt.format.toLowerCase().includes("toploader");
    return opt.format === selectedFormat;
  }) || product.formatOptions[0];

  const activePrice = activeOption ? activeOption.price : 0;
  const activeFormatLabel = selectedFormat === "toploader" ? "Toploader" : "Binder Sleeve";

  // WhatsApp order URL
  const waMessage = [
    `Hi Pullpage, I would like to order: ${cardName}${product.designName ? ` ("${product.designName}")` : ""} in ${activeFormatLabel} format for ${idr.format(activePrice)}.`,
    canonicalUrl,
  ].join("\n");

  const waUrl = whatsAppNumber
    ? `https://wa.me/${whatsAppNumber}?text=${encodeURIComponent(waMessage)}`
    : undefined;

  function handleSelectFormat(fmtId: string) {
    setSelectedFormat(fmtId);
    if (fmtId.includes("toploader")) {
      setPreviewMode("toploader");
    } else {
      setPreviewMode("binder-sleeve");
    }
  }

  return (
    <article className={`${styles.detail} ${modal ? styles.modalDetail : ""}`}>
      {/* ============================================================ */}
      {/* LEFT: ARTWORK EXHIBITION STAGE                               */}
      {/* ============================================================ */}
      <div className={styles.modalArtStage}>
        <div className={styles.modalArtGlow} />

        <div
          className={`${styles.modalCardFrame} ${previewMode === "toploader" ? styles.toploaderCasing : ""}`}
        >
          {product.previewUrl && isHttpsProductPreview(product.previewUrl) ? (
            <img
              src={product.previewUrl}
              alt={cardName}
              className={`${styles.modalCardImg} rounded-lg`}
            />
          ) : (
            <ProductPlaceholder />
          )}

          {product.rarity && (
            <span
              className={styles.modalRarityPill}
              data-rarity={product.rarity.code}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0l2.5 7.5L22 10l-6 5.5L17.5 24 12 19.5 6.5 24 8 15.5 2 10l7.5-2.5z" />
              </svg>
              <span>{product.rarity.code}</span>
            </span>
          )}
        </div>

        {/* Visual Format Preview Toggle */}
        <div className={styles.modalPreviewToggle} role="group" aria-label="Casing Simulation Preview">
          <button
            type="button"
            className={`${styles.previewModeBtn} ${previewMode === "binder-sleeve" ? styles.previewModeBtnActive : ""}`}
            onClick={() => setPreviewMode("binder-sleeve")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <rect x="5" y="3" width="14" height="18" rx="2" />
              <path d="M9 7h6" />
            </svg>
            <span>Sleeve Fit</span>
          </button>
          <button
            type="button"
            className={`${styles.previewModeBtn} ${previewMode === "toploader" ? styles.previewModeBtnActive : ""}`}
            onClick={() => setPreviewMode("toploader")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <rect x="3" y="2" width="18" height="20" rx="2" />
              <line x1="8" y1="2" x2="16" y2="2" strokeWidth="3" />
            </svg>
            <span>Toploader Case</span>
          </button>
        </div>

        {/* Full Image Lightbox */}
        {product.previewUrl && isHttpsProductPreview(product.previewUrl) && (
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className={styles.modalZoomHint}>
                <Maximize2 width={13} height={13} aria-hidden="true" />
                <span>View full image</span>
              </button>
            </DialogTrigger>
            <DialogContent className={styles.lightboxContent} onEscapeKeyDown={(event) => event.stopPropagation()}>
              <DialogHeader className="sr-only">
                <DialogTitle>Full Product Preview</DialogTitle>
                <DialogDescription>Complete uncropped Product Preview. Use native browser zoom gestures to inspect it.</DialogDescription>
              </DialogHeader>
              <div className={styles.lightboxImage}>
                <img src={product.previewUrl} alt={cardName} className="rounded-lg max-h-[85vh] w-auto object-contain" />
              </div>
              <p className={styles.zoomHint}>Complete image · Pinch or use browser zoom to inspect details</p>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* ============================================================ */}
      {/* RIGHT: CURATOR DOSSIER                                       */}
      {/* ============================================================ */}
      <div className={styles.modalDossier}>
        <div className={styles.modalEyebrow}>Pullpage Archive · Extended Art Collection</div>
        <div className={styles.modalTitleWrap}>
          <Heading id={headingId}>{cardHeading}</Heading>
        </div>

        {/* Regional Printing Spec Tiles */}
        <div className={styles.modalRegionalGrid}>
          <div className={styles.modalRegionalTile}>
            <div className={styles.regHeader}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <RegionHeading className="font-semibold text-xs tracking-wider uppercase m-0">English Printing</RegionHeading>
            </div>
            <span className={styles.regCode}>{enPrinting?.collectorNumber ?? "—"}</span>
            <span className={styles.regSub}>{enPrinting?.setName ?? "—"}</span>
          </div>

          <div className={styles.modalRegionalTile}>
            <div className={styles.regHeader}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="4" fill="#dc561c" />
              </svg>
              <RegionHeading className="font-semibold text-xs tracking-wider uppercase m-0">Japanese Printing</RegionHeading>
            </div>
            <span className={styles.regCode}>{jpPrinting?.collectorNumber ?? "—"}</span>
            <span className={styles.regSub}>{jpPrinting?.setName ?? "—"}</span>
          </div>
        </div>

        {/* Format Selector Cards */}
        <section className={styles.modalFormatSection} aria-labelledby={`${headingId}-formats`}>
          <div className={styles.modalFormatHeader}>
            <span id={`${headingId}-formats`}>Supported Binder Formats</span>
            <small>Measured to 0.1mm tolerance</small>
          </div>
          <div className={styles.modalFormatOptions} role="radiogroup" aria-label="Format Selection">
            {product.formatOptions.map((opt) => {
              const isToploader = opt.format.toLowerCase().includes("toploader");
              const fmtKey = isToploader ? "toploader" : "binder-sleeve";
              const isSelected = selectedFormat === fmtKey;

              return (
                <button
                  key={opt.format}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`${styles.modalFormatCard} ${isSelected ? styles.modalFormatCardSelected : ""}`}
                  onClick={() => handleSelectFormat(fmtKey)}
                >
                  <div className={styles.fmtIconBox}>
                    {isToploader ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={20} height={20} aria-hidden="true">
                        <rect x="3" y="2" width="18" height="20" rx="2" />
                        <line x1="8" y1="2" x2="16" y2="2" strokeWidth="3" />
                        <rect x="6" y="6" width="12" height="13" rx="1" strokeDasharray="2 2" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width={20} height={20} aria-hidden="true">
                        <rect x="5" y="3" width="14" height="18" rx="2" />
                        <path d="M9 7h6" />
                        <path d="M9 11h6" />
                      </svg>
                    )}
                  </div>
                  <div className={styles.fmtDetails}>
                    <span className={styles.fmtTitle}>
                      {isToploader ? "Rigid Toploader Case" : "Standard Binder Sleeve"}
                    </span>
                    <span className={styles.fmtDesc}>
                      {isToploader ? "Impact & dust protection · Stand-ready display" : "9-pocket album fit · Exact card silhouette"}
                    </span>
                    <small className={styles.fmtSpec}>
                      {isToploader ? "35pt rigid encasing · Beveled acrylic frame" : "64 × 89mm · Ultra-clear polypropylene"}
                    </small>
                  </div>
                  <div className={styles.fmtPriceWrap}>
                    <span className={styles.fmtPrice}>{idr.format(opt.price)}</span>
                    <div className={styles.fmtCheck}>
                      <Check width={11} height={11} strokeWidth={3.5} aria-hidden="true" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Dynamic WhatsApp Order CTA & Share Actions */}
        <div className={styles.modalActions}>
          <ShareProduct canonical={canonicalUrl}>
            {waUrl && (
              <a
                className={styles.modalWhatsAppBtn}
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Order via WhatsApp"
              >
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.595 5.39l-.999 3.648 3.893-.737zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                <span>Order via WhatsApp · {idr.format(activePrice)}</span>
              </a>
            )}
          </ShareProduct>

          <div className={styles.modalSecondaryActions}>
            {modal ? (
              <DialogClose asChild>
                <button type="button" className={styles.modalSubBtn}>
                  <ArrowLeft width={14} height={14} aria-hidden="true" />
                  <span>Back to the Catalog</span>
                </button>
              </DialogClose>
            ) : (
              <Link className={styles.modalSubBtn} href="/">
                <ArrowLeft width={14} height={14} aria-hidden="true" />
                <span>Back to the Catalog</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
