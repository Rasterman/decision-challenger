import { useState } from 'react'

const STAKES_OPTIONS = {
  professional: [
    { value: 'low', label: 'Low', description: 'Surfaces objections with suggested mitigations' },
    { value: 'medium', label: 'Medium', description: 'Surfaces objections, you resolve them' },
    { value: 'high', label: 'High', description: 'Mandatory concern categories, no mitigations offered' },
  ],
  consumer: [
    { value: 'low', label: 'Low', description: 'Minor commitment — suggestions included' },
    { value: 'medium', label: 'Medium', description: 'Real consequences — you resolve the concerns' },
    { value: 'high', label: 'High', description: 'Hard to undo — full scrutiny, no softening' },
  ],
}

const MODE_CONFIG = {
  professional: {
    tagline: 'Pre-decision review. Grounded objections. No false comfort.',
    documentLabel: 'Document',
    documentPlaceholder: 'Paste your proposal, PRD, or decision document here',
    submitLabel: 'Challenge This',
    submitLoadingLabel: 'Analyzing document…',
  },
  consumer: {
    tagline: 'A thinking partner that holds position. A record you can return to.',
    documentLabel: 'Your decision',
    documentPlaceholder: 'Describe the decision you\'re considering — what you\'re thinking of doing, why, and what\'s making you uncertain. Write as much as feels right.',
    submitLabel: 'Challenge This',
    submitLoadingLabel: 'Reading your decision…',
  },
}

export default function IntakeView({ onSubmit, loading, error }) {
  const [mode, setMode] = useState('consumer')
  const [apiKey, setApiKey] = useState('')
  const [stakes, setStakes] = useState('medium')
  const [proposal, setProposal] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const config = MODE_CONFIG[mode]
  const stakesOptions = STAKES_OPTIONS[mode]

  function validate() {
    const errs = {}
    if (!apiKey.trim()) errs.apiKey = 'API key is required'
    if (!proposal.trim()) errs.proposal = mode === 'consumer'
      ? 'Describe your decision before continuing'
      : 'Paste your document before continuing'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
    onSubmit({ apiKey: apiKey.trim(), mode, stakes, proposal: proposal.trim() })
  }

  function handleModeChange(m) {
    setMode(m)
    setStakes('medium')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-14">

        {/* Wordmark */}
        <div className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Decision Challenger
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {config.tagline}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="mb-8">
          <div className="inline-flex rounded-lg border border-gray-800 bg-gray-900 p-1">
            <button
              type="button"
              onClick={() => handleModeChange('professional')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                ${mode === 'professional'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              Team decision
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('consumer')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                ${mode === 'consumer'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              Personal decision
            </button>
          </div>
        </div>

        {/* API key */}
        <div className="mb-8 pb-8 border-b border-gray-800">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">
            Anthropic API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => {
              setApiKey(e.target.value)
              if (fieldErrors.apiKey) setFieldErrors(p => ({ ...p, apiKey: null }))
            }}
            placeholder="sk-ant-..."
            autoComplete="off"
            className={`w-full bg-gray-900 border rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-600
              focus:outline-none focus:ring-1 transition-colors
              ${fieldErrors.apiKey
                ? 'border-red-600 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-800 focus:border-indigo-500 focus:ring-indigo-500'
              }`}
          />
          {fieldErrors.apiKey ? (
            <p className="mt-1.5 text-xs text-red-400">{fieldErrors.apiKey}</p>
          ) : (
            <p className="mt-1.5 text-xs text-gray-600">
              Your key runs in your browser only — never stored or transmitted to our servers.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">

          {/* Document / decision */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">
              {config.documentLabel}
            </label>
            <textarea
              value={proposal}
              onChange={e => {
                setProposal(e.target.value)
                if (fieldErrors.proposal) setFieldErrors(p => ({ ...p, proposal: null }))
              }}
              placeholder={config.documentPlaceholder}
              rows={mode === 'consumer' ? 10 : 13}
              className={`w-full bg-gray-900 border rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600
                focus:outline-none focus:ring-1 transition-colors resize-y leading-relaxed
                ${fieldErrors.proposal
                  ? 'border-red-600 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-800 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
            />
            {fieldErrors.proposal && (
              <p className="mt-1.5 text-xs text-red-400">{fieldErrors.proposal}</p>
            )}
            {mode === 'consumer' && !fieldErrors.proposal && (
              <p className="mt-1.5 text-xs text-gray-600">
                The more specific you are, the more grounded the challenges will be.
              </p>
            )}
          </div>

          {/* Stakes */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">
              Stakes Level
            </label>
            <div className="grid grid-cols-3 gap-3">
              {stakesOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStakes(opt.value)}
                  className={`text-left rounded-lg border px-4 py-3.5 transition-colors
                    ${stakes === opt.value
                      ? 'border-indigo-500 bg-indigo-950/40 text-white'
                      : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                    }`}
                >
                  <div className="text-sm font-medium mb-1">{opt.label}</div>
                  <div className="text-xs leading-snug opacity-70">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* API error */}
          {error && (
            <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
              text-white font-medium rounded-lg py-3 text-sm transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                {config.submitLoadingLabel}
              </span>
            ) : (
              config.submitLabel
            )}
          </button>

        </form>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  )
}
