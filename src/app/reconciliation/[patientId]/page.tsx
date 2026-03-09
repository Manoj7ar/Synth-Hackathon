import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, BrainCircuit, LogOut, ScrollText } from 'lucide-react'
import { ReconciliationWorkspace } from '@/components/reconciliation/ReconciliationWorkspace'
import { Button } from '@/components/ui/button'
import { SoapNotesFloatingHeader } from '@/components/soap-notes/SoapNotesFloatingHeader'
import { FloatingSidebarNav } from '@/components/clinician/FloatingSidebarNav'
import { ensureSarahDemoSoapNoteForClinician } from '@/lib/demo/sarah-soap-note'
import { getPatientTwinForClinician } from '@/lib/patient-twin'
import { prisma } from '@/lib/prisma'
import { requireClinicianPage } from '@/lib/server/clinician-auth'

export default async function ReconciliationDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>
}) {
  const { user } = await requireClinicianPage()
  const { patientId } = await params

  try {
    await ensureSarahDemoSoapNoteForClinician(prisma, user.id)
  } catch (error) {
    console.warn('Unable to ensure Sarah demo evidence lab data:', error)
  }

  const twin = await getPatientTwinForClinician({
    patientId,
    clinicianId: user.id,
  })

  if (!twin) {
    redirect('/reconciliation')
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6efe2] text-slate-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 14%, rgba(255,255,255,0.55) 0%, transparent 45%), radial-gradient(circle at 82% 86%, rgba(238,224,197,0.6) 0%, transparent 42%), radial-gradient(circle at 58% 24%, rgba(248,236,212,0.7) 0%, transparent 50%)',
        }}
      />

      <FloatingSidebarNav anchor="top-left" fadeOnScroll />

      <div className="fixed right-4 top-4 z-20 flex items-center gap-2 md:right-6 md:top-6">
        <Button asChild variant="ghost">
          <Link href="/reconciliation">
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/patient-twin/${twin.patientId}`}>
            <BrainCircuit size={16} className="mr-2" />
            Patient Twin
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/soap-notes/${twin.latestVisitId}`}>
            <ScrollText size={16} className="mr-2" />
            Latest SOAP
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/signout">
            <LogOut size={16} className="mr-2" />
            Sign Out
          </Link>
        </Button>
      </div>

      <SoapNotesFloatingHeader
        eyebrow="Evidence Lab"
        title={twin.patientName}
        subtitle={`Reconciliation workspace across ${twin.visitCount} visits`}
        fadeOnScroll
      />

      <main className="relative z-10 px-4 pb-10 pt-24 md:px-8 md:pt-28">
        <section className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Evidence Lab
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Multi-agent evidence arbitration for one patient
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600 md:text-base">
            Evidence Lab is the judge-facing “show me how you know” surface. It reads the current visit,
            the uploaded artifact evidence, and the longitudinal Patient Twin, then saves a structured
            reconciliation run with conflicts, confidence, and clinician-approved actions.
          </p>
        </section>

        <section className="mt-8">
          <ReconciliationWorkspace
            patientId={twin.patientId}
            patientName={twin.patientName}
            latestVisitId={twin.latestVisitId}
            latestVisitDate={twin.latestVisitDate.toISOString()}
            visitCount={twin.visitCount}
            overview={twin.overview}
            storyline={twin.storyline}
            activeConditions={twin.activeConditions}
            followUpRisks={twin.followUpRisks}
            recommendedQuestions={twin.recommendedQuestions}
            nextAppointment={
              twin.nextAppointment
                ? {
                    title: twin.nextAppointment.title,
                    scheduledFor: twin.nextAppointment.scheduledFor.toISOString(),
                    notes: twin.nextAppointment.notes,
                  }
                : null
            }
          />
        </section>
      </main>
    </div>
  )
}
