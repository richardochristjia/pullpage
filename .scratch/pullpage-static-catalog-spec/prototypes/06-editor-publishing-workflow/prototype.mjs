// PROTOTYPE — throwaway terminal shell. No Google Sheets, Cloudinary, or Vercel calls.
import readline from "node:readline"
import { allowedActions, createInitialState, transition } from "./workflow-machine.mjs"

const bold = "\x1b[1m"
const dim = "\x1b[2m"
const reset = "\x1b[0m"

const commands = {
  e: ["edit", "edit Draft"],
  v: ["validate-pass", "validation passes"],
  w: ["validate-warning", "validation passes with warning"],
  x: ["validate-fail", "validation fails"],
  p: ["publish", "confirm and publish"],
  y: ["production-ready", "production becomes Ready"],
  f: ["deployment-fail", "queued deployment fails"],
  t: ["retry", "retry failed deployment"],
  s: ["smoke-pass", "production smoke test passes"],
  b: ["smoke-fail", "production smoke test fails"],
  k: ["rollback", "complete rollback"],
}

let state = createInitialState()
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function value(input) {
  if (input === null || input === undefined) return "—"
  if (typeof input === "object") return JSON.stringify(input)
  return String(input)
}

function render() {
  console.clear()
  const allowed = allowedActions(state)
  console.log(`${bold}PROTOTYPE — Pullpage direct publishing workflow${reset}`)
  console.log(`${dim}No separate preview deployment: validate, confirm Publish, then smoke-test production.${reset}\n`)

  console.log(`${bold}Draft${reset}`)
  console.log(`  revision:          ${value(state.draft.revision)}`)
  console.log(`  fingerprint:       ${value(state.draft.fingerprint)}`)
  console.log(`  validation:        ${value(state.validation.status)}`)
  console.log(`  validationRevision:${value(state.validation.revision)}`)
  console.log(`  errors:            ${value(state.validation.errors)}`)
  console.log(`  warnings:          ${value(state.validation.warnings)}`)

  console.log(`\n${bold}Published / production${reset}`)
  console.log(`  snapshot:          ${value(state.publication.snapshot)}`)
  console.log(`  deployment:        ${value(state.publication.deployment)}`)
  console.log(`  live:              ${value(state.production.current)}`)
  console.log(`  previous:          ${value(state.production.previous)}`)
  console.log(`  awaitingSmokeTest: ${value(state.production.awaitingSmokeTest)}`)
  console.log(`  rollbackRequired:  ${value(state.production.rollbackRequired)}`)

  console.log(`\n${bold}Last outcome${reset}`)
  console.log(`  ${state.message}`)
  console.log(`\n${bold}Recent events${reset}`)
  for (const event of state.history) console.log(`  - ${event}`)

  console.log(`\n${bold}Actions${reset} ${dim}(✓ currently valid; blocked actions can still be tried)${reset}`)
  for (const [key, [action, label]] of Object.entries(commands)) {
    const marker = allowed.includes(action) ? "✓" : "·"
    console.log(`  ${marker} ${bold}[${key}]${reset} ${label}`)
  }
  console.log(`  ${bold}[q]${reset} quit`)
}

function prompt() {
  render()
  rl.question("\nChoose action: ", (key) => {
    const normalized = key.trim().toLowerCase()
    if (normalized === "q") {
      rl.close()
      return
    }
    const command = commands[normalized]
    state = command
      ? transition(state, { type: command[0] })
      : transition(state, { type: `unknown-key-${normalized || "blank"}` })
    prompt()
  })
}

rl.on("close", () => console.log("\nPrototype closed; no external data was changed."))
prompt()
