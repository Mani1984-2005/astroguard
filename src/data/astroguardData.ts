import {
  ArchivalTribute,
  AstronautIdentityRecord,
  CountermeasureItem,
  CrewProfile,
  CrewRosterMember,
  CrewSelectionProfile,
  HealthHistoryRecord,
  ResearchEvidenceItem,
  TelemetryTimeframeSeries,
  TelemetryVitalsSnapshot,
  TimeframeKey
} from '../types/astroguard';

// ============================================================================
// AUTHENTIC NASA ARCHIVAL PHOTOGRAPHS (VERIFIED PUBLIC DOMAIN SOURCES)
// Strictly historical tribute archive — NEVER used as active crew fallback.
// ============================================================================
export const ARCHIVAL_TRIBUTES: ArchivalTribute[] = [
  {
    id: 'williams',
    designationCode: 'HIST-001',
    name: 'Sunita Williams',
    designation: 'ISS Expedition 14/15 & 32/33 Commander',
    years: 'NASA Astronaut Corps Group 17 • 322+ Days in Orbit',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Sunita_Williams.jpg/800px-Sunita_Williams.jpg',
    fallbackUrl:
      'https://upload.wikimedia.org/wikipedia/commons/c/cb/Sunita_Williams.jpg',
    attribution: 'NASA Archival Portrait • Public Domain (JSC2004-E-48216)',
    portraitSource: 'NASA / Wikimedia Commons Public Domain (JSC2004-E-48216)',
    quote:
      '“Living and working aboard the International Space Station teaches us how resilient human physiology truly is.”',
    focusArea: 'Long-Duration Orbital Endurance & EVA Operations',
    isHistorical: true
  },
  {
    id: 'chawla',
    designationCode: 'HIST-002',
    name: 'Kalpana Chawla',
    designation: 'STS-87 & STS-107 Mission Specialist',
    years: '1962 – 2003 • NASA Astronaut Corps Group 15',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Kalpana_Chawla%2C_NASA_photo_portrait_in_orange_suit.jpg/800px-Kalpana_Chawla%2C_NASA_photo_portrait_in_orange_suit.jpg',
    fallbackUrl:
      'https://upload.wikimedia.org/wikipedia/commons/9/9c/Kalpana_Chawla%2C_NASA_photo_portrait_in_orange_suit.jpg',
    attribution: 'NASA Archival Portrait • Public Domain (JSC-96-14842)',
    portraitSource: 'NASA / Wikimedia Commons Public Domain (JSC-96-14842)',
    quote:
      '“When you look at the stars and the galaxy, you feel that you are not just from any particular piece of land, but from the solar system.”',
    focusArea: 'Aerospace Engineering & Microgravity Fluid Dynamics',
    isHistorical: true
  },
  {
    id: 'ride',
    designationCode: 'HIST-003',
    name: 'Sally Ride',
    designation: 'STS-7 & STS-41-G Mission Specialist',
    years: '1951 – 2012 • First American Woman in Space',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Sally_Ride_%281984%29.jpg/800px-Sally_Ride_%281984%29.jpg',
    fallbackUrl:
      'https://upload.wikimedia.org/wikipedia/commons/0/0c/Sally_Ride_%281984%29.jpg',
    attribution: 'NASA Archival Portrait • Public Domain (S84-37018)',
    portraitSource: 'NASA / Wikimedia Commons Public Domain (S84-37018)',
    quote:
      '“The stars don’t look bigger, but they do look brighter from low Earth orbit.”',
    focusArea: 'Orbital Robotics & Payload Operations',
    isHistorical: true
  }
];

// ============================================================================
// CENTRALIZED ASTRONAUT IDENTITY & PORTRAIT REGISTRY
// Dedicated local portrait assets per unique astronaut ID — NEVER reused across crew.
// ============================================================================
export const ASTRONAUT_IDENTITY_REGISTRY: Record<string, AstronautIdentityRecord> = {
  'AG-LEO-01': {
    id: 'AG-LEO-01',
    designationCode: 'CMD-001',
    fullName: 'Cmdr. Elena Vance',
    rank: 'Commander',
    missionRole: 'Mission Commander',
    missionIncrement: 'ISS Expedition 74 • Increment 74',
    flightDay: 'FD-084 / 180',
    portraitUrl: '/assets/crew/cmd-001-elena-vance.jpg',
    portraitAttribution: 'Simulated Crew Portrait • AstroGuard JSC Portrait Set',
    portraitSource: 'Local Simulated Mission Asset (/assets/crew/cmd-001-elena-vance.jpg)',
    isHistorical: false,
    patchCode: 'EXP74-01',
    avatarTone: 'from-sky-500/30 via-[#105BD8]/40 to-indigo-950/80 border-sky-400/40'
  },
  'AG-LEO-02': {
    id: 'AG-LEO-02',
    designationCode: 'SCI-002',
    fullName: 'Dr. Kenji Takahashi',
    rank: 'Flight Engineer',
    missionRole: 'Flight Engineer / Payload Specialist',
    missionIncrement: 'ISS Expedition 74 • Increment 74',
    flightDay: 'FD-084 / 180',
    portraitUrl: '/assets/crew/sci-002-kenji-takahashi.jpg',
    portraitAttribution: 'Simulated Crew Portrait • AstroGuard JSC Portrait Set',
    portraitSource: 'Local Simulated Mission Asset (/assets/crew/sci-002-kenji-takahashi.jpg)',
    isHistorical: false,
    patchCode: 'EXP74-02',
    avatarTone: 'from-cyan-500/30 via-sky-700/40 to-slate-950/80 border-cyan-400/40'
  },
  'AG-LEO-03': {
    id: 'AG-LEO-03',
    designationCode: 'EVA-003',
    fullName: 'Maj. Sofia Lindqvist',
    rank: 'Major',
    missionRole: 'EVA Lead / Flight Engineer',
    missionIncrement: 'ISS Expedition 74 • Increment 74',
    flightDay: 'FD-084 / 180',
    portraitUrl: '/assets/crew/eva-003-sofia-lindqvist.jpg',
    portraitAttribution: 'Simulated Crew Portrait • AstroGuard JSC Portrait Set',
    portraitSource: 'Local Simulated Mission Asset (/assets/crew/eva-003-sofia-lindqvist.jpg)',
    isHistorical: false,
    patchCode: 'EXP74-03',
    avatarTone: 'from-blue-500/30 via-indigo-700/40 to-slate-950/80 border-blue-400/40'
  },
  'AG-LEO-04': {
    id: 'AG-LEO-04',
    designationCode: 'BIO-004',
    fullName: 'Dr. Marcus Sterling',
    rank: 'Flight Surgeon / Science Officer',
    missionRole: 'Biomedical & Science Officer',
    missionIncrement: 'ISS Expedition 74 • Increment 74',
    flightDay: 'FD-084 / 180',
    portraitUrl: '/assets/crew/bio-004-marcus-sterling.jpg',
    portraitAttribution: 'Simulated Crew Portrait • AstroGuard JSC Portrait Set',
    portraitSource: 'Local Simulated Mission Asset (/assets/crew/bio-004-marcus-sterling.jpg)',
    isHistorical: false,
    patchCode: 'EXP74-04',
    avatarTone: 'from-indigo-500/30 via-sky-800/40 to-slate-950/80 border-indigo-400/40'
  }
};

export function getAstronautIdentity(idOrCode: string | null | undefined): AstronautIdentityRecord | null {
  if (!idOrCode) return null;
  const normalized = idOrCode.trim();
  const upper = normalized.toUpperCase();

  if (ASTRONAUT_IDENTITY_REGISTRY[upper]) {
    return ASTRONAUT_IDENTITY_REGISTRY[upper];
  }

  const byDesignation = Object.values(ASTRONAUT_IDENTITY_REGISTRY).find(
    (rec) => rec.designationCode.toUpperCase() === upper
  );
  if (byDesignation) return byDesignation;

  const lower = normalized.toLowerCase();
  const tribute = ARCHIVAL_TRIBUTES.find(
    (t) => t.id.toLowerCase() === lower || t.designationCode.toUpperCase() === upper
  );
  if (tribute) {
    return {
      id: tribute.designationCode,
      designationCode: tribute.designationCode,
      fullName: tribute.name,
      rank: 'Historical Tribute',
      missionRole: tribute.designation,
      missionIncrement: tribute.years,
      flightDay: 'HISTORICAL ARCHIVE',
      portraitUrl: tribute.imageUrl,
      portraitFallbackUrl: tribute.fallbackUrl,
      portraitAttribution: tribute.attribution,
      portraitSource: tribute.portraitSource,
      isHistorical: true,
      patchCode: tribute.designationCode,
      avatarTone: 'from-sky-500/20 via-slate-800/60 to-slate-950/90 border-sky-400/30'
    };
  }

  return null;
}

// ============================================================================
// SIMULATED CREW TELEMETRY & CLINICAL DATASETS (STRICTLY FICTIONAL PROFILES)
// ============================================================================
export const ACTIVE_CREW_PROFILE: CrewProfile = {
  id: 'AG-LEO-01',
  designationCode: 'CMD-001',
  name: 'Cmdr. Elena Vance',
  rank: 'Commander',
  role: 'Mission Commander • Increment 74',
  missionIncrement: 'ISS Expedition 74 • Increment 74',
  missionDay: 'FD-084 / 180',
  orbitAltitude: '408 km LEO',
  inclination: '51.6°',
  portraitUrl: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-01'].portraitUrl,
  portraitAttribution: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-01'].portraitAttribution,
  portraitSource: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-01'].portraitSource,
  restingHr: 68,
  spo2: 98,
  coreTemp: 36.8,
  hrv: 64,
  radiation: 0.42,
  bp: '116 / 74',
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
};

export const TELEMETRY_SERIES: Record<TimeframeKey, TelemetryTimeframeSeries> = {
  '24H': {
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'NOW'],
    hr: [61, 58, 72, 86, 74, 69, 68],
    hrv: [72, 76, 62, 51, 60, 63, 64],
    spo2: [98, 97, 98, 99, 98, 98, 98],
    temp: [36.5, 36.4, 36.7, 37.1, 36.9, 36.8, 36.8],
    sleepScore: 86,
    remPercent: 22,
    deepPercent: 19
  },
  '7D': {
    labels: ['FD-78', 'FD-79', 'FD-80', 'FD-81', 'FD-82', 'FD-83', 'FD-84'],
    hr: [67, 69, 71, 68, 66, 67, 68],
    hrv: [65, 61, 59, 63, 67, 66, 64],
    spo2: [98, 98, 97, 98, 99, 98, 98],
    temp: [36.7, 36.8, 36.9, 36.8, 36.7, 36.8, 36.8],
    sleepScore: 84,
    remPercent: 21,
    deepPercent: 18
  },
  '30D': {
    labels: ['WK-09', 'WK-10', 'WK-11', 'WK-12'],
    hr: [70, 69, 68, 68],
    hrv: [58, 61, 63, 64],
    spo2: [98, 98, 98, 98],
    temp: [36.8, 36.8, 36.8, 36.8],
    sleepScore: 82,
    remPercent: 20,
    deepPercent: 18
  }
};

export function getTelemetrySeriesForCrew(
  crewId: string,
  currentVitals?: TelemetryVitalsSnapshot
): Record<TimeframeKey, TelemetryTimeframeSeries> {
  const hrNow = currentVitals?.heartRate !== null && currentVitals?.heartRate !== undefined
    ? Math.round(currentVitals.heartRate)
    : null;
  const spo2Now = currentVitals?.spo2 !== null && currentVitals?.spo2 !== undefined
    ? Math.round(currentVitals.spo2)
    : null;
  const tempNow = currentVitals?.coreTemp !== null && currentVitals?.coreTemp !== undefined
    ? Number(currentVitals.coreTemp.toFixed(1))
    : null;

  if (crewId === 'AG-LEO-03') {
    const hrTail = hrNow ?? 136;
    const spo2Tail = spo2Now ?? 87;
    const tempTail = tempNow ?? 38.2;
    return {
      '24H': {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'NOW'],
        hr: [72, 75, 84, 96, 112, 124, hrTail],
        hrv: [60, 58, 52, 48, 42, 38, 36],
        spo2: [98, 97, 96, 95, 92, 89, spo2Tail],
        temp: [36.8, 36.8, 37.0, 37.3, 37.7, 38.0, tempTail],
        sleepScore: 54,
        remPercent: 14,
        deepPercent: 11
      },
      '7D': {
        labels: ['FD-78', 'FD-79', 'FD-80', 'FD-81', 'FD-82', 'FD-83', 'FD-84'],
        hr: [70, 72, 74, 78, 86, 102, hrTail],
        hrv: [63, 61, 58, 55, 49, 41, 36],
        spo2: [98, 98, 97, 97, 96, 93, spo2Tail],
        temp: [36.8, 36.8, 36.9, 37.0, 37.2, 37.6, tempTail],
        sleepScore: 61,
        remPercent: 15,
        deepPercent: 12
      },
      '30D': {
        labels: ['WK-09', 'WK-10', 'WK-11', 'WK-12'],
        hr: [69, 71, 76, hrTail],
        hrv: [64, 62, 54, 36],
        spo2: [98, 98, 96, spo2Tail],
        temp: [36.8, 36.8, 37.1, tempTail],
        sleepScore: 70,
        remPercent: 17,
        deepPercent: 14
      }
    };
  }

  if (crewId === 'AG-LEO-02') {
    const hrTail = hrNow ?? 106;
    const spo2Tail = spo2Now ?? 95;
    const tempTail = tempNow ?? 37.3;
    return {
      '24H': {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'NOW'],
        hr: [69, 71, 82, 94, 98, 102, hrTail],
        hrv: [58, 56, 52, 49, 47, 45, 44],
        spo2: [97, 97, 96, 96, 95, 95, spo2Tail],
        temp: [36.7, 36.8, 36.9, 37.1, 37.2, 37.2, tempTail],
        sleepScore: 66,
        remPercent: 17,
        deepPercent: 13
      },
      '7D': {
        labels: ['FD-78', 'FD-79', 'FD-80', 'FD-81', 'FD-82', 'FD-83', 'FD-84'],
        hr: [72, 75, 79, 84, 91, 99, hrTail],
        hrv: [59, 57, 55, 51, 48, 46, 44],
        spo2: [98, 97, 97, 96, 96, 95, spo2Tail],
        temp: [36.8, 36.8, 36.9, 37.0, 37.1, 37.2, tempTail],
        sleepScore: 69,
        remPercent: 18,
        deepPercent: 14
      },
      '30D': {
        labels: ['WK-09', 'WK-10', 'WK-11', 'WK-12'],
        hr: [71, 74, 86, hrTail],
        hrv: [60, 57, 50, 44],
        spo2: [98, 97, 96, spo2Tail],
        temp: [36.8, 36.9, 37.1, tempTail],
        sleepScore: 74,
        remPercent: 19,
        deepPercent: 15
      }
    };
  }

  if (crewId === 'AG-LEO-04') {
    const hrTail = hrNow ?? 65;
    const spo2Tail = spo2Now ?? 98;
    const tempTail = tempNow ?? 36.7;
    return {
      '24H': {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'NOW'],
        hr: [59, 57, 68, 79, 71, 66, hrTail],
        hrv: [74, 77, 66, 58, 65, 67, 68],
        spo2: [98, 98, 98, 99, 98, 98, spo2Tail],
        temp: [36.5, 36.4, 36.6, 36.9, 36.8, 36.7, tempTail],
        sleepScore: 89,
        remPercent: 23,
        deepPercent: 21
      },
      '7D': {
        labels: ['FD-78', 'FD-79', 'FD-80', 'FD-81', 'FD-82', 'FD-83', 'FD-84'],
        hr: [64, 66, 65, 67, 64, 65, hrTail],
        hrv: [67, 66, 68, 65, 69, 68, 68],
        spo2: [98, 98, 99, 98, 98, 98, spo2Tail],
        temp: [36.7, 36.7, 36.8, 36.7, 36.6, 36.7, tempTail],
        sleepScore: 87,
        remPercent: 22,
        deepPercent: 20
      },
      '30D': {
        labels: ['WK-09', 'WK-10', 'WK-11', 'WK-12'],
        hr: [66, 65, 65, hrTail],
        hrv: [64, 66, 67, 68],
        spo2: [98, 98, 98, spo2Tail],
        temp: [36.7, 36.7, 36.7, tempTail],
        sleepScore: 86,
        remPercent: 22,
        deepPercent: 19
      }
    };
  }

  // AG-LEO-01 (or fallback reflecting live vitals)
  if (hrNow === null && spo2Now === null) {
    return TELEMETRY_SERIES;
  }
  return {
    ...TELEMETRY_SERIES,
    '24H': {
      ...TELEMETRY_SERIES['24H'],
      hr: [...TELEMETRY_SERIES['24H'].hr.slice(0, 6), hrNow ?? 68],
      spo2: [...TELEMETRY_SERIES['24H'].spo2.slice(0, 6), spo2Now ?? 98],
      temp: [...TELEMETRY_SERIES['24H'].temp.slice(0, 6), tempNow ?? 36.8]
    }
  };
}

export const INITIAL_COUNTERMEASURES: CountermeasureItem[] = [
  {
    id: 'ared',
    code: 'CM-01',
    title: 'ARED Resistive Exercise Protocol',
    category: 'Musculoskeletal Loading',
    schedule: '07:30 – 08:30 UTC',
    target: 'Femoral Neck BMD & Lumbar Paraspinal Preservation',
    intensity: 'High Load (82% 1RM)',
    duration: '60 min',
    completed: true,
    progress: 100,
    notes: 'Squats, deadlifts, and heel raises completed within nominal load envelope.'
  },
  {
    id: 't2',
    code: 'CM-02',
    title: 'T2 COLBERT Treadmill Interval Run',
    category: 'Cardiovascular Conditioning',
    schedule: '11:15 – 11:55 UTC',
    target: 'VO2 Max Maintenance & Orthostatic Tolerance',
    intensity: 'Zone 3–4 Aerobic (145–162 BPM)',
    duration: '40 min',
    completed: true,
    progress: 100,
    notes: 'Harness load set at 78% body weight; nominal cardiac recovery.'
  },
  {
    id: 'fluid',
    code: 'CM-03',
    title: 'Electrolyte & Plasma Volume Hydration',
    category: 'Hemodynamic Stability',
    schedule: 'Continuous / 2.4 L Target',
    target: 'Counteract Cephalad Fluid Shift & Plasma Reduction',
    intensity: 'Standard Isotonic Protocol',
    duration: 'Daily',
    completed: false,
    progress: 75,
    notes: '1.8 L / 2.4 L logged prior to orbital evening.'
  },
  {
    id: 'circadian',
    code: 'CM-04',
    title: 'Solid-State Circadian Phototherapy',
    category: 'Neuro-Circadian Entrainment',
    schedule: '19:30 – 20:30 UTC',
    target: 'Melatonin Phase Alignment (16 Sunrises/Day Compensation)',
    intensity: '480 nm Blue-Enriched / Warm Dim Transition',
    duration: '60 min',
    completed: false,
    progress: 40,
    notes: 'Scheduled prior to crew sleep period.'
  }
];

export const HEALTH_HISTORY_RECORDS: HealthHistoryRecord[] = [
  {
    id: 'LOG-8402',
    date: 'FD-084 • 12:00 UTC',
    phase: 'In-Flight Increment',
    metric: 'Resting Cardiovascular Panel',
    value: '68 BPM / HRV 64 ms',
    baselineDelta: '+2 BPM vs Pre-Flight',
    status: 'Nominal'
  },
  {
    id: 'LOG-8109',
    date: 'FD-081 • 09:30 UTC',
    phase: 'In-Flight Increment',
    metric: 'Ocular OCT & Intraocular Pressure',
    value: '14.2 mmHg (OU)',
    baselineDelta: '+0.8 mmHg vs Baseline',
    status: 'Monitored'
  },
  {
    id: 'LOG-7411',
    date: 'FD-074 • 14:15 UTC',
    phase: 'In-Flight Increment',
    metric: 'Pre-EVA Submaximal Ergometry',
    value: 'VO2 Peak 44.6 mL/kg/min',
    baselineDelta: '-3.1% vs L-30',
    status: 'Nominal'
  },
  {
    id: 'LOG-4501',
    date: 'FD-045 • 10:00 UTC',
    phase: 'Mid-Mission Adaptation',
    metric: 'Bone Resorption Biomarker (NTX)',
    value: '54 nmol BCE/mmol Cr',
    baselineDelta: '+18% vs Pre-Flight',
    status: 'Monitored'
  },
  {
    id: 'LOG-0014',
    date: 'FD-014 • 08:45 UTC',
    phase: 'Early Orbital Adaptation',
    metric: 'Neuro-Vestibular Adaptation Index',
    value: '96 / 100',
    baselineDelta: 'Full Space Motion Resolution',
    status: 'Nominal'
  },
  {
    id: 'LOG-PRE1',
    date: 'L-30 Days • JSC',
    phase: 'Pre-Flight Baseline',
    metric: 'Comprehensive Flight Physical',
    value: '66 BPM / 114/72 mmHg',
    baselineDelta: 'Reference Baseline',
    status: 'Nominal'
  }
];

export const RESEARCH_EVIDENCE_ITEMS: ResearchEvidenceItem[] = [
  {
    id: 'sans',
    category: 'Neuro-Ocular',
    code: 'HRP-SANS-2024',
    title: 'Spaceflight-Associated Neuro-Ocular Syndrome (SANS)',
    source: 'NASA Human Research Program • ISS Longitudinal Cohort',
    summary:
      'Microgravity-induced cephalad fluid redistribution elevates intracranial and venous pressure gradients, leading to optic disc edema, globe flattening, and hyperopic shifts in long-duration crews.',
    implications: [
      'Routine Optical Coherence Tomography (OCT) imaging every 30 flight days.',
      'Lower Body Negative Pressure (LBNP) countermeasures evaluated for fluid unloading.',
      'B-vitamin status and one-carbon metabolism genetic screening prior to mission assignment.'
    ],
    evidenceGrade: 'Level I Clinical Aerospace Evidence'
  },
  {
    id: 'cardio',
    category: 'Cardiovascular',
    code: 'HRP-CV-2023',
    title: 'Microgravity Cardiac Remodeling & Orthostatic Intolerance',
    source: 'Journal of Applied Physiology / ISS Cardiovascular Experiments',
    summary:
      'Removal of hydrostatic gravitational gradients reduces total circulating blood volume by 10–15% within the first 72 hours of orbital insertion, promoting mild left ventricular mass reduction without resistive/aerobic countermeasures.',
    implications: [
      'Combined ARED resistive loading and T2 aerobic intervals preserve myocardial mass.',
      'End-of-mission oral fluid-loading protocols mitigate post-landing orthostatic hypotension.',
      'Continuous R-R interval HRV tracking detects autonomic fatigue prior to EVA.'
    ],
    evidenceGrade: 'Level I Clinical Aerospace Evidence'
  },
  {
    id: 'musculo',
    category: 'Musculoskeletal',
    code: 'HRP-MSK-2024',
    title: 'Trabecular Bone Mineral Density Loss & ARED Mitigation',
    source: 'NASA Bone & Mineral Laboratory • Johnson Space Center',
    summary:
      'Unloaded skeletal segments experience 1.0% to 1.5% bone mineral density loss per month in low Earth orbit. High-load resistive exercise paired with adequate Vitamin D and energy intake significantly attenuates resorption.',
    implications: [
      'Maintain daily caloric intake >90% of predicted basal + exercise expenditure.',
      '800 IU daily cholecalciferol supplementation throughout orbital stay.',
      'Track urinary N-telopeptide (NTX) excretion trends at 30-day intervals.'
    ],
    evidenceGrade: 'Level I Clinical Aerospace Evidence'
  },
  {
    id: 'radiation',
    category: 'Radiation Biology',
    code: 'HRP-RAD-2025',
    title: 'Galactic Cosmic Rays (GCR) & Trapped Proton Dosimetry in LEO',
    source: 'NASA Space Radiation Analysis Group (SRAG)',
    summary:
      'Crews in 51.6° inclination Low Earth Orbit receive approximately 0.40–0.55 mSv/day from trapped protons in the South Atlantic Anomaly and attenuated galactic cosmic rays.',
    implications: [
      'Real-time active dosimetry correlated with South Atlantic Anomaly orbital passes.',
      'Cumulative career effective dose tracked strictly below 600 mSv NASA lifetime limit.',
      'Antioxidant-rich nutrition protocols maintained across long-duration increments.'
    ],
    evidenceGrade: 'Operational Flight Rule Standard'
  }
];

export const CREW_ROSTER_DATA: CrewRosterMember[] = [
  {
    id: 'AG-LEO-01',
    designationCode: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-01'].designationCode,
    name: 'Cmdr. Elena Vance',
    rank: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-01'].rank,
    role: 'Mission Commander',
    missionIncrement: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-01'].missionIncrement,
    flightDay: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-01'].flightDay,
    portraitUrl: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-01'].portraitUrl,
    portraitAttribution: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-01'].portraitAttribution,
    portraitSource: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-01'].portraitSource,
    status: 'Nominal',
    hr: 68,
    hrv: 64,
    spo2: 98,
    temp: 36.8,
    radiation: 0.42,
    readiness: 96,
    lastSync: '12s ago',
    alertNote: 'All physiological parameters within configured demonstration envelope.',
    scenarioId: 'SAFE',
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
    },
    notes: [
      {
        time: 'FD-084 09:00 UTC',
        author: 'Dr. M. Thorne (Lead Flight Surgeon)',
        text: 'Weekly private medical conference completed. Sleep efficiency steady at 86%; cleared for upcoming EVA prep.'
      }
    ]
  },
  {
    id: 'AG-LEO-02',
    designationCode: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-02'].designationCode,
    name: 'Dr. Kenji Takahashi',
    rank: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-02'].rank,
    role: 'Flight Engineer / Payload Specialist',
    missionIncrement: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-02'].missionIncrement,
    flightDay: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-02'].flightDay,
    portraitUrl: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-02'].portraitUrl,
    portraitAttribution: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-02'].portraitAttribution,
    portraitSource: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-02'].portraitSource,
    status: 'Watch',
    hr: 106,
    hrv: 44,
    spo2: 95,
    temp: 37.3,
    radiation: 0.58,
    readiness: 83,
    lastSync: '18s ago',
    alertNote: 'Simulated elevated heart rate (106 BPM), hydration deficit (1.5 L), and sleep loss (5.1 hrs).',
    scenarioId: 'CAUTION',
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
    },
    notes: [
      {
        time: 'FD-084 07:45 UTC',
        author: 'Dr. M. Thorne (Lead Flight Surgeon)',
        text: 'Recommended reduced aerobic intensity today and 45-minute circadian light exposure prior to sleep.'
      }
    ]
  },
  {
    id: 'AG-LEO-03',
    designationCode: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-03'].designationCode,
    name: 'Maj. Sofia Lindqvist',
    rank: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-03'].rank,
    role: 'EVA Lead / Flight Engineer',
    missionIncrement: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-03'].missionIncrement,
    flightDay: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-03'].flightDay,
    portraitUrl: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-03'].portraitUrl,
    portraitAttribution: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-03'].portraitAttribution,
    portraitSource: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-03'].portraitSource,
    status: 'Critical',
    hr: 136,
    hrv: 36,
    spo2: 87,
    temp: 38.2,
    radiation: 0.64,
    readiness: 62,
    lastSync: '09s ago',
    alertNote: 'Simulated critical arterial desaturation (SpO2 87%), cabin O2 drop (17.5%), and tachycardia (136 BPM).',
    scenarioId: 'DANGER',
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
    },
    notes: [
      {
        time: 'FD-084 09:12 UTC',
        author: 'Dr. R. Patel (Biomedical Engineer)',
        text: 'Simulated EVA harness telemetry excursion flagged for immediate Medical Chief review.'
      }
    ]
  },
  {
    id: 'AG-LEO-04',
    designationCode: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-04'].designationCode,
    name: 'Dr. Marcus Sterling',
    rank: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-04'].rank,
    role: 'Biomedical & Science Officer',
    missionIncrement: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-04'].missionIncrement,
    flightDay: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-04'].flightDay,
    portraitUrl: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-04'].portraitUrl,
    portraitAttribution: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-04'].portraitAttribution,
    portraitSource: ASTRONAUT_IDENTITY_REGISTRY['AG-LEO-04'].portraitSource,
    status: 'Nominal',
    hr: 65,
    hrv: 68,
    spo2: 98,
    temp: 36.7,
    radiation: 0.43,
    readiness: 95,
    lastSync: '14s ago',
    alertNote: 'Nominal hydration & ARED load compliance.',
    scenarioId: 'SAFE',
    vitals: {
      heartRate: 65,
      spo2: 98,
      cabinOxygen: 20.9,
      radiation: 0.43,
      coreTemp: 36.7,
      hydration: 2.4,
      nutrition: 2380,
      stress: 3,
      sleep: 7.1
    },
    notes: [
      {
        time: 'FD-082 15:10 UTC',
        author: 'Dr. M. Thorne (Lead Flight Surgeon)',
        text: 'OCT retinal scan reviewed with JSC ophthalmology; no interval change.'
      }
    ]
  }
];

/**
 * Strictly non-medical crew selection metadata derived from the centralized identity registry.
 * Exposes ZERO biometric readings, health status labels, alerts, or medical notes.
 */
export const CREW_SELECTION_PROFILES: CrewSelectionProfile[] = CREW_ROSTER_DATA.map((member) => {
  const identity = ASTRONAUT_IDENTITY_REGISTRY[member.id];
  return {
    crewId: member.id,
    designationCode: identity.designationCode,
    name: identity.fullName,
    rank: identity.rank,
    missionRole: identity.missionRole,
    missionId: identity.missionIncrement,
    flightDay: identity.flightDay,
    patchCode: identity.patchCode,
    avatarTone: identity.avatarTone,
    portraitUrl: identity.portraitUrl,
    portraitAttribution: identity.portraitAttribution,
    portraitSource: identity.portraitSource
  };
});

export function getInitialHistoryForCrew(crewId: string): HealthHistoryRecord[] {
  const member = CREW_ROSTER_DATA.find((m) => m.id === crewId);
  if (!member) return HEALTH_HISTORY_RECORDS;

  if (crewId === 'AG-LEO-03') {
    return [
      {
        id: 'LOG-0384-CRIT',
        date: 'FD-084 • 09:12 UTC',
        phase: 'EVA Suit / Airlock Excursion',
        metric: 'Critical Cardiorespiratory Excursion (Simulated)',
        value: '136 BPM / SpO2 87% / O2 17.5%',
        baselineDelta: '+68 BPM vs Pre-Flight',
        status: 'Critical'
      },
      {
        id: 'LOG-0383-EVA',
        date: 'FD-083 • 16:40 UTC',
        phase: 'Pre-EVA Preparation',
        metric: 'EMU Harness & Thermal Loop Check',
        value: '37.6 °C / HRV 41 ms',
        baselineDelta: '+0.8 °C vs Baseline',
        status: 'Monitored'
      },
      ...HEALTH_HISTORY_RECORDS.slice(2)
    ];
  }

  if (crewId === 'AG-LEO-02') {
    return [
      {
        id: 'LOG-0284-WARN',
        date: 'FD-084 • 07:45 UTC',
        phase: 'In-Flight Increment',
        metric: 'Autonomic Strain & Hydration Panel (Simulated)',
        value: '106 BPM / 1.5 L / Sleep 5.1 hrs',
        baselineDelta: '+38 BPM vs Pre-Flight',
        status: 'Monitored'
      },
      ...HEALTH_HISTORY_RECORDS.slice(1)
    ];
  }

  if (crewId === 'AG-LEO-04') {
    return [
      {
        id: 'LOG-0484-NOM',
        date: 'FD-084 • 12:00 UTC',
        phase: 'In-Flight Increment',
        metric: 'Resting Cardiovascular Panel (Simulated)',
        value: '65 BPM / HRV 68 ms / SpO2 98%',
        baselineDelta: '-1 BPM vs Pre-Flight',
        status: 'Nominal'
      },
      ...HEALTH_HISTORY_RECORDS.slice(1)
    ];
  }

  return HEALTH_HISTORY_RECORDS;
}

export function getTimelineStepsForCrew(
  crewId: string,
  vitals?: TelemetryVitalsSnapshot
): Array<{ phase: string; detail: string; active: boolean }> {
  const identity = getAstronautIdentity(crewId);
  const member = CREW_ROSTER_DATA.find((m) => m.id === crewId);
  const hr = vitals?.heartRate ?? member?.hr ?? 68;
  const spo2 = vitals?.spo2 ?? member?.spo2 ?? 98;
  const label = identity?.fullName ?? crewId;

  if (crewId === 'AG-LEO-03') {
    return [
      {
        phase: 'L-30 Days • Pre-Flight Baseline (JSC)',
        detail: `${label} baseline: Resting HR 68 BPM • SpO2 99% • EVA Certified`,
        active: false
      },
      {
        phase: 'FD-001 to FD-014 • Orbital Insertion & Fluid Shift',
        detail: '11% plasma volume contraction; neuro-vestibular adaptation completed.',
        active: false
      },
      {
        phase: 'FD-015 to FD-082 • Steady-State EVA Operations',
        detail: 'Completed 2 orbital EVAs within nominal cardiovascular & thermal bounds.',
        active: false
      },
      {
        phase: 'FD-084 • Current Increment Operations (CRITICAL)',
        detail: `Active simulated excursion: HR ${hr ?? '--'} BPM, SpO2 ${spo2 ?? '--'}% — immediate Medical Chief review.`,
        active: true
      }
    ];
  }

  if (crewId === 'AG-LEO-02') {
    return [
      {
        phase: 'L-30 Days • Pre-Flight Baseline (JSC)',
        detail: `${label} baseline: Resting HR 68 BPM • BMD Reference DXA`,
        active: false
      },
      {
        phase: 'FD-001 to FD-014 • Orbital Insertion & Fluid Shift',
        detail: 'Nominal vestibular adaptation; circadian alignment established.',
        active: false
      },
      {
        phase: 'FD-015 to FD-082 • Payload Operations',
        detail: 'Consistent ARED resistance compliance; periodic sleep compression.',
        active: false
      },
      {
        phase: 'FD-084 • Current Increment Operations (CAUTION)',
        detail: `Monitored trend: HR ${hr ?? '--'} BPM, SpO2 ${spo2 ?? '--'}% — hydration & rest protocol active.`,
        active: true
      }
    ];
  }

  return [
    {
      phase: 'L-30 Days • Pre-Flight Baseline (JSC)',
      detail: `${label} baseline: Resting HR 66 BPM • BMD Reference DXA • Baseline OCT Imaging`,
      active: false
    },
    {
      phase: 'FD-001 to FD-014 • Orbital Insertion & Fluid Shift',
      detail: '12% plasma volume contraction; neuro-vestibular adaptation completed.',
      active: false
    },
    {
      phase: 'FD-015 to FD-060 • Steady-State Microgravity',
      detail: `Full ARED/T2 protocol ramp-up; resting HR stabilized near ${hr ?? '--'} BPM.`,
      active: false
    },
    {
      phase: 'FD-061 to FD-084 • Current Increment Operations',
      detail: `Current telemetry: HR ${hr ?? '--'} BPM, SpO2 ${spo2 ?? '--'}% within nominal parameters.`,
      active: true
    }
  ];
}


