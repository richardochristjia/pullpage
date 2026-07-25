# Prototype the customer catalog experience

Type: prototype
Status: resolved
Blocked by:

## Question

What modern, mobile-first Pullpage catalog layout and interaction model best supports browsing up to 500 products, applying search/filter/sort controls, inspecting a large Product Preview in a modal, and sharing a specific product while using the supplied logo and dummy data?

## Comments

Prototype ready for live review: [customer catalog prototype source](../../../src/app/catalog-prototype.tsx) with [variant styles](../../../src/app/catalog-prototype.module.css).

Run `npm run prototype:catalog`, then compare:

- `http://localhost:3000/?variant=A` — Gallery first
- `http://localhost:3000/?variant=B` — Catalog shelf
- `http://localhost:3000/?variant=C` — Binder index

The floating switcher and Left/Right Arrow keys preserve the current search/filter/modal state while changing variants. Opening a Catalog Product adds its slug to the URL; the modal’s share action copies that product-specific URL.

### Dark-theme iteration

Applied live-review feedback across all three directions:

- Reworked every page, control, card, binder surface, empty state, and modal into a high-contrast dark theme using shared semantic color tokens.
- Reduced brand-header heights to 56–64px and desktop logo widths to 54–76px, while preserving the supplied logo’s proportions.
- Added short, transform/opacity-based variant, result, popover, modal, preview, hover, and press transitions with a shared motion rhythm.
- Preserved a no-animation experience under `prefers-reduced-motion`.

## Answer

Adopt **B — Catalog shelf** as the customer catalog’s layout and interaction baseline.

The selected direction uses a compact dark header with the supplied Pullpage logo and deliberate vertical clear space; a persistent filter-led sidebar on larger screens; a search-first collapsible filter panel on mobile; and comparison-friendly product rows that expose identity, Design Name, Set Name, Supported Binder Formats, and Format Option prices without opening every item.

Selecting a row opens the shared large Product Preview modal. The selected Catalog Product is represented by a `product` URL parameter so its modal can be reloaded and shared directly. Search, Rarity, Supported Binder Format, price, and sort controls retain the behavior exercised by the prototype. Motion uses short transform/opacity transitions and respects `prefers-reduced-motion`.

The dark theme and compact header scale were accepted during live review; the final iteration adds vertical margin around the logo. Variants A and C are not specification candidates. The linked prototype remains a throwaway primary-source artifact and must not be promoted directly into production code.
