# Define the Catalog Product content model

Type: grilling
Status: resolved
Blocked by:

## Question

What exact fields, controlled values, optionality rules, price representation, stable identifier, validation constraints, and matching/sorting semantics must the specification define for each Catalog Product and its Format Options?

## Answer

### Source record

Each source record defines one Catalog Product with these fields:

| Field | Requirement | Public behavior |
| --- | --- | --- |
| Slug | Required after first publication; generated and persisted by the publishing system in a protected field | Used in product URLs; never shown as product information |
| Card Name | Optional plain text | Show the supplied value unchanged, or `No Name` when missing |
| Collector Number | Optional plain text | Show the supplied value unchanged, or `Unknown number` when missing |
| Set Name | Optional plain text | Show the supplied value unchanged, or `Unknown set` when missing |
| Rarity | Optional controlled value | Show the selected value, or `Unknown rarity` when missing |
| Design Name | Optional plain text, conditionally required for duplicate cards | Show when present; omit when missing |
| Product Preview URL | Optional string containing one absolute HTTPS URL | Use for both grid and modal; show a branded Pullpage placeholder when missing, invalid, or unavailable |
| Format Code | Required controlled value: `BS`, `TL`, or `ALL` | Display full labels only: Binder Sleeve and/or Toploader |
| Binder Sleeve Price | Conditionally required positive whole-IDR amount | Display for the Binder Sleeve Format Option |
| Toploader Price | Conditionally required positive whole-IDR amount | Display for the Toploader Format Option |

There is no Product ID, description, stock, availability status, per-row currency, manual display-order field, or separate thumbnail/full-size image URL.

### Identity and duplicate-card rules

- The publishing system generates a readable lowercase slug from available Card Name, Collector Number, and Design Name values, then appends a short random suffix, for example `charizard-ex-203-165-sunset-k4m2`.
- The generated slug is persisted once and remains unchanged when descriptive fields are corrected. Editors neither assign nor edit it.
- Duplicate persisted slugs are invalid and block publishing.
- Two records target the same card when Card Name, Collector Number, and Set Name are equal after case folding, accent removal, trimming, and internal-whitespace collapsing. Punctuation is preserved for this comparison.
- When two or more records target the same card, every one requires a Design Name, and those names must be distinct after the same text normalization.

### Missing values and text safety

- Null, empty, and whitespace-only optional text values count as missing.
- Nonblank editor text is displayed as supplied, without spelling, capitalization, or length normalization.
- All editor text is rendered strictly as plain text, never interpreted as HTML or Markdown.
- Generated fallback labels are presentation values, not source data.

### Rarity

- The initial controlled order from lower to higher is `C`, `U`, `R`, `RR`, `AR`, `SR`, `SAR`, and `UR`.
- The controlled vocabulary may be extended by editors only through the publishing workflow's configured Rarity list; every added value must also receive a sort position.
- Blank Rarity uses `Unknown rarity`. A nonblank value outside the configured list is invalid and blocks publishing.

### Format Options and prices

- `BS` produces one Binder Sleeve Format Option and requires Binder Sleeve Price. Any supplied Toploader Price is ignored.
- `TL` produces one Toploader Format Option and requires Toploader Price. Any supplied Binder Sleeve Price is ignored.
- `ALL` produces both Format Options and requires both prices.
- Unknown format codes and missing prices required by the selected code block publishing.
- Prices are positive whole-rupiah integers with no currency symbols, grouping punctuation, decimals, zero, or negative values in source data; for example, source `75000` displays as `Rp75.000`.
- IDR is fixed catalog-wide and is not repeated in each record.

### Product Preview validation

- A blank Product Preview URL is allowed but produces a publishing warning and renders the branded Pullpage placeholder.
- A nonblank Product Preview URL must be one absolute `https://` URL from the configured Cloudinary account/allowlist. Malformed, non-HTTPS, and non-allowlisted URLs are invalid and block publication.
- A syntactically valid, allowlisted Cloudinary URL that fails the publish-time reachability check produces a warning rather than blocking publication and renders the branded Pullpage placeholder.
- The image-hosting decision specifies transformations and delivery behavior without changing the one-URL content model.

### Search and filter matching

- Text search matches supplied Card Name, Collector Number, Set Name, and Design Name values using partial matching.
- Search ignores case, accents, spaces, slashes, and hyphens. An empty query adds no constraint.
- Search does not index generated fallbacks such as `No Name` or `Unknown set`.
- Rarity and binder-format filters support multiple selections. Values within one filter combine with OR; text search, Rarity, binder format, and price filters combine with AND.
- `Unknown rarity` is a selectable Rarity filter value.
- Price bounds are inclusive. With selected binder formats, only prices for those formats are eligible; without a format filter, any Format Option price may satisfy the range. A product matches when at least one eligible Format Option price is in range.

### Sorting

- Default order is Card Name A–Z.
- Card Name sorting is case- and accent-insensitive. Missing Card Names remain last in either direction; ties use Collector Number, Design Name, then slug.
- Price sorting uses the lowest price among selected binder formats, or the lowest price across all Format Options when no format is selected. Ties use Card Name, then slug.
- Rarity ascending follows `C → U → R → RR → AR → SR → SAR → UR`; descending reverses it. Unknown Rarity remains last in either direction.
- Slug is the final deterministic tie-breaker for every sort.
