import Link from 'next/link'
import { BrainCircuit, FlaskConical, LogOut } from 'lucide-react'
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

export default async function ReconciliationIndexPage() {
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
        },
      },
      reconciliationRuns: {
        where: {
          clinicianId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
        select: {
          status: true,
          overallConfidence: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          visits: true,
          reconciliationRuns: true,
        },
      },
    },
  })

  const patients = patientRows
    .map((patient) => {
      const latestVisit = patient.visits[0] ?? null
      const latestRun = patient.reconciliationRuns[0] ?? null
      return {
        id: patient.id,
        displayName: patient.displayName,
        visitCount: patient._count.visits,
        runCount: patient._count.reconciliationRuns,
        latestVisitId: latestVisit?.id ?? '',
        latestVisitDate: latestVisit?.startedAt ?? null,
        latestComplaint: latestVisit?.chiefComplaint ?? 'Follow-up visit',
        latestSummary: latestVisit?.documentation?.summary ?? 'No summary available.',
        latestRunStatus: latestRun?.status ?? null,
        latestRunConfidence: latestRun?.overallConfidence ?? null,
        latestRunCreatedAt: latestRun?.createdAt ?? null,
      }
    })
    .sort(
      (a, b) =>
        (b.latestRunCreatedAt?.getTime() ?? 0) - (a.latestRunCreatedAt?.getTime() ?? 0) ||
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
        <Button asChild variant="ghost">
          <Link href="/patient-twin">
            <BrainCircuit size={16} className="mr-2" />
            Patient Twin
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
        title="Reconciliation workspace"
        subtitle="Saved agent runs, conflict ledgers, and chart-ready approvals"
        fadeOnScroll
      />

      <main className="relative z-10 px-4 pb-10 pt-24 md:px-8 md:pt-28">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <section className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Judge Flow
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Open a patient and inspect the evidence arbitration
            </h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600 md:text-base">
              Evidence Lab persists every reconciliation pass. Judges can open a patient, run a new pass,
              compare the transcript, artifact, and timeline agents, then approve recommendations directly
              into care-plan and appointment records.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[#eadfcd] bg-[#fff9ef] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Step 1</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Open Sarah Johnson</p>
                <p className="mt-2 text-sm text-slate-600">The seeded patient already has multi-visit evidence and a visible adherence conflict.</p>
              </div>
              <div className="rounded-2xl border border-[#eadfcd] bg-[#fff9ef] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Step 2</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Run the agents</p>
                <p className="mt-2 text-sm text-slate-600">Transcript, artifact, timeline, and reconciler outputs are saved side by side.</p>
              </div>
              <div className="rounded-2xl border border-[#eadfcd] bg-[#fff9ef] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Step 3</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Approve an action</p>
                <p className="mt-2 text-sm text-slate-600">Promote the recommendation into the live care plan or appointment table.</p>
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#fff7e8] p-3 text-amber-800">
                <FlaskConical size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Why It Matters
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  This is the technical novelty surface
                </p>
              </div>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              <li>Runs multiple evidence lanes instead of one hidden answer.</li>
              <li>Persists conflicts, confidence, and unresolved questions.</li>
              <li>Lets a clinician approve next steps into real chart records.</li>
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
                Evidence Lab-ready records
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              {patients.length} patient workspace{patients.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className="rounded-3xl border border-[#eadfcd] bg-[#fffaf1] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-slate-900">{patient.displayName}</p>
                      {patient.displayName === 'Sarah Johnson' ? (
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                          Demo path
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{patient.latestComplaint}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{patient.visitCount} visits</p>
                    <p className="mt-1">{patient.runCount} run(s)</p>
                  </div>
                </div>

                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-700">
                  {patient.latestSummary.replace(/\n+/g, ' ')}
                </p>

                <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-white px-3 py-1">
                    Latest visit {formatDate(patient.latestVisitDate)}
                  </span>
                  {patient.latestRunStatus ? (
                    <span className="rounded-full bg-white px-3 py-1">
                      Last run {patient.latestRunStatus}
                      {typeof patient.latestRunConfidence === 'number'
                        ? ` · ${patient.latestRunConfidence}%`
                        : ''}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    {patient.latestRunCreatedAt
                      ? `Last run ${formatDate(patient.latestRunCreatedAt)}`
                      : 'No saved run yet'}
                  </div>
                  <Button asChild>
                    <Link href={`/reconciliation/${patient.id}`}>Open Evidence Lab</Link>
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

