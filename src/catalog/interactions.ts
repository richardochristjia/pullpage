import type { CatalogFormatOption, PublicCatalogProduct } from "./catalog";

export const UNKNOWN_RARITY_FILTER = "__unknown_rarity__";

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
  formats: CatalogFormatOption["format"][];
  minimumPrice: number | null;
  maximumPrice: number | null;
  sort: CatalogSort;
};

function searchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[\s/-]+/g, "");
}

export function applyCatalogView(
  products: readonly PublicCatalogProduct[],
  state: CatalogViewState,
): PublicCatalogProduct[] {
  const query = searchText(state.query);

  const filtered = products.filter((product) => {
    const matchesSearch = !query ||
      [product.cardName, product.collectorNumber, product.setName, product.designName]
        .some((value) => value !== null && searchText(value).includes(query));
    const matchesRarity = state.rarities.length === 0 || state.rarities.some((rarity) =>
      rarity === UNKNOWN_RARITY_FILTER ? product.rarity === null : product.rarity === rarity,
    );
    const matchesFormat = state.formats.length === 0 || product.formatOptions.some(({ format }) =>
      state.formats.includes(format),
    );
    const eligiblePrices = product.formatOptions
      .filter(({ format }) => state.formats.length === 0 || state.formats.includes(format))
      .map(({ price }) => price);
    const matchesPrice = eligiblePrices.some((price) =>
      (state.minimumPrice === null || price >= state.minimumPrice) &&
      (state.maximumPrice === null || price <= state.maximumPrice),
    );

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
  const cardTie = (left: PublicCatalogProduct, right: PublicCatalogProduct) =>
    text(left.cardName, right.cardName) ||
    text(left.collectorNumber, right.collectorNumber) ||
    text(left.designName, right.designName) ||
    slug(left, right);
  const eligiblePrice = (product: PublicCatalogProduct) => Math.min(
    ...product.formatOptions
      .filter(({ format }) => state.formats.length === 0 || state.formats.includes(format))
      .map(({ price }) => price),
  );

  return filtered.sort((left, right) => {
    switch (state.sort) {
      case "card-asc": return cardTie(left, right);
      case "card-desc":
        return text(left.cardName, right.cardName, -1) ||
          text(left.collectorNumber, right.collectorNumber) ||
          text(left.designName, right.designName) ||
          slug(left, right);
      case "price-asc":
        return eligiblePrice(left) - eligiblePrice(right) || text(left.cardName, right.cardName) || slug(left, right);
      case "price-desc":
        return eligiblePrice(right) - eligiblePrice(left) || text(left.cardName, right.cardName) || slug(left, right);
      case "rarity-asc":
        return (left.raritySortPosition ?? Number.POSITIVE_INFINITY) -
          (right.raritySortPosition ?? Number.POSITIVE_INFINITY) || slug(left, right);
      case "rarity-desc": {
        if (left.raritySortPosition === null) return right.raritySortPosition === null ? slug(left, right) : 1;
        if (right.raritySortPosition === null) return -1;
        return right.raritySortPosition - left.raritySortPosition || slug(left, right);
      }
    }
  });
}
