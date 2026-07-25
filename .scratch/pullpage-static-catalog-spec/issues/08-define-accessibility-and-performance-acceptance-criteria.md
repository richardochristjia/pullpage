# Define accessibility and performance acceptance criteria

Type: research
Status: resolved
Blocked by: 03, 04

## Question

What measurable accessibility, keyboard/modal behavior, responsive-browser, image-loading, filtering responsiveness, and page-performance acceptance criteria should the implementation-ready specification require for a catalog of up to 500 products?

## Answer

Require WCAG 2.2 Level AA as a release gate, supported by zero automated accessibility violations, Lighthouse Accessibility 100 on the catalog and a representative product route, complete manual keyboard testing, and NVDA/Chrome plus VoiceOver/Safari smoke tests. The intercepted product modal must follow the WAI-ARIA modal-dialog pattern: labelled dialog, inert background, contained Tab order, Escape and visible-close dismissal, browser Back support, and focus restoration to the invoking product link.

Test the accepted responsive Catalog shelf with a deterministic 500-Catalog-Product fixture at 320×568, 375×812, 768×1024, 1024×768, and 1440×900, plus mobile landscape and 200% zoom. Support Next.js 16’s browser floor; ensure no page-level horizontal overflow; preserve state across orientation and modal navigation; and provide at least 44×44 CSS-pixel primary/icon control targets.

Product Previews must use non-cropping responsive Cloudinary variants, reserved aspect-ratio space, lazy shelf loading, and branded failure placeholders. A cold 500-record load may request at most 30 thumbnails and no modal-size image. Search/filter/sort must update at p95 ≤100 ms under 4× CPU slowdown, produce no task over 50 ms, and issue no network request.

On production Vercel builds, both `/` and a representative product route must score Lighthouse Performance ≥90 with LCP ≤2.5 s, CLS ≤0.10, TBT ≤200 ms, FCP ≤1.8 s, compressed initial JavaScript ≤200 KB, and non-image HTML/CSS/JS transfer ≤350 KB. Once traffic is sufficient, mobile and desktop field data must keep 75th-percentile LCP ≤2.5 s, INP ≤200 ms, and CLS ≤0.10.

Detailed criteria, test fixtures, evidence requirements, and primary-source citations: [Accessibility and performance acceptance criteria](../research/08-accessibility-performance-acceptance-criteria.md).
