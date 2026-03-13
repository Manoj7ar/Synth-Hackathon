'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, BrainCircuit, CheckCircle2, FlaskConical, Loader2, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type {
  ReconciliationActionRecord,
  ReconciliationAgentResult,
  ReconciliationRunDetail,
  ReconciliationRunSummary,
} from '@/lib/clinical/reconciliation'

type ReconciliationWorkspaceProps = {
  patientId: string
  patientName: string
  latestVisitId: string
  latestVisitDate: string
  visitCount: number
  overview: string
  storyline: string
  activeConditions: string[]
  followUpRisks: string[]
  recommendedQuestions: string[]
  nextAppointment: {
    title: string
    scheduledFor: string
    notes: string
  } | null
}

type RunsResponse = {
  runs: ReconciliationRunSummary[]
}

type RunResponse = {
  run: ReconciliationRunDetail
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function agentTone(agentKey: ReconciliationAgentResult['agentKey']) {
  if (agentKey === 'artifact') return 'bg-sky-100 text-sky-800'
  if (agentKey === 'timeline') return 'bg-emerald-100 text-emerald-800'
  if (agentKey === 'reconciler') return 'bg-amber-100 text-amber-900'
  return 'bg-indigo-100 text-indigo-800'
}

function actionTone(status: ReconciliationActionRecord['status']) {
  if (status === 'applied') return 'bg-emerald-100 text-emerald-800'
  if (status === 'dismissed') return 'bg-slate-200 text-slate-700'
  if (status === 'approved') return 'bg-sky-100 text-sky-800'
  return 'bg-amber-100 text-amber-900'
}

function conflictTone(severity: 'low' | 'medium' | 'high') {
  if (severity === 'high') return 'border-rose-200 bg-rose-50/80 text-rose-900'
  if (severity === 'medium') return 'border-amber-200 bg-amber-50/80 text-amber-900'
  return 'border-sky-200 bg-sky-50/80 text-sky-900'
}

export function ReconciliationWorkspace({
  patientId,
  patientName,
  latestVisitId,
  latestVisitDate,
  visitCount,
  overview,
  storyline,
  activeConditions,
  followUpRisks,
  recommendedQuestions,
  nextAppointment,
}: ReconciliationWorkspaceProps) {
  const [runs, setRuns] = useState<ReconciliationRunSummary[]>([])
  const [currentRun, setCurrentRun] = useState<ReconciliationRunDetail | null>(null)
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null)
  const [creatingRun, setCreatingRun] = useState(false)
  const [actingOnId, setActingOnId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadRun = useCallback(async (runId: string) => {
    setLoadingRunId(runId)
    setError('')
    try {
      const res = await fetch(`/api/reconciliation/runs/${runId}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to load run')
      const data = (await res.json()) as RunResponse
      setCurrentRun(data.run)
    } catch {
      setError('Unable to load the selected reconciliation run.')
    } finally {
      setLoadingRunId(null)
    }
  }, [])

  const loadRuns = useCallback(async (selectRunId?: string) => {
    setLoadingRuns(true)
    setError('')
    try {
      const res = await fetch(`/api/reconciliation/runs?patientId=${encodeURIComponent(patientId)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to load runs')
      const data = (await res.json()) as RunsResponse
      const nextRuns = Array.isArray(data.runs) ? data.runs : []
      setRuns(nextRuns)
      const targetRunId = selectRunId ?? nextRuns[0]?.id ?? null
      if (targetRunId) {
        await loadRun(targetRunId)
      } else {
        setCurrentRun(null)
      }
    } catch {
      setError('Unable to load Evidence Lab history right now.')
    } finally {
      setLoadingRuns(false)
    }
  }, [loadRun, patientId])

  async function handleCreateRun() {
    setCreatingRun(true)
    setError('')
    try {
      const res = await fetch('/api/reconciliation/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          visitId: latestVisitId,
        }),
      })
      if (!res.ok) throw new Error('Failed to create run')
      const data = (await res.json()) as RunResponse
      setCurrentRun(data.run)
      await loadRuns(data.run.id)
    } catch {
      setError('Unable to create a fresh reconciliation run.')
    } finally {
      setCreatingRun(false)
    }
  }

  async function handleAction(actionId: string, decision: 'approve' | 'dismiss') {
    if (!currentRun) return
    setActingOnId(actionId)
    setError('')
    try {
      const res = await fetch(
        `/api/reconciliation/runs/${currentRun.id}/actions/${actionId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision }),
        }
      )
      if (!res.ok) throw new Error('Failed to apply action')
      const data = (await res.json()) as RunResponse
      setCurrentRun(data.run)
      await loadRuns(data.run.id)
    } catch {
      setError('Unable to update that recommendation right now.')
    } finally {
      setActingOnId(null)
    }
  }

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
      <aside className="space-y-5">
        <div className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Patient Snapshot
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {patientName}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{overview}</p>
            </div>
            <div className="rounded-2xl bg-[#fff7e8] p-3 text-amber-800">
              <Scale size={20} />
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-600">{storyline}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#eadfcd] bg-[#fffaf1] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Visits</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{visitCount}</p>
              <p className="mt-1 text-xs text-slate-500">Latest visit {formatDate(latestVisitDate)}</p>
            </div>
            <div className="rounded-2xl border border-[#eadfcd] bg-[#fffaf1] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Open Risks</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{followUpRisks.length}</p>
              <p className="mt-1 text-xs text-slate-500">Longitudinal follow-up signals</p>
            </div>
          </div>

          {activeConditions.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {activeConditions.map((condition) => (
                <span
                  key={condition}
                  className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
                >
                  {condition}
                </span>
              ))}
            </div>
          )}

          {nextAppointment ? (
            <div className="mt-5 rounded-2xl border border-[#eadfcd] bg-[#fffaf1] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Next Appointment
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{nextAppointment.title}</p>
              <p className="mt-1 text-sm text-slate-600">{formatDateTime(nextAppointment.scheduledFor)}</p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={handleCreateRun} disabled={creatingRun}>
              {creatingRun ? <Loader2 size={16} className="mr-2 animate-spin" /> : <FlaskConical size={16} className="mr-2" />}
              Run Evidence Lab
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/patient-twin/${patientId}`}>
                <BrainCircuit size={16} className="mr-2" />
                Patient Twin
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/soap-notes/${latestVisitId}`}>Latest SOAP</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Run History
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                Persisted reconciliation runs
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
              {runs.length} run{runs.length === 1 ? '' : 's'}
            </span>
          </div>

          {loadingRuns ? (
            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[#eadfcd] bg-[#fffaf1] px-4 py-3 text-sm text-slate-600">
              <Loader2 size={16} className="animate-spin" />
              Loading persisted runs...
            </div>
          ) : runs.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#eadfcd] bg-[#fffaf1] px-4 py-4 text-sm leading-6 text-slate-600">
              No Evidence Lab run exists yet for this patient. Start one from the latest visit to populate the agent cards and action ledger.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {runs.map((run) => {
                const active = currentRun?.id === run.id
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => void loadRun(run.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      active
                        ? 'border-sky-300 bg-sky-50/90'
                        : 'border-[#eadfcd] bg-[#fffaf1] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {run.overallConfidence ?? 0}% confidence
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(run.createdAt)}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                        {run.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {run.consensusSummary || 'Consensus summary unavailable.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span>{run.agentCount} agent outputs</span>
                      <span>{run.actionCounts.suggested} suggested action(s)</span>
                      <span>{run.actionCounts.applied} applied</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {recommendedQuestions.length > 0 && (
          <div className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Judge-Friendly Questions
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {recommendedQuestions.map((question) => (
                <span
                  key={question}
                  className="rounded-full border border-[#eadfcd] bg-[#fffaf1] px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {question}
                </span>
              ))}
            </div>
          </div>
        )}
      </aside>

      <section className="space-y-5">
        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/80 px-5 py-4 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {!currentRun && !loadingRuns ? (
          <div className="rounded-3xl border border-dashed border-[#eadfcd] bg-white/80 px-6 py-10 text-center shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
            <p className="text-xl font-semibold text-slate-900">No run selected yet</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Evidence Lab saves every reconciliation pass so judges can inspect the agent outputs instead of trusting one hidden answer.
            </p>
          </div>
        ) : loadingRunId ? (
          <div className="rounded-3xl border border-[#eadfcd] bg-white/80 px-6 py-10 text-center shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
            <Loader2 size={22} className="mx-auto animate-spin text-slate-500" />
            <p className="mt-3 text-sm text-slate-600">Loading reconciliation run...</p>
          </div>
        ) : currentRun ? (
          <>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Consensus
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                      {currentRun.overallConfidence ?? 0}% confidence
                    </h2>
                  </div>
                  <span className="rounded-full bg-[#fff7e8] px-3 py-1 text-xs font-semibold text-amber-900">
                    {currentRun.status}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-700">{currentRun.consensusSummary}</p>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {currentRun.supportedClaims.map((claim) => (
                    <div key={`${claim.title}-${claim.statement}`} className="rounded-2xl border border-[#eadfcd] bg-[#fffaf1] p-4">
                      <p className="text-sm font-semibold text-slate-900">{claim.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{claim.statement}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>{claim.status}</span>
                        <span>{claim.confidence}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-700" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Conflict Ledger
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        What does not fully line up
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {currentRun.conflicts.length === 0 ? (
                      <div className="rounded-2xl border border-[#eadfcd] bg-[#fffaf1] px-4 py-3 text-sm text-slate-600">
                        This run did not surface a major evidence conflict.
                      </div>
                    ) : (
                      currentRun.conflicts.map((conflict) => (
                        <div
                          key={`${conflict.title}-${conflict.detail}`}
                          className={`rounded-2xl border px-4 py-4 ${conflictTone(conflict.severity)}`}
                        >
                          <p className="text-sm font-semibold">{conflict.title}</p>
                          <p className="mt-2 text-sm leading-6">{conflict.detail}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-700" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Suggested Actions
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        Approve into the live chart
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    {currentRun.actions.length === 0 ? (
                      <div className="rounded-2xl border border-[#eadfcd] bg-[#fffaf1] px-4 py-3 text-sm text-slate-600">
                        This run did not generate a chart-write recommendation.
                      </div>
                    ) : (
                      currentRun.actions.map((action) => (
                        <div key={action.id} className="rounded-2xl border border-[#eadfcd] bg-[#fffaf1] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                              <p className="mt-2 text-sm leading-6 text-slate-600">{action.details}</p>
                              {action.rationale ? (
                                <p className="mt-2 text-xs leading-5 text-slate-500">
                                  {action.rationale}
                                </p>
                              ) : null}
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${actionTone(action.status)}`}>
                              {action.status}
                            </span>
                          </div>

                          {action.status === 'suggested' ? (
                            <div className="mt-4 flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => void handleAction(action.id, 'approve')}
                                disabled={actingOnId === action.id}
                              >
                                {actingOnId === action.id ? (
                                  <Loader2 size={14} className="mr-2 animate-spin" />
                                ) : null}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleAction(action.id, 'dismiss')}
                                disabled={actingOnId === action.id}
                              >
                                Dismiss
                              </Button>
                            </div>
                          ) : (
                            <p className="mt-4 text-xs text-slate-500">
                              {action.appliedRecordType
                                ? `Applied to ${action.appliedRecordType.replace('_', ' ')} ${action.appliedRecordId ? `(${action.appliedRecordId})` : ''}`
                                : `Updated ${formatDateTime(action.updatedAt)}`}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {currentRun.unresolvedQuestions.length > 0 && (
              <div className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Unresolved Questions
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {currentRun.unresolvedQuestions.map((question) => (
                    <span
                      key={question}
                      className="rounded-full border border-[#eadfcd] bg-[#fffaf1] px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      {question}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              {currentRun.agentOutputs.map((agent) => (
                <div
                  key={agent.agentKey}
                  className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Agent Output
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {agent.agentKey === 'reconciler'
                          ? 'Reconciler Agent'
                          : `${agent.agentKey.charAt(0).toUpperCase()}${agent.agentKey.slice(1)} Agent`}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${agentTone(agent.agentKey)}`}>
                      {agent.confidence}% confidence
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-700">{agent.summary}</p>

                  <div className="mt-5 space-y-3">
                    {agent.claims.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#eadfcd] bg-[#fffaf1] px-4 py-3 text-sm text-slate-600">
                        No structured claims were persisted for this agent.
                      </div>
                    ) : (
                      agent.claims.map((claim) => (
                        <div
                          key={`${agent.agentKey}-${claim.title}-${claim.statement}`}
                          className="rounded-2xl border border-[#eadfcd] bg-[#fffaf1] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">{claim.title}</p>
                            <span className="text-xs text-slate-500">{claim.status}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{claim.statement}</p>
                          {claim.evidence.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {claim.evidence.map((citation) => (
                                <div
                                  key={`${claim.title}-${citation.source}-${citation.excerpt}`}
                                  className="rounded-2xl bg-white/80 px-3 py-2"
                                >
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    {citation.source}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-slate-600">
                                    {citation.excerpt}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}

