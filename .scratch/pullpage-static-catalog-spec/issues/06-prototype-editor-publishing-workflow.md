# Prototype the editor publishing workflow

Type: prototype
Status: resolved
Blocked by: 01, 02, 03

## Question

Given the selected content, image-hosting, and publishing architecture, what concrete editing, validation, preview, publish, success, and failure-recovery workflow can a non-developer operate independently?

## Answer

Use a direct **Edit → Validate → Publish → Verify** workflow. The prototype initially tested a separate customer-facing Vercel Preview, but the operator rejected that extra stage: “just publish would do.” There is no Preview Products worksheet, preview Deploy Hook, staging approval, or custom preview UI. This accepts that full customer-layout review happens immediately after production becomes Ready, protected by the previous Vercel deployment and rollback.

### Editor setup

A trusted publisher needs:

- edit access to the private Google workbook and permission to run its bound Apps Script;
- Cloudinary Media Library access sufficient to upload/replace Product Previews and copy immutable versioned HTTPS delivery URLs;
- read access to Pullpage’s Vercel deployments plus permission/instructions to invoke rollback;
- an **Instructions** worksheet containing field definitions, examples, the Rarity order, Cloudinary steps, and this recovery flow.

Protected fields/worksheets prevent manual Slug and Published Products edits. Product Preview rights evidence lives in a separate register keyed by the preview URL/Cloudinary asset reference; a nonblank preview may publish only when its rights status is approved and current.

### Edit and validate

1. The publisher edits **Draft Products**, uploads Product Previews to Cloudinary as needed, and pastes immutable versioned URLs. Opening a Cloudinary link is the only prepublication image check; there is no catalog preview.
2. **Pullpage → Validate draft** validates a consistent snapshot of all rows and writes a **Validation Results** worksheet with severity, cell link, message, and corrective guidance.
3. Blocking errors include invalid required/controlled values, duplicate Slugs, duplicate-card Design Name failures, invalid required prices, malformed/non-HTTPS/non-allowlisted Product Preview URLs, and unapproved/expired Product Preview rights. No snapshot or deployment changes when any error exists.
4. A blank Product Preview URL or a valid allowlisted Cloudinary URL that is temporarily unreachable produces a non-blocking warning and uses the Pullpage placeholder. Warnings must identify affected cells.
5. A successful validation reports Catalog Product count, warning count, and a Draft fingerprint. Any subsequent Draft edit invalidates that result.

### Publish

1. The publisher chooses **Pullpage → Publish**. Publish reacquires the document lock and reruns validation rather than trusting an earlier result.
2. A confirmation names the Catalog Product count, repeats every warning, and states that the production deployment will start. Cancel changes nothing.
3. On confirmation, Apps Script persists missing protected Slugs, writes the exact canonical validated snapshot plus a unique publication ID to protected **Published Products**, flushes it, and waits until that publication ID is visible in its public CSV.
4. Apps Script then calls the secret production Deploy Hook and displays the queued deployment identifier plus a direct Vercel link. “Queued” must never be presented as “live.”
5. A **Publish Log** records timestamp, editor, publication ID, Draft fingerprint, row/warning counts, hook/deployment identifier, and latest known outcome.

### Verify and recover

- **Deployment Ready:** the publisher opens production and checks catalog load, one search/filter combination, one Product Preview/placeholder, and one shared product URL. Passing completes the log entry.
- **Validation failure:** fix linked Draft cells and publish again; Published Products and production remain unchanged.
- **Published-CSV synchronization or hook failure:** production remains unchanged; preserve the error and retry Publish after checking the publication setting/hook. The runbook must warn against unrelated production code deployment while Published Products is ahead of live production.
- **Build failure:** the previous successful Vercel production deployment remains live. Inspect the build log; retry the unchanged publication for a transient failure, otherwise correct Draft and republish.
- **Bad successful publication:** immediately roll back to the previous Vercel deployment, then correct Draft and republish. Do not attempt to repair protected Published Products manually.
- **Compromised Deploy Hook:** replace it, update the Apps Script project property, and delete the old hook.

The workflow is independently operable after one-time setup, with two unavoidable external handoffs made explicit: Cloudinary supplies Product Preview URLs, and Vercel—not Apps Script’s hook response—confirms whether production is Ready.

Prototype asset and walkthroughs: [Direct editor publishing workflow](../prototypes/06-editor-publishing-workflow/README.md).
