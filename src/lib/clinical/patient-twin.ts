import type { TranscriptSegment } from '@/lib/clinical/clinical-notes'
import { prisma } from '@/lib/data/prisma'
import {
  buildArtifactEvidenceExcerpt,
  parseStoredArtifact,
  type NormalizedVisitArtifact,
} from '@/lib/clinical/visit-artifacts'

type TwinVisitRow = {
  id: string
  patientId: string
  status: string
  chiefComplaint: string | null
  startedAt: Date
  finalizedAt: Date | null
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

export interface PatientTwinCitation {
  source: string
  visitId: string
  visitDate: Date
  excerpt: string
}

export interface PatientTwinTrendPoint {
  visitId: string
  visitDate: Date
  label: string
  systolic: number
  diastolic: number
  source: string
  excerpt: string
}

export interface PatientTwinMedication {
  name: string
  dosage?: string
  frequency?: string
  firstSeen: Date
  lastSeen: Date
  sourceLabels: string[]
}

export interface PatientTwinTrendSignal {
  title: string
  value: string
  detail: string
  status: 'improved' | 'watch' | 'stable'
}

export interface PatientTwinInsight {
  title: string
  detail: string
  source: string
  visitId: string
  visitDate: Date
}

export interface PatientTwinTimelineEvent {
  visitId: string
  visitDate: Date
  title: string
  status: string
  chiefComplaint: string
  summary: string
  bloodPressure: string | null
  artifactLabels: string[]
  keyChanges: string[]
  followUp: string[]
  citations: PatientTwinCitation[]
}

export interface PatientTwinContext {
  patientId: string
  patientName: string
  latestVisitId: string
  latestVisitDate: Date
  visitCount: number
  overview: string
  storyline: string
  activeConditions: string[]
  medications: PatientTwinMedication[]
  trendSignals: PatientTwinTrendSignal[]
  evidenceInsights: PatientTwinInsight[]
  followUpRisks: string[]
  openQuestions: string[]
  recommendedQuestions: string[]
  nextAppointment: {
    title: string
    scheduledFor: Date
    notes: string
  } | null
  openPlanItems: Array<{
    id: string
    visitId: string
    title: string
    details: string
    dueAt: Date | null
    status: string
  }>
  timeline: PatientTwinTimelineEvent[]
  bpHistory: PatientTwinTrendPoint[]
  citations: PatientTwinCitation[]
}

type VisitSummaryContext = {
  visit: TwinVisitRow
  transcriptText: string
  artifacts: NormalizedVisitArtifact[]
  citations: PatientTwinCitation[]
  bloodPressure: PatientTwinTrendPoint | null
}

const BP_LABELED_REGEX = /(?:blood pressure|\bbp\b)[^0-9]{0,20}(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})/gi
const BP_GENERIC_REGEX = /(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})/gi
const CONDITION_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'Hypertension', patterns: [/\bhypertension\b/i, /\bblood pressure\b/i] },
  { label: 'Headaches', patterns: [/\bheadaches?\b/i, /\bmigraine\b/i] },
  { label: 'Medication adherence', patterns: [/\bmissed dose\b/i, /\badherence\b/i, /\brefill\b/i] },
  { label: 'Lifestyle modification', patterns: [/\bwalking\b/i, /\bsodium\b/i, /\bsalty snacks\b/i] },
]
const MEDICATION_REGEX =
  /\b(lisinopril|metformin|atorvastatin|amlodipine|losartan|aspirin|ibuprofen)\b(?:[^.\n]{0,24}?(\d+\s*mg))?(?:[^.\n]{0,24}?\b(once daily|daily|twice daily|bid|nightly)\b)?/gi

export async function getPatientTwinForClinician({
  patientId,
  clinicianId,
}: {
  patientId: string
  clinicianId: string
}): Promise<PatientTwinContext | null> {
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      visits: {
        some: {
          clinicianId,
        },
      },
    },
    select: {
      id: true,
      displayName: true,
    },
  })

  if (!patient) {
    return null
  }

  const visits = (await prisma.visit.findMany({
    where: {
      patientId,
      clinicianId,
    },
    orderBy: { startedAt: 'asc' },
    include: {
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
  })) as TwinVisitRow[]

  if (visits.length === 0) {
    return null
  }

  return buildPatientTwinContext(patient.id, patient.displayName, visits)
}

export async function getPatientTwinForVisit(visitId: string): Promise<PatientTwinContext | null> {
  const anchorVisit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      patientId: true,
      patient: {
        select: {
          displayName: true,
        },
      },
      clinicianId: true,
    },
  })

  if (!anchorVisit) {
    return null
  }

  const visits = (await prisma.visit.findMany({
    where: {
      patientId: anchorVisit.patientId,
      clinicianId: anchorVisit.clinicianId,
    },
    orderBy: { startedAt: 'asc' },
    include: {
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
  })) as TwinVisitRow[]

  if (visits.length === 0) {
    return null
  }

  return buildPatientTwinContext(
    anchorVisit.patientId,
    anchorVisit.patient.displayName,
    visits
  )
}

export function formatPatientTwinForPrompt(twin: PatientTwinContext) {
  const timeline = twin.timeline
    .map((event, index) => {
      const lines = [
        `${index + 1}. ${event.visitDate.toISOString()} | ${event.title} | ${event.summary}`,
      ]
      if (event.bloodPressure) {
        lines.push(`BP: ${event.bloodPressure}`)
      }
      if (event.keyChanges.length > 0) {
        lines.push(`Changes: ${event.keyChanges.join(' | ')}`)
      }
      if (event.followUp.length > 0) {
        lines.push(`Follow-up: ${event.followUp.join(' | ')}`)
      }
      if (event.artifactLabels.length > 0) {
        lines.push(`Artifacts: ${event.artifactLabels.join(' | ')}`)
      }
      return lines.join('\n')
    })
    .join('\n\n')

  const medications =
    twin.medications.length === 0
      ? 'No medication history extracted.'
      : twin.medications
          .map((medication) =>
            [
              medication.name,
              medication.dosage,
              medication.frequency,
              `(seen ${formatShortDate(medication.firstSeen)} to ${formatShortDate(medication.lastSeen)})`,
            ]
              .filter(Boolean)
              .join(' ')
          )
          .join('\n')

  const trends =
    twin.trendSignals.length === 0
      ? 'No cross-visit trend signals.'
      : twin.trendSignals
          .map((signal) => `${signal.title}: ${signal.value} | ${signal.detail}`)
          .join('\n')

  const risks =
    twin.followUpRisks.length === 0 ? 'No active follow-up risks.' : twin.followUpRisks.join('\n')

  return `Patient Twin Overview:
${twin.overview}

Storyline:
${twin.storyline}

Active Conditions:
${twin.activeConditions.join(' | ') || 'None identified'}

Medication History:
${medications}

Trend Signals:
${trends}

Follow-up Risks:
${risks}

Timeline:
${timeline}`
}

export function selectPatientTwinCitations({
  twin,
  question,
  responseText,
}: {
  twin: PatientTwinContext
  question: string
  responseText: string
}): PatientTwinCitation[] {
  const corpus = `${question} ${responseText}`.toLowerCase()
  const queryTokens = corpus.split(/[^a-z0-9]+/).filter((token) => token.length >= 3)
  const scored = twin.citations
    .map((citation) => {
      const haystack = `${citation.source} ${citation.excerpt}`.toLowerCase()
      let score = 0
      for (const token of queryTokens) {
        if (haystack.includes(token)) {
          score += token.length > 5 ? 2 : 1
        }
      }
      if (corpus.includes('blood pressure') && /blood pressure|\bbp\b|\d{2,3}\/\d{2,3}/.test(haystack)) {
        score += 5
      }
      if (corpus.includes('medication') && /lisinopril|refill|dose|tablet/.test(haystack)) {
        score += 5
      }
      if (corpus.includes('headache') && /headache/.test(haystack)) {
        score += 4
      }
      if (corpus.includes('follow') && /follow-up|labs|call|repeat/.test(haystack)) {
        score += 3
      }
      if (citation.source.startsWith('Artifact:') && corpus.includes('artifact')) {
        score += 3
      }
      return { citation, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.citation.visitDate.getTime() - a.citation.visitDate.getTime())

  if (scored.length > 0) {
    return scored.slice(0, 4).map((entry) => entry.citation)
  }

  return twin.citations
    .slice()
    .sort((a, b) => b.visitDate.getTime() - a.visitDate.getTime())
    .slice(0, 3)
}

function buildPatientTwinContext(
  patientId: string,
  patientName: string,
  visits: TwinVisitRow[]
): PatientTwinContext {
  const visitContexts = visits.map((visit) => buildVisitSummaryContext(visit))
  const latestVisit = visits[visits.length - 1]
  const latestVisitContext = visitContexts[visitContexts.length - 1]
  const bpHistory = visitContexts
    .map((context) => context.bloodPressure)
    .filter((point): point is PatientTwinTrendPoint => point !== null)
  const activeConditions = buildActiveConditions(visitContexts)
  const medications = buildMedicationHistory(visitContexts)
  const nextAppointment = buildNextAppointment(visits)
  const openPlanItems = buildOpenPlanItems(visits)
  const trendSignals = buildTrendSignals(bpHistory, visitContexts, medications, openPlanItems)
  const evidenceInsights = buildEvidenceInsights(visitContexts)
  const followUpRisks = buildFollowUpRisks({
    latestVisitContext,
    nextAppointment,
    openPlanItems,
    bpHistory,
  })
  const openQuestions = buildOpenQuestions({
    latestVisitContext,
    nextAppointment,
    openPlanItems,
  })
  const timeline = visitContexts.map((context, index) => buildTimelineEvent(context, index, visits.length))
  const citations = dedupeCitations(visitContexts.flatMap((context) => context.citations))
  const overview = buildOverview({
    patientName,
    visitCount: visits.length,
    bpHistory,
    latestVisitContext,
    medications,
  })
  const storyline = buildStoryline({ bpHistory, visitContexts, openPlanItems })
  const recommendedQuestions = buildRecommendedQuestions(patientName)

  return {
    patientId,
    patientName,
    latestVisitId: latestVisit.id,
    latestVisitDate: latestVisit.startedAt,
    visitCount: visits.length,
    overview,
    storyline,
    activeConditions,
    medications,
    trendSignals,
    evidenceInsights,
    followUpRisks,
    openQuestions,
    recommendedQuestions,
    nextAppointment,
    openPlanItems,
    timeline,
    bpHistory,
    citations,
  }
}

function buildVisitSummaryContext(visit: TwinVisitRow): VisitSummaryContext {
  const transcriptText = toTranscriptText(visit.documentation?.transcriptJson ?? null)
  const artifacts = visit.artifacts.map((artifact) => parseStoredArtifact(artifact))
  const citations = buildVisitCitations(visit, transcriptText, artifacts)
  const bloodPressure = extractVisitBloodPressure(visit, transcriptText, artifacts)

  return {
    visit,
    transcriptText,
    artifacts,
    citations,
    bloodPressure,
  }
}

function buildVisitCitations(
  visit: TwinVisitRow,
  transcriptText: string,
  artifacts: NormalizedVisitArtifact[]
) {
  const citations: PatientTwinCitation[] = []

  if (visit.documentation?.summary) {
    citations.push({
      source: 'Summary',
      visitId: visit.id,
      visitDate: visit.startedAt,
      excerpt: compactWhitespace(visit.documentation.summary).slice(0, 220),
    })
  }

  if (visit.documentation?.soapNotes) {
    citations.push({
      source: 'SOAP',
      visitId: visit.id,
      visitDate: visit.startedAt,
      excerpt: compactWhitespace(visit.documentation.soapNotes).slice(0, 220),
    })
  }

  const transcriptLine = selectTranscriptHighlight(transcriptText)
  if (transcriptLine) {
    citations.push({
      source: 'Transcript',
      visitId: visit.id,
      visitDate: visit.startedAt,
      excerpt: transcriptLine,
    })
  }

  for (const artifact of artifacts) {
    citations.push({
      source: `Artifact: ${artifact.label}`,
      visitId: visit.id,
      visitDate: visit.startedAt,
      excerpt: compactWhitespace(buildArtifactEvidenceExcerpt(artifact)).slice(0, 220),
    })
  }

  for (const item of visit.carePlanItems.filter((plan) => plan.status !== 'completed').slice(0, 2)) {
    citations.push({
      source: 'Plan',
      visitId: visit.id,
      visitDate: visit.startedAt,
      excerpt: `${item.title}${item.details ? ` - ${compactWhitespace(item.details)}` : ''}`.slice(0, 220),
    })
  }

  for (const appointment of visit.appointments.slice(0, 1)) {
    citations.push({
      source: 'Appointment',
      visitId: visit.id,
      visitDate: visit.startedAt,
      excerpt: `${appointment.title} on ${appointment.scheduledFor.toLocaleString()}${appointment.notes ? ` - ${compactWhitespace(appointment.notes)}` : ''}`.slice(
        0,
        220
      ),
    })
  }

  return citations
}

function buildActiveConditions(visitContexts: VisitSummaryContext[]) {
  const found = new Set<string>()

  for (const context of visitContexts) {
    const haystack = [
      context.visit.chiefComplaint,
      context.visit.documentation?.summary,
      context.visit.documentation?.soapNotes,
      context.transcriptText,
      context.artifacts.map((artifact) => `${artifact.summary} ${artifact.findings.join(' ')}`).join(' '),
    ]
      .filter(Boolean)
      .join(' ')

    for (const condition of CONDITION_PATTERNS) {
      if (condition.patterns.some((pattern) => pattern.test(haystack))) {
        found.add(condition.label)
      }
    }
  }

  return Array.from(found).slice(0, 6)
}

function buildMedicationHistory(visitContexts: VisitSummaryContext[]) {
  const medicationMap = new Map<
    string,
    {
      name: string
      dosage?: string
      frequency?: string
      firstSeen: Date
      lastSeen: Date
      sourceLabels: Set<string>
    }
  >()

  for (const context of visitContexts) {
    const medicationCandidates = [
      ...context.artifacts.flatMap((artifact) =>
        artifact.medications.map((medication) => ({
          name: medication.name,
          dosage: medication.dosage,
          frequency: medication.frequency,
          source: artifact.label,
        }))
      ),
      ...extractMedicationMentions(
        [
          context.visit.documentation?.summary ?? '',
          context.visit.documentation?.soapNotes ?? '',
          context.transcriptText,
        ].join('\n')
      ),
    ]

    for (const candidate of medicationCandidates) {
      const key = candidate.name.toLowerCase()
      const existing = medicationMap.get(key)
      if (!existing) {
        medicationMap.set(key, {
          name: candidate.name,
          dosage: candidate.dosage,
          frequency: candidate.frequency,
          firstSeen: context.visit.startedAt,
          lastSeen: context.visit.startedAt,
          sourceLabels: new Set(candidate.source ? [candidate.source] : []),
        })
        continue
      }

      if (!existing.dosage && candidate.dosage) existing.dosage = candidate.dosage
      if (!existing.frequency && candidate.frequency) existing.frequency = candidate.frequency
      if (context.visit.startedAt < existing.firstSeen) existing.firstSeen = context.visit.startedAt
      if (context.visit.startedAt > existing.lastSeen) existing.lastSeen = context.visit.startedAt
      if (candidate.source) existing.sourceLabels.add(candidate.source)
    }
  }

  return Array.from(medicationMap.values())
    .map((entry) => ({
      name: entry.name,
      dosage: entry.dosage,
      frequency: entry.frequency,
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
      sourceLabels: Array.from(entry.sourceLabels),
    }))
    .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
    .slice(0, 6)
}

function buildNextAppointment(visits: TwinVisitRow[]) {
  const now = Date.now()
  const upcoming = visits
    .flatMap((visit) => visit.appointments)
    .filter((appointment) => appointment.scheduledFor.getTime() >= now)
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())[0]

  if (!upcoming) {
    return null
  }

  return {
    title: upcoming.title,
    scheduledFor: upcoming.scheduledFor,
    notes: upcoming.notes ?? '',
  }
}

function buildOpenPlanItems(visits: TwinVisitRow[]) {
  return visits
    .flatMap((visit) =>
      visit.carePlanItems
        .filter((item) => item.status !== 'completed')
        .map((item) => ({
          id: item.id,
          visitId: visit.id,
          title: item.title,
          details: item.details ?? '',
          dueAt: item.dueAt,
          status: item.status,
        }))
    )
    .sort((a, b) => {
      if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime()
      if (a.dueAt) return -1
      if (b.dueAt) return 1
      return a.title.localeCompare(b.title)
    })
    .slice(0, 6)
}

function buildTrendSignals(
  bpHistory: PatientTwinTrendPoint[],
  visitContexts: VisitSummaryContext[],
  medications: PatientTwinMedication[],
  openPlanItems: PatientTwinContext['openPlanItems']
) {
  const signals: PatientTwinTrendSignal[] = []

  if (bpHistory.length >= 2) {
    const first = bpHistory[0]
    const latest = bpHistory[bpHistory.length - 1]
    const systolicDelta = latest.systolic - first.systolic
    const diastolicDelta = latest.diastolic - first.diastolic
    const improved = systolicDelta < -3 || diastolicDelta < -3
    signals.push({
      title: 'Blood pressure trend',
      value: `${first.systolic}/${first.diastolic} -> ${latest.systolic}/${latest.diastolic}`,
      detail: `${Math.abs(systolicDelta)} mmHg systolic and ${Math.abs(diastolicDelta)} mmHg diastolic ${
        improved ? 'lower' : systolicDelta === 0 && diastolicDelta === 0 ? 'unchanged' : 'higher'
      } across documented visits.`,
      status: improved ? 'improved' : systolicDelta === 0 && diastolicDelta === 0 ? 'stable' : 'watch',
    })
  }

  const latestNarrative = [
    visitContexts[visitContexts.length - 1]?.visit.documentation?.summary ?? '',
    visitContexts[visitContexts.length - 1]?.visit.documentation?.soapNotes ?? '',
  ].join(' ')

  if (/improved|better|mild/i.test(latestNarrative) && /headache/i.test(latestNarrative)) {
    signals.push({
      title: 'Symptom course',
      value: 'Headaches improved',
      detail: 'Latest visit describes headache severity trending down compared with earlier complaints.',
      status: 'improved',
    })
  }

  if (medications.length > 0) {
    const medication = medications[0]
    signals.push({
      title: 'Medication continuity',
      value: `${medication.name}${medication.dosage ? ` ${medication.dosage}` : ''}`,
      detail:
        medication.sourceLabels.length > 0
          ? `Medication evidence has been seen in ${medication.sourceLabels.length} artifact-backed touchpoint(s).`
          : 'Medication appears across multiple visits.',
      status: /lisinopril/i.test(medication.name) ? 'stable' : 'watch',
    })
  }

  if (openPlanItems.length > 0) {
    signals.push({
      title: 'Follow-up execution',
      value: `${openPlanItems.length} pending task${openPlanItems.length === 1 ? '' : 's'}`,
      detail: 'Outstanding plan items remain before the next follow-up and should stay visible to the clinician.',
      status: 'watch',
    })
  }

  return signals.slice(0, 4)
}

function buildEvidenceInsights(visitContexts: VisitSummaryContext[]) {
  const insights: PatientTwinInsight[] = []

  for (const context of visitContexts.slice().reverse()) {
    const bpArtifact = context.artifacts.find((artifact) =>
      artifact.vitals.some((vital) => /blood pressure|\bbp\b/i.test(vital.type))
    )
    if (bpArtifact) {
      insights.push({
        title: 'Home blood pressure evidence',
        detail: bpArtifact.summary,
        source: `Artifact: ${bpArtifact.label}`,
        visitId: context.visit.id,
        visitDate: context.visit.startedAt,
      })
    }

    const medicationArtifact = context.artifacts.find((artifact) => artifact.medications.length > 0)
    if (medicationArtifact) {
      insights.push({
        title: 'Medication confirmation',
        detail: medicationArtifact.summary,
        source: `Artifact: ${medicationArtifact.label}`,
        visitId: context.visit.id,
        visitDate: context.visit.startedAt,
      })
    }

    if (/missed dose|refill|travel/i.test(context.transcriptText)) {
      insights.push({
        title: 'Adherence signal',
        detail: 'Transcript mentions a missed dose or refill pressure that may affect continuity.',
        source: 'Transcript',
        visitId: context.visit.id,
        visitDate: context.visit.startedAt,
      })
    }
  }

  return dedupeInsights(insights).slice(0, 4)
}

function buildFollowUpRisks({
  latestVisitContext,
  nextAppointment,
  openPlanItems,
  bpHistory,
}: {
  latestVisitContext: VisitSummaryContext
  nextAppointment: PatientTwinContext['nextAppointment']
  openPlanItems: PatientTwinContext['openPlanItems']
  bpHistory: PatientTwinTrendPoint[]
}) {
  const risks: string[] = []
  const latestNarrative = [
    latestVisitContext.visit.documentation?.summary ?? '',
    latestVisitContext.visit.documentation?.soapNotes ?? '',
    latestVisitContext.transcriptText,
  ].join(' ')

  if (!nextAppointment) {
    risks.push('No future follow-up appointment is currently scheduled.')
  }

  if (openPlanItems.some((item) => /lab|cmp|microalbumin|repeat/i.test(`${item.title} ${item.details}`))) {
    risks.push('Repeat lab work is still pending before the next follow-up.')
  }

  if (/missed dose|refill|travel/i.test(latestNarrative)) {
    risks.push('Medication adherence still needs monitoring after a missed dose or refill concern.')
  }

  if (/headache/i.test(latestNarrative) && /mild|improved/i.test(latestNarrative)) {
    risks.push('Headaches improved but are not fully resolved in the latest documentation.')
  }

  const latestBp = bpHistory[bpHistory.length - 1]
  if (latestBp && (latestBp.systolic >= 140 || latestBp.diastolic >= 90)) {
    risks.push('Latest documented blood pressure remains above target and should stay on watch.')
  }

  return dedupeStrings(risks).slice(0, 4)
}

function buildOpenQuestions({
  latestVisitContext,
  nextAppointment,
  openPlanItems,
}: {
  latestVisitContext: VisitSummaryContext
  nextAppointment: PatientTwinContext['nextAppointment']
  openPlanItems: PatientTwinContext['openPlanItems']
}) {
  const questions: string[] = []
  const latestSummary = latestVisitContext.visit.documentation?.summary ?? ''

  if (/headache/i.test(latestSummary)) {
    questions.push('Are the remaining evening headaches fully resolving between visits?')
  }
  if (openPlanItems.length > 0) {
    questions.push('Will the pending labs and home BP logging be completed before the next follow-up?')
  }
  if (!nextAppointment) {
    questions.push('When should the next hypertension follow-up be scheduled?')
  }
  questions.push('Does the current medication dose still match the patient-reported routine at home?')

  return dedupeStrings(questions).slice(0, 4)
}

function buildTimelineEvent(
  context: VisitSummaryContext,
  index: number,
  totalVisits: number
): PatientTwinTimelineEvent {
  const stageLabel =
    index === 0
      ? 'Initial signal'
      : index === totalVisits - 1
        ? 'Latest status'
        : 'Mid-course review'
  const title = `${stageLabel}: ${context.visit.chiefComplaint?.trim() || `Visit ${index + 1}`}`
  const keyChanges = buildVisitChanges(context)
  const followUp = context.visit.carePlanItems.map((item) => item.title).slice(0, 3)

  return {
    visitId: context.visit.id,
    visitDate: context.visit.startedAt,
    title,
    status: context.visit.status,
    chiefComplaint: context.visit.chiefComplaint?.trim() || 'Follow-up visit',
    summary: context.visit.documentation?.summary ?? 'No summary available.',
    bloodPressure: context.bloodPressure
      ? `${context.bloodPressure.systolic}/${context.bloodPressure.diastolic} mmHg`
      : null,
    artifactLabels: context.artifacts.map((artifact) => artifact.label),
    keyChanges,
    followUp,
    citations: context.citations.slice(0, 4),
  }
}

function buildOverview({
  patientName,
  visitCount,
  bpHistory,
  latestVisitContext,
  medications,
}: {
  patientName: string
  visitCount: number
  bpHistory: PatientTwinTrendPoint[]
  latestVisitContext: VisitSummaryContext
  medications: PatientTwinMedication[]
}) {
  const bpClause =
    bpHistory.length >= 2
      ? `Blood pressure moved from ${bpHistory[0].systolic}/${bpHistory[0].diastolic} to ${bpHistory[bpHistory.length - 1].systolic}/${bpHistory[bpHistory.length - 1].diastolic} across the recorded timeline.`
      : bpHistory[0]
        ? `Latest documented blood pressure is ${bpHistory[0].systolic}/${bpHistory[0].diastolic}.`
        : 'Structured blood pressure readings are limited.'

  const medicationClause =
    medications.length > 0
      ? `${patientName.split(' ')[0]} has persistent medication evidence for ${medications[0].name}${medications[0].dosage ? ` ${medications[0].dosage}` : ''}.`
      : 'Medication continuity is inferred mainly from notes.'

  const summaryText =
    latestVisitContext.visit.documentation?.summary ??
    latestVisitContext.visit.documentation?.soapNotes ??
    'Latest visit documentation is available.'

  return `${patientName} has ${visitCount} documented visit${visitCount === 1 ? '' : 's'} in Synth. ${bpClause} ${medicationClause} Latest note: ${compactWhitespace(summaryText).slice(0, 180)}`
}

function buildStoryline({
  bpHistory,
  visitContexts,
  openPlanItems,
}: {
  bpHistory: PatientTwinTrendPoint[]
  visitContexts: VisitSummaryContext[]
  openPlanItems: PatientTwinContext['openPlanItems']
}) {
  const firstVisit = visitContexts[0]
  const latestVisit = visitContexts[visitContexts.length - 1]
  const firstStage = firstVisit?.visit.documentation?.summary
    ? compactWhitespace(firstVisit.visit.documentation.summary).slice(0, 110)
    : 'Initial visit established the baseline problem.'
  const latestStage = latestVisit?.visit.documentation?.summary
    ? compactWhitespace(latestVisit.visit.documentation.summary).slice(0, 110)
    : 'Latest visit captures the current status.'
  const bpNote =
    bpHistory.length >= 2
      ? `Trend data shows a ${bpHistory[bpHistory.length - 1].systolic < bpHistory[0].systolic ? 'downward' : 'mixed'} blood pressure course over time.`
      : 'Trend data is limited to one documented visit.'
  const planNote =
    openPlanItems.length > 0
      ? `There are still ${openPlanItems.length} open follow-up task${openPlanItems.length === 1 ? '' : 's'}.`
      : 'No open care-plan tasks remain in the chart.'

  return `${firstStage} ${latestStage} ${bpNote} ${planNote}`
}

function buildRecommendedQuestions(patientName: string) {
  const firstName = patientName.split(' ')[0]
  return [
    `How has ${firstName}'s blood pressure changed across visits?`,
    `What evidence suggests medication adherence issues?`,
    `What changed after the uploaded bottle and BP log photos?`,
    `What should the clinician follow up on next?`,
  ]
}

function buildVisitChanges(context: VisitSummaryContext) {
  const changes = new Set<string>()
  const summary = context.visit.documentation?.summary ?? ''
  const soapNotes = context.visit.documentation?.soapNotes ?? ''
  const transcript = context.transcriptText

  if (context.bloodPressure) {
    changes.add(`Documented BP ${context.bloodPressure.systolic}/${context.bloodPressure.diastolic} mmHg`)
  }
  if (/improved|better/i.test(summary) && /headache/i.test(summary)) {
    changes.add('Headache burden improved')
  }
  if (/missed dose|refill|travel/i.test(`${summary} ${soapNotes} ${transcript}`)) {
    changes.add('Medication adherence needed review')
  }
  if (context.artifacts.length > 0) {
    changes.add(`${context.artifacts.length} evidence artifact${context.artifacts.length === 1 ? '' : 's'} reviewed`)
  }

  return Array.from(changes).slice(0, 4)
}

function extractMedicationMentions(text: string) {
  const medications: Array<{
    name: string
    dosage?: string
    frequency?: string
    source?: string
  }> = []

  MEDICATION_REGEX.lastIndex = 0
  let match = MEDICATION_REGEX.exec(text)
  while (match) {
    medications.push({
      name: titleCase(match[1]),
      dosage: sanitizeLine(match[2]),
      frequency: sanitizeLine(match[3]),
      source: 'Documentation',
    })
    match = MEDICATION_REGEX.exec(text)
  }

  return medications
}

function extractVisitBloodPressure(
  visit: TwinVisitRow,
  transcriptText: string,
  artifacts: NormalizedVisitArtifact[]
): PatientTwinTrendPoint | null {
  const artifactReading = extractReadingFromArtifacts(artifacts)
  const summaryReading = visit.documentation
    ? extractReadingFromText(visit.documentation.summary, 'Summary')
    : null
  const soapReading = visit.documentation
    ? extractReadingFromText(visit.documentation.soapNotes, 'SOAP')
    : null
  const transcriptReading = extractReadingFromTranscript(transcriptText)

  const selected = artifactReading ?? soapReading ?? summaryReading ?? transcriptReading
  if (!selected) {
    return null
  }

  return {
    visitId: visit.id,
    visitDate: visit.startedAt,
    label: formatShortDate(visit.startedAt),
    systolic: selected.systolic,
    diastolic: selected.diastolic,
    source: selected.source,
    excerpt: selected.excerpt,
  }
}

function extractReadingFromArtifacts(artifacts: NormalizedVisitArtifact[]) {
  for (let index = artifacts.length - 1; index >= 0; index -= 1) {
    const artifact = artifacts[index]
    const bloodPressureVital = artifact.vitals
      .slice()
      .reverse()
      .find((vital) => /blood pressure|\bbp\b/i.test(vital.type) && isValidReadingValue(vital.value))

    if (!bloodPressureVital) {
      continue
    }

    const [systolic, diastolic] = bloodPressureVital.value
      .split(/[\/]/)
      .map((value) => Number(value.trim()))
    if (!isValidBloodPressure(systolic, diastolic)) {
      continue
    }

    return {
      systolic,
      diastolic,
      source: `Artifact: ${artifact.label}`,
      excerpt: `${bloodPressureVital.label ? `${bloodPressureVital.label}: ` : ''}${buildArtifactEvidenceExcerpt(artifact)}`,
    }
  }

  return null
}

function extractReadingFromText(text: string, source: 'Summary' | 'SOAP') {
  if (!text || !text.trim()) {
    return null
  }

  const labeledMatch = getValidReading(text, BP_LABELED_REGEX)
  if (labeledMatch) {
    return {
      systolic: labeledMatch.systolic,
      diastolic: labeledMatch.diastolic,
      source,
      excerpt: labeledMatch.excerpt,
    }
  }

  const genericMatch = getValidReading(text, BP_GENERIC_REGEX, true)
  if (genericMatch) {
    return {
      systolic: genericMatch.systolic,
      diastolic: genericMatch.diastolic,
      source,
      excerpt: genericMatch.excerpt,
    }
  }

  return null
}

function extractReadingFromTranscript(transcriptText: string) {
  if (!transcriptText) {
    return null
  }

  const lines = transcriptText.split('\n')
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]
    if (!/blood pressure|\bbp\b/i.test(line)) {
      continue
    }

    const match = getValidReading(line, BP_GENERIC_REGEX)
    if (!match) {
      continue
    }

    return {
      systolic: match.systolic,
      diastolic: match.diastolic,
      source: 'Transcript',
      excerpt: line,
    }
  }

  return null
}

function getValidReading(text: string, regex: RegExp, requireKeywordNear = false) {
  regex.lastIndex = 0
  let match = regex.exec(text)
  while (match) {
    const systolic = Number(match[1])
    const diastolic = Number(match[2])

    if (isValidBloodPressure(systolic, diastolic)) {
      const matchIndex = match.index ?? 0
      if (requireKeywordNear) {
        const windowStart = Math.max(0, matchIndex - 30)
        const windowEnd = Math.min(text.length, matchIndex + (match[0]?.length ?? 0) + 30)
        const localWindow = text.slice(windowStart, windowEnd)
        if (!/blood pressure|\bbp\b|pressure/i.test(localWindow)) {
          match = regex.exec(text)
          continue
        }
      }

      return {
        systolic,
        diastolic,
        excerpt: compactWhitespace(
          text.slice(Math.max(0, matchIndex - 35), matchIndex + match[0].length + 45)
        ),
      }
    }

    match = regex.exec(text)
  }

  return null
}

function toTranscriptText(rawTranscriptJson: string | null) {
  if (!rawTranscriptJson) {
    return ''
  }

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
  const prioritized =
    lines.find((line) => /blood pressure|\bbp\b|lisinopril|refill|missed dose|headache/i.test(line)) ??
    lines.find(Boolean) ??
    ''

  return compactWhitespace(prioritized).slice(0, 220)
}

function dedupeCitations(citations: PatientTwinCitation[]) {
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

function dedupeInsights(insights: PatientTwinInsight[]) {
  const seen = new Set<string>()
  return insights.filter((insight) => {
    const key = `${insight.title}|${insight.source}|${insight.detail}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function compactWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function sanitizeLine(value: unknown) {
  return typeof value === 'string' ? compactWhitespace(value) : ''
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function isValidReadingValue(value: string) {
  return /^\d{2,3}\s*\/\s*\d{2,3}$/.test(value.trim())
}

function isValidBloodPressure(systolic: number, diastolic: number) {
  return systolic >= 70 && systolic <= 260 && diastolic >= 40 && diastolic <= 160
}

