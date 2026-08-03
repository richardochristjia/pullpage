"use client";

import { ArrowLeft } from "lucide-react";
import { DialogClose } from "@/components/ui/dialog";
import styles from "./product-detail.module.css";

export function ModalBackToCatalog() {
  return (
    <DialogClose asChild>
      <button className={`${styles.shelfLink} ${styles.modalShelfButton}`} type="button">
        <ArrowLeft aria-hidden="true" /> Back to the Catalog
      </button>
    </DialogClose>
  );
}
