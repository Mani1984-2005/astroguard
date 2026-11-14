import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Activity,
  Heart,
  Shield,
  Clock,
  FileText,
  Users,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Search,
  ChevronRight,
  Radio,
  Thermometer,
  Droplets,
  Wind,
  Zap,
  Moon,
  Sun,
  Award,
  Info,
  Plus,
  Check,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Stethoscope,
  Compass,
  Layers
} from 'lucide-react';

// ============================================================================
// AUTHENTIC NASA ARCHIVAL PHOTOGRAPHS (VERIFIED PUBLIC DOMAIN SOURCES)
// ============================================================================
const ARCHIVAL_TRIBUTES = [
  {
    id: 'chawla',
    name: 'Kalpana Chawla',
    designation: 'STS-87 & STS-107 Mission Specialist',
    years: '1962 – 2003 • NASA Astronaut Corps Group 15',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Kalpana_Chawla%2C_NASA_photo_portrait_in_orange_suit.jpg/800px-Kalpana_Chawla%2C_NASA_photo_portrait_in_orange_suit.jpg',
    fallbackUrl:
      'https://upload.wikimedia.org/wikipedia/commons/9/9c/Kalpana_Chawla%2C_NASA_photo_portrait_in_orange_suit.jpg',
    attribution: 'Archival Photograph: NASA / Public Domain (JSC-96-14842)',
    quote:
      '“When you look at the stars and the galaxy, you feel that you are not just from any particular piece of land, but from the solar system.”',
    focusArea: 'Aerospace Engineering & Microgravity Fluid Dynamics'
  },
  {
    id: 'williams',
    name: 'Sunita Williams',
    designation: 'ISS Expedition 14/15 & 32/33 Commander',
    years: 'NASA Astronaut Corps Group 17 • 322+ Days in Orbit',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Sunita_Williams.jpg/800px-Sunita_Williams.jpg',
    fallbackUrl:
      'https://upload.wikimedia.org/wikipedia/commons/c/cb/Sunita_Williams.jpg',
    attribution: 'Archival Photograph: NASA / Public Domain (JSC2004-E-48216)',
    quote:
      '“Living and working aboard the International Space Station teaches us how resilient human physiology truly is.”',
    focusArea: 'Long-Duration Orbital Endurance & EVA Operations'
  },
  {
    id: 'ride',
    name: 'Sally Ride',
    designation: 'STS-7 & STS-41-G Mission Specialist',
    years: '1951 – 2012 • First American Woman in Space',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Sally_Ride_%281984%29.jpg/800px-Sally_Ride_%281984%29.jpg',
    fallbackUrl:
      'https://upload.wikimedia.org/wikipedia/commons/0/0c/Sally_Ride_%281984%29.jpg',
    attribution: 'Archival Photograph: NASA / Public Domain (S84-37018)',
    quote:
      '“The stars don’t look bigger, but they do look brighter from low Earth orbit.”',
    focusArea: 'Orbital Robotics & Payload Operations'
  }
];

// ============================================================================
// SIMULATED CREW TELEMETRY & CLINICAL DATASETS (STRICTLY FICTIONAL PROFILES)
// ============================================================================
const ACTIVE_CREW_PROFILE = {
  id: 'AG-LEO-04',
  name: 'Cmdr. Elena Vance',
  role: 'Mission Commander • Increment 74',
  missionDay: 'FD-084 / 180',
  orbitAltitude: '408 km LEO',
  inclination: '51.6°',
  restingHr: 68,
  spo2: 98,
  coreTemp: 36.8,
  hrv: 64,
  radiation: 0.42,
  bp: '116 / 74'
};

const TELEMETRY_SERIES = {
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

const INITIAL_COUNTERMEASURES = [
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

const HEALTH_HISTORY_RECORDS = [
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
    status: 'Baseline'
  }
];

const RESEARCH_EVIDENCE_ITEMS = [
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

const CREW_ROSTER_DATA = [
  {
    id: 'AG-LEO-04',
    name: 'Cmdr. Elena Vance',
    role: 'Mission Commander',
    status: 'Nominal',
    hr: 68,
    hrv: 64,
    spo2: 98,
    temp: 36.8,
    radiation: 0.42,
    readiness: 96,
    lastSync: '12s ago',
    alertNote: 'All physiological parameters within nominal flight envelope.',
    notes: [
      {
        time: 'FD-084 09:00 UTC',
        author: 'Dr. M. Thorne (Lead Flight Surgeon)',
        text: 'Weekly private medical conference completed. Sleep efficiency steady at 86%; cleared for upcoming EVA prep.'
      }
    ]
  },
  {
    id: 'AG-LEO-07',
    name: 'Dr. Kenji Takahashi',
    role: 'Flight Engineer / Payload Specialist',
    status: 'Watch',
    hr: 79,
    hrv: 44,
    spo2: 97,
    temp: 37.1,
    radiation: 0.44,
    readiness: 83,
    lastSync: '18s ago',
    alertNote: 'Mild HRV suppression (-16 ms vs 7-day baseline) following late robotics shift.',
    notes: [
      {
        time: 'FD-084 07:45 UTC',
        author: 'Dr. M. Thorne (Lead Flight Surgeon)',
        text: 'Recommended reduced aerobic intensity today and 45-minute circadian light exposure prior to sleep.'
      }
    ]
  },
  {
    id: 'AG-LEO-09',
    name: 'Maj. Sofia Lindqvist',
    role: 'EVA Lead / Flight Engineer',
    status: 'Nominal',
    hr: 62,
    hrv: 71,
    spo2: 99,
    temp: 36.6,
    radiation: 0.41,
    readiness: 98,
    lastSync: '09s ago',
    alertNote: 'Optimal autonomic recovery; cleared for EVA-12 suit fit check.',
    notes: [
      {
        time: 'FD-083 18:20 UTC',
        author: 'Dr. R. Patel (Biomedical Engineer)',
        text: 'EMU biometric harness telemetry verified; zero signal dropout during 4-hour test.'
      }
    ]
  },
  {
    id: 'AG-LEO-11',
    name: 'Dr. Marcus Sterling',
    role: 'Biomedical & Science Officer',
    status: 'Nominal',
    hr: 65,
    hrv: 68,
    spo2: 98,
    temp: 36.7,
    radiation: 0.43,
    readiness: 95,
    lastSync: '14s ago',
    alertNote: 'Nominal hydration & ARED load compliance.',
    notes: [
      {
        time: 'FD-082 15:10 UTC',
        author: 'Dr. M. Thorne (Lead Flight Surgeon)',
        text: 'OCT retinal scan reviewed with JSC ophthalmology; no interval change.'
      }
    ]
  }
];

// ============================================================================
// CUSTOM ORIGINAL ASTROGUARD SVG EMBLEM (STRICTLY ORIGINAL, NON-NASA LOGO)
// ============================================================================
function AstroGuardEmblem({ size = 34 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="AstroGuard Emblem"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="agShieldGrad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#105BD8" />
          <stop offset="100%" stopColor="#071B3E" />
        </linearGradient>
        <linearGradient id="agOrbitGrad" x1="6" y1="28" x2="34" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#F8FAFC" />
        </linearGradient>
      </defs>
      {/* Hexagonal Aerospace Shield */}
      <path
        d="M20 2.5L34.5 9.5V20.5C34.5 29.1 28.3 35.4 20 37.8C11.7 35.4 5.5 29.1 5.5 20.5V9.5L20 2.5Z"
        fill="url(#agShieldGrad)"
        stroke="#3B82F6"
        strokeWidth="1.5"
      />
      {/* Inner Orbital Ring */}
      <ellipse
        cx="20"
        cy="20"
        rx="12.5"
        ry="5.2"
        transform="rotate(-24 20 20)"
        stroke="url(#agOrbitGrad)"
        strokeWidth="1.3"
        strokeOpacity="0.85"
      />
      {/* Biomedical ECG Pulse Line */}
      <path
        d="M9.5 20.5H14.5L16.7 15.2L19.6 25.8L22.3 17.6L24.2 20.5H30.5"
        stroke="#F8FAFC"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Signal Red Telemetry Node */}
      <circle cx="30.5" cy="20.5" r="2" fill="#E03C31" />
    </svg>
  );
}

// ============================================================================
// REAL-TIME ANIMATED ECG CANVAS COMPONENT
// ============================================================================
function LiveEcgMonitor({ bpm = 68 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let phase = 0;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Realistic P-QRS-T cardiac waveform function
    const getEcgAmplitude = (t) => {
      const cycle = t % 1;
      // P wave
      if (cycle > 0.12 && cycle < 0.22) {
        return -0.14 * Math.sin(((cycle - 0.12) / 0.1) * Math.PI);
      }
      // Q dip
      if (cycle >= 0.28 && cycle < 0.31) {
        return 0.16 * Math.sin(((cycle - 0.28) / 0.03) * Math.PI);
      }
      // R peak
      if (cycle >= 0.31 && cycle < 0.35) {
        return -0.92 * Math.sin(((cycle - 0.31) / 0.04) * Math.PI);
      }
      // S dip
      if (cycle >= 0.35 && cycle < 0.39) {
        return 0.28 * Math.sin(((cycle - 0.35) / 0.04) * Math.PI);
      }
      // T wave
      if (cycle >= 0.48 && cycle < 0.64) {
        return -0.24 * Math.sin(((cycle - 0.48) / 0.16) * Math.PI);
      }
      return 0;
    };

    let lastTime = performance.now();

    const render = (now) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);

      // Subtle clinical grid lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      const gridStep = 24;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const beatsPerSecond = bpm / 60;
      phase += dt * beatsPerSecond;

      const midY = height * 0.56;
      const scaleY = height * 0.42;
      const cyclesVisible = 3.2;

      // Glowing trace gradient
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(16, 91, 216, 0.1)');
      gradient.addColorStop(0.65, 'rgba(56, 189, 248, 0.85)');
      gradient.addColorStop(0.95, '#F8FAFC');
      gradient.addColorStop(1, '#E03C31');

      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      for (let x = 0; x <= width; x += 2) {
        const normalizedX = x / width;
        const sampleT = phase - (1 - normalizedX) * cyclesVisible;
        const positiveT = ((sampleT % 1) + 1) % 1;
        const y = midY + getEcgAmplitude(positiveT) * scaleY;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Leading pulse dot
      const leadT = ((phase % 1) + 1) % 1;
      const leadY = midY + getEcgAmplitude(leadT) * scaleY;
      ctx.beginPath();
      ctx.fillStyle = '#E03C31';
      ctx.arc(width - 4, leadY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = 'rgba(224, 60, 49, 0.3)';
      ctx.arc(width - 4, leadY, 8, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [bpm]);

  return (
    <div className="relative w-full h-36 sm:h-44 rounded-xl bg-[#040914] border border-white/10 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-2.5 left-3 flex items-center gap-2 text-[11px] font-mono text-slate-400">
        <span className="inline-block w-2 h-2 rounded-full bg-[#E03C31] animate-pulse" />
        <span>LEAD II • 25 mm/s • 10 mm/mV</span>
      </div>
      <div className="absolute top-2.5 right-3 text-[11px] font-mono text-sky-400/90">
        SINUS RHYTHM
      </div>
    </div>
  );
}

// ============================================================================
// CLEAN SVG TELEMETRY SPARKLINE CHART
// ============================================================================
function TelemetryLineChart({ labels, values, unit, color = '#38BDF8', minVal, maxVal }) {
  const width = 520;
  const height = 160;
  const padX = 32;
  const padY = 22;

  const computedMin = minVal !== undefined ? minVal : Math.min(...values) - 4;
  const computedMax = maxVal !== undefined ? maxVal : Math.max(...values) + 4;
  const range = Math.max(computedMax - computedMin, 1);

  const points = values.map((val, idx) => {
    const x =
      values.length === 1
        ? width / 2
        : padX + (idx / (values.length - 1)) * (width - padX * 2);
    const y = height - padY - ((val - computedMin) / range) * (height - padY * 2);
    return { x, y, val, label: labels[idx] };
  });

  const pathD = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height - padY} L ${points[0].x.toFixed(1)} ${height - padY} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40 overflow-visible">
      <defs>
        <linearGradient id={`grad-${unit.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Horizontal reference lines */}
      {[0, 0.5, 1].map((t, idx) => {
        const y = padY + t * (height - padY * 2);
        return (
          <line
            key={idx}
            x1={padX}
            y1={y}
            x2={width - padX}
            y2={y}
            stroke="rgba(255,255,255,0.07)"
            strokeDasharray="3 3"
          />
        );
      })}

      {/* Area fill */}
      <path d={areaD} fill={`url(#grad-${unit.replace(/[^a-zA-Z0-9]/g, '')})`} />

      {/* Line trace */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data nodes & labels */}
      {points.map((pt, idx) => (
        <g key={idx}>
          <circle cx={pt.x} cy={pt.y} r="3.5" fill="#050B16" stroke={color} strokeWidth="2" />
          <text
            x={pt.x}
            y={pt.y - 9}
            textAnchor="middle"
            className="fill-slate-200 text-[10px] font-mono"
          >
            {pt.val}
          </text>
          <text
            x={pt.x}
            y={height - 4}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] font-mono"
          >
            {pt.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ============================================================================
// MAIN ASTROGUARD APPLICATION
// ============================================================================
export default function App() {
  const [activePage, setActivePage] = useState('overview');
  const [selectedTributeId, setSelectedTributeId] = useState('chawla');
  const [imgError, setImgError] = useState({});
  const [liveHeartRate, setLiveHeartRate] = useState(68);

  // Page 2: My Health state
  const [timeframe, setTimeframe] = useState('24H');

  // Page 3: Health Assessment state
  const [assessmentInputs, setAssessmentInputs] = useState({
    sleepQuality: 8,
    fatigueLevel: 2,
    vestibularComfort: 9,
    hydrationAdequacy: 8,
    visualClarity: 9,
    notes: 'Nominal adaptation during Increment 74 morning operations.'
  });
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);

  // Page 4: Countermeasures state
  const [countermeasures, setCountermeasures] = useState(INITIAL_COUNTERMEASURES);

  // Page 5: Health History state
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');

  // Page 6: Research & Evidence state
  const [selectedResearchId, setSelectedResearchId] = useState('sans');

  // Page 7: Medical Chief Workspace state
  const [crewRoster, setCrewRoster] = useState(CREW_ROSTER_DATA);
  const [selectedCrewId, setSelectedCrewId] = useState('AG-LEO-04');
  const [crewStatusFilter, setCrewStatusFilter] = useState('ALL');
  const [newSurgeonNote, setNewSurgeonNote] = useState('');
  const [hrAlertUpper, setHrAlertUpper] = useState(110);
  const [spo2AlertLower, setSpo2AlertLower] = useState(94);

  // Subtle realistic resting heart rate fluctuation for live ECG feel (66–70 BPM)
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveHeartRate((prev) => {
        const delta = Math.floor(Math.random() * 3) - 1;
        const next = prev + delta;
        return Math.min(71, Math.max(66, next));
      });
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  const currentTribute = useMemo(
    () => ARCHIVAL_TRIBUTES.find((t) => t.id === selectedTributeId) || ARCHIVAL_TRIBUTES[0],
    [selectedTributeId]
  );

  // Computed Flight Readiness Score from Health Assessment inputs
  const readinessScore = useMemo(() => {
    const { sleepQuality, fatigueLevel, vestibularComfort, hydrationAdequacy, visualClarity } =
      assessmentInputs;
    const raw =
      sleepQuality * 2.2 +
      (10 - fatigueLevel) * 2.3 +
      vestibularComfort * 2.0 +
      hydrationAdequacy * 1.7 +
      visualClarity * 1.8;
    return Math.min(100, Math.max(55, Math.round(raw)));
  }, [assessmentInputs]);

  // Countermeasure compliance calculation
  const countermeasureCompliance = useMemo(() => {
    const total = countermeasures.reduce((acc, item) => acc + item.progress, 0);
    return Math.round(total / countermeasures.length);
  }, [countermeasures]);

  const toggleCountermeasure = (id) => {
    setCountermeasures((prev) =>
      prev.map((cm) => {
        if (cm.id !== id) return cm;
        const nextCompleted = !cm.completed;
        return {
          ...cm,
          completed: nextCompleted,
          progress: nextCompleted ? 100 : 50
        };
      })
    );
  };

  const filteredHistory = useMemo(() => {
    return HEALTH_HISTORY_RECORDS.filter((rec) => {
      const matchesPhase = historyFilter === 'ALL' || rec.status.toUpperCase() === historyFilter;
      const matchesQuery =
        rec.metric.toLowerCase().includes(historySearch.toLowerCase()) ||
        rec.phase.toLowerCase().includes(historySearch.toLowerCase()) ||
        rec.id.toLowerCase().includes(historySearch.toLowerCase());
      return matchesPhase && matchesQuery;
    });
  }, [historyFilter, historySearch]);

  const selectedCrewMember = useMemo(
    () => crewRoster.find((c) => c.id === selectedCrewId) || crewRoster[0],
    [crewRoster, selectedCrewId]
  );

  const handleAddSurgeonNote = (e) => {
    e.preventDefault();
    if (!newSurgeonNote.trim()) return;
    setCrewRoster((prev) =>
      prev.map((member) => {
        if (member.id !== selectedCrewId) return member;
        return {
          ...member,
          notes: [
            {
              time: 'FD-084 NOW UTC',
              author: 'Dr. M. Thorne (Flight Surgeon Console)',
              text: newSurgeonNote.trim()
            },
            ...member.notes
          ]
        };
      })
    );
    setNewSurgeonNote('');
  };

  const NAV_ITEMS = [
    { id: 'overview', label: 'Mission Overview', icon: Compass },
    { id: 'my-health', label: 'My Health', icon: Activity },
    { id: 'assessment', label: 'Health Assessment', icon: CheckCircle2 },
    { id: 'countermeasures', label: 'Countermeasures', icon: Shield },
    { id: 'history', label: 'Health History', icon: Clock },
    { id: 'research', label: 'Research & Evidence', icon: BookOpen },
    { id: 'medical-chief', label: 'Medical Chief', icon: Stethoscope }
  ];

  return (
    <div className="min-h-screen bg-[#050B16] text-slate-100 flex flex-col font-sans selection:bg-[#105BD8] selection:text-white">
      {/* ====================================================================
          TOP AEROSPACE NAVIGATION BAR
      ==================================================================== */}
      <header className="sticky top-0 z-40 bg-[#050B16]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Original AstroGuard Brand Identity */}
          <button
            onClick={() => setActivePage('overview')}
            className="flex items-center gap-3 text-left group focus:outline-none"
          >
            <AstroGuardEmblem size={36} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-[0.14em] text-base sm:text-lg text-white">
                  ASTROGUARD
                </span>
                <span className="hidden xl:inline-block text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#105BD8]/20 text-sky-300 border border-[#105BD8]/40">
                  ORB-MED v2.4
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tracking-wide hidden sm:block">
                Orbital Crew Biomedical Telemetry
              </p>
            </div>
          </button>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#0A1428]/90 p-1 rounded-xl border border-white/10">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#105BD8] text-white shadow-sm shadow-[#105BD8]/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Telemetry Separation & Simulated Data Badge */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0A1428] border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-right">
                <div className="text-xs font-medium text-white leading-tight">
                  {ACTIVE_CREW_PROFILE.name}
                </div>
                <div className="text-[10px] font-mono text-slate-400 leading-tight">
                  {ACTIVE_CREW_PROFILE.id} • {ACTIVE_CREW_PROFILE.missionDay}
                </div>
              </div>
            </div>

            <div
              title="All biometric readings are simulated demonstration telemetry separated from historical photographs."
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#E03C31]/15 border border-[#E03C31]/40 text-[#FF8A80] text-[10px] sm:text-[11px] font-mono font-semibold tracking-wider uppercase"
            >
              <Radio className="w-3.5 h-3.5 text-[#E03C31]" />
              <span>SIMULATED DATA</span>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet Horizontal Scroll Nav */}
        <div className="lg:hidden overflow-x-auto border-t border-white/5 bg-[#071020] px-4 py-2 flex items-center gap-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#105BD8] text-white'
                    : 'text-slate-400 hover:text-white bg-white/[0.03]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ====================================================================
          PAGE 1: MISSION OVERVIEW (SPLIT-SCREEN HERO ARCHITECTURE)
      ==================================================================== */}
      {activePage === 'overview' && (
        <main className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row">
          {/* LEFT PANE (42% DESKTOP WIDTH): AUTHENTIC HISTORICAL NASA ASTRONAUT PORTRAIT */}
          <section className="lg:w-[42%] relative min-h-[540px] lg:min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10 bg-[#071124]">
            {/* Archival NASA Portrait Image */}
            <img
              src={
                imgError[currentTribute.id]
                  ? currentTribute.fallbackUrl
                  : currentTribute.imageUrl
              }
              onError={() =>
                setImgError((prev) => ({ ...prev, [currentTribute.id]: true }))
              }
              alt={`${currentTribute.name} — NASA Archival Portrait`}
              className="absolute inset-0 w-full h-full object-cover object-top scale-[1.01] transition-all duration-700"
            />

            {/* Elegant Deep Navy Vignette & Atmospheric Gradient Overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, rgba(5,11,22,0.68) 0%, rgba(5,11,22,0.18) 38%, rgba(5,11,22,0.82) 76%, rgba(5,11,22,0.98) 100%)'
              }}
            />
            <div
              className="hidden lg:block absolute inset-y-0 right-0 w-24 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, rgba(5,11,22,0) 0%, #050B16 100%)'
              }}
            />

            {/* Top Tribute Attribution Header & Switcher */}
            <div className="relative z-10 p-6 sm:p-8 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#050B16]/80 backdrop-blur-md border border-white/15 text-[11px] font-mono uppercase tracking-wider text-sky-300">
                  <Award className="w-3.5 h-3.5 text-sky-400" />
                  Historical Pioneer Tribute
                </span>

                {/* Archival Tribute Selector Pills */}
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#050B16]/80 backdrop-blur-md border border-white/15">
                  {ARCHIVAL_TRIBUTES.map((tribute) => (
                    <button
                      key={tribute.id}
                      onClick={() => setSelectedTributeId(tribute.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                        selectedTributeId === tribute.id
                          ? 'bg-[#105BD8] text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {tribute.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Historical Identification & Clear Separation Notice */}
            <div className="relative z-10 p-6 sm:p-8 space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-sky-400">
                  {currentTribute.years}
                </p>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                  {currentTribute.name}
                </h1>
                <p className="text-sm sm:text-base font-medium text-slate-200">
                  {currentTribute.designation}
                </p>
              </div>

              <blockquote className="text-xs sm:text-sm text-slate-300 italic border-l-2 border-[#105BD8] pl-3.5 leading-relaxed">
                {currentTribute.quote}
              </blockquote>

              {/* Mandatory Historical Separation & Archival Source Box */}
              <div className="pt-3 border-t border-white/15 flex flex-col gap-1.5 text-[11px] text-slate-300">
                <div className="flex items-center justify-between gap-2 font-mono text-slate-300">
                  <span>{currentTribute.attribution}</span>
                </div>
                <div className="flex items-start gap-2 text-slate-400 bg-[#050B16]/75 px-3 py-2 rounded-lg border border-white/10">
                  <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <span>
                    Inspirational archival portrait only. Not an active telemetry subject; live
                    biometrics on the right belong to simulated crew profile{' '}
                    <strong className="text-slate-200">{ACTIVE_CREW_PROFILE.name}</strong>.
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT PANE (58% DESKTOP WIDTH): DEEP NAVY HEALTH-MONITORING WORKSPACE */}
          <section className="lg:w-[58%] p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6 bg-[#050B16]">
            {/* Top Workspace Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-xs font-mono uppercase tracking-widest text-sky-400">
                    ORBITAL TELEMETRY CONSOLE
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#E03C31]/15 border border-[#E03C31]/35 text-[#FF8A80] text-[10px] font-mono font-semibold">
                    SIMULATED DATA
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold text-white">
                  Active Subject: {ACTIVE_CREW_PROFILE.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {ACTIVE_CREW_PROFILE.role} • {ACTIVE_CREW_PROFILE.orbitAltitude} (
                  {ACTIVE_CREW_PROFILE.inclination})
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-3.5 py-2 rounded-xl bg-[#0A1428] border border-emerald-500/30">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    FLIGHT READINESS
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>NOMINAL • {readinessScore}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PRIMARY HEART RATE & LIVE ECG WAVEFORM CARD */}
            <div className="rounded-2xl bg-[#0A1428]/90 border border-white/10 p-5 sm:p-6 shadow-xl shadow-black/30">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-[#E03C31]/15 border border-[#E03C31]/35 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-[#E03C31]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                        PRIMARY CARDIAC TELEMETRY
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-300">
                        SIMULATED
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-white">
                      Resting Heart Rate & Real-Time ECG
                    </h3>
                  </div>
                </div>

                {/* Large Tabular Heart Rate Metric */}
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-bold font-mono tracking-tight text-white tabular-nums">
                    {liveHeartRate}
                  </span>
                  <div className="text-xs font-mono text-slate-400">
                    <div className="text-sky-400 font-semibold">BPM</div>
                    <div>RANGE 55–85</div>
                  </div>
                </div>
              </div>

              {/* Animated ECG Canvas */}
              <LiveEcgMonitor bpm={liveHeartRate} />

              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono">
                <span>QRS DURATION: 88 ms • QTc: 404 ms</span>
                <span className="text-emerald-400">● AUTONOMIC BALANCE OPTIMAL</span>
              </div>
            </div>

            {/* COMPACT SECONDARY BIOMEDICAL INDICATORS GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-xl bg-[#0A1428]/85 border border-white/10 hover:border-[#105BD8]/50 transition-colors">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-mono uppercase">SpO2 SAT</span>
                  <Wind className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white tabular-nums">
                  {ACTIVE_CREW_PROFILE.spo2}
                  <span className="text-sm font-normal text-slate-400 ml-0.5">%</span>
                </div>
                <div className="text-[11px] text-emerald-400 mt-1 font-mono">CABIN 101.3 kPa</div>
              </div>

              <div className="p-4 rounded-xl bg-[#0A1428]/85 border border-white/10 hover:border-[#105BD8]/50 transition-colors">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-mono uppercase">CORE TEMP</span>
                  <Thermometer className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white tabular-nums">
                  {ACTIVE_CREW_PROFILE.coreTemp}
                  <span className="text-sm font-normal text-slate-400 ml-0.5">°C</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">DELTA +0.1°C</div>
              </div>

              <div className="p-4 rounded-xl bg-[#0A1428]/85 border border-white/10 hover:border-[#105BD8]/50 transition-colors">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-mono uppercase">HRV (RMSSD)</span>
                  <Activity className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white tabular-nums">
                  {ACTIVE_CREW_PROFILE.hrv}
                  <span className="text-sm font-normal text-slate-400 ml-1">ms</span>
                </div>
                <div className="text-[11px] text-emerald-400 mt-1 font-mono">HIGH RECOVERY</div>
              </div>

              <div className="p-4 rounded-xl bg-[#0A1428]/85 border border-white/10 hover:border-[#105BD8]/50 transition-colors">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-mono uppercase">RAD DOSE</span>
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white tabular-nums">
                  {ACTIVE_CREW_PROFILE.radiation}
                  <span className="text-xs font-normal text-slate-400 ml-1">mSv/d</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">CUMUL: 35.3 mSv</div>
              </div>
            </div>

            {/* QUICK MODULE NAVIGATION FOOTER */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                Daily Countermeasure Compliance:{' '}
                <span className="font-mono font-semibold text-white">
                  {countermeasureCompliance}%
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActivePage('my-health')}
                  className="px-4 py-2 rounded-xl bg-[#105BD8] hover:bg-[#196BF2] text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <span>Deep Biometric Telemetry</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setActivePage('medical-chief')}
                  className="px-4 py-2 rounded-xl bg-[#0A1428] hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <span>Flight Surgeon Console</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ====================================================================
          PAGE 2: MY HEALTH (SPLIT-SCREEN BIOMETRIC ANALYTICS)
      ==================================================================== */}
      {activePage === 'my-health' && (
        <main className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row">
          {/* LEFT PANE (40%): PERSONAL BIOMETRIC PROFILE & CIRCADIAN ORBIT CYCLE */}
          <aside className="lg:w-[40%] p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#071022] flex flex-col justify-between gap-6">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-sky-400">
                  CREW BIOMETRIC DOSSIER • SIMULATED DATA
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                  {ACTIVE_CREW_PROFILE.name}
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  {ACTIVE_CREW_PROFILE.role} • ID {ACTIVE_CREW_PROFILE.id}
                </p>
              </div>

              {/* Circadian Orbital Cycle Card */}
              <div className="p-5 rounded-2xl bg-[#0A1428] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Moon className="w-4 h-4 text-sky-400" />
                    <span>Orbital Circadian & Sleep Architecture</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">
                    SCORE {TELEMETRY_SERIES[timeframe].sleepScore}/100
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Station completes 16 orbital sunrises/sunsets every 24 hours. Artificial
                  phototherapy maintains UTC-aligned 24-hour circadian entrainment.
                </p>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-[#050B16] border border-white/5">
                    <div className="text-[10px] font-mono text-slate-400">TOTAL SLEEP</div>
                    <div className="text-base font-mono font-bold text-white mt-0.5">7h 18m</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#050B16] border border-white/5">
                    <div className="text-[10px] font-mono text-slate-400">REM STAGE</div>
                    <div className="text-base font-mono font-bold text-sky-400 mt-0.5">
                      {TELEMETRY_SERIES[timeframe].remPercent}%
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#050B16] border border-white/5">
                    <div className="text-[10px] font-mono text-slate-400">DEEP N3</div>
                    <div className="text-base font-mono font-bold text-emerald-400 mt-0.5">
                      {TELEMETRY_SERIES[timeframe].deepPercent}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Hemodynamic & Neuro-Vestibular Status */}
              <div className="p-5 rounded-2xl bg-[#0A1428] border border-white/10 space-y-3.5">
                <h3 className="text-sm font-semibold text-white">
                  Systemic Microgravity Adaptation Summary
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Blood Pressure (Cuff Calibrated)</span>
                    <span className="font-mono text-white font-medium">
                      {ACTIVE_CREW_PROFILE.bp} mmHg
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Cephalad Fluid Shift Index</span>
                    <span className="font-mono text-sky-300">Stabilized (Phase II)</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Neuro-Vestibular Gaze Stability</span>
                    <span className="font-mono text-emerald-400">98.4% Nominal</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-400">Respiratory Rate (Resting)</span>
                    <span className="font-mono text-white">14 breaths/min</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0A1428]/70 border border-white/10 text-[11px] text-slate-400 flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-[#E03C31] shrink-0" />
              <span>
                All telemetry curves represent simulated orbital biomedical sensor streams for
                demonstration.
              </span>
            </div>
          </aside>

          {/* RIGHT PANE (60%): MULTI-PARAMETER TELEMETRY BREAKDOWN */}
          <section className="lg:w-[60%] p-6 sm:p-8 space-y-6 bg-[#050B16]">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Multi-Parameter Physiological Trends
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Continuous wearable harness & cabin environmental correlation
                </p>
              </div>

              {/* Timeframe Switcher */}
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0A1428] border border-white/10">
                {['24H', '7D', '30D'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
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

            {/* Chart 1: Heart Rate */}
            <div className="p-5 rounded-2xl bg-[#0A1428]/90 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[11px] font-mono uppercase text-sky-400">
                    CARDIOVASCULAR • SIMULATED
                  </span>
                  <h3 className="text-base font-semibold text-white">
                    Heart Rate Trajectory (BPM)
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-300">
                  MEAN:{' '}
                  {Math.round(
                    TELEMETRY_SERIES[timeframe].hr.reduce((a, b) => a + b, 0) /
                      TELEMETRY_SERIES[timeframe].hr.length
                  )}{' '}
                  BPM
                </span>
              </div>
              <TelemetryLineChart
                labels={TELEMETRY_SERIES[timeframe].labels}
                values={TELEMETRY_SERIES[timeframe].hr}
                unit="BPM"
                color="#38BDF8"
                minVal={50}
                maxVal={95}
              />
            </div>

            {/* Chart 2: Heart Rate Variability */}
            <div className="p-5 rounded-2xl bg-[#0A1428]/90 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[11px] font-mono uppercase text-emerald-400">
                    AUTONOMIC RECOVERY • SIMULATED
                  </span>
                  <h3 className="text-base font-semibold text-white">
                    Heart Rate Variability — RMSSD (ms)
                  </h3>
                </div>
                <span className="text-xs font-mono text-emerald-400">PARASYMPATHETIC NOMINAL</span>
              </div>
              <TelemetryLineChart
                labels={TELEMETRY_SERIES[timeframe].labels}
                values={TELEMETRY_SERIES[timeframe].hrv}
                unit="ms"
                color="#34D399"
                minVal={40}
                maxVal={85}
              />
            </div>

            {/* Pulmonary & Thermoregulation Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#0A1428] border border-white/10">
                <div className="text-xs font-mono text-slate-400 mb-1">
                  ARTERIAL OXYGEN SATURATION (SpO2)
                </div>
                <div className="text-2xl font-mono font-bold text-white">
                  98.1% <span className="text-xs font-normal text-emerald-400">±0.4%</span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Zero hypoxic desaturation events recorded across sleep or ARED exertion.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#0A1428] border border-white/10">
                <div className="text-xs font-mono text-slate-400 mb-1">
                  CORE THERMOREGULATION
                </div>
                <div className="text-2xl font-mono font-bold text-white">
                  36.8°C <span className="text-xs font-normal text-sky-400">NOMINAL</span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Microgravity convective heat dissipation compensated via cabin airflow.
                </p>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ====================================================================
          PAGE 3: HEALTH ASSESSMENT (FLIGHT READINESS & CHECK-IN)
      ==================================================================== */}
      {activePage === 'assessment' && (
        <main className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row">
          {/* LEFT PANE (40%): FLIGHT READINESS GAUGE & PRE-EVA CLEARANCE */}
          <aside className="lg:w-[40%] p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#071022] flex flex-col justify-between gap-6">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-sky-400">
                  PHYSIOLOGICAL READINESS INDEX • SIMULATED
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                  Flight & EVA Clearance
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Dynamic composite score combining objective biotelemetry and crew self-report.
                </p>
              </div>

              {/* Readiness Ring Card */}
              <div className="p-6 rounded-2xl bg-[#0A1428] border border-white/10 flex items-center gap-6">
                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="9"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke={readinessScore >= 85 ? '#10B981' : '#F59E0B'}
                      strokeWidth="9"
                      strokeDasharray={`${(readinessScore / 100) * 264} 264`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <div className="text-2xl font-mono font-bold text-white">{readinessScore}</div>
                    <div className="text-[10px] font-mono text-slate-400">INDEX</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold ${
                      readinessScore >= 85
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {readinessScore >= 85 ? 'CLEARED FOR FULL OPS' : 'FLIGHT SURGEON REVIEW'}
                  </span>
                  <h3 className="text-base font-semibold text-white">
                    {ACTIVE_CREW_PROFILE.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Automated cardiovascular, vestibular, and hydration thresholds verified.
                  </p>
                </div>
              </div>

              {/* Automated Pre-EVA Checklist */}
              <div className="p-5 rounded-2xl bg-[#0A1428] border border-white/10 space-y-3">
                <h3 className="text-sm font-semibold text-white">
                  Automated Telemetry Clearance Gates
                </h3>
                {[
                  { label: 'Resting Sinus Rhythm (55–85 BPM)', status: 'PASS • 68 BPM' },
                  { label: 'Arterial Oxygenation (SpO2 ≥ 96%)', status: 'PASS • 98%' },
                  { label: 'Core Temperature Stability (< 37.5°C)', status: 'PASS • 36.8°C' },
                  { label: '7-Day ARED Loading Compliance (≥ 85%)', status: 'PASS • 96%' }
                ].map((gate, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-2 border-b border-white/5 last:border-none"
                  >
                    <span className="text-slate-300">{gate.label}</span>
                    <span className="font-mono text-emerald-400">{gate.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              PROTOCOL: JSC-MED-OPS-402 • SIMULATED DATA
            </div>
          </aside>

          {/* RIGHT PANE (60%): INTERACTIVE CREW PHYSIOLOGICAL CHECK-IN */}
          <section className="lg:w-[60%] p-6 sm:p-8 space-y-6 bg-[#050B16]">
            <div className="pb-4 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">
                Daily Crew Physiological Self-Assessment
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Adjust subjective orbital wellness metrics to dynamically recalculate flight
                readiness
              </p>
            </div>

            <div className="space-y-5">
              {[
                {
                  key: 'sleepQuality',
                  label: 'Restorative Sleep Quality',
                  desc: '1 = Fragmented sleep • 10 = Deep uninterrupted rest',
                  value: assessmentInputs.sleepQuality
                },
                {
                  key: 'fatigueLevel',
                  label: 'Perceived Physical & Cognitive Fatigue',
                  desc: '1 = Alert & energized • 10 = Severe operational fatigue',
                  value: assessmentInputs.fatigueLevel
                },
                {
                  key: 'vestibularComfort',
                  label: 'Neuro-Vestibular & Spatial Orientation Comfort',
                  desc: '1 = Motion sensitivity • 10 = Complete spatial stability',
                  value: assessmentInputs.vestibularComfort
                },
                {
                  key: 'hydrationAdequacy',
                  label: 'Hydration & Fluid Balance Status',
                  desc: '1 = Dehydrated • 10 = Optimal electrolyte intake',
                  value: assessmentInputs.hydrationAdequacy
                },
                {
                  key: 'visualClarity',
                  label: 'Visual Acuity & Near-Focus Clarity (SANS Screening)',
                  desc: '1 = Blurred near vision • 10 = Baseline crisp acuity',
                  value: assessmentInputs.visualClarity
                }
              ].map((field) => (
                <div
                  key={field.key}
                  className="p-4 rounded-xl bg-[#0A1428]/90 border border-white/10 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-white">{field.label}</div>
                      <div className="text-xs text-slate-400">{field.desc}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-[#105BD8]/20 border border-[#105BD8]/40 font-mono text-sm font-bold text-sky-300">
                      {field.value} / 10
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={field.value}
                    onChange={(e) => {
                      setAssessmentSubmitted(false);
                      setAssessmentInputs((prev) => ({
                        ...prev,
                        [field.key]: Number(e.target.value)
                      }));
                    }}
                    className="w-full accent-[#105BD8] cursor-pointer"
                  />
                </div>
              ))}

              <div className="p-4 rounded-xl bg-[#0A1428]/90 border border-white/10 space-y-2">
                <label className="block text-xs font-mono uppercase text-slate-400">
                  Crew Subjective Flight Note
                </label>
                <textarea
                  rows={2}
                  value={assessmentInputs.notes}
                  onChange={(e) => {
                    setAssessmentSubmitted(false);
                    setAssessmentInputs((prev) => ({ ...prev, notes: e.target.value }));
                  }}
                  className="w-full rounded-lg bg-[#050B16] border border-white/10 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#105BD8]"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                {assessmentSubmitted ? (
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>CHECK-IN TRANSMITTED TO FLIGHT SURGEON CONSOLE (SIMULATED)</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">
                    Updates sync immediately with Mission Overview readiness.
                  </span>
                )}

                <button
                  onClick={() => setAssessmentSubmitted(true)}
                  className="px-5 py-2.5 rounded-xl bg-[#105BD8] hover:bg-[#196BF2] text-white text-xs font-semibold transition-colors"
                >
                  Log Daily Assessment
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ====================================================================
          PAGE 4: COUNTERMEASURES (MICROGRAVITY MITIGATION PROTOCOLS)
      ==================================================================== */}
      {activePage === 'countermeasures' && (
        <main className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row">
          {/* LEFT PANE (40%): DAILY COMPLIANCE RING & SCHEDULE SUMMARY */}
          <aside className="lg:w-[40%] p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#071022] flex flex-col justify-between gap-6">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-sky-400">
                  MICROGRAVITY MITIGATION • SIMULATED
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                  Countermeasure Protocols
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Preserving bone mineral density, aerobic capacity, and circadian rhythm in
                  weightlessness.
                </p>
              </div>

              {/* Compliance Summary Card */}
              <div className="p-6 rounded-2xl bg-[#0A1428] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-slate-400">
                    FD-084 PROTOCOL COMPLETION
                  </span>
                  <span className="text-2xl font-mono font-bold text-sky-400">
                    {countermeasureCompliance}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#050B16] overflow-hidden">
                  <div
                    className="h-full bg-[#105BD8] transition-all duration-500"
                    style={{ width: `${countermeasureCompliance}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {countermeasures.filter((c) => c.completed).length} of {countermeasures.length}{' '}
                  prescribed daily aerospace health protocols completed.
                </p>
              </div>

              {/* Physiological Protection Targets */}
              <div className="p-5 rounded-2xl bg-[#0A1428] border border-white/10 space-y-3">
                <h3 className="text-sm font-semibold text-white">
                  Increment 74 Physiological Targets
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Femoral Neck BMD Retention</span>
                    <span className="font-mono text-emerald-400">99.1% of Baseline</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Aerobic VO2 Max Preservation</span>
                    <span className="font-mono text-emerald-400">96.9% of Baseline</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Daily Resistive Exercise Slot</span>
                    <span className="font-mono text-white">100 min Allocated</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              HARDWARE: ARED • T2 COLBERT • SOLID-STATE LED
            </div>
          </aside>

          {/* RIGHT PANE (60%): INTERACTIVE PROTOCOL CARDS */}
          <section className="lg:w-[60%] p-6 sm:p-8 space-y-4 bg-[#050B16]">
            <div className="pb-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Prescribed Daily Countermeasure Schedule
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Toggle session completion status to update crew compliance telemetry
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">UTC MISSION CLOCK</span>
            </div>

            <div className="space-y-4">
              {countermeasures.map((cm) => (
                <div
                  key={cm.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    cm.completed
                      ? 'bg-[#0A1428]/90 border-emerald-500/30'
                      : 'bg-[#0A1428]/70 border-white/10'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#105BD8]/20 text-sky-300 border border-[#105BD8]/40">
                          {cm.code}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{cm.schedule}</span>
                      </div>
                      <h3 className="text-base font-semibold text-white">{cm.title}</h3>
                      <p className="text-xs text-sky-300">{cm.target}</p>
                    </div>

                    <button
                      onClick={() => toggleCountermeasure(cm.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                        cm.completed
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-[#105BD8] hover:bg-[#196BF2] text-white'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{cm.completed ? 'Completed' : 'Mark Complete'}</span>
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span>
                      Intensity: <strong className="text-slate-200">{cm.intensity}</strong>
                    </span>
                    <span>
                      Duration: <strong className="text-slate-200">{cm.duration}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{cm.notes}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* ====================================================================
          PAGE 5: HEALTH HISTORY (LONGITUDINAL MISSION TIMELINE & LOGS)
      ==================================================================== */}
      {activePage === 'history' && (
        <main className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row">
          {/* LEFT PANE (40%): MISSION PHASE TIMELINE */}
          <aside className="lg:w-[40%] p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#071022] space-y-6">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-sky-400">
                LONGITUDINAL ARCHIVE • SIMULATED DATA
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                Mission Health History
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Comparative physiological trajectory from pre-flight baseline through Flight Day
                84.
              </p>
            </div>

            {/* Phase Timeline */}
            <div className="space-y-4 relative pl-5 border-l border-[#105BD8]/40">
              {[
                {
                  phase: 'L-30 Days • Pre-Flight Baseline (JSC)',
                  detail: 'Resting HR 66 BPM • BMD Reference DXA • Baseline OCT Imaging',
                  active: false
                },
                {
                  phase: 'FD-001 to FD-014 • Orbital Insertion & Fluid Shift',
                  detail: '12% plasma volume contraction; neuro-vestibular adaptation completed.',
                  active: false
                },
                {
                  phase: 'FD-015 to FD-060 • Steady-State Microgravity',
                  detail: 'Full ARED/T2 protocol ramp-up; resting HR stabilized at 68 BPM.',
                  active: false
                },
                {
                  phase: 'FD-061 to FD-084 • Current Increment Operations',
                  detail: 'Nominal cardiovascular, ocular, and radiation dosimetry parameters.',
                  active: true
                }
              ].map((step, idx) => (
                <div key={idx} className="relative">
                  <span
                    className={`absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full ${
                      step.active ? 'bg-sky-400 ring-4 ring-sky-400/20' : 'bg-slate-600'
                    }`}
                  />
                  <div className="p-4 rounded-xl bg-[#0A1428] border border-white/10">
                    <div className="text-xs font-mono text-sky-300">{step.phase}</div>
                    <p className="text-xs text-slate-300 mt-1">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* RIGHT PANE (60%): FILTERABLE CLINICAL TELEMETRY LOG */}
          <section className="lg:w-[60%] p-6 sm:p-8 space-y-5 bg-[#050B16]">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Clinical Telemetry & Diagnostic Log
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Searchable historical medical evaluations for {ACTIVE_CREW_PROFILE.name}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter metric or ID..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0A1428] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#105BD8]"
                  />
                </div>

                {['ALL', 'NOMINAL', 'MONITORED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setHistoryFilter(st)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-colors ${
                      historyFilter === st
                        ? 'bg-[#105BD8] text-white'
                        : 'bg-[#0A1428] text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0A1428]/80">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-mono uppercase text-slate-400 bg-[#071022]">
                    <th className="py-3 px-4">Record</th>
                    <th className="py-3 px-4">Mission Timestamp</th>
                    <th className="py-3 px-4">Evaluation</th>
                    <th className="py-3 px-4">Reading</th>
                    <th className="py-3 px-4">Baseline Delta</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {filteredHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-mono text-sky-400">{row.id}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{row.date}</td>
                      <td className="py-3.5 px-4 font-medium text-white">{row.metric}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-200">{row.value}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">{row.baselineDelta}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                            row.status === 'Nominal' || row.status === 'Baseline'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {/* ====================================================================
          PAGE 6: RESEARCH & EVIDENCE (AEROSPACE MEDICINE KNOWLEDGE BASE)
      ==================================================================== */}
      {activePage === 'research' && (
        <main className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row">
          {/* LEFT PANE (40%): PHYSIOLOGICAL ADAPTATION CATEGORIES */}
          <aside className="lg:w-[40%] p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#071022] space-y-5">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-sky-400">
                AEROSPACE MEDICINE EVIDENCE INDEX
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                Research & Clinical Evidence
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Peer-reviewed human spaceflight physiological research informing AstroGuard
                telemetry thresholds.
              </p>
            </div>

            <div className="space-y-2.5">
              {RESEARCH_EVIDENCE_ITEMS.map((item) => {
                const isSelected = selectedResearchId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedResearchId(item.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-[#105BD8]/20 border-[#105BD8] text-white'
                        : 'bg-[#0A1428] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-sky-400 mb-1">
                      <span>{item.category.toUpperCase()}</span>
                      <span>{item.code}</span>
                    </div>
                    <div className="text-sm font-semibold text-white">{item.title}</div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* RIGHT PANE (60%): STRUCTURED EVIDENCE BRIEF */}
          <section className="lg:w-[60%] p-6 sm:p-8 bg-[#050B16]">
            {(() => {
              const activeBrief =
                RESEARCH_EVIDENCE_ITEMS.find((r) => r.id === selectedResearchId) ||
                RESEARCH_EVIDENCE_ITEMS[0];
              return (
                <div className="p-6 sm:p-8 rounded-2xl bg-[#0A1428]/90 border border-white/10 space-y-6">
                  <div className="space-y-2 pb-5 border-b border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded bg-[#105BD8]/20 border border-[#105BD8]/40 text-xs font-mono text-sky-300">
                        {activeBrief.code} • {activeBrief.category}
                      </span>
                      <span className="text-xs font-mono text-emerald-400">
                        {activeBrief.evidenceGrade}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-white pt-1">{activeBrief.title}</h2>
                    <p className="text-xs font-mono text-slate-400">{activeBrief.source}</p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-sky-400">
                      Pathophysiological Mechanism
                    </h3>
                    <p className="text-sm text-slate-200 leading-relaxed">{activeBrief.summary}</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-sky-400">
                      Operational Flight Medicine Countermeasures
                    </h3>
                    <div className="space-y-2.5">
                      {activeBrief.implications.map((imp, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3.5 rounded-xl bg-[#050B16] border border-white/5 text-xs sm:text-sm text-slate-300"
                        >
                          <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                          <span>{imp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>
        </main>
      )}

      {/* ====================================================================
          PAGE 7: MEDICAL CHIEF WORKSPACE (FLIGHT SURGEON CONSOLE)
      ==================================================================== */}
      {activePage === 'medical-chief' && (
        <main className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row">
          {/* LEFT PANE (40%): CREW ROSTER TRIAGE LIST */}
          <aside className="lg:w-[40%] p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#071022] space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-sky-400">
                  MCC HOUSTON • SURGEON CONSOLE
                </span>
                <h1 className="text-2xl font-bold text-white mt-1">Increment 74 Crew Triage</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Simulated multi-crew telemetry overview
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#0A1428] p-1 rounded-lg border border-white/10">
                {['ALL', 'NOMINAL', 'WATCH'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setCrewStatusFilter(f)}
                    className={`px-2 py-1 rounded text-[10px] font-mono ${
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

            <div className="space-y-3">
              {crewRoster
                .filter(
                  (m) =>
                    crewStatusFilter === 'ALL' || m.status.toUpperCase() === crewStatusFilter
                )
                .map((member) => {
                  const isSelected = member.id === selectedCrewId;
                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedCrewId(member.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-[#105BD8]/20 border-[#105BD8]'
                          : 'bg-[#0A1428] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{member.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {member.id}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">{member.role}</div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                            member.status === 'Nominal'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {member.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/5 text-xs font-mono">
                        <div>
                          <span className="text-slate-500 block text-[10px]">HR</span>
                          <span className="text-white">{member.hr} BPM</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">HRV</span>
                          <span className="text-white">{member.hrv} ms</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">SpO2</span>
                          <span className="text-white">{member.spo2}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">READY</span>
                          <span className="text-sky-400">{member.readiness}%</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </aside>

          {/* RIGHT PANE (60%): SELECTED CREW CLINICAL REVIEW & THRESHOLD CONTROLS */}
          <section className="lg:w-[60%] p-6 sm:p-8 space-y-6 bg-[#050B16]">
            {/* Selected Crew Header */}
            <div className="p-5 rounded-2xl bg-[#0A1428] border border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-sky-400">
                    SELECTED SUBJECT • {selectedCrewMember.id}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#E03C31]/15 text-[#FF8A80] text-[10px] font-mono">
                    SIMULATED DATA
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-0.5">{selectedCrewMember.name}</h2>
                <p className="text-xs text-slate-300 mt-1">{selectedCrewMember.alertNote}</p>
              </div>
              <div className="text-right font-mono text-xs text-slate-400">
                <div>TELEMETRY SYNC: {selectedCrewMember.lastSync}</div>
                <div className="text-emerald-400 mt-0.5">DOWNLINK KU-BAND ACTIVE</div>
              </div>
            </div>

            {/* Biometric Snapshot Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[#0A1428] border border-white/10">
                <div className="text-[10px] font-mono text-slate-400">HEART RATE</div>
                <div className="text-xl font-mono font-bold text-white mt-0.5">
                  {selectedCrewMember.hr} BPM
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#0A1428] border border-white/10">
                <div className="text-[10px] font-mono text-slate-400">HRV (RMSSD)</div>
                <div className="text-xl font-mono font-bold text-white mt-0.5">
                  {selectedCrewMember.hrv} ms
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#0A1428] border border-white/10">
                <div className="text-[10px] font-mono text-slate-400">CORE TEMP</div>
                <div className="text-xl font-mono font-bold text-white mt-0.5">
                  {selectedCrewMember.temp}°C
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#0A1428] border border-white/10">
                <div className="text-[10px] font-mono text-slate-400">RAD DOSE</div>
                <div className="text-xl font-mono font-bold text-white mt-0.5">
                  {selectedCrewMember.radiation} mSv/d
                </div>
              </div>
            </div>

            {/* Automated Telemetry Alert Threshold Configuration */}
            <div className="p-5 rounded-2xl bg-[#0A1428]/90 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-400" />
                  <span>Automated Telemetry Alert Thresholds</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-400">FLIGHT RULE 13-4A</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-[#050B16] border border-white/5 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Resting HR Upper Caution</span>
                    <span className="font-mono text-sky-300 font-semibold">
                      {hrAlertUpper} BPM
                    </span>
                  </div>
                  <input
                    type="range"
                    min="90"
                    max="140"
                    value={hrAlertUpper}
                    onChange={(e) => setHrAlertUpper(Number(e.target.value))}
                    className="w-full accent-[#105BD8]"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#050B16] border border-white/5 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">SpO2 Lower Warning Floor</span>
                    <span className="font-mono text-sky-300 font-semibold">
                      {spo2AlertLower}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="90"
                    max="97"
                    value={spo2AlertLower}
                    onChange={(e) => setSpo2AlertLower(Number(e.target.value))}
                    className="w-full accent-[#105BD8]"
                  />
                </div>
              </div>
            </div>

            {/* Flight Surgeon Clinical Notes Log */}
            <div className="p-5 rounded-2xl bg-[#0A1428]/90 border border-white/10 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                Flight Surgeon Clinical Log — {selectedCrewMember.name}
              </h3>

              <form onSubmit={handleAddSurgeonNote} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter clinical observation or countermeasure directive..."
                  value={newSurgeonNote}
                  onChange={(e) => setNewSurgeonNote(e.target.value)}
                  className="flex-1 rounded-xl bg-[#050B16] border border-white/10 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#105BD8]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#105BD8] hover:bg-[#196BF2] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Note</span>
                </button>
              </form>

              <div className="space-y-2.5">
                {selectedCrewMember.notes.map((note, index) => (
                  <div
                    key={index}
                    className="p-3.5 rounded-xl bg-[#050B16] border border-white/5 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-sky-400">
                      <span>{note.author}</span>
                      <span className="text-slate-500">{note.time}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{note.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}