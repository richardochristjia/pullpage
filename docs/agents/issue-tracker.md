# Issue tracker: GitHub Issues

GitHub Issues in the repository configured as `origin` are the system of record for specs (PRDs), implementation tickets, research, decisions, and discussion. Do **not** write skill output to `.scratch/` or another local planning directory.

## Prerequisites

Use the GitHub CLI (`gh`). Before publishing or changing workflow state, verify access:

```sh
gh auth status
gh repo view --json nameWithOwner,url
```

If `gh` is unavailable or unauthenticated, stop and ask the user to install it or run `gh auth login`. Do not silently fall back to local files. Infer the repository from the current checkout; do not hard-code an owner or repository.

## Labels

Create a missing label before first use with `gh label create <name> --description <text> --color <hex>`. Reuse these labels:

- `kind:prd` — feature spec / PRD
- `kind:task` — implementation ticket
- `kind:research`, `kind:prototype`, `kind:grilling` — discovery ticket types
- `effort:<slug>` — groups a PRD, its tickets, and wayfinding work
- `status:claimed` — an open ticket currently being worked

GitHub's open/closed state is the source of truth for open/resolved. Do not add redundant `status:open` or `status:resolved` labels.

## Publishing skill results

When a skill says **publish to the issue tracker**, create a GitHub issue with the complete Markdown result in its body and return the issue number and URL.

### Specs / PRDs

Create one issue labeled `kind:prd` and `effort:<slug>`:

```sh
gh issue create \
  --title "PRD: <feature name>" \
  --label "kind:prd,effort:<slug>" \
  --body-file <temporary-file>
```

The temporary file is only transport for `gh`; delete it immediately after the command. Prefer piping a quoted heredoc to `gh issue create --body-file -` where shell support is reliable.

### Implementation tickets

Create one GitHub issue per ticket—never one combined tickets issue. Label each `kind:task` and `effort:<slug>`. Include this near the top of every ticket body:

```md
Parent PRD: #<prd-number>
```

After creating all tickets, edit the PRD body to add an `## Implementation tickets` task list containing `- [ ] #<issue-number>` entries. GitHub updates linked task-list progress as tickets close.

Use `gh issue create --body-file ...` and `gh issue edit <number> --body-file ...`; never construct Markdown bodies with unsafe shell interpolation.

## Fetching and updating

When a skill says **fetch the relevant ticket**, accept an issue number or GitHub issue URL and read it with:

```sh
gh issue view <number-or-url> --comments
```

Use `gh issue list --label "effort:<slug>" --state all` to discover related work. Put conversation and incremental findings in comments:

```sh
gh issue comment <number> --body-file <temporary-file>
```

Edit the issue body only when maintaining the canonical spec, acceptance criteria, dependency metadata, or task list. Close completed work with `gh issue close <number> --comment "<completion summary>"`; reopen with `gh issue reopen <number>`.

## Wayfinding operations

A wayfinding **map** is the issue labeled `kind:prd` and `effort:<slug>`. Its body contains `## Notes`, `## Decisions so far`, and `## Fog`. Each child question is a separate issue with one of `kind:research`, `kind:prototype`, `kind:grilling`, or `kind:task`, plus the same effort label.

- **Dependency:** Put `Blocked by: #NN, #NN` near the top of a child issue body.
- **Frontier:** List open issues with the effort label. Exclude issues carrying `status:claimed` and any issue whose `Blocked by` references remain open. Lowest issue number wins.
- **Claim:** Assign the issue to yourself and add `status:claimed` before doing work: `gh issue edit <number> --add-assignee @me --add-label status:claimed`.
- **Resolve:** Add the answer as an issue comment, remove `status:claimed`, and close the issue. Then add a concise decision and issue link to the map's `## Decisions so far` section.
- **Release:** If abandoning a claim, remove the assignee and `status:claimed` label without closing the issue.

Always save state-changing commands before beginning substantive work so another agent can observe the claim.

## Failure and safety rules

- Never create local substitutes when GitHub access fails.
- Before creating an issue, search open and closed issues for the same effort/title to avoid duplicates.
- Preserve issue URLs in summaries and handoffs.
- Do not delete historical issue comments; supersede outdated decisions with a new comment and update the canonical body.
- Existing `.scratch/` files are legacy data only. Do not update or treat them as current. Migrate only unresolved tickets (`Status: open` or `Status: claimed`) to GitHub; do not publish resolved tickets or legacy specs/maps. Delete the legacy files only after every unresolved ticket has been published successfully.
