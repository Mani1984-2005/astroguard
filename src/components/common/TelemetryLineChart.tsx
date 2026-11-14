import React, { useId, useState } from 'react';

interface TelemetryLineChartProps {
  labels: string[];
  values: number[];
  unit: string;
  color?: string;
  minVal?: number;
  maxVal?: number;
}

export function TelemetryLineChart({
  labels,
  values,
  unit,
  color = '#38BDF8',
  minVal,
  maxVal
}: TelemetryLineChartProps) {
  const reactId = useId();
  const safeId = reactId.replace(/:/g, '');
  const gradientId = `grad-${unit.replace(/[^a-zA-Z0-9]/g, '')}-${safeId}`;
  const glowId = `glow-${unit.replace(/[^a-zA-Z0-9]/g, '')}-${safeId}`;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (values.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs font-mono text-slate-400">
        No telemetry samples in window.
      </div>
    );
  }

  const width = 540;
  const height = 176;
  const padLeft = 42;
  const padRight = 22;
  const padTop = 26;
  const padBottom = 26;

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const computedMin = Math.floor(minVal !== undefined ? Math.min(minVal, dataMin - 3) : dataMin - 4);
  const computedMax = Math.ceil(maxVal !== undefined ? Math.max(maxVal, dataMax + 5) : dataMax + 4);
  const range = Math.max(computedMax - computedMin, 1);

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const points = values.map((val, idx) => {
    const x =
      values.length === 1
        ? padLeft + plotWidth / 2
        : padLeft + (idx / (values.length - 1)) * plotWidth;
    const y = padTop + plotHeight - ((val - computedMin) / range) * plotHeight;
    return { x, y, val, label: labels[idx] ?? '' };
  });

  const pathD = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${padTop + plotHeight} L ${points[0].x.toFixed(1)} ${padTop + plotHeight} Z`;

  const activePoint =
    hoveredIdx !== null && points[hoveredIdx]
      ? points[hoveredIdx]
      : points[points.length - 1];

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let closestIdx = 0;
    let minDist = Infinity;
    points.forEach((pt, idx) => {
      const dist = Math.abs(pt.x - relX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });
    setHoveredIdx(closestIdx);
  };

  const yTicks = [
    { frac: 0, val: computedMax },
    { frac: 0.5, val: Math.round((computedMax + computedMin) / 2) },
    { frac: 1, val: computedMin }
  ];

  // Show at most ~6 evenly spaced X-axis labels so text never collides
  const labelStride = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredIdx(null)}
        role="img"
        aria-label={`Telemetry chart in ${unit}`}
        className="w-full h-48 sm:h-52 overflow-visible cursor-crosshair"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.26" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
          <filter id={glowId} x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal reference lines + Y-axis scale labels */}
        {yTicks.map((tick, idx) => {
          const y = padTop + tick.frac * plotHeight;
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="rgba(148, 163, 184, 0.12)"
                strokeDasharray="3 4"
              />
              <text
                x={padLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-mono tabular-nums"
              >
                {tick.val}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill={`url(#${gradientId})`} />

        {/* Glowing Line trace */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
        />

        {/* Active / hovered vertical crosshair guide */}
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={padTop}
            x2={activePoint.x}
            y2={padTop + plotHeight}
            stroke={color}
            strokeOpacity="0.35"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* Data nodes */}
        {points.map((pt, idx) => {
          const isActive =
            hoveredIdx !== null ? idx === hoveredIdx : idx === points.length - 1;
          const showXLabel =
            idx === 0 || idx === points.length - 1 || idx % labelStride === 0;

          return (
            <g key={idx}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isActive ? 5 : 2.8}
                fill={isActive ? color : '#030712'}
                stroke={color}
                strokeWidth={isActive ? 2 : 1.75}
              />
              {isActive && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="9"
                  fill="none"
                  stroke={color}
                  strokeOpacity="0.35"
                  strokeWidth="1.5"
                />
              )}
              {showXLabel && (
                <text
                  x={pt.x}
                  y={height - 6}
                  textAnchor="middle"
                  className={`text-[10px] font-mono ${
                    isActive ? 'fill-sky-300 font-semibold' : 'fill-slate-400'
                  }`}
                >
                  {pt.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Precision Readout Pill for Hovered or Latest Point */}
        {activePoint && (
          <g
            transform={`translate(${Math.min(
              Math.max(activePoint.x, padLeft + 46),
              width - padRight - 46
            )}, ${Math.max(activePoint.y - 16, 12)})`}
          >
            <rect
              x="-44"
              y="-11"
              width="88"
              height="20"
              rx="6"
              fill="#030712"
              fillOpacity="0.92"
              stroke={color}
              strokeOpacity="0.55"
              strokeWidth="1"
            />
            <text
              x="0"
              y="2.5"
              textAnchor="middle"
              className="fill-white text-[11px] font-mono font-semibold tabular-nums"
            >
              {activePoint.val} {unit}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
