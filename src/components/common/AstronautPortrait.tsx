import React, { useEffect, useState } from 'react';
import { Award, ShieldAlert, User } from 'lucide-react';
import { getAstronautIdentity } from '../../data/astroguardData';
import { HealthStatusLevel } from '../../types/astroguard';

export type PortraitSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

interface AstronautPortraitProps {
  crewId: string;
  name?: string;
  portraitUrl?: string | null;
  fallbackUrl?: string | null;
  attribution?: string;
  rank?: string;
  status?: HealthStatusLevel | 'Nominal' | 'Watch' | 'Critical';
  isHistorical?: boolean;
  size?: PortraitSize;
  roundedClass?: string;
  className?: string;
  imgClassName?: string;
}

const SIZE_CLASSES: Record<PortraitSize, string> = {
  xs: 'w-8 h-8 rounded-lg text-xs',
  sm: 'w-10 h-10 rounded-xl text-xs',
  md: 'w-14 h-14 rounded-xl text-sm',
  lg: 'w-20 h-20 rounded-2xl text-base',
  xl: 'w-24 h-24 rounded-2xl text-lg',
  hero: 'w-full h-full rounded-none text-2xl'
};

function getInitials(name: string): string {
  const parts = name
    .replace(/^(Cmdr\.|Dr\.|Maj\.|Col\.|Capt\.)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'AG';
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

function getBorderTone(status?: AstronautPortraitProps['status']): string {
  if (status === 'DANGER' || status === 'Critical') {
    return 'border-red-500/75 ring-2 ring-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.22)]';
  }
  if (status === 'CAUTION' || status === 'Watch') {
    return 'border-amber-400/65 ring-2 ring-amber-400/20 shadow-[0_0_16px_rgba(245,158,11,0.16)]';
  }
  if (status === 'SAFE' || status === 'Nominal') {
    return 'border-emerald-400/45 ring-1 ring-emerald-400/15';
  }
  return 'border-sky-400/25';
}

export function AstronautPortrait({
  crewId,
  name,
  portraitUrl,
  fallbackUrl,
  attribution,
  rank,
  status,
  isHistorical,
  size = 'md',
  roundedClass,
  className = '',
  imgClassName = ''
}: AstronautPortraitProps) {
  const registry = getAstronautIdentity(crewId);

  const resolvedName = name || registry?.fullName || crewId;
  const resolvedPrimaryUrl = portraitUrl !== undefined ? portraitUrl : registry?.portraitUrl ?? '';
  const resolvedFallbackUrl =
    fallbackUrl !== undefined ? fallbackUrl : registry?.portraitFallbackUrl ?? '';
  const resolvedIsHistorical =
    isHistorical !== undefined ? isHistorical : Boolean(registry?.isHistorical);
  const resolvedAttribution = attribution || registry?.portraitAttribution || '';
  const resolvedTone =
    registry?.avatarTone || 'from-sky-500/20 via-[#105BD8]/30 to-slate-950/90 border-white/15';
  const resolvedCode = registry?.designationCode || crewId;

  const [loadStage, setLoadStage] = useState<0 | 1 | 2>(0);

  // Reset image load state immediately whenever astronaut ID or URL changes
  useEffect(() => {
    setLoadStage(0);
  }, [crewId, resolvedPrimaryUrl, resolvedFallbackUrl]);

  const activeSrc =
    loadStage === 0
      ? resolvedPrimaryUrl
      : loadStage === 1 && resolvedFallbackUrl
        ? resolvedFallbackUrl
        : '';

  const showFallbackAvatar = !activeSrc || loadStage >= 2;
  const initials = getInitials(resolvedName);
  const borderClass = size === 'hero' ? '' : getBorderTone(status);
  const shapeClass = roundedClass || SIZE_CLASSES[size];

  const handleImgError = () => {
    // Only retry fallbackUrl if one was explicitly configured for THAT same astronaut (never another astronaut)
    if (loadStage === 0 && resolvedFallbackUrl && resolvedFallbackUrl !== resolvedPrimaryUrl) {
      setLoadStage(1);
    } else {
      setLoadStage(2);
    }
  };

  return (
    <div
      data-testid={`astronaut-portrait-${crewId}`}
      data-crew-id={crewId}
      data-portrait-status={showFallbackAvatar ? 'fallback' : 'loaded'}
      className={`relative overflow-hidden shrink-0 bg-[#050C1B] ${
        size === 'hero' ? '' : `border ${borderClass}`
      } ${shapeClass} ${className}`}
    >
      {!showFallbackAvatar ? (
        <>
          <img
            key={`${crewId}:${activeSrc}`}
            src={activeSrc}
            referrerPolicy="no-referrer"
            onError={handleImgError}
            alt={`${resolvedName} (${crewId}) — ${
              resolvedIsHistorical ? 'NASA Historical Archival Portrait' : 'AstroGuard Crew Portrait'
            }`}
            className={`w-full h-full object-cover object-top block ${imgClassName}`}
          />
          {size !== 'hero' && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
            />
          )}
        </>
      ) : (
        <div
          role="img"
          aria-label={`${resolvedName} (${crewId}) fallback aerospace avatar`}
          className={`w-full h-full bg-gradient-to-br ${resolvedTone} flex flex-col items-center justify-center p-2 text-center select-none`}
        >
          {size === 'hero' ? (
            <div className="space-y-3 max-w-xs">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-[#050B16]/80 border border-sky-400/35 flex items-center justify-center">
                {resolvedIsHistorical ? (
                  <Award className="w-9 h-9 text-sky-400" />
                ) : status === 'DANGER' || status === 'Critical' ? (
                  <ShieldAlert className="w-9 h-9 text-red-400" />
                ) : (
                  <span className="text-2xl font-bold font-mono tracking-wider text-white">
                    {initials}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-xs font-mono uppercase tracking-widest text-sky-300">
                  {crewId} · {resolvedCode}
                </div>
                <div className="text-base font-bold text-white">{resolvedName}</div>
                {rank && <div className="text-xs text-slate-300">{rank}</div>}
                <div className="text-xs font-mono text-amber-300/90 pt-1">
                  PORTRAIT ASSET UNAVAILABLE — FALLBACK AVATAR ACTIVE
                </div>
                {resolvedAttribution && (
                  <div className="text-xs font-mono text-slate-400">{resolvedAttribution}</div>
                )}
              </div>
            </div>
          ) : (
            <>
              {size === 'xs' ? (
                <User className="w-4 h-4 text-sky-300" />
              ) : (
                <>
                  <span className="font-bold font-mono tracking-wider text-white leading-none">
                    {initials}
                  </span>
                  {(size === 'lg' || size === 'xl' || size === 'md') && (
                    <span className="text-xs font-mono uppercase tracking-wider text-sky-200/80 mt-1 truncate max-w-full px-1">
                      {resolvedCode}
                    </span>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
