import React from 'react';
import { Check } from 'lucide-react';
import { CountermeasureItem } from '../types/astroguard';

interface CountermeasuresProps {
  countermeasures: CountermeasureItem[];
  compliance: number;
  onToggleCountermeasure: (id: string) => void;
}

export function Countermeasures({
  countermeasures,
  compliance,
  onToggleCountermeasure
}: CountermeasuresProps) {
  return (
    <div className="flex-1 w-full flex flex-col lg:flex-row">
      {/* LEFT PANE: DAILY COMPLIANCE RING & SCHEDULE SUMMARY */}
      <aside className="lg:w-[37%] xl:w-[35%] p-4 sm:p-5 lg:p-6 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#050C1B]/72 flex flex-col justify-between gap-4">
        <div className="space-y-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.18em] text-sky-400">
              MICROGRAVITY MITIGATION · SIMULATED
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
              Countermeasure Protocols
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Preserving bone mineral density, aerobic capacity, and circadian rhythm in
              weightlessness.
            </p>
          </div>

          {/* Compliance Summary Card */}
          <div className="p-4 sm:p-5 rounded-2xl ag-surface-primary space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-slate-400">
                FD-084 PROTOCOL COMPLETION
              </span>
              <span className="text-2xl font-mono font-bold text-sky-400 tabular-nums">
                {compliance}%
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[#030712] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#105BD8] to-[#38BDF8] transition-all duration-500"
                style={{ width: `${compliance}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">
              {countermeasures.filter((c) => c.completed).length} of {countermeasures.length}{' '}
              prescribed daily aerospace health protocols completed.
            </p>
          </div>

          {/* Physiological Protection Targets */}
          <div className="p-4 sm:p-5 rounded-2xl ag-surface-primary space-y-2.5">
            <h3 className="text-sm font-semibold text-white">
              Increment 74 Physiological Targets
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-2 py-1.5 border-b border-white/10">
                <span className="text-slate-400">Femoral Neck BMD Retention</span>
                <span className="font-mono text-emerald-400 tabular-nums">99.1% of Baseline</span>
              </div>
              <div className="flex justify-between gap-2 py-1.5 border-b border-white/10">
                <span className="text-slate-400">Aerobic VO2 Max Preservation</span>
                <span className="font-mono text-emerald-400 tabular-nums">96.9% of Baseline</span>
              </div>
              <div className="flex justify-between gap-2 py-1.5">
                <span className="text-slate-400">Daily Resistive Exercise Slot</span>
                <span className="font-mono text-white tabular-nums">100 min Allocated</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400">
          HARDWARE: ARED · T2 COLBERT · SOLID-STATE LED
        </div>
      </aside>

      {/* RIGHT PANE: INTERACTIVE PROTOCOL CARDS */}
      <section className="lg:w-[63%] xl:w-[65%] p-4 sm:p-5 lg:p-6 space-y-4 bg-[#030712]/42">
        <div className="pb-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">
              Prescribed Daily Countermeasure Schedule
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Toggle session completion status to update crew compliance telemetry
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 shrink-0">UTC MISSION CLOCK</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          {countermeasures.map((cm) => (
            <div
              key={cm.id}
              className={`ag-card-3d ag-surface-primary p-4 sm:p-5 rounded-2xl transition-all flex flex-col justify-between ${
                cm.completed ? 'border-emerald-500/40' : ''
              }`}
            >
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-sky-300 font-semibold">{cm.code}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">{cm.schedule}</span>
                    </div>
                    <h3 className="font-display text-base font-semibold text-white">{cm.title}</h3>
                    <p className="text-sm text-sky-300">{cm.target}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleCountermeasure(cm.id)}
                    className={`ag-nav-3d px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                      cm.completed
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-[#105BD8] hover:bg-[#196BF2] text-white'
                    }`}
                  >
                    <Check className="w-[18px] h-[18px] shrink-0" />
                    <span>{cm.completed ? 'Completed' : 'Mark Complete'}</span>
                  </button>
                </div>

                <p className="text-sm text-slate-400 mt-2.5">{cm.notes}</p>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>
                  Intensity: <strong className="text-slate-200">{cm.intensity}</strong>
                </span>
                <span>
                  Duration: <strong className="text-slate-200">{cm.duration}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
