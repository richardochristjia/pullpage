# Model Rarity as reference data

Rarity is configured reference data rather than a hard-coded Catalog Product string because each classification now owns a customer-facing name, display order, accessible badge colors, and filter visibility. Catalog Products continue to expose an optional code, with a missing value meaning Unknown rarity and `NO_MARK` representing a known card without a rarity symbol; this deliberately adds a second directly managed Catalog table to the simpler integration established by ADR 0001.

## Consequences

The configured display order is for consistent presentation and sorting, not a universal low-to-high ranking across Pokémon eras. The application reads Rarity metadata through the same read-only runtime identity, while Catalog editors choose only configured codes on Catalog Products; inactive Rarities remain valid product facts but are omitted from the filter list.
