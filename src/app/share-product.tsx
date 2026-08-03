"use client";

import { useRef, useState } from "react";
import styles from "./product-detail.module.css";

export function ShareProduct({ canonical, title }: { canonical: string; title: string }) {
  const [message, setMessage] = useState("");
  const [showFallback, setShowFallback] = useState(false);
  const fallback = useRef<HTMLInputElement>(null);

  async function share() {
    setMessage("");
    setShowFallback(false);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url: canonical });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(canonical);
      setMessage("Canonical product link copied.");
    } catch {
      setShowFallback(true);
      setMessage("Clipboard access failed. Copy the canonical link manually below.");
      requestAnimationFrame(() => {
        fallback.current?.focus();
        fallback.current?.select();
      });
    }
  }

  return (
    <div className={styles.share}>
      <button type="button" onClick={share}>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
        </svg>
        Share Catalog Product
      </button>
      <p className={styles.shareStatus} role="status" aria-live="polite" aria-atomic="true">{message}</p>
      {showFallback && (
        <label className={styles.shareFallback}>
          <span>Copy the canonical link manually:</span>
          <input ref={fallback} aria-label="Canonical product link" readOnly value={canonical} onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
    </div>
  );
}
