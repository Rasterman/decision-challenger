import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, readFileSync } from 'fs'
import { basename, extname, dirname, join } from 'path'
import { buildSystemPrompt, buildChallengeMessage, buildConfirmAssumptionsMessage } from './src/lib/prompts.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6'

// Stakes per case
const CASE_STAKES = {
  'house-phoenix-2006': 'high',
  'startup-offer-2019': 'high',
  'relocation-austin-nyc': 'medium',
  'mba-decision': 'medium',
  'baby-timing': 'high',
}

const ALL_CASES = [
  'docs/consumer/house-phoenix-2006.txt',
  'docs/consumer/startup-offer-2019.txt',
  'docs/consumer/relocation-austin-nyc.txt',
  'docs/consumer/mba-decision.txt',
  'docs/consumer/baby-timing.txt',
]

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function runRaw(proposal) {
  console.log('  Running condition 1: raw Claude...')
  const text = await complete({
    messages: [{ role: 'user', content: `Here is a personal decision I'm considering. What are the strongest arguments against proceeding?\n\n${proposal}` }],
  })
  return { prompt: 'What are the strongest arguments against proceeding?', response: text }
}

// ─── Condition 2: Light prompt asking for weaknesses ─────────────────────────

const LIGHT_SYSTEM = `You are a critical reviewer. When given a personal decision document, identify the three biggest weaknesses in the reasoning. Be direct. Ground each weakness in specific claims from the document rather than generic concerns.`

async function runLight(proposal) {
  console.log('  Running condition 2: light prompt...')
  const text = await complete({
    system: LIGHT_SYSTEM,
    messages: [{ role: 'user', content: `Review this decision and list its three biggest weaknesses in the reasoning.\n\n${proposal}` }],
  })
  return { system_prompt: LIGHT_SYSTEM, response: text }
}

// ─── Condition 3: Full Decision Challenger (Phase 0 + Phase 1) ───────────────

async function runDecisionChallenger(proposal, stakes) {
  console.log('  Running condition 3: Decision Challenger (Phase 0 + Phase 1)...')
  const messages = []
  const system = buildSystemPrompt(stakes, 'consumer')

  // Phase 0
  messages.push({ role: 'user', content: buildChallengeMessage(proposal, 'consumer') })
  const phase0Raw = await complete({ system, messages })
  messages.push({ role: 'assistant', content: phase0Raw })
  const phase0 = parseJSON(phase0Raw)

  // Phase 1
  messages.push({ role: 'user', content: buildConfirmAssumptionsMessage(null, 'consumer') })
  const phase1Raw = await complete({ system, messages })
  messages.push({ role: 'assistant', content: phase1Raw })
  const phase1 = parseJSON(phase1Raw)

  return {
    stakes,
    assumption_map: phase0.assumption_map ?? phase0,
    objections: phase1.objections ?? phase1,
  }
}

// ─── Run a single file ────────────────────────────────────────────────────────

async function runCase(filePath) {
  const documentTitle = basename(filePath)
  const caseKey = basename(filePath, extname(filePath))
  const stakes = CASE_STAKES[caseKey] ?? 'medium'
  const OUT = join(dirname(filePath), `${caseKey}-comparison.json`)
  const PROPOSAL = loadDocument(filePath)

  console.log(`\nDecision Challenger — consumer comparison test`)
  console.log(`Document: ${filePath}`)
  console.log(`Model: ${MODEL} | Stakes: ${stakes}\n`)

  const [raw, light, dc] = await Promise.all([
    runRaw(PROPOSAL),
    runLight(PROPOSAL),
    runDecisionChallenger(PROPOSAL, stakes),
  ])

  const output = {
    meta: { model: MODEL, stakes, document_title: documentTitle },
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

// ─── Main ─────────────────────────────────────────────────────────────────────

const customFile = process.argv[2]

async function run() {
  if (customFile) {
    await runCase(customFile)
  } else {
    console.log(`\nDecision Challenger — consumer comparison test (all cases)`)
    console.log(`Model: ${MODEL}\n`)
    for (const filePath of ALL_CASES) {
      await runCase(filePath)
    }
    console.log('\n✓ All cases complete.')
  }
}

run().catch((err) => {
  console.error('\n✗ FAILED:', err.message)
  process.exit(1)
})
