/* eslint-disable @typescript-eslint/no-explicit-any */
export const SARAH_TESTER_EMAIL = 'admin@synth.health'
export const SARAH_DEMO_PATIENT_NAME = 'Sarah Johnson'

type TranscriptSegment = {
  speaker: 'clinician' | 'patient'
  start_ms: number
  end_ms: number
  text: string
}

type DemoArtifact = {
  kind: 'image' | 'document_photo'
  label: string
  mimeType: string
  sourceName: string
  extractedText: string
  summary: string
  structuredJson: string
}

type DemoPlanItem = {
  title: string
  details?: string
  dueAt?: Date | null
  status: 'pending' | 'completed'
}

type DemoAppointment = {
  title: string
  scheduledFor: Date
  notes?: string
}

type DemoVisit = {
  startedAt: Date
  finalizedAt: Date
  chiefComplaint: string
  transcript: TranscriptSegment[]
  summary: string
  soapNotes: string
  additionalNotes: string
  artifacts: DemoArtifact[]
  planItems: DemoPlanItem[]
  appointments: DemoAppointment[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

function createArtifactPayload({
  summary,
  extractedText,
  findings,
  evidenceSnippets,
  vitals = [],
  medications = [],
  instructions = [],
}: {
  summary: string
  extractedText: string
  findings: string[]
  evidenceSnippets: string[]
  vitals?: Array<{ type: string; value: string; label?: string }>
  medications?: Array<{ name: string; dosage?: string; frequency?: string }>
  instructions?: string[]
}) {
  return JSON.stringify({
    summary,
    extractedText,
    findings,
    evidenceSnippets,
    vitals,
    medications,
    instructions,
  })
}

function buildSarahDemoVisits(latestAnchorStartedAt: Date): DemoVisit[] {
  const initialStartedAt = addDays(latestAnchorStartedAt, -56)
  const reviewStartedAt = addDays(latestAnchorStartedAt, -28)
  const latestStartedAt = latestAnchorStartedAt

  const initialFinalizedAt = addHours(initialStartedAt, 1)
  const reviewFinalizedAt = addHours(reviewStartedAt, 1)
  const latestFinalizedAt = addHours(latestStartedAt, 1)
  const nextFollowUp = addDays(latestStartedAt, 21)

  return [
    {
      startedAt: initialStartedAt,
      finalizedAt: initialFinalizedAt,
      chiefComplaint: 'Initial hypertension evaluation with severe headaches',
      transcript: [
        {
          speaker: 'clinician',
          start_ms: 0,
          end_ms: 9000,
          text: 'Sarah, I reviewed the urgent care note. Your blood pressure has been running high and you have been having pounding headaches. Tell me what has been happening at home.',
        },
        {
          speaker: 'patient',
          start_ms: 9000,
          end_ms: 22000,
          text: 'I have had headaches almost every evening this week and my home machine showed numbers in the 150s over the high 90s. I have felt stressed and tired.',
        },
        {
          speaker: 'clinician',
          start_ms: 22000,
          end_ms: 36000,
          text: 'Your clinic blood pressure today is 152 over 96. I want to start lisinopril 10 milligrams daily, reduce sodium, and have you keep a blood pressure log twice a day.',
        },
        {
          speaker: 'patient',
          start_ms: 36000,
          end_ms: 47000,
          text: 'I can do that. I have not been on blood pressure medicine before and I want to know if the headaches should get better.',
        },
        {
          speaker: 'clinician',
          start_ms: 47000,
          end_ms: 64000,
          text: 'The headaches may improve as the blood pressure comes down. Go to urgent care if you get chest pain, shortness of breath, vision changes, or blood pressure over 180 systolic.',
        },
      ],
      summary: `- Initial visit for uncontrolled hypertension with frequent evening headaches and urgent care follow-up.
- Clinic blood pressure 152/96 with home readings reported in the 150s/90s.
- Started lisinopril 10 mg daily and reviewed sodium reduction, walking, and twice-daily BP logging.
- Return precautions given for chest pain, shortness of breath, vision changes, or very high blood pressure.`,
      soapNotes: `# SOAP Note

## S (Subjective)
Patient presents after urgent care evaluation for elevated blood pressure and recurrent pounding headaches. Reports home readings in the 150s systolic and high 90s diastolic with near-daily evening headaches. Denies chest pain and shortness of breath. No prior antihypertensive therapy.

## O (Objective)
- Clinic blood pressure: 152/96
- Home readings reported in the 150s/90s
- Headaches frequent over the last week

## A (Assessment)
- Hypertension, newly recognized and above goal
- Headaches likely associated with elevated blood pressure, without current red-flag symptoms in clinic

## P (Plan)
- Start lisinopril 10 mg once daily
- Begin twice-daily home blood pressure log
- Counsel on sodium reduction and daily walking
- Review strict return precautions for severe elevation or neurologic symptoms
- Follow up in 4 weeks`,
      additionalNotes:
        'Initial demo visit anchors the longitudinal story: uncontrolled blood pressure, headache burden, and the first medication start.',
      artifacts: [
        {
          kind: 'document_photo',
          label: 'Initial home blood pressure log photo',
          mimeType: 'image/jpeg',
          sourceName: 'sarah-initial-bp-log.jpg',
          extractedText: 'Jan 8 150/96, Jan 9 154/98, Jan 10 148/94, headache every evening',
          summary:
            'Initial home blood pressure log shows persistently elevated readings in the upper 140s to mid 150s systolic with concurrent headache notes.',
          structuredJson: createArtifactPayload({
            summary:
              'Initial home blood pressure log shows persistently elevated readings in the upper 140s to mid 150s systolic with concurrent headache notes.',
            extractedText: 'Jan 8 150/96, Jan 9 154/98, Jan 10 148/94, headache every evening',
            findings: [
              'Home readings are consistently above goal',
              'Headaches are documented alongside elevated BP entries',
            ],
            evidenceSnippets: ['Jan 8: 150/96', 'Jan 9: 154/98', 'Jan 10: 148/94'],
            vitals: [
              { type: 'Blood pressure', value: '150/96', label: 'Jan 8' },
              { type: 'Blood pressure', value: '154/98', label: 'Jan 9' },
              { type: 'Blood pressure', value: '148/94', label: 'Jan 10' },
            ],
            instructions: ['Start twice-daily BP tracking'],
          }),
        },
        {
          kind: 'document_photo',
          label: 'Urgent care discharge instructions photo',
          mimeType: 'image/jpeg',
          sourceName: 'sarah-urgent-care-discharge.jpg',
          extractedText:
            'Follow up with primary care in 1 week. Return for severe headache, chest pain, vision changes.',
          summary:
            'Urgent care discharge sheet reinforces the need for primary care follow-up and red-flag return precautions.',
          structuredJson: createArtifactPayload({
            summary:
              'Urgent care discharge sheet reinforces the need for primary care follow-up and red-flag return precautions.',
            extractedText:
              'Follow up with primary care in 1 week. Return for severe headache, chest pain, vision changes.',
            findings: [
              'Recent urgent care visit occurred before Synth intake',
              'Return precautions include severe headache and vision changes',
            ],
            evidenceSnippets: ['Follow up with primary care in 1 week', 'Return for severe headache'],
            instructions: [
              'Follow up with primary care',
              'Return for severe headache, chest pain, or vision changes',
            ],
          }),
        },
      ],
      planItems: [
        {
          title: 'Start lisinopril 10 mg daily',
          details: 'Medication initiation documented during hypertension intake.',
          status: 'completed',
        },
      ],
      appointments: [],
    },
    {
      startedAt: reviewStartedAt,
      finalizedAt: reviewFinalizedAt,
      chiefComplaint: 'Hypertension follow-up with adherence review',
      transcript: [
        {
          speaker: 'clinician',
          start_ms: 0,
          end_ms: 9000,
          text: 'Sarah, we are one month into treatment. How have the home blood pressures and headaches looked since starting lisinopril?',
        },
        {
          speaker: 'patient',
          start_ms: 9000,
          end_ms: 22000,
          text: 'The headaches are less intense, but I still get them some evenings. I missed two doses when I was traveling and I noticed the bottle is almost empty.',
        },
        {
          speaker: 'clinician',
          start_ms: 22000,
          end_ms: 36000,
          text: 'Your clinic blood pressure today is 140 over 88 and your home log mostly shows the high 130s to low 140s. We need to stay consistent and refill the medication before you run out.',
        },
        {
          speaker: 'patient',
          start_ms: 36000,
          end_ms: 48000,
          text: 'I can do that. I have been trying to walk more but I need a reminder to keep checking my pressure.',
        },
        {
          speaker: 'clinician',
          start_ms: 48000,
          end_ms: 62000,
          text: 'Continue lisinopril 10 milligrams, refill today, and bring another home log next visit. We will repeat labs after another month if the trend keeps improving.',
        },
      ],
      summary: `- Follow-up after antihypertensive start shows partial improvement in blood pressure and headache severity.
- Clinic blood pressure 140/88 with home readings largely in the upper 130s to low 140s systolic.
- Patient reports two missed doses while traveling and bottle image suggests refill is needed.
- Continue lisinopril 10 mg, refill medication, reinforce adherence, and keep home BP logging.`,
      soapNotes: `# SOAP Note

## S (Subjective)
Patient returns for follow-up after starting lisinopril. Reports headaches are less intense but still occur some evenings. Missed two doses while traveling and notes bottle is nearly empty. Working on walking more consistently.

## O (Objective)
- Clinic blood pressure: 140/88
- Home BP readings mostly 138-144/86-92
- Medication bottle reviewed and refill needed

## A (Assessment)
- Hypertension improving but still above goal
- Medication adherence risk due to missed doses and limited refill supply
- Headaches partially improved

## P (Plan)
- Continue lisinopril 10 mg daily
- Send refill today
- Reinforce adherence and continue home blood pressure logging
- Repeat labs next month if control continues to improve
- Follow up in 4 weeks`,
      additionalNotes:
        'Second demo visit establishes the medication adherence problem and gives the Twin a visible bottle-photo evidence point.',
      artifacts: [
        {
          kind: 'document_photo',
          label: 'Follow-up blood pressure log photo',
          mimeType: 'image/jpeg',
          sourceName: 'sarah-followup-bp-log.jpg',
          extractedText: 'Feb 4 142/90, Feb 6 138/88, Feb 8 140/86, missed travel doses noted',
          summary:
            'Second blood pressure log shows improvement from the initial visit, but readings remain above goal and adherence notes are written beside the entries.',
          structuredJson: createArtifactPayload({
            summary:
              'Second blood pressure log shows improvement from the initial visit, but readings remain above goal and adherence notes are written beside the entries.',
            extractedText: 'Feb 4 142/90, Feb 6 138/88, Feb 8 140/86, missed travel doses noted',
            findings: [
              'Readings improved from the initial intake but remain elevated',
              'Log includes note about missed doses during travel',
            ],
            evidenceSnippets: ['Feb 4: 142/90', 'Feb 6: 138/88', 'Feb 8: 140/86'],
            vitals: [
              { type: 'Blood pressure', value: '142/90', label: 'Feb 4' },
              { type: 'Blood pressure', value: '138/88', label: 'Feb 6' },
              { type: 'Blood pressure', value: '140/86', label: 'Feb 8' },
            ],
            instructions: ['Continue home logging and improve dose consistency'],
          }),
        },
        {
          kind: 'image',
          label: 'Lisinopril bottle photo',
          mimeType: 'image/jpeg',
          sourceName: 'sarah-lisinopril-bottle.jpg',
          extractedText: 'Lisinopril 10 mg tablet, take one tablet by mouth daily, refills: 0',
          summary:
            'Medication bottle image confirms lisinopril 10 mg once daily and highlights the refill pressure discussed during the visit.',
          structuredJson: createArtifactPayload({
            summary:
              'Medication bottle image confirms lisinopril 10 mg once daily and highlights the refill pressure discussed during the visit.',
            extractedText: 'Lisinopril 10 mg tablet, take one tablet by mouth daily, refills: 0',
            findings: [
              'Medication label matches lisinopril discussed in the transcript',
              'Bottle indicates no refills remaining',
            ],
            evidenceSnippets: [
              'Lisinopril 10 mg tablet',
              'Take one tablet by mouth daily',
              'Refills: 0',
            ],
            medications: [{ name: 'Lisinopril', dosage: '10 mg', frequency: 'once daily' }],
            instructions: ['Refill needed soon'],
          }),
        },
      ],
      planItems: [
        {
          title: 'Confirm lisinopril refill pickup',
          details: 'Patient reported the bottle was almost empty during follow-up.',
          status: 'completed',
        },
      ],
      appointments: [],
    },
    {
      startedAt: latestStartedAt,
      finalizedAt: latestFinalizedAt,
      chiefComplaint: 'Hypertension follow-up with headache improvement',
      transcript: [
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
      ],
      summary: `- Third follow-up visit for hypertension and headache symptoms shows clear improvement since the initial intake.
- Patient reports only mild evening headaches a couple times weekly and mostly adherent lisinopril use with one missed travel dose.
- Home blood pressure log mostly 128-136/78-84; in-clinic BP 132/82 and HR 74.
- Continue current lisinopril dose, maintain BP log and walking routine, repeat labs next month, and keep return precautions in place.`,
      soapNotes: `# SOAP Note

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
- Good medication adherence overall with a recent travel-related missed dose

## P (Plan)
- Continue lisinopril at current dose
- Send medication refill today
- Continue home blood pressure log and lifestyle modifications (walking, sodium reduction)
- Repeat CMP and urine microalbumin before next visit
- Review return precautions: worsening headaches, vision changes, or repeated BP readings above 160 systolic
- Follow-up visit after labs or sooner if symptoms worsen`,
      additionalNotes:
        'Latest demo visit is the primary judge-facing record and should be the main entry point into the Patient Twin experience.',
      artifacts: [
        {
          kind: 'document_photo',
          label: 'Home blood pressure log photo',
          mimeType: 'image/jpeg',
          sourceName: 'sarah-home-bp-log.jpg',
          extractedText:
            'Mar 1 128/80, Mar 3 130/82, Mar 5 134/84, walking daily, no dizziness noted',
          summary:
            'Photo of the home blood pressure log shows multiple recent readings in the 128-134 systolic and 80-84 diastolic range, consistent with improved control.',
          structuredJson: createArtifactPayload({
            summary:
              'Photo of the home blood pressure log shows multiple recent readings in the 128-134 systolic and 80-84 diastolic range, consistent with improved control.',
            extractedText:
              'Mar 1 128/80, Mar 3 130/82, Mar 5 134/84, walking daily, no dizziness noted',
            findings: [
              'Home BP log remains below prior hypertensive range',
              'Readings trend around 128-134 / 80-84',
            ],
            evidenceSnippets: ['Mar 1: 128/80', 'Mar 3: 130/82', 'Mar 5: 134/84'],
            vitals: [
              { type: 'Blood pressure', value: '128/80', label: 'Mar 1' },
              { type: 'Blood pressure', value: '130/82', label: 'Mar 3' },
              { type: 'Blood pressure', value: '134/84', label: 'Mar 5' },
            ],
            instructions: ['Continue home BP logging'],
          }),
        },
        {
          kind: 'document_photo',
          label: 'Repeat lab order photo',
          mimeType: 'image/jpeg',
          sourceName: 'sarah-repeat-labs.jpg',
          extractedText:
            'CMP and urine microalbumin before next visit. Schedule follow-up in 3 weeks.',
          summary:
            'Lab order image makes the next-step work explicit: repeat CMP and urine microalbumin before the next blood pressure follow-up.',
          structuredJson: createArtifactPayload({
            summary:
              'Lab order image makes the next-step work explicit: repeat CMP and urine microalbumin before the next blood pressure follow-up.',
            extractedText:
              'CMP and urine microalbumin before next visit. Schedule follow-up in 3 weeks.',
            findings: [
              'Repeat labs are part of the current plan',
              'Next follow-up should occur in roughly three weeks',
            ],
            evidenceSnippets: ['CMP and urine microalbumin before next visit', 'Schedule follow-up in 3 weeks'],
            instructions: ['Complete CMP and urine microalbumin', 'Schedule next follow-up'],
          }),
        },
      ],
      planItems: [
        {
          title: 'Repeat CMP and urine microalbumin',
          details: 'Complete lab work before the next hypertension follow-up.',
          dueAt: addDays(latestStartedAt, 14),
          status: 'pending',
        },
        {
          title: 'Continue home blood pressure log',
          details: 'Bring another 2 weeks of readings to the next visit.',
          dueAt: addDays(latestStartedAt, 14),
          status: 'pending',
        },
      ],
      appointments: [
        {
          title: 'Hypertension follow-up and lab review',
          scheduledFor: addHours(nextFollowUp, 9),
          notes: 'Review repeat labs, medication adherence, and the next BP trend.',
        },
      ],
    },
  ]
}

async function ensureVisitArtifacts(
  prisma: any,
  visitId: string,
  artifacts: DemoArtifact[],
  createdAt: Date
) {
  for (const artifact of artifacts) {
    const existing = await prisma.visitArtifact.findFirst({
      where: {
        visitId,
        label: artifact.label,
      },
      select: { id: true },
    })

    if (existing) {
      await prisma.visitArtifact.update({
        where: { id: existing.id },
        data: {
          kind: artifact.kind,
          mimeType: artifact.mimeType,
          sourceName: artifact.sourceName,
          extractedText: artifact.extractedText,
          summary: artifact.summary,
          structuredJson: artifact.structuredJson,
          createdAt,
        },
      })
      continue
    }

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

async function ensureVisitPlanItems(prisma: any, visitId: string, patientId: string, clinicianId: string, planItems: DemoPlanItem[]) {
  for (const item of planItems) {
    const existing = await prisma.carePlanItem.findFirst({
      where: {
        visitId,
        title: item.title,
      },
      select: { id: true },
    })

    if (existing) {
      await prisma.carePlanItem.update({
        where: { id: existing.id },
        data: {
          details: item.details ?? null,
          dueAt: item.dueAt ?? null,
          status: item.status,
        },
      })
      continue
    }

    await prisma.carePlanItem.create({
      data: {
        visitId,
        patientId,
        clinicianId,
        title: item.title,
        details: item.details ?? null,
        dueAt: item.dueAt ?? null,
        status: item.status,
      },
    })
  }
}

async function ensureVisitAppointments(
  prisma: any,
  visitId: string,
  patientId: string,
  clinicianId: string,
  appointments: DemoAppointment[]
) {
  for (const appointment of appointments) {
    const existing = await prisma.appointment.findFirst({
      where: {
        visitId,
        title: appointment.title,
      },
      select: { id: true },
    })

    if (existing) {
      await prisma.appointment.update({
        where: { id: existing.id },
        data: {
          scheduledFor: appointment.scheduledFor,
          notes: appointment.notes ?? null,
        },
      })
      continue
    }

    await prisma.appointment.create({
      data: {
        visitId,
        patientId,
        clinicianId,
        title: appointment.title,
        scheduledFor: appointment.scheduledFor,
        notes: appointment.notes ?? null,
      },
    })
  }
}

async function ensureDemoVisit(
  prisma: any,
  patientId: string,
  clinicianId: string,
  demoVisit: DemoVisit,
  existingVisitId?: string
) {
  let visitId = existingVisitId

  if (!visitId) {
    const existingVisit = await prisma.visit.findFirst({
      where: {
        patientId,
        clinicianId,
        startedAt: demoVisit.startedAt,
      },
      select: { id: true },
    })

    visitId = existingVisit?.id
  }

  if (visitId) {
    await prisma.visit.update({
      where: { id: visitId },
      data: {
        status: 'finalized',
        chiefComplaint: demoVisit.chiefComplaint,
        startedAt: demoVisit.startedAt,
        finalizedAt: demoVisit.finalizedAt,
      },
    })
  } else {
    const createdVisit = await prisma.visit.create({
      data: {
        patientId,
        clinicianId,
        status: 'finalized',
        chiefComplaint: demoVisit.chiefComplaint,
        startedAt: demoVisit.startedAt,
        finalizedAt: demoVisit.finalizedAt,
      },
      select: { id: true },
    })
    visitId = createdVisit.id
  }

  if (!visitId) {
    throw new Error('Unable to resolve demo visit id for Sarah seed data.')
  }

  const existingDocumentation = await prisma.visitDocumentation.findUnique({
    where: { visitId },
    select: { id: true },
  })

  if (existingDocumentation) {
    await prisma.visitDocumentation.update({
      where: { visitId },
      data: {
        transcriptJson: JSON.stringify(demoVisit.transcript),
        summary: demoVisit.summary,
        soapNotes: demoVisit.soapNotes,
        additionalNotes: demoVisit.additionalNotes,
        createdAt: demoVisit.finalizedAt,
        updatedAt: demoVisit.finalizedAt,
      },
    })
  } else {
    await prisma.visitDocumentation.create({
      data: {
        visitId,
        transcriptJson: JSON.stringify(demoVisit.transcript),
        summary: demoVisit.summary,
        soapNotes: demoVisit.soapNotes,
        additionalNotes: demoVisit.additionalNotes,
        createdAt: demoVisit.finalizedAt,
        updatedAt: demoVisit.finalizedAt,
      },
    })
  }

  await ensureVisitArtifacts(prisma, visitId, demoVisit.artifacts, demoVisit.finalizedAt)
  await ensureVisitPlanItems(prisma, visitId, patientId, clinicianId, demoVisit.planItems)
  await ensureVisitAppointments(prisma, visitId, patientId, clinicianId, demoVisit.appointments)

  return visitId
}

export async function ensureSarahDemoSoapNoteForClinician(
  prisma: any,
  clinicianId: string
) {
  const existingPatient = await prisma.patient.findFirst({
    where: {
      displayName: SARAH_DEMO_PATIENT_NAME,
      visits: {
        some: {
          clinicianId,
        },
      },
    },
    select: {
      id: true,
      visits: {
        where: {
          clinicianId,
        },
        orderBy: {
          startedAt: 'desc',
        },
        take: 3,
        select: {
          id: true,
          startedAt: true,
        },
      },
    },
  })

  const patientId =
    existingPatient?.id ??
    (
      await prisma.patient.create({
        data: {
          displayName: SARAH_DEMO_PATIENT_NAME,
        },
        select: { id: true },
      })
    ).id

  const latestAnchorStartedAt =
    existingPatient?.visits[0]?.startedAt ?? new Date('2026-03-05T15:00:00.000Z')
  const demoVisits = buildSarahDemoVisits(latestAnchorStartedAt)

  const existingVisitIdsByDate = new Map(
    (existingPatient?.visits ?? []).map((visit: { id: string; startedAt: Date }) => [
      visit.startedAt.getTime(),
      visit.id,
    ])
  )

  const ensuredVisitIds: string[] = []

  for (let index = 0; index < demoVisits.length; index += 1) {
    const demoVisit = demoVisits[index]
    const existingVisitId =
      index === demoVisits.length - 1
        ? existingPatient?.visits[0]?.id
        : existingVisitIdsByDate.get(demoVisit.startedAt.getTime())

    const visitId = await ensureDemoVisit(
      prisma,
      patientId,
      clinicianId,
      demoVisit,
      existingVisitId
    )
    ensuredVisitIds.push(visitId)
  }

  const latestVisitId = ensuredVisitIds[ensuredVisitIds.length - 1]
  if (!latestVisitId) {
    throw new Error('Unable to resolve latest Sarah demo visit.')
  }
  return prisma.visitDocumentation.findUnique({
    where: { visitId: latestVisitId },
    select: {
      id: true,
      visitId: true,
    },
  })
}

