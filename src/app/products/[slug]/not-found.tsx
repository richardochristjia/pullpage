import Link from "next/link";
import styles from "@/app/product-detail.module.css";

export default function ProductNotFound() {
  return (
    <main id="main-content" className={styles.notFound}>
      <p>Pullpage Catalog</p>
      <h1>Catalog Product not found</h1>
      <p>This product is unavailable or no longer on the active Catalog shelf.</p>
      <Link href="/">Return to the Catalog shelf</Link>
    </main>
  );
}
