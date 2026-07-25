import styles from "./catalog.module.css";

export function ProductPlaceholder() {
  return (
    <div className={styles.preview} aria-label="Product Preview unavailable">
      <span className={styles.placeholderMark}>P</span>
      <strong>Preview coming soon</strong>
      <small>Pullpage extended art</small>
    </div>
  );
}
