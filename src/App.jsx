import { useState, useRef } from 'react'
import IntakeView from './components/IntakeView'
import SessionView from './components/SessionView'
import BriefView from './components/BriefView'
import { createClient, sendMessage, parseJSON } from './lib/api'
import {
  buildSystemPrompt,
  buildChallengeMessage,
  buildConfirmAssumptionsMessage,
  buildCounterMessage,
  buildBriefMessage,
} from './lib/prompts'

export default function App() {
  const [view, setView] = useState('intake') // 'intake' | 'session' | 'brief'

  // Intake form values — preserved for reference in session
  const [mode, setMode] = useState('professional') // 'professional' | 'consumer'
  const [stakes, setStakes] = useState('medium')

  // Session sub-phase
  const [sessionPhase, setSessionPhase] = useState('assumptions') // 'assumptions' | 'objections'
  const [assumptions, setAssumptions] = useState([])
  const [objections, setObjections] = useState([])

  // Brief
  const [brief, setBrief] = useState(null)

  // Global loading/error (Phase 0, 1, 3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [retryFn, setRetryFn] = useState(null)

  // API client and conversation history kept in refs — no component renders them
  const clientRef = useRef(null)
  const systemPromptRef = useRef(null)
  const messagesRef = useRef([])

  function pushMessages(...msgs) {
    messagesRef.current = [...messagesRef.current, ...msgs]
  }

  function updateObjection(id, patch) {
    setObjections(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o))
  }

  // ── Phase 0: intake submit → assumption map ──────────────────────────────

  async function handleIntakeSubmit({ apiKey, mode: m, stakes: s, proposal }) {
    const c = createClient(apiKey)
    const sys = buildSystemPrompt(s, m)
    clientRef.current = c
    systemPromptRef.current = sys
    messagesRef.current = []

    setMode(m)
    setStakes(s)

    const action = async () => {
      setLoading(true)
      setError(null)
      try {
        const userMsg = { role: 'user', content: buildChallengeMessage(proposal, m) }
        pushMessages(userMsg)
        const raw = await sendMessage(c, sys, messagesRef.current)
        pushMessages({ role: 'assistant', content: raw })

        const parsed = parseJSON(raw)
        setAssumptions(parsed.assumption_map)
        setSessionPhase('assumptions')
        setView('session')
      } catch (e) {
        setError(e.message)
        setRetryFn(() => action)
      } finally {
        setLoading(false)
      }
    }

    await action()
  }

  // ── Phase 1: confirm assumptions → objections ────────────────────────────

  async function handleConfirmAssumptions() {
    const action = async () => {
      setLoading(true)
      setError(null)
      try {
        const userMsg = { role: 'user', content: buildConfirmAssumptionsMessage(null, mode) }
        pushMessages(userMsg)
        const raw = await sendMessage(clientRef.current, systemPromptRef.current, messagesRef.current)
        pushMessages({ role: 'assistant', content: raw })

        const parsed = parseJSON(raw)
        setObjections(
          parsed.objections.map(o => ({
            ...o,
            uiPhase: 'pending', // 'pending' | 'loading' | 'done'
            verdict: null,
            objError: null,
          }))
        )
        setSessionPhase('objections')
      } catch (e) {
        setError(e.message)
        setRetryFn(() => action)
      } finally {
        setLoading(false)
      }
    }

    await action()
  }

  // ── Phase 2a: submit counter for one objection ───────────────────────────

  async function handleSubmitCounter(objectionId, counterText) {
    const objection = objections.find(o => o.id === objectionId)
    updateObjection(objectionId, { uiPhase: 'loading', objError: null })

    const snapshotMessages = [...messagesRef.current]
    const userMsg = {
      role: 'user',
      content: buildCounterMessage(objectionId, objection.title, counterText),
    }

    const action = async () => {
      try {
        const msgs = [...snapshotMessages, userMsg]
        const raw = await sendMessage(clientRef.current, systemPromptRef.current, msgs)
        // Only push to shared history after success
        pushMessages(userMsg, { role: 'assistant', content: raw })

        const parsed = parseJSON(raw)
        updateObjection(objectionId, { uiPhase: 'done', verdict: parsed, objError: null })
      } catch (e) {
        updateObjection(objectionId, {
          uiPhase: 'pending',
          objError: e.message,
          objRetry: action,
        })
      }
    }

    await action()
  }

  // ── Phase 2b: accept risk (no API call) ─────────────────────────────────

  function handleAcceptObjection(objectionId, acceptedCost) {
    updateObjection(objectionId, {
      uiPhase: 'done',
      verdict: {
        verdict: 'accepted',
        objection_id: objectionId,
        accepted_cost: acceptedCost,
      },
      objError: null,
    })
  }

  // ── Phase 2c: skip (no API call) ────────────────────────────────────────

  function handleSkipObjection(objectionId) {
    updateObjection(objectionId, {
      uiPhase: 'done',
      verdict: {
        verdict: 'holds',
        objection_id: objectionId,
        reasoning: 'Skipped without response.',
        would_update_if: null,
        resolution_summary: 'Objection not addressed — proceeding without resolution.',
      },
      objError: null,
    })
  }

  // ── Phase 3: generate brief ──────────────────────────────────────────────

  async function handleGenerateBrief() {
    const sessionData = objections.map(o => {
      const v = o.verdict
      if (v.verdict === 'updated') {
        return {
          id: o.id,
          title: o.title,
          status: 'resolved',
          resolution_summary: v.resolution_summary,
        }
      }
      if (v.verdict === 'accepted') {
        return {
          id: o.id,
          title: o.title,
          status: 'accepted',
          resolution_summary: `Accepted — ${v.accepted_cost}`,
          accepted_cost: v.accepted_cost,
        }
      }
      return {
        id: o.id,
        title: o.title,
        status: 'open',
        resolution_summary: v.resolution_summary,
      }
    })

    const action = async () => {
      setLoading(true)
      setError(null)
      try {
        const userMsg = { role: 'user', content: buildBriefMessage(sessionData, mode) }
        pushMessages(userMsg)
        const raw = await sendMessage(clientRef.current, systemPromptRef.current, messagesRef.current)
        pushMessages({ role: 'assistant', content: raw })

        const parsed = parseJSON(raw)
        setBrief(parsed.brief)
        setView('brief')
      } catch (e) {
        setError(e.message)
        setRetryFn(() => action)
      } finally {
        setLoading(false)
      }
    }

    await action()
  }

  // ── Reset ────────────────────────────────────────────────────────────────

  function handleStartOver() {
    clientRef.current = null
    systemPromptRef.current = null
    messagesRef.current = []
    setView('intake')
    setMode('consumer')
    setStakes('medium')
    setSessionPhase('assumptions')
    setAssumptions([])
    setObjections([])
    setBrief(null)
    setLoading(false)
    setError(null)
    setRetryFn(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (view === 'intake') {
    return (
      <IntakeView
        loading={loading}
        error={error}
        onSubmit={handleIntakeSubmit}
      />
    )
  }

  if (view === 'session') {
    return (
      <SessionView
        sessionPhase={sessionPhase}
        assumptions={assumptions}
        objections={objections}
        stakes={stakes}
        mode={mode}
        loading={loading}
        error={error}
        onRetry={retryFn}
        onConfirmAssumptions={handleConfirmAssumptions}
        onSubmitCounter={handleSubmitCounter}
        onAcceptObjection={handleAcceptObjection}
        onSkipObjection={handleSkipObjection}
        onGenerateBrief={handleGenerateBrief}
      />
    )
  }

  return (
    <BriefView
      brief={brief}
      stakes={stakes}
      mode={mode}
      onStartOver={handleStartOver}
    />
  )
}
