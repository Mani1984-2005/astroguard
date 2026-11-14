import React, { Suspense, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Database,
  Dumbbell,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  UserPlus
} from 'lucide-react';
import {
  AuditLogEntry,
  CountermeasureItem,
  CrewRosterMember,
  EvaluationRule,
  HealthAlert,
  HealthIndicatorKey,
  HealthStatusLevel,
  ProvisionedAccount,
  ResearchEvidenceItem,
  SimulationScenarioId,
  TelemetryTimeframeSeries,
  TimeframeKey,
  UserProfile,
  UserRole
} from '../types/astroguard';
import {
  evaluateCrewHealth,
  formatVitalReading
} from '../engine/healthEvaluationEngine';
import { TelemetryLineChart } from '../components/common/TelemetryLineChart';
import { LiveEcgMonitor } from '../components/common/LiveEcgMonitor';
import { SimulationControlPanel } from '../components/common/SimulationControlPanel';
import { AstronautPortrait } from '../components/common/AstronautPortrait';
import {
  getAstronautIdentity,
  getTelemetrySeriesForCrew
} from '../data/astroguardData';

const LazyCrewOrbitalViewport = React.lazy(
  () => import('../components/three/InteractiveCrewOrbitalViewport')
);

interface MedicalChiefWorkspaceProps {
  crewRoster: CrewRosterMember[];
  selectedCrewId: string;
  crewStatusFilter: string;
  newSurgeonNote: string;
  rules: Record<HealthIndicatorKey, EvaluationRule>;
  alerts: HealthAlert[];
  activeScenario: SimulationScenarioId;
  series: Record<TimeframeKey, TelemetryTimeframeSeries>;
  countermeasures: CountermeasureItem[];
  researchItems: ResearchEvidenceItem[];
  isFirestoreSeeded: boolean;
  provisionedAccounts: ProvisionedAccount[];
  registeredUsers: UserProfile[];
  auditLogs: AuditLogEntry[];
  onSeedFourCrewDataset: () => Promise<void>;
  onSelectScenarioForCrew: (crewId: string, scenario: SimulationScenarioId) => Promise<void>;
  onSelectCrew: (id: string) => void;
  onChangeStatusFilter: (filter: string) => void;
  onChangeSurgeonNote: (note: string) => void;
  onAddSurgeonNote: (e: React.FormEvent<HTMLFormElement>) => void;
  onUpdateRuleThreshold: (
    key: HealthIndicatorKey,
    field: 'cautionHigh' | 'cautionLow' | 'dangerHigh' | 'dangerLow',
    value: number
  ) => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onResolveAlert: (alertId: string) => void;
  onViewAlertDetails?: (alert: HealthAlert) => void;
  onProvisionAccount: (payload: {
    email: string;
    displayName: string;
    role: UserRole;
    crewId: string;
    missionRole: string;
  }) => Promise<void>;
  onAssignExistingUser: (payload: {
    userId: string;
    email: string;
    displayName: string;
    role: UserRole;
    crewId: string;
  }) => Promise<void>;
  onChangeChiefPassword?: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string; passwordUpdatedAt?: string }>;
}

const INDICATOR_ORDER: HealthIndicatorKey[] = [
  'heartRate',
  'spo2',
  'cabinOxygen',
  'coreTemp',
  'radiation',
  'hydration',
  'nutrition',
  'stress',
  'sleep'
];

const EVAL_BADGE_CLASS: Record<HealthStatusLevel, string> = {
  SAFE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  CAUTION: 'bg-amber-500/15 text-amber-200 border-amber-400/45',
  DANGER: 'bg-red-500/20 text-red-200 border-red-500/60'
};

export function MedicalChiefWorkspace({
  crewRoster,
  selectedCrewId,
  crewStatusFilter,
  newSurgeonNote,
  rules,
  alerts,
  activeScenario,
  series,
  countermeasures,
  researchItems,
  isFirestoreSeeded,
  provisionedAccounts,
  registeredUsers,
  auditLogs,
  onSeedFourCrewDataset,
  onSelectScenarioForCrew,
  onSelectCrew,
  onChangeStatusFilter,
  onChangeSurgeonNote,
  onAddSurgeonNote,
  onUpdateRuleThreshold,
  onAcknowledgeAlert,
  onResolveAlert,
  onViewAlertDetails,
  onProvisionAccount,
  onAssignExistingUser,
  onChangeChiefPassword
}: MedicalChiefWorkspaceProps) {
  const [alertViewFilter, setAlertViewFilter] = useState<'ALL' | 'OPEN' | 'CRITICAL'>('ALL');
  const [clinicalTab, setClinicalTab] = useState<
    'TRENDS' | 'COUNTERMEASURES' | 'EVIDENCE' | 'SECURITY'
  >('TRENDS');
  const [chartTimeframe, setChartTimeframe] = useState<TimeframeKey>('24H');
  const [seeding, setSeeding] = useState(false);

  // Provisioning form state
  const [provEmail, setProvEmail] = useState('');
  const [provName, setProvName] = useState('');
  const [provRole, setProvRole] = useState<UserRole>('ASTRONAUT');
  const [provCrewId, setProvCrewId] = useState('AG-LEO-01');
  const [provMissionRole, setProvMissionRole] = useState('Mission Specialist');
  const [provFeedback, setProvFeedback] = useState<string | null>(null);

  // Password rotation state
  const [currentChiefPw, setCurrentChiefPw] = useState('');
  const [newChiefPw, setNewChiefPw] = useState('');
  const [confirmChiefPw, setConfirmChiefPw] = useState('');
  const [showCurrentChiefPw, setShowCurrentChiefPw] = useState(false);
  const [showNewChiefPw, setShowNewChiefPw] = useState(false);
  const [showConfirmChiefPw, setShowConfirmChiefPw] = useState(false);
  const [pwRotating, setPwRotating] = useState(false);
  const [pwRotateFeedback, setPwRotateFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const selectedCrewMember =
    crewRoster.find((c) => c.id === selectedCrewId) || crewRoster[0];

  const selectedCrewEval = useMemo(
    () =>
      selectedCrewMember
        ? evaluateCrewHealth(selectedCrewMember.vitals, [selectedCrewMember.vitals], rules)
        : null,
    [selectedCrewMember, rules]
  );

  const selectedFindingByKey = useMemo(
    () => new Map(selectedCrewEval ? selectedCrewEval.findings.map((f) => [f.key, f]) : []),
    [selectedCrewEval]
  );

  const selectedCrewIdentity = useMemo(
    () => (selectedCrewMember ? getAstronautIdentity(selectedCrewMember.id) : null),
    [selectedCrewMember]
  );

  const selectedCrewSeries = useMemo(
    () =>
      selectedCrewMember
        ? getTelemetrySeriesForCrew(selectedCrewMember.id, selectedCrewMember.vitals)
        : series,
    [selectedCrewMember, series]
  );

  const currentSeries = selectedCrewSeries[chartTimeframe];

  const filteredRoster = crewRoster.filter(
    (m) => crewStatusFilter === 'ALL' || m.status.toUpperCase() === crewStatusFilter
  );

  const unacknowledgedCritical = alerts.filter(
    (a) => a.severity === 'CRITICAL' && !a.acknowledged
  );

  const visibleAlerts = alerts.filter((a) => {
    if (alertViewFilter === 'OPEN') return a.resolutionStatus !== 'RESOLVED';
    if (alertViewFilter === 'CRITICAL') return a.severity === 'CRITICAL';
    return true;
  });

  const hrCautionHigh = rules.heartRate.cautionHigh ?? 100;
  const spo2CautionLow = rules.spo2.cautionLow ?? 94;
  const hrDangerHigh = rules.heartRate.dangerHigh ?? 125;
  const spo2DangerLow = rules.spo2.dangerLow ?? 90;

  const handleSeedDataset = async () => {
    setSeeding(true);
    try {
      await onSeedFourCrewDataset();
    } finally {
      setSeeding(false);
    }
  };

  const handleProvisionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProvFeedback(null);
    if (!provEmail.trim() || !provName.trim()) {
      setProvFeedback('Provide both email address and crew member display name.');
      return;
    }
    await onProvisionAccount({
      email: provEmail.trim().toLowerCase(),
      displayName: provName.trim(),
      role: provRole,
      crewId: provRole === 'MEDICAL_CHIEF' ? 'MCC-ALL' : provCrewId,
      missionRole: provMissionRole.trim() || 'Flight Crew'
    });
    setProvFeedback(
      `Provisioned ${provEmail.trim().toLowerCase()} as ${provRole} (${
        provRole === 'MEDICAL_CHIEF' ? 'MCC-ALL' : provCrewId
      }).`
    );
    setProvEmail('');
    setProvName('');
  };

  const handlePasswordRotateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!onChangeChiefPassword) return;
    setPwRotateFeedback(null);

    if (!currentChiefPw || !newChiefPw) {
      setPwRotateFeedback({
        type: 'error',
        message: 'Enter your current password and a new access password.'
      });
      return;
    }
    if (newChiefPw.length < 8) {
      setPwRotateFeedback({
        type: 'error',
        message: 'New access password must be at least 8 characters.'
      });
      return;
    }
    if (newChiefPw !== confirmChiefPw) {
      setPwRotateFeedback({
        type: 'error',
        message: 'New password and confirmation do not match.'
      });
      return;
    }

    setPwRotating(true);
    try {
      const res = await onChangeChiefPassword(currentChiefPw, newChiefPw);
      if (res.ok) {
        setPwRotateFeedback({
          type: 'success',
          message: 'Medical Chief SCRYPT password hash rotated cleanly.'
        });
        setCurrentChiefPw('');
        setNewChiefPw('');
        setConfirmChiefPw('');
      } else {
        setPwRotateFeedback({
          type: 'error',
          message: res.error || 'Unable to rotate Medical Chief password.'
        });
      }
    } finally {
      setPwRotating(false);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col lg:flex-row min-w-0">
      {/* LEFT PANE: CENTRALIZED CREW MONITORING ROSTER + DEMO SCENARIO CONTROL */}
      <aside className="lg:w-[37%] xl:w-[35%] min-w-0 p-4 sm:p-5 lg:p-6 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#050C1B]/72 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.18em] text-sky-400">
              MCC HOUSTON · MEDICAL CHIEF WORKSPACE
            </span>
            <h1 className="font-display text-2xl font-bold text-white mt-0.5">
              Centralized Crew Monitoring
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Authorized mission-wide crew health overview &amp; alert triage (Simulated)
            </p>
          </div>

          <div className="flex items-center gap-1 ag-surface-inset p-1 rounded-xl">
            {['ALL', 'NOMINAL', 'WATCH', 'CRITICAL'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onChangeStatusFilter(f)}
                className={`px-2 py-1 rounded-lg text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                  crewStatusFilter === f
                    ? 'bg-[#105BD8] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Firestore 4-Crew Demo Initialization / Reset */}
        <div className="p-4 rounded-2xl ag-surface-primary border-sky-400/25 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Database className="w-[18px] h-[18px] text-sky-400 shrink-0" />
              <span>Presentation 4-Crew Simulation</span>
            </div>
            <span className="text-xs font-mono text-sky-300 shrink-0">
              {isFirestoreSeeded ? 'FIRESTORE SYNCED' : 'READY TO SEED'}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Syncs simulated 4-crew state to Firestore: <strong>AG-LEO-01</strong> SAFE,{' '}
            <strong>AG-LEO-02</strong> CAUTION, <strong>AG-LEO-03</strong> DANGER,{' '}
            <strong>AG-LEO-04</strong> SAFE.
          </p>
          <button
            type="button"
            disabled={seeding}
            onClick={() => void handleSeedDataset()}
            className="ag-nav-3d w-full py-2 px-3 rounded-xl bg-[#105BD8] hover:bg-[#196BF2] text-white text-xs font-semibold transition-colors disabled:opacity-60"
          >
            {seeding
              ? 'Syncing 4-Crew Dataset...'
              : isFirestoreSeeded
                ? 'Reset 4-Crew Demo Scenario (03 in DANGER)'
                : 'Initialize 4-Crew Mission Dataset in Firestore'}
          </button>
        </div>

        {/* Clean Centralized Crew List (Name, Crew ID, Status Indicator, Active Warning, Timestamp, Ack Status) */}
        <div className="space-y-2.5">
          {filteredRoster.map((member) => {
            const isSelected = selectedCrewMember && member.id === selectedCrewMember.id;
            const memberAlerts = alerts.filter((a) => a.astronautId === member.id);
            const openAlert =
              memberAlerts.find((a) => a.resolutionStatus !== 'RESOLVED') || memberAlerts[0];

            const statusBadge =
              member.status === 'Critical'
                ? {
                    label: 'RED — DANGER',
                    cls: 'bg-red-500/20 text-red-200 border border-red-500/60'
                  }
                : member.status === 'Watch'
                  ? {
                      label: 'YELLOW — CAUTION',
                      cls: 'bg-amber-500/15 text-amber-200 border border-amber-400/50'
                    }
                  : {
                      label: 'GREEN — SAFE',
                      cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                    };

            const memberIdentity = getAstronautIdentity(member.id);
            const memberHealthLevel: HealthStatusLevel =
              member.status === 'Critical'
                ? 'DANGER'
                : member.status === 'Watch'
                  ? 'CAUTION'
                  : 'SAFE';

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelectCrew(member.id)}
                className={`ag-card-3d w-full text-left p-3.5 rounded-2xl border transition-all space-y-2 ${
                  isSelected
                    ? 'bg-[#105BD8]/22 border-[#38BDF8]/70 shadow-[0_12px_30px_rgba(16,91,216,0.22)]'
                    : member.status === 'Critical'
                      ? 'bg-[#1A0B10]/90 border-red-500/55 hover:border-red-400'
                      : member.status === 'Watch'
                        ? 'bg-[#171207]/90 border-amber-400/35 hover:border-amber-300'
                        : 'ag-surface-primary hover:border-sky-400/35'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <AstronautPortrait
                      crewId={member.id}
                      name={member.name}
                      status={memberHealthLevel}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-white truncate">
                          {member.name}
                        </span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-black/30 text-sky-300 border border-white/10 shrink-0">
                          {member.id}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {member.rank || memberIdentity?.rank || 'Flight Crew'} · {member.role}
                      </div>
                      <div className="text-xs font-mono text-slate-500 mt-0.5 truncate">
                        {member.designationCode || memberIdentity?.designationCode || member.id} ·{' '}
                        {member.flightDay || memberIdentity?.flightDay || 'FD-084 / 180'}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-xs font-mono font-semibold shrink-0 whitespace-nowrap ${statusBadge.cls}`}
                  >
                    {statusBadge.label}
                  </span>
                </div>

                {/* Active warning summary */}
                <div className="text-xs text-slate-300 leading-snug">
                  {member.status === 'Nominal' ? (
                    <span className="text-emerald-300/90">No active health warnings.</span>
                  ) : (
                    <span
                      className={
                        member.status === 'Critical' ? 'text-red-200 font-medium' : 'text-amber-200'
                      }
                    >
                      {member.alertNote}
                    </span>
                  )}
                </div>

                {/* Timestamp + Alert Acknowledgement Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs font-mono">
                  <span className="text-slate-400">Eval: {member.lastSync}</span>
                  {openAlert ? (
                    <span
                      className={
                        openAlert.resolutionStatus === 'RESOLVED'
                          ? 'text-emerald-400'
                          : openAlert.acknowledged
                            ? 'text-sky-300'
                            : 'text-red-300 font-semibold'
                      }
                    >
                      {openAlert.resolutionStatus === 'RESOLVED'
                        ? 'ALERT RESOLVED'
                        : openAlert.acknowledged
                          ? 'ACKED (OPEN REVIEW)'
                          : 'UNACKNOWLEDGED ALERT'}
                    </span>
                  ) : (
                    <span className="text-slate-500">NO OPEN ALERTS</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Per-Selected-Crew Simulation Control */}
        {selectedCrewMember && (
          <div className="space-y-1.5">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Simulate Telemetry for {selectedCrewMember.name} ({selectedCrewMember.id})
            </div>
            <SimulationControlPanel
              activeScenario={selectedCrewMember.scenarioId ?? activeScenario}
              onSelectScenario={(scenario) =>
                void onSelectScenarioForCrew(selectedCrewMember.id, scenario)
              }
            />
          </div>
        )}
      </aside>

      {/* RIGHT PANE: 3D STATION & CREW VISUALIZER, ALERTS, DOSSIER, ECG, RULES & RBAC */}
      <section className="lg:w-[63%] xl:w-[65%] min-w-0 p-4 sm:p-5 lg:p-6 space-y-4 bg-[#030712]/42">
        {/* Interactive 3D ISS Station & Synchronized Crew Telemetry Visualizer */}
        <Suspense
          fallback={
            <div className="h-64 rounded-2xl ag-surface-elevated flex items-center justify-center text-xs font-mono text-sky-300">
              Initializing 3D Orbital Crew Monitor...
            </div>
          }
        >
          <LazyCrewOrbitalViewport
            crewRoster={crewRoster}
            selectedCrewId={selectedCrewMember?.id || selectedCrewId}
            onSelectCrew={onSelectCrew}
            selectedVitals={selectedCrewMember?.vitals}
            selectedEvalStatus={selectedCrewEval?.status}
          />
        </Suspense>

        {/* Prominent Unacknowledged Critical Alert Banner */}
        {unacknowledgedCritical.length > 0 && (
          <div
            role="alert"
            className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#1E0810] to-[#12060B] border border-red-500/80 shadow-[0_12px_40px_rgba(239,68,68,0.22)] space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 text-red-300">
                <ShieldAlert className="w-6 h-6 text-red-400 shrink-0" />
                <span className="font-display text-sm font-bold tracking-wide uppercase">
                  CRITICAL CREW HEALTH ALERT ({unacknowledgedCritical.length} UNACKNOWLEDGED)
                </span>
              </div>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-red-600 text-white font-bold whitespace-nowrap">
                STATUS: DANGER
              </span>
            </div>

            <div className="space-y-2.5">
              {unacknowledgedCritical.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3.5 rounded-xl ag-surface-inset border-red-500/40 flex flex-col xl:flex-row xl:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <AstronautPortrait
                      crewId={alert.astronautId}
                      name={alert.astronautName}
                      status="DANGER"
                      size="md"
                    />
                    <div className="space-y-1 text-xs min-w-0">
                      <div className="text-white font-semibold">
                        Astronaut: {alert.astronautName} ({alert.astronautId})
                      </div>
                      <div className="text-red-300 font-medium">
                        Detected condition: {alert.parameterLabel} —{' '}
                        <span className="font-mono font-bold tabular-nums">
                          {alert.currentReading}
                        </span>{' '}
                        (Simulated)
                      </div>
                      <div className="text-amber-200/90">
                        Recommended response: {alert.associatedCountermeasure}
                      </div>
                      <div className="text-xs font-mono text-slate-400 tabular-nums">
                        {alert.timestamp}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onViewAlertDetails && (
                      <button
                        type="button"
                        onClick={() => onViewAlertDetails(alert)}
                        className="px-3 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-400/50 text-red-100 text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        View Emergency Details
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectCrew(alert.astronautId)}
                      className="px-3 py-2 rounded-lg ag-surface-inset hover:border-white/25 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Open Dossier
                    </button>
                    <button
                      type="button"
                      onClick={() => onAcknowledgeAlert(alert.id)}
                      className="ag-nav-3d px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Acknowledge Alert
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Astronaut Detailed Dossier Header */}
        {selectedCrewMember && selectedCrewEval && (
          <>
            <div className="ag-card-3d ag-surface-primary p-4 sm:p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <AstronautPortrait
                  crewId={selectedCrewMember.id}
                  name={selectedCrewMember.name}
                  status={selectedCrewEval.status}
                  size="xl"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                    <span className="text-sky-400">
                      DETAILED BIOMETRIC DOSSIER · {selectedCrewMember.id}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">
                      {selectedCrewMember.designationCode ||
                        selectedCrewIdentity?.designationCode ||
                        selectedCrewMember.id}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-[#FF8A80]">SIMULATED DATA</span>
                  </div>
                  <h2 className="font-display text-xl font-bold text-white mt-0.5 truncate">
                    {selectedCrewMember.name}
                  </h2>
                  <div className="text-xs text-sky-200/90 mt-0.5">
                    {selectedCrewMember.rank || selectedCrewIdentity?.rank || 'Crew'} ·{' '}
                    {selectedCrewMember.role} ·{' '}
                    {selectedCrewMember.missionIncrement ||
                      selectedCrewIdentity?.missionIncrement ||
                      'ISS Expedition 74'}{' '}
                    ·{' '}
                    {selectedCrewMember.flightDay ||
                      selectedCrewIdentity?.flightDay ||
                      'FD-084 / 180'}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{selectedCrewMember.alertNote}</p>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    {selectedCrewMember.portraitAttribution ||
                      selectedCrewIdentity?.portraitAttribution ||
                      'Simulated Crew Portrait'}
                  </div>
                </div>
              </div>
              <div className="text-right font-mono text-xs text-slate-400 shrink-0">
                <div>{selectedCrewMember.lastSync}</div>
                <div
                  className={`mt-1 inline-block px-2 py-0.5 rounded border text-xs font-semibold ${EVAL_BADGE_CLASS[selectedCrewEval.status]}`}
                >
                  ENGINE STATUS: {selectedCrewEval.status}
                </div>
              </div>
            </div>

            {/* Live Selected-Crew ECG + Oxygen / Cardiovascular / Radiation Subsystems */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
              <div className="xl:col-span-7 rounded-2xl ag-surface-primary p-3.5">
                <LiveEcgMonitor
                  bpm={selectedCrewMember.vitals.heartRate}
                  status={selectedCrewEval.status}
                />
              </div>

              <div className="xl:col-span-5 rounded-2xl ag-surface-primary p-4 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-sky-400">
                    O2 · CARDIO · RADIATION ({selectedCrewMember.id})
                  </span>
                  <span className="text-xs font-mono text-slate-400">SIMULATED</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl ag-surface-inset">
                    <div className="font-mono text-slate-400">CABIN OXYGEN</div>
                    <div className="text-lg font-mono font-bold text-white tabular-nums mt-0.5">
                      {selectedCrewMember.vitals.cabinOxygen !== null
                        ? `${selectedCrewMember.vitals.cabinOxygen.toFixed(1)}%`
                        : '--'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl ag-surface-inset">
                    <div className="font-mono text-slate-400">ARTERIAL SpO2</div>
                    <div className="text-lg font-mono font-bold text-white tabular-nums mt-0.5">
                      {selectedCrewMember.vitals.spo2 !== null
                        ? `${Math.round(selectedCrewMember.vitals.spo2)}%`
                        : '--'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl ag-surface-inset">
                    <div className="font-mono text-slate-400">HRV RMSSD</div>
                    <div className="text-lg font-mono font-bold text-emerald-300 tabular-nums mt-0.5">
                      {selectedCrewMember.hrv} ms
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl ag-surface-inset">
                    <div className="font-mono text-slate-400">RADIATION DOSE</div>
                    <div className="text-lg font-mono font-bold text-amber-200 tabular-nums mt-0.5">
                      {selectedCrewMember.vitals.radiation !== null
                        ? `${selectedCrewMember.vitals.radiation.toFixed(2)} mSv/d`
                        : '--'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Biometric Snapshot Grid — All 9 Evaluated Health Parameters */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-sky-400">
                  INDIVIDUAL PARAMETER EVALUATIONS · 9 CHANNELS ({selectedCrewMember.id})
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Evaluated {selectedCrewEval.evaluatedAt}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {INDICATOR_ORDER.map((key) => {
                  const rule = rules[key];
                  const finding = selectedFindingByKey.get(key);
                  const level: HealthStatusLevel = finding ? finding.level : 'SAFE';
                  const reading = formatVitalReading(selectedCrewMember.vitals[key], rule.unit);

                  return (
                    <div
                      key={key}
                      title={finding ? finding.reason : `${rule.label} within configured limits`}
                      className={`p-3 rounded-xl border transition-colors ${
                        level === 'DANGER'
                          ? 'bg-red-950/35 border-red-500/60'
                          : level === 'CAUTION'
                            ? 'bg-amber-950/25 border-amber-400/50'
                            : 'ag-surface-primary'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-mono text-slate-400 truncate">
                          {rule.label.toUpperCase()}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded border text-xs font-mono font-semibold shrink-0 ${EVAL_BADGE_CLASS[level]}`}
                        >
                          {finding?.isMissingData ? 'NO SIG' : level}
                        </span>
                      </div>
                      <div className="text-base font-mono font-bold text-white mt-1 tabular-nums">
                        {reading}
                      </div>
                      {finding && (
                        <div className="text-xs text-slate-300 mt-1 line-clamp-2 leading-snug">
                          {finding.reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Clinical Tabs: Trends, Countermeasures, Evidence, RBAC Provisioning & Audit Logs */}
        <div className="p-4 sm:p-5 rounded-2xl ag-surface-primary space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 ag-surface-inset p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setClinicalTab('TRENDS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  clinicalTab === 'TRENDS'
                    ? 'bg-[#105BD8] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-[18px] h-[18px] shrink-0" />
                <span>Trends &amp; Graphs</span>
              </button>
              <button
                type="button"
                onClick={() => setClinicalTab('COUNTERMEASURES')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  clinicalTab === 'COUNTERMEASURES'
                    ? 'bg-[#105BD8] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Dumbbell className="w-[18px] h-[18px] shrink-0" />
                <span>Countermeasures</span>
              </button>
              <button
                type="button"
                onClick={() => setClinicalTab('EVIDENCE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  clinicalTab === 'EVIDENCE'
                    ? 'bg-[#105BD8] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-[18px] h-[18px] shrink-0" />
                <span>Evidence</span>
              </button>
              <button
                type="button"
                onClick={() => setClinicalTab('SECURITY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  clinicalTab === 'SECURITY'
                    ? 'bg-[#105BD8] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="w-[18px] h-[18px] shrink-0" />
                <span>RBAC &amp; Audit</span>
              </button>
            </div>

            {clinicalTab === 'TRENDS' && (
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#050B16] border border-white/10">
                {(['24H', '7D', '30D'] as TimeframeKey[]).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setChartTimeframe(tf)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors whitespace-nowrap ${
                      chartTimeframe === tf
                        ? 'bg-[#105BD8] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            )}
          </div>

          {clinicalTab === 'TRENDS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#050B16] border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Heart Rate Trend (BPM)</span>
                  <span className="font-mono text-xs text-sky-400">SIMULATED</span>
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
              <div className="p-4 rounded-xl bg-[#050B16] border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">HRV RMSSD Recovery (ms)</span>
                  <span className="font-mono text-xs text-emerald-400">SIMULATED</span>
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
          )}

          {clinicalTab === 'COUNTERMEASURES' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {countermeasures.map((cm) => (
                <div
                  key={cm.id}
                  className="p-3.5 rounded-xl bg-[#050B16] border border-white/5 space-y-1.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">
                      {cm.code} · {cm.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-xs shrink-0 ${
                        cm.completed
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-200 border border-amber-400/30'
                      }`}
                    >
                      {cm.completed ? 'COMPLETE' : `${cm.progress}%`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {cm.schedule} · {cm.intensity}
                  </div>
                  <div className="text-xs text-slate-300">{cm.notes}</div>
                </div>
              ))}
            </div>
          )}

          {clinicalTab === 'EVIDENCE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {researchItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[#050B16] border border-white/5 space-y-1.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-sky-400">{item.code}</span>
                    <span className="text-xs font-mono text-emerald-400">
                      {item.evidenceGrade}
                    </span>
                  </div>
                  <div className="font-semibold text-white">{item.title}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.summary}</p>
                </div>
              ))}
            </div>
          )}

          {clinicalTab === 'SECURITY' && (
            <div className="space-y-5">
              {/* Medical Chief Access Password Rotation */}
              {onChangeChiefPassword && (
                <div className="p-4 rounded-xl bg-[#050B16] border border-sky-500/25 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Lock className="w-[18px] h-[18px] text-sky-400 shrink-0" />
                      <span>Rotate Medical Chief Access Password (SCRYPT)</span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 uppercase">
                      HASHED STORAGE ONLY
                    </span>
                  </div>

                  <form
                    onSubmit={(e) => void handlePasswordRotateSubmit(e)}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs"
                  >
                    <div className="relative">
                      <input
                        type={showCurrentChiefPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Current password"
                        value={currentChiefPw}
                        onChange={(e) => setCurrentChiefPw(e.target.value)}
                        disabled={pwRotating}
                        className="w-full rounded-lg bg-[#0A1428] border border-white/10 pl-3 pr-10 py-2 text-white placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentChiefPw((prev) => !prev)}
                        aria-label={showCurrentChiefPw ? 'Hide current password' : 'Show current password'}
                        aria-pressed={showCurrentChiefPw}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-sky-300"
                      >
                        {showCurrentChiefPw ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showNewChiefPw ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="New password (min 8 chars)"
                        value={newChiefPw}
                        onChange={(e) => setNewChiefPw(e.target.value)}
                        disabled={pwRotating}
                        className="w-full rounded-lg bg-[#0A1428] border border-white/10 pl-3 pr-10 py-2 text-white placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewChiefPw((prev) => !prev)}
                        aria-label={showNewChiefPw ? 'Hide new password' : 'Show new password'}
                        aria-pressed={showNewChiefPw}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-sky-300"
                      >
                        {showNewChiefPw ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showConfirmChiefPw ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Confirm new password"
                        value={confirmChiefPw}
                        onChange={(e) => setConfirmChiefPw(e.target.value)}
                        disabled={pwRotating}
                        className="w-full rounded-lg bg-[#0A1428] border border-white/10 pl-3 pr-10 py-2 text-white placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmChiefPw((prev) => !prev)}
                        aria-label={showConfirmChiefPw ? 'Hide confirmation password' : 'Show confirmation password'}
                        aria-pressed={showConfirmChiefPw}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-sky-300"
                      >
                        {showConfirmChiefPw ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={pwRotating}
                      className="sm:col-span-3 py-2 px-4 rounded-lg bg-[#105BD8] hover:bg-[#196BF2] text-white font-semibold transition-colors disabled:opacity-60"
                    >
                      {pwRotating ? 'Rotating SCRYPT Hash...' : 'Update Medical Chief Password'}
                    </button>
                  </form>

                  {pwRotateFeedback && (
                    <div
                      className={`text-xs font-mono ${
                        pwRotateFeedback.type === 'success' ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {pwRotateFeedback.message}
                    </div>
                  )}
                </div>
              )}

              {/* Authorized Account Provisioning */}
              <div className="p-4 rounded-xl bg-[#050B16] border border-white/10 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <UserPlus className="w-[18px] h-[18px] text-sky-400 shrink-0" />
                  <span>Provision Authorized Crew or Medical Chief Email</span>
                </div>
                <form
                  onSubmit={(e) => void handleProvisionSubmit(e)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs"
                >
                  <input
                    type="email"
                    placeholder="Verified Google/Mission email"
                    value={provEmail}
                    onChange={(e) => setProvEmail(e.target.value)}
                    className="rounded-lg bg-[#0A1428] border border-white/10 px-3 py-2 text-white placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Display Name (e.g. Cmdr. Elena Vance)"
                    value={provName}
                    onChange={(e) => setProvName(e.target.value)}
                    className="rounded-lg bg-[#0A1428] border border-white/10 px-3 py-2 text-white placeholder:text-slate-500"
                  />
                  <select
                    value={provRole}
                    onChange={(e) => setProvRole(e.target.value as UserRole)}
                    className="rounded-lg bg-[#0A1428] border border-white/10 px-3 py-2 text-white"
                  >
                    <option value="ASTRONAUT">ASTRONAUT</option>
                    <option value="MEDICAL_CHIEF">MEDICAL_CHIEF</option>
                  </select>
                  {provRole === 'ASTRONAUT' ? (
                    <select
                      value={provCrewId}
                      onChange={(e) => setProvCrewId(e.target.value)}
                      className="rounded-lg bg-[#0A1428] border border-white/10 px-3 py-2 text-white"
                    >
                      <option value="AG-LEO-01">AG-LEO-01 (Cmdr. Elena Vance)</option>
                      <option value="AG-LEO-02">AG-LEO-02 (Dr. Kenji Takahashi)</option>
                      <option value="AG-LEO-03">AG-LEO-03 (Maj. Sofia Lindqvist)</option>
                      <option value="AG-LEO-04">AG-LEO-04 (Dr. Marcus Sterling)</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value="MCC-ALL (Mission-Wide)"
                      disabled
                      className="rounded-lg bg-[#0A1428]/50 border border-white/10 px-3 py-2 text-slate-400"
                    />
                  )}
                  <input
                    type="text"
                    placeholder="Mission Role (e.g. Mission Commander)"
                    value={provMissionRole}
                    onChange={(e) => setProvMissionRole(e.target.value)}
                    className="rounded-lg bg-[#0A1428] border border-white/10 px-3 py-2 text-white placeholder:text-slate-500 sm:col-span-2"
                  />
                  <button
                    type="submit"
                    className="sm:col-span-2 py-2 px-4 rounded-lg bg-[#105BD8] hover:bg-[#196BF2] text-white font-semibold transition-colors"
                  >
                    Authorize &amp; Bind Role in Firestore
                  </button>
                </form>

                {provFeedback && (
                  <div className="text-xs text-emerald-300 font-mono">{provFeedback}</div>
                )}

                {provisionedAccounts.length > 0 && (
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <div className="text-xs font-mono text-slate-400 uppercase">
                      Active Provisioned Email Bindings ({provisionedAccounts.length})
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {provisionedAccounts.map((p) => (
                        <div
                          key={p.emailKey}
                          className="flex items-center justify-between text-xs font-mono bg-[#0A1428] px-2.5 py-1.5 rounded border border-white/5"
                        >
                          <span className="text-white truncate">{p.email}</span>
                          <span className="text-sky-300 shrink-0">
                            {p.role} · {p.crewId}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {registeredUsers.some((u) => u.accountStatus === 'PENDING') && (
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <div className="text-xs font-mono text-amber-300 uppercase">
                      Pending Authenticated Users Awaiting Assignment
                    </div>
                    {registeredUsers
                      .filter((u) => u.accountStatus === 'PENDING')
                      .map((u) => (
                        <div
                          key={u.userId}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs bg-amber-950/20 border border-amber-400/30 p-2 rounded-lg"
                        >
                          <span className="font-mono text-white">{u.email}</span>
                          <div className="flex items-center gap-1.5">
                            {(['AG-LEO-01', 'AG-LEO-02', 'AG-LEO-03', 'AG-LEO-04'] as const).map(
                              (cid) => (
                                <button
                                  key={cid}
                                  type="button"
                                  onClick={() =>
                                    void onAssignExistingUser({
                                      userId: u.userId,
                                      email: u.email,
                                      displayName: u.displayName,
                                      role: 'ASTRONAUT',
                                      crewId: cid
                                    })
                                  }
                                  className="px-2 py-1 rounded bg-[#105BD8] hover:bg-[#196BF2] text-white font-mono text-xs"
                                >
                                  Assign {cid}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Immutable Security Audit Log */}
              <div className="p-4 rounded-xl bg-[#050B16] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <FileText className="w-[18px] h-[18px] text-sky-400 shrink-0" />
                    <span>Security &amp; Clinical Audit Log (Append-Only)</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {auditLogs.length} EVENTS
                  </span>
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {auditLogs.length === 0 ? (
                    <div className="text-xs text-slate-500 font-mono py-3 text-center">
                      No audit events recorded yet.
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-lg bg-[#0A1428] border border-white/5 text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-2 font-mono">
                          <span className="text-sky-300 font-semibold">{log.action}</span>
                          <span className="text-slate-500">{log.timestamp}</span>
                        </div>
                        <div className="text-slate-300">{log.details}</div>
                        <div className="text-xs font-mono text-slate-500">
                          Actor: {log.actorEmail} ({log.actorRole}) · Target: {log.targetRecord}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Shared Multi-Astronaut Alert History Table (Separate Ack & Resolution Status) */}
        <div className="p-4 sm:p-5 rounded-2xl ag-surface-primary space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-white">
                Central Alert Queue &amp; Alert History ({alerts.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Acknowledgement logs operator receipt; resolution status remains OPEN until clinical
                review completes.
              </p>
            </div>

            <div className="flex items-center gap-1 ag-surface-inset p-1 rounded-xl">
              {(['ALL', 'OPEN', 'CRITICAL'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAlertViewFilter(tab)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                    alertViewFilter === tab
                      ? 'bg-[#105BD8] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {visibleAlerts.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-400 ag-surface-inset rounded-xl">
                No alerts match the current filter.
              </div>
            ) : (
              visibleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    alert.severity === 'CRITICAL' && alert.resolutionStatus !== 'RESOLVED'
                      ? 'bg-red-950/35 border-red-500/60'
                      : alert.severity === 'CRITICAL'
                        ? 'bg-[#050B16] border-red-500/30'
                        : 'bg-[#050B16] border-amber-400/25'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {alert.severity === 'CRITICAL' ? (
                        <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
                      )}
                      <span className="font-semibold text-white">
                        {alert.astronautName} ({alert.astronautId})
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-amber-500/15 text-amber-200 border border-amber-400/40'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold ${
                          alert.resolutionStatus === 'RESOLVED'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                            : 'bg-sky-500/15 text-sky-300 border border-sky-500/35'
                        }`}
                      >
                        {alert.resolutionStatus}
                      </span>
                    </div>

                    <span className="font-mono text-xs text-slate-400">
                      {alert.timestamp}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs text-slate-300 tabular-nums">
                    <div>
                      <span className="text-slate-500">Parameter: </span>
                      <span className="text-white">{alert.parameterLabel}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Transition: </span>
                      <span>
                        {alert.previousStatus} → {alert.newStatus}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Reading: </span>
                      <span className="text-sky-300">
                        {alert.currentReading} (prev {alert.previousReading})
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/5">
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <div>Countermeasure: {alert.associatedCountermeasure}</div>
                      {alert.acknowledged && (
                        <div className="text-sky-300 font-mono">
                          Acknowledged by {alert.acknowledgedBy} ({alert.acknowledgedAt})
                        </div>
                      )}
                      {alert.resolutionStatus === 'RESOLVED' && alert.resolvedBy && (
                        <div className="text-emerald-400 font-mono">
                          Resolved by {alert.resolvedBy} ({alert.resolvedAt})
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {onViewAlertDetails && (
                        <button
                          type="button"
                          onClick={() => onViewAlertDetails(alert)}
                          className="px-2.5 py-1 rounded-lg bg-red-950/50 hover:bg-red-900/50 border border-red-400/40 text-red-200 text-xs font-medium transition-colors"
                        >
                          View Emergency Details
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectCrew(alert.astronautId)}
                        className="px-2.5 py-1 rounded-lg bg-[#0A1428] hover:bg-white/10 border border-white/15 text-slate-200 text-xs font-medium transition-colors"
                      >
                        Open Dossier
                      </button>

                      {!alert.acknowledged && (
                        <button
                          type="button"
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          className="px-3 py-1 rounded-lg bg-[#105BD8] hover:bg-[#196BF2] text-white text-xs font-semibold transition-colors"
                        >
                          Acknowledge Alert
                        </button>
                      )}

                      {alert.resolutionStatus !== 'RESOLVED' && (
                        <button
                          type="button"
                          onClick={() => onResolveAlert(alert.id)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <ShieldCheck className="w-[18px] h-[18px] shrink-0" />
                          <span>Mark Resolved</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Configurable Evaluation Engine Threshold Controls */}
        <div className="p-4 sm:p-5 rounded-2xl ag-surface-primary space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-[18px] h-[18px] text-sky-400 shrink-0" />
              <span>Configurable Evaluation Rules (Medical Chief Authorized)</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">
              PROTOTYPE RULES · NOT NASA FLIGHT RULES
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-3.5 rounded-xl ag-surface-inset space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">HR Caution Upper (Demo)</span>
                <span className="font-mono text-amber-300 font-semibold tabular-nums">
                  {hrCautionHigh} BPM
                </span>
              </div>
              <input
                type="range"
                min="85"
                max="120"
                value={hrCautionHigh}
                onChange={(e) =>
                  onUpdateRuleThreshold('heartRate', 'cautionHigh', Number(e.target.value))
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs pt-1">
                <span className="text-slate-400">HR Danger Upper (Demo)</span>
                <span className="font-mono text-red-400 font-semibold tabular-nums">
                  {hrDangerHigh} BPM
                </span>
              </div>
              <input
                type="range"
                min="115"
                max="150"
                value={hrDangerHigh}
                onChange={(e) =>
                  onUpdateRuleThreshold('heartRate', 'dangerHigh', Number(e.target.value))
                }
                className="w-full"
              />
            </div>

            <div className="p-3.5 rounded-xl ag-surface-inset space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">SpO2 Caution Floor (Demo)</span>
                <span className="font-mono text-amber-300 font-semibold tabular-nums">
                  {spo2CautionLow}%
                </span>
              </div>
              <input
                type="range"
                min="91"
                max="97"
                value={spo2CautionLow}
                onChange={(e) =>
                  onUpdateRuleThreshold('spo2', 'cautionLow', Number(e.target.value))
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs pt-1">
                <span className="text-slate-400">SpO2 Danger Floor (Demo)</span>
                <span className="font-mono text-red-400 font-semibold tabular-nums">
                  {spo2DangerLow}%
                </span>
              </div>
              <input
                type="range"
                min="85"
                max="92"
                value={spo2DangerLow}
                onChange={(e) =>
                  onUpdateRuleThreshold('spo2', 'dangerLow', Number(e.target.value))
                }
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Flight Surgeon Clinical Notes Log */}
        {selectedCrewMember && (
          <div className="p-4 sm:p-5 rounded-2xl ag-surface-primary space-y-3.5">
            <h3 className="font-display text-sm font-semibold text-white">
              Flight Surgeon Clinical Log — {selectedCrewMember.name}
            </h3>

            <form onSubmit={onAddSurgeonNote} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Enter clinical observation or countermeasure directive..."
                value={newSurgeonNote}
                onChange={(e) => onChangeSurgeonNote(e.target.value)}
                className="flex-1 rounded-xl ag-surface-inset px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#38BDF8]"
              />
              <button
                type="submit"
                className="ag-nav-3d px-4 py-2 rounded-xl bg-[#105BD8] hover:bg-[#196BF2] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-[18px] h-[18px] shrink-0" />
                <span>Add Note</span>
              </button>
            </form>

            <div className="space-y-2.5">
              {selectedCrewMember.notes.length === 0 ? (
                <div className="text-xs text-slate-500 font-mono">
                  No Flight Surgeon clinical notes recorded for {selectedCrewMember.id}.
                </div>
              ) : (
                selectedCrewMember.notes.map((note, index) => (
                  <div
                    key={note.id || index}
                    className="p-3.5 rounded-xl ag-surface-inset space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs font-mono text-sky-400">
                      <span>{note.author}</span>
                      <span className="text-slate-500">{note.time}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{note.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
