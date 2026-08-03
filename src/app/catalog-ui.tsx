"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicCatalogProduct } from "@/catalog/catalog";
import {
  applyCatalogView,
  UNKNOWN_RARITY_FILTER,
  type CatalogSort,
  type CatalogViewState,
} from "@/catalog/interactions";
import { displayCatalogValue } from "@/catalog/presentation";
import styles from "./catalog.module.css";
import { ProductPreview } from "./product-preview";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function CatalogShelfRow({ product }: { product: PublicCatalogProduct }) {
  const cardName = displayCatalogValue(product.cardName, "No Name");
  const collectorNumber = displayCatalogValue(product.collectorNumber, "Unknown number");
  const accessibleName = [cardName, collectorNumber, product.designName].filter(Boolean).join(" — ");

  return (
    <Link
      className={styles.productLink}
      href={`/products/${product.slug}`}
      scroll={false}
      prefetch={false}
      aria-label={accessibleName}
      data-product-slug={product.slug}
    >
      <article className={styles.product} aria-label={`${cardName} ${collectorNumber}`}>
        <ProductPreview
          url={product.previewUrl}
          alt=""
          sizes="(max-width: 440px) 92px, (max-width: 900px) 116px, 138px"
        />
        <div className={styles.identity}>
          <div className={styles.kicker}>
            <span>{displayCatalogValue(product.rarity, "Unknown rarity")}</span>
            <span>{collectorNumber}</span>
          </div>
          <h2>{cardName}</h2>
          {product.designName && <p className={styles.design}>{product.designName}</p>}
          <dl className={styles.facts}>
            <div><dt>Set</dt><dd>{displayCatalogValue(product.setName, "Unknown set")}</dd></div>
            <div><dt>Collector number</dt><dd>{collectorNumber}</dd></div>
          </dl>
        </div>
        <div className={styles.formats}>
          <p>Supported Binder Formats</p>
          {product.formatOptions.map((option) => (
            <div key={option.format} className={styles.formatOption}>
              <span>{option.format}</span>
              <strong>{idr.format(option.price)}</strong>
            </div>
          ))}
        </div>
      </article>
    </Link>
  );
}

const initialState: CatalogViewState = {
  query: "",
  rarities: [],
  formats: [],
  minimumPrice: null,
  maximumPrice: null,
  sort: "card-asc",
};

function numberOrNull(value: string) {
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function CatalogBrowser({ products }: { products: PublicCatalogProduct[] }) {
  const [state, setState] = useState(initialState);
  const visible = useMemo(() => applyCatalogView(products, state), [products, state]);
  const rarities = useMemo(() => [
    ...products
      .filter((product) => product.rarity !== null)
      .sort((left, right) => left.raritySortPosition! - right.raritySortPosition!)
      .map((product) => product.rarity!),
  ].filter((rarity, index, values) => values.indexOf(rarity) === index), [products]);
  const resultLabel = `${visible.length} ${visible.length === 1 ? "result" : "results"}`;

  if (products.length === 0) {
    return (
      <section className={styles.shelf} aria-labelledby="catalog-heading">
        <div className={styles.shelfHeading}>
          <div>
            <p className={styles.eyebrow}>Current collection</p>
            <h2 id="catalog-heading">Catalog Products</h2>
          </div>
          <p role="status" aria-live="polite" aria-atomic="true">0 results</p>
        </div>
        <div className={styles.emptyState}>
          <p className={styles.eyebrow}>A fresh page is coming</p>
          <h2>No Catalog Products are active yet</h2>
          <p>Please check back soon for new extended-art designs.</p>
        </div>
      </section>
    );
  }

  const toggleRarity = (rarity: string) => setState((current) => ({
    ...current,
    rarities: current.rarities.includes(rarity)
      ? current.rarities.filter((item) => item !== rarity)
      : [...current.rarities, rarity],
  }));
  const toggleFormat = (format: CatalogViewState["formats"][number]) => setState((current) => ({
    ...current,
    formats: current.formats.includes(format)
      ? current.formats.filter((item) => item !== format)
      : [...current.formats, format],
  }));

  return (
    <section className={styles.shelf} aria-labelledby="catalog-heading">
      <div className={styles.shelfHeading}>
        <div>
          <p className={styles.eyebrow}>Current collection</p>
          <h2 id="catalog-heading">Catalog Products</h2>
        </div>
        <p role="status" aria-live="polite" aria-atomic="true">{resultLabel}</p>
      </div>

      <div className={styles.browserGrid}>
        <aside className={styles.sidebar} aria-label="Catalog discovery controls">
          <label className={styles.searchLabel}>
            <span>Search Catalog Products</span>
            <input
              type="search"
              value={state.query}
              onChange={(event) => setState({ ...state, query: event.target.value })}
              placeholder="Name, number, set, or design"
            />
          </label>
          <details className={styles.filterDetails} open>
            <summary>Filters and sort</summary>
            <div className={styles.controlStack}>
              <fieldset>
                <legend>Rarity</legend>
                {[...rarities, UNKNOWN_RARITY_FILTER].map((rarity) => (
                  <label key={rarity}>
                    <input
                      type="checkbox"
                      checked={state.rarities.includes(rarity)}
                      onChange={() => toggleRarity(rarity)}
                    />
                    {rarity === UNKNOWN_RARITY_FILTER ? "Unknown rarity" : rarity}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Supported Binder Formats</legend>
                {(["Binder Sleeve", "Toploader"] as const).map((format) => (
                  <label key={format}>
                    <input
                      type="checkbox"
                      checked={state.formats.includes(format)}
                      onChange={() => toggleFormat(format)}
                    />
                    {format}
                  </label>
                ))}
              </fieldset>
              <fieldset className={styles.priceFields}>
                <legend>Price in IDR</legend>
                <label>Minimum<input inputMode="numeric" type="number" min="1" value={state.minimumPrice ?? ""} onChange={(event) => setState({ ...state, minimumPrice: numberOrNull(event.target.value) })} /></label>
                <label>Maximum<input inputMode="numeric" type="number" min="1" value={state.maximumPrice ?? ""} onChange={(event) => setState({ ...state, maximumPrice: numberOrNull(event.target.value) })} /></label>
              </fieldset>
              <label className={styles.sortLabel}>Sort by
                <select value={state.sort} onChange={(event) => setState({ ...state, sort: event.target.value as CatalogSort })}>
                  <option value="card-asc">Card Name: A–Z</option>
                  <option value="card-desc">Card Name: Z–A</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="rarity-asc">Rarity: low to high</option>
                  <option value="rarity-desc">Rarity: high to low</option>
                </select>
              </label>
              <button className={styles.resetButton} type="button" onClick={() => setState(initialState)}>Reset filters</button>
            </div>
          </details>
        </aside>

        <div className={styles.results}>
          {visible.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.eyebrow}>Nothing hidden, nothing removed</p>
              <h2>No Catalog Products match</h2>
              <p>Adjust your search or filters, or reset everything to return to the full shelf.</p>
              <button className={styles.resetButton} type="button" onClick={() => setState(initialState)}>Reset filters</button>
            </div>
          ) : (
            <div className={styles.rows}>{visible.map((product) => <CatalogShelfRow key={product.slug} product={product} />)}</div>
          )}
        </div>
      </div>
    </section>
  );
}
