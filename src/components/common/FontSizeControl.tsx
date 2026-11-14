import React from 'react';
import { Type } from 'lucide-react';
import { FontSizePreset } from '../../types/astroguard';

interface FontSizeControlProps {
  value: FontSizePreset;
  onChange: (preset: FontSizePreset) => void;
  compact?: boolean;
}

const FONT_SIZE_OPTIONS: Array<{
  id: FontSizePreset;
  shortLabel: string;
  label: string;
}> = [
  { id: 'compact', shortLabel: 'S', label: 'Small' },
  { id: 'standard', shortLabel: 'M', label: 'Medium' },
  { id: 'large', shortLabel: 'L', label: 'Large' }
];

export function FontSizeControl({
  value,
  onChange,
  compact = false
}: FontSizeControlProps) {
  const nextPreset = (): FontSizePreset => {
    if (value === 'compact') return 'standard';
    if (value === 'standard') return 'large';
    return 'compact';
  };

  if (compact) {
    const activeOption = FONT_SIZE_OPTIONS.find((o) => o.id === value) ?? FONT_SIZE_OPTIONS[1];
    return (
      <button
        type="button"
        onClick={() => onChange(nextPreset())}
        title={`Font size: ${activeOption.label} (click to cycle)`}
        aria-label={`Cycle font size (currently ${activeOption.label})`}
        className="w-full flex items-center justify-center p-2.5 rounded-xl ag-surface-inset hover:border-sky-400/35 text-sky-300 hover:text-white transition-colors"
      >
        <Type className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Interface font size"
      className="flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl ag-surface-inset"
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 whitespace-nowrap">
        <Type className="w-4 h-4 text-sky-400 shrink-0" />
        <span>Size</span>
      </span>

      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#030712]/80 border border-white/10">
        {FONT_SIZE_OPTIONS.map((opt) => {
          const isActive = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              aria-pressed={isActive}
              title={`${opt.label} font size`}
              className={`px-2 py-0.5 rounded-md text-xs font-mono font-semibold transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#105BD8] text-white shadow-sm shadow-[#105BD8]/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {opt.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
