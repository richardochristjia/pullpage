Label: wayfinder:map

# Chart an implementation-ready specification for the Pullpage catalog

## Destination

An approved, implementation-ready specification for Pullpage’s public static product catalog, ready to hand off for implementation without unresolved product, content, interaction, publishing, or quality decisions.

## Notes

- This effort is planning-only: stop at the specification; do not implement or deploy the catalog.
- Read `CONTEXT.md` and use the domain-modeling and grilling skills for domain decisions. Use the research and prototype skills for tickets of those types.
- Existing stack: Next.js 16.2.10, React 19.2.4, Tailwind CSS 4, and Vercel. Read the relevant local Next.js 16 documentation before making framework-specific recommendations.
- Pullpage is an English, read-only catalog with IDR prices. There is no purchasing, ordering, inventory, or availability model; every source record is public.
- Customer experience supports browsing, search by Card Name or Collector Number, filtering by Rarity, Supported Binder Format, and price, sorting by Card Name, lowest Format Option price, or Rarity, and a shareable product modal with a large Product Preview and full details.
- Product facts established during charting: Set Name is optional and displays as `Unknown set`; each supported binder format has its own price; Product Previews show the finished card presentation and are referenced by external image URLs.
- Initial scale is about 100 Catalog Products; design ceiling is 500. Use dummy records for prototypes because no catalog data has been entered yet.
- A non-developer must be able to edit and publish independently. Google Sheets is the preferred content-source candidate.
- Brand name: Pullpage. Logo source: `C:\Users\174818.RICHARDO\Downloads\pullpage_logo.png`; use its blue, white, and orange visual cues. Do not redesign the logo.
- The final specification must include public discoverability, product-specific sharing, accessibility, and performance requirements.

## Decisions so far

- [Evaluate Product Preview hosting](issues/02-evaluate-product-preview-hosting.md) — Cloudinary is the Product Preview host; Google Drive is excluded as a production image origin.
- [Select the non-developer publishing architecture](issues/03-select-non-developer-publishing-architecture.md) — Use a protected Draft → Published Google Sheets snapshot, bound Apps Script validation, and a Vercel Deploy Hook; builds consume only the published CSV.
- [Determine trademark and attribution requirements](issues/05-determine-trademark-and-attribution-requirements.md) — Treat legal review and documented rights provenance as launch gates; disclaimers or attribution do not provide commercial reuse permission.
- [Define the Catalog Product content model](issues/01-define-catalog-product-content-model.md) — Fixed the source fields, fallbacks, protected slug, Rarity and format codes, IDR price validation, duplicate-design rules, and search/filter/sort semantics.
- [Prototype the customer catalog experience](issues/04-prototype-customer-catalog-experience.md) — Adopt the dark Catalog shelf direction: compact branded header, responsive filter-led product rows, and a product-specific URL modal.
- [Prototype the editor publishing workflow](issues/06-prototype-editor-publishing-workflow.md) — Use direct Edit → Validate → Publish → Verify; omit staging preview and rely on fail-closed validation, immediate production smoke testing, and rollback.
- [Specify product links, SEO, and social sharing](issues/07-specify-product-links-seo-and-social-sharing.md) — Use prerendered canonical product paths with intercepted modal navigation, build-time metadata, Cloudinary social cards, production-only indexing, and no merchant structured data.
- [Define accessibility and performance acceptance criteria](issues/08-define-accessibility-and-performance-acceptance-criteria.md) — Gate release on WCAG 2.2 AA, accessible modal/keyboard behavior, responsive browser coverage, bounded image loading and interaction latency, and good Core Web Vitals.
- [Choose the canonical Pullpage production origin](issues/10-choose-canonical-production-origin.md) — Use `https://pullpage.vercel.app` for the initial launch and change it only through a coordinated canonical-origin migration.
- [Approve the implementation-ready catalog specification](issues/09-approve-implementation-ready-catalog-specification.md) — Approved the consolidated [catalog specification](spec.md) for implementation handoff, with legal review and production-origin confirmation retained as launch gates.

## Not yet specified

<!-- None. -->

## Out of scope

- Purchasing, customer orders, checkout, payment, and contact-to-buy flows.
- Stock quantities, availability states, sold-out behavior, and live inventory.
- A custom admin application or custom CMS.
- Multilingual UI.
- Logo redesign or a broader branding project.
- Catalog implementation, deployment, and production data entry.
