"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./catalog-prototype.module.css";

type BinderFormat = "Standard Binder" | "Toploader Binder";
type FormatOption = { format: BinderFormat; price: number };
type CatalogProduct = {
  slug: string;
  cardName?: string;
  collectorNumber?: string;
  setName?: string;
  rarity: "AR" | "SAR" | "SR" | "UR";
  designName?: string;
  formatOptions: FormatOption[];
  previewUrl: string;
};
type SortMode = "name" | "price" | "rarity";
type VariantKey = "A" | "B" | "C";

type ProductSeed = Omit<CatalogProduct, "previewUrl"> & {
  accents: [string, string, string];
};

const productSeeds: ProductSeed[] = [
  {
    slug: "charizard-199-165-ember-vault",
    cardName: "Charizard",
    collectorNumber: "199/165",
    setName: "Scarlet & Violet—151",
    rarity: "SAR",
    designName: "Ember Vault",
    formatOptions: [
      { format: "Standard Binder", price: 165000 },
      { format: "Toploader Binder", price: 210000 },
    ],
    accents: ["#fb5a2b", "#ffb21a", "#63210f"],
  },
  {
    slug: "pikachu-173-165-electric-bloom",
    cardName: "Pikachu",
    collectorNumber: "173/165",
    setName: "Scarlet & Violet—151",
    rarity: "AR",
    designName: "Electric Bloom",
    formatOptions: [
      { format: "Standard Binder", price: 95000 },
      { format: "Toploader Binder", price: 135000 },
    ],
    accents: ["#ffd437", "#53b8e7", "#192d66"],
  },
  {
    slug: "mew-205-165-cosmic-window",
    cardName: "Mew",
    collectorNumber: "205/165",
    setName: "Scarlet & Violet—151",
    rarity: "UR",
    designName: "Cosmic Window",
    formatOptions: [{ format: "Toploader Binder", price: 185000 }],
    accents: ["#ec8bd8", "#7454d9", "#151849"],
  },
  {
    slug: "bulbasaur-166-165-greenhouse",
    cardName: "Bulbasaur",
    collectorNumber: "166/165",
    setName: "Scarlet & Violet—151",
    rarity: "AR",
    designName: "Greenhouse",
    formatOptions: [{ format: "Standard Binder", price: 85000 }],
    accents: ["#79c65b", "#d8e95f", "#185642"],
  },
  {
    slug: "gengar-057-091-night-market",
    cardName: "Gengar",
    collectorNumber: "057/091",
    setName: "Paldean Fates",
    rarity: "SR",
    designName: "Night Market",
    formatOptions: [
      { format: "Standard Binder", price: 145000 },
      { format: "Toploader Binder", price: 195000 },
    ],
    accents: ["#6e4ec7", "#d55cc0", "#191333"],
  },
  {
    slug: "eevee-188-167-sunroom",
    cardName: "Eevee",
    collectorNumber: "188/167",
    setName: "Twilight Masquerade",
    rarity: "AR",
    designName: "Sunroom",
    formatOptions: [
      { format: "Standard Binder", price: 105000 },
      { format: "Toploader Binder", price: 150000 },
    ],
    accents: ["#dc9b5e", "#f5d4a2", "#6d3922"],
  },
  {
    slug: "greninja-214-167-rain-cut",
    cardName: "Greninja ex",
    collectorNumber: "214/167",
    setName: "Twilight Masquerade",
    rarity: "SAR",
    designName: "Rain Cut",
    formatOptions: [{ format: "Toploader Binder", price: 250000 }],
    accents: ["#168bc1", "#7be1ed", "#132b65"],
  },
  {
    slug: "snorlax-051-064-afternoon-off",
    cardName: "Snorlax",
    collectorNumber: "051/064",
    setName: "Shrouded Fable",
    rarity: "AR",
    designName: "Afternoon Off",
    formatOptions: [
      { format: "Standard Binder", price: 80000 },
      { format: "Toploader Binder", price: 120000 },
    ],
    accents: ["#2e7894", "#c8e39a", "#173e4b"],
  },
  {
    slug: "umbreon-215-203-moon-archive",
    cardName: "Umbreon VMAX",
    collectorNumber: "215/203",
    setName: "Evolving Skies",
    rarity: "UR",
    designName: "Moon Archive",
    formatOptions: [{ format: "Toploader Binder", price: 280000 }],
    accents: ["#253067", "#e4c95b", "#080b20"],
  },
  {
    slug: "magikarp-203-193-river-gold",
    cardName: "Magikarp",
    collectorNumber: "203/193",
    setName: "Paldea Evolved",
    rarity: "AR",
    designName: "River Gold",
    formatOptions: [
      { format: "Standard Binder", price: 125000 },
      { format: "Toploader Binder", price: 170000 },
    ],
    accents: ["#f26a2f", "#56bcd1", "#123a66"],
  },
  {
    slug: "unknown-001-celestial-drift",
    rarity: "SR",
    designName: "Celestial Drift",
    formatOptions: [{ format: "Standard Binder", price: 70000 }],
    accents: ["#365ab4", "#c770dc", "#111936"],
  },
  {
    slug: "charizard-199-165-blue-flame",
    cardName: "Charizard",
    collectorNumber: "199/165",
    rarity: "SAR",
    designName: "Blue Flame",
    formatOptions: [
      { format: "Standard Binder", price: 175000 },
      { format: "Toploader Binder", price: 220000 },
    ],
    accents: ["#1b93ce", "#fb6b32", "#082b54"],
  },
];

const variants: { key: VariantKey; name: string }[] = [
  { key: "A", name: "Gallery first" },
  { key: "B", name: "Catalog shelf" },
  { key: "C", name: "Binder index" },
];

const rarities = ["AR", "SAR", "SR", "UR"] as const;
const formats: BinderFormat[] = ["Standard Binder", "Toploader Binder"];

function makePreview(
  name: string,
  number: string,
  [primary, secondary, dark]: [string, string, string],
) {
  const safeName = name.replace(/[<>&"]/g, "");
  const safeNumber = number.replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1120" viewBox="0 0 900 1120">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset=".5" stop-color="${primary}"/><stop offset="1" stop-color="${secondary}"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="#fff" stop-opacity=".82"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3"/></pattern>
      <filter id="shadow"><feDropShadow dx="0" dy="20" stdDeviation="24" flood-opacity=".42"/></filter>
    </defs>
    <rect width="900" height="1120" rx="48" fill="url(#bg)"/>
    <rect width="900" height="1120" rx="48" fill="url(#grid)"/>
    <circle cx="730" cy="200" r="330" fill="url(#glow)"/>
    <path d="M-70 890C190 650 375 810 520 565S785 265 1000 345V1160H-70Z" fill="#fff" fill-opacity=".22"/>
    <path d="M-80 985C200 705 400 945 585 700S815 440 1000 500" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="24"/>
    <g filter="url(#shadow)" transform="translate(235 205) rotate(-5 215 325)">
      <rect width="430" height="650" rx="30" fill="#f8fbff" stroke="#fff" stroke-width="13"/>
      <rect x="24" y="24" width="382" height="602" rx="18" fill="${secondary}"/>
      <rect x="44" y="92" width="342" height="245" rx="8" fill="${dark}"/>
      <circle cx="215" cy="214" r="93" fill="${primary}"/>
      <path d="M110 254c42-118 100-150 211-96-28 3-55 26-61 55 47 6 77 35 84 76-89-52-162-17-234-35Z" fill="#fff" fill-opacity=".88"/>
      <text x="50" y="72" font-family="Arial,sans-serif" font-size="31" font-weight="700" fill="${dark}">${safeName}</text>
      <text x="50" y="380" font-family="Arial,sans-serif" font-size="21" font-weight="700" fill="${dark}">EXTENDED ART</text>
      <rect x="50" y="407" width="330" height="9" rx="4" fill="${dark}" fill-opacity=".34"/>
      <rect x="50" y="438" width="280" height="9" rx="4" fill="${dark}" fill-opacity=".25"/>
      <rect x="50" y="510" width="330" height="72" rx="36" fill="#fff" fill-opacity=".82"/>
      <text x="215" y="555" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="${dark}">${safeNumber}</text>
    </g>
    <g fill="#fff"><path d="M132 170l15 38 38 15-38 15-15 38-15-38-38-15 38-15Z"/><path d="M740 790l10 26 26 10-26 10-10 26-10-26-26-10 26-10Z"/></g>
    <text x="56" y="1050" font-family="Arial,sans-serif" font-size="26" font-weight="700" letter-spacing="7" fill="#fff">PULLPAGE CONCEPT</text>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const catalogProducts: CatalogProduct[] = productSeeds.map(
  ({ accents, ...product }) => ({
    ...product,
    previewUrl: makePreview(
      product.cardName ?? "No Name",
      product.collectorNumber ?? "Unknown number",
      accents,
    ),
  }),
);

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function displayName(product: CatalogProduct) {
  return product.cardName?.trim() || "No Name";
}

function displayNumber(product: CatalogProduct) {
  return product.collectorNumber?.trim() || "Unknown number";
}

function displaySet(product: CatalogProduct) {
  return product.setName?.trim() || "Unknown set";
}

function lowestPrice(product: CatalogProduct, format: BinderFormat | "all" = "all") {
  const options =
    format === "all"
      ? product.formatOptions
      : product.formatOptions.filter((option) => option.format === format);
  return Math.min(...options.map((option) => option.price));
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function TuneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6" />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      style={{ transform: direction === "right" ? "rotate(180deg)" : undefined }}
    >
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
    </svg>
  );
}

type FilterControlsProps = {
  query: string;
  setQuery: (value: string) => void;
  rarity: string;
  setRarity: (value: string) => void;
  binderFormat: BinderFormat | "all";
  setBinderFormat: (value: BinderFormat | "all") => void;
  maxPrice: number | "all";
  setMaxPrice: (value: number | "all") => void;
  sort: SortMode;
  setSort: (value: SortMode) => void;
  clear: () => void;
};

function SearchField({
  query,
  setQuery,
  large = false,
}: Pick<FilterControlsProps, "query" | "setQuery"> & { large?: boolean }) {
  return (
    <label className={`${styles.searchField} ${large ? styles.searchFieldLarge : ""}`}>
      <span className="sr-only">Search by Card Name or Collector Number</span>
      <SearchIcon />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name or number…"
      />
      {query ? (
        <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
          <CloseIcon />
        </button>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.selectField}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function FilterFields(props: FilterControlsProps) {
  return (
    <>
      <SelectField label="Rarity" value={props.rarity} onChange={props.setRarity}>
        <option value="all">All rarities</option>
        {rarities.map((rarity) => (
          <option key={rarity} value={rarity}>
            {rarity}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Binder format"
        value={props.binderFormat}
        onChange={(value) => props.setBinderFormat(value as BinderFormat | "all")}
      >
        <option value="all">All formats</option>
        {formats.map((format) => (
          <option key={format} value={format}>
            {format}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Maximum price"
        value={String(props.maxPrice)}
        onChange={(value) => props.setMaxPrice(value === "all" ? "all" : Number(value))}
      >
        <option value="all">Any price</option>
        <option value="100000">Up to Rp100.000</option>
        <option value="150000">Up to Rp150.000</option>
        <option value="200000">Up to Rp200.000</option>
      </SelectField>
      <SelectField
        label="Sort by"
        value={props.sort}
        onChange={(value) => props.setSort(value as SortMode)}
      >
        <option value="name">Card Name</option>
        <option value="price">Lowest price</option>
        <option value="rarity">Rarity (A–Z)</option>
      </SelectField>
    </>
  );
}

function ActiveFilterSummary({
  query,
  rarity,
  binderFormat,
  maxPrice,
}: Pick<FilterControlsProps, "query" | "rarity" | "binderFormat" | "maxPrice">) {
  const active = [
    query ? `“${query}”` : null,
    rarity !== "all" ? rarity : null,
    binderFormat !== "all" ? binderFormat : null,
    maxPrice !== "all" ? `≤ ${idr.format(maxPrice)}` : null,
  ].filter(Boolean);

  return active.length ? <>{active.join(" · ")}</> : <>All Catalog Products</>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.brand} ${compact ? styles.brandCompact : ""}`}>
      <img src="/pullpage_logo.png" alt="Pullpage — Pull The Art. Own The Page." />
    </div>
  );
}

function PriceLine({ product }: { product: CatalogProduct }) {
  const lowest = lowestPrice(product);
  const hasRange = product.formatOptions.some((option) => option.price !== lowest);
  return (
    <span className={styles.priceLine}>
      <small>{hasRange ? "From" : ""}</small> {idr.format(lowest)}
    </span>
  );
}

function RarityBadge({ rarity }: { rarity: CatalogProduct["rarity"] }) {
  return <span className={styles.rarityBadge}>{rarity}</span>;
}

function ProductCard({
  product,
  openProduct,
}: {
  product: CatalogProduct;
  openProduct: (product: CatalogProduct) => void;
}) {
  return (
    <article className={styles.productCard}>
      <button
        type="button"
        className={styles.productCardButton}
        onClick={() => openProduct(product)}
        aria-label={`View ${displayName(product)} ${displayNumber(product)}`}
      >
        <span className={styles.cardImageWrap}>
          <img src={product.previewUrl} alt={`${displayName(product)} Product Preview`} />
          <span className={styles.cardInspect}>Inspect</span>
        </span>
        <span className={styles.cardBody}>
          <span className={styles.cardTopline}>
            <RarityBadge rarity={product.rarity} />
            <span>{displayNumber(product)}</span>
          </span>
          <strong>{displayName(product)}</strong>
          <span className={styles.designName}>{product.designName || "Untitled design"}</span>
          <span className={styles.cardFooter}>
            <PriceLine product={product} />
            <span className={styles.formatDots} aria-label={product.formatOptions.map((item) => item.format).join(" and ")}>
              {product.formatOptions.map((option) => (
                <i key={option.format}>{option.format === "Standard Binder" ? "S" : "T"}</i>
              ))}
            </span>
          </span>
        </span>
      </button>
    </article>
  );
}

function EmptyState({ clear }: { clear: () => void }) {
  return (
    <div className={styles.emptyState}>
      <span>0</span>
      <h2>No Catalog Products match</h2>
      <p>Try a broader search or clear one of the filters.</p>
      <button type="button" onClick={clear}>
        Clear all filters
      </button>
    </div>
  );
}

function VariantA({
  products,
  controls,
  openProduct,
}: {
  products: CatalogProduct[];
  controls: FilterControlsProps;
  openProduct: (product: CatalogProduct) => void;
}) {
  return (
    <div className={`${styles.catalog} ${styles.variantA}`}>
      <header className={styles.galleryHeader}>
        <Brand />
        <div className={styles.headerUtility}>
          <span>Extended art for collectors</span>
          <b>{products.length} shown</b>
        </div>
      </header>

      <main>
        <section className={styles.galleryHero}>
          <p className={styles.eyebrow}>Pull the art. Own the page.</p>
          <h1>Find the piece your binder was waiting for.</h1>
          <p>Extended-art surrounds, made to turn a favorite card into a full-page moment.</p>
        </section>

        <section className={styles.toolbar} aria-label="Catalog controls">
          <SearchField query={controls.query} setQuery={controls.setQuery} />
          <div className={styles.toolbarSelects}>
            <FilterFields {...controls} />
          </div>
        </section>

        <section className={styles.galleryResults}>
          <div className={styles.resultsHeading}>
            <div>
              <p className={styles.eyebrow}>Catalog</p>
              <h2>
                <ActiveFilterSummary {...controls} />
              </h2>
            </div>
            <span>{products.length} of {catalogProducts.length} demo products</span>
          </div>
          {products.length ? (
            <div className={styles.productGrid}>
              {products.map((product) => (
                <ProductCard key={product.slug} product={product} openProduct={openProduct} />
              ))}
            </div>
          ) : (
            <EmptyState clear={controls.clear} />
          )}
        </section>
      </main>
    </div>
  );
}

function SidebarFilters({ controls }: { controls: FilterControlsProps }) {
  return (
    <div className={styles.sidebarControls}>
      <SearchField query={controls.query} setQuery={controls.setQuery} />
      <FilterFields {...controls} />
      <button type="button" className={styles.textButton} onClick={controls.clear}>
        Reset all
      </button>
    </div>
  );
}

function ProductShelfRow({
  product,
  openProduct,
  index,
}: {
  product: CatalogProduct;
  openProduct: (product: CatalogProduct) => void;
  index: number;
}) {
  return (
    <button type="button" className={styles.shelfRow} onClick={() => openProduct(product)}>
      <span className={styles.shelfIndex}>{String(index + 1).padStart(2, "0")}</span>
      <span className={styles.shelfPreview}>
        <img src={product.previewUrl} alt="" />
      </span>
      <span className={styles.shelfIdentity}>
        <span>
          <RarityBadge rarity={product.rarity} />
          {displayNumber(product)}
        </span>
        <strong>{displayName(product)}</strong>
        <small>{product.designName || "Untitled design"} · {displaySet(product)}</small>
      </span>
      <span className={styles.shelfFormats}>
        {product.formatOptions.map((option) => (
          <span key={option.format}>
            <small>{option.format.replace(" Binder", "")}</small>
            <b>{idr.format(option.price)}</b>
          </span>
        ))}
      </span>
      <span className={styles.shelfArrow}>↗</span>
    </button>
  );
}

function VariantB({
  products,
  controls,
  openProduct,
}: {
  products: CatalogProduct[];
  controls: FilterControlsProps;
  openProduct: (product: CatalogProduct) => void;
}) {
  return (
    <div className={`${styles.catalog} ${styles.variantB}`}>
      <header className={styles.shelfHeader}>
        <Brand compact />
        <div>
          <span>Catalog /</span>
          <strong>All designs</strong>
        </div>
        <p>{catalogProducts.length} demo products · IDR</p>
      </header>

      <main className={styles.shelfLayout}>
        <aside className={styles.shelfSidebar}>
          <p className={styles.eyebrow}>Refine catalog</p>
          <h1>Find your page.</h1>
          <p className={styles.sidebarIntro}>Search the collection, then narrow by the fit that matters.</p>
          <SidebarFilters controls={controls} />
        </aside>

        <section className={styles.shelfMain}>
          <div className={styles.mobileShelfControls}>
            <SearchField query={controls.query} setQuery={controls.setQuery} />
            <details>
              <summary><TuneIcon /> Filters & sort</summary>
              <SidebarFilters controls={controls} />
            </details>
          </div>
          <div className={styles.shelfTitle}>
            <div>
              <p className={styles.eyebrow}>Current selection</p>
              <h2><ActiveFilterSummary {...controls} /></h2>
            </div>
            <span>{products.length} matches</span>
          </div>
          {products.length ? (
            <div className={styles.shelfRows}>
              {products.map((product, index) => (
                <ProductShelfRow
                  key={product.slug}
                  product={product}
                  index={index}
                  openProduct={openProduct}
                />
              ))}
            </div>
          ) : (
            <EmptyState clear={controls.clear} />
          )}
        </section>
      </main>
    </div>
  );
}

function IndexTile({
  product,
  openProduct,
}: {
  product: CatalogProduct;
  openProduct: (product: CatalogProduct) => void;
}) {
  return (
    <button type="button" className={styles.indexTile} onClick={() => openProduct(product)}>
      <span className={styles.indexImage}>
        <img src={product.previewUrl} alt={`${displayName(product)} Product Preview`} />
        <i>{product.rarity}</i>
      </span>
      <strong>{displayName(product)}</strong>
      <small>{displayNumber(product)}</small>
    </button>
  );
}

function VariantC({
  products,
  controls,
  openProduct,
}: {
  products: CatalogProduct[];
  controls: FilterControlsProps;
  openProduct: (product: CatalogProduct) => void;
}) {
  const midpoint = Math.ceil(products.length / 2);
  const pages = [products.slice(0, midpoint), products.slice(midpoint)];

  return (
    <div className={`${styles.catalog} ${styles.variantC}`}>
      <header className={styles.indexHeader}>
        <Brand />
        <p>Extended-art catalog · Indonesia</p>
      </header>

      <main>
        <section className={styles.indexHero}>
          <p className={styles.eyebrow}>The visual index</p>
          <h1>What card are you pulling a page for?</h1>
          <SearchField query={controls.query} setQuery={controls.setQuery} large />
          <div className={styles.quickRarities} aria-label="Filter by rarity">
            <button
              type="button"
              className={controls.rarity === "all" ? styles.quickActive : ""}
              onClick={() => controls.setRarity("all")}
            >
              All
            </button>
            {rarities.map((rarity) => (
              <button
                type="button"
                key={rarity}
                className={controls.rarity === rarity ? styles.quickActive : ""}
                onClick={() => controls.setRarity(rarity)}
              >
                {rarity}
              </button>
            ))}
            <details className={styles.indexFilters}>
              <summary><TuneIcon /> More</summary>
              <div>
                <FilterFields {...controls} />
                <button type="button" className={styles.textButton} onClick={controls.clear}>Reset all</button>
              </div>
            </details>
          </div>
        </section>

        <section className={styles.binderSection}>
          <div className={styles.binderHeading}>
            <div>
              <span>Index 001—{String(products.length).padStart(3, "0")}</span>
              <strong><ActiveFilterSummary {...controls} /></strong>
            </div>
            <p>{products.length} matches · tap a piece to inspect</p>
          </div>

          {products.length ? (
            <div className={styles.binderSpread}>
              {pages.map((pageProducts, pageIndex) => (
                <div className={styles.binderPage} key={pageIndex}>
                  <span className={styles.pageNumber}>{String(pageIndex + 1).padStart(2, "0")}</span>
                  <div className={styles.indexGrid}>
                    {pageProducts.map((product) => (
                      <IndexTile key={product.slug} product={product} openProduct={openProduct} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState clear={controls.clear} />
          )}
        </section>
      </main>
    </div>
  );
}

function ProductModal({
  product,
  close,
}: {
  product: CatalogProduct;
  close: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const closeTimer = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setIsClosing(true);
    closeTimer.current = window.setTimeout(close, 160);
  }, [close]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, [requestClose]);

  const share = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className={`${styles.modalBackdrop} ${isClosing ? styles.modalBackdropClosing : ""}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        className={`${styles.productModal} ${isClosing ? styles.productModalClosing : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        <button ref={closeButton} type="button" className={styles.modalClose} onClick={requestClose} aria-label="Close product details">
          <CloseIcon />
        </button>
        <div className={styles.modalPreview}>
          <img src={product.previewUrl} alt={`${displayName(product)} ${product.designName || ""} Product Preview`} />
          <span>Finished presentation preview</span>
        </div>
        <div className={styles.modalDetails}>
          <div className={styles.modalKicker}>
            <RarityBadge rarity={product.rarity} />
            <span>{displayNumber(product)}</span>
          </div>
          <h2 id="product-modal-title">{displayName(product)}</h2>
          <p className={styles.modalDesign}>{product.designName || "Untitled design"}</p>

          <dl className={styles.productFacts}>
            <div><dt>Set</dt><dd>{displaySet(product)}</dd></div>
            <div><dt>Collector Number</dt><dd>{displayNumber(product)}</dd></div>
            <div><dt>Rarity</dt><dd>{product.rarity}</dd></div>
          </dl>

          <div className={styles.formatOptions}>
            <p>Available formats</p>
            {product.formatOptions.map((option) => (
              <div key={option.format}>
                <span>{option.format}</span>
                <strong>{idr.format(option.price)}</strong>
              </div>
            ))}
          </div>

          <div className={styles.modalNote}>
            <span aria-hidden="true">i</span>
            <p>Product Preview shows the finished card presentation. Card is shown for context.</p>
          </div>

          <button type="button" className={styles.shareButton} onClick={share}>
            <ShareIcon />
            {copied ? "Link copied" : "Copy link to this product"}
          </button>
        </div>
      </section>
    </div>
  );
}

function PrototypeSwitcher({
  current,
  cycle,
  stateSummary,
}: {
  current: VariantKey;
  cycle: (direction: -1 | 1) => void;
  stateSummary: string;
}) {
  const currentVariant = variants.find((variant) => variant.key === current)!;
  if (process.env.NODE_ENV === "production") return null;

  return (
    <aside className={styles.prototypeSwitcher} aria-label="Prototype variant switcher">
      <button type="button" onClick={() => cycle(-1)} aria-label="Previous prototype variant">
        <ArrowIcon direction="left" />
      </button>
      <div>
        <strong>{currentVariant.key} — {currentVariant.name}</strong>
        <span>{stateSummary}</span>
      </div>
      <button type="button" onClick={() => cycle(1)} aria-label="Next prototype variant">
        <ArrowIcon direction="right" />
      </button>
    </aside>
  );
}

export default function CatalogPrototype() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const variantParam = searchParams.get("variant")?.toUpperCase();
  const variant: VariantKey = variantParam === "A" || variantParam === "C" ? variantParam : "B";

  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const [binderFormat, setBinderFormat] = useState<BinderFormat | "all">("all");
  const [maxPrice, setMaxPrice] = useState<number | "all">("all");
  const [sort, setSort] = useState<SortMode>("name");

  const updateUrl = useCallback(
    (name: string, value?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(name, value);
      else params.delete(name);
      const queryString = params.toString();
      router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const cycleVariant = useCallback(
    (direction: -1 | 1) => {
      const currentIndex = variants.findIndex((item) => item.key === variant);
      const nextIndex = (currentIndex + direction + variants.length) % variants.length;
      updateUrl("variant", variants[nextIndex].key);
    },
    [updateUrl, variant],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") cycleVariant(-1);
      if (event.key === "ArrowRight") cycleVariant(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cycleVariant]);

  const clear = useCallback(() => {
    setQuery("");
    setRarity("all");
    setBinderFormat("all");
    setMaxPrice("all");
    setSort("name");
  }, []);

  const products = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const result = catalogProducts.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        product.cardName?.toLocaleLowerCase().includes(normalizedQuery) ||
        product.collectorNumber?.toLocaleLowerCase().includes(normalizedQuery);
      const matchesRarity = rarity === "all" || product.rarity === rarity;
      const matchesFormat =
        binderFormat === "all" ||
        product.formatOptions.some((option) => option.format === binderFormat);
      const matchesPrice =
        maxPrice === "all" || lowestPrice(product, binderFormat) <= maxPrice;
      return matchesQuery && matchesRarity && matchesFormat && matchesPrice;
    });

    return result.sort((left, right) => {
      if (sort === "price") return lowestPrice(left, binderFormat) - lowestPrice(right, binderFormat);
      if (sort === "rarity") return left.rarity.localeCompare(right.rarity) || displayName(left).localeCompare(displayName(right));
      return displayName(left).localeCompare(displayName(right)) || left.slug.localeCompare(right.slug);
    });
  }, [binderFormat, maxPrice, query, rarity, sort]);

  const selectedProduct = catalogProducts.find(
    (product) => product.slug === searchParams.get("product"),
  );
  const openProduct = useCallback(
    (product: CatalogProduct) => updateUrl("product", product.slug),
    [updateUrl],
  );
  const closeProduct = useCallback(() => updateUrl("product"), [updateUrl]);

  const controls: FilterControlsProps = {
    query,
    setQuery,
    rarity,
    setRarity,
    binderFormat,
    setBinderFormat,
    maxPrice,
    setMaxPrice,
    sort,
    setSort,
    clear,
  };

  const stateSummary = `query=${query || "∅"} · rarity=${rarity} · format=${binderFormat} · max=${maxPrice} · sort=${sort} · product=${selectedProduct?.slug || "∅"} · results=${products.length}`;

  return (
    <>
      {variant === "A" ? <VariantA products={products} controls={controls} openProduct={openProduct} /> : null}
      {variant === "B" ? <VariantB products={products} controls={controls} openProduct={openProduct} /> : null}
      {variant === "C" ? <VariantC products={products} controls={controls} openProduct={openProduct} /> : null}
      {selectedProduct ? <ProductModal product={selectedProduct} close={closeProduct} /> : null}
      <PrototypeSwitcher current={variant} cycle={cycleVariant} stateSummary={stateSummary} />
    </>
  );
}
