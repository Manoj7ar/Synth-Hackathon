import React from "react";
import { ArrowRight, FileText, MessageSquare, WandSparkles } from "lucide-react";
import { grainTextureStyle, warmMeshStyle } from "@/lib/decorative-backgrounds";

const ProcessSteps = () => {
  return (
    <section
      id="how"
      className="relative w-full overflow-hidden bg-[#f4e8d2] px-6 py-32 text-slate-900"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={grainTextureStyle}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl aspect-square pointer-events-none opacity-20 blur-[120px]"
        style={{
          background: "radial-gradient(circle, #38bdf8 0%, transparent 70%)",
        }}
      />

      <div className="container relative z-10 mx-auto max-w-[1200px]">
        <div className="text-center mb-24 space-y-6 max-w-3xl mx-auto">
          <h2 className="text-[52px] md:text-[68px] leading-[1.1] tracking-tight text-white">
            How does this <span className="text-white">work?</span>
          </h2>
          <p className="text-xl leading-relaxed text-white">
            Import transcript or audio, attach supporting clinical images, and let Synth generate
            evidence-backed notes and grounded follow-up.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="group flex flex-col items-start rounded-[24px] bg-white/35 p-8 backdrop-blur-xl shadow-[0_16px_38px_rgba(93,72,35,0.14)] transition-all duration-300 hover:bg-white/45">
            <div className="w-12 h-12 rounded-full bg-white/35 flex items-center justify-center mb-6 border border-white/55">
              <FileText className="w-6 h-6 text-[#38bdf8]" />
            </div>
            <h3 className="mb-4 text-[24px] font-semibold text-slate-900">
              Add visit evidence
            </h3>
            <p className="mb-8 text-[16px] leading-relaxed text-slate-700">
              Bring a transcript, audio recording, and optional image evidence so the record is
              reviewable and grounded in more than one modality.
            </p>

            <div className="mt-auto w-full overflow-hidden rounded-xl border border-white/55 bg-white/45 p-3 backdrop-blur-md">
              <div className="flex items-center gap-3 rounded-lg bg-white/65 px-3 py-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-slate-800 text-sm font-medium truncate">
                  &quot;Patient reports dizziness...&quot;
                </span>
                <div className="ml-auto w-6 h-6 rounded bg-[#0ea5e9] flex items-center justify-center">
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="group flex flex-col items-start rounded-[24px] bg-white/35 p-8 backdrop-blur-xl shadow-[0_16px_38px_rgba(93,72,35,0.14)] transition-all duration-300 hover:bg-white/45">
            <div className="w-12 h-12 rounded-full bg-white/35 flex items-center justify-center mb-6 border border-white/55">
              <WandSparkles className="w-6 h-6 text-[#38bdf8]" />
            </div>
            <h3 className="mb-4 text-[24px] font-semibold text-slate-900">
              Extract + summarize
            </h3>
            <p className="mb-8 text-[16px] leading-relaxed text-slate-700">
              Medications, symptoms, vitals, and artifact evidence are extracted, then Synth
              generates structured documentation like SOAP.
            </p>

            <div className="w-full mt-auto space-y-2">
              <div className="transform rounded-xl border border-white/55 bg-white/55 p-3 backdrop-blur-md transition-transform group-hover:-translate-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Signals
                  </span>
                </div>
                <div className="line-clamp-1 text-[12px] font-medium text-slate-800">
                  Medications, symptoms, and vitals highlighted for review
                </div>
              </div>
              <div className="rounded-xl border border-white/50 bg-white/45 p-3 backdrop-blur-md">
                <div className="line-clamp-1 text-[12px] font-medium text-slate-700">
                  Summary and SOAP note draft generated with Amazon Nova 2
                </div>
              </div>
            </div>
          </div>

          <div className="group flex flex-col items-start rounded-[24px] bg-white/35 p-8 backdrop-blur-xl shadow-[0_16px_38px_rgba(93,72,35,0.14)] transition-all duration-300 hover:bg-white/45">
            <div className="w-12 h-12 rounded-full bg-white/35 flex items-center justify-center mb-6 border border-white/55">
              <MessageSquare className="w-6 h-6 text-[#38bdf8]" />
            </div>
            <h3 className="mb-4 text-[24px] font-semibold text-slate-900">
              Chat + audit
            </h3>
            <p className="mb-8 text-[16px] leading-relaxed text-slate-700">
              Ask questions and see answers grounded in transcript, note, and uploaded evidence,
              plus a trace of tools and queries.
            </p>

            <div className="mt-auto w-full rounded-xl border border-[#38bdf8]/35 bg-white/45 p-4 border-dashed backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#0ea5e9] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-slate-900">
                    Evidence only
                  </div>
                  <div className="text-[11px] font-medium text-slate-600">
                    Tool trace visible
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-10 mix-blend-overlay"
        style={warmMeshStyle}
      />
    </section>
  );
};

export default ProcessSteps;
