import { useState } from 'react'

const STATUS_LABEL = {
  resolved: 'Resolved',
  open: 'Open',
  accepted: 'Accepted',
}

export default function BriefView({ brief, stakes, mode, onStartOver }) {
  const [copied, setCopied] = useState(false)
  const isConsumer = mode === 'consumer'

  function handleCopy() {
    navigator.clipboard.writeText(toMarkdown(brief, isConsumer)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-14">

        {/* Wordmark */}
        <div className="mb-10">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-widest">
            {isConsumer ? 'Decision Challenger — Decision Record' : 'Decision Challenger — Pre-Commit Brief'}
          </p>
        </div>

        {/* ── Confidence framing — emotional climax ─────────────────────── */}
        <div className="rounded-xl border border-gray-700 bg-gray-900 px-7 py-7 mb-10">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-4">
            Confidence
          </p>
          <p className="text-[1.0625rem] leading-relaxed text-gray-100 font-normal">
            {brief.confidence_framing}
          </p>
        </div>

        {/* ── Decision ─────────────────────────────────────────────────── */}
        <section className="mb-10">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-3">
            Decision
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            {brief.proposal_summary}
          </p>
        </section>

        {/* ── Objections ───────────────────────────────────────────────── */}
        <section className="mb-12">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-4">
            {isConsumer ? 'Concerns' : 'Objections'}
          </p>
          <div className="divide-y divide-gray-800">
            {brief.objections.map(o => (
              <div key={o.id} className="py-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="text-sm font-medium text-gray-200 leading-snug">
                    {o.title}
                  </span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {o.resolution_summary}
                </p>
                {o.status === 'accepted' && o.accepted_cost && (
                  <p className="mt-2 text-xs text-gray-500 italic">
                    Accepted cost: {o.accepted_cost}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-4 border-t border-gray-800">
          <button
            onClick={handleCopy}
            className="flex-1 bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-gray-600
              text-gray-300 text-sm font-medium rounded-lg py-2.5 transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy as Markdown'}
          </button>
          <button
            onClick={onStartOver}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
          >
            Start Over
          </button>
        </div>

      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'resolved') {
    return (
      <span className="shrink-0 text-xs font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-900/60 rounded-full px-2.5 py-0.5">
        Resolved
      </span>
    )
  }
  if (status === 'accepted') {
    return (
      <span className="shrink-0 text-xs font-medium text-red-400 bg-red-950/30 border border-red-900/50 rounded-full px-2.5 py-0.5">
        Accepted
      </span>
    )
  }
  return (
    <span className="shrink-0 text-xs font-medium text-amber-400 bg-amber-950/30 border border-amber-900/50 rounded-full px-2.5 py-0.5">
      Open
    </span>
  )
}

function toMarkdown(brief, isConsumer = false) {
  const lines = [
    isConsumer ? '# Decision Record' : '# Pre-Commit Brief',
    '',
    '## Confidence',
    '',
    brief.confidence_framing,
    '',
    '## Decision',
    '',
    brief.proposal_summary,
    '',
    isConsumer ? '## Concerns' : '## Objections',
    '',
  ]

  for (const o of brief.objections) {
    lines.push(`### ${o.title} — ${STATUS_LABEL[o.status] ?? o.status}`)
    lines.push('')
    lines.push(o.resolution_summary)
    if (o.status === 'accepted' && o.accepted_cost) {
      lines.push('')
      lines.push(`*Accepted cost: ${o.accepted_cost}*`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
