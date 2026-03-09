/* eslint-disable @typescript-eslint/no-explicit-any */
export const SARAH_TESTER_EMAIL = 'admin@synth.health'
export const SARAH_DEMO_PATIENT_NAME = 'Sarah Johnson'

type TranscriptSegment = {
  speaker: 'clinician' | 'patient'
  start_ms: number
  end_ms: number
  text: string
}

const SARAH_DEMO_TRANSCRIPT: TranscriptSegment[] = [
  {
    speaker: 'clinician',
    start_ms: 0,
    end_ms: 9000,
    text: 'Hi Sarah, good to see you again. We are following up on your blood pressure and headaches from last month. How have you been feeling this week?',
  },
  {
    speaker: 'patient',
    start_ms: 9000,
    end_ms: 21000,
    text: 'The headaches are better overall. I still get a mild one in the evenings a couple times a week, but not the strong pounding headaches I had before.',
  },
  {
    speaker: 'clinician',
    start_ms: 21000,
    end_ms: 34000,
    text: 'That is good progress. Have you been taking the lisinopril daily, and have you noticed any dizziness, cough, or side effects?',
  },
  {
    speaker: 'patient',
    start_ms: 34000,
    end_ms: 52000,
    text: 'Yes, I have been taking it every morning. No dizziness and no cough. I missed one dose last weekend when I was traveling.',
  },
  {
    speaker: 'clinician',
    start_ms: 52000,
    end_ms: 67000,
    text: 'Your home readings you brought in are mostly in the 128 to 136 systolic range and 78 to 84 diastolic. In clinic today your blood pressure is 132 over 82 and heart rate is 74.',
  },
  {
    speaker: 'patient',
    start_ms: 67000,
    end_ms: 79000,
    text: 'That sounds better than before. I have also been walking after dinner and cutting back on salty snacks.',
  },
  {
    speaker: 'clinician',
    start_ms: 79000,
    end_ms: 98000,
    text: 'Excellent. Let us continue the current dose, keep the home blood pressure log, and repeat labs next month. Please call sooner if headaches worsen, vision changes occur, or blood pressure is repeatedly over 160 systolic.',
  },
  {
    speaker: 'patient',
    start_ms: 98000,
    end_ms: 109000,
    text: 'Okay, I can do that. I would also like a refill before I run out next week.',
  },
]

const SARAH_DEMO_SUMMARY = `- Follow-up visit for hypertension and headache symptoms with overall improvement since prior visit.
- Patient reports mild evening headaches a few times per week, improved from prior severe headaches.
- Adherent to lisinopril with one missed dose while traveling; denies dizziness or cough.
- Home blood pressure log mostly 128-136/78-84; in-clinic BP 132/82, HR 74.
- Continue current medication and lifestyle changes, refill medication, maintain BP log, and repeat labs next month.`

const SARAH_DEMO_SOAP = `# SOAP Note

## S (Subjective)
Patient presents for follow-up of hypertension and prior recurrent headaches. Reports headaches have improved overall and are now mild in the evening a few times weekly, without severe pounding episodes. Taking lisinopril daily with one missed dose while traveling. Denies dizziness and cough. Reports ongoing lifestyle changes including post-dinner walking and reduced sodium intake. Requests medication refill before running out next week.

## O (Objective)
- Home BP log reviewed: mostly 128-136 systolic / 78-84 diastolic
- Clinic blood pressure: 132/82
- Heart rate: 74 bpm
- Patient appears improved symptomatically by history

## A (Assessment)
- Hypertension, improved control on current lisinopril regimen with supportive home readings
- Headaches, improved and currently mild/intermittent; no new red-flag symptoms reported during visit
- Good medication adherence overall and improving lifestyle habits

## P (Plan)
- Continue lisinopril at current dose
- Send medication refill today
- Continue home blood pressure log and lifestyle modifications (walking, sodium reduction)
- Repeat labs next month
- Return precautions reviewed: worsening headaches, vision changes, or repeated BP readings >160 systolic
- Follow-up visit after labs or sooner if symptoms worsen`

const SARAH_DEMO_ADDITIONAL_NOTES =
  'Demo record for tester walkthrough. Patient education reinforced on blood pressure logging, medication adherence, and urgent return precautions.'

const SARAH_DEMO_ARTIFACTS = [
  {
    kind: 'document_photo',
    label: 'Home blood pressure log photo',
    mimeType: 'image/jpeg',
    sourceName: 'sarah-home-bp-log.jpg',
    extractedText:
      'Mar 1 128/80, Mar 3 130/82, Mar 5 134/84, walking daily, no dizziness noted',
    summary:
      'Photo of the home blood pressure log shows multiple recent readings in the 128-134 systolic and 80-84 diastolic range, consistent with improved control.',
    structuredJson: JSON.stringify({
      summary:
        'Photo of the home blood pressure log shows multiple recent readings in the 128-134 systolic and 80-84 diastolic range, consistent with improved control.',
      extractedText:
        'Mar 1 128/80, Mar 3 130/82, Mar 5 134/84, walking daily, no dizziness noted',
      findings: [
        'Home BP log remains below prior hypertensive range',
        'Readings trend around 128-134 / 80-84',
      ],
      evidenceSnippets: [
        'Mar 1: 128/80',
        'Mar 3: 130/82',
        'Mar 5: 134/84',
      ],
      vitals: [
        { type: 'Blood pressure', value: '128/80', label: 'Mar 1' },
        { type: 'Blood pressure', value: '130/82', label: 'Mar 3' },
        { type: 'Blood pressure', value: '134/84', label: 'Mar 5' },
      ],
      medications: [],
      instructions: ['Continue home BP logging'],
    }),
  },
  {
    kind: 'image',
    label: 'Lisinopril bottle photo',
    mimeType: 'image/jpeg',
    sourceName: 'sarah-lisinopril-bottle.jpg',
    extractedText: 'Lisinopril 10 mg tablet, take one tablet by mouth daily, refills: 0',
    summary:
      'Medication bottle image confirms lisinopril 10 mg once daily and supports the refill request raised during the visit.',
    structuredJson: JSON.stringify({
      summary:
        'Medication bottle image confirms lisinopril 10 mg once daily and supports the refill request raised during the visit.',
      extractedText: 'Lisinopril 10 mg tablet, take one tablet by mouth daily, refills: 0',
      findings: [
        'Medication label matches lisinopril discussed in visit transcript',
        'Bottle indicates daily dosing',
      ],
      evidenceSnippets: [
        'Lisinopril 10 mg tablet',
        'Take one tablet by mouth daily',
      ],
      vitals: [],
      medications: [{ name: 'Lisinopril', dosage: '10 mg', frequency: 'once daily' }],
      instructions: ['Refill needed soon'],
    }),
  },
] as const

async function ensureSarahDemoArtifacts(prisma: any, visitId: string, createdAt: Date) {
  const existing = await prisma.visitArtifact.findMany({
    where: { visitId },
    select: { label: true },
  })
  const existingLabels = new Set(existing.map((artifact: { label: string }) => artifact.label))

  for (const artifact of SARAH_DEMO_ARTIFACTS) {
    if (existingLabels.has(artifact.label)) continue

    await prisma.visitArtifact.create({
      data: {
        visitId,
        kind: artifact.kind,
        label: artifact.label,
        mimeType: artifact.mimeType,
        sourceName: artifact.sourceName,
        extractedText: artifact.extractedText,
        summary: artifact.summary,
        structuredJson: artifact.structuredJson,
        createdAt,
      },
    })
  }
}

export async function ensureSarahDemoSoapNoteForClinician(
  prisma: any,
  clinicianId: string
) {
  const existing = await prisma.visitDocumentation.findFirst({
    where: {
      visit: {
        clinicianId,
        patient: {
          displayName: SARAH_DEMO_PATIENT_NAME,
        },
      },
    },
    select: {
      id: true,
      visitId: true,
    },
  })

  if (existing) {
    await ensureSarahDemoArtifacts(prisma, existing.visitId, new Date(Date.now() - 1000 * 60 * 60 * 24))
    return existing
  }

  const startedAt = new Date(Date.now() - 1000 * 60 * 60 * 26)
  const finalizedAt = new Date(Date.now() - 1000 * 60 * 60 * 24)

  return prisma.$transaction(async (tx: any) => {
    const patient = await tx.patient.create({
      data: {
        displayName: SARAH_DEMO_PATIENT_NAME,
      },
      select: { id: true },
    })

    const visit = await tx.visit.create({
      data: {
        patientId: patient.id,
        clinicianId,
        status: 'finalized',
        chiefComplaint: 'Hypertension follow-up with headaches',
        startedAt,
        finalizedAt,
      },
      select: { id: true },
    })

    const documentation = await tx.visitDocumentation.create({
      data: {
        visitId: visit.id,
        transcriptJson: JSON.stringify(SARAH_DEMO_TRANSCRIPT),
        summary: SARAH_DEMO_SUMMARY,
        soapNotes: SARAH_DEMO_SOAP,
        additionalNotes: SARAH_DEMO_ADDITIONAL_NOTES,
        createdAt: finalizedAt,
        updatedAt: finalizedAt,
      },
      select: {
        id: true,
        visitId: true,
      },
    })

    await ensureSarahDemoArtifacts(tx, visit.id, finalizedAt)

    return documentation
  })
}
