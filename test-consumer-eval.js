import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

// ─── Config ───────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6'
const CONSUMER_DIR = './docs/consumer'

// ─── Ground truth targets ─────────────────────────────────────────────────────

const GROUND_TRUTH = {
  'house-phoenix-2006': {
    type: 'structural',
    target: 'The document treats housing dip risk and job loss risk as independent with separate mitigations, but they are causally correlated — a housing crash in Phoenix would cause local job losses, making both mitigations fail simultaneously',
    eval_question: 'Does any objection in this response surface the correlation between housing market decline and employment risk in Phoenix, noting that the 5-year hold and dual-income mitigations both fail under the same scenario?'
  },
  'startup-offer-2019': {
    type: 'factual',
    target: 'The fatal failure assumption that the founder identified in the postmortem appears as a stated strength in the candidate document — Decision Challenger should surface it as an objection grounded in the specific document claim',
    eval_question: 'Does any objection challenge the specific go-to-market or unit economics claim that is framed as a strength in the document, rather than raising generic startup risk concerns?'
  },
  'mba-decision': {
    type: 'analytical',
    target: 'The ROI calculation compares post-MBA salary against current salary rather than against projected salary without MBA — the counterfactual baseline error',
    eval_question: 'Does any objection identify that the salary comparison uses current salary as the baseline rather than projected salary on the current trajectory, making the calculated payback period shorter than the real one?'
  },
  'relocation-austin-nyc': {
    type: 'dependency',
    target: "The partner's career impact is mentioned briefly and treated as independent of the relocation decision, but it is a correlated variable — if the partner cannot find equivalent work in NYC, the financial and lifestyle calculus changes materially",
    eval_question: "Does assumption mapping or any objection surface that the partner's ability to find equivalent NYC employment is treated as a given when it is actually a load-bearing uncertainty that affects the entire analysis?"
  },
  'baby-timing': {
    type: 'framing_bias',
    target: 'The document frames "wait" as the costless default requiring no justification, while "now" requires justification — but waiting has real costs including fertility probability changes, housing timing, and opportunity costs that are not modeled',
    eval_question: 'Does assumption mapping identify that "waiting preserves current options" is treated as a costless default when it actually has real costs and risks, particularly fertility-related?'
  },
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
  const params = { model: MODEL, max_tokens: 1024, messages }
  if (system) params.system = system
  const response = await client.messages.create(params)
  return response.content[0].text
}

// ─── Evaluate a single condition's response ──────────────────────────────────

const EVAL_SYSTEM = `You are evaluating whether a decision review tool surfaced a specific finding. Answer yes, partial, or no, and quote the specific passage if yes or partial.

Respond in this JSON format only. No prose before or after.

{
  "verdict": "yes" | "partial" | "no",
  "evidence": "The exact quoted passage from the response that supports your verdict, or empty string if no."
}`

async function evaluateCondition(responseText, evalQuestion) {
  const userMessage = `Evaluation question: ${evalQuestion}

Response to evaluate:
---
${responseText}
---

Answer yes, partial, or no. Quote specific evidence if yes or partial.`

  const raw = await complete({
    system: EVAL_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
  })

  const result = parseJSON(raw)
  if (result.parse_error) {
    return { verdict: 'error', evidence: raw }
  }
  return result
}

// ─── Flatten a condition's response to a string for evaluation ────────────────

function flattenResponse(condition) {
  if (typeof condition.response === 'string') {
    return condition.response
  }

  // For decision_challenger: serialize assumption_map + objections
  const parts = []
  if (condition.assumption_map) {
    if (Array.isArray(condition.assumption_map)) {
      condition.assumption_map.forEach((a) => {
        parts.push(`Assumption ${a.id}: ${a.assumption}`)
        if (a.grounded_in) parts.push(`  Grounded in: "${a.grounded_in}"`)
      })
    }
  }
  if (condition.objections) {
    if (Array.isArray(condition.objections)) {
      condition.objections.forEach((o) => {
        parts.push(`\nObjection ${o.id}: ${o.title}`)
        if (o.grounded_in) parts.push(`  Grounded in: "${o.grounded_in}"`)
        if (o.objection) parts.push(`  ${o.objection}`)
        if (o.challenge) parts.push(`  ${o.challenge}`)
      })
    }
  }
  return parts.join('\n')
}

// ─── Evaluate a single case ───────────────────────────────────────────────────

async function evaluateCase(caseKey, comparisonPath) {
  console.log(`  Evaluating ${caseKey}...`)

  const gt = GROUND_TRUTH[caseKey]
  if (!gt) {
    console.log(`    No ground truth defined, skipping.`)
    return null
  }

  const comparisonJson = JSON.parse(readFileSync(comparisonPath, 'utf8'))
  const { conditions } = comparisonJson

  const rawText = flattenResponse(conditions.raw_claude)
  const lightText = flattenResponse(conditions.light_prompt)
  const dcText = flattenResponse(conditions.decision_challenger)

  const [rawEval, lightEval, dcEval] = await Promise.all([
    evaluateCondition(rawText, gt.eval_question),
    evaluateCondition(lightText, gt.eval_question),
    evaluateCondition(dcText, gt.eval_question),
  ])

  return {
    ground_truth_type: gt.type,
    target_finding: gt.target,
    raw_claude_verdict: rawEval.verdict,
    raw_claude_evidence: rawEval.evidence ?? '',
    light_prompt_verdict: lightEval.verdict,
    light_prompt_evidence: lightEval.evidence ?? '',
    decision_challenger_verdict: dcEval.verdict,
    decision_challenger_evidence: dcEval.evidence ?? '',
  }
}

// ─── Build markdown summary ───────────────────────────────────────────────────

function verdictEmoji(v) {
  if (v === 'yes') return 'yes'
  if (v === 'partial') return 'partial'
  return 'no'
}

function buildMarkdown(results) {
  const lines = []
  lines.push('# Consumer Test Case Evaluation Summary')
  lines.push('')
  lines.push(`Evaluated at: ${new Date().toISOString()}`)
  lines.push('')

  for (const [caseKey, result] of Object.entries(results)) {
    if (!result) continue
    lines.push(`## ${caseKey}`)
    lines.push('')
    lines.push(`**Ground truth type:** ${result.ground_truth_type}`)
    lines.push('')
    lines.push(`**Target finding:** ${result.target_finding}`)
    lines.push('')
    lines.push('| Condition | Verdict | Evidence |')
    lines.push('|---|---|---|')
    lines.push(`| Raw Claude | ${verdictEmoji(result.raw_claude_verdict)} | ${result.raw_claude_evidence ? result.raw_claude_evidence.substring(0, 120).replace(/\n/g, ' ') + '...' : '—'} |`)
    lines.push(`| Light Prompt | ${verdictEmoji(result.light_prompt_verdict)} | ${result.light_prompt_evidence ? result.light_prompt_evidence.substring(0, 120).replace(/\n/g, ' ') + '...' : '—'} |`)
    lines.push(`| Decision Challenger | ${verdictEmoji(result.decision_challenger_verdict)} | ${result.decision_challenger_evidence ? result.decision_challenger_evidence.substring(0, 120).replace(/\n/g, ' ') + '...' : '—'} |`)
    lines.push('')

    // Brief interpretation
    const dcV = result.decision_challenger_verdict
    const rawV = result.raw_claude_verdict
    const lightV = result.light_prompt_verdict

    const dcWins = (dcV === 'yes' || dcV === 'partial') && rawV === 'no' && lightV === 'no'
    const allFail = dcV === 'no' && rawV === 'no' && lightV === 'no'
    const allPass = (dcV === 'yes') && (rawV === 'yes' || lightV === 'yes')

    if (dcWins) {
      lines.push(`**Interpretation:** Decision Challenger surfaced the target finding while raw Claude and the light prompt did not. This is the ideal result — structured assumption mapping and concern generation outperformed unstructured prompting on this case.`)
    } else if (allFail) {
      lines.push(`**Interpretation:** None of the three conditions surfaced the target finding. This is the hardest type of miss — the structural flaw was not triggered by any prompting approach. Worth reviewing whether the document buries the flaw too deeply or whether the eval question needs refinement.`)
    } else if (allPass) {
      lines.push(`**Interpretation:** All conditions surfaced the target finding, suggesting this concern is prominent enough that any critical prompting approach catches it. The test case may need a subtler embedding of the flaw to distinguish conditions.`)
    } else {
      const winners = [
        rawV !== 'no' ? 'Raw Claude' : null,
        lightV !== 'no' ? 'Light Prompt' : null,
        dcV !== 'no' ? 'Decision Challenger' : null,
      ].filter(Boolean).join(', ')
      lines.push(`**Interpretation:** Mixed results — ${winners} surfaced the finding. Review the evidence quotes to assess whether the surfacing was precise (traced to the structural flaw) or incidental (generic concern that happened to overlap).`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nDecision Challenger — consumer evaluation`)
  console.log(`Model: ${MODEL}`)
  console.log(`Reading comparison outputs from ${CONSUMER_DIR}/\n`)

  const caseKeys = Object.keys(GROUND_TRUTH)
  const results = {}

  for (const caseKey of caseKeys) {
    const comparisonPath = join(CONSUMER_DIR, `${caseKey}-comparison.json`)
    if (!existsSync(comparisonPath)) {
      console.log(`  Skipping ${caseKey} — no comparison file found at ${comparisonPath}`)
      results[caseKey] = null
      continue
    }
    results[caseKey] = await evaluateCase(caseKey, comparisonPath)
  }

  const summaryJson = {
    evaluated_at: new Date().toISOString(),
    cases: results,
  }

  const jsonOut = join(CONSUMER_DIR, 'evaluation-summary.json')
  const mdOut = join(CONSUMER_DIR, 'evaluation-summary.md')

  writeFileSync(jsonOut, JSON.stringify(summaryJson, null, 2))
  console.log(`\n✓ Written to ${jsonOut}`)

  writeFileSync(mdOut, buildMarkdown(results))
  console.log(`✓ Written to ${mdOut}`)

  // Print quick summary table
  console.log('\n── Verdict summary ────────────────────────────────────────\n')
  console.log('Case'.padEnd(28) + 'Raw'.padEnd(10) + 'Light'.padEnd(10) + 'DC')
  console.log('─'.repeat(60))
  for (const [key, result] of Object.entries(results)) {
    if (!result) {
      console.log(key.padEnd(28) + '(no comparison file)')
      continue
    }
    console.log(
      key.padEnd(28) +
      result.raw_claude_verdict.padEnd(10) +
      result.light_prompt_verdict.padEnd(10) +
      result.decision_challenger_verdict
    )
  }
}

run().catch((err) => {
  console.error('\n✗ FAILED:', err.message)
  process.exit(1)
})
