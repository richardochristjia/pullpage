import type { PublicCatalogRarity } from "@/catalog/catalog";
import { Badge } from "@/components/ui/badge";

export function rarityDisplayLabel(rarity: PublicCatalogRarity) {
  return rarity.code === "NO_MARK" ? rarity.displayName : rarity.code;
}

export function rarityDescription(rarity: PublicCatalogRarity) {
  const label = rarityDisplayLabel(rarity);
  return label === rarity.displayName ? label : `${label} — ${rarity.displayName}`;
}

export function RarityBadge({ rarity }: { rarity: PublicCatalogRarity | null }) {
  if (rarity === null) return <Badge variant="secondary">Unknown rarity</Badge>;

  return (
    <Badge
      aria-label={rarityDescription(rarity)}
      title={rarityDescription(rarity)}
      style={{
        backgroundColor: rarity.badgeBackgroundColor,
        color: rarity.badgeForegroundColor,
      }}
    >
      {rarityDisplayLabel(rarity)}
    </Badge>
  );
}
