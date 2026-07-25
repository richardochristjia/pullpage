# Select the non-developer publishing architecture

Type: research
Status: resolved
Blocked by:

## Question

Which architecture should let a non-developer maintain Catalog Products in a Google Sheets-like interface and independently publish a validated static Next.js catalog through Vercel, with minimal cost and operational complexity?

## Answer

Use a private **Draft Products** worksheet, a script-protected **Published Products** worksheet published as CSV, a bound Google Apps Script **Validate draft / Publish** menu, and a secret Vercel Deploy Hook. The Next.js build reads only the published snapshot, validates it authoritatively, and prerenders the catalog; browsers never query Google Sheets.

Publishing must be explicit and fail closed: Apps Script reports cell-addressed validation errors, takes a document lock, changes no published data on validation failure, writes a generated publication ID with the validated snapshot, waits until that ID is visible through the public CSV endpoint, and only then queues Vercel. The editor confirms the queued deployment reaches Ready in Vercel. Build failure leaves the last successful production deployment in place; content mistakes use Vercel rollback followed by correction and republishing.

Only trusted publishers may edit the workbook/script. Keep the Deploy Hook URL in Apps Script project properties, protect Published Products from manual edits, keep Draft Products unpublished, and require business-controlled ownership plus a concise publish/recovery runbook.

This avoids a custom admin, database, CMS, Google service account, GitHub write token, and runtime catalog dependency while preserving a real Draft → Published boundary. Accepted trade-offs are Google publication lag (mitigated by publication-ID polling), validators in Apps Script and TypeScript (mitigated by one contract and shared fixtures), and manual deployment-status confirmation in Vercel (chosen over another API credential).

Research and source citations: [Non-developer catalog publishing architecture](../research/03-non-developer-publishing-architecture.md).
