# Browse, find, and open Catalog Products

Label: ready-for-agent
Type: task
Status: open
Blocked by: 11

## Parent

[Pullpage dynamic Supabase catalog](../spec.md)

## What to build

Deliver the complete customer Catalog experience over the active public projection. Customers can browse the approved responsive dark Catalog shelf, understand every Catalog Product and missing-value state, search/filter/sort locally, and open the same product through an intercepted modal or complete canonical page without losing shelf state.

This is one combined vertical slice: shelf presentation, local discovery behavior, product routing, modal navigation, accessibility semantics, and browser tests must work together rather than as independent horizontal tasks.

## Acceptance criteria

- [ ] The approved dark Catalog shelf replaces all remaining prototype directions and uses the supplied Pullpage logo without redesign.
- [ ] Desktop presents a compact branded header, persistent filter-led sidebar, and comparison-friendly rows; mobile presents search, collapsible filters/sort, then results.
- [ ] Every row exposes supplied identity facts, Design Name when present, Set Name/fallback, Supported Binder Formats, and each eligible Format Option price.
- [ ] Missing Card Name, Collector Number, Set Name, and Rarity use the approved presentation fallbacks without writing or indexing those labels as source data.
- [ ] Loading, one-result, 500-result, zero-result, placeholder, not-found, and reset behavior are clear and preserve available controls.
- [ ] Search partial-matches supplied Card Name, Collector Number, Set Name, and Design Name while ignoring case, accents, spaces, slashes, and hyphens.
- [ ] Rarity and Supported Binder Format allow multiple selections with OR within a group and AND across search, Rarity, format, and price groups.
- [ ] Unknown rarity is selectable; optional minimum/maximum price bounds are inclusive and use only selected-format prices when formats are selected.
- [ ] Card Name, price, and Rarity sorting follows every approved missing-value, configured-order, eligible-price, tie-breaking, and final-slug rule in both directions.
- [ ] Search/filter/sort operates entirely over the delivered projection, makes no network request, keeps input/focus stable, and announces one final result count per action.
- [ ] Search/filter/sort state remains client-only, is absent from query parameters, and resets on a full shelf refresh.
- [ ] Each product row is a semantic link to its immutable `/products/<slug>` canonical and has an accessible name that distinguishes duplicate designs.
- [ ] Soft navigation opens the shared product detail in an accessible intercepted modal over the preserved shelf.
- [ ] Hard load, refresh, new tab, crawler request, and disabled JavaScript render a complete product page using the same detail behavior and facts.
- [ ] Browser Back closes the modal and restores shelf controls, scroll, and invoking-link focus; Forward reopens it.
- [ ] The modal has an accessible visible heading, inert background, contained Tab order, Escape and visible-close dismissal, suitable initial focus, and fallback focus when the invoking row no longer exists.
- [ ] Unknown and archived slugs render branded not-found content, no product facts, a shelf link, and `noindex`; streamed HTTP 200 is accepted when those semantics are present.
- [ ] One common branded placeholder preserves all textual facts when no Product Preview URL is available.
- [ ] Responsive, keyboard, screen-reader-oriented, direct-route, soft-navigation, Back/Forward, disabled-JavaScript, and deterministic 500-product browser tests pass.
- [ ] The production bundle contains no losing prototype UI, inline dummy generator, query variant switch, or prototype instrumentation.

## Blocked by

- [Ticket 11](11-create-and-edit-valid-catalog-product.md)
