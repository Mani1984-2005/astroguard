import React from 'react';

interface AstroGuardEmblemProps {
  size?: number;
}

export function AstroGuardEmblem({ size = 34 }: AstroGuardEmblemProps) {
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
