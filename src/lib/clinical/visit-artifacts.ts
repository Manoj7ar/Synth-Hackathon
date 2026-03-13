import { generateNovaMultimodalText, isNovaConfigured } from '@/lib/ai/nova'

export type VisitArtifactKind = 'image' | 'document_photo'

export interface ArtifactMedication {
  name: string
  dosage?: string
  frequency?: string
}

export interface ArtifactVital {
  type: string
  value: string
  label?: string
}

export interface NormalizedVisitArtifact {
  id?: string
  kind: VisitArtifactKind
  label: string
  mimeType: string
  sourceName?: string
  summary: string
  extractedText: string
  findings: string[]
  evidenceSnippets: string[]
  medications: ArtifactMedication[]
  vitals: ArtifactVital[]
  instructions: string[]
  structuredJson?: string
  createdAt?: Date
}

type ParsedArtifactPayload = {
  summary: string
  extractedText: string
  findings: string[]
  evidenceSnippets: string[]
  medications: ArtifactMedication[]
  vitals: ArtifactVital[]
  instructions: string[]
}

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

function sanitizeLine(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(sanitizeLine).filter(Boolean)
}

function normalizeMedications(value: unknown): ArtifactMedication[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const candidate = item as Record<string, unknown>
      const name = sanitizeLine(candidate.name)
      if (!name) return null

      const medication: ArtifactMedication = { name }
      const dosage = sanitizeLine(candidate.dosage)
      const frequency = sanitizeLine(candidate.frequency)
      if (dosage) medication.dosage = dosage
      if (frequency) medication.frequency = frequency
      return medication
    })
    .filter((item): item is ArtifactMedication => item !== null)
}

function normalizeVitals(value: unknown): ArtifactVital[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const candidate = item as Record<string, unknown>
      const type = sanitizeLine(candidate.type)
      const valueText = sanitizeLine(candidate.value)
      if (!type || !valueText) return null

      const vital: ArtifactVital = {
        type,
        value: valueText,
      }
      const label = sanitizeLine(candidate.label)
      if (label) vital.label = label
      return vital
    })
    .filter((item): item is ArtifactVital => item !== null)
}

function normalizeArtifactPayload(value: unknown): ParsedArtifactPayload {
  if (!value || typeof value !== 'object') {
    return {
      summary: '',
      extractedText: '',
      findings: [],
      evidenceSnippets: [],
      medications: [],
      vitals: [],
      instructions: [],
    }
  }

  const payload = value as Record<string, unknown>
  return {
    summary: sanitizeLine(payload.summary),
    extractedText: sanitizeLine(payload.extractedText),
    findings: normalizeList(payload.findings),
    evidenceSnippets: normalizeList(payload.evidenceSnippets),
    medications: normalizeMedications(payload.medications),
    vitals: normalizeVitals(payload.vitals),
    instructions: normalizeList(payload.instructions),
  }
}

function parseJsonObjectFromText(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return null

    try {
      return JSON.parse(match[0]) as unknown
    } catch {
      return null
    }
  }
}

function fileLabel(fileName: string) {
  return fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim() || 'Clinical evidence image'
}

function buildFallbackArtifact(file: File): NormalizedVisitArtifact {
  const label = fileLabel(file.name)
  return {
    kind: 'document_photo',
    label,
    mimeType: file.type || 'image/jpeg',
    sourceName: file.name,
    summary: `Uploaded image evidence "${label}" is attached for review.`,
    extractedText: '',
    findings: ['Image evidence attached for manual review.'],
    evidenceSnippets: [`Uploaded file: ${file.name}`],
    medications: [],
    vitals: [],
    instructions: [],
  }
}

function inferKind(payload: ParsedArtifactPayload): VisitArtifactKind {
  const lowerSummary = payload.summary.toLowerCase()
  if (
    lowerSummary.includes('instruction') ||
    lowerSummary.includes('lab') ||
    lowerSummary.includes('log') ||
    payload.vitals.length > 0 ||
    payload.extractedText.length > 0
  ) {
    return 'document_photo'
  }

  return 'image'
}

export function isSupportedClinicalImage(file: File) {
  return SUPPORTED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())
}

export async function extractClinicalImageArtifact(file: File): Promise<NormalizedVisitArtifact> {
  if (!isSupportedClinicalImage(file)) {
    throw new Error('Evidence image must be JPG, PNG, WEBP, or GIF.')
  }

  const fallback = buildFallbackArtifact(file)
  if (!isNovaConfigured()) {
    return {
      ...fallback,
      findings: ['Image evidence attached, but Nova image analysis is not configured in this environment.'],
    }
  }

  try {
    const response = await generateNovaMultimodalText({
      prompt: `Analyze this uploaded clinical evidence image. It may be a blood pressure log, medication bottle, printed lab result, discharge instruction sheet, or referral note.

Return valid JSON only with this exact shape:
{
  "summary": "short evidence-backed summary",
  "extractedText": "compact OCR-style extraction",
  "findings": ["finding 1", "finding 2"],
  "evidenceSnippets": ["direct visual detail 1", "direct visual detail 2"],
  "medications": [{"name": "string", "dosage": "string", "frequency": "string"}],
  "vitals": [{"type": "string", "value": "string", "label": "string"}],
  "instructions": ["instruction 1", "instruction 2"]
}

Rules:
- Include only details visually supported by the image.
- If uncertain, state that conservatively in the summary.
- Keep extractedText terse and OCR-like.
- If no medications or vitals are visible, return empty arrays.`,
      imageFiles: [file],
      maxTokens: 900,
      temperature: 0.1,
    })

    const parsed = normalizeArtifactPayload(parseJsonObjectFromText(response))
    return {
      kind: inferKind(parsed),
      label: fileLabel(file.name),
      mimeType: file.type || 'image/jpeg',
      sourceName: file.name,
      summary: parsed.summary || fallback.summary,
      extractedText: parsed.extractedText,
      findings: parsed.findings.length > 0 ? parsed.findings : fallback.findings,
      evidenceSnippets: parsed.evidenceSnippets.length > 0 ? parsed.evidenceSnippets : fallback.evidenceSnippets,
      medications: parsed.medications,
      vitals: parsed.vitals,
      instructions: parsed.instructions,
      structuredJson: JSON.stringify(parsed),
    }
  } catch (error) {
    console.warn('Nova image artifact extraction failed, using fallback artifact summary:', error)
    return {
      ...fallback,
      findings: ['Image evidence attached for review. Automated extraction was unavailable.'],
    }
  }
}

export function parseStoredArtifact(record: {
  id?: string
  kind: string
  label: string
  mimeType: string
  sourceName?: string | null
  extractedText?: string | null
  summary?: string | null
  structuredJson?: string | null
  createdAt?: Date
}): NormalizedVisitArtifact {
  const structured = normalizeArtifactPayload(
    record.structuredJson ? parseJsonObjectFromText(record.structuredJson) : null
  )

  return {
    id: record.id,
    kind: record.kind === 'image' ? 'image' : 'document_photo',
    label: record.label,
    mimeType: record.mimeType,
    sourceName: record.sourceName ?? undefined,
    summary: sanitizeLine(record.summary) || structured.summary || 'Uploaded clinical evidence',
    extractedText: sanitizeLine(record.extractedText) || structured.extractedText,
    findings: structured.findings,
    evidenceSnippets: structured.evidenceSnippets,
    medications: structured.medications,
    vitals: structured.vitals,
    instructions: structured.instructions,
    structuredJson: record.structuredJson ?? undefined,
    createdAt: record.createdAt,
  }
}

export function formatArtifactsForClinicalPrompt(artifacts: NormalizedVisitArtifact[]) {
  if (artifacts.length === 0) {
    return ''
  }

  return artifacts
    .map((artifact, index) => {
      const sections = [
        `${index + 1}. ${artifact.label} (${artifact.kind})`,
        `Summary: ${artifact.summary}`,
      ]

      if (artifact.extractedText) {
        sections.push(`Extracted text: ${artifact.extractedText}`)
      }
      if (artifact.findings.length > 0) {
        sections.push(`Findings: ${artifact.findings.join(' | ')}`)
      }
      if (artifact.vitals.length > 0) {
        sections.push(
          `Vitals: ${artifact.vitals
            .map((vital) => `${vital.type} ${vital.value}${vital.label ? ` (${vital.label})` : ''}`)
            .join(' | ')}`
        )
      }
      if (artifact.medications.length > 0) {
        sections.push(
          `Medications: ${artifact.medications
            .map((medication) =>
              [medication.name, medication.dosage, medication.frequency].filter(Boolean).join(' ')
            )
            .join(' | ')}`
        )
      }

      return sections.join('\n')
    })
    .join('\n\n')
}

export function buildArtifactEvidenceExcerpt(artifact: NormalizedVisitArtifact) {
  if (artifact.evidenceSnippets.length > 0) {
    return artifact.evidenceSnippets.join(' | ')
  }
  if (artifact.findings.length > 0) {
    return artifact.findings.join(' | ')
  }
  if (artifact.extractedText) {
    return artifact.extractedText
  }
  return artifact.summary
}

