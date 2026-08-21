"use client";

import { Copy } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./product-detail.module.css";

export function ShareProduct({ canonical, children }: {
  canonical: string;
  children?: React.ReactNode;
}) {
  const [showFallback, setShowFallback] = useState(false);
  const fallback = useRef<HTMLInputElement>(null);

  async function copy() {
    setShowFallback(false);
    try {
      await navigator.clipboard.writeText(canonical);
      toast.success("Product link copied");
    } catch {
      setShowFallback(true);
      toast.error("Clipboard access failed. Copy the link manually.");
      requestAnimationFrame(() => {
        fallback.current?.focus();
        fallback.current?.select();
      });
    }
  }

  return (
    <div className={styles.share}>
      <div className={styles.shareActions}>
        {children}
        <Button type="button" variant="outline" onClick={copy}>
          <Copy aria-hidden="true" /> Copy link
        </Button>
      </div>
      {showFallback && (
        <label className={styles.shareFallback}>
          <span>Copy the canonical link manually</span>
          <Input
            ref={fallback}
            aria-label="Canonical product link"
            readOnly
            value={canonical}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
    </div>
  );
}
