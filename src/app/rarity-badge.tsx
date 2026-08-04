import type { PublicCatalogRarity } from "@/catalog/catalog";
import { Badge } from "@/components/ui/badge";

export function rarityDisplayLabel(rarity: PublicCatalogRarity) {
  return rarity.code === "NO_MARK" ? rarity.displayName : rarity.code;
}

export function rarityDescription(rarity: PublicCatalogRarity) {
  const label = rarityDisplayLabel(rarity);
  return label === rarity.displayName ? label : `${label} — ${rarity.displayName}`;
}

export function RarityBadge({
  rarity,
  decorative = false,
}: {
  rarity: PublicCatalogRarity | null;
  decorative?: boolean;
}) {
  if (rarity === null) return <Badge variant="secondary">Unknown rarity</Badge>;

  const description = rarityDescription(rarity);
  return (
    <Badge
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : description}
      title={decorative ? undefined : description}
      style={{
        backgroundColor: rarity.badgeBackgroundColor,
        color: rarity.badgeForegroundColor,
      }}
    >
      {rarityDisplayLabel(rarity)}
    </Badge>
  );
}
