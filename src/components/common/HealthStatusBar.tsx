import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { HealthEvaluationResult, HealthStatusLevel } from '../../types/astroguard';

interface HealthStatusBarProps {
  evaluation: HealthEvaluationResult;
  compact?: boolean;
}

interface StatusVisualTheme {
  label: string;
  barCount: number;
  activeSegmentClass: string;
  containerClass: string;
  textClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STATUS_THEMES: Record<HealthStatusLevel, StatusVisualTheme> = {
  SAFE: {
    label: 'ALL SYSTEMS NORMAL',
    barCount: 12,
    activeSegmentClass: 'bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.4)]',
    containerClass: 'border-emerald-500/30 bg-[#061522]/85',
    textClass: 'text-emerald-300',
    icon: CheckCircle2
  },
  CAUTION: {
    label: 'CAUTION — MONITOR YOUR HEALTH',
    barCount: 8,
    activeSegmentClass: 'bg-amber-400/95 shadow-[0_0_8px_rgba(250,204,21,0.45)]',
    containerClass: 'border-amber-400/45 bg-[#181207]/85',
    textClass: 'text-amber-300',
    icon: AlertTriangle
  },
  DANGER: {
    label: 'DANGER — IMMEDIATE ATTENTION REQUIRED',
    barCount: 4,
    activeSegmentClass: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.55)]',
    containerClass: 'border-red-500/60 bg-[#1B090E]/88',
    textClass: 'text-red-300',
    icon: ShieldAlert
  }
};

const TOTAL_SEGMENTS = 12;

export function HealthStatusBar({ evaluation, compact = false }: HealthStatusBarProps) {
  const theme = STATUS_THEMES[evaluation.status];
  const Icon = theme.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border p-4 transition-all duration-500 ${theme.containerClass}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={`w-6 h-6 shrink-0 ${theme.textClass}`} />
          <span className={`text-sm font-mono font-semibold tracking-wider ${theme.textClass}`}>
            {theme.label}
          </span>
        </div>

        {!compact && (
          <span className="text-xs font-mono text-slate-400 shrink-0 tabular-nums">
            {evaluation.evaluatedAt}
          </span>
        )}
      </div>

      {/* Horizontal Segmented Aerospace Health-Status Bar */}
      <div
        className="mt-3 grid grid-cols-12 gap-1.5 p-1.5 rounded-lg bg-[#030712]/80 border border-white/10"
        aria-label={`Current evaluated health status: ${evaluation.status}`}
      >
        {Array.from({ length: TOTAL_SEGMENTS }).map((_, index) => {
          const isLit = index < theme.barCount;
          return (
            <div
              key={index}
              className={`h-2.5 rounded-xs transition-all duration-500 ${
                isLit ? theme.activeSegmentClass : 'bg-white/[0.06]'
              }`}
            />
          );
        })}
      </div>

      {/* Reason line shown only when Caution or Danger */}
      {evaluation.primaryFinding && (
        <p className="mt-2.5 text-sm text-slate-300">
          <span className={`font-semibold ${theme.textClass}`}>
            {evaluation.primaryFinding.label}:
          </span>{' '}
          <span className="font-mono text-white tabular-nums">
            {evaluation.primaryFinding.formattedReading}
          </span>{' '}
          <span className="text-slate-400">— {evaluation.primaryFinding.reason}</span>
        </p>
      )}
    </div>
  );
}
