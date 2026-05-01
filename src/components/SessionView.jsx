import ObjectionCard from './ObjectionCard'

export default function SessionView({
  sessionPhase,
  assumptions,
  objections,
  stakes,
  mode,
  loading,
  error,
  onRetry,
  onConfirmAssumptions,
  onSubmitCounter,
  onAcceptObjection,
  onSkipObjection,
  onGenerateBrief,
}) {
  const allDone = objections.length > 0 && objections.every(o => o.uiPhase === 'done')
  const isConsumer = mode === 'consumer'

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-14">

        {/* Wordmark */}
        <div className="mb-10">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-widest">
            Decision Challenger
          </p>
        </div>

        {/* ── Phase 0: Assumption map ──────────────────────────────────── */}
        {sessionPhase === 'assumptions' && (
          <div>
            <h2 className="text-base font-semibold text-gray-100 mb-1">
              {isConsumer
                ? 'Here\'s what you seem to be taking for granted'
                : 'Claude read these as your key assumptions'}
            </h2>
            <p className="text-sm text-gray-500 mb-7">
              {isConsumer
                ? 'Does this match how you see the situation? Confirm to begin the challenge.'
                : 'Does this match your intent? Confirm to begin the challenge.'}
            </p>

            <div className="space-y-3 mb-8">
              {assumptions.map((a, i) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-4"
                >
                  <div className="flex gap-3">
                    <span className="text-xs font-mono text-gray-600 pt-0.5 shrink-0 select-none">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <p className="text-sm text-gray-200 leading-relaxed">{a.assumption}</p>
                      <p className="mt-2 text-xs text-gray-500 italic leading-relaxed">
                        "{a.grounded_in}"
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && <InlineError error={error} onRetry={onRetry} className="mb-4" />}

            <button
              onClick={onConfirmAssumptions}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
                text-white font-medium rounded-lg py-3 text-sm transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  {isConsumer ? 'Surfacing what you might not be weighing…' : 'Generating objections…'}
                </span>
              ) : (
                isConsumer ? 'That\'s right — challenge this' : 'Assumptions look right — challenge this'
              )}
            </button>
          </div>
        )}

        {/* ── Phase 1+2: Objection cards ───────────────────────────────── */}
        {sessionPhase === 'objections' && (
          <div>
            <h2 className="text-base font-semibold text-gray-100 mb-1">
              {isConsumer
                ? `${objections.length === 1 ? '1 thing' : `${objections.length} things`} you might not be weighing`
                : `${objections.length === 1 ? '1 objection' : `${objections.length} objections`} to your proposal`}
            </h2>
            <p className="text-sm text-gray-500 mb-7">
              {isConsumer
                ? 'Respond to each concern, accept it, or skip it.'
                : 'Submit a counter, accept the risk, or skip each one.'}
              {stakes === 'high' && (
                <span className="ml-1 text-amber-500/80">
                  {isConsumer ? 'High stakes — financial realism, reversibility, and motivations examined.' : 'High stakes — mandatory concern categories applied.'}
                </span>
              )}
            </p>

            <div className="space-y-5 mb-8">
              {objections.map((o, i) => (
                <ObjectionCard
                  key={o.id}
                  index={i + 1}
                  objection={o}
                  onSubmitCounter={text => onSubmitCounter(o.id, text)}
                  onAccept={cost => onAcceptObjection(o.id, cost)}
                  onSkip={() => onSkipObjection(o.id)}
                />
              ))}
            </div>

            {error && <InlineError error={error} onRetry={onRetry} className="mb-4" />}

            {allDone && (
              <button
                onClick={onGenerateBrief}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
                  text-white font-medium rounded-lg py-3 text-sm transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    {isConsumer ? 'Generating decision record…' : 'Generating pre-commit brief…'}
                  </span>
                ) : (
                  isConsumer ? 'Generate Decision Record' : 'Generate Pre-Commit Brief'
                )}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function InlineError({ error, onRetry, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400 ${className}`}>
      <span className="leading-relaxed">{error}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 text-red-300 hover:text-red-200 underline text-xs"
        >
          Retry
        </button>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  )
}
