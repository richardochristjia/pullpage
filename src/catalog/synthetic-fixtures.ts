export type SyntheticCatalogProduct = {
  id: string;
  cardName: string | null;
  collectorNumber: string | null;
  setName: string | null;
  rarity: string | null;
  designName: string | null;
  binderSleevePrice: number | null;
  toploaderPrice: number | null;
  productPreviewUrl: string | null;
  isActive: boolean;
};

const rarities = ["C", "U", "R", "RR", "AR", "SR", "SAR", "UR"] as const;
const previewUrl = "https://res.cloudinary.com/pullpage-synthetic/image/upload/v1/catalog-products/synthetic-preview.webp";
const fixtureDesign = "Synthetic Browser Fixture";

function syntheticUuid(index: number) {
  return `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

export function buildSyntheticCatalogFixtures() {
  const pikachu: SyntheticCatalogProduct = {
    id: "11111111-1111-4111-8111-111111111111",
    cardName: "Pikachu",
    collectorNumber: "173/165",
    setName: "Scarlet & Violet—151",
    rarity: "AR",
    designName: "Electric Bloom",
    binderSleevePrice: 95_000,
    toploaderPrice: null,
    productPreviewUrl: null,
    isActive: true,
  };
  const shelf: SyntheticCatalogProduct[] = Array.from({ length: 499 }, (_, offset) => {
    const n = offset + 1;
    const format = (["Toploader", "Both", "Binder Sleeve"] as const)[offset % 3];
    const missingFacts = n === 499;
    const duplicate = n === 497 || n === 498;
    return {
      id: syntheticUuid(n),
      cardName: missingFacts ? null : duplicate ? "Synthetic Twin" : n === 1 ? "  Exact  Spacing  " : `Catalog Test ${String(n).padStart(3, "0")}`,
      collectorNumber: missingFacts ? null : duplicate ? "DUP-001" : `synthetic-browser-${n}`,
      setName: missingFacts || n % 10 === 0 ? null : duplicate ? "Synthetic Set" : `Synthetic Set ${n % 5}`,
      rarity: missingFacts || n % 11 === 0 ? null : rarities[n % rarities.length],
      designName: duplicate ? (n === 497 ? "Synthetic Dawn" : "Synthetic Dusk") : fixtureDesign,
      binderSleevePrice: format === "Toploader" ? null : 50_000 + n,
      toploaderPrice: format === "Binder Sleeve" ? null : 70_000 + n,
      productPreviewUrl: n === 4 ? previewUrl : null,
      isActive: n < 477 || n > 496,
    };
  });
  const inactive: SyntheticCatalogProduct = {
    id: syntheticUuid(500),
    cardName: "Inactive Browser Fixture",
    collectorNumber: "synthetic-browser-inactive",
    setName: null,
    rarity: null,
    designName: fixtureDesign,
    binderSleevePrice: 50_000,
    toploaderPrice: null,
    productPreviewUrl: null,
    isActive: false,
  };
  return { products: [pikachu, ...shelf, inactive] };
}
