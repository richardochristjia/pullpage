export type SyntheticCatalogProduct = {
  id: string;
  cardName: string | null;
  collectorNumber: string | null;
  setName: string | null;
  rarityCode: string | null;
  designName: string | null;
  formatCode: "BS" | "TL" | "ALL";
  binderSleevePrice: number | null;
  toploaderPrice: number | null;
  productPreviewUrl: string | null;
  productPreviewRightsId: string | null;
  archivedAt: string | null;
};

const rarityCodes = ["C", "U", "R", "RR", "AR", "SR", "SAR", "UR"] as const;
const previewUrl = "https://res.cloudinary.com/pullpage-synthetic/image/upload/v1/catalog-products/synthetic-preview.webp";
const rightsId = "20000000-0000-4000-8000-000000000001";
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
    rarityCode: "AR",
    designName: "Electric Bloom",
    formatCode: "BS",
    binderSleevePrice: 95_000,
    toploaderPrice: null,
    productPreviewUrl: null,
    productPreviewRightsId: null,
    archivedAt: null,
  };
  const shelf: SyntheticCatalogProduct[] = Array.from({ length: 499 }, (_, offset) => {
    const n = offset + 1;
    const formatCode = (["TL", "ALL", "BS"] as const)[offset % 3];
    const missingFacts = n === 499;
    const duplicate = n === 497 || n === 498;
    return {
      id: syntheticUuid(n),
      cardName: missingFacts ? null : duplicate ? "Synthetic Twin" : n === 1 ? "  Exact  Spacing  " : `Catalog Test ${String(n).padStart(3, "0")}`,
      collectorNumber: missingFacts ? null : duplicate ? "DUP-001" : `synthetic-browser-${n}`,
      setName: missingFacts || n % 10 === 0 ? null : duplicate ? "Synthetic Set" : `Synthetic Set ${n % 5}`,
      rarityCode: missingFacts || n % 11 === 0 ? null : rarityCodes[n % rarityCodes.length],
      designName: duplicate ? (n === 497 ? "Synthetic Dawn" : "Synthetic Dusk") : fixtureDesign,
      formatCode,
      binderSleevePrice: formatCode === "TL" ? null : 50_000 + n,
      toploaderPrice: formatCode === "BS" ? null : 70_000 + n,
      productPreviewUrl: n === 4 ? previewUrl : null,
      productPreviewRightsId: n === 4 ? rightsId : null,
      archivedAt: n >= 477 && n <= 496 ? "2026-01-01T00:00:00.000Z" : null,
    };
  });
  const archived: SyntheticCatalogProduct = {
    id: syntheticUuid(500), cardName: "Archived Browser Fixture", collectorNumber: "synthetic-browser-archived",
    setName: null, rarityCode: null, designName: fixtureDesign, formatCode: "BS", binderSleevePrice: 50_000,
    toploaderPrice: null, productPreviewUrl: null, productPreviewRightsId: null, archivedAt: "2026-01-01T00:00:00.000Z",
  };
  return {
    configuration: { environmentName: "synthetic", cloudName: "pullpage-synthetic", assetFolder: "catalog-products/" },
    approvedRights: { id: rightsId, exactVersionedUrl: previewUrl, status: "approved" as const },
    products: [pikachu, ...shelf, archived],
  };
}
