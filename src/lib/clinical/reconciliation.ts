import type { TranscriptSegment } from '@/lib/clinical/clinical-notes'
import { extractMedicalEntities } from '@/lib/clinical/clinical-entities'
import { generateNovaText, isNovaConfigured } from '@/lib/ai/nova'
import {
  getPatientTwinForClinician,
  type PatientTwinCitation,
  type PatientTwinContext,
} from '@/lib/clinical/patient-twin'
import { prisma } from '@/lib/data/prisma'
import {
  buildArtifactEvidenceExcerpt,
  parseStoredArtifact,
  type NormalizedVisitArtifact,
} from '@/lib/clinical/visit-artifacts'

export type ReconciliationAgentKey = 'transcript' | 'artifact' | 'timeline' | 'reconciler'
export type ReconciliationClaimStatus = 'supported' | 'watch' | 'conflicted' | 'unresolved'
export type ReconciliationConflictSeverity = 'low' | 'medium' | 'high'
export type ReconciliationActionKind = 'care_plan_item' | 'appointment'
export type ReconciliationRunStatus = 'running' | 'completed' | 'partial' | 'failed'
export type ReconciliationActionStatus = 'suggested' | 'dismissed' | 'approved' | 'applied'

export interface ReconciliationCitation {
  source: string
  visitId: string
  visitDate: string
  excerpt: string
}

export interface EvidenceClaim {
  title: string
  statement: string
  category: string
  status: ReconciliationClaimStatus
  confidence: number
  evidence: ReconciliationCitation[]
}

export interface ConflictRecord {
  title: string
  detail: string
  severity: ReconciliationConflictSeverity
  evidence: ReconciliationCitation[]
}

export interface SuggestedActionPayload {
  dueAt?: string
  scheduledFor?: string
  notes?: string
}

export interface SuggestedActionDraft {
  kind: ReconciliationActionKind
  title: string
  details: string
  rationale: string
  payload?: SuggestedActionPayload
}

export interface ReconciliationAgentResult {
  agentKey: ReconciliationAgentKey
  status: 'completed' | 'failed'
  summary: string
  confidence: number
  claims: EvidenceClaim[]
  citations: ReconciliationCitation[]
}

export interface ReconciliationActionRecord extends SuggestedActionDraft {
  id: string
  status: ReconciliationActionStatus
  appliedRecordType: string | null
  appliedRecordId: string | null
  createdAt: string
  updatedAt: string
}

export interface ReconciliationRunSummary {
  id: string
  patientId: string
  patientName: string
  visitId: string
  visitDate: string
  createdAt: string
  status: ReconciliationRunStatus
  overallConfidence: number | null
  consensusSummary: string
  agentCount: number
  actionCounts: {
    suggested: number
    dismissed: number
    applied: number
  }
}

export interface ReconciliationRunDetail extends ReconciliationRunSummary {
  supportedClaims: EvidenceClaim[]
  conflicts: ConflictRecord[]
  unresolvedQuestions: string[]
  agentOutputs: ReconciliationAgentResult[]
  actions: ReconciliationActionRecord[]
}

type VisitRow = {
  id: string
  patientId: string
  clinicianId: string
  status: string
  chiefComplaint: string | null
  startedAt: Date
  patient: {
    displayName: string
  }
  documentation: {
    transcriptJson: string
    summary: string
    soapNotes: string
    additionalNotes: string | null
  } | null
  artifacts: Array<{
    id: string
    kind: string
    label: string
    mimeType: string
    sourceName: string | null
    extractedText: string | null
    summary: string
    structuredJson: string | null
    createdAt: Date
  }>
  appointments: Array<{
    id: string
    title: string
    scheduledFor: Date
    notes: string | null
  }>
  carePlanItems: Array<{
    id: string
    title: string
    details: string | null
    dueAt: Date | null
    status: string
  }>
}

type ReconciliationContext = {
  patientId: string
  patientName: string
  clinicianId: string
  visitId: string
  visitDate: Date
  visitStatus: string
  chiefComplaint: string
  transcriptText: string
  summary: string
  soapNotes: string
  additionalNotes: string
  artifacts: NormalizedVisitArtifact[]
  currentVisitCitations: ReconciliationCitation[]
  twin: PatientTwinContext
}

const BP_REGEX = /(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})/g

export async function createReconciliationRun({
  patientId,
  clinicianId,
  visitId,
}: {
  patientId: string
  clinicianId: string
  visitId?: string
}) {
  const context = await loadReconciliationContext({ patientId, clinicianId, visitId })
  if (!context) {
    return null
  }

  const run = await prisma.reconciliationRun.create({
    data: {
      patientId: context.patientId,
      visitId: context.visitId,
      clinicianId: context.clinicianId,
      status: 'running',
    },
    select: { id: true },
  })

  const agentOutputs: ReconciliationAgentResult[] = []
  const transcriptAgent = await safelyRunAgent('transcript', () => buildTranscriptAgent(context))
  const artifactAgent = await safelyRunAgent('artifact', () => buildArtifactAgent(context))
  const timelineAgent = await safelyRunAgent('timeline', () => buildTimelineAgent(context))

  agentOutputs.push(transcriptAgent, artifactAgent, timelineAgent)

  const supportedClaims = rankClaims([
    ...transcriptAgent.claims,
    ...artifactAgent.claims,
    ...timelineAgent.claims,
  ]).slice(0, 6)
  const conflicts = buildConflictLedger(context, {
    transcript: transcriptAgent,
    artifact: artifactAgent,
    timeline: timelineAgent,
  })
  const unresolvedQuestions = buildUnresolvedQuestions(context, conflicts)
  const suggestedActions = buildSuggestedActions(context, conflicts)
  const overallConfidence = computeOverallConfidence({
    claims: supportedClaims,
    conflicts,
    agentOutputs,
  })
  const consensusSummary = await buildConsensusSummary({
    context,
    supportedClaims,
    conflicts,
    unresolvedQuestions,
    suggestedActions,
  })

  const reconcilerAgent = await safelyRunAgent('reconciler', async () => ({
    agentKey: 'reconciler' as const,
    status: 'completed' as const,
    summary: consensusSummary,
    confidence: overallConfidence,
    claims: supportedClaims,
    citations: dedupeCitations(
      supportedClaims
        .flatMap((claim) => claim.evidence)
        .concat(conflicts.flatMap((conflict) => conflict.evidence))
    ).slice(0, 8),
  }))

  agentOutputs.push(reconcilerAgent)

  const successfulAgentCount = agentOutputs.filter((agent) => agent.status === 'completed').length
  const runStatus: ReconciliationRunStatus =
    successfulAgentCount === agentOutputs.length
      ? 'completed'
      : successfulAgentCount > 0
        ? 'partial'
        : 'failed'

  await prisma.$transaction(async (tx) => {
    await tx.reconciliationRun.update({
      where: { id: run.id },
      data: {
        status: runStatus,
        overallConfidence,
        consensusSummary,
        supportedClaimsJson: JSON.stringify(supportedClaims),
        conflictsJson: JSON.stringify(conflicts),
        unresolvedQuestionsJson: JSON.stringify(unresolvedQuestions),
      },
    })

    await tx.reconciliationAgentOutput.createMany({
      data: agentOutputs.map((output) => ({
        runId: run.id,
        agentKey: output.agentKey,
        status: output.status,
        summary: output.summary,
        confidence: output.confidence,
        claimsJson: JSON.stringify(output.claims),
        citationsJson: JSON.stringify(output.citations),
      })),
    })

    for (const action of suggestedActions) {
      await tx.reconciliationAction.create({
        data: {
          runId: run.id,
          patientId: context.patientId,
          visitId: context.visitId,
          clinicianId: context.clinicianId,
          kind: action.kind,
          title: action.title,
          details: action.details,
          rationale: action.rationale,
          payloadJson: action.payload ? JSON.stringify(action.payload) : null,
          status: 'suggested',
        },
      })
    }
  })

  return getReconciliationRunDetail({
    runId: run.id,
    clinicianId,
  })
}

export async function listReconciliationRunsForPatient({
  patientId,
  clinicianId,
}: {
  patientId: string
  clinicianId: string
}) {
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      visits: {
        some: {
          clinicianId,
        },
      },
    },
    select: { id: true },
  })

  if (!patient) {
    return null
  }

  const rows = await prisma.reconciliationRun.findMany({
    where: {
      patientId,
      clinicianId,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      patientId: true,
      status: true,
      overallConfidence: true,
      consensusSummary: true,
      createdAt: true,
      patient: {
        select: {
          displayName: true,
        },
      },
      visit: {
        select: {
          id: true,
          startedAt: true,
        },
      },
      agentOutputs: {
        select: {
          id: true,
        },
      },
      actions: {
        select: {
          status: true,
        },
      },
    },
  })

  return rows.map((row) => mapRunSummary(row))
}

export async function getReconciliationRunDetail({
  runId,
  clinicianId,
}: {
  runId: string
  clinicianId: string
}) {
  const run = await prisma.reconciliationRun.findFirst({
    where: {
      id: runId,
      clinicianId,
    },
    select: {
      id: true,
      patientId: true,
      status: true,
      overallConfidence: true,
      consensusSummary: true,
      supportedClaimsJson: true,
      conflictsJson: true,
      unresolvedQuestionsJson: true,
      createdAt: true,
      patient: {
        select: {
          displayName: true,
        },
      },
      visit: {
        select: {
          id: true,
          startedAt: true,
        },
      },
      agentOutputs: {
        orderBy: { createdAt: 'asc' },
        select: {
          agentKey: true,
          status: true,
          summary: true,
          confidence: true,
          claimsJson: true,
          citationsJson: true,
        },
      },
      actions: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          kind: true,
          title: true,
          details: true,
          rationale: true,
          payloadJson: true,
          status: true,
          appliedRecordType: true,
          appliedRecordId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!run) {
    return null
  }

  return mapRunDetail(run)
}

export async function decideReconciliationAction({
  runId,
  actionId,
  clinicianId,
  decision,
}: {
  runId: string
  actionId: string
  clinicianId: string
  decision: 'approve' | 'dismiss'
}) {
  const action = await prisma.reconciliationAction.findFirst({
    where: {
      id: actionId,
      runId,
      clinicianId,
    },
    select: {
      id: true,
      kind: true,
      title: true,
      details: true,
      payloadJson: true,
      patientId: true,
      visitId: true,
      clinicianId: true,
    },
  })

  if (!action) {
    return null
  }

  if (decision === 'dismiss') {
    await prisma.reconciliationAction.update({
      where: { id: action.id },
      data: {
        status: 'dismissed',
      },
    })

    return getReconciliationRunDetail({ runId, clinicianId })
  }

  const payload = parseJson<SuggestedActionPayload>(action.payloadJson, {})

  if (action.kind === 'care_plan_item') {
    const existing = await prisma.carePlanItem.findUnique({
      where: { sourceActionId: action.id },
      select: { id: true },
    })

    const planItem =
      existing ??
      (await prisma.carePlanItem.create({
        data: {
          visitId: action.visitId,
          patientId: action.patientId,
          clinicianId: action.clinicianId,
          sourceActionId: action.id,
          title: action.title,
          details: action.details,
          dueAt: payload.dueAt ? parseDate(payload.dueAt) : null,
        },
        select: { id: true },
      }))

    await prisma.reconciliationAction.update({
      where: { id: action.id },
      data: {
        status: 'applied',
        appliedRecordType: 'care_plan_item',
        appliedRecordId: planItem.id,
      },
    })
  } else {
    const existing = await prisma.appointment.findUnique({
      where: { sourceActionId: action.id },
      select: { id: true },
    })

    const appointment =
      existing ??
      (await prisma.appointment.create({
        data: {
          visitId: action.visitId,
          patientId: action.patientId,
          clinicianId: action.clinicianId,
          sourceActionId: action.id,
          title: action.title,
          scheduledFor: parseDate(payload.scheduledFor) ?? addDays(new Date(), 14),
          notes: payload.notes ?? action.details ?? null,
        },
        select: { id: true },
      }))

    await prisma.reconciliationAction.update({
      where: { id: action.id },
      data: {
        status: 'applied',
        appliedRecordType: 'appointment',
        appliedRecordId: appointment.id,
      },
    })
  }

  return getReconciliationRunDetail({ runId, clinicianId })
}

async function loadReconciliationContext({
  patientId,
  clinicianId,
  visitId,
}: {
  patientId: string
  clinicianId: string
  visitId?: string
}): Promise<ReconciliationContext | null> {
  const twin = await getPatientTwinForClinician({ patientId, clinicianId })
  if (!twin) {
    return null
  }

  const targetVisitId = visitId ?? twin.latestVisitId
  const visit = (await prisma.visit.findFirst({
    where: {
      id: targetVisitId,
      patientId,
      clinicianId,
      documentation: {
        isNot: null,
      },
    },
    include: {
      patient: {
        select: {
          displayName: true,
        },
      },
      documentation: true,
      artifacts: {
        orderBy: { createdAt: 'asc' },
      },
      appointments: {
        orderBy: { scheduledFor: 'asc' },
      },
      carePlanItems: {
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      },
    },
  })) as VisitRow | null

  if (!visit || !visit.documentation) {
    return null
  }

  const transcriptText = toTranscriptText(visit.documentation.transcriptJson)
  const artifacts = visit.artifacts.map((artifact) => parseStoredArtifact(artifact))

  return {
    patientId: visit.patientId,
    patientName: visit.patient.displayName,
    clinicianId,
    visitId: visit.id,
    visitDate: visit.startedAt,
    visitStatus: visit.status,
    chiefComplaint: visit.chiefComplaint?.trim() || 'Follow-up visit',
    transcriptText,
    summary: visit.documentation.summary,
    soapNotes: visit.documentation.soapNotes,
    additionalNotes: visit.documentation.additionalNotes ?? '',
    artifacts,
    currentVisitCitations: buildCurrentVisitCitations(visit, transcriptText, artifacts),
    twin,
  }
}

async function buildTranscriptAgent(
  context: ReconciliationContext
): Promise<ReconciliationAgentResult> {
  const corpus = [context.summary, context.soapNotes, context.additionalNotes, context.transcriptText]
    .filter(Boolean)
    .join('\n')
  const entities = await extractMedicalEntities(corpus)
  const claims: EvidenceClaim[] = []
  const bloodPressure = extractLatestBloodPressure(corpus)
  const medicationNames = Array.from(
    new Set(
      entities.medications
        .map((medication) => titleCase(medication.name))
        .concat(matchMedicationNames(corpus))
    )
  )

  if (bloodPressure) {
    claims.push({
      title: 'Current documented blood pressure',
      statement: `Current visit documentation records blood pressure at ${bloodPressure.systolic}/${bloodPressure.diastolic} mmHg.`,
      category: 'blood_pressure',
      status:
        bloodPressure.systolic >= 140 || bloodPressure.diastolic >= 90 ? 'watch' : 'supported',
      confidence: 89,
      evidence: selectCitations(context.currentVisitCitations, [
        'blood pressure',
        'bp',
        `${bloodPressure.systolic}/${bloodPressure.diastolic}`,
      ]),
    })
  }

  if (medicationNames.length > 0) {
    claims.push({
      title: 'Medication plan appears in the transcript',
      statement: `Current visit notes mention ${medicationNames.join(', ')} as part of the active treatment plan.`,
      category: 'medication',
      status: 'supported',
      confidence: 82,
      evidence: selectCitations(context.currentVisitCitations, medicationNames),
    })
  }

  const positiveAdherence = /mostly adherent|taking .* daily|good medication adherence|adherent/i.test(
    corpus
  )
  const negativeAdherence = /missed dose|run out|nearly empty|refill|travel/i.test(corpus)
  if (positiveAdherence || negativeAdherence) {
    claims.push({
      title: 'Self-reported adherence signal',
      statement: positiveAdherence && negativeAdherence
        ? 'The current visit suggests mostly daily medication use, but it also records recent missed doses or refill pressure.'
        : positiveAdherence
          ? 'The patient describes mostly consistent medication use in the current visit.'
          : 'The current visit records missed doses or refill pressure that could interrupt medication continuity.',
      category: 'medication_adherence',
      status: positiveAdherence && negativeAdherence ? 'watch' : positiveAdherence ? 'supported' : 'conflicted',
      confidence: positiveAdherence && negativeAdherence ? 68 : positiveAdherence ? 78 : 84,
      evidence: selectCitations(context.currentVisitCitations, [
        'missed dose',
        'travel',
        'refill',
        'daily',
        'adherence',
      ]),
    })
  }

  if (/headache/i.test(corpus)) {
    const improved = /improved|less intense|mild|better/i.test(corpus)
    claims.push({
      title: 'Symptom course',
      statement: improved
        ? 'Headaches are described as improved and milder than the earlier baseline.'
        : 'Headaches are still present in the current visit documentation.',
      category: 'symptom',
      status: improved ? 'supported' : 'watch',
      confidence: improved ? 80 : 73,
      evidence: selectCitations(context.currentVisitCitations, ['headache', 'headaches']),
    })
  }

  if (/lab|cmp|microalbumin|repeat labs?/i.test(corpus)) {
    claims.push({
      title: 'Repeat lab follow-up remains in scope',
      statement:
        'Current documentation still references repeat labs as part of the hypertension follow-up plan.',
      category: 'follow_up',
      status: 'watch',
      confidence: 76,
      evidence: selectCitations(context.currentVisitCitations, [
        'lab',
        'cmp',
        'microalbumin',
        'repeat',
      ]),
    })
  }

  const dedupedClaims = dedupeClaims(claims)
  return {
    agentKey: 'transcript',
    status: 'completed',
    summary: buildAgentSummary(
      'Transcript Agent',
      dedupedClaims,
      'The transcript lane did not find high-signal clinical claims in the current visit.'
    ),
    confidence: averageConfidence(dedupedClaims, 74),
    claims: dedupedClaims,
    citations: dedupeCitations(dedupedClaims.flatMap((claim) => claim.evidence)),
  }
}

async function buildArtifactAgent(
  context: ReconciliationContext
): Promise<ReconciliationAgentResult> {
  const claims: EvidenceClaim[] = []

  for (const artifact of context.artifacts) {
    const excerpt = artifact.extractedText || buildArtifactEvidenceExcerpt(artifact)
    const evidence = [
      citationFromCurrentVisit(
        context,
        `Artifact: ${artifact.label}`,
        excerpt || artifact.summary || artifact.label
      ),
    ]

    const bloodPressureVital = artifact.vitals.find((vital) =>
      /blood pressure|\bbp\b/i.test(vital.type)
    )
    if (bloodPressureVital) {
      claims.push({
        title: `${artifact.label} confirms recent BP readings`,
        statement: `Uploaded evidence shows ${bloodPressureVital.value}${bloodPressureVital.label ? ` (${bloodPressureVital.label})` : ''}.`,
        category: 'blood_pressure',
        status: 'supported',
        confidence: 90,
        evidence,
      })
    }

    if (artifact.medications.length > 0) {
      const medication = artifact.medications[0]
      claims.push({
        title: `${artifact.label} confirms the medication regimen`,
        statement: `${artifact.label} visually supports ${[medication.name, medication.dosage, medication.frequency].filter(Boolean).join(' ')}.`,
        category: 'medication',
        status: 'supported',
        confidence: 86,
        evidence,
      })
    }

    if (/refills?\s*:?\s*0|no refills? remaining|refill needed|nearly empty/i.test(excerpt)) {
      claims.push({
        title: `${artifact.label} shows refill pressure`,
        statement:
          'Artifact evidence indicates the medication supply is close to exhaustion or has no refills remaining.',
        category: 'medication_adherence',
        status: 'conflicted',
        confidence: 88,
        evidence,
      })
    }

    if (/high 130s|low 140s|trend improving|improvement from the initial visit|missed doses/i.test(
      `${artifact.summary} ${artifact.findings.join(' ')} ${excerpt}`
    )) {
      claims.push({
        title: `${artifact.label} adds context to the BP trend`,
        statement:
          'The uploaded log suggests blood pressure is improving compared with the baseline, but it still needs continued follow-up.',
        category: 'timeline',
        status: 'watch',
        confidence: 79,
        evidence,
      })
    }

    if (
      /lab|cmp|microalbumin|repeat/i.test(
        `${artifact.summary} ${artifact.instructions.join(' ')} ${excerpt}`
      )
    ) {
      claims.push({
        title: `${artifact.label} keeps lab follow-up active`,
        statement:
          'Artifact evidence shows repeat lab work remains part of the current follow-up plan.',
        category: 'follow_up',
        status: 'watch',
        confidence: 80,
        evidence,
      })
    }
  }

  if (claims.length === 0) {
    claims.push({
      title: 'No structured artifact evidence was available',
      statement:
        'This run did not find artifact-derived clinical claims, so the clinician should rely on transcript and longitudinal evidence.',
      category: 'artifact',
      status: 'unresolved',
      confidence: 42,
      evidence: [],
    })
  }

  const dedupedClaims = dedupeClaims(claims)
  return {
    agentKey: 'artifact',
    status: 'completed',
    summary: buildAgentSummary(
      'Artifact Agent',
      dedupedClaims,
      'The artifact lane did not find extracted evidence in this run.'
    ),
    confidence: averageConfidence(dedupedClaims, 70),
    claims: dedupedClaims,
    citations: dedupeCitations(dedupedClaims.flatMap((claim) => claim.evidence)),
  }
}

async function buildTimelineAgent(
  context: ReconciliationContext
): Promise<ReconciliationAgentResult> {
  const claims: EvidenceClaim[] = []
  const firstBp = context.twin.bpHistory[0]
  const latestBp = context.twin.bpHistory[context.twin.bpHistory.length - 1]

  if (firstBp && latestBp && context.twin.bpHistory.length >= 2) {
    const improved = latestBp.systolic < firstBp.systolic || latestBp.diastolic < firstBp.diastolic
    claims.push({
      title: 'Cross-visit blood pressure trend',
      statement: `Across the recorded timeline, blood pressure moved from ${firstBp.systolic}/${firstBp.diastolic} to ${latestBp.systolic}/${latestBp.diastolic}.`,
      category: 'timeline',
      status: improved ? 'supported' : 'watch',
      confidence: improved ? 87 : 72,
      evidence: selectCitations(
        serializeTwinCitations(context.twin.citations),
        [
          'blood pressure',
          'bp',
          `${firstBp.systolic}/${firstBp.diastolic}`,
          `${latestBp.systolic}/${latestBp.diastolic}`,
        ],
        3
      ),
    })
  }

  if (context.twin.nextAppointment) {
    claims.push({
      title: 'A follow-up appointment is already scheduled',
      statement: `${context.twin.nextAppointment.title} is scheduled for ${formatDateTime(context.twin.nextAppointment.scheduledFor)}.`,
      category: 'follow_up',
      status: 'supported',
      confidence: 84,
      evidence: selectCitations(
        serializeTwinCitations(context.twin.citations),
        ['appointment', context.twin.nextAppointment.title]
      ),
    })
  }

  if (context.twin.openPlanItems.length > 0) {
    claims.push({
      title: 'Open follow-up tasks are still active',
      statement: `${context.twin.openPlanItems.length} care-plan item${context.twin.openPlanItems.length === 1 ? '' : 's'} remain open across the longitudinal record.`,
      category: 'follow_up',
      status: 'watch',
      confidence: 83,
      evidence: selectCitations(
        serializeTwinCitations(context.twin.citations),
        ['plan', 'follow-up', 'lab', 'call', 'repeat'],
        3
      ),
    })
  }

  if (context.twin.followUpRisks.length > 0) {
    claims.push({
      title: 'Longitudinal risks remain visible',
      statement: context.twin.followUpRisks[0],
      category: 'risk',
      status: 'watch',
      confidence: 78,
      evidence: selectCitations(
        serializeTwinCitations(context.twin.citations),
        tokenize(context.twin.followUpRisks[0]),
        2
      ),
    })
  }

  const dedupedClaims = dedupeClaims(claims)
  return {
    agentKey: 'timeline',
    status: 'completed',
    summary: buildAgentSummary(
      'Timeline Agent',
      dedupedClaims,
      'The timeline lane did not find cross-visit evidence for this run.'
    ),
    confidence: averageConfidence(dedupedClaims, 72),
    claims: dedupedClaims,
    citations: dedupeCitations(dedupedClaims.flatMap((claim) => claim.evidence)),
  }
}

function buildConflictLedger(
  context: ReconciliationContext,
  agents: {
    transcript: ReconciliationAgentResult
    artifact: ReconciliationAgentResult
    timeline: ReconciliationAgentResult
  }
) {
  const conflicts: ConflictRecord[] = []
  const transcriptText = `${context.summary}\n${context.soapNotes}\n${context.transcriptText}`
  const artifactText = context.artifacts
    .map(
      (artifact) =>
        `${artifact.label} ${artifact.summary} ${artifact.extractedText} ${artifact.findings.join(' ')}`
    )
    .join('\n')

  const adherencePositive = /mostly adherent|taking .* daily|good medication adherence|daily with one missed/i.test(
    transcriptText
  )
  const adherenceNegative = /missed dose|run out|nearly empty|refill|0 refills?/i.test(
    `${transcriptText}\n${artifactText}`
  )

  if (adherencePositive && adherenceNegative) {
    conflicts.push({
      title: 'Medication adherence confidence is mixed',
      detail:
        'The current note sounds mostly adherent, but the record also shows missed-dose history or refill pressure. That should stay medium-confidence until refill pickup is confirmed.',
      severity: 'high',
      evidence: dedupeCitations(
        selectCitations(context.currentVisitCitations, [
          'missed dose',
          'travel',
          'refill',
          'daily',
          'adherence',
        ]).concat(selectCitations(agents.artifact.citations, ['refill', '0', 'bottle', 'lisinopril'], 2))
      ).slice(0, 4),
    })
  }

  const latestBp = context.twin.bpHistory[context.twin.bpHistory.length - 1]
  const firstBp = context.twin.bpHistory[0]
  if (
    latestBp &&
    firstBp &&
    (latestBp.systolic < firstBp.systolic || latestBp.diastolic < firstBp.diastolic) &&
    (latestBp.systolic >= 135 || latestBp.diastolic >= 85)
  ) {
    conflicts.push({
      title: 'The BP trend is improving but not closed',
      detail:
        'Longitudinal readings are better than the baseline, but the latest documented pressure still sits above an ideal follow-up target.',
      severity: 'medium',
      evidence: selectCitations(
        serializeTwinCitations(context.twin.citations),
        ['blood pressure', 'bp', `${latestBp.systolic}/${latestBp.diastolic}`],
        3
      ),
    })
  }

  if (
    context.twin.nextAppointment &&
    context.twin.openPlanItems.some((item) => /lab|cmp|microalbumin|repeat/i.test(`${item.title} ${item.details}`))
  ) {
    conflicts.push({
      title: 'The next appointment is scheduled before all follow-up work is visibly closed',
      detail:
        'A future review is on the calendar, but the chart still shows open lab-related follow-up items that need confirmation before that visit.',
      severity: 'low',
      evidence: dedupeCitations(
        selectCitations(serializeTwinCitations(context.twin.citations), ['appointment'], 1).concat(
          selectCitations(serializeTwinCitations(context.twin.citations), ['lab', 'cmp', 'microalbumin', 'repeat'], 2)
        )
      ).slice(0, 3),
    })
  }

  return dedupeConflicts(conflicts)
}

function buildUnresolvedQuestions(context: ReconciliationContext, conflicts: ConflictRecord[]) {
  const questions = new Set(context.twin.openQuestions)

  if (conflicts.some((conflict) => /adherence/i.test(conflict.title))) {
    questions.add('Has the refill actually been picked up and restarted without missed doses?')
  }
  if (conflicts.some((conflict) => /lab/i.test(conflict.title))) {
    questions.add('Were the repeat labs completed and added back into the chart?')
  }
  if (context.artifacts.some((artifact) => /blood pressure log|log photo/i.test(artifact.label))) {
    questions.add('Do the next clinic vitals match the improving home blood-pressure log?')
  }

  return Array.from(questions).slice(0, 5)
}

function buildSuggestedActions(context: ReconciliationContext, conflicts: ConflictRecord[]) {
  const actions: SuggestedActionDraft[] = []
  const refillPlan = findOpenPlanItem(context.twin, ['refill', 'lisinopril', 'adherence', 'dose'])
  const labPlan = findOpenPlanItem(context.twin, ['lab', 'cmp', 'microalbumin', 'repeat'])

  if (
    conflicts.some((conflict) => /adherence/i.test(conflict.title)) ||
    /missed dose|refill|run out/i.test(`${context.summary}\n${context.soapNotes}\n${context.transcriptText}`)
  ) {
    actions.push({
      kind: 'care_plan_item',
      title: refillPlan
        ? 'Escalate refill confirmation before the next follow-up'
        : 'Confirm lisinopril refill pickup',
      details: refillPlan
        ? `An adherence-related follow-up item is already open ("${refillPlan.title}"). Confirm pickup and document any remaining missed-dose barriers before the next review.`
        : 'Confirm whether the lisinopril refill was picked up and document any remaining barriers to daily use.',
      rationale:
        'Transcript and artifact evidence do not fully agree on adherence confidence, so refill status needs an explicit close-the-loop step.',
      payload: {
        dueAt: addDays(context.visitDate, 5).toISOString(),
      },
    })
  }

  if (
    conflicts.some((conflict) => /lab/i.test(conflict.title)) ||
    /lab|cmp|microalbumin|repeat/i.test(
      `${context.summary}\n${context.soapNotes}\n${context.artifacts.map((artifact) => `${artifact.summary} ${artifact.extractedText}`).join('\n')}`
    )
  ) {
    actions.push({
      kind: 'care_plan_item',
      title: labPlan
        ? 'Escalate lab completion check before follow-up'
        : 'Verify repeat labs are completed before follow-up',
      details: labPlan
        ? `A lab-related plan item is already open ("${labPlan.title}"). Verify completion and pull the results into the chart before the scheduled review.`
        : 'Repeat CMP and urine microalbumin remain part of the plan and should be confirmed before the next visit.',
      rationale:
        'The evidence set still references repeat labs, but completion is not clearly visible in the chart.',
      payload: {
        dueAt: (
          context.twin.nextAppointment
            ? addDays(context.twin.nextAppointment.scheduledFor, -2)
            : addDays(context.visitDate, 14)
        ).toISOString(),
      },
    })
  }

  if (
    !context.twin.nextAppointment &&
    conflicts.some((conflict) => /bp|blood pressure|follow-up/i.test(conflict.title.toLowerCase()))
  ) {
    actions.push({
      kind: 'appointment',
      title: 'Hypertension follow-up and evidence review',
      details:
        'Schedule a follow-up to review the BP trend, refill status, and any remaining lab work.',
      rationale: 'Active longitudinal risks remain open without a future appointment on the calendar.',
      payload: {
        scheduledFor: addDays(context.visitDate, 21).toISOString(),
        notes: 'Review BP trend, medication adherence, and pending labs.',
      },
    })
  }

  return actions.slice(0, 3)
}

async function buildConsensusSummary({
  context,
  supportedClaims,
  conflicts,
  unresolvedQuestions,
  suggestedActions,
}: {
  context: ReconciliationContext
  supportedClaims: EvidenceClaim[]
  conflicts: ConflictRecord[]
  unresolvedQuestions: string[]
  suggestedActions: SuggestedActionDraft[]
}) {
  const fallback = buildFallbackConsensusSummary({
    patientName: context.patientName,
    supportedClaims,
    conflicts,
    unresolvedQuestions,
    suggestedActions,
  })

  if (!isNovaConfigured()) {
    return fallback
  }

  try {
    const prompt = `You are Synth Evidence Lab.
Write a concise 2 sentence reconciliation summary for a clinician.
Use only the provided evidence and stay conservative.

Patient: ${context.patientName}
Current visit: ${context.chiefComplaint} on ${context.visitDate.toISOString()}

Supported claims:
${supportedClaims.map((claim) => `- ${claim.statement}`).join('\n') || '- none'}

Conflicts:
${conflicts.map((conflict) => `- ${conflict.title}: ${conflict.detail}`).join('\n') || '- none'}

Open questions:
${unresolvedQuestions.map((question) => `- ${question}`).join('\n') || '- none'}

Suggested actions:
${suggestedActions.map((action) => `- ${action.title}: ${action.details}`).join('\n') || '- none'}

Return plain text only.`

    const response = (await generateNovaText({
      prompt,
      maxTokens: 220,
      temperature: 0.15,
    })).trim()

    return response || fallback
  } catch {
    return fallback
  }
}

async function safelyRunAgent(
  agentKey: ReconciliationAgentKey,
  task: () => Promise<ReconciliationAgentResult>
): Promise<ReconciliationAgentResult> {
  try {
    return await task()
  } catch (error) {
    console.error(`Reconciliation ${agentKey} agent failed:`, error)
    return {
      agentKey,
      status: 'failed' as const,
      summary: `The ${agentKey} agent did not complete in this run.`,
      confidence: 0,
      claims: [],
      citations: [],
    }
  }
}

function mapRunSummary(row: {
  id: string
  patientId: string
  status: string
  overallConfidence: number | null
  consensusSummary: string | null
  createdAt: Date
  patient: { displayName: string }
  visit: { id: string; startedAt: Date }
  agentOutputs: Array<{ id: string }>
  actions: Array<{ status: string }>
}): ReconciliationRunSummary {
  return {
    id: row.id,
    patientId: row.patientId,
    patientName: row.patient.displayName,
    visitId: row.visit.id,
    visitDate: row.visit.startedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    status: normalizeRunStatus(row.status),
    overallConfidence: row.overallConfidence ?? null,
    consensusSummary: compactWhitespace(row.consensusSummary ?? ''),
    agentCount: row.agentOutputs.length,
    actionCounts: {
      suggested: row.actions.filter((action) => action.status === 'suggested').length,
      dismissed: row.actions.filter((action) => action.status === 'dismissed').length,
      applied: row.actions.filter((action) => action.status === 'applied').length,
    },
  }
}

function mapRunDetail(run: {
  id: string
  patientId: string
  status: string
  overallConfidence: number | null
  consensusSummary: string | null
  supportedClaimsJson: string | null
  conflictsJson: string | null
  unresolvedQuestionsJson: string | null
  createdAt: Date
  patient: { displayName: string }
  visit: { id: string; startedAt: Date }
  agentOutputs: Array<{
    agentKey: string
    status: string
    summary: string | null
    confidence: number | null
    claimsJson: string | null
    citationsJson: string | null
  }>
  actions: Array<{
    id: string
    kind: string
    title: string
    details: string | null
    rationale: string | null
    payloadJson: string | null
    status: string
    appliedRecordType: string | null
    appliedRecordId: string | null
    createdAt: Date
    updatedAt: Date
  }>
}): ReconciliationRunDetail {
  const summary = mapRunSummary({
    ...run,
    agentOutputs: run.agentOutputs.map((output) => ({ id: output.agentKey })),
    actions: run.actions.map((action) => ({ status: action.status })),
  })

  return {
    ...summary,
    supportedClaims: parseJson<EvidenceClaim[]>(run.supportedClaimsJson, []),
    conflicts: parseJson<ConflictRecord[]>(run.conflictsJson, []),
    unresolvedQuestions: parseJson<string[]>(run.unresolvedQuestionsJson, []),
    agentOutputs: run.agentOutputs.map((output) => ({
      agentKey: normalizeAgentKey(output.agentKey),
      status: output.status === 'failed' ? 'failed' : 'completed',
      summary: compactWhitespace(output.summary ?? ''),
      confidence: output.confidence ?? 0,
      claims: parseJson<EvidenceClaim[]>(output.claimsJson, []),
      citations: parseJson<ReconciliationCitation[]>(output.citationsJson, []),
    })),
    actions: run.actions.map((action) => ({
      id: action.id,
      kind: action.kind === 'appointment' ? 'appointment' : 'care_plan_item',
      title: action.title,
      details: action.details ?? '',
      rationale: action.rationale ?? '',
      payload: parseJson<SuggestedActionPayload | undefined>(action.payloadJson, undefined),
      status: normalizeActionStatus(action.status),
      appliedRecordType: action.appliedRecordType,
      appliedRecordId: action.appliedRecordId,
      createdAt: action.createdAt.toISOString(),
      updatedAt: action.updatedAt.toISOString(),
    })),
  }
}

function buildCurrentVisitCitations(
  visit: VisitRow,
  transcriptText: string,
  artifacts: NormalizedVisitArtifact[]
) {
  const citations: ReconciliationCitation[] = []

  if (visit.documentation?.summary) {
    citations.push({
      source: 'Summary',
      visitId: visit.id,
      visitDate: visit.startedAt.toISOString(),
      excerpt: compactWhitespace(visit.documentation.summary).slice(0, 220),
    })
  }
  if (visit.documentation?.soapNotes) {
    citations.push({
      source: 'SOAP',
      visitId: visit.id,
      visitDate: visit.startedAt.toISOString(),
      excerpt: compactWhitespace(visit.documentation.soapNotes).slice(0, 220),
    })
  }
  const transcriptHighlight = selectTranscriptHighlight(transcriptText)
  if (transcriptHighlight) {
    citations.push({
      source: 'Transcript',
      visitId: visit.id,
      visitDate: visit.startedAt.toISOString(),
      excerpt: transcriptHighlight,
    })
  }
  for (const artifact of artifacts) {
    citations.push({
      source: `Artifact: ${artifact.label}`,
      visitId: visit.id,
      visitDate: visit.startedAt.toISOString(),
      excerpt: compactWhitespace(buildArtifactEvidenceExcerpt(artifact)).slice(0, 220),
    })
  }
  for (const item of visit.carePlanItems.filter((plan) => plan.status !== 'completed').slice(0, 2)) {
    citations.push({
      source: 'Plan',
      visitId: visit.id,
      visitDate: visit.startedAt.toISOString(),
      excerpt: compactWhitespace(`${item.title}${item.details ? ` - ${item.details}` : ''}`).slice(
        0,
        220
      ),
    })
  }
  for (const appointment of visit.appointments.slice(0, 1)) {
    citations.push({
      source: 'Appointment',
      visitId: visit.id,
      visitDate: visit.startedAt.toISOString(),
      excerpt: compactWhitespace(
        `${appointment.title} on ${appointment.scheduledFor.toLocaleString()}${appointment.notes ? ` - ${appointment.notes}` : ''}`
      ).slice(0, 220),
    })
  }

  return dedupeCitations(citations)
}

function citationFromCurrentVisit(
  context: ReconciliationContext,
  source: string,
  excerpt: string
): ReconciliationCitation {
  return {
    source,
    visitId: context.visitId,
    visitDate: context.visitDate.toISOString(),
    excerpt: compactWhitespace(excerpt).slice(0, 220),
  }
}

function serializeTwinCitations(citations: PatientTwinCitation[]) {
  return citations.map((citation) => ({
    source: citation.source,
    visitId: citation.visitId,
    visitDate: citation.visitDate.toISOString(),
    excerpt: compactWhitespace(citation.excerpt).slice(0, 220),
  }))
}

function selectCitations(citations: ReconciliationCitation[], keywords: string[], limit = 2) {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase()).filter(Boolean)
  if (normalizedKeywords.length === 0) {
    return citations.slice(0, limit)
  }

  const scored = citations
    .map((citation) => {
      const haystack = `${citation.source} ${citation.excerpt}`.toLowerCase()
      const score = normalizedKeywords.reduce(
        (total, keyword) => total + (haystack.includes(keyword) ? keyword.length : 0),
        0
      )
      return { citation, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.citation)

  return scored.length > 0 ? dedupeCitations(scored) : citations.slice(0, limit)
}

function rankClaims(claims: EvidenceClaim[]) {
  return dedupeClaims(claims).sort((left, right) => {
    const statusScore = claimStatusScore(right.status) - claimStatusScore(left.status)
    if (statusScore !== 0) return statusScore
    return right.confidence - left.confidence
  })
}

function dedupeClaims(claims: EvidenceClaim[]) {
  const seen = new Set<string>()
  return claims.filter((claim) => {
    const key = `${claim.title}|${claim.statement}|${claim.category}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function dedupeConflicts(conflicts: ConflictRecord[]) {
  const seen = new Set<string>()
  return conflicts.filter((conflict) => {
    const key = `${conflict.title}|${conflict.detail}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function dedupeCitations(citations: ReconciliationCitation[]) {
  const seen = new Set<string>()
  return citations.filter((citation) => {
    const key = `${citation.source}|${citation.visitId}|${citation.excerpt}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function buildAgentSummary(name: string, claims: EvidenceClaim[], fallback: string) {
  if (claims.length === 0) {
    return fallback
  }

  const top = claims.slice(0, 2).map((claim) => claim.statement)
  return `${name} found ${claims.length} structured signal${claims.length === 1 ? '' : 's'}: ${top.join(' ')}`
}

function buildFallbackConsensusSummary({
  patientName,
  supportedClaims,
  conflicts,
  unresolvedQuestions,
  suggestedActions,
}: {
  patientName: string
  supportedClaims: EvidenceClaim[]
  conflicts: ConflictRecord[]
  unresolvedQuestions: string[]
  suggestedActions: SuggestedActionDraft[]
}) {
  const firstClaim = supportedClaims[0]?.statement ?? `${patientName}'s current evidence set is limited.`
  const conflictLine =
    conflicts[0]?.detail ??
    'The run did not find a major evidence conflict, but some follow-up questions remain open.'
  const actionLine =
    suggestedActions[0]?.title ??
    unresolvedQuestions[0] ??
    'No additional action suggestions were generated in this run.'

  return `${firstClaim} ${conflictLine} Next best step: ${actionLine}.`
}

function computeOverallConfidence({
  claims,
  conflicts,
  agentOutputs,
}: {
  claims: EvidenceClaim[]
  conflicts: ConflictRecord[]
  agentOutputs: ReconciliationAgentResult[]
}) {
  const baseline = averageConfidence(claims, 68)
  const conflictPenalty = conflicts.reduce((total, conflict) => {
    if (conflict.severity === 'high') return total + 14
    if (conflict.severity === 'medium') return total + 8
    return total + 4
  }, 0)
  const failedAgentPenalty = agentOutputs.filter((agent) => agent.status === 'failed').length * 12
  return clamp(Math.round(baseline - conflictPenalty - failedAgentPenalty + 6), 18, 96)
}

function averageConfidence(claims: EvidenceClaim[], fallback: number) {
  if (claims.length === 0) {
    return fallback
  }
  return clamp(
    Math.round(claims.reduce((total, claim) => total + claim.confidence, 0) / claims.length),
    0,
    100
  )
}

function claimStatusScore(status: ReconciliationClaimStatus) {
  if (status === 'supported') return 4
  if (status === 'watch') return 3
  if (status === 'conflicted') return 2
  return 1
}

function extractLatestBloodPressure(text: string) {
  BP_REGEX.lastIndex = 0
  let match = BP_REGEX.exec(text)
  let latest: { systolic: number; diastolic: number } | null = null

  while (match) {
    const systolic = Number(match[1])
    const diastolic = Number(match[2])
    if (isValidBloodPressure(systolic, diastolic)) {
      latest = { systolic, diastolic }
    }
    match = BP_REGEX.exec(text)
  }

  return latest
}

function matchMedicationNames(text: string) {
  const matches = text.match(/\b(lisinopril|losartan|amlodipine|metformin|atorvastatin)\b/gi) ?? []
  return Array.from(new Set(matches.map((value) => titleCase(value))))
}

function findOpenPlanItem(twin: PatientTwinContext, keywords: string[]) {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase())
  return (
    twin.openPlanItems.find((item) => {
      const haystack = `${item.title} ${item.details}`.toLowerCase()
      return normalizedKeywords.some((keyword) => haystack.includes(keyword))
    }) ?? null
  )
}

function toTranscriptText(rawTranscriptJson: string) {
  try {
    const segments = JSON.parse(rawTranscriptJson) as TranscriptSegment[]
    if (!Array.isArray(segments)) {
      return ''
    }

    return segments
      .filter(
        (segment) =>
          typeof segment.start_ms === 'number' &&
          typeof segment.text === 'string' &&
          (segment.speaker === 'clinician' || segment.speaker === 'patient')
      )
      .map((segment) => {
        const startSec = Math.floor(segment.start_ms / 1000)
        const mm = Math.floor(startSec / 60)
          .toString()
          .padStart(2, '0')
        const ss = (startSec % 60).toString().padStart(2, '0')
        const label = segment.speaker === 'clinician' ? 'Doctor' : 'Patient'
        return `[${mm}:${ss}] ${label}: ${segment.text}`
      })
      .join('\n')
  } catch {
    return ''
  }
}

function selectTranscriptHighlight(transcriptText: string) {
  if (!transcriptText) {
    return ''
  }

  const lines = transcriptText.split('\n')
  const highlighted =
    lines.find((line) => /blood pressure|\bbp\b|refill|missed dose|headache|lisinopril/i.test(line)) ??
    lines.find(Boolean) ??
    ''

  return compactWhitespace(highlighted).slice(0, 220)
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4)
}

function compactWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (match) => match.toUpperCase())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseDate(value: string | undefined) {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function isValidBloodPressure(systolic: number, diastolic: number) {
  return systolic >= 70 && systolic <= 260 && diastolic >= 40 && diastolic <= 160
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeAgentKey(value: string): ReconciliationAgentKey {
  if (value === 'artifact' || value === 'timeline' || value === 'reconciler') {
    return value
  }
  return 'transcript'
}

function normalizeRunStatus(value: string): ReconciliationRunStatus {
  if (value === 'completed' || value === 'partial' || value === 'failed') {
    return value
  }
  return 'running'
}

function normalizeActionStatus(value: string): ReconciliationActionStatus {
  if (value === 'dismissed' || value === 'approved' || value === 'applied') {
    return value
  }
  return 'suggested'
}

