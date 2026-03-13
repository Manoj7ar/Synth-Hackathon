import Link from 'next/link'
import { BrainCircuit, FileText, LogOut, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FloatingSidebarNav } from '@/components/clinician/FloatingSidebarNav'
import { SoapNotesFloatingHeader } from '@/components/soap-notes/SoapNotesFloatingHeader'
import { prisma } from '@/lib/data/prisma'
import { requireClinicianPage } from '@/lib/auth/clinician-auth'

function formatDate(date: Date | null) {
  if (!date) return 'No finalized visit yet'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export default async function PatientTwinIndexPage() {
  const { user } = await requireClinicianPage()

  const patientRows = await prisma.patient.findMany({
    where: {
      visits: {
        some: {
          clinicianId: user.id,
          documentation: {
            isNot: null,
          },
        },
      },
    },
    select: {
      id: true,
      displayName: true,
      visits: {
        where: {
          clinicianId: user.id,
          documentation: {
            isNot: null,
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
        select: {
          id: true,
          startedAt: true,
          chiefComplaint: true,
          documentation: {
            select: {
              summary: true,
            },
          },
          artifacts: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  })

  const patients = patientRows
    .map((patient) => {
      const latestVisit = patient.visits[0] ?? null
      return {
        id: patient.id,
        displayName: patient.displayName,
        visitCount: patient.visits.length,
        latestVisitId: latestVisit?.id ?? '',
        latestVisitDate: latestVisit?.startedAt ?? null,
        latestSummary: latestVisit?.documentation?.summary ?? 'No summary available.',
        latestComplaint: latestVisit?.chiefComplaint ?? 'Follow-up visit',
        artifactCount: patient.visits.reduce((sum, visit) => sum + visit.artifacts.length, 0),
      }
    })
    .sort(
      (a, b) =>
        b.visitCount - a.visitCount ||
        (b.latestVisitDate?.getTime() ?? 0) - (a.latestVisitDate?.getTime() ?? 0)
    )

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
        <Button asChild>
          <Link href="/clinician/new-visit">
            <Plus size={16} className="mr-2" />
            New Visit
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
        eyebrow="Patient Twin"
        title="Longitudinal patient memory"
        subtitle="Cross-visit timeline, evidence synthesis, and follow-up gaps"
        fadeOnScroll
      />

      <main className="relative z-10 px-4 pb-10 pt-24 md:px-8 md:pt-28">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <section className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Judge Flow
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Open one patient and see the full story
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
              The Patient Twin turns scattered visits, artifact evidence, and follow-up actions
              into one reviewable timeline. This is the fastest path for a judge to understand
              what changed, what still needs attention, and which evidence supports those claims.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[#eadfcd] bg-[#fff9ef] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Step 1
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Open the seeded patient</p>
                <p className="mt-2 text-sm text-slate-600">
                  Sarah Johnson now has multiple finalized visits instead of a single note.
                </p>
              </div>
              <div className="rounded-2xl border border-[#eadfcd] bg-[#fff9ef] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Step 2
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Review cross-visit trends</p>
                <p className="mt-2 text-sm text-slate-600">
                  Track medication adherence, BP improvement, and pending lab follow-up in one page.
                </p>
              </div>
              <div className="rounded-2xl border border-[#eadfcd] bg-[#fff9ef] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Step 3
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Ask the Twin questions</p>
                <p className="mt-2 text-sm text-slate-600">
                  Use the dedicated Twin assistant to ask what changed and what the clinician should do next.
                </p>
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                <BrainCircuit size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  What Changed
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  This is now a longitudinal demo
                </p>
              </div>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              <li>Multiple seeded visits instead of one isolated SOAP note.</li>
              <li>Evidence-backed BP trend and medication continuity story.</li>
              <li>Visible pending follow-up items and next appointment context.</li>
            </ul>
          </aside>
        </div>

        <section className="mt-8 rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Patients
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Twin-ready records
              </h2>
            </div>
            <p className="text-sm text-slate-500">{patients.length} patient twin view{patients.length === 1 ? '' : 's'}</p>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className="rounded-3xl border border-[#eadfcd] bg-[#fffaf1] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{patient.displayName}</p>
                    <p className="mt-1 text-sm text-slate-600">{patient.latestComplaint}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{patient.visitCount} visits</p>
                    <p className="mt-1">{patient.artifactCount} artifacts</p>
                  </div>
                </div>

                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-700">
                  {patient.latestSummary.replace(/\n+/g, ' ')}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-white px-3 py-1">Latest visit {formatDate(patient.latestVisitDate)}</span>
                  {patient.latestVisitId ? (
                    <Link
                      href={`/soap-notes/${patient.latestVisitId}`}
                      className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 hover:text-slate-900"
                    >
                      Open latest SOAP
                    </Link>
                  ) : null}
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <FileText size={15} />
                    Longitudinal summary available
                  </div>
                  <Button asChild>
                    <Link href={`/patient-twin/${patient.id}`}>Open Twin</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

