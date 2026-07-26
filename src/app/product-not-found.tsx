import Link from "next/link";
import styles from "@/app/product-detail.module.css";

function NotFoundContent({ headingId }: { headingId?: string }) {
  return (
    <>
      <p>Pullpage Catalog</p>
      <h1 id={headingId}>Catalog Product not found</h1>
      <p>This product is not on the active Catalog shelf.</p>
      <Link href="/">Return to the Catalog shelf</Link>
    </>
  );
}

export function ProductNotFound({ headingId, modal = false }: {
  headingId?: string;
  modal?: boolean;
}) {
  if (modal) {
    return (
      <>
        <meta name="robots" content="noindex, nofollow" />
        <section className={styles.notFound}>
          <NotFoundContent headingId={headingId} />
        </section>
      </>
    );
  }
  return (
    <main id="main-content" className={styles.notFound}>
      <NotFoundContent />
    </main>
  );
}
