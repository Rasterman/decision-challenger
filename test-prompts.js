import Anthropic from '@anthropic-ai/sdk'
import {
  buildSystemPrompt,
  buildChallengeMessage,
  buildConfirmAssumptionsMessage,
  buildCounterMessage,
  buildAcceptMessage,
  buildBriefMessage,
} from './src/lib/prompts.js'

// ─── Config ──────────────────────────────────────────────────────────────────

const STAKES = 'medium'
const MODEL = 'claude-sonnet-4-6'

// A realistic proposal with specific claims, numbers, and assumptions
// that Claude can ground objections in.
const SAMPLE_PROPOSAL = `
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const client = new Anthropic()
const messages = []

function log(label, data) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${label}`)
  console.log('═'.repeat(60))
  if (typeof data === 'string') {
    console.log(data)
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
}

function parseJSON(raw) {
  // Strip markdown fences if Claude wraps the response
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error(`JSON parse failed.\n\nRaw response:\n${raw}`)
  }
}

async function chat(userContent) {
  messages.push({ role: 'user', content: userContent })
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: buildSystemPrompt(STAKES),
    messages,
  })
  const text = response.content[0].text
  messages.push({ role: 'assistant', content: text })
  return text
}

// ─── Test sequence ────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nDecision Challenger — prompt validation`)
  console.log(`Stakes: ${STAKES} | Model: ${MODEL}`)

  // Phase 0 — assumption map
  const phase0Raw = await chat(buildChallengeMessage(SAMPLE_PROPOSAL))
  const phase0 = parseJSON(phase0Raw)
  log('PHASE 0 — Assumption Map', phase0)

  // Validate Phase 0 shape
  const assumptions = phase0.assumption_map
  if (!Array.isArray(assumptions)) throw new Error('assumption_map is not an array')
  for (const a of assumptions) {
    if (!a.id || !a.assumption || !a.grounded_in) {
      throw new Error(`Assumption missing required fields: ${JSON.stringify(a)}`)
    }
  }
  console.log(`\n✓ ${assumptions.length} assumptions, all fields present`)

  // Phase 1 — objections (confirm assumption map as-is)
  const phase1Raw = await chat(buildConfirmAssumptionsMessage())
  const phase1 = parseJSON(phase1Raw)
  log('PHASE 1 — Objections', phase1)

  const objections = phase1.objections
  const expectedMax = STAKES === 'high' ? 4 : 3
  if (!Array.isArray(objections) || objections.length < 3 || objections.length > expectedMax) {
    throw new Error(`Expected 3${STAKES === 'high' ? '–4' : ''} objections, got ${objections?.length}`)
  }
  for (const o of objections) {
    if (!o.id || !o.title || !o.grounded_in || !o.objection || !o.challenge) {
      throw new Error(`Objection missing required fields: ${JSON.stringify(o)}`)
    }
  }
  console.log(`\n✓ 3 objections, all fields present`)

  // Track session state for Phase 3
  const session = objections.map((o) => ({
    id: o.id,
    title: o.title,
    status: null,
    resolution_summary: null,
    accepted_cost: null,
  }))

  // Phase 2a — strong counter (targeting "updated")
  const counter1Raw = await chat(
    buildCounterMessage(
      objections[0].id,
      objections[0].title,
      'We have a signed SOW with the auth team that commits two engineers full-time for the three-week window. The estimate was validated against a nearly identical project (the webhook management UI, shipped last quarter in 18 days). If anything, 3 weeks is conservative.'
    )
  )
  const counter1 = parseJSON(counter1Raw)
  log(`PHASE 2a — Counter objection ${objections[0].id} (strong counter, expect "updated")`, counter1)

  if (!counter1.objection_id || !counter1.verdict || !counter1.reasoning || !counter1.resolution_summary) {
    throw new Error(`Counter response missing required fields: ${JSON.stringify(counter1)}`)
  }
  if (counter1.verdict === 'holds' && !counter1.would_update_if) {
    throw new Error('"holds" verdict missing would_update_if')
  }
  session[0].status = counter1.verdict === 'updated' ? 'resolved' : 'open'
  session[0].resolution_summary = counter1.resolution_summary
  console.log(`\n✓ verdict: "${counter1.verdict}", required fields present`)

  // Phase 2b — weak counter (targeting "holds")
  const counter2Raw = await chat(
    buildCounterMessage(
      objections[1].id,
      objections[1].title,
      'The team is experienced and confident they can handle any issues that come up.'
    )
  )
  const counter2 = parseJSON(counter2Raw)
  log(`PHASE 2b — Counter objection ${objections[1].id} (weak counter, expect "holds")`, counter2)

  if (!counter2.objection_id || !counter2.verdict || !counter2.reasoning || !counter2.resolution_summary) {
    throw new Error(`Counter response missing required fields: ${JSON.stringify(counter2)}`)
  }
  if (counter2.verdict === 'holds' && !counter2.would_update_if) {
    throw new Error('"holds" verdict missing would_update_if')
  }
  session[1].status = counter2.verdict === 'updated' ? 'resolved' : 'open'
  session[1].resolution_summary = counter2.resolution_summary
  console.log(`\n✓ verdict: "${counter2.verdict}", required fields present`)

  // Phase 2c — accept objection 3
  const accept3Raw = await chat(buildAcceptMessage(objections[2].id, objections[2].title))
  const accept3 = parseJSON(accept3Raw)
  log(`PHASE 2c — Accept objection ${objections[2].id}`, accept3)

  if (!accept3.objection_id || accept3.verdict !== 'accepted' || !accept3.accepted_cost) {
    throw new Error(`Accept response missing required fields or wrong verdict: ${JSON.stringify(accept3)}`)
  }
  session[2].status = 'accepted'
  session[2].resolution_summary = `Accepted — ${accept3.accepted_cost}`
  session[2].accepted_cost = accept3.accepted_cost
  console.log(`\n✓ verdict: "accepted", accepted_cost present`)

  // Phase 3 — pre-commit brief
  const phase3Raw = await chat(buildBriefMessage(session))
  const phase3 = parseJSON(phase3Raw)
  log('PHASE 3 — Pre-Commit Brief', phase3)

  const brief = phase3.brief
  if (!brief?.proposal_summary || !Array.isArray(brief?.objections) || !brief?.confidence_framing) {
    throw new Error(`Brief missing required fields: ${JSON.stringify(phase3)}`)
  }
  for (const o of brief.objections) {
    if (!o.id || !o.title || !o.status || !o.resolution_summary) {
      throw new Error(`Brief objection missing required fields: ${JSON.stringify(o)}`)
    }
    if (o.status === 'accepted' && !o.accepted_cost) {
      throw new Error(`Brief objection ${o.id} is "accepted" but missing accepted_cost`)
    }
    if ((o.status === 'resolved' || o.status === 'open') && o.accepted_cost) {
      throw new Error(`Brief objection ${o.id} has status "${o.status}" but incorrectly includes accepted_cost`)
    }
  }
  console.log(`\n✓ Brief valid — ${brief.objections.length} objections, all fields present`)

  console.log('\n' + '═'.repeat(60))
  console.log('  ALL PHASES PASSED')
  console.log('═'.repeat(60) + '\n')
}

run().catch((err) => {
  console.error('\n✗ FAILED:', err.message)
  process.exit(1)
})
