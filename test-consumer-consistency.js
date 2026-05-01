import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, readFileSync } from 'fs'
import { basename, extname, dirname, join } from 'path'
import { buildSystemPrompt, buildChallengeMessage, buildConfirmAssumptionsMessage } from './src/lib/prompts.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6'
const RUNS = 3

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
  return rtf
    .replace(/\{\\[^{}]+\}/g, '')
    .replace(/\\[a-z]+[-\d]* ?/gi, '')
    .replace(/[{}\\]/g, '')
    .replace(/\r?\n+/g, '\n')
    .trim()
}

function loadDocument(filePath) {
  const raw = readFileSync(filePath, 'utf8')
  if (filePath.endsWith('.rtf')) return stripRtf(raw)
  return raw
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const client = new Anthropic()

function parseJSON(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error(`JSON parse failed.\n\nRaw response:\n${raw}`)
  }
}

async function complete(system, messages) {
  const response = await client.messages.create({ model: MODEL, max_tokens: 2048, system, messages })
  return response.content[0].text
}

// ─── Single Decision Challenger run (Phase 0 + Phase 1) ──────────────────────

async function runOnce(proposal, stakes, runIndex) {
  console.log(`  Run ${runIndex + 1}/${RUNS}...`)
  const system = buildSystemPrompt(stakes, 'consumer')
  const messages = []

  messages.push({ role: 'user', content: buildChallengeMessage(proposal, 'consumer') })
  const phase0Raw = await complete(system, messages)
  messages.push({ role: 'assistant', content: phase0Raw })
  const phase0 = parseJSON(phase0Raw)

  messages.push({ role: 'user', content: buildConfirmAssumptionsMessage(null, 'consumer') })
  const phase1Raw = await complete(system, messages)
  messages.push({ role: 'assistant', content: phase1Raw })
  const phase1 = parseJSON(phase1Raw)

  const expectedMax = stakes === 'high' ? 4 : 3
  if (!Array.isArray(phase1.objections) || phase1.objections.length < 3 || phase1.objections.length > expectedMax) {
    throw new Error(`Run ${runIndex + 1}: expected 3${stakes === 'high' ? '–4' : ''} objections, got ${phase1.objections?.length}`)
  }

  return {
    run: runIndex + 1,
    assumption_map: phase0.assumption_map,
    objections: phase1.objections,
  }
}

// ─── Raw keyword clustering ───────────────────────────────────────────────────

function keywords(title) {
  const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'for', 'is', 'are', 'on', 'at', 'by'])
  return title.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w))
}

function titlesOverlap(a, b) {
  const ka = new Set(keywords(a))
  return keywords(b).some((k) => ka.has(k))
}

function buildRawClusters(runs) {
  const allTitles = runs.flatMap((r) => r.objections.map((o) => o.title))
  const seen = new Set()
  const clusters = []

  for (const title of allTitles) {
    if (seen.has(title)) continue
    const matchingTitles = allTitles.filter((t) => titlesOverlap(title, t))
    matchingTitles.forEach((t) => seen.add(t))
    const appearedInRuns = runs
      .filter((r) => r.objections.some((o) => matchingTitles.includes(o.title)))
      .map((r) => r.run)
    clusters.push({
      representative_title: title,
      matched_titles: [...new Set(matchingTitles)],
      appeared_in_runs: appearedInRuns,
      appeared_in_count: appearedInRuns.length,
    })
  }

  clusters.sort((a, b) => b.appeared_in_count - a.appeared_in_count)
  return clusters
}

// ─── Semantic deduplication via Claude ───────────────────────────────────────

async function semanticDedup(runs) {
  // Build a flat list of all titles with their run labels
  const labeled = runs.flatMap((r) =>
    r.objections.map((o) => ({ run: r.run, title: o.title }))
  )

  const titlesBlock = labeled
    .map((t) => `- Run ${t.run}: "${t.title}"`)
    .join('\n')

  const prompt = `You are comparing objection titles generated across multiple runs of the same document review. Your job is to group titles that express the same underlying concern — even if the phrasing, emphasis, or framing differs.

Here are all the objection titles, labeled by run:

${titlesBlock}

Group them into semantic clusters. Two titles belong in the same cluster if a reviewer reading both would recognize them as raising the same fundamental risk or failure mechanism. Differences in wording, specificity, or framing do not matter — only whether the core concern is the same.

Respond in this JSON format only. No prose before or after.

{
  "clusters": [
    {
      "canonical_title": "A clear, concise label for this concern (5–8 words)",
      "titles": ["exact title string as given", "..."],
      "runs": [1, 2]
    }
  ]
}`

  const raw = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = raw.content[0].text
  const parsed = parseJSON(text)

  if (!Array.isArray(parsed.clusters)) {
    throw new Error(`Semantic dedup: expected clusters array.\n\nRaw:\n${text}`)
  }

  // Annotate each cluster with appeared_in_count
  const clusters = parsed.clusters.map((c) => ({
    ...c,
    appeared_in_count: c.runs.length,
  }))

  clusters.sort((a, b) => b.appeared_in_count - a.appeared_in_count)
  return clusters
}

// ─── Summarize clusters into buckets ─────────────────────────────────────────

function bucketize(clusters) {
  return {
    consistent_across_all_runs: clusters.filter((c) => c.appeared_in_count === RUNS),
    appeared_in_some_runs: clusters.filter((c) => c.appeared_in_count > 1 && c.appeared_in_count < RUNS),
    unique_to_one_run: clusters.filter((c) => c.appeared_in_count === 1),
  }
}

function consistencyRate(bucketed) {
  const total = bucketed.consistent_across_all_runs.length +
    bucketed.appeared_in_some_runs.length +
    bucketed.unique_to_one_run.length
  if (total === 0) return 0
  return bucketed.consistent_across_all_runs.length / total
}

// ─── Print helper ─────────────────────────────────────────────────────────────

function printBuckets(bucketed, labelFn) {
  const { consistent_across_all_runs, appeared_in_some_runs, unique_to_one_run } = bucketed

  console.log(`Consistent across all ${RUNS} runs (${consistent_across_all_runs.length}):`)
  if (consistent_across_all_runs.length === 0) {
    console.log('  none')
  } else {
    consistent_across_all_runs.forEach((c) => console.log(`  ✓ ${labelFn(c)}`))
  }

  console.log(`\nAppeared in some but not all runs (${appeared_in_some_runs.length}):`)
  if (appeared_in_some_runs.length === 0) {
    console.log('  none')
  } else {
    appeared_in_some_runs.forEach((c) =>
      console.log(`  ~ ${labelFn(c)} — runs ${c.appeared_in_runs ?? c.runs}`)
    )
  }

  console.log(`\nUnique to one run — potential noise (${unique_to_one_run.length}):`)
  if (unique_to_one_run.length === 0) {
    console.log('  none')
  } else {
    unique_to_one_run.forEach((c) => {
      const runNum = c.appeared_in_runs ? c.appeared_in_runs[0] : c.runs[0]
      console.log(`  ✗ ${labelFn(c)} — run ${runNum} only`)
    })
  }

  console.log(`\nConsistency rate: ${(consistencyRate(bucketed) * 100).toFixed(0)}% of concern clusters appeared in all ${RUNS} runs`)
}

// ─── Run a single file ────────────────────────────────────────────────────────

async function runCase(filePath) {
  const documentTitle = basename(filePath)
  const caseKey = basename(filePath, extname(filePath))
  const stakes = CASE_STAKES[caseKey] ?? 'medium'
  const OUT = join(dirname(filePath), `${caseKey}-consistency.json`)
  const PROPOSAL = loadDocument(filePath)

  console.log(`\nDecision Challenger — consumer consistency test`)
  console.log(`Document: ${filePath}`)
  console.log(`Model: ${MODEL} | Stakes: ${stakes} | Runs: ${RUNS}\n`)

  // Phase runs sequentially to avoid rate limits
  const runs = []
  for (let i = 0; i < RUNS; i++) {
    runs.push(await runOnce(PROPOSAL, stakes, i))
  }

  // Raw keyword-based clustering
  console.log('\n  Running raw keyword clustering...')
  const rawClusters = buildRawClusters(runs)
  const rawBucketed = bucketize(rawClusters)

  // Semantic deduplication via Claude
  console.log('  Running semantic deduplication...')
  const semanticClusters = await semanticDedup(runs)
  const semanticBucketed = bucketize(semanticClusters)

  const rawRate = consistencyRate(rawBucketed)
  const semanticRate = consistencyRate(semanticBucketed)
  // Language variance score: how much the keyword rate underestimates semantic consistency.
  // A positive score means the model is rephrasing the same concerns rather than generating
  // genuinely different ones — a sign of semantic reliability, not instability.
  const languageVarianceScore = Math.round((semanticRate - rawRate) * 100)

  const output = {
    meta: { model: MODEL, stakes, runs: RUNS, document_title: documentTitle },
    document: PROPOSAL.trim(),
    runs,
    analysis: {
      language_variance_score: {
        value: languageVarianceScore,
        unit: 'percentage points',
        interpretation: languageVarianceScore > 0
          ? `+${languageVarianceScore}pp — model is rephrasing the same concerns across runs (semantic reliability)`
          : languageVarianceScore < 0
          ? `${languageVarianceScore}pp — keyword clustering overcounts consistency; semantic view is more pessimistic`
          : 'No difference — keyword and semantic clustering agree',
        keyword_consistency_rate: Math.round(rawRate * 100),
        semantic_consistency_rate: Math.round(semanticRate * 100),
      },
      raw: {
        method: 'keyword overlap — titles sharing ≥1 non-stop word are grouped',
        clusters: rawClusters,
        ...rawBucketed,
      },
      deduplicated: {
        method: 'semantic grouping via Claude — same underlying concern regardless of phrasing',
        clusters: semanticClusters,
        ...semanticBucketed,
      },
    },
  }

  writeFileSync(OUT, JSON.stringify(output, null, 2))
  console.log(`\n✓ Written to ${OUT}`)

  console.log('\n── RAW keyword clusters ───────────────────────────────────\n')
  printBuckets(rawBucketed, (c) => `"${c.representative_title}"`)

  console.log('\n── SEMANTIC deduplicated clusters ─────────────────────────\n')
  printBuckets(semanticBucketed, (c) => `"${c.canonical_title}"`)

  console.log('\n── Language variance score ────────────────────────────────\n')
  const sign = languageVarianceScore > 0 ? '+' : ''
  console.log(`  ${sign}${languageVarianceScore}pp  (keyword: ${Math.round(rawRate * 100)}% → semantic: ${Math.round(semanticRate * 100)}%)`)
  if (languageVarianceScore > 0) {
    console.log(`  The model is varying phrasing while maintaining substance.`)
    console.log(`  ${languageVarianceScore >= 20 ? 'Strong' : 'Moderate'} semantic reliability signal.`)
  } else if (languageVarianceScore < 0) {
    console.log(`  Keyword clustering was overcounting — semantic view is more pessimistic.`)
  } else {
    console.log(`  Keyword and semantic rates agree — no phrasing-based false negatives detected.`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const customFile = process.argv[2]

async function run() {
  if (customFile) {
    await runCase(customFile)
  } else {
    console.log(`\nDecision Challenger — consumer consistency test (all cases)`)
    console.log(`Model: ${MODEL} | Runs: ${RUNS}\n`)
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
