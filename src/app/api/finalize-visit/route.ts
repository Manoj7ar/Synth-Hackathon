import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { prisma } from '@/lib/data/prisma'
import { extractMedicalEntities } from '@/lib/clinical/clinical-entities'
import { generateShareToken } from '@/lib/data/share-token'

type MedicationSummary = {
  name: string
  dosage?: string
  frequency?: string
  confidence?: number
  mentions?: number
}

type VitalSummary = {
  type: string
  value: string
  confidence?: number
}

type TranscriptChunk = {
  chunk_id: string
  visit_id: string
  patient_id: string
  speaker: string
  start_ms: number
  end_ms: number
  text: string
  ml_entities?: {
    medications?: MedicationSummary[]
    symptoms?: Array<{ name: string }>
    procedures?: Array<{ name: string }>
    vitals?: VitalSummary[]
  }
}

type FollowupItem = {
  task: string
  timestamp_ms: number
  priority: 'high' | 'medium'
  timing: string
}

type TranscriptSegment = {
  speaker: string
  start_ms: number
  end_ms: number
  text: string
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'clinician') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { visitId } = (await req.json()) as { visitId?: string }
    if (!visitId) {
      return NextResponse.json({ error: 'Visit ID required' }, { status: 400 })
    }

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { patient: true },
    })

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    if (visit.clinicianId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const doc = await prisma.visitDocumentation.findUnique({
      where: { visitId },
      select: { transcriptJson: true, summary: true, soapNotes: true },
    })

    if (!doc?.transcriptJson) {
      return NextResponse.json({ error: 'No transcript found' }, { status: 400 })
    }

    const segments = JSON.parse(doc.transcriptJson) as TranscriptSegment[]
    const chunks: TranscriptChunk[] = await Promise.all(
      segments.map(async (seg, idx) => {
        const entities = await extractMedicalEntities(seg.text)
        return {
          chunk_id: `${visitId}-chunk-${idx}`,
          visit_id: visitId,
          patient_id: visit.patientId,
          speaker: seg.speaker,
          start_ms: seg.start_ms,
          end_ms: seg.end_ms,
          text: seg.text,
          ml_entities: {
            medications: entities.medications.map((m) => ({
              name: m.name,
              dosage: m.dosage,
              frequency: m.frequency,
              confidence: m.confidence,
            })),
            symptoms: entities.symptoms.map((s) => ({ name: s.name })),
            procedures: entities.procedures.map((p) => ({ name: p.name })),
            vitals: entities.vitals.map((v) => ({
              type: v.type,
              value: v.value,
              confidence: v.confidence,
            })),
          },
        }
      })
    )

    const medMap = new Map<string, MedicationSummary & { mentions: number }>()
    for (const chunk of chunks) {
      for (const med of chunk.ml_entities?.medications ?? []) {
        const key = med.name.toLowerCase()
        const existing = medMap.get(key)
        if (!existing) {
          medMap.set(key, {
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            confidence: med.confidence,
            mentions: 1,
          })
          continue
        }
        existing.mentions += 1
      }
    }
    const medications = Array.from(medMap.values())

    const allSymptoms = new Set<string>()
    const allVitals: VitalSummary[] = []
    for (const chunk of chunks) {
      for (const symptom of chunk.ml_entities?.symptoms ?? []) {
        allSymptoms.add(symptom.name)
      }
      if (chunk.ml_entities?.vitals) {
        allVitals.push(...chunk.ml_entities.vitals)
      }
    }

    const afterVisitSummary = generateAfterVisitSummary(chunks, medications, Array.from(allSymptoms))
    const soapDraft = generateSOAPNote(chunks, medications, Array.from(allSymptoms), allVitals)
    const followups = extractFollowups(chunks)

    await prisma.visit.update({
      where: { id: visitId },
      data: {
        status: 'finalized',
        finalizedAt: new Date(),
      },
    })

    let shareLink = await prisma.shareLink.findFirst({ where: { visitId } })
    if (!shareLink) {
      shareLink = await prisma.shareLink.create({
        data: {
          visitId,
          patientId: visit.patientId,
          token: generateShareToken(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      mode: 'database_only',
      shareLink: shareLink.token,
      artifacts: {
        afterVisitSummary,
        soapDraft,
        medications: medications.length,
        symptoms: allSymptoms.size,
        followups,
      },
    })
  } catch (error) {
    console.error('Finalize visit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateAfterVisitSummary(
  chunks: TranscriptChunk[],
  medications: MedicationSummary[],
  symptoms: string[]
) {
  const patientStatements = chunks
    .filter((c) => c.speaker === 'patient')
    .slice(0, 3)
    .map((c) => c.text)

  return `# Your Visit Summary

## What We Discussed
${patientStatements.map((s) => `- ${s}`).join('\n')}

## Medications Prescribed
${
    medications.length > 0
      ? medications.map((m) => `- **${m.name}** ${m.dosage || ''} ${m.frequency || ''}`).join('\n')
      : '- No new medications prescribed'
  }

## Symptoms Discussed
${
    symptoms.length > 0
      ? symptoms.map((s) => `- ${s}`).join('\n')
      : '- No specific symptoms documented'
  }

## Important Notes
- Take all medications as prescribed
- Monitor your symptoms
- Contact the office if symptoms worsen or you have concerns

## Next Steps
- Follow up as scheduled
- Complete any recommended tests
- Keep track of your blood pressure/symptoms as discussed`
}

function generateSOAPNote(
  chunks: TranscriptChunk[],
  medications: MedicationSummary[],
  symptoms: string[],
  vitals: VitalSummary[]
) {
  const subjective = chunks
    .filter((c) => c.speaker === 'patient')
    .slice(0, 5)
    .map((c) => c.text)
    .join(' ')

  const objective = [
    vitals.length > 0 ? `Vitals: ${vitals.map((v) => `${v.type}: ${v.value}`).join(', ')}` : '',
    symptoms.length > 0 ? `Symptoms: ${symptoms.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return `# SOAP Note (Draft)

## S (Subjective)
${subjective}

## O (Objective)
${objective}

Physical examination findings: [To be completed by clinician]

## A (Assessment)
Chief complaint: ${symptoms[0] || 'Follow-up visit'}
${symptoms.length > 1 ? `Additional concerns: ${symptoms.slice(1).join(', ')}` : ''}

## P (Plan)
${
    medications.length > 0
      ? `**Medications:**\n${medications.map((m) => `- ${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join('\n')}`
      : ''
  }

**Follow-up:** As discussed with patient

**Patient Education:** Medication instructions provided, warning signs reviewed

_Note: This is a draft. Please review and complete before finalizing._`
}

function extractFollowups(chunks: TranscriptChunk[]) {
  const followupKeywords = [
    'follow up',
    'follow-up',
    'come back',
    'return',
    'schedule',
    'appointment',
    'blood test',
    'blood work',
    'next week',
    'two weeks',
    'next visit',
  ]

  const followups: FollowupItem[] = []

  chunks.forEach((chunk) => {
    const lower = chunk.text.toLowerCase()
    const hasFollowup = followupKeywords.some((kw) => lower.includes(kw))
    if (!hasFollowup) return

    const timeMatch = chunk.text.match(/(next week|two weeks|in \d+ (days?|weeks?|months?))/i)
    followups.push({
      task: chunk.text,
      timestamp_ms: chunk.start_ms,
      priority: lower.includes('urgent') || lower.includes('immediately') ? 'high' : 'medium',
      timing: timeMatch ? timeMatch[0] : 'Not specified',
    })
  })

  return followups
}

