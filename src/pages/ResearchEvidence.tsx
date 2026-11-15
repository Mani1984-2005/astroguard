import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ResearchEvidenceItem } from '../types/astroguard';

interface ResearchEvidenceProps {
  items: ResearchEvidenceItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ResearchEvidence({
  items,
  selectedId,
  onSelect
}: ResearchEvidenceProps) {
  const activeBrief = items.find((r) => r.id === selectedId) || items[0];

  return (
    <div className="flex-1 w-full flex flex-col lg:flex-row">
      {/* LEFT PANE: PHYSIOLOGICAL ADAPTATION CATEGORIES */}
      <aside className="lg:w-[37%] xl:w-[35%] p-4 sm:p-5 lg:p-6 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#050C1B]/72 space-y-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-[0.18em] text-sky-400">
            AEROSPACE MEDICINE EVIDENCE INDEX
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
            Research & Evidence Context
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Contextual human spaceflight research summaries. AstroGuard telemetry thresholds are
            prototype demonstration rules, not clinical guidelines or a formal evidence review.
          </p>
        </div>

        <div className="space-y-2.5">
          {items.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`ag-card-3d w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-[#105BD8]/25 border-[#38BDF8]/65 text-white'
                    : 'ag-surface-primary text-slate-300 hover:border-sky-400/35'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono text-sky-400 mb-1">
                  <span>{item.category.toUpperCase()}</span>
                  <span>{item.code}</span>
                </div>
                <div className="text-sm font-semibold text-white">{item.title}</div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* RIGHT PANE: STRUCTURED EVIDENCE BRIEF */}
      <section className="lg:w-[63%] xl:w-[65%] p-4 sm:p-5 lg:p-6 bg-[#030712]/42">
        <div className="p-5 sm:p-6 rounded-2xl ag-surface-primary space-y-5">
          <div className="space-y-2 pb-4 border-b border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono text-sky-300">
                {activeBrief.code} · {activeBrief.category}
              </span>
              <span className="text-xs font-mono text-emerald-400">
                {activeBrief.evidenceGrade}
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white pt-0.5">
              {activeBrief.title}
            </h2>
            <p className="text-xs font-mono text-slate-400">{activeBrief.source}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-sky-400">
              Pathophysiological Mechanism
            </h3>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              {activeBrief.summary}
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-sky-400">
              Contextual Countermeasure Considerations
            </h3>
            <div className="space-y-2.5">
              {activeBrief.implications.map((imp, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-xl ag-surface-inset text-sm text-slate-300"
                >
                  <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                  <span>{imp}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Program-level topic references only. No article-level citation, DOI, NASA endorsement,
            clinical validation, or formal evidence grade is asserted. Confirm current NASA
            standards before operational use.
          </p>
        </div>
      </section>
    </div>
  );
}
