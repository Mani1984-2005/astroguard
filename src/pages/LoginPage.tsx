import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  Home,
  Lock,
  LogOut,
  Mail,
  Radio,
  RefreshCw,
  Satellite,
  Shield,
  ShieldAlert,
  Stethoscope,
  UserCheck
} from 'lucide-react';
import { AstroGuardEmblem } from '../components/common/AstroGuardEmblem';
import { AstronautPortrait } from '../components/common/AstronautPortrait';
import { FontSizeControl } from '../components/common/FontSizeControl';
import {
  CrewSelectionProfile,
  FontSizePreset,
  UserProfile
} from '../types/astroguard';

export type LoginPortalChoice = 'ASTRONAUT' | 'MEDICAL_CHIEF';
export type LoginScreenStage = 'PORTAL_SELECT' | 'CREW_SELECT' | 'MEDICAL_CHIEF_LOGIN';

interface LoginPageProps {
  stage: LoginScreenStage;
  onChangeStage: (stage: LoginScreenStage) => void;
  crewProfiles: CrewSelectionProfile[];
  onSelectCrewProfile: (crewId: string) => void;
  onSignInChiefWithPassword: (password: string) => Promise<void>;
  authLoading: boolean;
  authError: string | null;
  pendingState?: {
    type: 'VERIFY_EMAIL' | 'PENDING_PROVISION' | 'SUSPENDED';
    email: string;
    uid: string;
    profile?: UserProfile | null;
  } | null;
  onResendVerification?: () => Promise<void>;
  onRefreshAuth?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
  fontSizePreset: FontSizePreset;
  onChangeFontSize: (preset: FontSizePreset) => void;
}

function getInitials(name: string): string {
  const parts = name
    .replace(/^(Cmdr\.|Dr\.|Maj\.)\s+/i, '')
    .trim()
    .split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export function LoginPage({
  stage,
  onChangeStage,
  crewProfiles,
  onSelectCrewProfile,
  onSignInChiefWithPassword,
  authLoading,
  authError,
  pendingState,
  onResendVerification,
  onRefreshAuth,
  onSignOut,
  fontSizePreset,
  onChangeFontSize
}: LoginPageProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [portalPanelMode, setPortalPanelMode] = useState<'HERO' | 'PORTAL_CHOICE' | 'EXPLORE'>('HERO');

  const handleChiefPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError(null);

    if (!password || password.trim().length < 6) {
      setValidationError('Enter your assigned Medical Chief access password.');
      return;
    }

    await onSignInChiefWithPassword(password);
  };

  if (pendingState) {
    return (
      <div className="min-h-screen bg-transparent text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-xl rounded-2xl ag-surface-elevated p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-3">
            <AstroGuardEmblem size={40} />
            <div>
              <h1 className="font-display font-bold tracking-[0.18em] text-base text-white">
                ASTROGUARD
              </h1>
              <p className="text-xs text-sky-400">
                Astronaut Health Monitoring &amp; Mission Support
              </p>
            </div>
          </div>

          {pendingState.type === 'VERIFY_EMAIL' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-400/50 flex items-start gap-3">
                <Mail className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-amber-200 text-sm">
                    Email Verification Required
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Backend security rules require a verified email token before accessing mission
                    health records. Verify <strong>{pendingState.email}</strong> via the link sent
                    to your inbox, then click Refresh Status.
                  </p>
                </div>
              </div>

              {verificationSent && (
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-[18px] h-[18px] shrink-0" />
                  <span>Verification email sent to {pendingState.email}.</span>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {onRefreshAuth && (
                  <button
                    type="button"
                    onClick={() => void onRefreshAuth()}
                    disabled={authLoading}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#105BD8] hover:bg-[#196BF2] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    <RefreshCw className="w-[18px] h-[18px] shrink-0" />
                    <span>Refresh Verification Status</span>
                  </button>
                )}
                {onResendVerification && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onResendVerification();
                      setVerificationSent(true);
                    }}
                    disabled={authLoading}
                    className="px-4 py-2.5 rounded-xl bg-[#050B16] border border-white/15 hover:border-white/30 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    Resend Email
                  </button>
                )}
              </div>
            </div>
          )}

          {pendingState.type === 'PENDING_PROVISION' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-400/40 flex items-start gap-3">
                <Shield className="w-6 h-6 text-sky-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold text-white text-sm">
                    Account Authenticated — Authorization Pending
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Your identity (<strong>{pendingState.email}</strong>) is verified, but{' '}
                    <code>MEDICAL_CHIEF</code> or crew-bound authorization has not been provisioned
                    by an existing Medical Chief. Self-elevating roles is blocked by Firestore
                    Security Rules.
                  </p>
                  <div className="p-2.5 rounded-lg bg-[#050B16] border border-white/10 font-mono text-xs text-slate-300">
                    UID: {pendingState.uid}
                    <br />
                    Status: PENDING TRUSTED PROVISIONING
                  </div>
                </div>
              </div>

              {onRefreshAuth && (
                <button
                  type="button"
                  onClick={() => void onRefreshAuth()}
                  disabled={authLoading}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#105BD8] hover:bg-[#196BF2] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className="w-[18px] h-[18px] shrink-0" />
                  <span>Check Provisioning Status</span>
                </button>
              )}
            </div>
          )}

          {pendingState.type === 'SUSPENDED' && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/60 flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-red-200 text-sm">Account Suspended</div>
                <p className="text-slate-300">
                  Access for {pendingState.email} is currently suspended. Contact the Medical Chief.
                </p>
              </div>
            </div>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="w-full px-4 py-2.5 rounded-xl bg-[#050B16] border border-white/15 hover:border-white/30 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-[18px] h-[18px] shrink-0" />
              <span>Return to Portal Selection</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // SCREEN 2: ASTRONAUT PORTAL — CREW PROFILE SELECTION (NO EMAIL / NO GOOGLE)
  // ===========================================================================
  if (stage === 'CREW_SELECT') {
    return (
      <div className="min-h-screen bg-transparent text-slate-100 flex flex-col font-sans relative overflow-hidden">
        {/* Compact Full-Width Top Header with Back & Home */}
        <header className="relative z-10 h-14 px-4 sm:px-6 lg:px-8 border-b border-white/10 bg-[#030712]/82 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => onChangeStage('PORTAL_SELECT')}
              className="ag-nav-3d inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ag-surface-inset hover:border-sky-400/35 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-[18px] h-[18px] text-sky-400 shrink-0" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeStage('PORTAL_SELECT')}
              aria-label="Home Portal Selection"
              className="ag-nav-3d inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ag-surface-inset hover:border-sky-400/35 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Home className="w-[18px] h-[18px] text-sky-400 shrink-0" />
              <span className="hidden sm:inline">Home</span>
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <FontSizeControl value={fontSizePreset} onChange={onChangeFontSize} />
            <div className="hidden md:inline-flex items-center gap-1.5 text-xs font-mono font-semibold tracking-wider text-amber-300 uppercase whitespace-nowrap">
              <Radio className="w-4 h-4 text-amber-300 shrink-0" />
              <span>SIMULATION MODE</span>
            </div>
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col justify-center"
        >
          <div className="w-full rounded-2xl ag-surface-elevated p-5 sm:p-6 lg:p-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <AstroGuardEmblem size={32} />
                  <span className="text-xs font-mono uppercase tracking-[0.18em] text-sky-400">
                    ASTROGUARD CREW PORTAL
                  </span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  SELECT YOUR CREW PROFILE
                </h1>
                <p className="text-sm text-slate-300">
                  Select your assigned astronaut profile to access your personal health dashboard.
                </p>
              </div>
            </div>

            {/* Honest Simulation Mode Distinction Notice */}
            <div className="p-3.5 rounded-xl ag-surface-inset border-amber-400/30 flex items-start gap-3 text-xs sm:text-sm text-slate-300">
              <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-mono font-semibold text-amber-200 uppercase mr-1.5">
                  SIMULATION MODE:
                </span>
                Fictional crew profile selection enables Space Apps 2026 demonstration access without
                astronaut email or Google accounts. This mode is strictly isolated per profile and
                does not grant production Firebase database credentials or Medical Chief access.
              </div>
            </div>

            {authError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/50 text-xs sm:text-sm text-red-200 flex items-start gap-2.5"
              >
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {/* Clean Non-Medical Astronaut Profile Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {crewProfiles.map((profile) => (
                <button
                  key={profile.crewId}
                  type="button"
                  onClick={() => onSelectCrewProfile(profile.crewId)}
                  className="ag-card-3d ag-surface-primary group text-left p-4 sm:p-5 rounded-xl hover:border-[#38BDF8]/55 transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Aerospace Crew Suit Portrait */}
                    <AstronautPortrait
                      crewId={profile.crewId}
                      name={profile.name}
                      portraitUrl={profile.portraitUrl}
                      attribution={profile.portraitAttribution}
                      rank={profile.rank}
                      size="lg"
                    />

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        <span className="font-semibold text-sky-300">
                          {profile.crewId} · {profile.designationCode}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-400 uppercase">{profile.flightDay}</span>
                      </div>
                      <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
                        {profile.name}
                      </h2>
                      <p className="text-sm text-slate-300 truncate">
                        {profile.rank} · {profile.missionRole}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#105BD8]/20 group-hover:bg-[#105BD8] border border-[#38BDF8]/40 text-xs sm:text-sm font-semibold text-sky-200 group-hover:text-white transition-colors whitespace-nowrap">
                    <span className="hidden sm:inline">Enter</span>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ===========================================================================
  // SCREEN 3: MEDICAL CHIEF — MCC HOUSTON RESTRICTED ACCESS TERMINAL
  // ===========================================================================
  if (stage === 'MEDICAL_CHIEF_LOGIN') {
    const resetChiefAndGoBack = () => {
      setPassword('');
      setShowPassword(false);
      setValidationError(null);
      onChangeStage('PORTAL_SELECT');
    };

    return (
      <div className="min-h-screen bg-transparent text-slate-100 flex flex-col font-sans relative overflow-hidden">
        {/* Subtle orbital horizon reticle overlay */}
        <svg
          aria-hidden="true"
          viewBox="0 0 800 800"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[760px] opacity-[0.14]"
        >
          <circle
            cx="400"
            cy="400"
            r="240"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <circle cx="400" cy="400" r="340" fill="none" stroke="#105BD8" strokeWidth="1" />
          <line x1="40" y1="400" x2="760" y2="400" stroke="#38BDF8" strokeWidth="0.75" />
          <line x1="400" y1="40" x2="400" y2="760" stroke="#38BDF8" strokeWidth="0.75" />
        </svg>

        {/* Compact Full-Width Top Header with Back & Home */}
        <header className="relative z-10 h-14 px-4 sm:px-6 lg:px-8 border-b border-white/10 bg-[#030712]/82 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={resetChiefAndGoBack}
              className="ag-nav-3d inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ag-surface-inset hover:border-sky-400/35 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-[18px] h-[18px] text-sky-400 shrink-0" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={resetChiefAndGoBack}
              className="ag-nav-3d inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ag-surface-inset hover:border-sky-400/35 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Home className="w-[18px] h-[18px] text-sky-400 shrink-0" />
              <span className="hidden sm:inline">Home</span>
            </button>
          </div>

          <FontSizeControl value={fontSizePreset} onChange={onChangeFontSize} />
        </header>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="relative z-10 flex-1 w-full flex items-center justify-center p-4 sm:p-6"
        >
          {/* Mission Control Security Terminal Panel */}
          <div className="ag-card-3d w-full max-w-lg rounded-2xl ag-surface-elevated overflow-hidden">
            {/* Top Technical Hairline Telemetry Strip */}
            <div className="px-6 py-3 bg-[#030712]/70 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-sky-400">
                MCC HOUSTON • RESTRICTED ACCESS
              </span>
              <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-emerald-400/90">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>TLS / SCRYPT</span>
              </div>
            </div>

            <div className="p-6 sm:p-7 space-y-5">
              {/* Heading Block */}
              <div className="space-y-2 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl ag-surface-inset border-sky-400/30 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-6 h-6 text-sky-400" />
                  </div>
                  <h1 className="font-display text-xl sm:text-2xl font-bold tracking-[0.04em] text-white">
                    MEDICAL CHIEF AUTHENTICATION
                  </h1>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed pt-1">
                  Authorized personnel only. Secure mission health systems access.
                </p>
              </div>

              {(validationError || authError) && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-red-950/40 border border-red-500/50 text-xs sm:text-sm text-red-200 flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 leading-relaxed">
                    {validationError && <div>{validationError}</div>}
                    {authError && <div>{authError}</div>}
                  </div>
                </div>
              )}

              {/* Password-Only Authentication Form */}
              <form onSubmit={handleChiefPasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="chief-access-password"
                    className="text-xs font-mono uppercase tracking-[0.16em] text-slate-300 block"
                  >
                    MEDICAL CHIEF ACCESS PASSWORD
                  </label>
                  <div className="relative">
                    <Lock className="w-[18px] h-[18px] text-sky-400/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="chief-access-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Enter access password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      disabled={authLoading}
                      className="w-full rounded-lg bg-[#030712] border border-white/15 pl-11 pr-11 py-3 text-sm font-mono tracking-wider text-white placeholder:text-slate-600 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/25 transition-colors disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      className="z-10 absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-md text-slate-400 hover:text-sky-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-[18px] h-[18px]" />
                      ) : (
                        <Eye className="w-[18px] h-[18px]" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 px-5 rounded-lg bg-[#105BD8] hover:bg-[#196BF2] text-white text-sm font-mono font-bold tracking-[0.16em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] disabled:opacity-60"
                >
                  {authLoading ? 'VERIFYING AUTHORIZATION...' : 'AUTHORIZE ACCESS'}
                </button>
              </form>

              {/* Encrypted Authentication & Audit Security Notice */}
              <div className="pt-4 border-t border-white/10 space-y-1.5 text-center">
                <div className="text-xs font-mono uppercase tracking-[0.14em] text-emerald-400/90">
                  ENCRYPTED AUTHENTICATION • AUTHORIZED PERSONNEL ONLY
                </div>
                <p className="text-sm text-slate-400">
                  All access attempts are logged. Unauthorized access is prohibited.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ===========================================================================
  // SCREEN 1: REALISTIC 3D EARTH & SATELLITE SPLIT MISSION-CONTROL LANDING PAGE
  // ===========================================================================
  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col justify-between font-sans relative overflow-x-clip">
      {/* Subtle Top Aerospace Command Bar */}
      <header className="relative z-10 h-14 px-4 sm:px-6 lg:px-10 border-b border-sky-400/15 bg-[#030712]/82 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <AstroGuardEmblem size={32} />
          <div className="min-w-0 flex items-baseline gap-2.5">
            <span className="font-display font-bold tracking-[0.24em] text-sm sm:text-base text-white leading-none truncate">
              ASTROGUARD
            </span>
            <span className="hidden md:inline-block text-[11px] font-mono uppercase tracking-[0.18em] text-[#38BDF8]/85">
              ORBITAL BIOMEDICAL INTELLIGENCE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden xl:flex items-center gap-3.5 text-[11px] font-mono tracking-[0.14em] text-slate-400 uppercase">
            <span>LEO 408 KM</span>
            <span className="text-sky-400/35">·</span>
            <span>INCL 51.6°</span>
            <span className="text-sky-400/35">·</span>
            <span className="text-[#67E8F9]">3 ORBITERS ACTIVE</span>
          </div>
          <FontSizeControl value={fontSizePreset} onChange={onChangeFontSize} />
        </div>
      </header>

      {/* Split Composition: Left 3D Space View + Right-Centered Mission Control Panel */}
      <main className="relative z-10 flex-1 w-full min-h-[calc(100vh-3.5rem)] px-4 sm:px-6 lg:px-12 flex items-center justify-center lg:justify-start">
        {/* LEFT / CENTRAL AREA — Unobstructed 3D Space, Earth & Prominent Satellite */}
        <div className="hidden lg:block lg:w-[68%]" />

        {/* RIGHT AREA — NASA-Inspired Mission Control Panel positioned at ~70% horizontal and vertically centered */}
        <motion.section
          key={portalPanelMode}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24 }}
          aria-label="AstroGuard Mission Control Access"
          className="w-full max-w-[450px] mx-auto lg:mx-0 lg:absolute lg:left-[70%] lg:top-1/2 lg:-translate-y-1/2 relative rounded-2xl ag-surface-elevated overflow-hidden"
        >
          {/* Soft Atmospheric Cyan Top Rim Glow */}
          <div
            aria-hidden="true"
            className="h-[2px] w-full"
            style={{
              background:
                'linear-gradient(90deg, rgba(56,189,248,0.12) 0%, rgba(103,232,249,0.9) 50%, rgba(56,189,248,0.12) 100%)'
            }}
          />

          {/* Subtle Technical Panel Grid Overlay */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(56,189,248,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.04) 1px, transparent 1px)',
              backgroundSize: '28px 28px'
            }}
          />

          <div className="relative p-6 sm:p-8 space-y-6">
            {/* Technical Coordinate Header Strip */}
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/10">
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#67E8F9]">
                MCC FLIGHT HEALTH SYSTEM
              </span>
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-slate-400">
                EXPEDITION 74 · ACTIVE
              </span>
            </div>

            {portalPanelMode === 'HERO' && (
              <div className="space-y-5 sm:space-y-6">
                <div className="space-y-2.5 min-w-0">
                  <h1 className="font-display text-3xl sm:text-4xl xl:text-[2.65rem] font-bold tracking-[0.1em] sm:tracking-[0.12em] text-white leading-none ag-text-balance">
                    ASTROGUARD
                  </h1>
                  <p className="text-xs sm:text-sm font-mono font-semibold uppercase tracking-[0.2em] text-[#38BDF8]">
                    MONITOR. UNDERSTAND. PROTECT.
                  </p>
                  <h2 className="font-display text-lg sm:text-xl font-semibold text-[#67E8F9] leading-snug pt-1 ag-text-balance">
                    Intelligent Astronaut Health Monitoring System
                  </h2>
                </div>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Advanced mission health intelligence designed to monitor astronaut well-being
                  throughout space exploration missions.
                </p>

                {/* Clean Divided Telemetry Strip */}
                <div className="grid grid-cols-3 divide-x divide-white/10 rounded-xl ag-surface-inset py-3 px-2">
                  <div className="px-3">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      BIOMETRICS
                    </div>
                    <div className="text-xs font-mono font-semibold text-white mt-0.5">
                      9 CHANNELS
                    </div>
                  </div>
                  <div className="px-3">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      TRIAGE ENGINE
                    </div>
                    <div className="text-xs font-mono font-semibold text-[#67E8F9] mt-0.5">
                      REAL-TIME
                    </div>
                  </div>
                  <div className="px-3">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      ACCESS LINK
                    </div>
                    <div className="text-xs font-mono font-semibold text-emerald-300 mt-0.5">
                      RBAC SECURED
                    </div>
                  </div>
                </div>

                {/* Primary & Secondary CTAs */}
                <div className="space-y-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setPortalPanelMode('PORTAL_CHOICE')}
                    className="ag-nav-3d w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#0284C7] via-[#0EA5E9] to-[#38BDF8] hover:from-[#0369A1] hover:to-[#67E8F9] text-[#030712] text-sm font-mono font-bold tracking-[0.16em] uppercase flex items-center justify-center gap-2 transition-all shadow-[0_10px_30px_rgba(56,189,248,0.28)]"
                  >
                    <span>ENTER MISSION CONTROL</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPortalPanelMode('EXPLORE')}
                    className="ag-nav-3d w-full py-3 px-5 rounded-xl ag-surface-inset hover:border-[#67E8F9]/55 text-[#67E8F9] hover:text-white text-xs sm:text-sm font-mono font-semibold tracking-[0.16em] uppercase flex items-center justify-center gap-2 transition-colors"
                  >
                    <Compass className="w-4 h-4" />
                    <span>EXPLORE ASTROGUARD</span>
                  </button>
                </div>
              </div>
            )}

            {portalPanelMode === 'PORTAL_CHOICE' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl font-bold text-white tracking-tight">
                      Select Mission Access Portal
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Choose Astronaut crew telemetry or Medical Chief command terminal.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPortalPanelMode('HERO')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg ag-surface-inset hover:border-white/25 text-xs font-mono text-slate-300 hover:text-white transition-colors shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>Back</span>
                  </button>
                </div>

                {/* OPTION 1 — ASTRONAUT / CREW */}
                <div className="ag-card-3d rounded-xl ag-surface-inset hover:border-emerald-400/55 p-4 space-y-3 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center shrink-0">
                        <UserCheck className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-display text-base font-bold text-white tracking-tight">
                          ASTRONAUT / CREW
                        </h3>
                        <p className="text-xs text-[#67E8F9]">Personal Health Portal</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-300">
                      CREW ACCESS
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Access your personal My Health assessment, ECG waveform, countermeasures, and
                    mission guidance.
                  </p>
                  <button
                    type="button"
                    onClick={() => onChangeStage('CREW_SELECT')}
                    className="ag-nav-3d w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold tracking-[0.14em] uppercase flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>ENTER CREW PORTAL</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* OPTION 2 — MEDICAL CHIEF */}
                <div className="ag-card-3d rounded-xl ag-surface-inset hover:border-[#38BDF8]/60 p-4 space-y-3 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#105BD8]/20 border border-[#38BDF8]/40 flex items-center justify-center shrink-0">
                        <Stethoscope className="w-5 h-5 text-[#38BDF8]" />
                      </div>
                      <div>
                        <h3 className="font-display text-base font-bold text-white tracking-tight">
                          MEDICAL CHIEF
                        </h3>
                        <p className="text-xs text-[#67E8F9]">Crew-Wide Medical Monitoring</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono uppercase tracking-widest text-[#67E8F9]">
                      FLIGHT SURGEON
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Protected flight surgeon console for centralized crew oversight, critical alert
                    triage, and clinical notes.
                  </p>
                  <button
                    type="button"
                    onClick={() => onChangeStage('MEDICAL_CHIEF_LOGIN')}
                    className="ag-nav-3d w-full py-2.5 px-4 rounded-lg bg-[#105BD8] hover:bg-[#196BF2] text-white text-xs font-mono font-bold tracking-[0.14em] uppercase flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>MEDICAL CHIEF LOGIN</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {portalPanelMode === 'EXPLORE' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl font-bold text-white tracking-tight">
                      AstroGuard Architecture
                    </h2>
                    <p className="text-xs text-[#67E8F9] mt-0.5">
                      End-to-end orbital biomedical monitoring &amp; clinical decision support
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPortalPanelMode('HERO')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg ag-surface-inset hover:border-white/25 text-xs font-mono text-slate-300 hover:text-white transition-colors shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>Back</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-xl ag-surface-inset flex items-start gap-3">
                    <Activity className="w-5 h-5 text-[#38BDF8] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-white uppercase tracking-wide">
                        Continuous Biomedical Telemetry
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Tracks heart rate, SpO₂, cabin oxygen, core temperature, hydration,
                        nutrition, radiation, stress, and sleep in real time.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl ag-surface-inset flex items-start gap-3">
                    <Shield className="w-5 h-5 text-[#67E8F9] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-white uppercase tracking-wide">
                        Flight Surgeon Clinical Oversight
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Automated multi-tier triage flags baseline deviations early and isolates crew
                        health data from MCC Houston command terminals via RBAC.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl ag-surface-inset flex items-start gap-3">
                    <Satellite className="w-5 h-5 text-[#38BDF8] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-white uppercase tracking-wide">
                        Orbital Mission Countermeasures
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Pairs physiological alerts with microgravity exercise, hydration, and
                        evidence-backed aerospace medical protocols.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPortalPanelMode('PORTAL_CHOICE')}
                  className="ag-nav-3d w-full py-3 px-5 rounded-xl bg-gradient-to-r from-[#0284C7] via-[#0EA5E9] to-[#38BDF8] hover:from-[#0369A1] hover:to-[#67E8F9] text-[#030712] text-xs sm:text-sm font-mono font-bold tracking-[0.16em] uppercase flex items-center justify-center gap-2 transition-all"
                >
                  <span>ENTER MISSION CONTROL</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </motion.section>
      </main>

      <footer className="relative z-10 px-4 sm:px-6 lg:px-10 py-3 border-t border-white/5 bg-[#030712]/65 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 shrink-0">
        <span>ASTROGUARD ORBITAL HEALTH TELEMETRY</span>
        <span>SIMULATED CREW TELEMETRY &amp; MCC RBAC PLATFORM</span>
      </footer>
    </div>
  );
}
