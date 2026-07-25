# Accessibility and performance acceptance criteria

## Decision

The implementation-ready specification must make **WCAG 2.2 Level AA**, the **Core Web Vitals “good” thresholds**, and the project-specific test gates below release-blocking requirements. Automated scores support—but never replace—manual keyboard, screen-reader, responsive, and modal testing.

These criteria apply to the production build with a representative 500-Catalog-Product fixture, including missing optional facts, missing and broken Product Previews, every Rarity and Supported Binder Format, duplicate-card designs, zero-result filters, and direct product-route visits.

## 1. Accessibility conformance gate

A release candidate passes only when:

1. `/`, a representative canonical `/products/<slug>` route, the intercepted product modal, active-filter results, the zero-result state, the branded missing-preview state, and the branded 404 have no known WCAG 2.2 A or AA failures.
2. Automated accessibility tests report **zero violations** in those states and Next.js/ESLint reports no accessibility-rule errors.
3. Manual keyboard testing passes every scenario in section 2.
4. Manual screen-reader smoke tests pass with at least **NVDA + Chrome on Windows** and **VoiceOver + Safari on iOS or macOS**.
5. Lighthouse Accessibility scores **100** on `/` and one representative product route. This is a regression gate, not a claim that Lighthouse proves WCAG conformance.

WCAG 2.2 Level AA supplies the normative baseline. [W3C: Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/). Next.js includes a route announcer and `eslint-plugin-jsx-a11y`, but the application must still provide descriptive page titles and correct semantics. [Local Next.js 16 accessibility documentation](../../../node_modules/next/dist/docs/03-architecture/accessibility.md)

### Content and visual requirements

- Normal text and text embedded in controls has at least **4.5:1** contrast; large text has at least **3:1**; focus indicators, control boundaries, and meaningful non-text graphics have at least **3:1** against adjacent colors. Test the accepted dark theme rather than inferring contrast from a light palette. [WCAG 2.2: 1.4.3 Contrast (Minimum)](https://www.w3.org/TR/WCAG22/#contrast-minimum) and [1.4.11 Non-text Contrast](https://www.w3.org/TR/WCAG22/#non-text-contrast)
- At **200% browser zoom**, all content and controls remain available without clipping or overlap. At a **320 CSS-pixel viewport**, no two-dimensional page scrolling is required; an intentionally scrollable control group must have a visible affordance and must not hide options. [WCAG 2.2: 1.4.4 Resize Text](https://www.w3.org/TR/WCAG22/#resize-text) and [1.4.10 Reflow](https://www.w3.org/TR/WCAG22/#reflow)
- User text-spacing overrides from WCAG 1.4.12 do not clip, overlap, or hide content. [WCAG 2.2: 1.4.12 Text Spacing](https://www.w3.org/TR/WCAG22/#text-spacing)
- Color is never the only indication of selected filters, focus, errors, unavailable previews, or Rarity. Selected controls expose text and programmatic state.
- Every page has one descriptive `h1`, a unique descriptive document title, a `main` landmark, and a skip link that becomes visible on focus.
- Search, sort, price, Rarity, and Supported Binder Format controls have persistent visible labels. Related multi-select controls use `fieldset`/`legend` or an equivalent accessible group name.
- The results summary is a polite status message. A filter operation announces the final count once (for example, “17 Catalog Products”), not once per keystroke and not once per row. [WCAG 2.2: 4.1.3 Status Messages](https://www.w3.org/TR/WCAG22/#status-messages)
- Product rows are semantic links to canonical product paths. Their accessible names distinguish duplicate-card designs with Design Name where needed. Opening a link in a new tab renders the complete product page rather than requiring modal state.
- A usable Product Preview has concise alternative text that identifies it as the finished Product Preview and includes enough supplied facts to distinguish the Catalog Product. Repeated decorative thumbnails inside an already fully named link may use empty alt text. A missing or failed preview renders the branded placeholder with an accessible text equivalent; it never exposes a broken-image filename or raw URL.
- Interactive targets meet WCAG 2.2’s **24×24 CSS-pixel** AA minimum. Primary controls and icon-only controls use a project usability target of at least **44×44 CSS pixels**, with at least 8 CSS pixels between adjacent targets where practical. [WCAG 2.2: 2.5.8 Target Size (Minimum)](https://www.w3.org/TR/WCAG22/#target-size-minimum)
- Content remains understandable with CSS images disabled, Product Previews blocked, and the accepted dark-theme decorative effects absent.

## 2. Keyboard, focus, navigation, and modal gate

### Catalog and controls

- Every interactive element is reachable and operable with keyboard alone. Tab order follows the visible reading order; no positive `tabindex` is used.
- `Tab`/`Shift+Tab` traverse controls; `Space` toggles checkboxes; native arrow-key behavior is preserved for selects and grouped controls. Catalog shortcuts never intercept keys while an input, select, textarea, button, link, or editable element has focus.
- Every focused component has a persistent visible indicator. Focus is never fully hidden by the sticky header, filter panel, modal, or prototype-independent fixed UI. [WCAG 2.2: 2.4.7 Focus Visible](https://www.w3.org/TR/WCAG22/#focus-visible) and [2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum)
- Applying filters or sorting does not unexpectedly move keyboard focus. If the focused product disappears, focus moves to the results heading/status; otherwise it stays on the initiating control.
- Browser Back from an intercepted modal closes it and restores the Catalog shelf’s filter values, scroll position, and focus to the row/link that opened it. Forward reopens the same product. A direct visit to the canonical product route uses normal page navigation and has no modal focus trap.

### Intercepted product modal

The intercepted modal follows the WAI-ARIA Authoring Practices dialog pattern. [WAI-ARIA APG: Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

- The container has `role="dialog"`, `aria-modal="true"`, and an accessible name from its visible product heading. Background content is inert and excluded from assistive-technology interaction while open.
- Opening moves focus inside the dialog to a sensible first element. For long content, focus a static heading with `tabindex="-1"`; otherwise focus the visible Close button.
- `Tab` and `Shift+Tab` wrap inside the dialog. No background element can receive pointer or keyboard focus.
- `Escape`, the visible Close button, backdrop dismissal where enabled, and browser Back all close the modal. The Close control is at least 44×44 CSS pixels and has an explicit accessible name.
- Closing returns focus to the invoking product link unless that link no longer exists, in which case focus moves to the results heading.
- Copy-link success and failure are announced through one polite live region. Clipboard failure leaves the canonical URL visibly selectable and gives a recovery action.
- At 320 CSS pixels and 200% zoom, modal content remains reachable through one vertical scroll container; the Close control remains visible and does not cover the product heading.

### Motion and flashing

- Nonessential motion uses transform/opacity, completes within **400 ms**, and never blocks input. No content flashes more than three times per second.
- With `prefers-reduced-motion: reduce`, entrance, stagger, parallax, smooth-scroll, and modal transform animations are removed or reduced to a non-motion state change of at most 100 ms. Functionality and state feedback remain intact. [WCAG 2.2: 2.3.1 Three Flashes or Below Threshold](https://www.w3.org/TR/WCAG22/#three-flashes-or-below-threshold) and [2.3.3 Animation from Interactions](https://www.w3.org/TR/WCAG22/#animation-from-interactions)

## 3. Responsive and browser gate

The support floor is the unmodified Next.js 16 browser floor: **Chrome 111+, Edge 111+, Firefox 111+, and Safari 16.4+**. Code must not require newer features without an explicit polyfill or fallback. [Local Next.js 16 supported-browsers documentation](../../../node_modules/next/dist/docs/03-architecture/supported-browsers.md)

Acceptance testing covers:

- Automated functional tests in current Playwright Chromium, Firefox, and WebKit.
- Manual smoke tests in the current stable Chrome, Edge, Firefox, desktop Safari, iOS Safari, and Android Chrome available at release time.
- Viewports: **320×568**, **375×812**, **768×1024**, **1024×768**, and **1440×900** CSS pixels, plus 375×812 in landscape.
- Browser zoom at 100%, 200%, and keyboard-only use at 200%.
- `prefers-reduced-motion: reduce`; Windows forced-colors/high-contrast mode; and Product Preview requests blocked.

At every viewport:

- No page-level horizontal overflow, clipped text, overlapping controls, unreachable filter options, or content hidden behind the sticky header.
- Mobile shows search and the collapsible filter/sort panel before results; desktop shows the accepted persistent sidebar and Catalog shelf rows.
- Orientation changes preserve search/filter state and the selected product route.
- Touch scrolling remains vertical and does not conflict with horizontally scrollable controls.
- A 500-product result set, a one-product result, and a zero-product result all remain operable and visually stable.

## 4. Product Preview and image-loading gate

- Cloudinary is the only remote Product Preview origin. The configured cloud/account path is narrowly allowlisted; arbitrary remote URLs cannot enter the optimizer.
- Shelf thumbnails use a non-cropping Cloudinary transformation (`c_limit` or equivalent), automatic format and quality, and an accurate responsive `sizes` declaration. Supported browsers receive WebP or AVIF where Cloudinary negotiates it.
- Every image reserves its final layout space with intrinsic dimensions or a fixed aspect-ratio container. Loading, failure, placeholder replacement, filtering, and modal opening cause no visible layout jump.
- No more than one likely LCP image is eager/high-priority. Below-the-fold thumbnails are lazy; modal-size images are not requested until a product is opened. Next.js 16 defaults images to lazy loading, requires remote patterns, and requires width/height or `fill` for remote images. [Local Next.js 16 Image documentation](../../../node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md)
- With 500 matching fixtures and a cold cache, the initial unscrolled page requests **no more than 30 Product Preview thumbnails**, requests **zero modal-size transformations**, and never requests original full-resolution Cloudinary assets for shelf rows.
- At device-pixel ratio 1 or 2, the selected Cloudinary variant is no more than **1.5× wider** than rendered CSS width × device-pixel ratio. Thumbnail transfers have a **p95 ≤200 KB** and modal Product Preview transfers have a **p95 ≤600 KB** in the 500-record fixture.
- Opening a modal may replace the thumbnail with a larger non-cropped variant. That request begins only after activation and shows reserved space or the branded placeholder while loading.
- Missing, malformed, blocked, timed-out, and HTTP-error images all render the same branded placeholder without retries looping, broken-image UI, console errors, or loss of product facts.
- Image failure does not block searching, filtering, sorting, canonical navigation, or sharing.

## 5. Filtering and interaction responsiveness gate

Use a deterministic 500-Catalog-Product fixture and exercise worst cases: all products matching; zero matching; a search that changes on every keystroke; each multi-select filter; inclusive price boundaries; and each ascending/descending sort.

- From the input/change event to the next painted final result, search, filter, clear, and sort actions have **p95 ≤100 ms** under Chrome DevTools 4× CPU slowdown on the designated release-test workstation.
- No single search/filter/sort action creates a main-thread task longer than **50 ms**. If an implementation cannot meet this without windowing, deferral, or memoization, it must add the needed strategy without changing the accepted behavior.
- Typing never loses characters or focus. Controls remain responsive while results update.
- One action produces one final result-count announcement. Intermediate calculations are not announced.
- Filtering and sorting issue **no network request** and do not read Google Sheets, Cloudinary metadata, or a server API; they operate on the validated build-time snapshot already present in the page.
- Repeating a filter/sort sequence produces deterministic rows and prices according to [Define the Catalog Product content model](../issues/01-define-catalog-product-content-model.md).

The 100 ms interaction target is stricter than the 200 ms “good” INP boundary so local catalog work does not consume the whole interaction budget. [web.dev: Interaction to Next Paint](https://web.dev/articles/inp)

## 6. Page-performance gate

### Lab release gate

Run Lighthouse against a **production Vercel deployment**, not `next dev`, with a cold profile and the 500-product fixture. Test `/` and one representative `/products/<slug>` route with the Lighthouse mobile preset. Run three times and use the median.

Both routes must meet:

| Metric | Required |
| --- | ---: |
| Lighthouse Performance score | ≥90 |
| Largest Contentful Paint (LCP) | ≤2.5 s |
| Cumulative Layout Shift (CLS) | ≤0.10 |
| Total Blocking Time (TBT) | ≤200 ms |
| First Contentful Paint (FCP) | ≤1.8 s |
| Initial route JavaScript transfer, compressed | ≤200 KB |
| Initial HTML + CSS + JavaScript transfer, excluding images | ≤350 KB |
| Console errors and unexpected failed requests | 0 |

Performance and transfer budgets are project release gates. Lighthouse is a controlled lab signal and must be paired with field Core Web Vitals when traffic exists. Next.js recommends production builds, Lighthouse, Core Web Vitals reporting, careful Client Component boundaries, code splitting, and lazy loading. [Local Next.js 16 production checklist](../../../node_modules/next/dist/docs/01-app/02-guides/production-checklist.md) and [Local Next.js 16 lazy-loading guide](../../../node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md)

Additional pass/fail checks:

- `next build` identifies `/` and known product paths as prerendered/static. Browsers make no runtime request to Google Sheets or Apps Script.
- The complete initial Catalog shelf and essential product facts are present in prerendered HTML; JavaScript enhances search, filters, sort, intercepted modal navigation, and copy-link feedback.
- The modal/detail client code is route-split or lazy-loaded when doing so is necessary to meet the JavaScript budget.
- The production bundle contains no prototype switcher, losing variants, dummy data generator, development-only instrumentation, or unused UI dependency.
- A disabled-JavaScript smoke test can follow product links, read product facts, and navigate back to the catalog. Search/filter/sort may require JavaScript.

### Field gate after launch

Once enough real-user data exists, the 75th percentile of eligible page loads—reviewed separately for mobile and desktop—must remain in the Core Web Vitals “good” range:

- **LCP ≤2.5 seconds**
- **INP ≤200 milliseconds**
- **CLS ≤0.10**

These are Google’s published “good” thresholds and are evaluated at the 75th percentile. [web.dev: Web Vitals](https://web.dev/articles/vitals)

A regression outside a good threshold creates a release-blocking defect for the next deployment unless the owner records an explicit exception with evidence, scope, and a remediation date.

## 7. Required evidence in the implementation handoff

The implementation is not accepted from an assertion alone. Attach:

- Automated accessibility and keyboard/modal test results for every named state.
- The completed manual keyboard and screen-reader checklist, including browser/assistive-technology versions.
- Responsive screenshots at the five named viewport sizes, plus mobile landscape and 200% zoom.
- A Network trace showing initial thumbnail count, no eager modal images, Cloudinary transformations, formats, and transfer sizes.
- The 500-record interaction benchmark with p95 update time and longest task.
- Three Lighthouse reports per tested route and a bundle/transfer budget report.
- After launch, the selected field-performance dashboard and ownership/runbook for threshold regressions.
