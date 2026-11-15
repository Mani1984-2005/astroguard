import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithCustomToken,
  signOut
} from 'firebase/auth';
import { AlertTriangle, ArrowLeft, Home, Menu, Radio, RefreshCw, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { auth } from './firebase';
import {
  ACTIVE_CREW_PROFILE,
  ARCHIVAL_TRIBUTES,
  CREW_ROSTER_DATA,
  CREW_SELECTION_PROFILES,
  HEALTH_HISTORY_RECORDS,
  INITIAL_COUNTERMEASURES,
  RESEARCH_EVIDENCE_ITEMS,
  getAstronautIdentity,
  getInitialHistoryForCrew,
  getTelemetrySeriesForCrew
} from './data/astroguardData';
import {
  AssessmentInputs,
  AuditLogEntry,
  CountermeasureItem,
  CrewProfile,
  CrewRosterMember,
  EvaluationRule,
  FontSizePreset,
  HealthAlert,
  HealthHistoryRecord,
  HealthIndicatorKey,
  ModuleId,
  ProvisionedAccount,
  PythonHealthReport,
  SimulationScenarioId,
  TelemetryVitalsSnapshot,
  TimeframeKey,
  UserProfile,
  UserRole
} from './types/astroguard';
import {
  DEFAULT_EVALUATION_RULES,
  SIMULATION_SCENARIOS,
  evaluateCrewHealth
} from './engine/healthEvaluationEngine';
import {
  acknowledgeAlertInDb,
  addSurgeonNoteInDb,
  assignUserCrewRoleInDb,
  fetchAllUsersForChief,
  provisionAccountBinding,
  resolveAlertInDb,
  resolveOrInitializeUserProfile,
  seedFourCrewMissionDataset,
  submitAssessmentInDb,
  subscribeAlerts,
  subscribeAstronautHealth,
  subscribeAstronautHistory,
  subscribeAuditLogs,
  subscribeCountermeasures,
  subscribeEvaluationConfig,
  subscribeMedicalChiefCrewRoster,
  subscribeProvisionedAccounts,
  toggleCountermeasureInDb,
  updateCrewScenarioInDb,
  updateEvaluationConfigInDb,
  verifyAuthorizedCrewHealthAccess,
  writeAuditLog
} from './services/astroguardDb';
import { ASTROGUARD_MODULES, Sidebar } from './components/layout/Sidebar';
import { AstroGuardEmblem } from './components/common/AstroGuardEmblem';
import {
  CriticalAlertDock,
  EmergencyAlertModal
} from './components/common/EmergencyAlertModal';
import { SimulationControlPanel } from './components/common/SimulationControlPanel';
import { analyzeHealthWithPython } from './services/pythonHealthService';
import { AccessDeniedView } from './components/common/AccessDeniedView';
import { AstroGuardBackdrop } from './components/three/AstroGuardBackdrop';
import {
  LoginPage,
  LoginPortalChoice,
  LoginScreenStage
} from './pages/LoginPage';
import { MissionOverview } from './pages/MissionOverview';
import { MyHealth } from './pages/MyHealth';
import { HealthAssessment } from './pages/HealthAssessment';
import { Countermeasures } from './pages/Countermeasures';
import { HealthHistory } from './pages/HealthHistory';
import { ResearchEvidence } from './pages/ResearchEvidence';
import { MedicalChiefWorkspace } from './pages/MedicalChiefWorkspace';

const VALID_MODULE_IDS = new Set<ModuleId>([
  'overview',
  'my-health',
  'assessment',
  'countermeasures',
  'history',
  'research',
  'medical-chief'
]);

type ParsedRoute =
  | { kind: 'module'; moduleId: ModuleId }
  | { kind: 'crew-health'; targetCrewId: string };

function parseCurrentRoute(): ParsedRoute {
  if (typeof window === 'undefined') return { kind: 'module', moduleId: 'overview' };
  const hashRaw = window.location.hash.replace(/^#\/?/, '');
  const pathRaw = window.location.pathname.replace(/^\//, '');
  const candidate = hashRaw || pathRaw;

  const crewMatch = candidate.match(/^crew\/([A-Za-z0-9_\-]+)\/health$/i);
  if (crewMatch) {
    return { kind: 'crew-health', targetCrewId: crewMatch[1].toUpperCase() };
  }

  const mod = candidate as ModuleId;
  if (VALID_MODULE_IDS.has(mod)) {
    return { kind: 'module', moduleId: mod };
  }
  return { kind: 'module', moduleId: 'overview' };
}

function mapFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  switch (code) {
    case 'auth/invalid-custom-token':
    case 'auth/custom-token-mismatch':
      return 'Server authorization token could not be verified for this Firebase project.';
    case 'auth/too-many-requests':
      return 'Too many failed authentication attempts. Wait briefly before retrying.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
  }
}

export default function App() {
  const prefersReducedMotion = useReducedMotion();
  // Authentication, Simulation Profile & RBAC State
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [chiefServerProfile, setChiefServerProfile] = useState<UserProfile | null>(null);
  const [loginStage, setLoginStage] = useState<LoginScreenStage>('PORTAL_SELECT');
  const [simCrewId, setSimCrewId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [portalMismatchMessage, setPortalMismatchMessage] = useState<string | null>(null);
  const loginPortalRef = useRef<LoginPortalChoice>('ASTRONAUT');
  const sessionLoggedUidRef = useRef<string | null>(null);
  const autoSeedAttemptedRef = useRef(false);

  // Per-crew isolated in-memory stores for Simulation Mode (never mixes crew data)
  const [simVitalsByCrew, setSimVitalsByCrew] = useState<
    Record<string, TelemetryVitalsSnapshot>
  >({});
  const [simScenarioByCrew, setSimScenarioByCrew] = useState<
    Record<string, SimulationScenarioId>
  >({});
  const [simAlertsByCrew, setSimAlertsByCrew] = useState<Record<string, HealthAlert[]>>({});
  const [simCountermeasuresByCrew, setSimCountermeasuresByCrew] = useState<
    Record<string, CountermeasureItem[]>
  >({});
  const [simHistoryByCrew, setSimHistoryByCrew] = useState<
    Record<string, HealthHistoryRecord[]>
  >({});

  // Navigation & Access Control State
  const [activePage, setActivePage] = useState<ModuleId>('overview');
  const [pageHistory, setPageHistory] = useState<ModuleId[]>([]);
  const [accessDenied, setAccessDenied] = useState<{
    title: string;
    reason: string;
    attemptedTarget: string;
  } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [fontSizePreset, setFontSizePreset] = useState<FontSizePreset>(() => {
    if (typeof window === 'undefined') return 'standard';
    const saved = window.localStorage.getItem('astroguard_font_size');
    if (saved === 'compact' || saved === 'standard' || saved === 'large') {
      return saved;
    }
    return 'standard';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.fontSize = fontSizePreset;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('astroguard_font_size', fontSizePreset);
    }
  }, [fontSizePreset]);

  // Mission Overview Tribute
  const [selectedTributeId] = useState<string>('williams');

  // Centralized Evaluation Rules & Telemetry State
  const [evaluationRules, setEvaluationRules] =
    useState<Record<HealthIndicatorKey, EvaluationRule>>(DEFAULT_EVALUATION_RULES);
  const [activeScenario, setActiveScenario] = useState<SimulationScenarioId>('SAFE');
  const [activeVitals, setActiveVitals] = useState<TelemetryVitalsSnapshot>(
    SIMULATION_SCENARIOS.SAFE.vitals
  );
  const [activeHrv, setActiveHrv] = useState<number>(64);
  const [pythonHealthReport, setPythonHealthReport] = useState<PythonHealthReport | null>(null);
  const [pythonHealthLoading, setPythonHealthLoading] = useState(false);
  const [pythonHealthError, setPythonHealthError] = useState<string | null>(null);
  const [vitalsHistoryWindow, setVitalsHistoryWindow] = useState<TelemetryVitalsSnapshot[]>([
    SIMULATION_SCENARIOS.SAFE.vitals,
    SIMULATION_SCENARIOS.SAFE.vitals
  ]);

  // Isolated / Role-Scoped Firestore Data State
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [emergencyModalMinimized, setEmergencyModalMinimized] = useState(false);
  const [inspectedAlert, setInspectedAlert] = useState<HealthAlert | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeKey>('24H');
  const [countermeasures, setCountermeasures] =
    useState<CountermeasureItem[]>(INITIAL_COUNTERMEASURES);
  const [crewCountermeasuresMap, setCrewCountermeasuresMap] = useState<
    Record<string, CountermeasureItem[]>
  >({});
  const [healthHistory, setHealthHistory] =
    useState<HealthHistoryRecord[]>(HEALTH_HISTORY_RECORDS);
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [selectedResearchId, setSelectedResearchId] = useState('sans');

  // Health Assessment State
  const [assessmentInputs, setAssessmentInputs] = useState<AssessmentInputs>({
    sleepQuality: 8,
    fatigueLevel: 2,
    vestibularComfort: 9,
    hydrationAdequacy: 8,
    visualClarity: 9,
    notes: 'Nominal adaptation during Increment 74 morning operations.'
  });
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);

  // Medical Chief Exclusive State (NEVER populated for ASTRONAUT role)
  const [crewRoster, setCrewRoster] = useState<CrewRosterMember[]>([]);
  const [selectedCrewId, setSelectedCrewId] = useState<string>('AG-LEO-01');
  const [crewStatusFilter, setCrewStatusFilter] = useState('ALL');
  const [newSurgeonNote, setNewSurgeonNote] = useState('');
  const [provisionedAccounts, setProvisionedAccounts] = useState<ProvisionedAccount[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const clearProtectedState = useCallback(() => {
    setUserProfile(null);
    setChiefServerProfile(null);
    setSimCrewId(null);
    setAlerts([]);
    setInspectedAlert(null);
    setCrewRoster([]);
    setProvisionedAccounts([]);
    setRegisteredUsers([]);
    setAuditLogs([]);
    setAccessDenied(null);
    setPortalMismatchMessage(null);
    setCountermeasures(INITIAL_COUNTERMEASURES);
    setCrewCountermeasuresMap({});
    setHealthHistory(HEALTH_HISTORY_RECORDS);
    setActiveVitals(SIMULATION_SCENARIOS.SAFE.vitals);
    setActiveScenario('SAFE');
    setPythonHealthReport(null);
    setPythonHealthError(null);
    setPythonHealthLoading(false);
    sessionLoggedUidRef.current = null;
    autoSeedAttemptedRef.current = false;
  }, []);

  const loadAuthenticatedProfile = useCallback(async (user: User) => {
    if (!user.emailVerified) {
      setUserProfile(null);
      return;
    }
    const profile = await resolveOrInitializeUserProfile(user);
    setUserProfile(profile);

    if (profile.accountStatus === 'ACTIVE') {
      // Detect if user tried to log in via Medical Chief option without MEDICAL_CHIEF privilege
      if (
        loginPortalRef.current === 'MEDICAL_CHIEF' &&
        profile.role !== 'MEDICAL_CHIEF'
      ) {
        setPortalMismatchMessage(
          `Signed in as ${profile.email} (${profile.role} · ${profile.crewId}). Selecting "Medical Chief Login" does not grant Medical Chief privileges — backend rules restrict you to your own Astronaut portal.`
        );
        void writeAuditLog({
          actorUserId: profile.userId,
          actorEmail: profile.email,
          actorRole: profile.role,
          action: 'UNAUTHORIZED_MEDICAL_CHIEF_LOGIN_PORTAL',
          targetRecord: 'portal/medical-chief',
          details: `Astronaut ${profile.crewId} attempted sign-in via Medical Chief login option.`
        }).catch(() => {});
      } else {
        setPortalMismatchMessage(null);
      }

      if (sessionLoggedUidRef.current !== profile.userId) {
        sessionLoggedUidRef.current = profile.userId;
        void writeAuditLog({
          actorUserId: profile.userId,
          actorEmail: profile.email,
          actorRole: profile.role,
          action: 'USER_LOGIN',
          targetRecord: `users/${profile.userId}`,
          details: `Authenticated session started (${profile.role} · ${profile.crewId}).`
        }).catch(() => {});
      }

      // Default landing route based on verified role if currently on overview/default
      const currentRoute = parseCurrentRoute();
      if (
        profile.role === 'MEDICAL_CHIEF' &&
        currentRoute.kind === 'module' &&
        currentRoute.moduleId === 'overview' &&
        !window.location.hash
      ) {
        setActivePage('medical-chief');
      } else if (profile.role === 'ASTRONAUT' && currentRoute.kind === 'module') {
        if (currentRoute.moduleId === 'medical-chief') {
          setAccessDenied({
            title: 'Medical Chief Workspace Restricted',
            reason:
              'Your authenticated role (ASTRONAUT) is not authorized to access crew-wide Medical Chief triage or surgeon consoles.',
            attemptedTarget: '#medical-chief'
          });
        } else {
          setActivePage(currentRoute.moduleId);
        }
      }
    }
  }, []);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        clearProtectedState();
        setAuthReady(true);
        return;
      }
      try {
        await loadAuthenticatedProfile(user);
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : 'Unable to verify RBAC profile in Firestore.'
        );
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, [clearProtectedState, loadAuthenticatedProfile]);

  // Role-scoped Firestore subscriptions (ONLY active when authenticated & ACTIVE)
  useEffect(() => {
    if (!userProfile || userProfile.accountStatus !== 'ACTIVE' || !firebaseUser?.emailVerified) {
      return;
    }

    const unsubs: Array<() => void> = [];

    unsubs.push(
      subscribeEvaluationConfig((rules) => {
        setEvaluationRules(rules);
      })
    );

    unsubs.push(
      subscribeAlerts(userProfile.role, userProfile.crewId, (nextAlerts) => {
        setAlerts(nextAlerts);
      })
    );

    unsubs.push(
      subscribeCountermeasures(userProfile.role, userProfile.crewId, (own, crewMap) => {
        if (own.length > 0) setCountermeasures(own);
        setCrewCountermeasuresMap(crewMap);
      })
    );

    if (userProfile.role === 'ASTRONAUT') {
      unsubs.push(
        subscribeAstronautHealth(userProfile.crewId, (data) => {
          setActiveVitals((prev) => {
            setVitalsHistoryWindow([prev, data.vitals]);
            return data.vitals;
          });
          setActiveScenario(data.scenarioId);
          setActiveHrv(data.hrv);
        })
      );
      unsubs.push(
        subscribeAstronautHistory(userProfile.crewId, (records) => {
          if (records.length > 0) setHealthHistory(records);
        })
      );
    } else if (userProfile.role === 'MEDICAL_CHIEF') {
      unsubs.push(
        subscribeMedicalChiefCrewRoster((members) => {
          setCrewRoster(members);
          if (members.length === 0 && !autoSeedAttemptedRef.current) {
            autoSeedAttemptedRef.current = true;
            void seedFourCrewMissionDataset({
              actorUid: userProfile.userId,
              actorEmail: userProfile.email,
              rules: evaluationRules
            }).catch(() => {});
          }
        })
      );
      unsubs.push(subscribeProvisionedAccounts(setProvisionedAccounts));
      unsubs.push(subscribeAuditLogs(setAuditLogs));
      void fetchAllUsersForChief()
        .then(setRegisteredUsers)
        .catch(() => {});
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [userProfile, firebaseUser?.emailVerified, evaluationRules]);

  // Unified active session profile (verified Firebase user, verified Server Chief session, OR isolated Simulation Crew session)
  const isSimulationSession = Boolean(!firebaseUser && !chiefServerProfile && simCrewId);
  const isServerChiefSession = Boolean(!firebaseUser && chiefServerProfile?.role === 'MEDICAL_CHIEF');

  const activeSessionProfile: UserProfile | null = useMemo(() => {
    if (firebaseUser && firebaseUser.emailVerified && userProfile?.accountStatus === 'ACTIVE') {
      return userProfile;
    }
    if (
      chiefServerProfile &&
      chiefServerProfile.role === 'MEDICAL_CHIEF' &&
      chiefServerProfile.accountStatus === 'ACTIVE'
    ) {
      return chiefServerProfile;
    }
    if (!firebaseUser && simCrewId) {
      const rosterMember = CREW_ROSTER_DATA.find((c) => c.id === simCrewId);
      if (rosterMember) {
        return {
          userId: `SIM_${rosterMember.id}`,
          email: 'simulation-mode@astroguard.local',
          displayName: rosterMember.name,
          role: 'ASTRONAUT',
          crewId: rosterMember.id,
          accountStatus: 'ACTIVE'
        };
      }
    }
    return null;
  }, [firebaseUser, userProfile, chiefServerProfile, simCrewId]);

  // Helper to build a crew-specific alert for simulation mode when entering CAUTION/DANGER
  const buildSimAlertForCrew = useCallback(
    (
      crewId: string,
      astronautName: string,
      evalRes: ReturnType<typeof evaluateCrewHealth>,
      previousReadingOverride?: string
    ): HealthAlert | null => {
      if (evalRes.status !== 'CAUTION' && evalRes.status !== 'DANGER') return null;
      const primary = evalRes.primaryFinding;
      return {
        id: `SIM_ALT_${crewId}_${Date.now()}`,
        astronautId: crewId,
        astronautName,
        parameterKey: primary?.key ?? 'heartRate',
        parameterLabel: primary?.label ?? 'Physiological Telemetry',
        previousStatus: 'SAFE',
        newStatus: evalRes.status,
        severity: evalRes.status === 'DANGER' ? 'CRITICAL' : 'CAUTION',
        currentReading: primary?.formattedReading ?? 'Simulated Excursion',
        previousReading:
          previousReadingOverride ?? primary?.previousReading ?? 'Baseline Nominal',
        timestamp: `FD-084 • ${new Date().toISOString().slice(11, 19)} UTC`,
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        resolutionStatus: 'OPEN',
        resolvedBy: null,
        resolvedAt: null,
        associatedCountermeasure:
          primary?.recommendedCountermeasure ?? 'Follow Medical Chief review guidance.',
        message: evalRes.statusSubtext,
        isSimulated: true
      };
    },
    []
  );

  // Evaluate route permissions whenever hash changes (supports /crew/:crewId/health & #medical-chief)
  const evaluateRouteAccess = useCallback(async () => {
    if (!activeSessionProfile) return;
    const route = parseCurrentRoute();

    if (route.kind === 'crew-health') {
      if (activeSessionProfile.role === 'MEDICAL_CHIEF') {
        if (isServerChiefSession) {
          try {
            const res = await fetch('/api/auth/chief-session', { credentials: 'same-origin' });
            if (!res.ok) {
              setChiefServerProfile(null);
              setAccessDenied({
                title: 'Medical Chief Session Expired',
                reason: 'Server-side Medical Chief authentication is required to access crew dossiers.',
                attemptedTarget: `/crew/${route.targetCrewId}/health`
              });
              return;
            }
          } catch {
            // Fall through if offline
          }
        }
        setAccessDenied(null);
        setSelectedCrewId(route.targetCrewId);
        setActivePage('medical-chief');
        return;
      }

      if (route.targetCrewId === activeSessionProfile.crewId) {
        if (isSimulationSession) {
          try {
            const res = await fetch('/api/auth/crew-session', { credentials: 'same-origin' });
            const sessionData = (await res.json().catch(() => ({}))) as {
              ok?: boolean;
              crewId?: string;
            };
            if (!res.ok || !sessionData.ok || sessionData.crewId !== route.targetCrewId) {
              setSimCrewId(null);
              setAccessDenied({
                title: `Session Verification Failed for ${route.targetCrewId}`,
                reason:
                  'Server-signed crew session token does not authorize this crew profile. Re-select your assigned profile from the Crew Portal.',
                attemptedTarget: `/crew/${route.targetCrewId}/health`
              });
              return;
            }
          } catch {
            // If offline/unreachable during local check, still keep strict client match
          }
        }
        setAccessDenied(null);
        setActivePage('my-health');
        return;
      }

      // Attempt genuine Firestore read so backend security rules enforce rejection
      try {
        await verifyAuthorizedCrewHealthAccess(route.targetCrewId);
      } catch {
        // Expected PERMISSION_DENIED from Firestore Security Rules
      }

      if (!isSimulationSession) {
        void writeAuditLog({
          actorUserId: activeSessionProfile.userId,
          actorEmail: activeSessionProfile.email,
          actorRole: activeSessionProfile.role,
          action: 'UNAUTHORIZED_CREW_ACCESS_ATTEMPT',
          targetRecord: `healthRecords/${route.targetCrewId}`,
          details: `Astronaut ${activeSessionProfile.crewId} attempted direct URL access to ${route.targetCrewId} health record; rejected by backend security rules.`
        }).catch(() => {});
      }

      setAccessDenied({
        title: `Access Denied to Crew Record ${route.targetCrewId}`,
        reason: `Strict astronaut data isolation is active. Your profile (${activeSessionProfile.crewId}) cannot access another astronaut's health records, biometric telemetry, or alerts. Backend security rules rejected this request.`,
        attemptedTarget: `/crew/${route.targetCrewId}/health`
      });
      return;
    }

    // Standard module route
    if (route.moduleId === 'medical-chief' && activeSessionProfile.role !== 'MEDICAL_CHIEF') {
      if (!isSimulationSession) {
        void writeAuditLog({
          actorUserId: activeSessionProfile.userId,
          actorEmail: activeSessionProfile.email,
          actorRole: activeSessionProfile.role,
          action: 'UNAUTHORIZED_MEDICAL_CHIEF_ROUTE',
          targetRecord: 'workspace/medical-chief',
          details: `Astronaut ${activeSessionProfile.crewId} attempted direct URL access to Medical Chief Workspace.`
        }).catch(() => {});
      }

      setAccessDenied({
        title: 'Medical Chief Workspace Access Denied',
        reason:
          'Only authorized Medical Chief accounts can access crew-wide triage, clinical notes, and threshold configuration.',
        attemptedTarget: '#medical-chief'
      });
      return;
    }

    setAccessDenied(null);
    setActivePage(route.moduleId);
  }, [activeSessionProfile, isSimulationSession]);

  useEffect(() => {
    void evaluateRouteAccess();
    const onHashChange = () => {
      void evaluateRouteAccess();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [evaluateRouteAccess]);

  const handleSelectPage = (page: ModuleId) => {
    if (page === 'medical-chief' && activeSessionProfile?.role !== 'MEDICAL_CHIEF') {
      setAccessDenied({
        title: 'Medical Chief Workspace Access Denied',
        reason:
          'Only authorized Medical Chief accounts can open the crew-wide Medical Chief Workspace.',
        attemptedTarget: '#medical-chief'
      });
      return;
    }
    setAccessDenied(null);
    if (page !== activePage) {
      setPageHistory((prev) => [...prev.slice(-15), activePage]);
    }
    setActivePage(page);
    if (window.location.hash !== `#${page}`) {
      window.history.replaceState(null, '', `#${page}`);
    }
  };

  const homePageId: ModuleId =
    activeSessionProfile?.role === 'MEDICAL_CHIEF' ? 'medical-chief' : 'overview';

  const handleGoHome = () => {
    setAccessDenied(null);
    if (activePage !== homePageId) {
      setPageHistory((prev) => [...prev.slice(-15), activePage]);
      setActivePage(homePageId);
      if (window.location.hash !== `#${homePageId}`) {
        window.history.replaceState(null, '', `#${homePageId}`);
      }
    }
  };

  const handleGoBack = () => {
    setAccessDenied(null);
    if (pageHistory.length > 0) {
      const previousPage = pageHistory[pageHistory.length - 1];
      setPageHistory((prev) => prev.slice(0, -1));
      setActivePage(previousPage);
      if (window.location.hash !== `#${previousPage}`) {
        window.history.replaceState(null, '', `#${previousPage}`);
      }
      return;
    }
    if (activePage !== homePageId) {
      setActivePage(homePageId);
      if (window.location.hash !== `#${homePageId}`) {
        window.history.replaceState(null, '', `#${homePageId}`);
      }
    }
  };

  const activeSubjectId = activeSessionProfile
    ? activeSessionProfile.role === 'ASTRONAUT'
      ? activeSessionProfile.crewId
      : selectedCrewId || 'AG-LEO-01'
    : 'AG-LEO-01';

  // Synchronize telemetry, scenario, HRV, and history when Medical Chief switches crew or Firebase roster updates
  useEffect(() => {
    if (!activeSessionProfile || activeSessionProfile.role !== 'MEDICAL_CHIEF') return;
    const rosterSource = crewRoster.length > 0 ? crewRoster : CREW_ROSTER_DATA;
    const targetMember =
      rosterSource.find((c) => c.id === selectedCrewId) ||
      CREW_ROSTER_DATA.find((c) => c.id === selectedCrewId) ||
      rosterSource[0];
    if (!targetMember) return;

    const syncedVitals = simVitalsByCrew[targetMember.id] ?? targetMember.vitals;
    const syncedScenario =
      simScenarioByCrew[targetMember.id] ?? targetMember.scenarioId ?? 'SAFE';

    setActiveVitals(syncedVitals);
    setVitalsHistoryWindow([syncedVitals, syncedVitals]);
    setActiveScenario(syncedScenario);
    setActiveHrv(targetMember.hrv);

    if (isServerChiefSession) {
      setHealthHistory(
        simHistoryByCrew[targetMember.id] ?? getInitialHistoryForCrew(targetMember.id)
      );
    }
  }, [
    activeSessionProfile,
    selectedCrewId,
    crewRoster,
    simVitalsByCrew,
    simScenarioByCrew,
    simHistoryByCrew,
    isServerChiefSession
  ]);

  // Subscribe to selected astronaut's Firestore history when Medical Chief uses verified Firebase Auth
  useEffect(() => {
    if (
      !userProfile ||
      userProfile.role !== 'MEDICAL_CHIEF' ||
      userProfile.accountStatus !== 'ACTIVE' ||
      !firebaseUser?.emailVerified ||
      isServerChiefSession ||
      isSimulationSession
    ) {
      return;
    }

    setHealthHistory(getInitialHistoryForCrew(selectedCrewId));
    const unsub = subscribeAstronautHistory(selectedCrewId, (records) => {
      if (records.length > 0) {
        setHealthHistory(records);
      } else {
        setHealthHistory(getInitialHistoryForCrew(selectedCrewId));
      }
    });
    return () => unsub();
  }, [
    userProfile,
    firebaseUser?.emailVerified,
    selectedCrewId,
    isServerChiefSession,
    isSimulationSession
  ]);

  const handleSelectCrew = useCallback(
    (crewId: string) => {
      setSelectedCrewId(crewId);
      const rosterSource = crewRoster.length > 0 ? crewRoster : CREW_ROSTER_DATA;
      const targetMember =
        rosterSource.find((c) => c.id === crewId) ||
        CREW_ROSTER_DATA.find((c) => c.id === crewId);
      if (targetMember) {
        const nextVitals = simVitalsByCrew[crewId] ?? targetMember.vitals;
        const nextScenario = simScenarioByCrew[crewId] ?? targetMember.scenarioId ?? 'SAFE';
        setActiveVitals(nextVitals);
        setVitalsHistoryWindow([nextVitals, nextVitals]);
        setActiveScenario(nextScenario);
        setActiveHrv(targetMember.hrv);
        setHealthHistory(simHistoryByCrew[crewId] ?? getInitialHistoryForCrew(crewId));
        if (crewCountermeasuresMap[crewId] && crewCountermeasuresMap[crewId].length > 0) {
          setCountermeasures(crewCountermeasuresMap[crewId]);
        } else if (simCountermeasuresByCrew[crewId]) {
          setCountermeasures(simCountermeasuresByCrew[crewId]);
        }
      }
    },
    [
      crewRoster,
      simVitalsByCrew,
      simScenarioByCrew,
      simHistoryByCrew,
      crewCountermeasuresMap,
      simCountermeasuresByCrew
    ]
  );

  // Subtle resting heart rate jitter around each astronaut's baseline when in SAFE mode
  useEffect(() => {
    const baselineMember = CREW_ROSTER_DATA.find((c) => c.id === activeSubjectId);
    const baseHr =
      baselineMember && baselineMember.status === 'Nominal' ? baselineMember.hr : 68;

    const interval = setInterval(() => {
      setActiveVitals((prev) => {
        if (prev.heartRate === null) return prev;
        if (activeScenario !== 'SAFE') return prev;
        const delta = Math.floor(Math.random() * 3) - 1;
        const nextHr = Math.min(baseHr + 2, Math.max(baseHr - 2, Math.round(prev.heartRate + delta)));
        const nextSnapshot = { ...prev, heartRate: nextHr };
        setVitalsHistoryWindow((win) => [...win.slice(-4), prev]);
        return nextSnapshot;
      });
    }, 3200);
    return () => clearInterval(interval);
  }, [activeScenario, activeSubjectId]);

  // Authenticated / Simulated astronaut's own CrewProfile (isolated to activeSessionProfile.crewId, or selectedCrewId for Medical Chief)
  const personalCrewProfile: CrewProfile = useMemo(() => {
    if (!activeSessionProfile) return ACTIVE_CREW_PROFILE;
    const targetId =
      activeSessionProfile.role === 'ASTRONAUT'
        ? activeSessionProfile.crewId
        : selectedCrewId || 'AG-LEO-01';
    const rosterSource = crewRoster.length > 0 ? crewRoster : CREW_ROSTER_DATA;
    const rosterTemplate =
      rosterSource.find((c) => c.id === targetId) ||
      CREW_ROSTER_DATA.find((c) => c.id === targetId) ||
      CREW_ROSTER_DATA[0];
    const identity = getAstronautIdentity(targetId);
    const baselineTemplate = CREW_ROSTER_DATA.find((c) => c.id === targetId);
    const baselineRestingHr =
      baselineTemplate && baselineTemplate.status === 'Nominal'
        ? baselineTemplate.hr
        : ACTIVE_CREW_PROFILE.restingHr;

    return {
      ...ACTIVE_CREW_PROFILE,
      id: rosterTemplate.id,
      designationCode:
        identity?.designationCode || rosterTemplate.designationCode || rosterTemplate.id,
      name: identity?.fullName || rosterTemplate.name,
      rank: identity?.rank || rosterTemplate.rank || 'Flight Crew',
      role: `${identity?.missionRole || rosterTemplate.role} • Increment 74`,
      missionIncrement: identity?.missionIncrement || ACTIVE_CREW_PROFILE.missionIncrement,
      missionDay:
        identity?.flightDay || rosterTemplate.flightDay || ACTIVE_CREW_PROFILE.missionDay,
      portraitUrl:
        identity?.portraitUrl || rosterTemplate.portraitUrl || ACTIVE_CREW_PROFILE.portraitUrl,
      portraitAttribution:
        identity?.portraitAttribution ||
        rosterTemplate.portraitAttribution ||
        ACTIVE_CREW_PROFILE.portraitAttribution,
      portraitSource:
        identity?.portraitSource ||
        rosterTemplate.portraitSource ||
        ACTIVE_CREW_PROFILE.portraitSource,
      restingHr: baselineRestingHr,
      spo2: activeVitals.spo2 ?? 0,
      coreTemp: activeVitals.coreTemp ?? 36.8,
      hrv: activeHrv,
      radiation: activeVitals.radiation ?? 0.42,
      vitals: activeVitals
    };
  }, [activeSessionProfile, selectedCrewId, crewRoster, activeVitals, activeHrv]);

  const crewTelemetrySeries = useMemo(
    () => getTelemetrySeriesForCrew(personalCrewProfile.id, activeVitals),
    [personalCrewProfile.id, activeVitals]
  );

  const evaluation = useMemo(
    () => evaluateCrewHealth(activeVitals, vitalsHistoryWindow, evaluationRules),
    [activeVitals, vitalsHistoryWindow, evaluationRules]
  );

  const selectedCrewCountermeasures =
    crewCountermeasuresMap[selectedCrewId] && crewCountermeasuresMap[selectedCrewId].length > 0
      ? crewCountermeasuresMap[selectedCrewId]
      : countermeasures;

  // Python engine is an additive authoritative readiness layer. The synchronous
  // TypeScript evaluation remains the fallback if the bridge is unavailable.
  useEffect(() => {
    if (!activeSessionProfile || activeSessionProfile.accountStatus !== 'ACTIVE') {
      setPythonHealthReport(null);
      setPythonHealthError(null);
      setPythonHealthLoading(false);
      return;
    }
    const targetCrewId =
      activeSessionProfile.role === 'ASTRONAUT'
        ? activeSessionProfile.crewId
        : selectedCrewId || 'AG-LEO-01';
    let cancelled = false;
    setPythonHealthReport(null);
    setPythonHealthError(null);
    setPythonHealthLoading(true);
    const timer = setTimeout(() => {
      void analyzeHealthWithPython({
        crewId: targetCrewId,
        crewProfile: personalCrewProfile,
        vitals: activeVitals,
        series: crewTelemetrySeries,
        countermeasures:
          activeSessionProfile.role === 'MEDICAL_CHIEF'
            ? selectedCrewCountermeasures
            : countermeasures
      }).then((result) => {
        if (cancelled) return;
        setPythonHealthLoading(false);
        if (result.ok && result.report) {
          setPythonHealthReport(result.report);
          setPythonHealthError(null);
        } else {
          setPythonHealthReport(null);
          setPythonHealthError(result.error || 'Python engine unavailable.');
        }
      }).catch((error: unknown) => {
        if (cancelled) return;
        setPythonHealthLoading(false);
        setPythonHealthReport(null);
        setPythonHealthError(
          error instanceof Error ? error.message : 'Python engine unavailable.'
        );
      });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    activeSessionProfile,
    selectedCrewId,
    personalCrewProfile,
    activeVitals,
    crewTelemetrySeries,
    countermeasures,
    selectedCrewCountermeasures
  ]);

  // Auth & Crew Profile Selection Actions
  const handleChangeLoginStage = (nextStage: LoginScreenStage) => {
    setLoginStage(nextStage);
    setAuthError(null);
    if (nextStage === 'MEDICAL_CHIEF_LOGIN') {
      loginPortalRef.current = 'MEDICAL_CHIEF';
    } else if (nextStage === 'CREW_SELECT') {
      loginPortalRef.current = 'ASTRONAUT';
    }
  };

  const activateSimCrewLocalState = useCallback(
    (crewId: string, navigateToMyHealth: boolean) => {
      const member = CREW_ROSTER_DATA.find((c) => c.id === crewId);
      if (!member) return;

      const initialScenario: SimulationScenarioId =
        simScenarioByCrew[crewId] ?? member.scenarioId ?? 'SAFE';
      const initialVitals: TelemetryVitalsSnapshot =
        simVitalsByCrew[crewId] ?? member.vitals ?? SIMULATION_SCENARIOS[initialScenario].vitals;
      const initialHistory = simHistoryByCrew[crewId] ?? getInitialHistoryForCrew(crewId);
      const initialCountermeasures =
        simCountermeasuresByCrew[crewId] ?? INITIAL_COUNTERMEASURES.map((c) => ({ ...c }));

      let initialAlerts = simAlertsByCrew[crewId];
      if (!initialAlerts) {
        const evalRes = evaluateCrewHealth(initialVitals, [initialVitals], evaluationRules);
        const created = buildSimAlertForCrew(crewId, member.name, evalRes);
        initialAlerts = created ? [created] : [];
        setSimAlertsByCrew((prev) => ({ ...prev, [crewId]: initialAlerts! }));
      }

      setSimVitalsByCrew((prev) => ({ ...prev, [crewId]: initialVitals }));
      setSimScenarioByCrew((prev) => ({ ...prev, [crewId]: initialScenario }));
      setSimHistoryByCrew((prev) => ({ ...prev, [crewId]: initialHistory }));
      setSimCountermeasuresByCrew((prev) => ({ ...prev, [crewId]: initialCountermeasures }));

      setActiveVitals(initialVitals);
      setVitalsHistoryWindow([initialVitals, initialVitals]);
      setActiveScenario(initialScenario);
      setActiveHrv(member.hrv);
      setHealthHistory(initialHistory);
      setCountermeasures(initialCountermeasures);
      setAlerts(initialAlerts);
      setEmergencyModalMinimized(false);
      setAccessDenied(null);
      setPortalMismatchMessage(null);

      setSimCrewId(crewId);
      if (navigateToMyHealth) {
        setActivePage('my-health');
        window.history.replaceState(null, '', '#my-health');
      }
    },
    [
      buildSimAlertForCrew,
      evaluationRules,
      simAlertsByCrew,
      simCountermeasuresByCrew,
      simHistoryByCrew,
      simScenarioByCrew,
      simVitalsByCrew
    ]
  );

  const fetchServerAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/audit-logs', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        logs?: AuditLogEntry[];
      };
      if (data.ok && Array.isArray(data.logs)) {
        setAuditLogs(data.logs);
      }
    } catch {
      // Ignore audit log fetch failure
    }
  }, []);

  const initializeServerChiefWorkspaceState = useCallback(
    (navigateToChiefWorkspace: boolean, forceReset = false) => {
      const seededRoster: CrewRosterMember[] = CREW_ROSTER_DATA.map((member) => ({
        ...member,
        notes: [...member.notes]
      }));
      setCrewRoster((prev) => (forceReset || prev.length === 0 ? seededRoster : prev));

      const initialCrewAlerts: HealthAlert[] = [];
      for (const member of seededRoster) {
        const evalRes = evaluateCrewHealth(member.vitals, [member.vitals], evaluationRules);
        const generated = buildSimAlertForCrew(member.id, member.name, evalRes);
        if (generated) initialCrewAlerts.push(generated);
      }
      setAlerts((prev) => (forceReset || prev.length === 0 ? initialCrewAlerts : prev));
      setAccessDenied(null);
      setPortalMismatchMessage(null);
      void fetchServerAuditLogs();

      if (navigateToChiefWorkspace) {
        setActivePage('medical-chief');
        window.history.replaceState(null, '', '#medical-chief');
      }
    },
    [buildSimAlertForCrew, evaluationRules, fetchServerAuditLogs]
  );

  // Restore server-signed Medical Chief OR Simulation Crew session on reload when not signed in via Firebase
  const sessionRestoredRef = useRef(false);
  useEffect(() => {
    if (!authReady || firebaseUser || chiefServerProfile || simCrewId || sessionRestoredRef.current) {
      return;
    }
    sessionRestoredRef.current = true;
    void (async () => {
      try {
        const chiefRes = await fetch('/api/auth/chief-session', { credentials: 'same-origin' });
        if (chiefRes.ok) {
          const chiefData = (await chiefRes.json().catch(() => ({}))) as {
            ok?: boolean;
            profile?: UserProfile;
          };
          if (
            chiefData.ok &&
            chiefData.profile &&
            chiefData.profile.role === 'MEDICAL_CHIEF' &&
            chiefData.profile.accountStatus === 'ACTIVE'
          ) {
            setChiefServerProfile(chiefData.profile);
            const currentRoute = parseCurrentRoute();
            const shouldDefaultToChief =
              currentRoute.kind === 'module' &&
              currentRoute.moduleId === 'overview' &&
              !window.location.hash;
            initializeServerChiefWorkspaceState(shouldDefaultToChief);
            return;
          }
        }
      } catch {
        // Proceed to check crew simulation session
      }

      try {
        const crewRes = await fetch('/api/auth/crew-session', { credentials: 'same-origin' });
        if (!crewRes.ok) return;
        const crewData = (await crewRes.json().catch(() => ({}))) as {
          ok?: boolean;
          crewId?: string;
        };
        if (crewData.ok && crewData.crewId) {
          activateSimCrewLocalState(crewData.crewId, false);
        }
      } catch {
        // Ignore restore failure
      }
    })();
  }, [
    authReady,
    firebaseUser,
    chiefServerProfile,
    simCrewId,
    activateSimCrewLocalState,
    initializeServerChiefWorkspaceState
  ]);

  const handleSelectSimCrewProfile = async (crewId: string) => {
    const member = CREW_ROSTER_DATA.find((c) => c.id === crewId);
    if (!member) return;

    setAuthLoading(true);
    setAuthError(null);
    try {
      const response = await fetch('/api/auth/crew-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ crewId })
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        crewId?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || data.crewId !== crewId) {
        setAuthError(data.error || 'Unable to bind crew session token.');
        return;
      }
      setChiefServerProfile(null);
      activateSimCrewLocalState(crewId, true);
    } catch {
      setAuthError('Unable to reach session verification server.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSwitchCrewProfile = () => {
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    setSimCrewId(null);
    setAccessDenied(null);
    setEmergencyModalMinimized(false);
    setLoginStage('CREW_SELECT');
  };

  const handleSignInChiefWithPassword = async (password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    loginPortalRef.current = 'MEDICAL_CHIEF';
    try {
      const response = await fetch('/api/auth/medical-chief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password })
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        authMode?: 'FIREBASE_CUSTOM_TOKEN' | 'SERVER_SESSION';
        customToken?: string;
        profile?: UserProfile;
        error?: string;
        retryAfterSec?: number;
      };

      if (!response.ok || !data.ok) {
        if (response.status === 429 && typeof data.retryAfterSec === 'number') {
          const mins = Math.max(1, Math.ceil(data.retryAfterSec / 60));
          setAuthError(
            `${data.error || 'Terminal temporarily locked.'} Retry in approximately ${mins} min.`
          );
        } else {
          setAuthError(data.error || 'Access denied. Invalid authorization credentials.');
        }
        return;
      }

      if (data.customToken) {
        await signInWithCustomToken(auth, data.customToken);
        return;
      }

      if (data.profile && data.profile.role === 'MEDICAL_CHIEF') {
        setSimCrewId(null);
        setChiefServerProfile(data.profile);
        initializeServerChiefWorkspaceState(true);
        return;
      }

      setAuthError('Server did not return a valid Medical Chief session.');
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleChangeChiefPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ ok: boolean; error?: string; passwordUpdatedAt?: string }> => {
    try {
      const response = await fetch('/api/auth/medical-chief/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        passwordUpdatedAt?: string;
      };
      if (response.ok && data.ok) {
        void fetchServerAuditLogs();
        return { ok: true, passwordUpdatedAt: data.passwordUpdatedAt };
      }
      return { ok: false, error: data.error || 'Unable to update Medical Chief password.' };
    } catch {
      return { ok: false, error: 'Unable to reach authentication server.' };
    }
  };

  const handleSignOut = async () => {
    if (userProfile) {
      void writeAuditLog({
        actorUserId: userProfile.userId,
        actorEmail: userProfile.email,
        actorRole: userProfile.role,
        action: 'USER_LOGOUT',
        targetRecord: `users/${userProfile.userId}`,
        details: 'Session terminated by user.'
      }).catch(() => {});
    }
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    if (firebaseUser) {
      await signOut(auth);
    }
    clearProtectedState();
    setPageHistory([]);
    setLoginStage('PORTAL_SELECT');
    window.history.replaceState(null, '', '#overview');
  };

  // Simulation / Firestore Handlers
  const handleSelectScenario = async (scenarioId: SimulationScenarioId) => {
    if (!activeSessionProfile) return;
    const preset = SIMULATION_SCENARIOS[scenarioId];
    const nextEval = evaluateCrewHealth(
      preset.vitals,
      [activeVitals, preset.vitals],
      evaluationRules
    );
    const nextHrv = scenarioId === 'DANGER' ? 36 : scenarioId === 'CAUTION' ? 44 : 64;
    setVitalsHistoryWindow([activeVitals, preset.vitals]);
    setActiveVitals(preset.vitals);
    setActiveScenario(scenarioId);
    setActiveHrv(nextHrv);

    const targetCrewId =
      activeSessionProfile.role === 'ASTRONAUT'
        ? activeSessionProfile.crewId
        : selectedCrewId || 'AG-LEO-01';
    const targetName =
      CREW_ROSTER_DATA.find((c) => c.id === targetCrewId)?.name || personalCrewProfile.name;

    if (isSimulationSession || isServerChiefSession) {
      setSimVitalsByCrew((prev) => ({ ...prev, [targetCrewId]: preset.vitals }));
      setSimScenarioByCrew((prev) => ({ ...prev, [targetCrewId]: scenarioId }));
      if (isServerChiefSession) {
        setCrewRoster((prev) =>
          prev.map((m) =>
            m.id === targetCrewId
              ? {
                  ...m,
                  vitals: preset.vitals,
                  hrv: nextHrv,
                  scenarioId,
                  status:
                    nextEval.status === 'DANGER'
                      ? 'Critical'
                      : nextEval.status === 'CAUTION'
                        ? 'Watch'
                        : 'Nominal'
                }
              : m
          )
        );
      }

      const primary = nextEval.primaryFinding;
      const newHist: HealthHistoryRecord = {
        id: `SIM_HIST_${Date.now()}`,
        date: `FD-084 • ${new Date().toISOString().slice(11, 19)} UTC`,
        phase: 'Simulated Status Evaluation',
        metric: primary ? `${primary.label} (${nextEval.status})` : `All Channels (${nextEval.status})`,
        value: primary ? primary.formattedReading : 'All Channels Nominal',
        baselineDelta: `Scenario: ${scenarioId}`,
        status:
          nextEval.status === 'DANGER'
            ? 'Critical'
            : nextEval.status === 'CAUTION'
              ? 'Monitored'
              : 'Nominal'
      };
      setHealthHistory((prev) => {
        const nextList = [newHist, ...prev];
        setSimHistoryByCrew((m) => ({ ...m, [targetCrewId]: nextList }));
        return nextList;
      });

      const previousEval = evaluateCrewHealth(activeVitals, [activeVitals], evaluationRules);
      const previousReading = nextEval.primaryFinding
        ? previousEval.findings.find((finding) => finding.key === nextEval.primaryFinding?.key)
            ?.formattedReading
        : undefined;
      const createdAlert = buildSimAlertForCrew(
        targetCrewId,
        targetName,
        nextEval,
        previousReading
      );
      if (createdAlert) {
        setAlerts((prev) => {
          const exists = prev.some(
            (a) =>
              a.astronautId === targetCrewId &&
              a.severity === createdAlert.severity &&
              a.parameterKey === createdAlert.parameterKey &&
              a.resolutionStatus !== 'RESOLVED'
          );
          if (exists) return prev;
          const nextAlerts = [createdAlert, ...prev];
          setSimAlertsByCrew((m) => ({ ...m, [targetCrewId]: nextAlerts }));
          return nextAlerts;
        });
      }

      if (nextEval.status === 'DANGER') {
        setEmergencyModalMinimized(false);
      }
      return;
    }

    await updateCrewScenarioInDb({
      crewId: targetCrewId,
      astronautName: targetName,
      scenarioId,
      vitals: preset.vitals,
      evaluation: nextEval,
      hrv: nextHrv,
      actorUid: activeSessionProfile.userId,
      actorEmail: activeSessionProfile.email,
      actorRole: activeSessionProfile.role,
      existingAlerts: alerts
    });

    if (nextEval.status === 'DANGER') {
      setEmergencyModalMinimized(false);
    }
  };

  const handleSelectScenarioForCrew = async (
    crewId: string,
    scenarioId: SimulationScenarioId
  ) => {
    if (!activeSessionProfile || activeSessionProfile.role !== 'MEDICAL_CHIEF') return;
    const preset = SIMULATION_SCENARIOS[scenarioId];
    const member = crewRoster.find((c) => c.id === crewId) || CREW_ROSTER_DATA.find((c) => c.id === crewId);
    const nextEval = evaluateCrewHealth(preset.vitals, [preset.vitals], evaluationRules);
    const previousVitals = member?.vitals ?? activeVitals;
    const previousEval = evaluateCrewHealth(
      previousVitals,
      [previousVitals],
      evaluationRules
    );
    const previousReading = nextEval.primaryFinding
      ? previousEval.findings.find((finding) => finding.key === nextEval.primaryFinding?.key)
          ?.formattedReading
      : undefined;
    const nextHrv = scenarioId === 'DANGER' ? 36 : scenarioId === 'CAUTION' ? 44 : 64;

    if (isServerChiefSession) {
      setCrewRoster((prev) =>
        prev.map((m) =>
          m.id === crewId
            ? {
                ...m,
                vitals: preset.vitals,
                hrv: nextHrv,
                scenarioId,
                status:
                  nextEval.status === 'DANGER'
                    ? 'Critical'
                    : nextEval.status === 'CAUTION'
                      ? 'Watch'
                      : 'Nominal'
              }
            : m
        )
      );
      if (crewId === selectedCrewId) {
        setVitalsHistoryWindow([activeVitals, preset.vitals]);
        setActiveVitals(preset.vitals);
        setActiveScenario(scenarioId);
        setActiveHrv(nextHrv);
      }
      const createdAlert = buildSimAlertForCrew(
        crewId,
        member?.name || crewId,
        nextEval,
        previousReading
      );
      if (createdAlert) {
        setAlerts((prev) => {
          const exists = prev.some(
            (a) =>
              a.astronautId === crewId &&
              a.severity === createdAlert.severity &&
              a.parameterKey === createdAlert.parameterKey &&
              a.resolutionStatus !== 'RESOLVED'
          );
          return exists ? prev : [createdAlert, ...prev];
        });
      }
      return;
    }

    await updateCrewScenarioInDb({
      crewId,
      astronautName: member?.name || crewId,
      scenarioId,
      vitals: preset.vitals,
      evaluation: nextEval,
      hrv: nextHrv,
      actorUid: activeSessionProfile.userId,
      actorEmail: activeSessionProfile.email,
      actorRole: 'MEDICAL_CHIEF',
      existingAlerts: alerts
    });
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    if (!activeSessionProfile) return;
    const actorLabel =
      activeSessionProfile.role === 'MEDICAL_CHIEF'
        ? `${activeSessionProfile.displayName} (Medical Chief)`
        : `${personalCrewProfile.name} (Astronaut)`;

    if (isServerChiefSession || isSimulationSession) {
      const nowLabel = `FD-084 • ${new Date().toISOString().slice(11, 19)} UTC`;
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? {
                ...a,
                acknowledged: true,
                acknowledgedBy: actorLabel,
                acknowledgedAt: nowLabel,
                resolutionStatus: a.resolutionStatus === 'OPEN' ? 'IN_REVIEW' : a.resolutionStatus
              }
            : a
        )
      );
      setInspectedAlert((prev) =>
        prev && prev.id === alertId
          ? {
              ...prev,
              acknowledged: true,
              acknowledgedBy: actorLabel,
              acknowledgedAt: nowLabel,
              resolutionStatus:
                prev.resolutionStatus === 'OPEN' ? 'IN_REVIEW' : prev.resolutionStatus
            }
          : prev
      );
      return;
    }

    await acknowledgeAlertInDb({
      alertId,
      actorLabel,
      actorUid: activeSessionProfile.userId,
      actorEmail: activeSessionProfile.email,
      actorRole: activeSessionProfile.role
    });
  };

  const handleResolveAlert = async (alertId: string) => {
    if (!activeSessionProfile || activeSessionProfile.role !== 'MEDICAL_CHIEF') return;
    const actorLabel = `${activeSessionProfile.displayName} (Medical Chief)`;

    if (isServerChiefSession) {
      const nowLabel = `FD-084 • ${new Date().toISOString().slice(11, 19)} UTC`;
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? {
                ...a,
                acknowledged: true,
                acknowledgedBy: a.acknowledgedBy || actorLabel,
                acknowledgedAt: a.acknowledgedAt || nowLabel,
                resolutionStatus: 'RESOLVED',
                resolvedBy: actorLabel,
                resolvedAt: nowLabel
              }
            : a
        )
      );
      return;
    }

    await resolveAlertInDb({
      alertId,
      actorLabel,
      actorUid: activeSessionProfile.userId,
      actorEmail: activeSessionProfile.email
    });
  };

  const handleUpdateRuleThreshold = async (
    key: HealthIndicatorKey,
    field: 'cautionHigh' | 'cautionLow' | 'dangerHigh' | 'dangerLow',
    value: number
  ) => {
    if (!activeSessionProfile || activeSessionProfile.role !== 'MEDICAL_CHIEF') return;
    const updated = {
      ...evaluationRules,
      [key]: {
        ...evaluationRules[key],
        [field]: value
      }
    };
    setEvaluationRules(updated);
    if (isServerChiefSession) return;

    await updateEvaluationConfigInDb({
      rules: updated,
      actorUid: activeSessionProfile.userId,
      actorEmail: activeSessionProfile.email
    });
  };

  const readinessScore = useMemo(() => {
    const { sleepQuality, fatigueLevel, vestibularComfort, hydrationAdequacy, visualClarity } =
      assessmentInputs;
    const raw =
      sleepQuality * 2.2 +
      (10 - fatigueLevel) * 2.3 +
      vestibularComfort * 2.0 +
      hydrationAdequacy * 1.7 +
      visualClarity * 1.8;
    return Math.min(100, Math.max(55, Math.round(raw)));
  }, [assessmentInputs]);

  const countermeasureCompliance = useMemo(() => {
    if (countermeasures.length === 0) return 0;
    const total = countermeasures.reduce((acc, item) => acc + item.progress, 0);
    return Math.round(total / countermeasures.length);
  }, [countermeasures]);

  const toggleCountermeasure = async (id: string) => {
    const targetItem = countermeasures.find((c) => c.id === id);
    if (!targetItem || !activeSessionProfile) return;
    const crewId =
      activeSessionProfile.role === 'ASTRONAUT'
        ? activeSessionProfile.crewId
        : selectedCrewId || 'AG-LEO-01';

    setCountermeasures((prev) => {
      const next = prev.map((cm) => {
        if (cm.id !== id) return cm;
        const nextCompleted = !cm.completed;
        return {
          ...cm,
          completed: nextCompleted,
          progress: nextCompleted ? 100 : 50
        };
      });
      if (isSimulationSession) {
        setSimCountermeasuresByCrew((m) => ({ ...m, [crewId]: next }));
      }
      return next;
    });

    if (isSimulationSession || isServerChiefSession) return;

    try {
      await toggleCountermeasureInDb({ crewId, item: targetItem });
    } catch {
      // Countermeasure record might not yet be seeded in Firestore; state remains updated
    }
  };

  const handleUpdateAssessmentInput = (
    field: keyof AssessmentInputs,
    value: number | string
  ) => {
    setAssessmentSubmitted(false);
    setAssessmentInputs((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitAssessment = async () => {
    setAssessmentSubmitted(true);
    if (!activeSessionProfile || activeSessionProfile.role !== 'ASTRONAUT') return;
    if (isSimulationSession) {
      const entry: HealthHistoryRecord = {
        id: `SIM_ASM_${Date.now()}`,
        date: `FD-084 • ${new Date().toISOString().slice(11, 19)} UTC`,
        phase: 'Self-Reported Readiness Check-In',
        metric: 'Crew Readiness Score (Simulated)',
        value: `${readinessScore} / 100`,
        baselineDelta: assessmentInputs.notes.slice(0, 60) || 'Submitted',
        status: readinessScore >= 80 ? 'Nominal' : 'Monitored'
      };
      setHealthHistory((prev) => {
        const nextList = [entry, ...prev];
        setSimHistoryByCrew((m) => ({ ...m, [activeSessionProfile.crewId]: nextList }));
        return nextList;
      });
      return;
    }
    await submitAssessmentInDb({
      crewId: activeSessionProfile.crewId,
      authorUserId: activeSessionProfile.userId,
      inputs: assessmentInputs,
      readinessScore
    });
  };

  const filteredHistory = useMemo(() => {
    return healthHistory.filter((rec) => {
      const matchesPhase =
        historyFilter === 'ALL' || rec.status.toUpperCase() === historyFilter;
      const q = historySearch.toLowerCase();
      const matchesQuery =
        rec.metric.toLowerCase().includes(q) ||
        rec.phase.toLowerCase().includes(q) ||
        rec.id.toLowerCase().includes(q);
      return matchesPhase && matchesQuery;
    });
  }, [healthHistory, historyFilter, historySearch]);

  const handleAddSurgeonNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newSurgeonNote.trim() || !activeSessionProfile || activeSessionProfile.role !== 'MEDICAL_CHIEF') return;
    const text = newSurgeonNote.trim();
    const authorLabel = `${activeSessionProfile.displayName} (Medical Chief)`;
    setNewSurgeonNote('');

    if (isServerChiefSession) {
      const note = {
        id: `NOTE_${Date.now()}`,
        author: authorLabel,
        time: `${new Date().toISOString().slice(11, 19)} UTC`,
        text
      };
      setCrewRoster((prev) =>
        prev.map((m) =>
          m.id === selectedCrewId ? { ...m, notes: [note, ...m.notes] } : m
        )
      );
      return;
    }

    await addSurgeonNoteInDb({
      crewId: selectedCrewId,
      authorUserId: activeSessionProfile.userId,
      authorEmail: activeSessionProfile.email,
      authorLabel,
      text
    });
  };

  const activeModuleMeta =
    ASTROGUARD_MODULES.find((m) => m.id === activePage) || ASTROGUARD_MODULES[0];

  const activeUnacknowledgedCriticalAlert = useMemo(
    () => alerts.find((a) => a.severity === 'CRITICAL' && !a.acknowledged) ?? null,
    [alerts]
  );

  const unacknowledgedAlertCount = useMemo(
    () => alerts.filter((a) => !a.acknowledged).length,
    [alerts]
  );

  // ===========================================================================
  // AUTHENTICATION & AUTHORIZATION GATE (NO DASHBOARD ACCESS WHEN SIGNED OUT)
  // ===========================================================================
  const effectiveCrewRoster =
    crewRoster.length > 0 ? crewRoster : CREW_ROSTER_DATA;

  const isMedicalChief = activeSessionProfile?.role === 'MEDICAL_CHIEF';

  let pageView: React.ReactNode;

  if (!authReady) {
    pageView = (
      <div className="min-h-screen bg-transparent text-slate-200 flex flex-col items-center justify-center gap-3 font-sans">
        <AstroGuardEmblem size={44} />
        <div className="text-xs font-mono tracking-widest uppercase text-sky-400">
          Verifying AstroGuard Authentication &amp; RBAC Session...
        </div>
      </div>
    );
  } else if (firebaseUser && !firebaseUser.emailVerified) {
    pageView = (
      <LoginPage
        stage={loginStage}
        onChangeStage={handleChangeLoginStage}
        crewProfiles={CREW_SELECTION_PROFILES}
        onSelectCrewProfile={(id) => void handleSelectSimCrewProfile(id)}
        onSignInChiefWithPassword={handleSignInChiefWithPassword}
        authLoading={authLoading}
        authError={authError}
        pendingState={{
          type: 'VERIFY_EMAIL',
          email: firebaseUser.email || 'Unknown Email',
          uid: firebaseUser.uid
        }}
        onResendVerification={() => sendEmailVerification(firebaseUser)}
        onRefreshAuth={async () => {
          await firebaseUser.reload();
          if (auth.currentUser?.emailVerified) {
            await loadAuthenticatedProfile(auth.currentUser);
          }
        }}
        onSignOut={handleSignOut}
        fontSizePreset={fontSizePreset}
        onChangeFontSize={setFontSizePreset}
      />
    );
  } else if (firebaseUser && (!userProfile || userProfile.accountStatus !== 'ACTIVE')) {
    pageView = (
      <LoginPage
        stage={loginStage}
        onChangeStage={handleChangeLoginStage}
        crewProfiles={CREW_SELECTION_PROFILES}
        onSelectCrewProfile={(id) => void handleSelectSimCrewProfile(id)}
        onSignInChiefWithPassword={handleSignInChiefWithPassword}
        authLoading={authLoading}
        authError={authError}
        pendingState={{
          type: userProfile?.accountStatus === 'SUSPENDED' ? 'SUSPENDED' : 'PENDING_PROVISION',
          email: firebaseUser.email || 'Unknown Email',
          uid: firebaseUser.uid,
          profile: userProfile
        }}
        onRefreshAuth={async () => {
          if (auth.currentUser) {
            await loadAuthenticatedProfile(auth.currentUser);
          }
        }}
        onSignOut={handleSignOut}
        fontSizePreset={fontSizePreset}
        onChangeFontSize={setFontSizePreset}
      />
    );
  } else if (!activeSessionProfile) {
    pageView = (
      <LoginPage
        stage={loginStage}
        onChangeStage={handleChangeLoginStage}
        crewProfiles={CREW_SELECTION_PROFILES}
        onSelectCrewProfile={(id) => void handleSelectSimCrewProfile(id)}
        onSignInChiefWithPassword={handleSignInChiefWithPassword}
        authLoading={authLoading}
        authError={authError}
        fontSizePreset={fontSizePreset}
        onChangeFontSize={setFontSizePreset}
      />
    );
  } else {
    pageView = (
      <div className="min-h-screen bg-transparent text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-[#105BD8] selection:text-white">
      {/* Persistent Desktop Sidebar + Mobile Drawer */}
      <Sidebar
        activePage={activePage}
        onSelectPage={handleSelectPage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileDrawerOpen}
        onCloseMobile={() => setMobileDrawerOpen(false)}
        crewProfile={personalCrewProfile}
        userProfile={activeSessionProfile}
        healthStatus={evaluation.status}
        unacknowledgedAlertCount={unacknowledgedAlertCount}
        isSimulationMode={isSimulationSession}
        onSwitchCrewProfile={isSimulationSession ? handleSwitchCrewProfile : undefined}
        onOpenSimulationControls={() => setDemoModalOpen(true)}
        onSignOut={() => void handleSignOut()}
        fontSizePreset={fontSizePreset}
        onChangeFontSize={setFontSizePreset}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Compact Unified Header Bar (Back, Home, Module Title & Session Controls) */}
        <header className="sticky top-0 z-30 h-14 px-3 sm:px-5 bg-[#030712]/84 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open module navigation"
              className="lg:hidden w-10 h-10 -ml-1 flex items-center justify-center rounded-lg text-slate-200 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] shrink-0"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleGoBack}
                disabled={pageHistory.length === 0 && activePage === homePageId && !accessDenied}
                aria-label="Go back"
                title="Go Back"
                className="ag-nav-3d inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ag-surface-inset hover:border-sky-400/35 text-xs sm:text-sm font-medium text-slate-200 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-[18px] h-[18px] text-sky-400 shrink-0" />
                <span className="hidden sm:inline">Back</span>
              </button>

              <button
                type="button"
                onClick={handleGoHome}
                aria-label="Go to Home"
                title="Home Dashboard"
                className={`ag-nav-3d hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activePage === homePageId && !accessDenied
                    ? 'bg-[#105BD8]/25 border-[#38BDF8]/50 text-white'
                    : 'ag-surface-inset hover:border-sky-400/35 text-slate-200 hover:text-white'
                }`}
              >
                <Home className="w-[18px] h-[18px] text-sky-400 shrink-0" />
                <span className="hidden sm:inline">Home</span>
              </button>
            </div>

            <span className="hidden md:block h-5 w-px bg-white/10 shrink-0" aria-hidden="true" />

            <div className="flex items-center gap-2 min-w-0">
              <span className="lg:hidden inline-flex shrink-0">
                <AstroGuardEmblem size={26} />
              </span>
              <span className="font-display text-sm sm:text-base font-semibold text-white truncate">
                {accessDenied ? 'Access Restricted' : activeModuleMeta.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isSimulationSession && (
              <>
                <span className="hidden xl:inline-flex items-center gap-1.5 text-xs font-mono text-amber-300 whitespace-nowrap">
                  <Radio className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>SIMULATION</span>
                </span>
                <button
                  type="button"
                  onClick={handleSwitchCrewProfile}
                  className="ag-nav-3d inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#105BD8]/20 hover:bg-[#105BD8]/35 border border-[#38BDF8]/40 text-sky-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Switch Profile</span>
                </button>
              </>
            )}

            <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-sky-300 whitespace-nowrap shrink-0">
              <span
                className={`w-2 h-2 rounded-full ${
                  evaluation.status === 'DANGER'
                    ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]'
                    : evaluation.status === 'CAUTION'
                      ? 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]'
                      : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]'
                }`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">
                {isMedicalChief ? 'MEDICAL CHIEF' : activeSessionProfile.crewId}
              </span>
            </div>
          </div>
        </header>

        {/* Role Mismatch Warning Banner if an Astronaut attempted Medical Chief Login portal */}
        {portalMismatchMessage && (
          <div
            role="alert"
            className="bg-amber-950/80 border-b border-amber-400/50 px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-200"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
              <span>{portalMismatchMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setPortalMismatchMessage(null)}
              className="text-amber-300 hover:text-white shrink-0"
              aria-label="Dismiss notice"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Persistent Non-Dismissible Critical Alert Banner */}
        {activeUnacknowledgedCriticalAlert &&
          (emergencyModalMinimized || isMedicalChief) &&
          activePage !== 'medical-chief' && (
            <CriticalAlertDock
              alert={activeUnacknowledgedCriticalAlert}
              canAcknowledge={isMedicalChief}
              onReopenModal={() => {
                if (isMedicalChief) {
                  handleSelectCrew(activeUnacknowledgedCriticalAlert.astronautId);
                  setInspectedAlert(activeUnacknowledgedCriticalAlert);
                } else {
                  setEmergencyModalMinimized(false);
                }
              }}
              onAcknowledge={(id) => void handleAcknowledgeAlert(id)}
            />
          )}

        {/* Active Module Viewport or Backend Access Denied Screen */}
        <main className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={accessDenied ? 'access-denied' : activePage}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: 'easeOut' }}
              className="flex-1 flex flex-col"
            >
          {accessDenied ? (
            <AccessDeniedView
              title={accessDenied.title}
              reason={accessDenied.reason}
              attemptedTarget={accessDenied.attemptedTarget}
              onReturnHome={() => {
                setAccessDenied(null);
                const fallbackPage: ModuleId = isMedicalChief ? 'medical-chief' : 'my-health';
                setActivePage(fallbackPage);
                window.history.replaceState(null, '', `#${fallbackPage}`);
              }}
            />
          ) : (
            <>
              {activePage === 'overview' && (
                <MissionOverview
                  tributes={ARCHIVAL_TRIBUTES}
                  selectedTributeId={selectedTributeId}
                  crewProfile={personalCrewProfile}
                  vitals={activeVitals}
                  evaluation={evaluation}
                  onNavigate={handleSelectPage}
                  isMedicalChief={isMedicalChief}
                  crewRoster={effectiveCrewRoster}
                  onSelectCrew={handleSelectCrew}
                />
              )}

              {activePage === 'my-health' && (
                <MyHealth
                  crewProfile={personalCrewProfile}
                  vitals={activeVitals}
                  vitalsHistoryWindow={vitalsHistoryWindow}
                  evaluation={evaluation}
                  rules={evaluationRules}
                  timeframe={timeframe}
                  onChangeTimeframe={setTimeframe}
                  series={crewTelemetrySeries}
                  countermeasures={isMedicalChief ? selectedCrewCountermeasures : countermeasures}
                  healthHistory={healthHistory}
                  researchItems={RESEARCH_EVIDENCE_ITEMS}
                  pythonReport={pythonHealthReport}
                  pythonLoading={pythonHealthLoading}
                  pythonError={pythonHealthError}
                  hasUnacknowledgedCriticalAlert={Boolean(activeUnacknowledgedCriticalAlert)}
                  onOpenEmergencyAlert={() => {
                    if (isMedicalChief && activeUnacknowledgedCriticalAlert) {
                      handleSelectCrew(activeUnacknowledgedCriticalAlert.astronautId);
                      setInspectedAlert(activeUnacknowledgedCriticalAlert);
                    } else {
                      setEmergencyModalMinimized(false);
                    }
                  }}
                />
              )}

              {activePage === 'assessment' && (
                <HealthAssessment
                  crewProfile={personalCrewProfile}
                  readinessScore={readinessScore}
                  inputs={assessmentInputs}
                  submitted={assessmentSubmitted}
                  onUpdateInput={handleUpdateAssessmentInput}
                  onSubmit={() => void handleSubmitAssessment()}
                />
              )}

              {activePage === 'countermeasures' && (
                <Countermeasures
                  countermeasures={isMedicalChief ? selectedCrewCountermeasures : countermeasures}
                  compliance={countermeasureCompliance}
                  onToggleCountermeasure={(id) => void toggleCountermeasure(id)}
                />
              )}

              {activePage === 'history' && (
                <HealthHistory
                  crewProfile={personalCrewProfile}
                  records={filteredHistory}
                  statusFilter={historyFilter}
                  searchQuery={historySearch}
                  onChangeStatusFilter={setHistoryFilter}
                  onChangeSearchQuery={setHistorySearch}
                />
              )}

              {activePage === 'research' && (
                <ResearchEvidence
                  items={RESEARCH_EVIDENCE_ITEMS}
                  selectedId={selectedResearchId}
                  onSelect={setSelectedResearchId}
                />
              )}

              {activePage === 'medical-chief' && isMedicalChief && (
                <MedicalChiefWorkspace
                  crewRoster={effectiveCrewRoster}
                  selectedCrewId={selectedCrewId}
                  crewStatusFilter={crewStatusFilter}
                  newSurgeonNote={newSurgeonNote}
                  rules={evaluationRules}
                  alerts={alerts}
                  activeScenario={activeScenario}
                  series={crewTelemetrySeries}
                  countermeasures={selectedCrewCountermeasures}
                  researchItems={RESEARCH_EVIDENCE_ITEMS}
                  isFirestoreSeeded={crewRoster.length > 0}
                  isLocalDemoSession={isServerChiefSession}
                  provisionedAccounts={provisionedAccounts}
                  registeredUsers={registeredUsers}
                  auditLogs={auditLogs}
                  pythonReport={pythonHealthReport}
                  pythonLoading={pythonHealthLoading}
                  pythonError={pythonHealthError}
                  onSeedFourCrewDataset={async () => {
                    if (isServerChiefSession) {
                      initializeServerChiefWorkspaceState(false, true);
                      return;
                    }
                    await seedFourCrewMissionDataset({
                      actorUid: activeSessionProfile.userId,
                      actorEmail: activeSessionProfile.email,
                      rules: evaluationRules
                    });
                  }}
                  onSelectScenarioForCrew={handleSelectScenarioForCrew}
                  onSelectCrew={handleSelectCrew}
                  onChangeStatusFilter={setCrewStatusFilter}
                  onChangeSurgeonNote={setNewSurgeonNote}
                  onAddSurgeonNote={(e) => void handleAddSurgeonNote(e)}
                  onUpdateRuleThreshold={(k, f, v) => void handleUpdateRuleThreshold(k, f, v)}
                  onAcknowledgeAlert={(id) => void handleAcknowledgeAlert(id)}
                  onResolveAlert={(id) => void handleResolveAlert(id)}
                  onViewAlertDetails={(alert) => {
                    handleSelectCrew(alert.astronautId);
                    setInspectedAlert(alert);
                  }}
                  onProvisionAccount={async (payload) => {
                    if (isServerChiefSession) {
                      setProvisionedAccounts((prev) => [
                        ...prev.filter((p) => p.emailKey !== payload.email.toLowerCase()),
                        {
                          emailKey: payload.email.toLowerCase(),
                          email: payload.email.toLowerCase(),
                          displayName: payload.displayName,
                          role: payload.role,
                          crewId: payload.crewId,
                          missionRole: payload.missionRole,
                          provisionedBy: activeSessionProfile.userId
                        }
                      ]);
                      return;
                    }
                    await provisionAccountBinding({
                      ...payload,
                      actorUid: activeSessionProfile.userId,
                      actorEmail: activeSessionProfile.email
                    });
                    const refreshedUsers = await fetchAllUsersForChief();
                    setRegisteredUsers(refreshedUsers);
                  }}
                  onAssignExistingUser={async (payload) => {
                    if (isServerChiefSession) return;
                    await assignUserCrewRoleInDb({
                      targetUserId: payload.userId,
                      targetEmail: payload.email,
                      displayName: payload.displayName,
                      role: payload.role,
                      crewId: payload.crewId,
                      actorUid: activeSessionProfile.userId,
                      actorEmail: activeSessionProfile.email
                    });
                    const refreshedUsers = await fetchAllUsersForChief();
                    setRegisteredUsers(refreshedUsers);
                  }}
                  onChangeChiefPassword={handleChangeChiefPassword}
                />
              )}
            </>
          )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Development / Presentation Simulation Control Modal */}
      {demoModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Simulated Demonstration Controls"
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#02050D]/80"
        >
          <div className="w-full max-w-xl rounded-2xl ag-surface-elevated p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Simulated Telemetry Controls (
                  {isMedicalChief ? selectedCrewId : activeSessionProfile.crewId})
                </h2>
                <p className="text-xs text-slate-400">
                  {isSimulationSession
                    ? 'Trigger simulated SAFE, CAUTION, DANGER, or sensor-loss states isolated to this simulated crew session.'
                    : isServerChiefSession
                      ? 'Trigger simulated SAFE, CAUTION, DANGER, or sensor-loss states in this local demo workspace. No Firestore write occurs.'
                      : 'Trigger simulated SAFE, CAUTION, DANGER, or sensor-loss states persisted to Firestore.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDemoModalOpen(false)}
                aria-label="Close simulation controls"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <SimulationControlPanel
              activeScenario={activeScenario}
              onSelectScenario={(scenario) => {
                void handleSelectScenario(scenario);
                if (scenario === 'DANGER') {
                  setDemoModalOpen(false);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Prominent Foreground Emergency Modal for Affected Astronaut */}
      {activeUnacknowledgedCriticalAlert &&
        !emergencyModalMinimized &&
        !isMedicalChief && (
          <EmergencyAlertModal
            alert={activeUnacknowledgedCriticalAlert}
            canAcknowledge={false}
            biometricHistory={healthHistory}
            onAcknowledge={(id) => void handleAcknowledgeAlert(id)}
            onOpenDetailedHealth={() => {
              setEmergencyModalMinimized(true);
              handleSelectPage('my-health');
            }}
          />
        )}

      {/* Medical Chief Emergency Alert Inspection Modal */}
      {isMedicalChief && inspectedAlert && (
        <EmergencyAlertModal
          alert={alerts.find((a) => a.id === inspectedAlert.id) || inspectedAlert}
          canAcknowledge={true}
          biometricHistory={
            inspectedAlert.astronautId === selectedCrewId
              ? healthHistory
              : simHistoryByCrew[inspectedAlert.astronautId] ??
                getInitialHistoryForCrew(inspectedAlert.astronautId)
          }
          onAcknowledge={(id) => void handleAcknowledgeAlert(id)}
          onClose={() => setInspectedAlert(null)}
          onOpenDetailedHealth={() => {
            handleSelectCrew(inspectedAlert.astronautId);
            setInspectedAlert(null);
            handleSelectPage('my-health');
          }}
        />
      )}
    </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col">
      <AstroGuardBackdrop
        variant={activeSessionProfile ? 'workspace' : 'portal'}
        accentStatus={evaluation.status}
      />
      <div className="relative z-10 flex-1 flex flex-col">{pageView}</div>
    </div>
  );
}
