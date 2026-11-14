import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { AssessmentInputs, CrewProfile } from '../types/astroguard';
import { AstronautPortrait } from '../components/common/AstronautPortrait';

interface HealthAssessmentProps {
  crewProfile: CrewProfile;
  readinessScore: number;
  inputs: AssessmentInputs;
  submitted: boolean;
  onUpdateInput: (field: keyof AssessmentInputs, value: number | string) => void;
  onSubmit: () => void;
}

const SLIDER_FIELDS: Array<{
  key: Exclude<keyof AssessmentInputs, 'notes'>;
  label: string;
  desc: string;
}> = [
  {
    key: 'sleepQuality',
    label: 'Restorative Sleep Quality',
    desc: '1 = Fragmented sleep • 10 = Deep uninterrupted rest'
  },
  {
    key: 'fatigueLevel',
    label: 'Perceived Physical & Cognitive Fatigue',
    desc: '1 = Alert & energized • 10 = Severe operational fatigue'
  },
  {
    key: 'vestibularComfort',
    label: 'Neuro-Vestibular & Spatial Orientation Comfort',
    desc: '1 = Motion sensitivity • 10 = Complete spatial stability'
  },
  {
    key: 'hydrationAdequacy',
    label: 'Hydration & Fluid Balance Status',
    desc: '1 = Dehydrated • 10 = Optimal electrolyte intake'
  },
  {
    key: 'visualClarity',
    label: 'Visual Acuity & Near-Focus Clarity (SANS Screening)',
    desc: '1 = Blurred near vision • 10 = Baseline crisp acuity'
  }
];

export function HealthAssessment({
  crewProfile,
  readinessScore,
  inputs,
  submitted,
  onUpdateInput,
  onSubmit
}: HealthAssessmentProps) {
  const hr = crewProfile.vitals.heartRate;
  const spo2 = crewProfile.vitals.spo2;
  const temp = crewProfile.vitals.coreTemp;

  const hrPass = hr !== null && hr >= 55 && hr <= 85;
  const spo2Pass = spo2 !== null && spo2 >= 96;
  const tempPass = temp !== null && temp < 37.5;
  const gates = [
    {
      label: 'Resting Sinus Rhythm (55–85 BPM)',
      status: hr === null ? 'NO SIG' : `${hrPass ? 'PASS' : 'HOLD'} • ${Math.round(hr)} BPM`,
      pass: hrPass
    },
    {
      label: 'Arterial Oxygenation (SpO2 ≥ 96%)',
      status: spo2 === null ? 'NO SIG' : `${spo2Pass ? 'PASS' : 'HOLD'} • ${Math.round(spo2)}%`,
      pass: spo2Pass
    },
    {
      label: 'Core Temperature Stability (< 37.5°C)',
      status: temp === null ? 'NO SIG' : `${tempPass ? 'PASS' : 'HOLD'} • ${temp.toFixed(1)}°C`,
      pass: tempPass
    },
    {
      label: '7-Day ARED Loading Compliance (≥ 85%)',
      status: 'PASS • 96%',
      pass: true
    }
  ];

  const allGatesPass = hrPass && spo2Pass && tempPass;

  return (
    <div className="flex-1 w-full flex flex-col lg:flex-row">
      {/* LEFT PANE: FLIGHT READINESS GAUGE & PRE-EVA CLEARANCE */}
      <aside className="lg:w-[39%] xl:w-[37%] p-4 sm:p-5 lg:p-6 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#050C1B]/72 flex flex-col justify-between gap-4">
        <div className="space-y-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.18em] text-sky-400">
              PHYSIOLOGICAL READINESS INDEX · SIMULATED
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
              Flight &amp; EVA Clearance
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Dynamic composite score combining simulated biotelemetry and crew self-report.
            </p>
          </div>

          {/* Readiness Ring Card + Crew Portrait */}
          <div className="ag-card-3d ag-surface-primary p-4 sm:p-5 rounded-2xl flex flex-wrap sm:flex-nowrap items-center gap-4">
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="rgba(148,163,184,0.12)"
                  strokeWidth="9"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={readinessScore >= 85 && allGatesPass ? '#10B981' : '#F59E0B'}
                  strokeWidth="9"
                  strokeDasharray={`${(readinessScore / 100) * 264} 264`}
                  strokeLinecap="round"
                  style={{
                    filter:
                      readinessScore >= 85 && allGatesPass
                        ? 'drop-shadow(0 0 6px rgba(16,185,129,0.5))'
                        : 'drop-shadow(0 0 6px rgba(245,158,11,0.5))'
                  }}
                />
              </svg>
              <div className="absolute text-center">
                <div className="text-2xl font-mono font-bold text-white tabular-nums">
                  {readinessScore}
                </div>
                <div className="text-[11px] font-mono text-slate-400">INDEX</div>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-3">
                <AstronautPortrait
                  crewId={crewProfile.id}
                  name={crewProfile.name}
                  portraitUrl={crewProfile.portraitUrl}
                  rank={crewProfile.rank}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="text-xs font-mono text-sky-400">
                    {crewProfile.id} · {crewProfile.designationCode}
                  </div>
                  <h3 className="font-display text-base font-semibold text-white truncate">
                    {crewProfile.name}
                  </h3>
                </div>
              </div>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold ${
                  readinessScore >= 85 && allGatesPass
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                {readinessScore >= 85 && allGatesPass
                  ? 'CLEARED FOR FULL OPS'
                  : 'FLIGHT SURGEON REVIEW'}
              </span>
              <p className="text-sm text-slate-400">
                Automated cardiovascular, vestibular, and hydration thresholds evaluated.
              </p>
            </div>
          </div>

          {/* Automated Pre-EVA Checklist */}
          <div className="p-4 sm:p-5 rounded-2xl ag-surface-primary space-y-2.5">
            <h3 className="text-sm font-semibold text-white">
              Automated Telemetry Clearance Gates
            </h3>
            {gates.map((gate, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 text-sm py-2 border-b border-white/10 last:border-none"
              >
                <span className="text-slate-300">{gate.label}</span>
                <span
                  className={`font-mono tabular-nums whitespace-nowrap shrink-0 ${
                    gate.pass ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {gate.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400">
          PROTOCOL: JSC-MED-OPS-402 · SIMULATED DATA
        </div>
      </aside>

      {/* RIGHT PANE: INTERACTIVE CREW PHYSIOLOGICAL CHECK-IN */}
      <section className="lg:w-[61%] xl:w-[63%] p-4 sm:p-5 lg:p-6 space-y-4 bg-[#030712]/42">
        <div className="pb-3 border-b border-white/10">
          <h2 className="font-display text-xl font-semibold text-white">
            Daily Crew Physiological Self-Assessment
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Adjust subjective orbital wellness metrics to dynamically recalculate flight readiness
          </p>
        </div>

        <div className="space-y-3.5">
          {SLIDER_FIELDS.map((field) => (
            <div
              key={field.key}
              className="ag-card-3d ag-surface-primary p-3.5 sm:p-4 rounded-2xl space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-white">{field.label}</div>
                  <div className="text-xs text-slate-400">{field.desc}</div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#105BD8]/20 border border-[#38BDF8]/40 font-mono text-sm font-bold text-sky-300 tabular-nums shrink-0">
                  {inputs[field.key]} / 10
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={inputs[field.key]}
                onChange={(e) => onUpdateInput(field.key, Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>
          ))}

          <div className="p-3.5 sm:p-4 rounded-2xl ag-surface-primary space-y-2">
            <label
              htmlFor="crew-flight-note"
              className="block text-xs font-mono uppercase text-slate-400"
            >
              Crew Subjective Flight Note
            </label>
            <textarea
              id="crew-flight-note"
              rows={2}
              value={inputs.notes}
              onChange={(e) => onUpdateInput('notes', e.target.value)}
              className="w-full rounded-xl ag-surface-inset px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            {submitted ? (
              <div className="flex items-center gap-2 text-sm font-mono text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>CHECK-IN TRANSMITTED TO FLIGHT SURGEON CONSOLE (SIMULATED)</span>
              </div>
            ) : (
              <span className="text-sm text-slate-400">
                Updates sync immediately with Mission Overview readiness.
              </span>
            )}

            <button
              type="button"
              onClick={onSubmit}
              className="ag-nav-3d px-5 py-2.5 rounded-xl bg-[#105BD8] hover:bg-[#196BF2] text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Log Daily Assessment
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
