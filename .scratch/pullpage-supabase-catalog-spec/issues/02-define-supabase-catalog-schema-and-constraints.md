# Define the Supabase Catalog Product schema and constraints

Type: grilling
Status: resolved
Blocked by:

## Question

What exact one-row Prisma/Postgres schema, types, defaults, indexes, check constraints, slug lifecycle, Rarity configuration, rights linkage, timestamps, and `archived_at` behavior must preserve the approved Catalog Product contract while making invalid Dashboard saves fail safely?

## Answer

Use one `catalog_products` row per Catalog Product. There is no draft or publication table: every valid row with `archived_at IS NULL` is eligible for the public catalog. Prisma reads a restricted active-catalog view and derives Format Options from the row's format and price columns. Database constraints and triggers are save-time guardrails, not a second publishing workflow.

### Catalog Product row

| Postgres column | Prisma shape | Null/default | Rule |
| --- | --- | --- | --- |
| `id uuid` | `String @db.Uuid` | `NOT NULL DEFAULT gen_random_uuid()` | Private immutable primary key; never customer-facing. |
| `slug varchar(96)` | `String` | `NOT NULL`, database-generated | Immutable unique public URL identity. Editors neither supply nor edit it. |
| `card_name text` | `String?` | nullable | Blank/whitespace-only input canonicalizes to `NULL`; nonblank text is preserved exactly. |
| `collector_number text` | `String?` | nullable | Same text behavior. |
| `set_name text` | `String?` | nullable | Same text behavior. |
| `rarity_code varchar(32)` | `String?` plus relation | nullable | Foreign key to `catalog_rarities.code`. `NULL` means Unknown rarity. |
| `design_name text` | `String?` | nullable | Same text behavior; duplicate-card rules below apply. |
| `product_preview_url varchar(2048)` | `String?` | nullable | Must be paired with matching rights ID; `NULL` uses the Pullpage placeholder. |
| `product_preview_rights_id uuid` | `String? @db.Uuid` plus relation | nullable | Exact rights-record linkage; must be present together with the URL. |
| `format_code catalog_format_code` | enum `BS`, `TL`, `ALL` | `NOT NULL`, no default | A deliberate editor choice. |
| `binder_sleeve_price integer` | `Int?` | nullable, no default | Whole IDR; every non-null value is positive. |
| `toploader_price integer` | `Int?` | nullable, no default | Whole IDR; every non-null value is positive. |
| `created_at timestamptz(6)` | `DateTime` | `NOT NULL DEFAULT now()` | Database-owned and immutable. |
| `updated_at timestamptz(6)` | `DateTime` | `NOT NULL DEFAULT now()` | Database trigger updates it on row changes, including Dashboard writes. Do not rely on Prisma `@updatedAt`. |
| `archived_at timestamptz(6)` | `DateTime?` | nullable, no default | `NULL` is active; any non-null value is archived immediately. |

Use PostgreSQL `integer`, not decimal or floating point, for prices. It natively prevents fractional values and its positive range is sufficient for Catalog Product prices. Do not add arbitrary length limits to customer-facing text.

The authoritative price check is equivalent to:

```sql
CHECK (binder_sleeve_price IS NULL OR binder_sleeve_price > 0),
CHECK (toploader_price IS NULL OR toploader_price > 0),
CHECK (
  (format_code = 'BS'  AND binder_sleeve_price IS NOT NULL) OR
  (format_code = 'TL'  AND toploader_price IS NOT NULL) OR
  (format_code = 'ALL' AND binder_sleeve_price IS NOT NULL
                       AND toploader_price IS NOT NULL)
)
```

An irrelevant positive price may remain stored and is ignored. Thus `BS` derives only Binder Sleeve, `TL` only Toploader, and `ALL` both. This preserves data when an editor changes formats while retaining the approved “ignore” behavior.

### Slug lifecycle

Enable `pgcrypto` and `unaccent` in the migration. A `BEFORE INSERT` trigger always generates the slug, disregarding an attempted editor value:

1. concatenate available Card Name, Collector Number, and Design Name;
2. lowercase and remove accents;
3. replace non-ASCII-alphanumeric runs with `-`, trim separators, and cap the readable base at 72 characters;
4. use `catalog-product` if no readable base exists;
5. append `-` and eight lowercase random hexadecimal characters from `gen_random_bytes(4)`.

A unique constraint is the collision safeguard; a collision fails atomically and the insert can be retried. A `BEFORE UPDATE` trigger rejects every slug change. Descriptive edits, archival, and restoration never change it.

### Missing text and duplicate-card integrity

A `BEFORE INSERT OR UPDATE` trigger converts empty or whitespace-only optional text to `NULL` but does not trim or rewrite nonblank supplied text.

Define an immutable normalization function for identity comparisons only: coalesce missing to the empty string, trim, collapse internal whitespace, remove accents, and lowercase. It must leave punctuation significant. Add expression indexes over normalized Card Name, Collector Number, and Set Name, and over that identity plus normalized Design Name.

A concurrency-safe constraint trigger must examine all rows, including archived rows. When two or more rows have the same normalized card identity, it rejects the save unless every matching row has a Design Name and all normalized Design Names are distinct. A unique expression index on normalized identity plus normalized non-null Design Name provides an additional collision backstop. Including archived rows guarantees that restoration cannot create an invalid duplicate.

### Configurable Rarity

Use a protected table rather than a PostgreSQL enum:

| Column | Rule |
| --- | --- |
| `code varchar(32) PRIMARY KEY` | Nonblank controlled value. |
| `sort_position smallint NOT NULL UNIQUE` | `CHECK (sort_position > 0)`. |
| `created_at timestamptz(6) NOT NULL DEFAULT now()` | Database-owned. |
| `updated_at timestamptz(6) NOT NULL DEFAULT now()` | Maintained by trigger. |

Seed `C`, `U`, `R`, `RR`, `AR`, `SR`, `SAR`, and `UR` at positions 1 through 8. Trusted editors may add values and change sort positions. Foreign-key enforcement rejects unknown nonblank Rarity values, and deletion of a referenced Rarity is restricted.

### Cloudinary configuration and private rights register

A protected single-row `catalog_preview_config` table stores the approved Cloudinary cloud name and the `catalog-products/` folder prefix. It is populated during provisioning, not hard-coded in product rows.

Keep the private rights register in `product_preview_rights` with:

- UUID primary key;
- unique versioned Product Preview URL and Cloudinary asset identifier;
- status enum `pending`, `approved`, `rejected`, or `expired`, defaulting to `pending`;
- source, creator/photographer, owner/licensor, permission basis, and evidence reference;
- nonempty permitted-channel and permitted-territory arrays;
- explicit attribution-required flag and attribution text when required;
- required `effective_on date`, optional `expires_on date`, and `CHECK (expires_on IS NULL OR expires_on >= effective_on)`;
- reviewer and review timestamp;
- optional takedown/replacement notes;
- database-maintained creation/update timestamps.

Pending records may be incomplete. A trigger rejects a transition to `approved` until every required rights field is complete. Approval is current only when status is `approved`, the effective date has arrived, and the optional expiry date has not passed; an expiry date remains valid through that calendar day.

`catalog_products (product_preview_rights_id, product_preview_url)` has a `MATCH FULL` composite foreign key to the corresponding rights record, with updates and deletion restricted. This makes both product columns present together or absent together and prevents a rights record for one asset from authorizing another. A product save with a preview also fails unless its record is complete, approved, effective, and unexpired.

A URL-validation trigger rejects nonblank URLs unless they are absolute HTTPS Cloudinary delivery URLs under the configured cloud name and folder, use `image/upload`, contain an immutable `/v<digits>/` segment, and identify a supported raster asset rather than SVG. Credentials, alternate ports, fragments, unapproved hosts, clouds, and folders are rejected. Postgres does not make outbound reachability requests during a save; temporary image failures use the runtime placeholder and are operationally monitored.

### Archival, timestamps, and deletion

Archival is reversible catalog exclusion, not availability or stock state. Setting `archived_at` to any timestamp excludes the row; setting it back to `NULL` restores the same ID and slug. A future-dated non-null value is still archived immediately, avoiding accidental scheduling semantics. Archived products remain subject to identity and uniqueness constraints, leave the sitemap, and return the branded 404 after the public cache refreshes.

The normal Dashboard editing workflow has no hard-delete permission. Hard deletion is exceptional owner maintenance; normal removal always uses `archived_at`.

### Runtime read boundary

Expose a read-only `runtime_catalog_products` database view that:

- includes only `archived_at IS NULL` rows;
- returns all public Catalog Product fields and the Rarity sort position;
- returns `product_preview_url` only while its exact rights record and Cloudinary configuration remain valid and current;
- otherwise projects that URL as `NULL` so the application uses the placeholder;
- exposes no private rights evidence or review data.

The restricted Prisma runtime role receives `SELECT` on this view and the public Rarity projection only, with no base-table or write grants. There is no browser Supabase role or API access. Prisma's public catalog query therefore remains straightforward: read the view, derive Format Options, and display the data.

### Indexes

Create only the indexes justified by integrity and server reads:

- primary key on `catalog_products.id`;
- global unique index on `catalog_products.slug`;
- normalized card-identity expression index;
- unique normalized card-identity plus normalized non-null Design Name expression index;
- indexes on `rarity_code` and the composite rights foreign key;
- a partial active-row index, keyed by `updated_at`, where `archived_at IS NULL`;
- primary/unique and foreign-key-supporting indexes on the configuration and rights tables.

Do not initially add separate customer-search, format, or price indexes. The server reads the small active snapshot, while search, filtering, and sorting operate over that snapshot.
