import { useState } from 'react'

export default function ObjectionCard({
  index,
  objection,
  onSubmitCounter,
  onAccept,
  onSkip,
}) {
  const [counterText, setCounterText] = useState('')
  const [acceptMode, setAcceptMode] = useState(false)
  const [acceptText, setAcceptText] = useState('')

  const { uiPhase, verdict, objError, objRetry } = objection
  const isDone = uiPhase === 'done'
  const isLoading = uiPhase === 'loading'

  function handleSubmitCounter() {
    if (!counterText.trim()) return
    onSubmitCounter(counterText.trim())
  }

  function handleConfirmAccept() {
    onAccept(acceptText.trim() || 'No cost documented.')
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="text-xs font-mono text-gray-600 pt-0.5 shrink-0 select-none">
              {String(index).padStart(2, '0')}
            </span>
            <h3 className="text-sm font-semibold text-gray-100 leading-snug">
              {objection.title}
            </h3>
          </div>
          {isDone && <VerdictBadge verdict={verdict.verdict} />}
        </div>

        {/* Document quote — the product moment */}
        <div className="ml-7 border-l-2 border-indigo-700/60 pl-3 py-0.5 bg-indigo-950/20 rounded-r">
          <p className="text-xs text-indigo-300/80 italic leading-relaxed">
            "{objection.grounded_in}"
          </p>
        </div>
      </div>

      {/* Challenge */}
      <div className="px-6 pb-4 ml-7">
        <p className="text-sm text-gray-500 leading-relaxed mb-1.5">{objection.objection}</p>
        <p className="text-sm text-gray-300 leading-relaxed">{objection.challenge}</p>
      </div>

      {/* Response / verdict area */}
      <div className="px-6 pb-5">

        {/* Pending — show inputs */}
        {!isDone && !isLoading && (
          <>
            {!acceptMode ? (
              <div>
                <textarea
                  value={counterText}
                  onChange={e => setCounterText(e.target.value)}
                  placeholder="Your counter-argument…"
                  rows={3}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-200
                    placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                    transition-colors resize-none mb-3"
                />
                {objError && (
                  <InlineError error={objError} onRetry={objRetry} className="mb-3" />
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSubmitCounter}
                    disabled={!counterText.trim()}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed
                      text-gray-200 text-xs font-medium rounded-lg py-2.5 transition-colors"
                  >
                    Submit Counter
                  </button>
                  <button
                    onClick={() => setAcceptMode(true)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-amber-400 hover:text-amber-300
                      text-xs font-medium rounded-lg py-2.5 transition-colors"
                  >
                    Accept This Risk
                  </button>
                  <button
                    onClick={onSkip}
                    className="px-4 text-xs text-gray-600 hover:text-gray-400 transition-colors py-2.5"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  What is the team agreeing to absorb by accepting this risk?
                </p>
                <textarea
                  value={acceptText}
                  onChange={e => setAcceptText(e.target.value)}
                  placeholder="e.g. Team is accepting the risk that migration takes 2× longer than modeled…"
                  rows={2}
                  autoFocus
                  className="w-full bg-gray-950 border border-amber-900/60 rounded-lg px-3.5 py-2.5 text-sm text-gray-200
                    placeholder-gray-600 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700
                    transition-colors resize-none mb-3"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleConfirmAccept}
                    className="flex-1 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-900/60
                      text-amber-300 text-xs font-medium rounded-lg py-2.5 transition-colors"
                  >
                    Confirm Acceptance
                  </button>
                  <button
                    onClick={() => setAcceptMode(false)}
                    className="px-4 text-xs text-gray-600 hover:text-gray-400 transition-colors py-2.5"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2.5 text-xs text-gray-500 py-1">
            <span className="inline-block w-3 h-3 border border-gray-600 border-t-gray-300 rounded-full animate-spin" />
            Evaluating counter…
          </div>
        )}

        {/* Verdict */}
        {isDone && verdict && <VerdictDisplay verdict={verdict} />}

      </div>
    </div>
  )
}

function VerdictBadge({ verdict }) {
  if (verdict === 'updated') {
    return (
      <span className="shrink-0 text-xs font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-900/60 rounded-full px-2.5 py-0.5">
        Resolved
      </span>
    )
  }
  if (verdict === 'accepted') {
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

function VerdictDisplay({ verdict }) {
  if (verdict.verdict === 'updated') {
    return (
      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-4 py-3.5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-xs font-medium text-emerald-400">Objection updated</span>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed mb-2">{verdict.reasoning}</p>
        {verdict.resolution_summary && (
          <p className="text-xs text-gray-500 italic">{verdict.resolution_summary}</p>
        )}
      </div>
    )
  }

  if (verdict.verdict === 'holds') {
    return (
      <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3.5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          <span className="text-xs font-medium text-amber-400">Objection holds</span>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed mb-3">{verdict.reasoning}</p>
        {verdict.would_update_if && (
          <div className="border border-amber-900/40 rounded-md px-3 py-2.5 bg-amber-950/20">
            <p className="text-xs font-medium text-amber-500/80 mb-1">What would resolve this</p>
            <p className="text-xs text-gray-400 leading-relaxed">{verdict.would_update_if}</p>
          </div>
        )}
        {!verdict.would_update_if && verdict.resolution_summary && (
          <p className="text-xs text-gray-500 italic">{verdict.resolution_summary}</p>
        )}
      </div>
    )
  }

  if (verdict.verdict === 'accepted') {
    return (
      <div className="rounded-lg border border-gray-700/60 bg-gray-800/30 px-4 py-3.5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <span className="text-xs font-medium text-red-400">Accepted risk</span>
        </div>
        <p className="text-xs text-gray-400 italic leading-relaxed">{verdict.accepted_cost}</p>
      </div>
    )
  }

  return null
}

function InlineError({ error, onRetry, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2.5 text-xs text-red-400 ${className}`}>
      <span className="leading-relaxed">{error}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 text-red-300 hover:text-red-200 underline"
        >
          Retry
        </button>
      )}
    </div>
  )
}
