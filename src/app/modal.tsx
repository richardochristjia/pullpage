"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import styles from "./modal.module.css";

export function ProductModal({ children, slug, title }: {
  children: React.ReactNode;
  slug: string;
  title: string;
}) {
  const router = useRouter();
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const background = document.querySelector("#app-content");
    const invokingLink = document.querySelector<HTMLElement>(`[data-product-slug="${CSS.escape(slug)}"]`);
    background?.setAttribute("inert", "");
    return () => {
      background?.removeAttribute("inert");
      const fallback = document.querySelector<HTMLElement>('[role="searchbox"]');
      requestAnimationFrame(() => (invokingLink?.isConnected ? invokingLink : fallback)?.focus());
    };
  }, [slug]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) router.back(); }}>
      <DialogContent
        className={styles.dialog}
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          close.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogClose asChild>
          <Button ref={close} className={styles.close} type="button" variant="secondary" size="icon" aria-label="Close product details">
            <X aria-hidden="true" />
          </Button>
        </DialogClose>
        {children}
      </DialogContent>
    </Dialog>
  );
}
