export type ModuleId =
  | 'overview'
  | 'my-health'
  | 'assessment'
  | 'countermeasures'
  | 'history'
  | 'research'
  | 'medical-chief';

export type TimeframeKey = '24H' | '7D' | '30D';

export type HealthStatusLevel = 'SAFE' | 'CAUTION' | 'DANGER';

export type FontSizePreset = 'compact' | 'standard' | 'large';

export type SimulationScenarioId = 'SAFE' | 'CAUTION' | 'DANGER' | 'MISSING_SENSOR';

export type UserRole = 'ASTRONAUT' | 'MEDICAL_CHIEF';

export type AccountStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED';

export type AuthSessionMode = 'SIMULATION_CREW' | 'VERIFIED_FIREBASE';

export interface AstronautIdentityRecord {
  id: string;
  designationCode: string;
  fullName: string;
  rank: string;
  missionRole: string;
  missionIncrement: string;
  flightDay: string;
  portraitUrl: string;
  portraitFallbackUrl?: string;
  portraitAttribution: string;
  portraitSource: string;
  isHistorical: boolean;
  patchCode: string;
  avatarTone: string;
}

export interface CrewSelectionProfile {
  crewId: string;
  designationCode: string;
  name: string;
  rank: string;
  missionRole: string;
  missionId: string;
  flightDay: string;
  patchCode: string;
  avatarTone: string;
  portraitUrl: string;
  portraitAttribution: string;
  portraitSource: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  crewId: string;
  accountStatus: AccountStatus;
}

export interface ProvisionedAccount {
  emailKey: string;
  email: string;
  displayName: string;
  role: UserRole;
  crewId: string;
  missionRole: string;
  provisionedBy: string;
}

export type HealthIndicatorKey =
  | 'heartRate'
  | 'spo2'
  | 'cabinOxygen'
  | 'radiation'
  | 'coreTemp'
  | 'hydration'
  | 'nutrition'
  | 'stress'
  | 'sleep';

export interface TelemetryVitalsSnapshot {
  heartRate: number | null;
  spo2: number | null;
  cabinOxygen: number | null;
  radiation: number | null;
  coreTemp: number | null;
  hydration: number | null;
  nutrition: number | null;
  stress: number | null;
  sleep: number | null;
}

export interface EvaluationRule {
  key: HealthIndicatorKey;
  label: string;
  unit: string;
  cautionLow?: number;
  cautionHigh?: number;
  dangerLow?: number;
  dangerHigh?: number;
  persistenceSamples: number;
  isCritical: boolean;
  ruleOrigin: 'DEMONSTRATION_RULE' | 'OPERATIONAL_REFERENCE';
  recommendedCountermeasure: string;
}

export interface ParameterEvaluationFinding {
  key: HealthIndicatorKey;
  label: string;
  unit: string;
  currentValue: number | null;
  formattedReading: string;
  previousReading?: string;
  level: HealthStatusLevel;
  reason: string;
  ruleOrigin: 'DEMONSTRATION_RULE' | 'OPERATIONAL_REFERENCE';
  recommendedCountermeasure: string;
  isMissingData?: boolean;
}

export interface HealthEvaluationResult {
  status: HealthStatusLevel;
  statusHeadline: string;
  statusSubtext: string;
  primaryFinding: ParameterEvaluationFinding | null;
  findings: ParameterEvaluationFinding[];
  hasMissingCriticalData: boolean;
  evaluatedAt: string;
  disclaimer: string;
}

export type AlertResolutionStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED';

export interface HealthAlert {
  id: string;
  astronautId: string;
  astronautName: string;
  parameterKey: HealthIndicatorKey | 'sensor_link';
  parameterLabel: string;
  previousStatus: HealthStatusLevel;
  newStatus: HealthStatusLevel;
  severity: 'CAUTION' | 'CRITICAL';
  currentReading: string;
  previousReading: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolutionStatus: AlertResolutionStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  associatedCountermeasure: string;
  message: string;
  isSimulated: true;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorEmail: string;
  actorRole: UserRole | 'UNASSIGNED';
  action: string;
  targetRecord: string;
  details: string;
  timestamp: string;
}

export interface ArchivalTribute {
  id: string;
  designationCode: string;
  name: string;
  designation: string;
  years: string;
  imageUrl: string;
  fallbackUrl: string;
  attribution: string;
  portraitSource: string;
  quote: string;
  focusArea: string;
  isHistorical: true;
}

export interface CrewProfile {
  id: string;
  designationCode: string;
  name: string;
  rank: string;
  role: string;
  missionIncrement: string;
  missionDay: string;
  orbitAltitude: string;
  inclination: string;
  portraitUrl: string;
  portraitAttribution: string;
  portraitSource: string;
  restingHr: number;
  spo2: number;
  coreTemp: number;
  hrv: number;
  radiation: number;
  bp: string;
  vitals: TelemetryVitalsSnapshot;
}

export interface TelemetryTimeframeSeries {
  labels: string[];
  hr: number[];
  hrv: number[];
  spo2: number[];
  temp: number[];
  sleepScore: number;
  remPercent: number;
  deepPercent: number;
}

export interface CountermeasureItem {
  id: string;
  code: string;
  title: string;
  category: string;
  schedule: string;
  target: string;
  intensity: string;
  duration: string;
  completed: boolean;
  progress: number;
  notes: string;
}

export interface HealthHistoryRecord {
  id: string;
  date: string;
  phase: string;
  metric: string;
  value: string;
  baselineDelta: string;
  status: 'Nominal' | 'Monitored' | 'Critical';
}

export interface ResearchEvidenceItem {
  id: string;
  category: string;
  code: string;
  title: string;
  source: string;
  summary: string;
  implications: string[];
  evidenceGrade: string;
}

export interface SurgeonNote {
  id?: string;
  time: string;
  author: string;
  text: string;
}

export interface CrewRosterMember {
  id: string;
  designationCode?: string;
  name: string;
  rank?: string;
  role: string;
  missionIncrement?: string;
  flightDay?: string;
  portraitUrl?: string;
  portraitAttribution?: string;
  portraitSource?: string;
  status: 'Nominal' | 'Watch' | 'Critical';
  hr: number;
  hrv: number;
  spo2: number;
  temp: number;
  radiation: number;
  readiness: number;
  lastSync: string;
  alertNote: string;
  scenarioId?: SimulationScenarioId;
  vitals: TelemetryVitalsSnapshot;
  notes: SurgeonNote[];
}

export interface AssessmentInputs {
  sleepQuality: number;
  fatigueLevel: number;
  vestibularComfort: number;
  hydrationAdequacy: number;
  visualClarity: number;
  notes: string;
}

// ---------------------------------------------------------------------------
// Python health engine report (additive; TypeScript engine remains fallback)
// ---------------------------------------------------------------------------
export type PythonParameterStatus = 'NORMAL' | 'WATCH' | 'ALERT' | 'NO_DATA';

export type PythonCondition = 'FINE' | 'CAUTION' | 'DANGER' | 'NO SIGNAL';

export interface PythonDomainResult {
  status: PythonParameterStatus;
  summary: Record<string, unknown>;
  trend: Record<string, unknown>;
  alerts: string[];
  actions: string[];
  note?: string;
  personal_baseline?: Record<string, unknown>;
}

export interface PythonContributingParameter {
  parameter: string;
  label: string;
  status: PythonParameterStatus;
  summary: Record<string, unknown>;
  reason: string;
  critical: boolean;
}

export interface PythonCountermeasure {
  id: string;
  code: string;
  parameter: string;
  label: string;
  title: string;
  instruction: string;
  priority: 'CRITICAL' | 'ROUTINE';
  evidence: {
    source: string;
    rule: string;
    note: string;
  };
  completionStatus: 'PENDING' | 'COMPLETED';
  progress: number;
}

export interface PythonHealthReport {
  condition: PythonCondition;
  readiness: number;
  overall_status: 'NORMAL' | 'WATCH' | 'ALERT' | 'LIMITED_DATA' | 'INSUFFICIENT_DATA';
  condition_reason: string;
  contributing_parameters: PythonContributingParameter[];
  critical_alerts: string[];
  alert_domains: string[];
  watch_domains: string[];
  readiness_components: {
    starting_score: number;
    penalties: Array<{ parameter: string; status: PythonParameterStatus; penalty: number }>;
    penalty_total: number;
    missing_data_cap_applied: boolean;
  };
  data_quality: {
    domains_with_no_data: string[];
    coverage_pct: number;
    invalid_value_counts: Record<string, number>;
    validation: {
      valid: boolean;
      errors: string[];
      warnings: string[];
      invalid_columns: Record<string, number>;
      row_count: number;
    };
    warning: string | null;
  };
  parameter_definitions: Record<
    string,
    { label: string; unit: string; source: string }
  >;
  domains: Record<string, PythonDomainResult>;
  countermeasures: PythonCountermeasure[];
  countermeasure_summary: {
    total: number;
    completed: number;
    pending: number;
    completion_pct: number;
  };
  alerts: string[];
  actions: string[];
  model_disclaimer: string;
  engine: string;
  is_simulated: boolean;
  crew_id: string | null;
}
