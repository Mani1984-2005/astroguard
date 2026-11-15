import React from 'react';
import { AlertTriangle, CheckCircle2, Cpu, Gauge, ShieldAlert, Stethoscope } from 'lucide-react';
import { PythonCondition, PythonHealthReport } from '../../types/astroguard';

interface PythonHealthPanelProps {
  report: PythonHealthReport | null;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
  title?: string;
}

const CONDITION_STYLE: Record<PythonCondition, string> = {
  FINE: 'border-emerald-500/45 bg-emerald-500/10 text-emerald-200',
  CAUTION: 'border-amber-400/50 bg-amber-500/10 text-amber-200',
  DANGER: 'border-red-500/60 bg-red-500/10 text-red-200',
  'NO SIGNAL': 'border-slate-500/50 bg-slate-500/10 text-slate-200'
};

const STATUS_STYLE: Record<string, string> = {
  NORMAL: 'text-emerald-300 border-emerald-500/35 bg-emerald-500/10',
  WATCH: 'text-amber-200 border-amber-400/40 bg-amber-500/10',
  ALERT: 'text-red-200 border-red-500/50 bg-red-500/10',
  NO_DATA: 'text-slate-300 border-slate-500/40 bg-slate-500/10'
};

function formatSummary(summary: Record<string, unknown>): string {
  const entries = Object.entries(summary || {})
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
    .slice(0, 2);
  return entries.map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`).join(' · ');
}

export function PythonHealthPanel({
  report,
  loading = false,
  error = null,
  compact = false,
  title = 'Python Health Engine'
}: PythonHealthPanelProps) {
  if (loading && !report) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#07101F] p-4 text-xs font-mono text-slate-400">
        <Cpu className="inline w-4 h-4 mr-2" />
        Evaluating health with the Python engine…
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#07101F] p-4 text-xs text-slate-400">
        <Cpu className="inline w-4 h-4 mr-2" />
        Python readiness report unavailable. The existing TypeScript evaluation remains active.
        {error ? <span className="block mt-1 text-amber-300">Reason: {error}</span> : null}
      </div>
    );
  }

  const domainEntries = Object.entries(report.domains);
  const flagged = domainEntries.filter(([, domain]) => domain.status !== 'NORMAL');
  const countermeasures = report.countermeasures || [];

  return (
    <section className={`rounded-2xl border ${CONDITION_STYLE[report.condition]} ${compact ? 'p-3.5' : 'p-5'} space-y-4`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Gauge className="w-5 h-5 shrink-0" />
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider opacity-80">{title}</div>
            <div className="text-lg font-semibold">
              {report.condition} · {report.readiness}/100 readiness
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="px-2 py-1 rounded-lg border border-current/30">
            COVERAGE {report.data_quality.coverage_pct}%
          </span>
          <span className="px-2 py-1 rounded-lg border border-current/30">SIMULATED</span>
        </div>
      </header>

      <p className="text-sm leading-relaxed opacity-95">{report.condition_reason}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
          <div className="opacity-60">PENALTY</div>
          <div className="text-sm">{report.readiness_components.penalty_total} pts</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
          <div className="opacity-60">FLAGGED</div>
          <div className="text-sm">{flagged.length} / {domainEntries.length}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
          <div className="opacity-60">COUNTERMEASURES</div>
          <div className="text-sm">
            {report.countermeasure_summary.completed}/{report.countermeasure_summary.total} complete
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
          <div className="opacity-60">MISSING</div>
          <div className="text-sm">{report.data_quality.domains_with_no_data.length} channels</div>
        </div>
      </div>

      {Object.keys(report.data_quality.invalid_value_counts || {}).length > 0 && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
          Implausible values were ignored: {Object.entries(report.data_quality.invalid_value_counts)
            .map(([key, count]) => `${key} (${count})`)
            .join(', ')}.
        </div>
      )}

      {report.critical_alerts.length > 0 && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-100">
          <ShieldAlert className="inline w-4 h-4 mr-1.5" />
          Critical alert in {report.critical_alerts.join(', ')}. A good aggregate score never hides this alert.
        </div>
      )}

      {!compact && (
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider opacity-70">
            Individual parameters
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {domainEntries.map(([key, domain]) => (
              <div key={key} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold capitalize">
                    {report.parameter_definitions[key]?.label || key.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${STATUS_STYLE[domain.status]}`}>
                    {domain.status}
                  </span>
                </div>
                <div className="mt-1 text-[10px] font-mono opacity-65 truncate">
                  {formatSummary(domain.summary) || domain.note || 'No usable reading'}
                </div>
                {Boolean(domain.trend?.direction) && (
                  <div className="text-[10px] font-mono opacity-55">
                    trend: {String(domain.trend.direction)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {flagged.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase tracking-wider opacity-70">
            Why these parameters contributed
          </div>
          {report.contributing_parameters.slice(0, 5).map((item) => (
            <div key={item.parameter} className="text-xs flex gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>{item.label}</strong> — {item.reason}
              </span>
            </div>
          ))}
        </div>
      )}

      {countermeasures.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase tracking-wider opacity-70">
            Evidence-linked countermeasures
          </div>
          {countermeasures.slice(0, 6).map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold flex items-center gap-1.5">
                  {item.completionStatus === 'COMPLETED' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Stethoscope className="w-3.5 h-3.5 opacity-70" />
                  )}
                  {item.code} · {item.title}
                </span>
                <span className="text-[9px] font-mono opacity-70">{item.completionStatus}</span>
              </div>
              <p className="mt-1 opacity-80">{item.instruction}</p>
              <p className="mt-1 text-[10px] font-mono opacity-55">{item.evidence.note}</p>
            </div>
          ))}
        </div>
      )}

      <footer className="border-t border-white/10 pt-2 text-[10px] leading-relaxed font-mono opacity-65">
        {report.model_disclaimer}
      </footer>
    </section>
  );
}
