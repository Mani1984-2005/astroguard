import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Moon,
  Radio,
  ShieldAlert,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import {
  CountermeasureItem,
  CrewProfile,
  EvaluationRule,
  HealthEvaluationResult,
  HealthHistoryRecord,
  HealthIndicatorKey,
  HealthStatusLevel,
  ResearchEvidenceItem,
  TelemetryTimeframeSeries,
  TelemetryVitalsSnapshot,
  TimeframeKey
} from '../types/astroguard';
import { formatVitalReading } from '../engine/healthEvaluationEngine';
import { AstronautPortrait } from '../components/common/AstronautPortrait';
import { LiveEcgMonitor } from '../components/common/LiveEcgMonitor';
import { TelemetryLineChart } from '../components/common/TelemetryLineChart';

interface MyHealthProps {
  crewProfile: CrewProfile;
  vitals: TelemetryVitalsSnapshot;
  vitalsHistoryWindow?: TelemetryVitalsSnapshot[];
  evaluation: HealthEvaluationResult;
  rules: Record<HealthIndicatorKey, EvaluationRule>;
  timeframe: TimeframeKey;
  onChangeTimeframe: (tf: TimeframeKey) => void;
  series: Record<TimeframeKey, TelemetryTimeframeSeries>;
  countermeasures: CountermeasureItem[];
  healthHistory: HealthHistoryRecord[];
  researchItems: ResearchEvidenceItem[];
  hasUnacknowledgedCriticalAlert?: boolean;
  onOpenEmergencyAlert?: () => void;
}

const INDICATOR_ORDER: HealthIndicatorKey[] = [
  'heartRate',
  'spo2',
  'cabinOxygen',
  'radiation',
  'coreTemp',
  'hydration',
  'nutrition',
  'stress',
  'sleep'
];

const SUMMARY_METRIC_KEYS: { key: HealthIndicatorKey; shortLabel: string }[] = [
  { key: 'heartRate', shortLabel: 'Heart Rate' },
  { key: 'spo2', shortLabel: 'SpO2' },
  { key: 'cabinOxygen', shortLabel: 'Cabin O2' },
  { key: 'coreTemp', shortLabel: 'Core Temp' },
  { key: 'hydration', shortLabel: 'Hydration' },
  { key: 'nutrition', shortLabel: 'Nutrition' },
  { key: 'sleep', shortLabel: 'Sleep' },
  { key: 'radiation', shortLabel: 'Radiation' },
  { key: 'stress', shortLabel: 'Stress' }
];

const LEVEL_PILL: Record<HealthStatusLevel, string> = {
  SAFE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  CAUTION: 'bg-amber-500/15 text-amber-200 border-amber-400/45',
  DANGER: 'bg-red-500/20 text-red-200 border-red-500/60'
};

function formatRuleThreshold(rule: EvaluationRule): string {
  const parts: string[] = [];
  if (rule.cautionLow !== undefined) parts.push(`Caution ≤ ${rule.cautionLow}`);
  if (rule.cautionHigh !== undefined) parts.push(`Caution ≥ ${rule.cautionHigh}`);
  if (rule.dangerLow !== undefined) parts.push(`Danger ≤ ${rule.dangerLow}`);
  if (rule.dangerHigh !== undefined) parts.push(`Danger ≥ ${rule.dangerHigh}`);
  return `${parts.join(' · ')} ${rule.unit}`;
}

export function MyHealth({
  crewProfile,
  vitals,
  vitalsHistoryWindow = [],
  evaluation,
  rules,
  timeframe,
  onChangeTimeframe,
  series,
  countermeasures,
  healthHistory,
  researchItems,
  hasUnacknowledgedCriticalAlert = false,
  onOpenEmergencyAlert
}: MyHealthProps) {
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState<boolean>(false);
  const prevHeartRateRef = useRef<number | null>(null);

  const currentHr = vitals.heartRate;
  const currentHeartRate = currentHr;
  const personalCrewProfile = crewProfile;
  const restingHr = personalCrewProfile.restingHr;
  const hasValidHeartRate = currentHr !== null && !Number.isNaN(currentHr);
  const isHeartRateDeviated =
    hasValidHeartRate && restingHr > 0 && Math.abs(currentHr - restingHr) > 5;
  const heartRateDelta =
    hasValidHeartRate && restingHr > 0 ? Math.round(currentHr - restingHr) : null;

  const telemetryPulseClass = isHeartRateDeviated ? 'ag-telemetry-pulse' : '';

  useEffect(() => {
    if (currentHr !== null && !Number.isNaN(currentHr)) {
      prevHeartRateRef.current = currentHr;
    }
  }, [currentHr]);

  const currentSeries = series[timeframe];
  const meanHr = Math.round(
    currentSeries.hr.reduce((a, b) => a + b, 0) / currentSeries.hr.length
  );

  const findingByKey = new Map(evaluation.findings.map((f) => [f.key, f]));
  const primary = evaluation.primaryFinding;

  // Determine condition-specific intelligent guidance copy
  const assessmentConfig = (() => {
    if (evaluation.status === 'DANGER') {
      return {
        headline: 'IMMEDIATE ATTENTION REQUIRED',
        explanation:
          'Your health monitoring system has detected a critical condition requiring immediate review.',
        scheduleBadge: 'IMMEDIATE ATTENTION',
        scheduleActionLabel: 'IMMEDIATE MEDICAL REVIEW',
        scheduleGuidance:
          'Suspend strenuous tasks and EVA preparation immediately. Remain in a safe cabin zone and await direct Flight Surgeon / Medical Chief review.',
        containerClass:
          'bg-gradient-to-br from-[#1A080D] via-[#12070C] to-[#0A1428] border-red-500/70 shadow-[0_0_32px_rgba(239,68,68,0.18)]',
        accentText: 'text-red-300',
        badgeClass: 'bg-red-500/20 text-red-200 border-red-500/60',
        icon: <ShieldAlert className="w-7 h-7 text-red-400 shrink-0" />,
        actions: [
          primary
            ? primary.recommendedCountermeasure
            : 'Follow emergency biometric protocol and verify suit/cabin oxygen integrity.',
          'Pause all physical exertion (ARED / T2 COLBERT) and remain seated or tethered.',
          'Confirm Medical Chief notification and acknowledge the active critical alert once reviewed.'
        ]
      };
    }

    if (evaluation.status === 'CAUTION') {
      const affectedKey = primary?.key;
      const affectsExercise =
        affectedKey === 'heartRate' ||
        affectedKey === 'hydration' ||
        affectedKey === 'sleep' ||
        affectedKey === 'stress' ||
        affectedKey === 'coreTemp';

      return {
        headline: 'YOUR HEALTH REQUIRES ATTENTION',
        explanation: evaluation.hasMissingCriticalData
          ? 'Your health monitoring system cannot confirm all critical sensors. Verify biometric sensor links before resuming normal exertion.'
          : 'Your health monitoring system has detected a fluctuation that requires attention.',
        scheduleBadge: 'MODIFY SCHEDULE',
        scheduleActionLabel: 'MODIFY ACTIVITY / MONITOR HEALTH',
        scheduleGuidance: affectsExercise
          ? 'Scale back high-intensity scheduled activity (such as T2 COLBERT Treadmill or ARED Resistive Exercise) and prioritize recovery and hydration countermeasures until readings stabilize.'
          : 'Continue light cabin operations while monitoring the flagged parameter closely. Defer non-essential high-strain tasks until telemetry normalizes.',
        containerClass:
          'bg-gradient-to-br from-[#191306] via-[#120E06] to-[#0A1428] border-amber-400/60 shadow-[0_0_28px_rgba(245,158,11,0.12)]',
        accentText: 'text-amber-200',
        badgeClass: 'bg-amber-500/15 text-amber-200 border-amber-400/50',
        icon: <AlertTriangle className="w-7 h-7 text-amber-300 shrink-0" />,
        actions: [
          primary
            ? primary.recommendedCountermeasure
            : 'Verify biometric harness contact and monitor trend stability.',
          evaluation.hasMissingCriticalData
            ? 'Inspect pulse oximeter and ECG chest strap telemetry connections immediately.'
            : 'Recheck parameter stability over the next monitoring interval before strenuous exertion.',
          'Review upcoming countermeasure timing (CM-03 Hydration / CM-04 Circadian Phototherapy).'
        ]
      };
    }

    return {
      headline: 'YOUR HEALTH IS GOOD',
      explanation:
        'Your health indicators are within the configured safe ranges. Continue your planned mission activities and maintain your current health routine.',
      scheduleBadge: 'CONTINUE SCHEDULE',
      scheduleActionLabel: 'CONTINUE SCHEDULE',
      scheduleGuidance:
        'All monitored indicators support nominal mission pacing. Proceed with scheduled ARED resistive loading, T2 aerobic conditioning, and daily cabin operations.',
      containerClass:
        'bg-gradient-to-br from-[#071A15] via-[#071420] to-[#0A1428] border-emerald-500/50 shadow-[0_0_24px_rgba(16,185,129,0.10)]',
      accentText: 'text-emerald-300',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/45',
      icon: <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />,
      actions: [
        'Continue planned mission schedule and scheduled exercise countermeasures.',
        'Maintain daily hydration target (2.4 L/day) and caloric intake pacing.',
        'Complete evening circadian phototherapy (CM-04) prior to UTC sleep window.'
      ]
    };
  })();

  const completedCountermeasures = countermeasures.filter((c) => c.completed).length;

  const previousSnapshot = (() => {
    if (vitalsHistoryWindow.length === 0) return undefined;
    const lastIdx = vitalsHistoryWindow.length - 1;
    const startIdx = vitalsHistoryWindow[lastIdx] === vitals ? lastIdx - 1 : lastIdx;
    for (let i = startIdx; i >= 0; i -= 1) {
      const hr = vitalsHistoryWindow[i]?.heartRate;
      if (hr !== null && hr !== undefined && !Number.isNaN(hr)) {
        return vitalsHistoryWindow[i];
      }
    }
    return undefined;
  })();

  const previousHeartRate = previousSnapshot?.heartRate ?? prevHeartRateRef.current ?? currentHeartRate;
  const heartRateTrend: 'up' | 'down' | 'steady' =
    hasValidHeartRate && currentHeartRate !== null && previousHeartRate !== null
      ? currentHeartRate > previousHeartRate
        ? 'up'
        : currentHeartRate < previousHeartRate
          ? 'down'
          : 'steady'
      : 'steady';

  const renderHeartRateTrendIcon = () => {
    if (heartRateTrend === 'up') {
      return (
        <span className="inline-flex items-center" title="Increasing vs. previous reading">
          <TrendingUp
            className="w-4 h-4 text-rose-400 shrink-0"
            aria-label="Heart rate increasing compared to previous reading"
          />
        </span>
      );
    }
    if (heartRateTrend === 'down') {
      return (
        <span className="inline-flex items-center" title="Decreasing vs. previous reading">
          <TrendingDown
            className="w-4 h-4 text-sky-400 shrink-0"
            aria-label="Heart rate decreasing compared to previous reading"
          />
        </span>
      );
    }
    return null;
  };

  const countermeasureCompletionPct =
    countermeasures.length > 0
      ? Math.round((completedCountermeasures / countermeasures.length) * 100)
      : 0;

  return (
    <div className="flex-1 w-full bg-[#030712]/42 p-4 sm:p-5 lg:p-6">
      <div className="w-full space-y-4">
        {/* Crew Subject Header with Prominent Dynamic Portrait */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-4 min-w-0">
            <AstronautPortrait
              crewId={crewProfile.id}
              name={crewProfile.name}
              portraitUrl={crewProfile.portraitUrl}
              attribution={crewProfile.portraitAttribution}
              rank={crewProfile.rank}
              status={evaluation.status}
              size="xl"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-[0.16em] text-sky-400">
                <span>
                  INTELLIGENT HEALTH ASSISTANT · {crewProfile.missionIncrement} ·{' '}
                  {crewProfile.missionDay}
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1 truncate">
                {crewProfile.name}
              </h1>
              <p className="text-sm text-slate-300 mt-0.5">
                {crewProfile.rank} · {crewProfile.role} · ID {crewProfile.id} (
                {crewProfile.designationCode})
              </p>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                {crewProfile.portraitAttribution}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ag-surface-inset text-xs font-mono text-slate-300 shrink-0 tabular-nums">
            <Radio className="w-4 h-4 text-[#E03C31] shrink-0" />
            <span>SIMULATED EVALUATION · {evaluation.evaluatedAt}</span>
          </div>
        </header>

        {/* 1. OVERALL HEALTH ASSESSMENT — MAIN PRIORITY (SINGLE ACTIVE CONDITION) */}
        <section
          aria-label="Overall Health Assessment"
          className={`rounded-2xl border p-4 sm:p-5 transition-colors ${assessmentConfig.containerClass}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl ag-surface-inset shrink-0">
                {assessmentConfig.icon}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-md border text-xs font-mono font-semibold uppercase tracking-wider ${assessmentConfig.badgeClass}`}
                  >
                    {evaluation.status}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Centralized Health Evaluation
                  </span>
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {assessmentConfig.headline}
                </h2>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-3xl">
                  {assessmentConfig.explanation}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-start sm:items-end gap-2">
              <span
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold tracking-wide whitespace-nowrap ${assessmentConfig.badgeClass}`}
              >
                {assessmentConfig.scheduleActionLabel}
              </span>
              {evaluation.status === 'DANGER' &&
                hasUnacknowledgedCriticalAlert &&
                onOpenEmergencyAlert && (
                  <button
                    type="button"
                    onClick={onOpenEmergencyAlert}
                    className="ag-nav-3d px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    Review Critical Alert
                  </button>
                )}
            </div>
          </div>

          {/* Primary Affected Parameter Callout — ONLY shown in CAUTION or DANGER */}
          {evaluation.status !== 'SAFE' && primary && (
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div
                className={`p-4 rounded-xl ag-surface-inset ${
                  primary.key === 'heartRate' ? telemetryPulseClass : ''
                }`}
              >
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block">
                  PRIMARY AFFECTED PARAMETER
                </span>
                <div className="text-base font-semibold text-white mt-1">{primary.label}</div>
                <div
                  className={`text-xl font-mono font-bold mt-1 tabular-nums flex items-center gap-1.5 ${assessmentConfig.accentText}`}
                >
                  <span>{primary.formattedReading}</span>
                  {primary.key === 'heartRate' && renderHeartRateTrendIcon()}
                  <span className="ml-1 text-xs font-normal text-slate-400">(SIMULATED)</span>
                </div>
              </div>

              <div className="p-4 rounded-xl ag-surface-inset">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block">
                  ASSESSMENT REASON
                </span>
                <p className="text-sm text-slate-200 mt-1.5 leading-relaxed">
                  {primary.reason}
                </p>
              </div>

              <div className="p-4 rounded-xl ag-surface-inset">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block">
                  IMMEDIATE GUIDANCE
                </span>
                <p className="text-sm text-sky-200 mt-1.5 leading-relaxed">
                  {primary.recommendedCountermeasure}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* 1B. LIVE ECG WAVEFORM */}
        <div className="rounded-2xl ag-surface-primary p-4 sm:p-5 flex flex-col justify-center">
          <LiveEcgMonitor bpm={vitals.heartRate} status={evaluation.status} />
        </div>

        {/* 2. PERSONALIZED MISSION SCHEDULE GUIDANCE & 4. RECOMMENDED ACTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Mission Schedule Guidance */}
          <section className="ag-card-3d ag-surface-primary p-4 sm:p-5 rounded-2xl flex flex-col justify-between gap-3">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-base font-display font-semibold text-white">
                  <CalendarCheck className="w-5 h-5 text-sky-400 shrink-0" />
                  <span>Mission Schedule Guidance</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-md border text-xs font-mono font-semibold whitespace-nowrap ${assessmentConfig.badgeClass}`}
                >
                  {assessmentConfig.scheduleBadge}
                </span>
              </div>

              <p className="text-sm text-slate-200 leading-relaxed">
                {assessmentConfig.scheduleGuidance}
              </p>
            </div>

            <div className="pt-2.5 border-t border-white/10 text-xs text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Decision support only — AstroGuard advises schedule posture and does not
                autonomously alter mission control timelines.
              </span>
            </div>
          </section>

          {/* Condition-Specific Recommended Actions */}
          <section className="ag-card-3d ag-surface-primary p-4 sm:p-5 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-base font-display font-semibold text-white">
              <Activity className="w-5 h-5 text-sky-400 shrink-0" />
              <span>Recommended Actions</span>
            </div>
            <ul className="space-y-2">
              {assessmentConfig.actions.map((action, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 text-sm text-slate-200 leading-relaxed"
                >
                  <span
                    className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${
                      evaluation.status === 'DANGER'
                        ? 'bg-red-400'
                        : evaluation.status === 'CAUTION'
                          ? 'bg-amber-300'
                          : 'bg-emerald-400'
                    }`}
                  />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 3. TODAY'S HEALTH SUMMARY — ALL 9 CORE VITALS (INCLUDING NUTRITION & HYDRATION) */}
        <section className="p-4 sm:p-5 rounded-2xl ag-surface-primary space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Today&apos;s Health Summary
              </h2>
              <p className="text-xs text-slate-400">
                All 9 monitored vitals — readings outside safe limits are highlighted automatically
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isHeartRateDeviated && heartRateDelta !== null && (
                <span className="text-xs font-mono text-sky-300 tabular-nums">
                  ACTIVE MONITORING · HR {heartRateDelta >= 0 ? `+${heartRateDelta}` : heartRateDelta}{' '}
                  BPM VS BASELINE
                </span>
              )}
              <span className="text-xs font-mono text-slate-400">SIMULATED SNAPSHOT</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2.5">
            {SUMMARY_METRIC_KEYS.map(({ key, shortLabel }) => {
              const rule = rules[key];
              const finding = findingByKey.get(key);
              const isFlagged = Boolean(finding);
              const pulseCard = key === 'heartRate' && isHeartRateDeviated;
              const cardBorder =
                finding?.level === 'DANGER'
                  ? 'border-red-500/70 bg-red-950/35'
                  : finding?.level === 'CAUTION'
                    ? 'border-amber-400/60 bg-amber-950/25'
                    : pulseCard
                      ? 'border-sky-400/45 ag-surface-inset'
                      : 'ag-surface-inset';
              const valueClass =
                finding?.level === 'DANGER'
                  ? 'text-red-300'
                  : finding?.level === 'CAUTION'
                    ? 'text-amber-200'
                    : 'text-white';

              return (
                <div
                  key={key}
                  data-hr-monitoring={pulseCard ? 'active' : 'idle'}
                  className={`p-3 rounded-xl border transition-colors ${cardBorder} ${
                    pulseCard ? telemetryPulseClass : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-mono uppercase text-slate-400 truncate">
                      {shortLabel}
                    </span>
                    {isFlagged && finding && (
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold shrink-0 ${LEVEL_PILL[finding.level]}`}
                      >
                        {finding.isMissingData ? 'NO SIG' : finding.level}
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-lg sm:text-xl font-mono font-bold mt-1.5 tabular-nums flex items-center gap-1.5 ${valueClass}`}
                  >
                    <span>{formatVitalReading(vitals[key], rule.unit)}</span>
                    {key === 'heartRate' && renderHeartRateTrendIcon()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inline Countermeasure Completion At-a-Glance Strip */}
          <div className="pt-3 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Dumbbell className="w-5 h-5 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-300">
                  Daily Countermeasure Completion ·{' '}
                  <span className="text-sky-300 font-semibold tabular-nums">
                    {completedCountermeasures}/{countermeasures.length} Completed ({countermeasureCompletionPct}%)
                  </span>
                </div>
                <div className="mt-1.5 w-full max-w-xs h-1.5 rounded-full bg-[#030712] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#105BD8] to-[#38BDF8] transition-all duration-500"
                    style={{ width: `${countermeasureCompletionPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              {countermeasures.map((cm) => (
                <span
                  key={cm.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                    cm.completed
                      ? 'bg-emerald-500/12 border-emerald-500/35 text-emerald-300'
                      : 'ag-surface-inset text-slate-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      cm.completed ? 'bg-emerald-400' : 'bg-amber-300'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{cm.code}</span>
                  <span className="text-slate-400">{cm.completed ? 'DONE' : `${cm.progress}%`}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 5. COLLAPSIBLE DETAILED HEALTH ANALYSIS SECTION (COLLAPSED BY DEFAULT) */}
        <section className="rounded-2xl ag-surface-primary overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetailedAnalysis((prev) => !prev)}
            aria-expanded={showDetailedAnalysis}
            className="w-full px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-white/[0.03] transition-colors"
          >
            <div>
              <span className="text-xs font-mono uppercase tracking-[0.18em] text-sky-400 block">
                DETAILED HEALTH ANALYSIS
              </span>
              <span className="text-sm font-medium text-slate-300">
                9-channel evaluation, configured thresholds, trends &amp; charts, countermeasures,
                history &amp; evidence references
              </span>
            </div>
            <span className="ag-nav-3d inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg ag-surface-inset text-xs font-mono font-semibold text-white whitespace-nowrap shrink-0">
              <span>{showDetailedAnalysis ? 'Hide Details' : 'Expand Details'}</span>
              {showDetailedAnalysis ? (
                <ChevronUp className="w-5 h-5 text-sky-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-sky-400" />
              )}
            </span>
          </button>

          {showDetailedAnalysis && (
            <div className="p-4 sm:p-5 border-t border-white/10 space-y-5 bg-[#030712]/65">
              {/* 9-Channel Parameter Matrix + Thresholds */}
              <div className="p-4 sm:p-5 rounded-xl ag-surface-primary space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono uppercase text-sky-400">
                      CENTRALIZED ENGINE · 9 EVALUATED INDICATORS
                    </span>
                    <h3 className="font-display text-base font-semibold text-white">
                      Full Parameter Evaluation &amp; Configured Thresholds (Simulated)
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {evaluation.disclaimer}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {INDICATOR_ORDER.map((key) => {
                    const rule = rules[key];
                    const finding = findingByKey.get(key);
                    const level: HealthStatusLevel = finding ? finding.level : 'SAFE';
                    const valueStr = formatVitalReading(vitals[key], rule.unit);
                    const pulseDetailCard = key === 'heartRate' && isHeartRateDeviated;

                    return (
                      <div
                        key={key}
                        className={`p-3.5 rounded-xl ag-surface-inset space-y-1.5 ${
                          pulseDetailCard ? `border-sky-400/40 ${telemetryPulseClass}` : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-300 truncate">
                            {rule.label}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded border text-xs font-mono font-semibold shrink-0 ${LEVEL_PILL[level]}`}
                          >
                            {finding?.isMissingData ? 'MISSING' : level}
                          </span>
                        </div>
                        <div className="text-lg font-mono font-bold text-white tabular-nums flex items-center gap-1.5">
                          <span>{valueStr}</span>
                          {key === 'heartRate' && renderHeartRateTrendIcon()}
                        </div>
                        <div className="text-xs font-mono text-slate-400 leading-snug">
                          {formatRuleThreshold(rule)}
                        </div>
                        <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-0.5">
                          <span>
                            {rule.ruleOrigin === 'OPERATIONAL_REFERENCE'
                              ? 'Operational Ref.'
                              : 'Demo Rule'}
                          </span>
                          {!finding && (
                            <span className="text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> OK
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Circadian Sleep Architecture + Systemic Adaptation */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 sm:p-5 rounded-xl ag-surface-primary space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Moon className="w-5 h-5 text-sky-400 shrink-0" />
                      <span>Orbital Circadian &amp; Sleep Architecture</span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 tabular-nums">
                      SCORE {currentSeries.sleepScore}/100
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Station completes 16 orbital sunrises/sunsets every 24 hours. Artificial
                    phototherapy maintains UTC-aligned 24-hour circadian entrainment.
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl ag-surface-inset">
                      <div className="text-xs font-mono text-slate-400">SLEEP LOGGED</div>
                      <div className="text-base font-mono font-bold text-white mt-0.5 tabular-nums">
                        {vitals.sleep !== null ? `${vitals.sleep.toFixed(1)}h` : 'NO SIGNAL'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl ag-surface-inset">
                      <div className="text-xs font-mono text-slate-400">REM STAGE</div>
                      <div className="text-base font-mono font-bold text-sky-400 mt-0.5 tabular-nums">
                        {currentSeries.remPercent}%
                      </div>
                    </div>
                    <div className="p-3 rounded-xl ag-surface-inset">
                      <div className="text-xs font-mono text-slate-400">DEEP N3</div>
                      <div className="text-base font-mono font-bold text-emerald-400 mt-0.5 tabular-nums">
                        {currentSeries.deepPercent}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-xl ag-surface-primary space-y-3">
                  <h3 className="text-sm font-semibold text-white">
                    Systemic Microgravity Adaptation Summary
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-white/10">
                      <span className="text-slate-400">Blood Pressure (Cuff Calibrated)</span>
                      <span className="font-mono text-white font-medium tabular-nums">
                        {crewProfile.bp} mmHg
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-white/10">
                      <span className="text-slate-400">Cephalad Fluid Shift Index</span>
                      <span className="font-mono text-sky-300">Stabilized (Phase II)</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-white/10">
                      <span className="text-slate-400">Neuro-Vestibular Gaze Stability</span>
                      <span className="font-mono text-emerald-400 tabular-nums">98.4% Nominal</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-400">Respiratory Rate (Resting)</span>
                      <span className="font-mono text-white tabular-nums">14 breaths/min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Telemetry Graphs + Timeframe Switcher */}
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold text-white">
                      Physiological Trends &amp; Telemetry Charts (Simulated)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Cardiovascular &amp; autonomic recovery trajectory across mission windows
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 p-1 rounded-xl ag-surface-inset">
                    {(['24H', '7D', '30D'] as TimeframeKey[]).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => onChangeTimeframe(tf)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all whitespace-nowrap ${
                          timeframe === tf
                            ? 'bg-[#105BD8] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-4 sm:p-5 rounded-xl ag-surface-primary">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-xs font-mono uppercase text-sky-400">
                          CARDIOVASCULAR · SIMULATED
                        </span>
                        <h4 className="text-sm font-semibold text-white">
                          Heart Rate Trajectory (BPM)
                        </h4>
                      </div>
                      <span className="text-xs font-mono text-slate-300 tabular-nums">
                        MEAN: {meanHr} BPM
                      </span>
                    </div>
                    <TelemetryLineChart
                      labels={currentSeries.labels}
                      values={currentSeries.hr}
                      unit="BPM"
                      color="#38BDF8"
                      minVal={50}
                      maxVal={95}
                    />
                  </div>

                  <div className="p-4 sm:p-5 rounded-xl ag-surface-primary">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-xs font-mono uppercase text-emerald-400">
                          AUTONOMIC RECOVERY · SIMULATED
                        </span>
                        <h4 className="text-sm font-semibold text-white">
                          Heart Rate Variability — RMSSD (ms)
                        </h4>
                      </div>
                      <span className="text-xs font-mono text-emerald-400">
                        PARASYMPATHETIC NOMINAL
                      </span>
                    </div>
                    <TelemetryLineChart
                      labels={currentSeries.labels}
                      values={currentSeries.hrv}
                      unit="ms"
                      color="#34D399"
                      minVal={40}
                      maxVal={85}
                    />
                  </div>
                </div>
              </div>

              {/* Countermeasure History & Health History */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 sm:p-5 rounded-xl ag-surface-primary space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Dumbbell className="w-5 h-5 text-sky-400 shrink-0" />
                      <span>Countermeasure Completion History</span>
                    </div>
                    <span className="text-xs font-mono text-sky-300 tabular-nums">
                      {completedCountermeasures}/{countermeasures.length} COMPLETE
                    </span>
                  </div>
                  <div className="space-y-2">
                    {countermeasures.map((cm) => (
                      <div
                        key={cm.id}
                        className="p-3 rounded-xl ag-surface-inset flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">
                            {cm.code} · {cm.title}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {cm.schedule} · {cm.notes}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-xs shrink-0 tabular-nums ${
                            cm.completed
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {cm.progress}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-xl ag-surface-primary space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Clock className="w-5 h-5 text-sky-400 shrink-0" />
                      <span>Recent Health History Log</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {healthHistory.length} ENTRIES
                    </span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {healthHistory.slice(0, 6).map((rec) => (
                      <div
                        key={rec.id}
                        className="p-3 rounded-xl ag-surface-inset flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">{rec.metric}</div>
                          <div className="text-xs font-mono text-slate-400">
                            {rec.date} · {rec.value}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-xs shrink-0 ${
                            rec.status === 'Critical'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : rec.status === 'Monitored'
                                ? 'bg-amber-500/15 text-amber-200 border border-amber-400/40'
                                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Aerospace Evidence References */}
              <div className="p-4 sm:p-5 rounded-xl ag-surface-primary space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <BookOpen className="w-5 h-5 text-sky-400 shrink-0" />
                  <span>Aerospace Medicine Evidence References</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {researchItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl ag-surface-inset space-y-1 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-sky-400">{item.code}</span>
                        <span className="text-xs text-slate-400">{item.category}</span>
                      </div>
                      <div className="font-semibold text-white">{item.title}</div>
                      <p className="text-xs sm:text-sm text-slate-400 leading-relaxed line-clamp-2">{item.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
