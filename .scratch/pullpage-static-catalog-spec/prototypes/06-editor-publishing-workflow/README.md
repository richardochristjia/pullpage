# PROTOTYPE — direct editor publishing workflow

This throwaway logic prototype reflects the chosen simple workflow: **no separate customer-facing preview deployment**. A non-developer validates Draft Products, confirms Publish, waits for Vercel, and smoke-tests the live catalog.

It performs no Google Sheets, Cloudinary, or Vercel calls and stores nothing.

## Run

```sh
node .scratch/pullpage-static-catalog-spec/prototypes/06-editor-publishing-workflow/prototype.mjs
```

## Final workflow under test

1. Edit **Draft Products**. Cloudinary links can be opened while editing; missing or unavailable Product Previews become validation warnings and use the Pullpage placeholder.
2. Choose **Pullpage → Validate draft**. Blocking errors identify every affected cell. Nothing else changes.
3. Choose **Pullpage → Publish**. The confirmation summarizes Catalog Product count and repeats warnings.
4. On confirmation, Apps Script copies the exact validated snapshot to protected **Published Products**, waits for its publication ID to appear in public CSV, and queues the production Deploy Hook.
5. The editor follows the Vercel deployment link. A failed build leaves the previous catalog live.
6. When Ready, the editor immediately smoke-tests catalog load, one search/filter, and one shared product URL.
7. If the smoke test fails, restore the previous Vercel deployment, then correct Draft Products and repeat. If it passes, the Publish Log records completion.

Any Draft edit after validation invalidates that validation and disables Publish. There is no Preview Products worksheet, preview Deploy Hook, staging approval, or custom preview UI.

## Suggested walkthroughs

- Happy path: `e → v → p → y → s`
- Changed after validation: `v → e → p`
- Validation failure: `x → p`
- Non-blocking image warning: `w → p → y → s`
- Failed production build: `v → p → f → t`
- Bad successful publication: `v → p → y → b → k`
