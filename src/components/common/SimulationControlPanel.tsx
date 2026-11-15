import React from 'react';
import { FlaskConical } from 'lucide-react';
import { SIMULATION_SCENARIOS } from '../../engine/healthEvaluationEngine';
import { SimulationScenarioId } from '../../types/astroguard';

interface SimulationControlPanelProps {
  activeScenario: SimulationScenarioId;
  onSelectScenario: (scenario: SimulationScenarioId) => void;
}

const SCENARIO_BUTTON_STYLES: Record<
  SimulationScenarioId,
  { active: string; idle: string }
> = {
  SAFE: {
    active: 'bg-emerald-500/20 border-emerald-400 text-emerald-200',
    idle: 'bg-[#050B16] border-white/10 text-slate-300 hover:border-emerald-500/40'
  },
  CAUTION: {
    active: 'bg-amber-500/20 border-amber-400 text-amber-200',
    idle: 'bg-[#050B16] border-white/10 text-slate-300 hover:border-amber-400/40'
  },
  DANGER: {
    active: 'bg-red-500/25 border-red-500 text-red-200',
    idle: 'bg-[#050B16] border-white/10 text-slate-300 hover:border-red-500/40'
  },
  MISSING_SENSOR: {
    active: 'bg-sky-500/20 border-sky-400 text-sky-200',
    idle: 'bg-[#050B16] border-white/10 text-slate-300 hover:border-sky-400/40'
  }
};

export function SimulationControlPanel({
  activeScenario,
  onSelectScenario
}: SimulationControlPanelProps) {
  const currentPreset = SIMULATION_SCENARIOS[activeScenario];

  return (
    <div className="rounded-xl ag-surface-primary p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-sky-400 shrink-0" />
          <span className="text-xs font-mono uppercase tracking-wider text-sky-300 font-semibold">
            Demo / Simulation Control
          </span>
        </div>
        <span className="text-xs font-mono uppercase text-slate-400">
          Simulated Scenarios
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(SIMULATION_SCENARIOS) as SimulationScenarioId[]).map((id) => {
          const preset = SIMULATION_SCENARIOS[id];
          const isSelected = activeScenario === id;
          const style = SCENARIO_BUTTON_STYLES[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectScenario(id)}
              aria-pressed={isSelected}
              className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                isSelected ? style.active : style.idle
              }`}
            >
              <div className="text-xs font-mono opacity-85">{preset.badge}</div>
              <div className="text-sm font-semibold leading-snug">{preset.label}</div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        <span className="font-mono text-slate-300">Active Scenario:</span>{' '}
        {currentPreset.description}
      </p>
    </div>
  );
}
