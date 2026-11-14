import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  ChevronRight,
  Info,
  UserCheck
} from 'lucide-react';
import {
  ArchivalTribute,
  CrewProfile,
  CrewRosterMember,
  HealthEvaluationResult,
  HealthIndicatorKey,
  HealthStatusLevel,
  ModuleId,
  TelemetryVitalsSnapshot
} from '../types/astroguard';
import { AstronautPortrait } from '../components/common/AstronautPortrait';
import { LiveEcgMonitor } from '../components/common/LiveEcgMonitor';
import { HealthStatusBar } from '../components/common/HealthStatusBar';

interface MissionOverviewProps {
  tributes: ArchivalTribute[];
  selectedTributeId: string;
  crewProfile: CrewProfile;
  vitals: TelemetryVitalsSnapshot;
  evaluation: HealthEvaluationResult;
  onNavigate: (page: ModuleId) => void;
  isMedicalChief?: boolean;
  crewRoster?: CrewRosterMember[];
  onSelectCrew?: (crewId: string) => void;
}

interface EssentialMetricDef {
  key: HealthIndicatorKey;
  label: string;
  format: (v: number | null) => string;
  unit: string;
}

const ESSENTIAL_METRICS: EssentialMetricDef[] = [
  {
    key: 'heartRate',
    label: 'Heart Rate',
    format: (v) => (v !== null ? `${Math.round(v)}` : '--'),
    unit: 'BPM'
  },
  {
    key: 'spo2',
    label: 'SpO2',
    format: (v) => (v !== null ? `${Math.round(v)}` : '--'),
    unit: '%'
  },
  {
    key: 'cabinOxygen',
    label: 'Oxygen',
    format: (v) => (v !== null ? v.toFixed(1) : '--'),
    unit: '% O2'
  },
  {
    key: 'coreTemp',
    label: 'Core Temp',
    format: (v) => (v !== null ? v.toFixed(1) : '--'),
    unit: '°C'
  },
  {
    key: 'hydration',
    label: 'Hydration',
    format: (v) => (v !== null ? v.toFixed(1) : '--'),
    unit: 'L'
  },
  {
    key: 'sleep',
    label: 'Sleep',
    format: (v) => (v !== null ? v.toFixed(1) : '--'),
    unit: 'hrs'
  }
];

function getMetricHighlightClass(level?: HealthStatusLevel): string {
  if (level === 'DANGER') {
    return 'border-red-500/70 bg-red-950/35';
  }
  if (level === 'CAUTION') {
    return 'border-amber-400/60 bg-amber-950/25';
  }
  return 'ag-surface-primary';
}

export function MissionOverview({
  tributes,
  selectedTributeId,
  crewProfile,
  vitals,
  evaluation,
  onNavigate,
  isMedicalChief = false,
  crewRoster = [],
  onSelectCrew
}: MissionOverviewProps) {
  const [portraitMode, setPortraitMode] = useState<
    'ACTIVE_CREW' | 'HISTORICAL_ARCHIVE'
  >('ACTIVE_CREW');
  const [activeArchiveId, setActiveArchiveId] = useState<string>(selectedTributeId || 'williams');

  // Always return to the active crew portrait when the selected/authenticated astronaut changes
  useEffect(() => {
    setPortraitMode('ACTIVE_CREW');
  }, [crewProfile.id]);

  const currentTribute =
    tributes.find((t) => t.id === activeArchiveId) ||
    tributes.find((t) => t.id === 'williams') ||
    tributes[0];

  // Map active findings by parameter key so ONLY affected parameter(s) highlight
  const findingLevelByKey = new Map<HealthIndicatorKey, HealthStatusLevel>(
    evaluation.findings.map((f) => [f.key, f.level])
  );

  return (
    <div className="flex-1 w-full flex flex-col lg:flex-row">
      {/* LEFT SIDE — DYNAMIC ACTIVE ASTRONAUT PORTRAIT / 3D BIO TWIN / HISTORICAL ARCHIVE */}
      <section className="lg:w-[43%] xl:w-[42%] relative min-h-[360px] sm:min-h-[420px] lg:min-h-[calc(100vh-3.5rem)] flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10 bg-[#050C1B]/76">
        {portraitMode === 'ACTIVE_CREW' && (
          <AstronautPortrait
            crewId={crewProfile.id}
            name={crewProfile.name}
            portraitUrl={crewProfile.portraitUrl}
            attribution={crewProfile.portraitAttribution}
            rank={crewProfile.rank}
            status={evaluation.status}
            isHistorical={false}
            size="hero"
            className="absolute inset-0"
          />
        )}

        {portraitMode === 'HISTORICAL_ARCHIVE' && (
          <AstronautPortrait
            crewId={currentTribute.designationCode}
            name={currentTribute.name}
            portraitUrl={currentTribute.imageUrl}
            fallbackUrl={currentTribute.fallbackUrl}
            attribution={currentTribute.attribution}
            rank={currentTribute.designation}
            isHistorical={true}
            size="hero"
            className="absolute inset-0"
          />
        )}

        {/* Measured subtle scrims to preserve face clarity & 4.5:1 text contrast */}
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, rgba(3,7,18,0.58) 0%, rgba(3,7,18,0.0) 24%, rgba(3,7,18,0.0) 52%, rgba(3,7,18,0.86) 84%, rgba(3,7,18,0.97) 100%)'
            }}
          />
          <div
            className="hidden lg:block absolute inset-y-0 right-0 w-24 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, rgba(3,7,18,0) 0%, rgba(3,7,18,0.62) 100%)'
            }}
          />
        </>

        {/* Top Portrait / 3D Mode Switcher */}
        <div className="relative z-10 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-mono uppercase tracking-[0.14em] text-slate-200 ag-surface-inset px-3 py-1.5 rounded-lg">
            {portraitMode === 'ACTIVE_CREW'
              ? `${crewProfile.id} · ${crewProfile.designationCode}`
              : `HISTORICAL ARCHIVE · ${currentTribute.designationCode}`}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPortraitMode('ACTIVE_CREW')}
              className={`ag-nav-3d inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors whitespace-nowrap ${
                portraitMode === 'ACTIVE_CREW'
                  ? 'bg-[#105BD8] border-[#38BDF8] text-white'
                  : 'ag-surface-inset hover:border-sky-400/35 text-sky-300 hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>Portrait</span>
            </button>

            <button
              type="button"
              onClick={() => setPortraitMode('HISTORICAL_ARCHIVE')}
              className={`ag-nav-3d inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors whitespace-nowrap ${
                portraitMode === 'HISTORICAL_ARCHIVE'
                  ? 'bg-[#105BD8] border-[#38BDF8] text-white'
                  : 'ag-surface-inset hover:border-sky-400/35 text-sky-300 hover:text-white'
              }`}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>Archive</span>
            </button>
          </div>
        </div>

        {/* Bottom Subject Identification Footer */}
        {portraitMode !== 'HISTORICAL_ARCHIVE' ? (
          <div className="relative z-10 p-4 sm:p-6 space-y-1.5">
            <p className="text-xs font-mono uppercase tracking-[0.16em] text-sky-300/95">
              {crewProfile.missionIncrement} · {crewProfile.missionDay}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {crewProfile.name}
            </h1>
            <p className="text-sm sm:text-base text-slate-200">
              {crewProfile.rank} · {crewProfile.role}
            </p>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-0.5">
              <Info className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{crewProfile.portraitAttribution}</span>
            </p>
          </div>
        ) : (
          <div className="relative z-10 p-4 sm:p-6 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {tributes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveArchiveId(t.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors whitespace-nowrap ${
                    currentTribute.id === t.id
                      ? 'bg-[#105BD8] text-white'
                      : 'ag-surface-inset text-slate-300 hover:text-white'
                  }`}
                >
                  {t.name} ({t.designationCode})
                </button>
              ))}
            </div>
            <p className="text-xs font-mono uppercase tracking-[0.16em] text-amber-300">
              HISTORICAL ARCHIVAL TRIBUTE · {currentTribute.attribution}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {currentTribute.name}
            </h1>
            <p className="text-sm sm:text-base text-slate-200">{currentTribute.designation}</p>
            <p className="text-sm text-slate-300 italic">{currentTribute.quote}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-0.5">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Historical NASA archival photograph only — not an active telemetry subject. Active
                telemetry console displays {crewProfile.name} ({crewProfile.id}).
              </span>
            </p>
          </div>
        )}
      </section>

      {/* RIGHT SIDE — MINIMAL ASTRONAUT HEALTH CONSOLE */}
      <section className="lg:w-[57%] xl:w-[58%] p-4 sm:p-5 lg:p-6 flex flex-col justify-between gap-4 bg-[#030712]/42">
        {/* 1. Active Crew Member Identity */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.16em] text-sky-400">
              ACTIVE CREW MEMBER · {crewProfile.id} ({crewProfile.designationCode})
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              {crewProfile.name}
            </h2>
            <p className="text-sm sm:text-base text-slate-400 mt-0.5">
              {crewProfile.rank} · {crewProfile.role} · {crewProfile.orbitAltitude} ·{' '}
              {crewProfile.missionDay}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              SIMULATED TELEMETRY
            </span>
            {isMedicalChief && onSelectCrew && crewRoster.length > 0 && (
              <label className="flex items-center gap-2 text-xs">
                <span className="text-xs font-mono uppercase text-slate-400">Subject:</span>
                <select
                  aria-label="Select crew member"
                  value={crewProfile.id}
                  onChange={(e) => onSelectCrew(e.target.value)}
                  className="rounded-lg ag-surface-inset px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#38BDF8]"
                >
                  {crewRoster.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.id})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        {/* 2. Single Current Health Status Indicator */}
        <div className="space-y-2.5">
          <div className="text-xs font-mono uppercase tracking-[0.16em] text-slate-400">
            CURRENT HEALTH STATUS
          </div>
          <HealthStatusBar evaluation={evaluation} />

          {/* Compact Caution Warning (only visible when CAUTION is active) */}
          {evaluation.status === 'CAUTION' && evaluation.primaryFinding && (
            <div
              role="alert"
              className="rounded-xl border border-amber-400/50 bg-amber-950/30 p-3.5 flex items-start gap-3 text-sm"
            >
              <AlertTriangle className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-amber-200">
                  {evaluation.primaryFinding.label} —{' '}
                  <span className="font-mono text-white">
                    {evaluation.primaryFinding.formattedReading}
                  </span>
                </div>
                <p className="text-slate-300">{evaluation.primaryFinding.reason}</p>
                <p className="text-amber-200/90">
                  Recommended action: {evaluation.primaryFinding.recommendedCountermeasure}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 3. Main Telemetry Visual — Dynamic 3-Level ECG */}
        <div className="rounded-2xl ag-surface-primary p-4">
          <LiveEcgMonitor bpm={vitals.heartRate} status={evaluation.status} />
        </div>

        {/* 4. Compact Selection of Essential Health Metrics (only flagged parameter highlighted) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-[0.14em] text-slate-400">
            <span>ESSENTIAL BIOMETRICS (SIMULATED)</span>
            <button
              type="button"
              onClick={() => onNavigate('my-health')}
              className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 transition-colors normal-case font-sans text-sm font-medium whitespace-nowrap"
            >
              <span>Detailed Telemetry</span>
              <ChevronRight className="w-[18px] h-[18px]" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {ESSENTIAL_METRICS.map((metric) => {
              const rawVal = vitals[metric.key];
              const alertLevel = findingLevelByKey.get(metric.key);
              const highlightClass = getMetricHighlightClass(alertLevel);
              const labelColor =
                alertLevel === 'DANGER'
                  ? 'text-red-300'
                  : alertLevel === 'CAUTION'
                    ? 'text-amber-300'
                    : 'text-slate-400';

              return (
                <div
                  key={metric.key}
                  className={`ag-card-3d p-3 rounded-xl border transition-colors ${highlightClass}`}
                >
                  <div className={`text-xs font-mono truncate ${labelColor}`}>
                    {metric.label}
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-white tabular-nums">
                      {metric.format(rawVal)}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {rawVal !== null ? metric.unit : 'NO SIG'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

