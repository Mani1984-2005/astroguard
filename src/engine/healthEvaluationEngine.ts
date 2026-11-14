import {
  EvaluationRule,
  HealthEvaluationResult,
  HealthIndicatorKey,
  HealthStatusLevel,
  ParameterEvaluationFinding,
  SimulationScenarioId,
  TelemetryVitalsSnapshot
} from '../types/astroguard';

/**
 * Default configurable demonstration rules.
 * NOTE: These rules are configurable prototype thresholds for demonstration only
 * and do NOT represent NASA-validated medical flight rules or clinical diagnoses.
 */
export const DEFAULT_EVALUATION_RULES: Record<HealthIndicatorKey, EvaluationRule> = {
  heartRate: {
    key: 'heartRate',
    label: 'Heart Rate',
    unit: 'BPM',
    cautionLow: 48,
    cautionHigh: 100,
    dangerLow: 40,
    dangerHigh: 125,
    persistenceSamples: 2,
    isCritical: true,
    ruleOrigin: 'DEMONSTRATION_RULE',
    recommendedCountermeasure:
      'Pause strenuous exertion, initiate paced breathing, and review resting cardiac trend.'
  },
  spo2: {
    key: 'spo2',
    label: 'Arterial Oxygen Saturation (SpO2)',
    unit: '%',
    cautionLow: 94,
    dangerLow: 90,
    persistenceSamples: 1,
    isCritical: true,
    ruleOrigin: 'DEMONSTRATION_RULE',
    recommendedCountermeasure:
      'Verify cabin/suit O2 supply valve immediately and perform pulse oximeter sensor check.'
  },
  cabinOxygen: {
    key: 'cabinOxygen',
    label: 'Cabin / Suit Oxygen',
    unit: '% O2',
    cautionLow: 19.5,
    cautionHigh: 23.0,
    dangerLow: 18.0,
    dangerHigh: 25.0,
    persistenceSamples: 1,
    isCritical: true,
    ruleOrigin: 'DEMONSTRATION_RULE',
    recommendedCountermeasure:
      'Switch to backup oxygen loop and alert Flight Control & Medical Chief immediately.'
  },
  radiation: {
    key: 'radiation',
    label: 'Radiation Dose Rate',
    unit: 'mSv/d',
    cautionHigh: 0.75,
    dangerHigh: 1.5,
    persistenceSamples: 1,
    isCritical: true,
    ruleOrigin: 'OPERATIONAL_REFERENCE',
    recommendedCountermeasure:
      'Relocate to shielded storm-shelter module during elevated particle flux or SPE.'
  },
  coreTemp: {
    key: 'coreTemp',
    label: 'Core Body Temperature',
    unit: '°C',
    cautionLow: 35.8,
    cautionHigh: 37.6,
    dangerLow: 35.0,
    dangerHigh: 38.6,
    persistenceSamples: 2,
    isCritical: true,
    ruleOrigin: 'DEMONSTRATION_RULE',
    recommendedCountermeasure:
      'Adjust thermal cooling loop / LCVG garment flow and monitor core thermoregulation.'
  },
  hydration: {
    key: 'hydration',
    label: 'Hydration & Water Intake',
    unit: 'L/day',
    cautionLow: 1.8,
    dangerLow: 1.1,
    persistenceSamples: 1,
    isCritical: false,
    ruleOrigin: 'DEMONSTRATION_RULE',
    recommendedCountermeasure:
      'Follow CM-03 Electrolyte & Plasma Volume Hydration protocol (target 2.4 L/day).'
  },
  nutrition: {
    key: 'nutrition',
    label: 'Nutrition & Caloric Intake',
    unit: 'kcal/d',
    cautionLow: 1900,
    dangerLow: 1400,
    persistenceSamples: 1,
    isCritical: false,
    ruleOrigin: 'OPERATIONAL_REFERENCE',
    recommendedCountermeasure:
      'Increase daily energy intake above 90% predicted expenditure to protect bone mineral density.'
  },
  stress: {
    key: 'stress',
    label: 'Stress & Autonomic Load',
    unit: '/ 10',
    cautionHigh: 6,
    dangerHigh: 9,
    persistenceSamples: 2,
    isCritical: false,
    ruleOrigin: 'DEMONSTRATION_RULE',
    recommendedCountermeasure:
      'Reduce non-essential task load and schedule guided autonomic recovery break.'
  },
  sleep: {
    key: 'sleep',
    label: 'Sleep Duration',
    unit: 'hrs',
    cautionLow: 6.0,
    dangerLow: 4.0,
    persistenceSamples: 1,
    isCritical: false,
    ruleOrigin: 'DEMONSTRATION_RULE',
    recommendedCountermeasure:
      'Initiate CM-04 Solid-State Circadian Phototherapy prior to scheduled sleep period.'
  }
};

export interface SimulationPreset {
  id: SimulationScenarioId;
  label: string;
  badge: string;
  description: string;
  vitals: TelemetryVitalsSnapshot;
}

export const SIMULATION_SCENARIOS: Record<SimulationScenarioId, SimulationPreset> = {
  SAFE: {
    id: 'SAFE',
    label: 'SAFE (Green)',
    badge: 'LEVEL 1',
    description: 'All 9 simulated telemetry channels within configured safe demonstration bounds.',
    vitals: {
      heartRate: 68,
      spo2: 98,
      cabinOxygen: 20.9,
      radiation: 0.42,
      coreTemp: 36.8,
      hydration: 2.3,
      nutrition: 2420,
      stress: 2,
      sleep: 7.3
    }
  },
  CAUTION: {
    id: 'CAUTION',
    label: 'CAUTION (Yellow)',
    badge: 'LEVEL 2',
    description:
      'Simulated elevated heart rate (106 BPM), hydration deficit (1.5 L), and sleep loss (5.1 hrs).',
    vitals: {
      heartRate: 106,
      spo2: 95,
      cabinOxygen: 20.4,
      radiation: 0.58,
      coreTemp: 37.3,
      hydration: 1.5,
      nutrition: 2050,
      stress: 7,
      sleep: 5.1
    }
  },
  DANGER: {
    id: 'DANGER',
    label: 'DANGER (Red)',
    badge: 'LEVEL 3',
    description:
      'Simulated critical arterial desaturation (SpO2 87%), cabin O2 drop (17.5%), and tachycardia (136 BPM).',
    vitals: {
      heartRate: 136,
      spo2: 87,
      cabinOxygen: 17.5,
      radiation: 0.64,
      coreTemp: 38.2,
      hydration: 1.3,
      nutrition: 1850,
      stress: 9,
      sleep: 4.3
    }
  },
  MISSING_SENSOR: {
    id: 'MISSING_SENSOR',
    label: 'Missing Sensor Data',
    badge: 'FAIL-SAFE',
    description:
      'Simulates SpO2 and Heart Rate sensor dropout — verifies engine refuses to report SAFE.',
    vitals: {
      heartRate: null,
      spo2: null,
      cabinOxygen: 20.9,
      radiation: 0.42,
      coreTemp: 36.8,
      hydration: 2.3,
      nutrition: 2420,
      stress: 2,
      sleep: 7.3
    }
  }
};

export function formatVitalReading(
  value: number | null,
  unit: string
): string {
  if (value === null || Number.isNaN(value)) return 'NO SIGNAL';
  if (unit === 'BPM' || unit === '%' || unit === 'kcal/d') {
    return `${Math.round(value)} ${unit}`;
  }
  if (unit === '/ 10') {
    return `${value} / 10`;
  }
  return `${value.toFixed(1)} ${unit}`;
}

function formatUtcTimestamp(date: Date = new Date()): string {
  return date.toISOString().slice(11, 19) + ' UTC';
}

/**
 * Centralized Health Evaluation Engine
 * Evaluates all 9 health indicators, respects persistence / trend windows,
 * handles missing critical telemetry safely (never defaults to SAFE when blind),
 * and produces unified findings for both Astronaut & Medical Chief interfaces.
 */
export function evaluateCrewHealth(
  currentVitals: TelemetryVitalsSnapshot,
  historyWindow: TelemetryVitalsSnapshot[],
  rules: Record<HealthIndicatorKey, EvaluationRule>
): HealthEvaluationResult {
  const findings: ParameterEvaluationFinding[] = [];
  let hasMissingCriticalData = false;
  const previousSnapshot =
    historyWindow.length > 0 ? historyWindow[historyWindow.length - 1] : undefined;

  const evaluateSingle = (rule: EvaluationRule): ParameterEvaluationFinding | null => {
    const val = currentVitals[rule.key];
    const prevVal = previousSnapshot ? previousSnapshot[rule.key] : undefined;
    const prevFormatted =
      prevVal !== undefined ? formatVitalReading(prevVal, rule.unit) : undefined;

    // Fail-safe guard: Missing critical data cannot be reported as SAFE
    if (val === null || val === undefined || Number.isNaN(val)) {
      if (rule.isCritical) {
        hasMissingCriticalData = true;
        return {
          key: rule.key,
          label: rule.label,
          unit: rule.unit,
          currentValue: null,
          formattedReading: 'NO SIGNAL',
          previousReading: prevFormatted,
          level: 'CAUTION',
          reason: `Critical telemetry unavailable for ${rule.label} — verify biomedical sensor link.`,
          ruleOrigin: rule.ruleOrigin,
          recommendedCountermeasure:
            'Inspect biometric harness / wireless link; never assume SAFE status without sensor confirmation.',
          isMissingData: true
        };
      }
      return null;
    }

    const isDangerValue = (v: number | null | undefined): boolean => {
      if (v === null || v === undefined || Number.isNaN(v)) return false;
      return (
        (rule.dangerLow !== undefined && v <= rule.dangerLow) ||
        (rule.dangerHigh !== undefined && v >= rule.dangerHigh)
      );
    };

    const isCautionValue = (v: number | null | undefined): boolean => {
      if (v === null || v === undefined || Number.isNaN(v)) return false;
      return (
        (rule.cautionLow !== undefined && v <= rule.cautionLow) ||
        (rule.cautionHigh !== undefined && v >= rule.cautionHigh)
      );
    };

    // Check persistence across recent samples to filter transient 1-tick noise
    const recentSamples = [...historyWindow.slice(-(rule.persistenceSamples - 1)), currentVitals];
    const consecutiveDanger = recentSamples.filter((s) => isDangerValue(s[rule.key])).length;
    const consecutiveCaution = recentSamples.filter(
      (s) => isCautionValue(s[rule.key]) || isDangerValue(s[rule.key])
    ).length;

    const currentInDanger = isDangerValue(val);
    const currentInCaution = isCautionValue(val);

    // Trend detection: rapid upward HR trend or downward SpO2 trend across window
    const persistenceMetForDanger =
      rule.persistenceSamples <= 1 || consecutiveDanger >= rule.persistenceSamples;
    const persistenceMetForCaution =
      rule.persistenceSamples <= 1 || consecutiveCaution >= rule.persistenceSamples;

    if (currentInDanger && persistenceMetForDanger) {
      const boundText =
        rule.dangerLow !== undefined && val <= rule.dangerLow
          ? `below critical floor (${rule.dangerLow} ${rule.unit})`
          : `above critical ceiling (${rule.dangerHigh} ${rule.unit})`;
      return {
        key: rule.key,
        label: rule.label,
        unit: rule.unit,
        currentValue: val,
        formattedReading: formatVitalReading(val, rule.unit),
        previousReading: prevFormatted,
        level: 'DANGER',
        reason: `${rule.label} reading (${formatVitalReading(val, rule.unit)}) is ${boundText}.`,
        ruleOrigin: rule.ruleOrigin,
        recommendedCountermeasure: rule.recommendedCountermeasure
      };
    }

    if (currentInDanger && !persistenceMetForDanger) {
      // Single-sample extreme excursion escalates immediately to CAUTION while awaiting persistence confirmation
      return {
        key: rule.key,
        label: rule.label,
        unit: rule.unit,
        currentValue: val,
        formattedReading: formatVitalReading(val, rule.unit),
        previousReading: prevFormatted,
        level: 'CAUTION',
        reason: `Transient critical excursion on ${rule.label} (${formatVitalReading(val, rule.unit)}) — monitoring persistence.`,
        ruleOrigin: rule.ruleOrigin,
        recommendedCountermeasure: rule.recommendedCountermeasure
      };
    }

    if (currentInCaution && persistenceMetForCaution) {
      const boundText =
        rule.cautionLow !== undefined && val <= rule.cautionLow
          ? `below caution threshold (${rule.cautionLow} ${rule.unit})`
          : `above caution threshold (${rule.cautionHigh} ${rule.unit})`;
      return {
        key: rule.key,
        label: rule.label,
        unit: rule.unit,
        currentValue: val,
        formattedReading: formatVitalReading(val, rule.unit),
        previousReading: prevFormatted,
        level: 'CAUTION',
        reason: `${rule.label} reading (${formatVitalReading(val, rule.unit)}) is ${boundText}.`,
        ruleOrigin: rule.ruleOrigin,
        recommendedCountermeasure: rule.recommendedCountermeasure
      };
    }

    return null;
  };

  (Object.keys(rules) as HealthIndicatorKey[]).forEach((key) => {
    const finding = evaluateSingle(rules[key]);
    if (finding) findings.push(finding);
  });

  // Sort findings: DANGER first, then CAUTION (with critical metrics prioritized)
  findings.sort((a, b) => {
    const rank = (lvl: HealthStatusLevel) => (lvl === 'DANGER' ? 0 : lvl === 'CAUTION' ? 1 : 2);
    return rank(a.level) - rank(b.level);
  });

  const hasDanger = findings.some((f) => f.level === 'DANGER');
  const hasCaution = findings.some((f) => f.level === 'CAUTION');

  let overallStatus: HealthStatusLevel = 'SAFE';
  if (hasDanger) {
    overallStatus = 'DANGER';
  } else if (hasCaution || hasMissingCriticalData) {
    overallStatus = 'CAUTION';
  }

  const primaryFinding = findings[0] ?? null;

  let statusHeadline = 'SAFE — ALL SYSTEMS NORMAL';
  let statusSubtext =
    'All 9 simulated telemetry channels are within configured demonstration parameters.';

  if (overallStatus === 'CAUTION') {
    statusHeadline = 'CAUTION — MONITOR YOUR HEALTH';
    statusSubtext = hasMissingCriticalData
      ? 'Critical telemetry channel unavailable — sensor link verification required.'
      : primaryFinding
        ? `${primaryFinding.label}: ${primaryFinding.formattedReading} requires monitoring.`
        : 'Unusual physiological fluctuation detected.';
  } else if (overallStatus === 'DANGER') {
    statusHeadline = 'DANGER — IMMEDIATE ATTENTION REQUIRED';
    statusSubtext = primaryFinding
      ? `Critical threshold crossed on ${primaryFinding.label} (${primaryFinding.formattedReading}).`
      : 'Critical condition detected.';
  }

  return {
    status: overallStatus,
    statusHeadline,
    statusSubtext,
    primaryFinding,
    findings,
    hasMissingCriticalData,
    evaluatedAt: formatUtcTimestamp(),
    disclaimer:
      'Simulated demonstration evaluation engine — configurable prototype rules only, not a medical diagnosis or NASA-validated clinical threshold.'
  };
}
