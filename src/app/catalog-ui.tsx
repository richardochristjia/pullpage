"use client";

import { Grid2X2, List, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  PublicCatalogProduct,
  PublicCatalogRarityFilterOption,
} from "@/catalog/catalog";
import {
  applyCatalogView,
  CATALOG_PAGE_SIZE,
  catalogStartingPrice,
  catalogStateFromSearchParams,
  catalogStateToSearchParams,
  catalogStateWithAvailableRarities,
  INITIAL_CATALOG_STATE,
  UNKNOWN_RARITY_FILTER,
  type CatalogFormatFilter,
  type CatalogSort,
  type CatalogUrlState,
} from "@/catalog/interactions";
import { displayCatalogValue } from "@/catalog/presentation";
import { catalogProductRegionalPrintings, regionalPrintingFacts } from "@/catalog/regional-printing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./catalog.module.css";
import { PokemonRunner } from "./pokemon-runner";
import { ProductPreview } from "./product-preview";
import { RarityBadge, rarityDescription, rarityDisplayLabel } from "./rarity-badge";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const FORMAT_LABELS: Record<CatalogFormatFilter, string> = {
  any: "All Formats",
  "binder-sleeve": "Binder Sleeve",
  toploader: "Toploader",
  both: "Both formats",
};

type FilterState = Pick<CatalogUrlState, "rarities" | "format" | "minimumPrice" | "maximumPrice">;

type ProductItemProps = {
  product: PublicCatalogProduct;
  view: CatalogUrlState["view"];
  format: CatalogFormatFilter;
};

function numberOrNull(value: string) {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function FloatingRarityBadge({ rarity }: { rarity: PublicCatalogProduct["rarity"] }) {
  if (!rarity) return null;
  const code = rarity.code;
  let icon = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0l2.5 7.5L22 10l-6 5.5L17.5 24 12 19.5 6.5 24 8 15.5 2 10l7.5-2.5z" />
    </svg>
  );
  if (code === "AR") {
    icon = (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" />
      </svg>
    );
  } else if (code === "UR") {
    icon = (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.4 6.6L21 11l-5.6 4.4L17 22l-5-3.8L7 22l1.6-6.6L3 11l6.6-2.4z" />
      </svg>
    );
  }
  return (
    <span className={styles.rarityPillFloat} data-rarity={code} aria-label={rarityDescription(rarity)}>
      {icon}
      <span>{code}</span>
    </span>
  );
}

function CatalogProductItem({ product, view, format }: ProductItemProps) {
  const cardName = displayCatalogValue(product.cardName, "No Name");
  const regionalPrintings = catalogProductRegionalPrintings(product);
  const regionalIdentity = regionalPrintings.length > 0
    ? regionalPrintings.map((printing) => `${printing.label} ${regionalPrintingFacts(printing)}`)
    : ["Regional printing unknown"];
  const accessibleName = [cardName, ...regionalIdentity, product.designName].filter(Boolean).join(" — ");
  const startingPrice = catalogStartingPrice(product, format);
  const multiplePrices = (format === "any" && product.formatOptions.length > 1) || format === "both";

  const enPrinting = regionalPrintings.find((p) => p.code === "EN");
  const jpPrinting = regionalPrintings.find((p) => p.code === "JP");

  const sleeveOption = product.formatOptions.find((opt) => opt.format.toLowerCase().includes("sleeve"));
  const toploaderOption = product.formatOptions.find((opt) => opt.format.toLowerCase().includes("toploader"));

  return (
    <Link
      className={styles.productLink}
      href={`/products/${product.slug}`}
      scroll={false}
      prefetch={false}
      aria-label={accessibleName}
      data-product-slug={product.slug}
      data-view={view}
    >
      <article className={view === "grid" ? styles.curatorCard : styles.productRow}>
        <div className={styles.cardPreviewFrame}>
          <ProductPreview
            url={product.previewUrl}
            alt={`${cardName} Extended Art`}
            sizes={view === "grid"
              ? "(max-width: 520px) 44vw, (max-width: 980px) 30vw, 280px"
              : "(max-width: 640px) 84px, 112px"}
          />
          <div className={styles.cardHoloSheen} />
          <FloatingRarityBadge rarity={product.rarity} />
        </div>

        <div className={styles.cardBody}>
          <h3 className={styles.cardTitle}>{cardName}</h3>
          {product.designName ? (
            <p className={styles.cardDesign}>&ldquo;{product.designName}&rdquo; Edition</p>
          ) : null}

          {/* Equal-Width Side-by-Side EN/JP Regional Capsules */}
          {regionalPrintings.length > 0 ? (
            <div className={styles.regionalCapsules}>
              <span
                className={styles.regionalTag}
                title={enPrinting ? `English Printing: ${regionalPrintingFacts(enPrinting)}` : "No English Printing"}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span>
                  <strong>EN</strong> · {enPrinting ? regionalPrintingFacts(enPrinting) : "—"}
                </span>
              </span>
              <span
                className={styles.regionalTag}
                title={jpPrinting ? `Japanese Printing: ${regionalPrintingFacts(jpPrinting)}` : "No Japanese Printing"}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="12" r="4" fill="#dc561c" />
                </svg>
                <span>
                  <strong>JP</strong> · {jpPrinting ? regionalPrintingFacts(jpPrinting) : "—"}
                </span>
              </span>
            </div>
          ) : (
            <div className={styles.regionalCapsules}>
              <span className={styles.regionalTag}>
                <span>Regional printing unknown</span>
              </span>
              <span className={styles.regionalTag}>
                <span>—</span>
              </span>
            </div>
          )}

          {!product.rarity && (
            <span className="sr-only">Unknown rarity</span>
          )}

          {view === "grid" ? (
            <div className={styles.cardPricingBlock}>
              <div className={styles.priceMain}>
                <span className={styles.priceLabel}>
                  {multiplePrices ? "From" : FORMAT_LABELS[format] === "All Formats" ? "Price" : FORMAT_LABELS[format]}
                </span>
                <span className={styles.priceValue}>{idr.format(startingPrice)}</span>
              </div>
              <div className={styles.formatSplitIndicator}>
                {sleeveOption && (
                  <span
                    className={styles.formatIndicatorPill}
                    title={`Binder Sleeve: ${idr.format(sleeveOption.price)}`}
                    aria-label="Binder Sleeve"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                      <rect x="5" y="3" width="14" height="18" rx="2" />
                      <path d="M9 7h6" />
                      <path d="M9 11h6" />
                    </svg>
                  </span>
                )}
                {toploaderOption && (
                  <span
                    className={styles.formatIndicatorPill}
                    title={`Toploader Case: ${idr.format(toploaderOption.price)}`}
                    aria-label="Toploader Case"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                      <rect x="3" y="2" width="18" height="20" rx="2" />
                      <line x1="8" y1="2" x2="16" y2="2" strokeWidth="3" />
                      <rect x="6" y="6" width="12" height="13" rx="1" strokeDasharray="2 2" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {view === "list" ? (
          <div className={styles.rowPrices} aria-label="Format Options">
            {product.formatOptions.map((option) => (
              <div key={option.format}>
                <span>{option.format}</span>
                <strong>{idr.format(option.price)}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </article>
    </Link>
  );
}

function SlideOverFilterDrawer({
  open,
  onOpenChange,
  products,
  state,
  rarities,
  unknownRarityCount,
  apply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: PublicCatalogProduct[];
  state: CatalogUrlState;
  rarities: PublicCatalogRarityFilterOption[];
  unknownRarityCount: number;
  apply: (filters: FilterState) => void;
}) {
  const [draft, setDraft] = useState<FilterState>(state);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(state);
    }
  }
  const draftCount = useMemo(() => applyCatalogView(products, { ...state, ...draft }).length, [draft, products, state]);

  const toggleRarity = (rarity: string) => {
    setDraft((prev) => ({
      ...prev,
      rarities: prev.rarities.includes(rarity)
        ? prev.rarities.filter((item) => item !== rarity)
        : [...prev.rarities, rarity],
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={styles.filterSheet} aria-describedby="filter-catalog-description">
        <SheetHeader>
          <SheetTitle>Filter Catalog Products</SheetTitle>
          <SheetDescription id="filter-catalog-description">
            Narrow the collection by rarity, binder format, and price bounds.
          </SheetDescription>
        </SheetHeader>

        <div className={styles.sheetScroller}>
          {/* Section 1: Rarity with explicit accessible screen-reader names */}
          <fieldset className={styles.filterSection}>
            <legend className={styles.filterSectionTitle}>Rarity</legend>
            <div className={styles.rarityCheckboxGrid}>
              {rarities.map((rarity) => {
                const id = `drawer-rarity-${rarity.code.toLowerCase().replaceAll("_", "-")}`;
                const disabled = rarity.productCount === 0;
                const accessibleLabel = `${rarity.code} — ${rarity.displayName} (${rarity.productCount} ${rarity.productCount === 1 ? "product" : "products"})`;

                return (
                  <label
                    key={rarity.code}
                    htmlFor={id}
                    className={styles.rarityCheckboxLabel}
                    data-disabled={disabled}
                  >
                    <Checkbox
                      id={id}
                      checked={draft.rarities.includes(rarity.code)}
                      disabled={disabled}
                      aria-label={accessibleLabel}
                      onCheckedChange={() => toggleRarity(rarity.code)}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          data-slot="tooltip-trigger"
                          aria-label={`${rarity.code} — ${rarity.displayName}`}
                          tabIndex={0}
                        >
                          <RarityBadge rarity={rarity} decorative />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{rarity.displayName}</TooltipContent>
                    </Tooltip>
                    <span aria-hidden="true" className="text-xs text-muted-foreground">({rarity.productCount})</span>
                    <span className="sr-only">{rarity.productCount} {rarity.productCount === 1 ? "product" : "products"}</span>
                  </label>
                );
              })}

              <label
                htmlFor="drawer-rarity-unknown"
                className={styles.rarityCheckboxLabel}
                data-disabled={unknownRarityCount === 0}
              >
                <Checkbox
                  id="drawer-rarity-unknown"
                  checked={draft.rarities.includes(UNKNOWN_RARITY_FILTER)}
                  disabled={unknownRarityCount === 0}
                  aria-label={`Unknown rarity (${unknownRarityCount} ${unknownRarityCount === 1 ? "product" : "products"})`}
                  onCheckedChange={() => toggleRarity(UNKNOWN_RARITY_FILTER)}
                />
                <Badge variant="secondary">Unknown rarity</Badge>
                <span aria-hidden="true" className="text-xs text-muted-foreground">({unknownRarityCount})</span>
                <span className="sr-only">{unknownRarityCount} {unknownRarityCount === 1 ? "product" : "products"}</span>
              </label>
            </div>
          </fieldset>

          {/* Section 2: Format Filter */}
          <fieldset className={styles.filterSection}>
            <legend className={styles.filterSectionTitle}>Supported Binder Format</legend>
            <RadioGroup
              value={draft.format}
              onValueChange={(format) => setDraft((prev) => ({ ...prev, format: format as CatalogFormatFilter }))}
            >
              {(Object.entries(FORMAT_LABELS) as [CatalogFormatFilter, string][]).map(([fmt, label]) => (
                <label key={fmt} htmlFor={`drawer-format-${fmt}`} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                  <RadioGroupItem id={`drawer-format-${fmt}`} value={fmt} />
                  <span>{label}</span>
                </label>
              ))}
            </RadioGroup>
          </fieldset>

          {/* Section 3: Starting Price in IDR */}
          <fieldset className={styles.filterSection}>
            <legend className={styles.filterSectionTitle}>Starting Price in IDR</legend>
            <div className={styles.priceInputGrid}>
              <label>
                <span>Minimum</span>
                <Input
                  inputMode="numeric"
                  type="number"
                  min="1"
                  aria-label="Minimum"
                  value={draft.minimumPrice ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, minimumPrice: numberOrNull(event.target.value) }))}
                  placeholder="Rp 0"
                />
              </label>
              <label>
                <span>Maximum</span>
                <Input
                  inputMode="numeric"
                  type="number"
                  min="1"
                  aria-label="Maximum"
                  value={draft.maximumPrice ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, maximumPrice: numberOrNull(event.target.value) }))}
                  placeholder="No limit"
                />
              </label>
            </div>
          </fieldset>
        </div>

        <SheetFooter className={styles.sheetFooter}>
          <Button
            variant="outline"
            onClick={() => setDraft({
              rarities: [],
              format: "any",
              minimumPrice: null,
              maximumPrice: null,
            })}
          >
            Clear all
          </Button>
          <Button
            onClick={() => {
              apply(draft);
              onOpenChange(false);
            }}
          >
            Show {draftCount} products
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function CatalogBrowser({
  products,
  rarities,
  initialState = INITIAL_CATALOG_STATE,
}: {
  products: PublicCatalogProduct[];
  rarities: PublicCatalogRarityFilterOption[];
  initialState?: CatalogUrlState;
}) {
  const [state, setState] = useState<CatalogUrlState>(() =>
    catalogStateWithAvailableRarities(initialState, rarities),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visible = useMemo(() => applyCatalogView(products, state), [products, state]);
  const rendered = visible.slice(0, state.visibleCount);
  const unknownRarityCount = products.filter(({ rarity }) => rarity === null).length;
  const rarityLabels = new Map(rarities.map((rarity) => [rarity.code, rarityDisplayLabel(rarity)]));
  const resultLabel = `${visible.length} ${visible.length === 1 ? "result" : "results"}`;

  useEffect(() => {
    const restoreFromUrl = () => setState(catalogStateWithAvailableRarities(
      catalogStateFromSearchParams(new URLSearchParams(window.location.search)),
      rarities,
    ));
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, [rarities]);

  function commit(next: CatalogUrlState) {
    const availableState = catalogStateWithAvailableRarities(next, rarities);
    setState(availableState);
    const params = catalogStateToSearchParams(availableState);
    const query = params.size > 0 ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, "", query);
  }

  function patch(values: Partial<CatalogUrlState>, resetCount = true) {
    commit({ ...state, ...values, ...(resetCount ? { visibleCount: CATALOG_PAGE_SIZE } : {}) });
  }

  function clearDiscovery() {
    commit({ ...INITIAL_CATALOG_STATE, sort: state.sort, view: state.view });
  }

  const hasDiscovery = Boolean(
    state.query || state.rarities.length || state.format !== "any" ||
    state.minimumPrice !== null || state.maximumPrice !== null,
  );

  const activeFilterCount = state.rarities.length +
    (state.format !== "any" ? 1 : 0) +
    (state.minimumPrice !== null || state.maximumPrice !== null ? 1 : 0);

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

  return (
    <section className={styles.shelf} aria-labelledby="catalog-heading">
      <div className={styles.shelfHeading}>
        <div>
          <p className={styles.eyebrow}>Current collection</p>
          <h2 id="catalog-heading">Catalog Products</h2>
        </div>
        <p role="status" aria-live="polite" aria-atomic="true">{resultLabel}</p>
      </div>

      {/* Modernized Sticky Discovery Bar with 3D Companion Runner */}
      <div className={styles.discoveryBar}>
        <PokemonRunner />

        <div className={styles.discoveryLeft}>
          <div className={styles.searchWrap}>
            <Search aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search Catalog Products"
              value={state.query}
              onChange={(event) => patch({ query: event.target.value })}
              placeholder="Search name, set, number, or design..."
            />
            {state.query ? (
              <button
                type="button"
                className={styles.searchClearBtn}
                onClick={() => patch({ query: "" })}
                aria-label="Clear search query"
              >
                <X width={12} height={12} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {/* Instant Segmented Format Pills */}
          <div className={styles.formatPills} role="radiogroup" aria-label="Format Filter">
            <button
              type="button"
              className={`${styles.formatPill} ${state.format === "any" ? styles.formatPillActive : ""}`}
              onClick={() => patch({ format: "any" })}
            >
              All Formats
            </button>
            <button
              type="button"
              className={`${styles.formatPill} ${state.format === "binder-sleeve" ? styles.formatPillActive : ""}`}
              onClick={() => patch({ format: "binder-sleeve" })}
            >
              Binder Sleeve
            </button>
            <button
              type="button"
              className={`${styles.formatPill} ${state.format === "toploader" ? styles.formatPillActive : ""}`}
              onClick={() => patch({ format: "toploader" })}
            >
              Toploader
            </button>
          </div>
        </div>

        <div className={styles.discoveryRight}>
          {/* Slide-Over Filter Drawer Trigger */}
          <Button
            type="button"
            variant="outline"
            className={styles.filterDrawerTrigger}
            onClick={() => setDrawerOpen(true)}
            aria-label="Filters"
          >
            <SlidersHorizontal width={15} height={15} aria-hidden="true" />
            <span>Filters</span>
            {activeFilterCount > 0 ? (
              <span className={styles.activeCountBadge}>{activeFilterCount}</span>
            ) : null}
          </Button>

          {/* Sort Control */}
          <div className={styles.sortControl}>
            <span className="hidden sm:inline">Sort by</span>
            <Select value={state.sort} onValueChange={(sort) => patch({ sort: sort as CatalogSort })}>
              <SelectTrigger aria-label="Sort by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated-desc">Recently updated</SelectItem>
                <SelectItem value="card-asc">Card Name: A–Z</SelectItem>
                <SelectItem value="card-desc">Card Name: Z–A</SelectItem>
                <SelectItem value="price-asc">Price: low to high</SelectItem>
                <SelectItem value="price-desc">Price: high to low</SelectItem>
                <SelectItem value="rarity-asc">Rarity: first to last</SelectItem>
                <SelectItem value="rarity-desc">Rarity: last to first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grid / List View Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroup
                type="single"
                value={state.view}
                onValueChange={(view) => view && patch({ view: view as CatalogUrlState["view"] }, false)}
                variant="outline"
                spacing={0}
                aria-label="Catalog view"
              >
                <ToggleGroupItem value="grid" aria-label="Grid view">
                  <Grid2X2 aria-hidden="true" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view">
                  <List aria-hidden="true" />
                </ToggleGroupItem>
              </ToggleGroup>
            </TooltipTrigger>
            <TooltipContent>Change catalog view</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Unified Slide-Over Filter Drawer */}
      <SlideOverFilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        products={products}
        state={state}
        rarities={rarities}
        unknownRarityCount={unknownRarityCount}
        apply={(filters) => patch(filters)}
      />

      {/* Active Filter Chips */}
      {hasDiscovery && (
        <div className={styles.activeFilters} aria-label="Active filters">
          {state.query && (
            <FilterBadge label={`Search: ${state.query}`} remove={() => patch({ query: "" })} />
          )}
          {state.rarities.map((rarity) => (
            <FilterBadge
              key={rarity}
              label={rarity === UNKNOWN_RARITY_FILTER ? "Unknown rarity" : rarityLabels.get(rarity) ?? rarity}
              remove={() => patch({ rarities: state.rarities.filter((item) => item !== rarity) })}
            />
          ))}
          {state.format !== "any" && (
            <FilterBadge label={FORMAT_LABELS[state.format]} remove={() => patch({ format: "any" })} />
          )}
          {state.minimumPrice !== null && (
            <FilterBadge label={`Min ${idr.format(state.minimumPrice)}`} remove={() => patch({ minimumPrice: null })} />
          )}
          {state.maximumPrice !== null && (
            <FilterBadge label={`Max ${idr.format(state.maximumPrice)}`} remove={() => patch({ maximumPrice: null })} />
          )}
          <Button variant="ghost" size="sm" onClick={clearDiscovery}>
            <RotateCcw aria-hidden="true" /> Clear all
          </Button>
        </div>
      )}

      {/* Full-Width Gallery Grid */}
      <div className={styles.browserGrid}>
        <div className={styles.results}>
          {visible.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.eyebrow}>Try another combination</p>
              <h2>No Catalog Products match</h2>
              <p>Adjust your search or filters, or clear everything to return to the full collection.</p>
              <Button onClick={clearDiscovery}>
                <RotateCcw aria-hidden="true" /> Clear filters
              </Button>
            </div>
          ) : (
            <>
              <div className={styles.resultsSummary}>
                Showing {rendered.length} of {visible.length}
              </div>
              <div className={state.view === "grid" ? styles.productGrid : styles.productList}>
                {rendered.map((product) => (
                  <CatalogProductItem
                    key={product.slug}
                    product={product}
                    view={state.view}
                    format={state.format}
                  />
                ))}
              </div>
              {rendered.length < visible.length && (
                <div className={styles.loadMore}>
                  <Button
                    variant="outline"
                    size="lg"
                    aria-label="Load more Catalog Products"
                    onClick={() => patch({ visibleCount: state.visibleCount + CATALOG_PAGE_SIZE }, false)}
                  >
                    Load more <span aria-hidden="true">({visible.length - rendered.length} remaining)</span>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function FilterBadge({ label, remove }: { label: string; remove: () => void }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={styles.activeFilterBadge}
      aria-label={`Remove ${label} filter`}
      onClick={remove}
    >
      <span>{label}</span>
      <X aria-hidden="true" />
    </Button>
  );
}
