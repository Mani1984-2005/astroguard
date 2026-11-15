import { auth } from '../firebase';
import {
  CountermeasureItem,
  CrewProfile,
  PythonHealthReport,
  TelemetryTimeframeSeries,
  TelemetryVitalsSnapshot
} from '../types/astroguard';

/**
 * The Python engine expects a daily log. The web app stores interval telemetry,
 * so the client maps the existing 7-day series and places snapshot-only values
 * on the latest row. Unavailable readings remain missing.
 */
export const PYTHON_LOG_PROVENANCE =
  'Derived from simulated demonstration telemetry. Snapshot-only values appear on the latest row; unavailable measurements remain missing.';

export interface PythonDailyLogRow {
  day: number;
  systolic: number | null;
  diastolic: number | null;
  spo2: number | null;
  body_temp: number | null;
  sleep_hours: number | null;
  resting_hr: number | null;
  heart_rate: number | null;
  hrv_ms: number | null;
  stress_self: number | null;
  radiation_msv: number | null;
  water_l: number | null;
  calories_kcal: number | null;
  resist_min: number | null;
  tread_min: number | null;
  cycle_min: number | null;
  [key: string]: number | null;
}

function parseBloodPressure(bp: string): { systolic: number | null; diastolic: number | null } {
  const match = /^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/.exec(bp || '');
  if (!match) return { systolic: null, diastolic: null };
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

/**
 * Map available 7-day telemetry without filling historical gaps with snapshots.
 */
export function buildDerivedDailyLog(
  crewProfile: CrewProfile,
  vitals: TelemetryVitalsSnapshot,
  series: Record<string, TelemetryTimeframeSeries>
): PythonDailyLogRow[] {
  const sevenDay = series['7D'];
  const sampleCount = Math.max(
    sevenDay?.hr?.length ?? 0,
    sevenDay?.hrv?.length ?? 0,
    sevenDay?.spo2?.length ?? 0,
    sevenDay?.temp?.length ?? 0
  );
  const length = Math.max(3, Math.min(7, sampleCount || 3));
  const bp = parseBloodPressure(crewProfile.bp);
  return Array.from({ length }, (_, index) => ({
    day: index + 1,
    systolic: index === length - 1 ? bp.systolic : null,
    diastolic: index === length - 1 ? bp.diastolic : null,
    spo2: sevenDay?.spo2?.[index] ?? (index === length - 1 ? vitals.spo2 : null),
    body_temp: sevenDay?.temp?.[index] ?? (index === length - 1 ? vitals.coreTemp : null),
    sleep_hours: index === length - 1 ? vitals.sleep : null,
    resting_hr: sevenDay?.hr?.[index] ?? (index === length - 1 ? vitals.heartRate : null),
    heart_rate: sevenDay?.hr?.[index] ?? (index === length - 1 ? vitals.heartRate : null),
    hrv_ms: sevenDay?.hrv?.[index] ?? (index === length - 1 ? crewProfile.hrv : null),
    stress_self: index === length - 1 ? vitals.stress : null,
    radiation_msv: index === length - 1 ? vitals.radiation : null,
    water_l: index === length - 1 ? vitals.hydration : null,
    calories_kcal: index === length - 1 ? vitals.nutrition : null,
    resist_min: null,
    tread_min: null,
    cycle_min: null
  }));
}

export function buildCountermeasureCompletionMap(
  countermeasures: CountermeasureItem[]
): Record<string, boolean> {
  const completed: Record<string, boolean> = {};
  for (const item of countermeasures) {
    if (!item.completed) continue;
    const text = `${item.title} ${item.category} ${item.target}`.toLowerCase();
    if (/hydrat|fluid|plasma/.test(text)) completed.hydration = true;
    if (/sleep|circadian|phototherapy/.test(text)) completed.sleep = true;
    if (/nutrition|calorie|energy/.test(text)) completed.nutrition = true;
    if (/stress|autonomic|recovery/.test(text)) completed.stress = true;
    if (/exercise|ared|resist|treadmill/.test(text)) {
      completed.muscle = true;
      completed.bone = true;
    }
  }
  return completed;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Cookie-based simulation sessions do not need a bearer token.
  }
  return headers;
}

export interface PythonAnalyzeResult {
  ok: boolean;
  report: PythonHealthReport | null;
  error?: string;
}

export async function analyzeHealthWithPython(params: {
  crewId: string;
  crewProfile: CrewProfile;
  vitals: TelemetryVitalsSnapshot;
  series: Record<string, TelemetryTimeframeSeries>;
  countermeasures: CountermeasureItem[];
}): Promise<PythonAnalyzeResult> {
  try {
    const logs = buildDerivedDailyLog(params.crewProfile, params.vitals, params.series);
    const response = await fetch('/api/health/analyze', {
      method: 'POST',
      credentials: 'same-origin',
      headers: await authHeaders(),
      body: JSON.stringify({
        crewId: params.crewId,
        logs,
        priorCareerMsv: 0,
        countermeasureStatus: buildCountermeasureCompletionMap(params.countermeasures)
      })
    });
    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      report?: PythonHealthReport;
      error?: string;
    };
    if (!response.ok || !body.ok || !body.report) {
      return { ok: false, report: null, error: body.error || `HTTP ${response.status}` };
    }
    return { ok: true, report: body.report };
  } catch (error) {
    return {
      ok: false,
      report: null,
      error: error instanceof Error ? error.message : 'Python health engine unreachable.'
    };
  }
}
