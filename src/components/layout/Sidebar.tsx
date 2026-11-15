import React from 'react';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  LogOut,
  Radio,
  RefreshCw,
  Shield,
  Stethoscope,
  X
} from 'lucide-react';
import {
  CrewProfile,
  FontSizePreset,
  HealthStatusLevel,
  ModuleId,
  UserProfile
} from '../../types/astroguard';
import { AstroGuardEmblem } from '../common/AstroGuardEmblem';
import { AstronautPortrait } from '../common/AstronautPortrait';
import { FontSizeControl } from '../common/FontSizeControl';

export interface NavItemConfig {
  id: ModuleId;
  label: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ASTROGUARD_MODULES: NavItemConfig[] = [
  {
    id: 'overview',
    label: 'Mission Overview',
    shortDesc: 'Tribute & live telemetry',
    icon: Compass
  },
  {
    id: 'my-health',
    label: 'My Health',
    shortDesc: '9-channel evaluation & trends',
    icon: Activity
  },
  {
    id: 'assessment',
    label: 'Health Assessment',
    shortDesc: 'Readiness & check-in',
    icon: CheckCircle2
  },
  {
    id: 'countermeasures',
    label: 'Countermeasures',
    shortDesc: 'ARED & circadian schedule',
    icon: Shield
  },
  {
    id: 'history',
    label: 'Health History',
    shortDesc: 'Mission medical archive',
    icon: Clock
  },
  {
    id: 'research',
    label: 'Research & Evidence',
    shortDesc: 'Aerospace medicine briefs',
    icon: BookOpen
  },
  {
    id: 'medical-chief',
    label: 'Medical Chief',
    shortDesc: 'Flight surgeon & alerts',
    icon: Stethoscope
  }
];

interface SidebarProps {
  activePage: ModuleId;
  onSelectPage: (page: ModuleId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  crewProfile: CrewProfile;
  userProfile: UserProfile;
  healthStatus: HealthStatusLevel;
  unacknowledgedAlertCount: number;
  isSimulationMode?: boolean;
  onSwitchCrewProfile?: () => void;
  onOpenSimulationControls: () => void;
  onSignOut: () => void;
  fontSizePreset: FontSizePreset;
  onChangeFontSize: (preset: FontSizePreset) => void;
}

const STATUS_BADGE_MAP: Record<HealthStatusLevel, string> = {
  SAFE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  CAUTION: 'bg-amber-500/15 text-amber-200 border-amber-400/50',
  DANGER: 'bg-red-500/20 text-red-200 border-red-500/60'
};

export function Sidebar({
  activePage,
  onSelectPage,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  crewProfile,
  userProfile,
  healthStatus,
  unacknowledgedAlertCount,
  isSimulationMode = false,
  onSwitchCrewProfile,
  onOpenSimulationControls,
  onSignOut,
  fontSizePreset,
  onChangeFontSize
}: SidebarProps) {
  const visibleModules = ASTROGUARD_MODULES.filter((m) =>
    userProfile.role === 'MEDICAL_CHIEF' ? true : m.id !== 'medical-chief'
  );
  const handleSelect = (id: ModuleId) => {
    onSelectPage(id);
    onCloseMobile();
  };

  const sidebarContent = (isMobile: boolean) => {
    const isCollapsed = !isMobile && collapsed;

    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-[#071124]/92 via-[#050C1B]/94 to-[#030712]/96 border-r border-white/10 select-none">
        {/* Brand Header */}
        <div
          className={`h-14 px-3.5 flex items-center border-b border-white/10 shrink-0 ${
            isCollapsed ? 'justify-center' : 'justify-between gap-2.5'
          }`}
        >
          <button
            type="button"
            onClick={() => handleSelect('overview')}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] rounded-lg min-w-0"
            title="ASTROGUARD Mission Overview"
          >
            <AstroGuardEmblem size={32} />
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="font-display font-bold tracking-[0.16em] text-base text-white leading-tight truncate">
                  ASTROGUARD
                </div>
                <p className="text-[11px] font-mono text-sky-300/80 tracking-wide truncate">
                  ORBITAL CREW TELEMETRY
                </p>
              </div>
            )}
          </button>

          {isMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            !isCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )
          )}
        </div>

        {/* Expand button when collapsed on desktop */}
        {isCollapsed && (
          <div className="px-2 pt-2.5 flex justify-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Seven Module Navigation */}
        <nav
          aria-label="Primary AstroGuard Modules"
          className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1"
        >
          {!isCollapsed && (
            <div className="px-2.5 pb-1.5 text-[11px] font-mono tracking-[0.16em] text-slate-400 uppercase">
              Mission Modules
            </div>
          )}

          {visibleModules.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const showAlertBadge =
              item.id === 'medical-chief' && unacknowledgedAlertCount > 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                title={isCollapsed ? item.label : undefined}
                className={`ag-nav-3d w-full flex items-center gap-3 rounded-xl transition-all text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] relative overflow-hidden ${
                  isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-[#105BD8]/90 to-[#0EA5E9]/75 text-white border border-sky-400/40 shadow-[0_8px_24px_rgba(16,91,216,0.3)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {isActive && !isCollapsed && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#67E8F9]"
                  />
                )}
                <Icon
                  className={`w-[21px] h-[21px] shrink-0 ${
                    isActive ? 'text-white' : 'text-sky-400/90'
                  }`}
                />
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-tight truncate">
                      {item.label}
                    </div>
                    <div
                      className={`text-xs leading-tight mt-0.5 truncate ${
                        isActive ? 'text-sky-100/90' : 'text-slate-400'
                      }`}
                    >
                      {item.shortDesc}
                    </div>
                  </div>
                )}

                {showAlertBadge && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-xs font-mono font-bold tabular-nums shrink-0 ${
                      healthStatus === 'DANGER'
                        ? 'bg-red-500 text-white'
                        : 'bg-amber-400 text-slate-950'
                    } ${isCollapsed ? 'absolute -top-1 -right-1' : ''}`}
                  >
                    {unacknowledgedAlertCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer: Authenticated Role / Crew Subject, Font Size, Simulation Controls & Logout */}
        <div className="p-2.5 border-t border-white/10 space-y-2 shrink-0 bg-[#030712]/70">
          {!isCollapsed ? (
            <>
              <div className="p-3 rounded-xl ag-surface-primary space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-sky-300 font-semibold tracking-wide">
                    {userProfile.role === 'MEDICAL_CHIEF' ? 'MEDICAL CHIEF' : userProfile.crewId}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold tracking-wider ${STATUS_BADGE_MAP[healthStatus]}`}
                  >
                    {healthStatus}
                  </span>
                </div>

                {userProfile.role === 'ASTRONAUT' ? (
                  <div className="flex items-center gap-2.5">
                    <AstronautPortrait
                      crewId={crewProfile.id}
                      name={crewProfile.name}
                      status={healthStatus}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">
                        {crewProfile.name}
                      </div>
                      <div className="text-xs font-mono text-slate-400 truncate">
                        {crewProfile.designationCode} · {crewProfile.rank}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-sm font-semibold text-white truncate">
                      {userProfile.displayName}
                    </div>
                    <div className="pt-1.5 border-t border-white/10 flex items-center gap-2">
                      <AstronautPortrait
                        crewId={crewProfile.id}
                        name={crewProfile.name}
                        status={healthStatus}
                        size="xs"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                          Active Subject
                        </div>
                        <div className="text-xs font-semibold text-white truncate">
                          {crewProfile.name}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 text-[11px] font-mono pt-1.5 border-t border-white/10">
                  <span className="text-slate-400 truncate">
                    {isSimulationMode ? 'CREW SESSION' : userProfile.email}
                  </span>
                  <span
                    className={
                      isSimulationMode
                        ? 'text-amber-300 font-semibold shrink-0'
                        : 'text-sky-300 font-semibold shrink-0'
                    }
                  >
                    {isSimulationMode ? 'SIMULATION' : 'VERIFIED'}
                  </span>
                </div>
              </div>

              <FontSizeControl value={fontSizePreset} onChange={onChangeFontSize} />

              <button
                type="button"
                onClick={() => {
                  onOpenSimulationControls();
                  onCloseMobile();
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl ag-surface-inset hover:border-sky-400/35 text-slate-300 hover:text-white text-xs font-mono transition-colors"
              >
                <span className="flex items-center gap-2 truncate">
                  <Radio className="w-[17px] h-[17px] text-[#E03C31] shrink-0" />
                  <span className="truncate">SIMULATION CONTROLS</span>
                </span>
                <span className="text-[11px] text-sky-400">DEMO</span>
              </button>

              {isSimulationMode && onSwitchCrewProfile && (
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile();
                    onSwitchCrewProfile();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#105BD8]/15 hover:bg-[#105BD8]/30 border border-[#105BD8]/40 text-sky-200 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <RefreshCw className="w-[17px] h-[17px] shrink-0" />
                  <span>Switch Crew Profile</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onSignOut();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl ag-surface-inset hover:bg-red-500/15 hover:border-red-500/40 text-slate-300 hover:text-red-200 text-sm font-medium transition-colors whitespace-nowrap"
              >
                <LogOut className="w-[17px] h-[17px] shrink-0" />
                <span>{isSimulationMode ? 'Exit to Main Portal' : 'Sign Out'}</span>
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <FontSizeControl value={fontSizePreset} onChange={onChangeFontSize} compact />
              <button
                type="button"
                onClick={onOpenSimulationControls}
                title={`Open Simulation Controls (${healthStatus})`}
                className="w-full flex items-center justify-center p-2.5 rounded-xl ag-surface-inset hover:border-sky-400/35 text-[#E03C31] transition-colors"
              >
                <Radio className="w-5 h-5" />
              </button>
              {isSimulationMode && onSwitchCrewProfile && (
                <button
                  type="button"
                  onClick={onSwitchCrewProfile}
                  title="Switch Crew Profile"
                  aria-label="Switch Crew Profile"
                  className="w-full flex items-center justify-center p-2.5 rounded-xl bg-[#105BD8]/15 hover:bg-[#105BD8]/30 border border-[#105BD8]/40 text-sky-200 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              )}
              <button
                type="button"
                onClick={onSignOut}
                title={isSimulationMode ? 'Exit to Main Portal' : 'Sign Out'}
                aria-label={isSimulationMode ? 'Exit to Main Portal' : 'Sign Out'}
                className="w-full flex items-center justify-center p-2.5 rounded-xl ag-surface-inset hover:bg-red-500/15 hover:border-red-500/40 text-slate-300 hover:text-red-200 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen transition-[width] duration-200 ${
          collapsed ? 'w-20' : 'w-68'
        }`}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile / Tablet Slide-Over Sidebar Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl">
            {sidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
