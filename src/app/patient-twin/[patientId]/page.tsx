import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  CalendarClock,
  ClipboardCheck,
  FileClock,
  LogOut,
  Scale,
  ScrollText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { FloatingSidebarNav } from '@/components/clinician/FloatingSidebarNav'
import { PatientTwinTrendChart } from '@/components/patient-twin/PatientTwinTrendChart'
import { SoapNotesFloatingHeader } from '@/components/soap-notes/SoapNotesFloatingHeader'
import { getPatientTwinForClinician } from '@/lib/clinical/patient-twin'
import { requireClinicianPage } from '@/lib/auth/clinician-auth'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
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

export default async function PatientTwinDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>
}) {
  const { user } = await requireClinicianPage()
  const { patientId } = await params

  const twin = await getPatientTwinForClinician({
    patientId,
    clinicianId: user.id,
  })

  if (!twin) {
    redirect('/patient-twin')
  }

  const chartData = twin.bpHistory.map((point) => ({
    label: point.label,
    visitDate: point.visitDate.toISOString(),
    systolic: point.systolic,
    diastolic: point.diastolic,
  }))

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
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/soap-notes/${twin.latestVisitId}`}>
            <ScrollText size={16} className="mr-2" />
            Latest SOAP
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/reconciliation/${twin.patientId}`}>
            <Scale size={16} className="mr-2" />
            Evidence Lab
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
        title={twin.patientName}
        subtitle={`${twin.visitCount} visits · latest update ${formatDate(twin.latestVisitDate)}`}
        fadeOnScroll
      />

      <main className="relative z-10 px-4 pb-10 pt-24 md:px-8 md:pt-28">
        <section className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Longitudinal Overview
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Evidence-backed memory across visits
              </h1>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-700 md:text-base">
                {twin.overview}
              </p>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600 md:text-base">
                {twin.storyline}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {twin.recommendedQuestions.map((question) => (
                  <span
                    key={question}
                    className="rounded-full border border-[#eadfcd] bg-[#fff9ef] px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    {question}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-[#eadfcd] bg-[#fffaf1] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Active Conditions
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {twin.activeConditions.map((condition) => (
                    <span
                      key={condition}
                      className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#eadfcd] bg-[#fffaf1] p-4">
                <div className="flex items-center gap-2">
                  <CalendarClock size={16} className="text-sky-700" />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Next Appointment
                  </p>
                </div>
                {twin.nextAppointment ? (
                  <>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {twin.nextAppointment.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDateTime(twin.nextAppointment.scheduledFor)}
                    </p>
                    {twin.nextAppointment.notes ? (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {twin.nextAppointment.notes}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    No future appointment is currently scheduled.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Blood Pressure Trend
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  Cross-visit improvement at a glance
                </h2>
              </div>
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                <BrainCircuit size={20} />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The Twin keeps one representative reading per visit so judges can see the
              longitudinal effect of the plan, not just one isolated measurement.
            </p>

            <div className="mt-6">
              <PatientTwinTrendChart data={chartData} />
            </div>

            {twin.trendSignals.length > 0 && (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {twin.trendSignals.map((signal) => (
                  <div
                    key={signal.title}
                    className="rounded-2xl border border-[#eadfcd] bg-[#fff9ef] p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {signal.title}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{signal.value}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{signal.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-700" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Follow-up Risks
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    What still needs attention
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {twin.followUpRisks.map((risk) => (
                  <div
                    key={risk}
                    className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900"
                  >
                    {risk}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-emerald-700" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Open Plan Items
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    Current follow-up work
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {twin.openPlanItems.length === 0 ? (
                  <div className="rounded-2xl border border-[#eadfcd] bg-[#fff9ef] px-4 py-3 text-sm text-slate-600">
                    No pending plan items.
                  </div>
                ) : (
                  twin.openPlanItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#eadfcd] bg-[#fff9ef] px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      {item.details ? (
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.details}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-slate-500">
                        {item.dueAt ? `Due ${formatDate(item.dueAt)}` : 'No due date'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
            <div className="flex items-center gap-2">
              <FileClock size={18} className="text-sky-700" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Evidence Insights
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  The strongest supporting signals
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {twin.evidenceInsights.map((insight) => (
                <div
                  key={`${insight.title}-${insight.source}-${insight.visitId}`}
                  className="rounded-2xl border border-[#eadfcd] bg-[#fff9ef] p-4"
                >
                  <p className="text-sm font-semibold text-slate-900">{insight.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{insight.detail}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {insight.source} · {formatDate(insight.visitDate)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-[#eadfcd] bg-[#fff9ef] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Medication History
              </p>
              <div className="mt-3 space-y-3">
                {twin.medications.map((medication) => (
                  <div key={medication.name} className="rounded-2xl bg-white/80 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {[medication.name, medication.dosage, medication.frequency]
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Seen from {formatDate(medication.firstSeen)} through{' '}
                      {formatDate(medication.lastSeen)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
            <div className="flex items-center gap-2">
              <BrainCircuit size={18} className="text-sky-700" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Ask The Twin
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  Cross-visit grounded assistant
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This assistant sees the longitudinal timeline, artifact evidence, and current
              follow-up work instead of only one visit note.
            </p>

            <div className="mt-5 h-[34rem] overflow-hidden rounded-3xl border border-[#eadfcd] bg-white/70">
              <ChatInterface
                patientId={twin.patientId}
                visitId={twin.latestVisitId}
                mode="clinician"
                agentId="synth_patient_twin"
                showToolTrace={false}
                title="Ask The Patient Twin"
                description="Ask what changed across visits, what evidence supports it, and what still needs follow-up."
                placeholder="Ask about trend changes, medication adherence, or the next follow-up..."
                starterPrompts={twin.recommendedQuestions}
              />
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-[#eadfcd] bg-white/80 p-6 shadow-[0_16px_40px_rgba(84,63,31,0.12)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Timeline
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                What changed between visits
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              {twin.timeline.length} documented visit{twin.timeline.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {twin.timeline.map((event) => (
              <div
                key={event.visitId}
                className="rounded-3xl border border-[#eadfcd] bg-[#fffaf1] p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-slate-900">{event.title}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {event.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{formatDate(event.visitDate)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="ghost">
                      <Link href={`/soap-notes/${event.visitId}`}>Open SOAP</Link>
                    </Button>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-700">
                  {event.summary.replace(/\n+/g, ' ')}
                </p>

                {event.bloodPressure ? (
                  <div className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    BP {event.bloodPressure}
                  </div>
                ) : null}

                {event.keyChanges.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {event.keyChanges.map((change) => (
                      <span
                        key={change}
                        className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
                      >
                        {change}
                      </span>
                    ))}
                  </div>
                )}

                {event.artifactLabels.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {event.artifactLabels.map((artifactLabel) => (
                      <span
                        key={artifactLabel}
                        className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800"
                      >
                        {artifactLabel}
                      </span>
                    ))}
                  </div>
                )}

                {event.followUp.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-[#eadfcd] bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Follow-up generated at this visit
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {event.followUp.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {event.citations.length > 0 && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {event.citations.map((citation) => (
                      <div
                        key={`${citation.source}-${citation.excerpt}`}
                        className="rounded-2xl border border-[#eadfcd] bg-white/80 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {citation.source}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {citation.excerpt}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
