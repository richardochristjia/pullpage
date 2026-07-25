# Pokémon trademark, attribution, image-use, and metadata guidance

> **Scope:** Product/specification risk guidance based on primary sources, not legal advice and not a conclusion that any particular use is lawful. Pullpage is commercial and operates in Indonesia; qualified counsel should review the actual products, previews, wording, and launch territory.

## Executive conclusion

Authoritative Pokémon sources do **not** provide a general fan-product or commercial-merchandise permission that Pullpage can rely on. The Pokémon Support guidance asks requesters not to use Pokémon intellectual property—including characters, names, and designs—in or in association with a project, while the Pokémon website Terms restrict use of website content and do not grant a commercial reuse license.[1][2]

Therefore, an attribution line or “fan-made/unofficial” disclaimer must not be treated as permission. The catalog specification should instead:

1. make documented image/content rights a production launch gate;
2. identify Pullpage clearly as the source of the catalog and products;
3. prohibit claims or visual treatment suggesting official status, sponsorship, licensing, or endorsement unless documented;
4. use Pokémon names and card facts only as narrowly as necessary to identify what a Catalog Product depicts or fits, subject to counsel’s review;
5. keep rights provenance and approval metadata for every Product Preview and other third-party asset;
6. require counsel to approve the exact trademark attribution and non-affiliation wording before launch.

## What the primary sources establish

### 1. No broad fan-project permission

The Pokémon Company International’s support article **“Can I use Pokémon images or materials?”** says it is not in a position to review requests to use Pokémon intellectual property or grant permission, and asks people not to use Pokémon intellectual property—including characters, names, and designs—in or associate it with their project.[1]

This is materially different from a fan-content license. Pullpage should not describe itself as operating under an official “fan art policy,” because the reviewed Pokémon source does not grant one.[1]

### 2. Public availability is not a reuse license

The Pokémon website Terms of Use reserve rights in site content and limit the permission supplied by those Terms; they do not provide Pullpage with a license to reuse official card images, character art, logos, set symbols, card backs, or other site assets in a commercial catalog.[2]

Consequences for the specification:

- Do not copy images or metadata from Pokemon.com merely because they can be viewed or downloaded.
- Do not use the Pokémon logo, Trading Card Game logo, card back, Poké Ball device, Energy symbols, expansion symbols, or similar official artwork as Pullpage navigation, badges, filters, backgrounds, or decorative UI without documented authorization.
- Do not infer permission for a Product Preview from the fact that Pullpage created the photo or render. The new photo/render and the protected material depicted inside it are separate rights questions requiring review.

### 3. Official footer language is evidence of claimed ownership, not a third-party license template

Pokemon.com’s own legal/footer notice uses a joint copyright line for Pokémon/Nintendo/Creatures/GAME FREAK and identifies Pokémon, character names, and related marks as trademarks.[3] This identifies rights claims made by the official publisher; it does not instruct unaffiliated commercial sites to copy the notice verbatim or imply that doing so authorizes use.[2][3]

The exact entities and wording that Pullpage names should be approved against the marks and assets actually used. Do not guess ownership per image, expansion symbol, or card element.

### 4. Symbols and disclaimers do not create permission

The United States Patent and Trademark Office explains that trademark symbols communicate a claim or registration status: `TM`/`SM` can denote a claimed mark, while `®` is for a federally registered mark.[4] A symbol is not a license. Pullpage should not scatter `®` or `TM` through card names or generated metadata unless counsel requires a specific use.

A non-affiliation disclaimer can reduce customer confusion, but it cannot cure unauthorized copying or sale. That limitation must be explicit in the specification.

### 5. Territory and actual use matter

Pullpage prices in IDR and appears directed to Indonesia. Trademark registration and ownership are territorial; WIPO’s Global Brand Database itself advises searching national/regional registers as well as its database.[5] The specification should not turn a US-site footer or a US trademark search into a conclusion about Indonesian rights. Indonesian counsel should review the launch.

## Required specification rules

### A. Production launch gate

Before production data or Product Previews are published, require a written rights review covering:

- the extended-art products themselves, not only the website;
- each class of Product Preview (photograph, composite, render, illustration);
- Pokémon/card names in headings, search, URLs, and social metadata;
- official card artwork and card layout visible in previews;
- expansion names, rarity abbreviations, Collector Numbers, symbols, logos, and card backs;
- the exact non-affiliation/trademark notice;
- Indonesia and any other intentionally served territory.

Record the reviewer, date, scope, decision, and any conditions. If approval or another documented basis is absent, the item is not publishable. The implementation can be built with dummy/rights-cleared placeholders, but production launch remains blocked.

### B. Brand and confusion controls

The public experience should:

- lead with **Pullpage** branding in the header, page title, metadata, and social cards;
- never use “official,” “licensed,” “authorized,” “partner,” or equivalent claims without evidence;
- never imitate Pokemon.com or Pokémon TCG visual identity;
- avoid official logos and emblem-like graphics as Pullpage UI;
- avoid `pokemon` or a character name as the dominant site/domain/app identity;
- describe a relationship factually—for example, that a Pullpage design is made for or depicts a named card—rather than naming the Pullpage product as though it were an official Pokémon product;
- keep the non-affiliation notice available globally in the footer and in an About/Legal page.

A **candidate for legal review**, not approved copy, is:

> Pullpage is an independent maker and is not affiliated with, sponsored by, or endorsed by Nintendo, Creatures Inc., GAME FREAK inc., The Pokémon Company, or The Pokémon Company International. Pokémon and related names and marks belong to their respective owners.

Do not ship that wording until counsel verifies the correct entities, mark ownership, territory, and whether additional copyright attribution is appropriate. Do not label products “fan-made” as a substitute for that review.

### C. Product naming and metadata

Customer-facing metadata should remain factual and restrained:

- **Card Name**, **Set Name**, **Collector Number**, and **Rarity** identify the depicted card; they must not imply that Pullpage’s Catalog Product is manufactured or approved by the Pokémon rights holders.
- Keep **Pullpage** and, where supplied, **Design Name** prominent enough to distinguish the Catalog Product from an official card/product.
- Do not auto-prefix product titles with “Pokémon,” “Pokémon TCG,” or “official.” Use a Pokémon term only where needed for accurate identification and after rights review.
- Do not add trademark symbols to every occurrence in search results, URLs, filters, or alt text unless approved wording specifically requires it.
- Social/Open Graph titles and descriptions must identify Pullpage and must not be phrased as official Pokémon announcements or listings.
- Slugs should prefer stable Pullpage Catalog Product identifiers/Design Names rather than presenting a Pokémon character name as Pullpage’s own product family or mark.

Individual names, numbers, and classifications may be factual, but bulk copying can also implicate source-site terms and database rights. Enter facts from a documented permissible source; do not scrape Pokemon.com or another database unless its terms or a separate license permit the intended commercial use.[2]

### D. Product Preview policy

Every Product Preview must be treated as a governed asset. The catalog source should include or reference a rights register with:

- `preview_asset_id`;
- original source URL/file identifier;
- asset type (`original-photo`, `original-render`, `licensed-asset`, or another approved controlled value);
- creator/photographer;
- owner/licensor;
- permission basis and evidence link;
- permitted channels and territories;
- required attribution text;
- effective and expiry dates, if any;
- review status (`pending`, `approved`, `rejected`, `expired`);
- reviewer and review date;
- takedown/replacement note.

Only `approved` and unexpired previews may enter the Published Products snapshot. The publisher validation should reject a Catalog Product whose preview lacks an approved rights record.

Additional controls:

- Use the minimum resolution needed for the Product Preview experience; do not expose source artwork or print-ready files.
- Do not take official web images and place them into Cloudinary. Hosting/transformation does not change underlying rights.
- Cloudinary asset metadata should carry the Pullpage asset ID and rights status, not unsupported statements such as “owned by Pullpage.”
- A watermark or copyright notice is not a substitute for permission.
- Maintain a documented takedown path and the ability to unpublish/replace one preview promptly.

### E. Accessibility text

Alt text should describe the Pullpage preview’s customer-relevant visual content without promotional ownership claims. A suitable pattern is:

> Pullpage [Design Name] extended-art surround shown with [Card Name] [Collector Number]

Omit missing optional fields naturally. Do not repeat the disclaimer, trademark symbols, SEO keyword lists, or “official” in every image description.

### F. Acceptance checks

The final catalog specification should include these checks:

1. No production Product Preview publishes without an approved, current rights record.
2. No official logo, card back, set symbol, character image, or similar asset is used as site chrome without explicit recorded approval.
3. Pullpage is the dominant source identifier in headers and metadata.
4. No page claims or implies endorsement, licensing, or official status.
5. The counsel-approved notice appears consistently in the footer and Legal/About content.
6. Product and social metadata distinguish the Pullpage Catalog Product from the depicted card.
7. Publisher validation fails closed on missing/expired rights status.
8. A documented takedown can remove an affected Product Preview/Catalog Product without requiring unrelated catalog changes.
9. The launch checklist records legal review for the actual products, images, wording, and served territories.

## What remains a legal question

This research does not decide:

- whether a particular use is nominative trademark use;
- whether product photography, resale/first-sale principles, fair dealing/fair use, or another limitation applies;
- whether the extended-art product is a derivative work;
- whether a specific card name, set name, symbol, image, or layout is protected in Indonesia;
- whether the candidate notice is sufficient;
- whether Pullpage has existing permissions outside the repository.

Those conclusions depend on facts and jurisdiction and should be made by qualified counsel. The product specification’s role is to preserve evidence, prevent accidental publication, avoid misleading presentation, and make counsel’s approved constraints testable.

## Primary sources

1. The Pokémon Company International Support, **Can I use Pokémon images or materials?**: https://support.pokemon.com/hc/en-us/articles/360001202072-Can-I-use-Pok%C3%A9mon-images-or-materials
2. The Pokémon Company International, **Terms of Use**: https://www.pokemon.com/us/legal/terms-of-use
3. The Pokémon Company International, **Pokemon.com legal notice/footer**: https://www.pokemon.com/us/legal/
4. United States Patent and Trademark Office, **What is a trademark? — Using the trademark symbols TM, SM, and ®**: https://www.uspto.gov/trademarks/basics/what-trademark
5. World Intellectual Property Organization, **Global Brand Database** (scope and national-register caveat): https://www.wipo.int/reference/en/branddb/
