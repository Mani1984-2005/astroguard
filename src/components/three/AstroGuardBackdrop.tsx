import React, { Component, Suspense, useEffect, useState } from 'react';
import { HealthStatusLevel } from '../../types/astroguard';
import { probeWebGLCapabilities } from './webglUtils';

const LazyOrbitalBackgroundCanvas = React.lazy(() => import('./OrbitalBackgroundCanvas'));

interface AstroGuardBackdropProps {
  variant: 'portal' | 'workspace';
  accentStatus?: HealthStatusLevel;
}

class WebGLErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function StaticOrbitalFallback({
  variant
}: {
  variant: 'portal' | 'workspace';
  accentStatus?: HealthStatusLevel;
}) {
  const isPortal = variant === 'portal';

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Full-screen Earth Background Image covering 100vw and 100vh */}
      <img
        src="/assets/aistudio/image_9ab40c53.png"
        alt="Earth and Satellite from Space"
        className={`absolute inset-0 w-[100vw] h-[100vh] object-cover object-center ${
          isPortal ? 'opacity-95' : 'opacity-45'
        }`}
        style={{ width: '100vw', height: '100vh', objectFit: 'cover', objectPosition: 'center center' }}
      />
    </div>
  );
}

/**
 * Unified 100%-viewport AstroGuard backdrop featuring deep-space black (#030712),
 * midnight navy (#071426), fine technical coordinate grid, and the lazy-loaded
 * React Three Fiber <Canvas> with the 3D depth-mapped space motion view and orbiting satellites.
 */
export function AstroGuardBackdrop({
  variant,
  accentStatus = 'SAFE'
}: AstroGuardBackdropProps) {
  const [webglOk, setWebglOk] = useState<boolean>(false);

  useEffect(() => {
    const { webglAvailable } = probeWebGLCapabilities();
    setWebglOk(webglAvailable);
  }, []);

  const fallback = <StaticOrbitalFallback variant={variant} accentStatus={accentStatus} />;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 w-screen h-screen overflow-hidden bg-[#030712]"
    >
      {/* Subtle Deep-Space Nebular & Atmospheric Gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            variant === 'portal'
              ? 'radial-gradient(circle at 30% 48%, rgba(12,34,68,0.82) 0%, rgba(4,10,24,0.94) 58%, #030712 100%), radial-gradient(circle at 82% 20%, rgba(56,189,248,0.1) 0%, transparent 44%), radial-gradient(circle at 18% 82%, rgba(99,102,241,0.08) 0%, transparent 42%)'
              : 'radial-gradient(circle at 22% 18%, rgba(16,91,216,0.22) 0%, transparent 46%), radial-gradient(circle at 82% 78%, rgba(14,165,233,0.14) 0%, transparent 48%), radial-gradient(circle at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 40%)'
        }}
      />

      {/* Fine Aerospace Coordinate Grid Overlay */}
      <div
        className="absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(56,189,248,0.028) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.028) 1px, transparent 1px)',
          backgroundSize: '56px 56px'
        }}
      />

      {/* 3D Orbital WebGL Viewport (or Graceful 2D Motion Fallback) */}
      <div className="absolute inset-0">
        {webglOk ? (
          <WebGLErrorBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
              <LazyOrbitalBackgroundCanvas
                variant={variant}
                accentStatus={accentStatus}
                onWebGLUnavailable={() => setWebglOk(false)}
              />
            </Suspense>
          </WebGLErrorBoundary>
        ) : (
          fallback
        )}
      </div>

      {/* Measured Edge Scrim preserving >= 4.5:1 foreground typography contrast */}
      <div
        className="absolute inset-0"
        style={{
          background:
            variant === 'portal'
              ? 'linear-gradient(90deg, rgba(3,7,18,0.02) 0%, rgba(3,7,18,0.12) 52%, rgba(3,7,18,0.68) 100%)'
              : 'radial-gradient(circle at 65% 54%, rgba(3,7,18,0.16) 0%, rgba(5,11,22,0.58) 68%, rgba(3,7,18,0.78) 100%)'
        }}
      />
    </div>
  );
}
