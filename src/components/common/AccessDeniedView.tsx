import React from 'react';
import { ArrowLeft, Lock, ShieldAlert } from 'lucide-react';

interface AccessDeniedViewProps {
  title: string;
  reason: string;
  attemptedTarget: string;
  onReturnHome: () => void;
}

export function AccessDeniedView({
  title,
  reason,
  attemptedTarget,
  onReturnHome
}: AccessDeniedViewProps) {
  return (
    <div className="flex-1 w-full bg-[#030712]/50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-[#14070B]/92 border border-red-500/60 p-6 sm:p-7 space-y-5 shadow-[0_24px_64px_rgba(0,0,0,0.75)]">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/60 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-7 h-7 text-red-400" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-mono uppercase tracking-widest text-red-300">
              HTTP 403 · BACKEND AUTHORIZATION DENIED
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
          </div>
        </div>

        <p className="text-sm text-slate-200 leading-relaxed">{reason}</p>

        <div className="p-3.5 rounded-xl bg-[#030712]/80 border border-red-500/30 font-mono text-xs text-slate-300 flex items-center gap-2.5">
          <Lock className="w-[18px] h-[18px] text-red-400 shrink-0" />
          <span className="truncate">Rejected target: {attemptedTarget}</span>
        </div>

        <button
          type="button"
          onClick={onReturnHome}
          className="ag-nav-3d px-4 py-2.5 rounded-xl bg-[#105BD8] hover:bg-[#196BF2] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Return to Authorized Dashboard</span>
        </button>
      </div>
    </div>
  );
}
