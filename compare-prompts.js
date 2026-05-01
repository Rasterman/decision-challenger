import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, readFileSync } from 'fs'
import { basename, extname, dirname, join } from 'path'
import { buildSystemPrompt, buildChallengeMessage, buildConfirmAssumptionsMessage } from './src/lib/prompts.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const STAKES = process.env.STAKES ?? 'medium'
const MODEL = 'claude-sonnet-4-6'

// ─── Document loading ─────────────────────────────────────────────────────────

function stripRtf(rtf) {
  // Remove RTF control words, groups, and binary data; collapse whitespace
  return rtf
    .replace(/\{\\[^{}]+\}/g, '')      // remove nested control groups
    .replace(/\\[a-z]+[-\d]* ?/gi, '') // remove control words
    .replace(/[{}\\]/g, '')            // remove remaining braces and backslashes
    .replace(/\r?\n+/g, '\n')
    .trim()
}

function loadDocument(filePath) {
  const raw = readFileSync(filePath, 'utf8')
  if (filePath.endsWith('.rtf')) return stripRtf(raw)
  return raw
}

const customFile = process.argv[2]
const documentTitle = customFile ? basename(customFile) : 'Launch Self-Serve API Keys for Enterprise Customers'
const OUT = customFile
  ? join(dirname(customFile), `${basename(customFile, extname(customFile))}-comparison.json`)
  : './docs/comparison.json'
const PROPOSAL = customFile ? loadDocument(customFile) : `
# Proposal: Launch Self-Serve API Keys for Enterprise Customers

## Background
Currently, enterprise API access requires a manual provisioning step by our solutions team,
which takes 3–5 business days and creates a bottleneck during onboarding. Sales has flagged
this as a reason we lost two deals last quarter.

## Proposal
Ship a self-serve API key management portal for enterprise customers by end of Q2.
Customers will be able to create, rotate, and revoke API keys without contacting support.
We estimate this will reduce onboarding time from 5 days to under 1 hour.

## Scope
- API key CRUD UI embedded in the existing customer dashboard
- Key scoping by resource type (read-only, write, admin)
- Audit log of key creation and revocation events
- Automated email alerts on key usage anomalies

## Technical Approach
The auth layer already supports scoped tokens; we just need a UI and a thin management API
on top. Engineering estimates 3 weeks of work with two engineers.

## Success Metrics
- Onboarding time p50 drops below 1 hour within 60 days of launch
- Zero manual provisioning tickets from enterprise accounts post-launch
- NPS among enterprise accounts improves by 10 points within one quarter

## Risks
We acknowledge there is some risk around key misuse if customers share credentials, but
we believe standard rotation reminders will mitigate this adequately.
`

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Note: PROPOSAL is either loaded from the CLI file arg or the default above

const client = new Anthropic()

function parseJSON(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return { parse_error: true, raw }
  }
}

async function complete({ system, messages }) {
  const params = { model: MODEL, max_tokens: 2048, messages }
  if (system) params.system = system
  const response = await client.messages.create(params)
  return response.content[0].text
}

// ─── Condition 1: Raw Claude, no system prompt ────────────────────────────────

async function runRaw() {
  console.log('  Running condition 1: raw Claude...')
  const text = await complete({
    messages: [{ role: 'user', content: `Here is a proposal. What are the strongest arguments against proceeding?\n\n${PROPOSAL}` }],
  })
  return { prompt: 'What are the strongest arguments against proceeding?', response: text }
}

// ─── Condition 2: Light prompt asking for weaknesses ─────────────────────────

const LIGHT_SYSTEM = `You are a critical reviewer. When given a proposal, identify its three biggest weaknesses. Be direct. Ground each weakness in specific claims from the document rather than generic risks.`

async function runLight() {
  console.log('  Running condition 2: light prompt...')
  const text = await complete({
    system: LIGHT_SYSTEM,
    messages: [{ role: 'user', content: `Review this proposal and list its three biggest weaknesses.\n\n${PROPOSAL}` }],
  })
  return { system_prompt: LIGHT_SYSTEM, response: text }
}

// ─── Condition 3: Full Decision Challenger (Phase 0 + Phase 1) ───────────────

async function runDecisionChallenger() {
  console.log('  Running condition 3: Decision Challenger (Phase 0 + Phase 1)...')
  const messages = []
  const system = buildSystemPrompt(STAKES)

  // Phase 0
  messages.push({ role: 'user', content: buildChallengeMessage(PROPOSAL) })
  const phase0Raw = await complete({ system, messages })
  messages.push({ role: 'assistant', content: phase0Raw })
  const phase0 = parseJSON(phase0Raw)

  // Phase 1
  messages.push({ role: 'user', content: buildConfirmAssumptionsMessage() })
  const phase1Raw = await complete({ system, messages })
  messages.push({ role: 'assistant', content: phase1Raw })
  const phase1 = parseJSON(phase1Raw)

  return {
    stakes: STAKES,
    assumption_map: phase0.assumption_map ?? phase0,
    objections: phase1.objections ?? phase1,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  if (customFile) {
    console.log(`\nDecision Challenger — comparison test`)
    console.log(`Document: ${customFile}`)
  } else {
    console.log(`\nDecision Challenger — comparison test`)
    console.log(`Document: (built-in sample)`)
  }
  console.log(`Model: ${MODEL} | Stakes: ${STAKES}\n`)

  const [raw, light, dc] = await Promise.all([runRaw(), runLight(), runDecisionChallenger()])

  const output = {
    meta: { model: MODEL, stakes: STAKES, document_title: documentTitle },
    document: PROPOSAL.trim(),
    conditions: {
      raw_claude: raw,
      light_prompt: light,
      decision_challenger: dc,
    },
  }

  writeFileSync(OUT, JSON.stringify(output, null, 2))
  console.log(`\n✓ Written to ${OUT}`)

  // Print a quick side-by-side summary
  console.log('\n── Objection titles by condition ──────────────────────────\n')

  console.log('RAW CLAUDE (free-form, no structure)')
  console.log('  (see comparison.json — response is prose, not parsed)\n')

  console.log('LIGHT PROMPT (prose weaknesses)')
  console.log('  (see comparison.json — response is prose, not parsed)\n')

  console.log('DECISION CHALLENGER objections:')
  if (Array.isArray(dc.objections)) {
    dc.objections.forEach((o) => console.log(`  ${o.id}. ${o.title}`))
  } else {
    console.log('  (parse error — see comparison.json)')
  }
}

run().catch((err) => {
  console.error('\n✗ FAILED:', err.message)
  process.exit(1)
})
