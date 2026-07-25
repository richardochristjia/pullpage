// PROTOTYPE — throwaway workflow logic for issue 06.
// Question: can a non-developer safely publish a validated Draft directly,
// without a separate customer-facing preview deployment?

export function createInitialState() {
  return {
    draft: { revision: 1, fingerprint: "draft-r1", dirty: true },
    validation: { status: "not-run", revision: null, errors: [], warnings: [] },
    publication: { snapshot: null, deployment: "none" },
    production: {
      current: { publicationId: "pub-existing", fingerprint: "existing-live" },
      previous: null,
      awaitingSmokeTest: false,
      rollbackRequired: false,
    },
    counters: { publication: 0 },
    message: "Edit Draft Products, then validate it.",
    history: ["Started with an existing production catalog."],
  }
}

function record(state, message) {
  return { ...state, message, history: [...state.history, message].slice(-6) }
}

function reject(state, message) {
  return record(state, `BLOCKED: ${message}`)
}

function validationMatchesDraft(state) {
  return state.validation.status === "valid" && state.validation.revision === state.draft.revision
}

export function allowedActions(state) {
  const actions = ["edit", "validate-pass", "validate-warning", "validate-fail"]
  if (validationMatchesDraft(state)) actions.push("publish")
  if (state.publication.deployment === "queued") actions.push("production-ready", "deployment-fail")
  if (state.publication.deployment === "failed") actions.push("retry")
  if (state.production.awaitingSmokeTest) actions.push("smoke-pass", "smoke-fail")
  if (state.production.rollbackRequired) actions.push("rollback")
  return [...new Set(actions)]
}

export function transition(state, action) {
  switch (action.type) {
    case "edit": {
      const revision = state.draft.revision + 1
      return record(
        {
          ...state,
          draft: { revision, fingerprint: `draft-r${revision}`, dirty: true },
          validation: { status: "not-run", revision: null, errors: [], warnings: [] },
        },
        "Draft changed. Previous validation is invalid; Published Products and live production are unchanged.",
      )
    }

    case "validate-pass":
      return record(
        {
          ...state,
          draft: { ...state.draft, dirty: false },
          validation: { status: "valid", revision: state.draft.revision, errors: [], warnings: [] },
        },
        "Validation passed. Publish can show its final confirmation and proceed.",
      )

    case "validate-warning":
      return record(
        {
          ...state,
          draft: { ...state.draft, dirty: false },
          validation: {
            status: "valid",
            revision: state.draft.revision,
            errors: [],
            warnings: ["One Product Preview is unavailable; Pullpage placeholder will be shown."],
          },
        },
        "Validation passed with a non-blocking warning. Publish confirmation must repeat the warning.",
      )

    case "validate-fail":
      return record(
        {
          ...state,
          validation: {
            status: "invalid",
            revision: state.draft.revision,
            errors: [
              "Draft Products!I12: Format Code ALL requires Toploader Price.",
              "Draft Products!L18: Product Preview rights status is not approved.",
            ],
            warnings: [],
          },
        },
        "Validation failed. Nothing was copied to Published Products and no deployment was queued.",
      )

    case "publish": {
      if (!validationMatchesDraft(state)) {
        return reject(state, "Validate the current Draft before publishing.")
      }
      const publicationNumber = state.counters.publication + 1
      const snapshot = {
        publicationId: `pub-${publicationNumber}`,
        fingerprint: state.draft.fingerprint,
        sourceRevision: state.draft.revision,
      }
      return record(
        {
          ...state,
          publication: { snapshot, deployment: "queued" },
          counters: { publication: publicationNumber },
        },
        "Publish confirmed: the validated snapshot was copied to protected Published Products and Vercel production was queued.",
      )
    }

    case "production-ready": {
      if (state.publication.deployment !== "queued") {
        return reject(state, "No production deployment is waiting to become Ready.")
      }
      return record(
        {
          ...state,
          publication: { ...state.publication, deployment: "ready-awaiting-smoke" },
          production: {
            current: state.publication.snapshot,
            previous: state.production.current,
            awaitingSmokeTest: true,
            rollbackRequired: false,
          },
        },
        "Production is Ready and live. Run the short customer-facing smoke test immediately.",
      )
    }

    case "deployment-fail":
      if (state.publication.deployment !== "queued") {
        return reject(state, "There is no queued deployment to fail.")
      }
      return record(
        { ...state, publication: { ...state.publication, deployment: "failed" } },
        "Production deployment failed. The previous catalog remains live; inspect the Vercel log, then retry or edit Draft.",
      )

    case "retry":
      if (state.publication.deployment !== "failed") {
        return reject(state, "No failed publication is available to retry.")
      }
      return record(
        { ...state, publication: { ...state.publication, deployment: "queued" } },
        "The unchanged Published snapshot was queued again; previous production remains live meanwhile.",
      )

    case "smoke-pass":
      if (!state.production.awaitingSmokeTest) {
        return reject(state, "No newly live deployment is awaiting a smoke test.")
      }
      return record(
        {
          ...state,
          publication: { ...state.publication, deployment: "live" },
          production: { ...state.production, awaitingSmokeTest: false, rollbackRequired: false },
        },
        "Publish complete. The publication ID, editor, row count, and deployment URL are recorded in Publish Log.",
      )

    case "smoke-fail":
      if (!state.production.awaitingSmokeTest) {
        return reject(state, "No newly live deployment is awaiting a smoke test.")
      }
      return record(
        {
          ...state,
          production: { ...state.production, awaitingSmokeTest: false, rollbackRequired: true },
        },
        "Smoke test failed. Roll back to the previous production deployment before correcting Draft.",
      )

    case "rollback":
      if (!state.production.rollbackRequired || !state.production.previous) {
        return reject(state, "No rollback is required or no previous deployment is available.")
      }
      return record(
        {
          ...state,
          publication: { ...state.publication, deployment: "rolled-back" },
          production: {
            current: state.production.previous,
            previous: null,
            awaitingSmokeTest: false,
            rollbackRequired: false,
          },
        },
        "Rollback complete. The previous catalog is live; correct Draft, validate, and publish again.",
      )

    default:
      return reject(state, `Unknown action ${action.type}.`)
  }
}
