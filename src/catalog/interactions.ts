import type { PublicCatalogProduct } from "./catalog";

export const UNKNOWN_RARITY_FILTER = "__unknown_rarity__";
export const CATALOG_PAGE_SIZE = 24;

export type CatalogFormatFilter = "any" | "binder-sleeve" | "toploader" | "both";

export type CatalogSort =
  | "card-asc"
  | "card-desc"
  | "price-asc"
  | "price-desc"
  | "rarity-asc"
  | "rarity-desc";

export type CatalogViewState = {
  query: string;
  rarities: string[];
  format: CatalogFormatFilter;
  minimumPrice: number | null;
  maximumPrice: number | null;
  sort: CatalogSort;
};

export type CatalogUrlState = CatalogViewState & {
  view: "grid" | "list";
  visibleCount: number;
};

export const INITIAL_CATALOG_STATE: CatalogUrlState = {
  query: "",
  rarities: [],
  format: "any",
  minimumPrice: null,
  maximumPrice: null,
  sort: "card-asc",
  view: "grid",
  visibleCount: CATALOG_PAGE_SIZE,
};

const FORMATS: CatalogFormatFilter[] = ["any", "binder-sleeve", "toploader", "both"];
const SORTS: CatalogSort[] = ["card-asc", "card-desc", "price-asc", "price-desc", "rarity-asc", "rarity-desc"];

function positiveNumber(value: string | null) {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function catalogStateFromSearchParams(searchParams: URLSearchParams): CatalogUrlState {
  const format = searchParams.get("format");
  const sort = searchParams.get("sort");
  const visibleCount = positiveNumber(searchParams.get("show"));

  return {
    query: searchParams.get("q") ?? INITIAL_CATALOG_STATE.query,
    rarities: [...new Set(searchParams.getAll("rarity").filter(Boolean))],
    format: FORMATS.includes(format as CatalogFormatFilter) ? format as CatalogFormatFilter : INITIAL_CATALOG_STATE.format,
    minimumPrice: positiveNumber(searchParams.get("min")),
    maximumPrice: positiveNumber(searchParams.get("max")),
    sort: SORTS.includes(sort as CatalogSort) ? sort as CatalogSort : INITIAL_CATALOG_STATE.sort,
    view: searchParams.get("view") === "list" ? "list" : INITIAL_CATALOG_STATE.view,
    visibleCount: visibleCount !== null && visibleCount >= CATALOG_PAGE_SIZE
      ? Math.floor(visibleCount / CATALOG_PAGE_SIZE) * CATALOG_PAGE_SIZE
      : CATALOG_PAGE_SIZE,
  };
}

export function catalogStateWithAvailableRarities<T extends CatalogViewState>(
  state: T,
  availableRarities: readonly { code: string }[],
): T {
  const availableCodes = new Set(availableRarities.map(({ code }) => code));
  return {
    ...state,
    rarities: state.rarities.filter((rarity) =>
      rarity === UNKNOWN_RARITY_FILTER || availableCodes.has(rarity),
    ),
  };
}

export function catalogStateToSearchParams(state: CatalogUrlState) {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  state.rarities.forEach((rarity) => params.append("rarity", rarity));
  if (state.format !== INITIAL_CATALOG_STATE.format) params.set("format", state.format);
  if (state.minimumPrice !== null) params.set("min", String(state.minimumPrice));
  if (state.maximumPrice !== null) params.set("max", String(state.maximumPrice));
  if (state.sort !== INITIAL_CATALOG_STATE.sort) params.set("sort", state.sort);
  if (state.view !== INITIAL_CATALOG_STATE.view) params.set("view", state.view);
  if (state.visibleCount > CATALOG_PAGE_SIZE) params.set("show", String(state.visibleCount));
  return params;
}

function searchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[\s/-]+/g, "");
}

function matchesFormatFilter(product: PublicCatalogProduct, format: CatalogFormatFilter) {
  if (format === "any") return true;
  if (format === "both") return product.formatOptions.length === 2;
  const expected = format === "binder-sleeve" ? "Binder Sleeve" : "Toploader";
  return product.formatOptions.some((option) => option.format === expected);
}

function relevantFormatOptions(product: PublicCatalogProduct, format: CatalogFormatFilter) {
  if (format === "binder-sleeve") {
    return product.formatOptions.filter((option) => option.format === "Binder Sleeve");
  }
  if (format === "toploader") {
    return product.formatOptions.filter((option) => option.format === "Toploader");
  }
  return product.formatOptions;
}

export function catalogStartingPrice(product: PublicCatalogProduct, format: CatalogFormatFilter) {
  return Math.min(...relevantFormatOptions(product, format).map(({ price }) => price));
}

export function applyCatalogView(
  products: readonly PublicCatalogProduct[],
  state: CatalogViewState,
): PublicCatalogProduct[] {
  const query = searchText(state.query);

  const filtered = products.filter((product) => {
    const matchesSearch = !query ||
      [
        product.cardName,
        product.englishCollectorNumber,
        product.japaneseCollectorNumber,
        product.englishSetName,
        product.japaneseSetName,
        product.designName,
      ].some((value) => value !== null && searchText(value).includes(query));
    const matchesRarity = state.rarities.length === 0 || state.rarities.some((rarity) =>
      rarity === UNKNOWN_RARITY_FILTER ? product.rarity === null : product.rarity?.code === rarity,
    );
    const matchesFormat = matchesFormatFilter(product, state.format);
    const startingPrice = matchesFormat ? catalogStartingPrice(product, state.format) : Number.POSITIVE_INFINITY;
    const matchesPrice =
      (state.minimumPrice === null || startingPrice >= state.minimumPrice) &&
      (state.maximumPrice === null || startingPrice <= state.maximumPrice);

    return matchesSearch && matchesRarity && matchesFormat && matchesPrice;
  });

  const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
  const text = (left: string | null, right: string | null, direction = 1) => {
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return collator.compare(left, right) * direction;
  };
  const slug = (left: PublicCatalogProduct, right: PublicCatalogProduct) =>
    collator.compare(left.slug, right.slug);
  const printingTie = (left: PublicCatalogProduct, right: PublicCatalogProduct) =>
    text(left.englishCollectorNumber, right.englishCollectorNumber) ||
    text(left.japaneseCollectorNumber, right.japaneseCollectorNumber);
  const cardTie = (left: PublicCatalogProduct, right: PublicCatalogProduct) =>
    text(left.cardName, right.cardName) ||
    printingTie(left, right) ||
    text(left.designName, right.designName) ||
    slug(left, right);
  const eligiblePrice = (product: PublicCatalogProduct) => catalogStartingPrice(product, state.format);

  return filtered.sort((left, right) => {
    switch (state.sort) {
      case "card-asc": return cardTie(left, right);
      case "card-desc":
        return text(left.cardName, right.cardName, -1) ||
          printingTie(left, right) ||
          text(left.designName, right.designName) ||
          slug(left, right);
      case "price-asc":
        return eligiblePrice(left) - eligiblePrice(right) || text(left.cardName, right.cardName) || slug(left, right);
      case "price-desc":
        return eligiblePrice(right) - eligiblePrice(left) || text(left.cardName, right.cardName) || slug(left, right);
      case "rarity-asc":
        return (left.rarity?.displayOrder ?? Number.POSITIVE_INFINITY) -
          (right.rarity?.displayOrder ?? Number.POSITIVE_INFINITY) || slug(left, right);
      case "rarity-desc": {
        if (left.rarity === null) return right.rarity === null ? slug(left, right) : 1;
        if (right.rarity === null) return -1;
        return right.rarity.displayOrder - left.rarity.displayOrder || slug(left, right);
      }
    }
  });
}
