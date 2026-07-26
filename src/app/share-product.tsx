"use client";

import { useRef, useState } from "react";
import styles from "./product-detail.module.css";

export function ShareProduct({ canonical, title }: { canonical: string; title: string }) {
  const [message, setMessage] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const recovery = useRef<HTMLInputElement>(null);

  async function share() {
    setMessage("");
    setShowRecovery(false);

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
      setShowRecovery(true);
      setMessage("Clipboard access failed. Copy the canonical link manually below.");
      requestAnimationFrame(() => {
        recovery.current?.focus();
        recovery.current?.select();
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
      {showRecovery && (
        <label className={styles.shareRecovery}>
          <span>Copy the canonical link manually:</span>
          <input ref={recovery} aria-label="Canonical product link" readOnly value={canonical} onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
    </div>
  );
}
