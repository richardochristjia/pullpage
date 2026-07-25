"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./modal.module.css";

export function ProductModal({ children, headingId, slug }: {
  children: React.ReactNode;
  headingId: string;
  slug: string;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const background = document.querySelector("#app-content");
    const invokingLink = document.querySelector<HTMLElement>(`[data-product-slug="${CSS.escape(slug)}"]`);
    background?.setAttribute("inert", "");
    close.current?.focus();

    return () => {
      background?.removeAttribute("inert");
      const fallback = document.querySelector<HTMLElement>('[role="searchbox"]');
      requestAnimationFrame(() => (invokingLink?.isConnected ? invokingLink : fallback)?.focus());
    };
  }, [slug]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      router.back();
      return;
    }
    if (event.key !== "Tab" || !dialog.current) return;
    const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hasAttribute("disabled"));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialog}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={onKeyDown}
      >
        <button ref={close} className={styles.close} type="button" aria-label="Close product details" onClick={() => router.back()}>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        {children}
      </div>
    </div>
  );
}
