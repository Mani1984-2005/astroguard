import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Stethoscope,
  X
} from 'lucide-react';
import { HealthAlert, HealthHistoryRecord } from '../../types/astroguard';
import { getAstronautIdentity } from '../../data/astroguardData';
import { AstronautPortrait } from './AstronautPortrait';

interface EmergencyAlertModalProps {
  alert: HealthAlert;
  canAcknowledge: boolean;
  biometricHistory?: HealthHistoryRecord[];
  onAcknowledge: (alertId: string) => void;
  onOpenDetailedHealth: () => void;
  onClose?: () => void;
}

export function EmergencyAlertModal({
  alert,
  canAcknowledge,
  biometricHistory = [],
  onAcknowledge,
  onOpenDetailedHealth,
  onClose
}: EmergencyAlertModalProps) {
  const identity = getAstronautIdentity(alert.astronautId);
  const hasDistinctPreviousReading =
    Boolean(alert.previousReading) && alert.previousReading !== alert.currentReading;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="emergency-alert-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#02050D]/86 overflow-y-auto"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-gradient-to-b from-[#17090F] to-[#0A0812] border border-red-500/80 shadow-[0_24px_80px_rgba(239,68,68,0.28)] overflow-hidden my-auto">
        {/* Critical Header Strip */}
        <div className="px-4 sm:px-6 py-4 bg-red-600/16 border-b border-red-500/35 flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl bg-red-500/20 border border-red-400/60 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-mono uppercase tracking-[0.18em] text-red-300 truncate">
                SIMULATED CRITICAL EMERGENCY ALERT
              </div>
              <h2
                id="emergency-alert-title"
                className="font-display text-lg sm:text-2xl font-bold tracking-tight text-white leading-tight"
              >
                ASTRONAUT IN DANGER
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-mono font-bold tracking-wider uppercase whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden="true" />
              CRITICAL
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close emergency details"
                className="w-9 h-9 flex items-center justify-center rounded-lg ag-surface-inset text-slate-300 hover:text-white hover:border-white/25 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Alert Payload Details */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Affected Astronaut Identity + Portrait Card */}
          <div className="p-4 rounded-xl ag-surface-inset border-red-500/30 flex flex-wrap sm:flex-nowrap items-center gap-4">
            <AstronautPortrait
              crewId={alert.astronautId}
              name={alert.astronautName}
              status="DANGER"
              size="lg"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase text-sky-300">
                <span>{alert.astronautId}</span>
                {identity && <span className="text-slate-500">·</span>}
                {identity && <span>{identity.designationCode}</span>}
                {identity && <span className="text-slate-500">·</span>}
                {identity && <span className="text-slate-400">{identity.flightDay}</span>}
              </div>
              <div className="text-lg font-display font-bold text-white truncate">
                {alert.astronautName}
              </div>
              {identity && (
                <div className="text-xs text-slate-300">
                  {identity.rank} · {identity.missionRole} · {identity.missionIncrement}
                </div>
              )}
              {identity && (
                <div className="text-xs font-mono text-slate-400">
                  {identity.portraitAttribution}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl ag-surface-inset border-red-500/25">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                DETECTED CONDITION
              </div>
              <div className="text-sm font-semibold text-red-300 mt-1">
                {alert.parameterLabel}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5 tabular-nums">
                {alert.timestamp}
              </div>
            </div>

            <div className="p-3.5 rounded-xl ag-surface-inset border-red-500/25">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                CURRENT READING (SIMULATED)
              </div>
              <div className="text-xl font-mono font-bold text-red-400 mt-1 tabular-nums">
                {alert.currentReading}
              </div>
            </div>

            <div className="p-3.5 rounded-xl ag-surface-inset border-red-500/25">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                PREVIOUS READING
              </div>
              <div className="text-xl font-mono font-semibold text-slate-200 mt-1 tabular-nums">
                {hasDistinctPreviousReading ? alert.previousReading : 'Not available'}
              </div>
            </div>
          </div>

          {/* Affected Astronaut Biometric History Snippet */}
          {biometricHistory.length > 0 && (
            <div className="p-3.5 rounded-xl ag-surface-inset space-y-2">
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>RECENT BIOMETRIC HISTORY — {alert.astronautName}</span>
                </span>
                <span>{alert.astronautId}</span>
              </div>
              <div className="space-y-1.5">
                {biometricHistory.slice(0, 3).map((rec) => (
                  <div
                    key={rec.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs px-3 py-1.5 rounded-lg bg-[#081224]/80 border border-white/5"
                  >
                    <span className="font-mono text-slate-400 tabular-nums">{rec.date}</span>
                    <span className="text-slate-200 font-medium truncate">{rec.metric}</span>
                    <span className="font-mono text-sky-300 tabular-nums">{rec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dual Instructions: Astronaut & Medical Chief */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-red-950/35 border border-red-500/35 space-y-1.5">
              <div className="text-xs font-mono uppercase tracking-wider text-red-300 font-semibold">
                Astronaut Instructions
              </div>
              <p className="text-sm text-slate-100 leading-relaxed">
                Stop your current activity if appropriate and follow the assigned emergency
                countermeasure protocol. Contact the Medical Chief.
              </p>
              <p className="text-xs text-amber-200/95 pt-1">
                <strong>Protocol:</strong> {alert.associatedCountermeasure}
              </p>
            </div>

            <div className="p-4 rounded-xl ag-surface-primary space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-sky-300 font-semibold">
                <Stethoscope className="w-[18px] h-[18px]" />
                <span>Medical Chief Notification</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                CRITICAL ALERT RECEIVED — Review {alert.astronautName}&apos;s health indicators and
                initiate the appropriate response protocol.
              </p>
            </div>
          </div>

          {/* Non-Recovery Notice */}
          <p className="text-xs font-mono text-slate-400">
            Note: Acknowledging logs operator confirmation in Alert History and does not mark the
            astronaut as recovered while critical readings persist.
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onOpenDetailedHealth}
              className="ag-nav-3d px-4 py-2.5 rounded-xl ag-surface-inset hover:border-sky-400/40 text-slate-100 text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Activity className="w-[18px] h-[18px] text-sky-400" />
              <span>Open Detailed Health Monitoring</span>
            </button>

            {canAcknowledge && !alert.acknowledged && (
              <button
                type="button"
                onClick={() => onAcknowledge(alert.id)}
                className="ag-nav-3d px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-red-600/25 whitespace-nowrap"
              >
                <CheckCircle2 className="w-[18px] h-[18px]" />
                <span>Acknowledge Critical Alert</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface CriticalAlertDockProps {
  alert: HealthAlert;
  canAcknowledge: boolean;
  onReopenModal: () => void;
  onAcknowledge: (alertId: string) => void;
}

export function CriticalAlertDock({
  alert,
  canAcknowledge,
  onReopenModal,
  onAcknowledge
}: CriticalAlertDockProps) {
  return (
    <div
      role="alert"
      className="bg-gradient-to-r from-[#280912]/95 via-[#1C0810]/95 to-[#120810]/95 border-b border-red-500/65 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <AstronautPortrait
          crewId={alert.astronautId}
          name={alert.astronautName}
          status="DANGER"
          size="xs"
        />
        <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
        <div className="text-xs min-w-0">
          <span className="font-mono font-bold text-red-300 uppercase mr-2">
            UNACKNOWLEDGED CRITICAL:
          </span>
          <span className="text-white font-semibold">{alert.astronautName}</span>
          <span className="text-slate-300 tabular-nums">
            {' '}
            — {alert.parameterLabel} ({alert.currentReading}) · {alert.timestamp}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onReopenModal}
          className="px-3 py-1.5 rounded-lg bg-[#050B16]/85 hover:bg-white/10 border border-red-400/40 text-red-200 text-xs font-medium transition-colors whitespace-nowrap"
        >
          View Emergency Details
        </button>
        {canAcknowledge && (
          <button
            type="button"
            onClick={() => onAcknowledge(alert.id)}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}

