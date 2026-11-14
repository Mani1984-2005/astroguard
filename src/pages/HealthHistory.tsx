import React from 'react';
import { Search } from 'lucide-react';
import { CrewProfile, HealthHistoryRecord } from '../types/astroguard';
import { getTimelineStepsForCrew } from '../data/astroguardData';
import { AstronautPortrait } from '../components/common/AstronautPortrait';

interface HealthHistoryProps {
  crewProfile: CrewProfile;
  records: HealthHistoryRecord[];
  statusFilter: string;
  searchQuery: string;
  onChangeStatusFilter: (status: string) => void;
  onChangeSearchQuery: (query: string) => void;
}

export function HealthHistory({
  crewProfile,
  records,
  statusFilter,
  searchQuery,
  onChangeStatusFilter,
  onChangeSearchQuery
}: HealthHistoryProps) {
  const timelineSteps = getTimelineStepsForCrew(crewProfile.id, crewProfile.vitals);

  return (
    <div className="flex-1 w-full flex flex-col lg:flex-row">
      {/* LEFT PANE: MISSION PHASE TIMELINE */}
      <aside className="lg:w-[37%] xl:w-[35%] p-4 sm:p-5 lg:p-6 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#050C1B]/72 space-y-4">
        <div className="space-y-3.5">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.18em] text-sky-400">
              LONGITUDINAL ARCHIVE · SIMULATED DATA
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
              Mission Health History
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Comparative physiological trajectory from pre-flight baseline through{' '}
              {crewProfile.missionDay}.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl ag-surface-primary flex items-center gap-3.5">
            <AstronautPortrait
              crewId={crewProfile.id}
              name={crewProfile.name}
              portraitUrl={crewProfile.portraitUrl}
              rank={crewProfile.rank}
              size="lg"
            />
            <div className="min-w-0">
              <div className="text-xs font-mono text-sky-400">
                {crewProfile.id} · {crewProfile.designationCode}
              </div>
              <div className="font-display text-base font-semibold text-white truncate">
                {crewProfile.name}
              </div>
              <div className="text-sm text-slate-400 truncate">{crewProfile.role}</div>
            </div>
          </div>
        </div>

        {/* Phase Timeline */}
        <div className="space-y-3 relative pl-5 border-l border-[#38BDF8]/30">
          {timelineSteps.map((step, idx) => (
            <div key={idx} className="relative">
              <span
                className={`absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full ${
                  step.active
                    ? 'bg-[#38BDF8] ring-4 ring-[#38BDF8]/20 shadow-[0_0_10px_rgba(56,189,248,0.8)]'
                    : 'bg-slate-600'
                }`}
              />
              <div className="p-3.5 rounded-xl ag-surface-primary">
                <div className="text-xs font-mono text-sky-300">{step.phase}</div>
                <p className="text-sm text-slate-300 mt-1">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* RIGHT PANE: FILTERABLE CLINICAL TELEMETRY LOG */}
      <section className="lg:w-[63%] xl:w-[65%] p-4 sm:p-5 lg:p-6 space-y-4 bg-[#030712]/42 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/10">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">
              Clinical Telemetry & Diagnostic Log
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Searchable historical medical evaluations for {crewProfile.name}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial min-w-[180px]">
              <Search className="w-[18px] h-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter metric or ID..."
                value={searchQuery}
                onChange={(e) => onChangeSearchQuery(e.target.value)}
                className="w-full sm:w-52 pl-9 pr-3 py-1.5 rounded-lg ag-surface-inset text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#38BDF8]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl ag-surface-inset">
              {['ALL', 'NOMINAL', 'MONITORED', 'CRITICAL'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onChangeStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'bg-[#105BD8] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl ag-surface-primary">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs font-mono uppercase text-slate-400 bg-[#030712]/60">
                <th className="py-3 px-4">Record</th>
                <th className="py-3 px-4">Mission Timestamp</th>
                <th className="py-3 px-4">Evaluation</th>
                <th className="py-3 px-4">Reading</th>
                <th className="py-3 px-4">Baseline Delta</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-slate-400 font-mono">
                    No clinical records match the current filter criteria.
                  </td>
                </tr>
              ) : (
                records.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-sky-400">{row.id}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-300 tabular-nums">{row.date}</td>
                    <td className="py-3.5 px-4 font-medium text-white">{row.metric}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-200 tabular-nums">
                      {row.value}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 tabular-nums">
                      {row.baselineDelta}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-mono uppercase ${
                          row.status === 'Nominal'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : row.status === 'Critical'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
