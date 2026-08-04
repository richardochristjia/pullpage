"use client";

import { Grid2X2, List, PanelLeftClose, PanelLeftOpen, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PublicCatalogProduct, PublicCatalogRarity } from "@/catalog/catalog";
import {
  applyCatalogView,
  CATALOG_PAGE_SIZE,
  catalogFilterRarities,
  catalogStartingPrice,
  catalogStateFromSearchParams,
  catalogStateToSearchParams,
  INITIAL_CATALOG_STATE,
  UNKNOWN_RARITY_FILTER,
  type CatalogFormatFilter,
  type CatalogSort,
  type CatalogUrlState,
} from "@/catalog/interactions";
import { displayCatalogValue } from "@/catalog/presentation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./catalog.module.css";
import { ProductPreview } from "./product-preview";
import { RarityBadge, rarityDisplayLabel } from "./rarity-badge";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const FORMAT_LABELS: Record<CatalogFormatFilter, string> = {
  any: "Any format",
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

function CatalogProductItem({ product, view, format }: ProductItemProps) {
  const cardName = displayCatalogValue(product.cardName, "No Name");
  const collectorNumber = displayCatalogValue(product.collectorNumber, "Unknown number");
  const accessibleName = [cardName, collectorNumber, product.designName].filter(Boolean).join(" — ");
  const startingPrice = catalogStartingPrice(product, format);
  const multiplePrices = format === "any" && product.formatOptions.length > 1 || format === "both";

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
      <article className={view === "grid" ? styles.productCard : styles.productRow}>
        <ProductPreview
          url={product.previewUrl}
          alt=""
          sizes={view === "grid"
            ? "(max-width: 520px) 44vw, (max-width: 980px) 30vw, 280px"
            : "(max-width: 640px) 84px, 112px"}
        />
        <div className={styles.productIdentity}>
          <div className={styles.productBadges}>
            <RarityBadge rarity={product.rarity} />
            {product.formatOptions.map(({ format: optionFormat }) => (
              <Badge key={optionFormat} variant="outline">{optionFormat}</Badge>
            ))}
          </div>
          <h3>{cardName}</h3>
          {product.designName && <p className={styles.designName}>{product.designName}</p>}
          <p className={styles.cardMeta}>{collectorNumber}<span aria-hidden="true"> · </span>{displayCatalogValue(product.setName, "Unknown set")}</p>
          {view === "grid" ? (
            <div className={styles.startingPrice}>
              <span>{multiplePrices ? "From" : FORMAT_LABELS[format] === "Any format" ? "Price" : FORMAT_LABELS[format]}</span>
              <strong>{idr.format(startingPrice)}</strong>
            </div>
          ) : (
            <div className={styles.rowPrices} aria-label="Format Options">
              {product.formatOptions.map((option) => (
                <div key={option.format}><span>{option.format}</span><strong>{idr.format(option.price)}</strong></div>
              ))}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}

function FilterFields({
  value,
  rarities,
  onChange,
  idPrefix,
}: {
  value: FilterState;
  rarities: PublicCatalogRarity[];
  onChange: (next: FilterState) => void;
  idPrefix: string;
}) {
  const toggleRarity = (rarity: string) => onChange({
    ...value,
    rarities: value.rarities.includes(rarity)
      ? value.rarities.filter((item) => item !== rarity)
      : [...value.rarities, rarity],
  });

  return (
    <div className={styles.filterFields}>
      <fieldset>
        <legend>Rarity</legend>
        <div className={styles.checkboxGrid}>
          {[
            ...rarities.map((rarity) => ({ code: rarity.code, label: rarityDisplayLabel(rarity) })),
            { code: UNKNOWN_RARITY_FILTER, label: "Unknown rarity" },
          ].map(({ code, label }) => {
            const id = `${idPrefix}-rarity-${code.replaceAll("_", "-")}`;
            return (
              <label key={code} htmlFor={id}>
                <Checkbox id={id} checked={value.rarities.includes(code)} onCheckedChange={() => toggleRarity(code)} />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend>Supported Binder Format</legend>
        <RadioGroup value={value.format} onValueChange={(format) => onChange({ ...value, format: format as CatalogFormatFilter })}>
          {(Object.entries(FORMAT_LABELS) as [CatalogFormatFilter, string][]).map(([format, label]) => (
            <label key={format} htmlFor={`${idPrefix}-format-${format}`}>
              <RadioGroupItem id={`${idPrefix}-format-${format}`} value={format} />
              <span>{label}</span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>

      <fieldset>
        <legend>Starting Price in IDR</legend>
        <div className={styles.priceFields}>
          <label>
            <span>Minimum</span>
            <Input
              inputMode="numeric"
              type="number"
              min="1"
              value={value.minimumPrice ?? ""}
              onChange={(event) => onChange({ ...value, minimumPrice: numberOrNull(event.target.value) })}
              placeholder="Rp 0"
            />
          </label>
          <label>
            <span>Maximum</span>
            <Input
              inputMode="numeric"
              type="number"
              min="1"
              value={value.maximumPrice ?? ""}
              onChange={(event) => onChange({ ...value, maximumPrice: numberOrNull(event.target.value) })}
              placeholder="No limit"
            />
          </label>
        </div>
      </fieldset>
    </div>
  );
}

function MobileFilters({
  products,
  state,
  rarities,
  apply,
}: {
  products: PublicCatalogProduct[];
  state: CatalogUrlState;
  rarities: PublicCatalogRarity[];
  apply: (filters: FilterState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(state);
  const draftCount = useMemo(() => applyCatalogView(products, { ...state, ...draft }).length, [draft, products, state]);

  function setSheetOpen(next: boolean) {
    if (next) setDraft(state);
    setOpen(next);
  }

  return (
    <Sheet open={open} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className={styles.mobileFilterButton}>
          <SlidersHorizontal aria-hidden="true" /> Filters
        </Button>
      </SheetTrigger>
      <SheetContent className={styles.filterSheet} aria-describedby="mobile-filter-description">
        <SheetHeader>
          <SheetTitle>Filter Catalog Products</SheetTitle>
          <SheetDescription id="mobile-filter-description">Narrow the collection, then apply your choices.</SheetDescription>
        </SheetHeader>
        <div className={styles.sheetScroller}>
          <FilterFields value={draft} rarities={rarities} onChange={setDraft} idPrefix="mobile" />
        </div>
        <SheetFooter className={styles.sheetFooter}>
          <Button variant="ghost" onClick={() => setDraft({
            rarities: [], format: "any", minimumPrice: null, maximumPrice: null,
          })}>Clear all</Button>
          <Button onClick={() => { apply(draft); setOpen(false); }}>Show {draftCount} products</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function CatalogBrowser({
  products,
  initialState = INITIAL_CATALOG_STATE,
}: {
  products: PublicCatalogProduct[];
  initialState?: CatalogUrlState;
}) {
  const [state, setState] = useState<CatalogUrlState>(initialState);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const visible = useMemo(() => applyCatalogView(products, state), [products, state]);
  const rendered = visible.slice(0, state.visibleCount);
  const rarities = useMemo(() => catalogFilterRarities(products), [products]);
  const rarityLabels = new Map(rarities.map((rarity) => [rarity.code, rarityDisplayLabel(rarity)]));
  const resultLabel = `${visible.length} ${visible.length === 1 ? "result" : "results"}`;

  useEffect(() => {
    const restoreFromUrl = () => setState(catalogStateFromSearchParams(new URLSearchParams(window.location.search)));
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, []);

  function commit(next: CatalogUrlState) {
    setState(next);
    const params = catalogStateToSearchParams(next);
    const query = params.size > 0 ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, "", query);
  }

  function patch(values: Partial<CatalogUrlState>, resetCount = true) {
    commit({ ...state, ...values, ...(resetCount ? { visibleCount: CATALOG_PAGE_SIZE } : {}) });
  }

  function clearDiscovery() {
    commit({ ...INITIAL_CATALOG_STATE, sort: state.sort, view: state.view });
  }

  const filterState: FilterState = state;
  const hasDiscovery = Boolean(
    state.query || state.rarities.length || state.format !== "any" ||
    state.minimumPrice !== null || state.maximumPrice !== null,
  );

  if (products.length === 0) {
    return (
      <section className={styles.shelf} aria-labelledby="catalog-heading">
        <div className={styles.shelfHeading}>
          <div><p className={styles.eyebrow}>Current collection</p><h2 id="catalog-heading">Catalog Products</h2></div>
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
        <div><p className={styles.eyebrow}>Current collection</p><h2 id="catalog-heading">Catalog Products</h2></div>
        <p role="status" aria-live="polite" aria-atomic="true">{resultLabel}</p>
      </div>

      <div className={styles.discoveryBar}>
        <label className={styles.searchField}>
          <span className="sr-only">Search Catalog Products</span>
          <Search aria-hidden="true" />
          <Input
            type="search"
            value={state.query}
            onChange={(event) => patch({ query: event.target.value })}
            placeholder="Search name, number, set, or design"
          />
        </label>
        <MobileFilters
          products={products}
          state={state}
          rarities={rarities}
          apply={(filters) => patch(filters)}
        />
        <label className={styles.sortControl}>
          <span>Sort by</span>
          <Select value={state.sort} onValueChange={(sort) => patch({ sort: sort as CatalogSort })}>
            <SelectTrigger aria-label="Sort by"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="card-asc">Card Name: A–Z</SelectItem>
              <SelectItem value="card-desc">Card Name: Z–A</SelectItem>
              <SelectItem value="price-asc">Price: low to high</SelectItem>
              <SelectItem value="price-desc">Price: high to low</SelectItem>
              <SelectItem value="rarity-asc">Rarity: first to last</SelectItem>
              <SelectItem value="rarity-desc">Rarity: last to first</SelectItem>
            </SelectContent>
          </Select>
        </label>
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
              <ToggleGroupItem value="grid" aria-label="Grid view"><Grid2X2 aria-hidden="true" /></ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view"><List aria-hidden="true" /></ToggleGroupItem>
            </ToggleGroup>
          </TooltipTrigger>
          <TooltipContent>Change catalog view</TooltipContent>
        </Tooltip>
      </div>

      {hasDiscovery && (
        <div className={styles.activeFilters} aria-label="Active filters">
          {state.query && <FilterBadge label={`Search: ${state.query}`} remove={() => patch({ query: "" })} />}
          {state.rarities.map((rarity) => <FilterBadge
            key={rarity}
            label={rarity === UNKNOWN_RARITY_FILTER
              ? "Unknown rarity"
              : rarityLabels.get(rarity) ?? rarity}
            remove={() => patch({ rarities: state.rarities.filter((item) => item !== rarity) })}
          />)}
          {state.format !== "any" && <FilterBadge label={FORMAT_LABELS[state.format]} remove={() => patch({ format: "any" })} />}
          {state.minimumPrice !== null && <FilterBadge label={`Min ${idr.format(state.minimumPrice)}`} remove={() => patch({ minimumPrice: null })} />}
          {state.maximumPrice !== null && <FilterBadge label={`Max ${idr.format(state.maximumPrice)}`} remove={() => patch({ maximumPrice: null })} />}
          <Button variant="ghost" size="sm" onClick={clearDiscovery}><RotateCcw aria-hidden="true" /> Clear all</Button>
        </div>
      )}

      <div className={`${styles.browserGrid} ${filtersCollapsed ? styles.filtersCollapsed : ""}`}>
        <aside className={`${styles.sidebar} ${filtersCollapsed ? styles.sidebarCollapsed : ""}`} aria-label="Catalog filters">
          <div className={styles.sidebarHeading}>
            {!filtersCollapsed && <h3>Filters</h3>}
            <div className={styles.sidebarActions}>
              {!filtersCollapsed && hasDiscovery && <Button variant="ghost" size="sm" onClick={clearDiscovery}>Clear</Button>}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-expanded={!filtersCollapsed}
                    aria-label={filtersCollapsed ? "Expand catalog filters" : "Collapse catalog filters"}
                    onClick={() => setFiltersCollapsed((collapsed) => !collapsed)}
                  >
                    {filtersCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{filtersCollapsed ? "Expand filters" : "Collapse filters"}</TooltipContent>
              </Tooltip>
            </div>
          </div>
          {!filtersCollapsed && <FilterFields value={filterState} rarities={rarities} onChange={(filters) => patch(filters)} idPrefix="desktop" />}
        </aside>

        <div className={styles.results}>
          {visible.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.eyebrow}>Try another combination</p>
              <h2>No Catalog Products match</h2>
              <p>Adjust your search or filters, or clear everything to return to the full collection.</p>
              <Button onClick={clearDiscovery}><RotateCcw aria-hidden="true" /> Clear filters</Button>
            </div>
          ) : (
            <>
              <div className={styles.resultsSummary}>Showing {rendered.length} of {visible.length}</div>
              <div className={state.view === "grid" ? styles.productGrid : styles.productList}>
                {rendered.map((product) => <CatalogProductItem key={product.slug} product={product} view={state.view} format={state.format} />)}
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
    <Button type="button" variant="secondary" size="sm" className={styles.activeFilterBadge} aria-label={`Remove ${label} filter`} onClick={remove}>
      <span>{label}</span>
      <X aria-hidden="true" />
    </Button>
  );
}
