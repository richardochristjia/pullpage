# Non-developer catalog publishing architecture

## Recommendation

Use **Google Sheets as the private authoring workspace, a separately published and script-protected worksheet as the release snapshot, a bound Google Apps Script as the publish control, and a Vercel Deploy Hook as the build trigger**.

The Next.js build must read only the published snapshot, validate it again, and prerender the catalog. It must never read the editable draft worksheet at runtime.

This is the smallest architecture that provides all of the required boundaries:

- a familiar spreadsheet editor;
- an explicit Draft → Published transition;
- validation before publication;
- a static catalog that does not depend on Google Sheets at request time;
- no custom admin application, database, paid CMS, Google Cloud service account, or GitHub write token;
- a failed publication cannot replace the last successful Vercel production deployment.

## Architecture

```text
Trusted editor
    |
    v
Private Google Sheet: Draft worksheet
    |
    | Pullpage > Validate draft / Publish
    v
Bound Apps Script
    |-- validates every row and reports cell-addressed errors
    |-- takes a document lock
    |-- replaces protected Published worksheet with canonical rows
    |-- waits until the published CSV exposes the new publication ID
    `-- POSTs the secret Vercel Deploy Hook
              |
              v
        Vercel Next.js build
              |-- fetches Published CSV only
              |-- performs authoritative schema validation again
              `-- prerenders static catalog routes/assets
                         |
                         v
                 Production alias on success
```

### Workbook layout

Use one workbook with at least these worksheets:

1. **Draft Products** — private and editable by the catalog editor.
2. **Published Products** — protected against manual edits and published to the web as CSV. Only the script writes it.
3. **Instructions** — column meanings, examples, publish steps, and recovery steps.

Only **Published Products** is published to the web. Publishing an individual worksheet avoids exposing the Draft Products worksheet while still allowing an unauthenticated Vercel build to fetch public catalog records. Google warns that a published file is visible on the web and that updates can take a few minutes, so the source must contain no secrets and the script must not trigger Vercel until it can fetch the new publication ID from the public CSV endpoint.[1]

The published snapshot should contain a generated `publication_id` (for example, an ISO timestamp plus random suffix). The build should log this ID. This makes stale Google publication caches and production provenance observable.

### Publish control

A spreadsheet-bound Apps Script adds a **Pullpage** custom menu.[2] It should provide:

- **Validate draft** — read-only; reports every detected error.
- **Publish** — validates, updates the release snapshot, confirms the snapshot is publicly readable, then invokes the Deploy Hook.

The Publish action must:

1. Acquire an Apps Script document lock so two editors cannot publish concurrently.[3]
2. Read all Draft Products rows in one batch.
3. Normalize only unambiguous representation details, such as trimming surrounding whitespace. It must not invent missing business values.
4. Validate all rows and return all failures with worksheet cell/range references.
5. Make no change to Published Products when validation fails.
6. Replace Published Products, call `SpreadsheetApp.flush()`, and poll its published CSV with a cache-busting query until the expected `publication_id` is visible or a short timeout is reached.
7. POST the Vercel Deploy Hook using `UrlFetchApp`.[4][5]
8. Show the editor the queued deployment identifier and a link to the Vercel project’s Deployments page.

Store the Deploy Hook URL in Apps Script project properties, never in a cell or source-controlled file. Treat it as a secret: Vercel states that anyone with the URL can trigger a deployment.[5] Only trusted catalog publishers should be spreadsheet/script editors.

The script should not claim that the catalog is live merely because the hook accepted the request. The hook queues a deployment; the editor confirms success in Vercel. Avoid adding Vercel API polling and another API credential initially. It adds operational and credential complexity without changing the safety boundary.

## Validation responsibility

Validation has two layers with different purposes:

- **Apps Script validation is editorial feedback.** It prevents predictable mistakes and reports them in spreadsheet language, including row and cell locations.
- **Build validation is authoritative.** The Next.js build validates the complete fetched snapshot before rendering. Any failure exits the build non-zero.

Both layers must cover the same catalog contract, including required identifiers, controlled Rarity values, unique product identity, URL syntax, integer IDR prices, and at least one valid Format Option. The implementation specification should define shared acceptance fixtures (valid and invalid CSV examples) that both validators must pass; this limits drift even though Apps Script and TypeScript cannot directly share runtime code.

Do not silently skip invalid rows. A partially published catalog is harder for an editor to detect than a rejected publication.

## Static Next.js behavior

Catalog data is fetched only during `next build`; browsers never query Google Sheets. Next.js documents that Server Components used by a static export execute at build time and that their output becomes static HTML and navigation payloads.[6]

The architecture does **not** require setting `output: 'export'` merely to obtain static catalog pages on Vercel. Use the normal Vercel Next.js deployment unless the implementation specification independently requires a portable static export. A full static export excludes default `next/image` optimization, ISR, and several server features; external Product Preview images would require a custom image loader.[6][7]

Every build must:

1. Fetch Published Products with a bounded timeout and no fallback to Draft Products.
2. Reject non-2xx responses, malformed CSV, duplicate headers, unknown required schema versions, and invalid records.
3. Log the `publication_id`, row count, and validation summary without logging the Deploy Hook URL.
4. Generate all shareable catalog/product routes required by the final specification.
5. Fail rather than deploy stale bundled sample data when the source is unavailable.

## Permissions and ownership

- A business-controlled Google account owns the workbook and bound Apps Script.
- Catalog maintainers receive edit access to Draft Products and permission to run the bound script.
- Published Products is protected from direct edits.
- A business-controlled Vercel account owns the project and Deploy Hook.
- Publishers receive enough Vercel access to inspect deployments, but do not need source-code access to edit or publish catalog data.
- At least two business-controlled maintainers should be documented so publishing does not depend on one personal account.

Apps Script executions and URL Fetch are quota-limited; Google publishes current quotas and notes that limits can change.[8] A manual workflow for roughly 100–500 products is far below normal per-user URL Fetch quotas, but the runbook should identify quota errors as a possible failure mode.

## Failure and recovery contract

| Failure | Editor-visible outcome | Production outcome | Recovery |
|---|---|---|---|
| Draft validation fails | All errors with cells; no deploy queued | Unchanged | Correct Draft Products, validate, publish again |
| Published CSV has not refreshed by timeout | Publish reports source-sync failure; no deploy queued | Unchanged | Wait and publish again; check Google publishing setting |
| Deploy Hook request fails | HTTP/error message; no successful queue confirmation | Unchanged | Check connectivity/hook; retry |
| Next.js build validation/build fails | Failed deployment in Vercel | Last successful production deployment remains served | Inspect build log, correct draft or implementation, publish/deploy again |
| Valid deployment has incorrect content | Deployment succeeds but content review fails | New production is visible | Use Vercel instant rollback, correct Draft Products, then republish[9] |
| Deploy Hook is exposed | Unexpected builds may be triggered | Data cannot be edited through the hook alone | Create a new hook, replace the script property, delete the old hook |

The Apps Script should record a compact **Publish Log** (timestamp, editor, publication ID, row count, hook response/deployment ID, outcome). Do not duplicate all Catalog Product data into the log; Google Sheets version history and Vercel deployments provide the detailed history.

## Operating guidance required by the final specification

The handoff specification should require a short editor runbook covering:

1. Edit Draft Products only.
2. Run Validate draft and resolve every reported error.
3. Run Publish once.
4. Record the publication ID shown by the script.
5. Open the linked Vercel deployment and wait for Ready.
6. Smoke-test catalog load, one search/filter combination, and one shared product URL.
7. On failure, leave the last production deployment in place, correct the error, and republish; on bad successful content, roll back first.
8. Rotate the Deploy Hook immediately if its URL is disclosed.

## Alternatives considered

| Candidate | Advantages | Why not selected |
|---|---|---|
| Fetch the editable Sheet in the browser | Almost no publishing code | Not a static catalog; edits and invalid rows become live without a controlled release; public experience depends on Google at request time |
| Fetch editable Sheet only during Vercel builds | Simple | Any unrelated code deployment can accidentally publish unfinished draft edits; no durable Draft/Published boundary |
| Google Sheets API + service account + Deploy Hook | Private source and fresher reads | Adds Google Cloud project/API/service-account credentials even though every source record may be public |
| Apps Script commits generated JSON to GitHub | Immutable, auditable data snapshots and deterministic builds | Adds a repository write credential, commit-conflict/branch-protection handling, and Git recovery operations for a small catalog |
| Headless CMS | Strong validation and publishing workflows | Conflicts with the preferred Sheets-like interface; introduces another product, permissions model, and likely cost |
| ISR or runtime database | Content can update without a deployment | Adds runtime state and invalidation behavior that the static, explicit-publish requirement does not need; Next.js also documents that ISR is incompatible with a static export[7] |

## Cost and complexity conclusion

This choice adds no new paid content platform. Its recurring components are the already selected Google workspace/account, Apps Script, Google’s published CSV, the existing Vercel project, and one Deploy Hook. Vercel plan selection must still comply with Vercel’s current usage and commercial terms; do not assume the Hobby plan is appropriate merely because the technical workload is small.[10]

The main accepted trade-offs are:

- Google’s public-sheet refresh can lag, mitigated by publication-ID polling before deployment.
- Editorial and build validators are implemented in two runtimes, mitigated by one written contract and shared fixtures.
- Final deployment status is checked in Vercel rather than polled by Apps Script, avoiding another stored credential.

At Pullpage’s 100-product starting scale and 500-product ceiling, these are smaller operational risks than introducing a CMS, database, service account, or repository-writing automation.

## Primary sources

1. Google Docs Editors Help, **Make Google Docs, Sheets, Slides & Forms public**: https://support.google.com/docs/answer/183965
2. Google Apps Script, **Custom Menus in Google Workspace**: https://developers.google.com/apps-script/guides/menus
3. Google Apps Script, **Lock Service**: https://developers.google.com/apps-script/reference/lock
4. Google Apps Script, **URL Fetch Service**: https://developers.google.com/apps-script/reference/url-fetch
5. Vercel, **Deploy Hooks**: https://vercel.com/docs/deployments/deploy-hooks
6. Next.js 16.2.10 local documentation, **Static Exports**: `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` (online equivalent: https://nextjs.org/docs/app/guides/static-exports)
7. Next.js 16.2.10 local documentation, **Incremental Static Regeneration**: `node_modules/next/dist/docs/01-app/02-guides/incremental-static-regeneration.md` (online equivalent: https://nextjs.org/docs/app/guides/incremental-static-regeneration)
8. Google Apps Script, **Quotas for Google Services**: https://developers.google.com/apps-script/guides/services/quotas
9. Vercel, **Instant Rollback**: https://vercel.com/docs/deployments/instant-rollback
10. Vercel, **Fair Use Guidelines**: https://vercel.com/docs/limits/fair-use-guidelines
