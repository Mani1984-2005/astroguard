import React, { useEffect, useRef } from 'react';
import { HealthStatusLevel } from '../../types/astroguard';

interface LiveEcgMonitorProps {
  bpm?: number | null;
  status?: HealthStatusLevel;
}

interface EcgPalette {
  gridColor: string;
  tailColor: string;
  midColor: string;
  leadColor: string;
  dotColor: string;
  dotGlow: string;
  glowRgba: string;
  borderClass: string;
  badgeTextClass: string;
  statusText: string;
}

const ECG_PALETTES: Record<HealthStatusLevel, EcgPalette> = {
  SAFE: {
    gridColor: 'rgba(16, 185, 129, 0.07)',
    tailColor: 'rgba(16, 185, 129, 0.12)',
    midColor: 'rgba(52, 211, 153, 0.92)',
    leadColor: '#6EE7B7',
    dotColor: '#22C55E',
    dotGlow: 'rgba(34, 197, 94, 0.3)',
    glowRgba: 'rgba(16, 185, 129, 0.16)',
    borderClass: 'border-emerald-500/35 shadow-[0_0_20px_rgba(16,185,129,0.1)]',
    badgeTextClass: 'text-emerald-400',
    statusText: 'ALL SYSTEMS NORMAL'
  },
  CAUTION: {
    gridColor: 'rgba(234, 179, 8, 0.08)',
    tailColor: 'rgba(234, 179, 8, 0.14)',
    midColor: 'rgba(250, 204, 21, 0.94)',
    leadColor: '#FEF08A',
    dotColor: '#FACC15',
    dotGlow: 'rgba(250, 204, 21, 0.34)',
    glowRgba: 'rgba(234, 179, 8, 0.2)',
    borderClass: 'border-amber-400/45 shadow-[0_0_22px_rgba(234,179,8,0.14)]',
    badgeTextClass: 'text-amber-300',
    statusText: 'CAUTION — MONITOR YOUR HEALTH'
  },
  DANGER: {
    gridColor: 'rgba(239, 68, 68, 0.1)',
    tailColor: 'rgba(239, 68, 68, 0.16)',
    midColor: 'rgba(248, 113, 113, 0.96)',
    leadColor: '#FECACA',
    dotColor: '#EF4444',
    dotGlow: 'rgba(239, 68, 68, 0.42)',
    glowRgba: 'rgba(239, 68, 68, 0.28)',
    borderClass: 'border-red-500/65 shadow-[0_0_28px_rgba(239,68,68,0.22)]',
    badgeTextClass: 'text-red-400',
    statusText: 'DANGER — IMMEDIATE ATTENTION REQUIRED'
  }
};

export function LiveEcgMonitor({ bpm = 68, status = 'SAFE' }: LiveEcgMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bpmRef = useRef<number | null>(bpm);
  const statusRef = useRef<HealthStatusLevel>(status);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let phase = 0;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    const getEcgAmplitude = (t: number): number => {
      const cycle = t % 1;
      if (cycle > 0.12 && cycle < 0.22) {
        return -0.14 * Math.sin(((cycle - 0.12) / 0.1) * Math.PI);
      }
      if (cycle >= 0.28 && cycle < 0.31) {
        return 0.16 * Math.sin(((cycle - 0.28) / 0.03) * Math.PI);
      }
      if (cycle >= 0.31 && cycle < 0.35) {
        return -0.92 * Math.sin(((cycle - 0.31) / 0.04) * Math.PI);
      }
      if (cycle >= 0.35 && cycle < 0.39) {
        return 0.28 * Math.sin(((cycle - 0.35) / 0.04) * Math.PI);
      }
      if (cycle >= 0.48 && cycle < 0.64) {
        return -0.24 * Math.sin(((cycle - 0.48) / 0.16) * Math.PI);
      }
      return 0;
    };

    let lastTime = performance.now();

    const drawFrame = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      const palette = ECG_PALETTES[statusRef.current];
      const activeBpm = bpmRef.current;

      ctx.clearRect(0, 0, width, height);

      // Subtle clinical grid lines
      ctx.strokeStyle = palette.gridColor;
      ctx.lineWidth = 1;
      const gridStep = 26;
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

      const midY = height * 0.56;

      // Sensor dropout baseline if HR is unavailable
      if (activeBpm === null || activeBpm === undefined || Number.isNaN(activeBpm)) {
        ctx.save();
        ctx.strokeStyle = palette.midColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();
        ctx.restore();

        if (!prefersReducedMotion) {
          animationFrameId = requestAnimationFrame(drawFrame);
        }
        return;
      }

      const beatsPerSecond = activeBpm / 60;
      if (!prefersReducedMotion) {
        phase += dt * beatsPerSecond;
      }

      const scaleY = height * 0.4;
      const cyclesVisible = 3.4;

      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, palette.tailColor);
      gradient.addColorStop(0.65, palette.midColor);
      gradient.addColorStop(0.95, palette.leadColor);
      gradient.addColorStop(1, palette.dotColor);

      ctx.save();
      ctx.shadowColor = palette.glowRgba;
      ctx.shadowBlur = statusRef.current === 'DANGER' ? 12 : 7;
      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2.4;
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
      ctx.restore();

      // Leading pulse dot
      const leadT = ((phase % 1) + 1) % 1;
      const leadY = midY + getEcgAmplitude(leadT) * scaleY;
      ctx.beginPath();
      ctx.fillStyle = palette.dotColor;
      ctx.arc(width - 4, leadY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = palette.dotGlow;
      ctx.arc(width - 4, leadY, 8, 0, Math.PI * 2);
      ctx.fill();

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(drawFrame);
      }
    };

    animationFrameId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const palette = ECG_PALETTES[status];

  return (
    <div className="space-y-2.5">
      <div
        className={`relative w-full h-48 sm:h-56 lg:h-60 rounded-xl bg-[#030712] border overflow-hidden transition-all duration-500 ${palette.borderClass}`}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Top-left simulated lead metadata */}
        <div className="absolute top-3 left-4 flex items-center gap-2 text-xs font-mono text-slate-300">
          <span
            aria-hidden="true"
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor: palette.dotColor,
              boxShadow: `0 0 8px ${palette.dotColor}`
            }}
          />
          <span>
            {bpm === null
              ? 'LEAD II · NO SENSOR SIGNAL'
              : 'SIMULATED ECG · LEAD II · 25 mm/s'}
          </span>
        </div>

        {/* Top-right integrated simulated BPM readout */}
        <div className="absolute top-2.5 right-4 flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">
            {bpm !== null ? Math.round(bpm) : '--'}
          </span>
          <span className={`text-xs font-mono font-semibold ${palette.badgeTextClass}`}>
            BPM
          </span>
        </div>
      </div>

      {/* Evaluation Label Directly Below ECG Waveform */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-mono">
        <span className={`font-semibold tracking-wider ${palette.badgeTextClass}`}>
          {palette.statusText}
        </span>
        <span className="text-xs text-slate-400">
          Simulated telemetry waveform · visual status representation
        </span>
      </div>
    </div>
  );
}
