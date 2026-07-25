# Create and edit a valid Catalog Product

Label: ready-for-agent
Type: task
Status: open
Blocked by: 10

## Parent

[Pullpage dynamic Supabase catalog](../spec.md)

## What to build

Extend the tracer into the complete one-row Catalog Product contract and prove the non-developer Supabase Dashboard Edit → Save → Verify path. A complete valid insert or edit must commit atomically, receive an immutable generated slug, enter the shared public projection, invalidate the Catalog cache, and normally become visible on the shelf within 60 seconds without deployment.

Invalid product facts must fail at the database boundary with stable, actionable messages and no partial public effect. This slice supports products with no Product Preview; rights-safe previews arrive in a later slice.

## Acceptance criteria

- [ ] The Catalog Product schema supports private UUID, immutable generated slug, nullable exact Card Name, Collector Number, Set Name and Design Name, nullable configured Rarity, format code, Binder Sleeve and Toploader prices, database-owned timestamps, nullable archive timestamp, and nullable paired preview linkage reserved for the preview slice.
- [ ] Empty and whitespace-only optional text canonicalizes to null while nonblank text remains unchanged.
- [ ] Slugs are generated from readable identity facts plus an eight-character random suffix, use a fallback base when needed, are globally unique, and reject every attempted update.
- [ ] Initial Rarity values `C`, `U`, `R`, `RR`, `AR`, `SR`, `SAR`, and `UR` exist at unique positive positions and unknown nonblank values fail.
- [ ] `BS`, `TL`, and `ALL` enforce their required positive whole-IDR prices; irrelevant positive prices may remain stored but do not create Format Options.
- [ ] Duplicate-card comparison follows the approved case, accent, trim, whitespace, missing-value, and punctuation rules across active and archived rows.
- [ ] Duplicate depictions require nonblank normalized-distinct Design Names, including under concurrent insert/update attempts.
- [ ] Database-owned UUID, slug, creation timestamp, and update timestamp cannot be overwritten through routine editing.
- [ ] Database checks and triggers return stable names, plain-language messages, and correction hints for every routine validation category.
- [ ] A rejected transaction changes no row, timestamp, public projection, or cache state.
- [ ] A valid insert/edit is transformed into the complete public DTO and displayed with the accepted missing-value fallbacks and derived Format Options.
- [ ] The complete public projection uses one shared remote cache generation and one fixed global Catalog tag with the approved 30-second stale/revalidation and 60-second expiry values.
- [ ] An authenticated expected database change expires the fixed Catalog tag; the endpoint rejects wrong secrets, methods, tables, and malformed events and accepts no caller-selected tag or path.
- [ ] A Dashboard-equivalent insert and edit normally become visible on a fresh production-mode shelf response within 60 seconds without a build or deployment.
- [ ] An ambiguous connection result is resolved by checking the persisted row before retry, and the documented workflow prevents duplicate insertion.
- [ ] Integration tests cover all valid/invalid field boundaries, normalization, slug lifecycle, Rarity, formats/prices, duplicate concurrency, atomic rollback, and runtime projection.
- [ ] A non-developer rehearsal demonstrates create, edit, expected errors, successful save, generated slug, and public verification without SQL or developer interpretation.

## Blocked by

- [Ticket 10](10-establish-end-to-end-catalog-tracer.md)
