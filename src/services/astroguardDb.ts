import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { OperationType, auth, db, handleFirestoreError } from '../firebase';
import {
  AssessmentInputs,
  AuditLogEntry,
  CountermeasureItem,
  CrewRosterMember,
  EvaluationRule,
  HealthAlert,
  HealthEvaluationResult,
  HealthHistoryRecord,
  HealthIndicatorKey,
  ProvisionedAccount,
  SimulationScenarioId,
  SurgeonNote,
  TelemetryVitalsSnapshot,
  UserProfile,
  UserRole
} from '../types/astroguard';
import {
  CREW_ROSTER_DATA,
  HEALTH_HISTORY_RECORDS,
  INITIAL_COUNTERMEASURES,
  getAstronautIdentity
} from '../data/astroguardData';
import {
  DEFAULT_EVALUATION_RULES,
  SIMULATION_SCENARIOS,
  evaluateCrewHealth
} from '../engine/healthEvaluationEngine';

export const BOOTSTRAPPED_CHIEF_EMAIL = 'manikantadindawar21@gmail.com';

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
}

function getUtcLabel(): string {
  return `FD-084 • ${new Date().toISOString().slice(11, 19)} UTC`;
}

function getUtcTimeOnly(): string {
  return `${new Date().toISOString().slice(11, 19)} UTC`;
}

export async function writeAuditLog(params: {
  actorUserId: string;
  actorEmail: string;
  actorRole: UserRole | 'UNASSIGNED';
  action: string;
  targetRecord: string;
  details: string;
}): Promise<void> {
  const logId = sanitizeId(`LOG_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `auditLogs/${logId}`;
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      logId,
      actorUserId: params.actorUserId,
      actorEmail: params.actorEmail.slice(0, 254),
      actorRole: params.actorRole,
      action: params.action.slice(0, 120),
      targetRecord: params.targetRecord.slice(0, 200),
      details: params.details.slice(0, 500),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function resolveOrInitializeUserProfile(
  firebaseUser: User
): Promise<UserProfile> {
  const uid = firebaseUser.uid;
  const emailLower = (firebaseUser.email || '').trim().toLowerCase();
  const userPath = `users/${uid}`;

  let existingSnap;
  try {
    existingSnap = await getDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (existingSnap.exists()) {
    const data = existingSnap.data();
    return {
      userId: String(data.userId),
      email: String(data.email),
      displayName: String(data.displayName),
      role: data.role as UserRole,
      crewId: String(data.crewId),
      accountStatus: data.accountStatus as UserProfile['accountStatus']
    };
  }

  // Determine initial role strictly from bootstrapped chief email or Medical Chief pre-provisioned binding
  let assignedRole: UserRole = 'ASTRONAUT';
  let assignedCrewId = 'UNASSIGNED';
  let assignedStatus: UserProfile['accountStatus'] = 'PENDING';
  let displayName = firebaseUser.displayName || emailLower.split('@')[0] || 'AstroGuard User';

  if (emailLower === BOOTSTRAPPED_CHIEF_EMAIL) {
    assignedRole = 'MEDICAL_CHIEF';
    assignedCrewId = 'MCC-ALL';
    assignedStatus = 'ACTIVE';
    displayName = firebaseUser.displayName || 'Dr. M. Thorne (Medical Chief)';
  } else if (emailLower) {
    const provPath = `provisionedAccounts/${emailLower}`;
    try {
      const provSnap = await getDoc(doc(db, 'provisionedAccounts', emailLower));
      if (provSnap.exists()) {
        const prov = provSnap.data();
        assignedRole = prov.role as UserRole;
        assignedCrewId = String(prov.crewId);
        assignedStatus = 'ACTIVE';
        displayName = String(prov.displayName || displayName);
      }
    } catch {
      // No pre-provisioned binding found — falls back safely to PENDING ASTRONAUT
    }
  }

  const newProfile = {
    userId: uid,
    email: emailLower,
    displayName: displayName.slice(0, 120),
    role: assignedRole,
    crewId: assignedCrewId,
    accountStatus: assignedStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'users', uid), newProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  return {
    userId: uid,
    email: emailLower,
    displayName: newProfile.displayName,
    role: assignedRole,
    crewId: assignedCrewId,
    accountStatus: assignedStatus
  };
}

export async function provisionAccountBinding(params: {
  email: string;
  displayName: string;
  role: UserRole;
  crewId: string;
  missionRole: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const emailKey = params.email.trim().toLowerCase();
  const normalizedCrewId = params.role === 'MEDICAL_CHIEF' ? 'MCC-ALL' : params.crewId;
  const path = `provisionedAccounts/${emailKey}`;

  try {
    const existingProv = await getDoc(doc(db, 'provisionedAccounts', emailKey));
    if (existingProv.exists()) {
      await updateDoc(doc(db, 'provisionedAccounts', emailKey), {
        displayName: params.displayName.trim().slice(0, 120),
        role: params.role,
        crewId: normalizedCrewId,
        missionRole: params.missionRole.trim().slice(0, 120),
        provisionedBy: params.actorUid,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(doc(db, 'provisionedAccounts', emailKey), {
        emailKey,
        email: emailKey,
        displayName: params.displayName.trim().slice(0, 120),
        role: params.role,
        crewId: normalizedCrewId,
        missionRole: params.missionRole.trim().slice(0, 120),
        provisionedBy: params.actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  // If that user has already signed in once (PENDING), activate & bind their user doc immediately
  try {
    const existingUsers = await getDocs(
      query(collection(db, 'users'), where('email', '==', emailKey))
    );
    for (const uDoc of existingUsers.docs) {
      await updateDoc(doc(db, 'users', uDoc.id), {
        displayName: params.displayName.trim().slice(0, 120),
        role: params.role,
        crewId: normalizedCrewId,
        accountStatus: 'ACTIVE',
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'users');
  }

  await writeAuditLog({
    actorUserId: params.actorUid,
    actorEmail: params.actorEmail,
    actorRole: 'MEDICAL_CHIEF',
    action: 'PROVISION_ACCOUNT',
    targetRecord: path,
    details: `Provisioned ${emailKey} as ${params.role} (${normalizedCrewId}).`
  });
}

export async function seedFourCrewMissionDataset(params: {
  actorUid: string;
  actorEmail: string;
  rules?: Record<HealthIndicatorKey, EvaluationRule>;
}): Promise<void> {
  const activeRules = params.rules ?? DEFAULT_EVALUATION_RULES;
  const batch = writeBatch(db);
  const utcNow = getUtcLabel();

  const alreadySeeded = (await getDoc(doc(db, 'crew', 'AG-LEO-01'))).exists();
  const existingAlertsSnap = await getDocs(collection(db, 'alerts'));
  const openAlertKeys = new Set(
    existingAlertsSnap.docs
      .filter((d) => d.data().resolutionStatus !== 'RESOLVED')
      .map((d) => `${d.data().crewId}_${d.data().severity}`)
  );

  // Evaluation config
  batch.set(doc(db, 'evaluationConfig', 'default'), {
    configId: 'default',
    rules: activeRules,
    updatedBy: params.actorUid,
    updatedAt: serverTimestamp()
  });

  for (const member of CREW_ROSTER_DATA) {
    const scenarioId: SimulationScenarioId =
      member.id === 'AG-LEO-02'
        ? 'CAUTION'
        : member.id === 'AG-LEO-03'
          ? 'DANGER'
          : 'SAFE';
    const vitals = SIMULATION_SCENARIOS[scenarioId].vitals;
    const evaluation = evaluateCrewHealth(vitals, [vitals], activeRules);

    batch.set(doc(db, 'crew', member.id), {
      crewId: member.id,
      name: member.name,
      missionRole: member.role,
      missionId: 'ISS-EXP-74',
      missionDay: 'FD-084 / 180',
      orbitAltitude: '408 km LEO',
      inclination: '51.6°',
      bp: '116 / 74',
      readiness: member.readiness,
      isSimulated: true,
      updatedAt: serverTimestamp()
    });

    batch.set(doc(db, 'healthRecords', member.id), {
      crewId: member.id,
      evaluatedStatus: evaluation.status,
      statusHeadline: evaluation.statusHeadline,
      statusSubtext: evaluation.statusSubtext,
      primaryParameter: evaluation.primaryFinding?.label ?? '',
      primaryReading: evaluation.primaryFinding?.formattedReading ?? '',
      hasMissingCriticalData: evaluation.hasMissingCriticalData,
      hrv: member.hrv,
      readings: vitals,
      scenarioId,
      isSimulated: true,
      updatedBy: params.actorUid,
      updatedAt: serverTimestamp()
    });

    if (!alreadySeeded) {
      for (const h of HEALTH_HISTORY_RECORDS.slice(0, 4)) {
        const recId = sanitizeId(`${member.id}_${h.id}`);
        batch.set(doc(db, 'healthRecords', member.id, 'history', recId), {
          recordId: recId,
          crewId: member.id,
          date: h.date,
          phase: h.phase,
          metric: h.metric,
          value: h.value,
          baselineDelta: h.baselineDelta,
          status: h.status,
          createdAt: serverTimestamp()
        });
      }

      for (const cm of INITIAL_COUNTERMEASURES) {
        const cmRecId = sanitizeId(`${member.id}_${cm.id}`);
        batch.set(doc(db, 'countermeasureRecords', cmRecId), {
          recordId: cmRecId,
          crewId: member.id,
          countermeasureId: cm.id,
          code: cm.code,
          title: cm.title,
          category: cm.category,
          schedule: cm.schedule,
          target: cm.target,
          intensity: cm.intensity,
          duration: cm.duration,
          completionStatus: cm.completed
            ? 'COMPLETED'
            : cm.progress > 0
              ? 'IN_PROGRESS'
              : 'PENDING',
          progress: cm.progress,
          notes: cm.notes,
          updatedAt: serverTimestamp()
        });
      }

      for (let i = 0; i < member.notes.length; i++) {
        const n = member.notes[i];
        const noteId = sanitizeId(`NOTE_${member.id}_${i}`);
        batch.set(doc(db, 'surgeonNotes', noteId), {
          noteId,
          crewId: member.id,
          authorUserId: params.actorUid,
          author: n.author,
          time: n.time,
          text: n.text,
          createdAt: serverTimestamp()
        });
      }
    }

    // Create CAUTION/CRITICAL alert for AG-LEO-02 & AG-LEO-03 if not already open
    if (evaluation.status === 'CAUTION' || evaluation.status === 'DANGER') {
      const severity = evaluation.status === 'DANGER' ? 'CRITICAL' : 'CAUTION';
      if (!openAlertKeys.has(`${member.id}_${severity}`)) {
        const primary = evaluation.primaryFinding;
        const alertId = sanitizeId(`ALT_DEMO_${member.id}_${Date.now()}`);
        batch.set(doc(db, 'alerts', alertId), {
          alertId,
          crewId: member.id,
          astronautName: member.name,
          severity,
          affectedParameter: primary?.key ?? 'heartRate',
          parameterLabel: primary?.label ?? 'Physiological Telemetry',
          previousStatus: 'SAFE',
          newStatus: evaluation.status,
          currentReading: primary?.formattedReading ?? 'Simulated Excursion',
          previousReading: 'Nominal Baseline',
          associatedCountermeasure:
            primary?.recommendedCountermeasure ?? 'Follow Medical Chief directive.',
          message: evaluation.statusSubtext,
          acknowledgementStatus: 'UNACKNOWLEDGED',
          acknowledgedBy: '',
          acknowledgedByUid: '',
          acknowledgedAt: '',
          resolutionStatus: 'OPEN',
          resolvedBy: '',
          resolvedAt: '',
          timestampLabel: utcNow,
          isSimulated: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'mission-seed-batch');
  }

  await writeAuditLog({
    actorUserId: params.actorUid,
    actorEmail: params.actorEmail,
    actorRole: 'MEDICAL_CHIEF',
    action: 'SEED_FOUR_CREW_SIMULATION',
    targetRecord: 'crew/AG-LEO-01..04',
    details:
      'Initialized simulated 4-crew dataset: AG-LEO-01 SAFE, AG-LEO-02 CAUTION, AG-LEO-03 DANGER, AG-LEO-04 SAFE.'
  });
}

export async function updateCrewScenarioInDb(params: {
  crewId: string;
  astronautName: string;
  scenarioId: SimulationScenarioId;
  vitals: TelemetryVitalsSnapshot;
  evaluation: HealthEvaluationResult;
  hrv: number;
  actorUid: string;
  actorEmail: string;
  actorRole: UserRole;
  existingAlerts: HealthAlert[];
}): Promise<void> {
  const { crewId, evaluation, vitals, scenarioId, hrv, actorUid } = params;
  const healthPath = `healthRecords/${crewId}`;

  try {
    await setDoc(doc(db, 'healthRecords', crewId), {
      crewId,
      evaluatedStatus: evaluation.status,
      statusHeadline: evaluation.statusHeadline,
      statusSubtext: evaluation.statusSubtext,
      primaryParameter: evaluation.primaryFinding?.label ?? '',
      primaryReading: evaluation.primaryFinding?.formattedReading ?? '',
      hasMissingCriticalData: evaluation.hasMissingCriticalData,
      hrv,
      readings: vitals,
      scenarioId,
      isSimulated: true,
      updatedBy: actorUid,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, healthPath);
  }

  const utcStamp = getUtcLabel();
  const histId = sanitizeId(`HIST_${crewId}_${Date.now()}`);
  const primary = evaluation.primaryFinding;
  try {
    await setDoc(doc(db, 'healthRecords', crewId, 'history', histId), {
      recordId: histId,
      crewId,
      date: utcStamp,
      phase: 'Simulated Status Evaluation',
      metric: primary
        ? `${primary.label} (${evaluation.status})`
        : `All Channels (${evaluation.status})`,
      value: primary ? primary.formattedReading : 'All Channels Nominal',
      baselineDelta: primary?.previousReading
        ? `Prev: ${primary.previousReading}`
        : `Scenario: ${scenarioId}`,
      status:
        evaluation.status === 'DANGER'
          ? 'Critical'
          : evaluation.status === 'CAUTION'
            ? 'Monitored'
            : 'Nominal',
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${healthPath}/history/${histId}`);
  }

  // Generate centralized alert if CAUTION or DANGER, preventing duplicate open alerts for same parameter/severity
  if (evaluation.status === 'CAUTION' || evaluation.status === 'DANGER') {
    const severity = evaluation.status === 'DANGER' ? 'CRITICAL' : 'CAUTION';
    const paramKey = primary?.key ?? 'heartRate';

    const duplicateOpen = params.existingAlerts.some(
      (a) =>
        a.astronautId === crewId &&
        a.severity === severity &&
        a.parameterKey === paramKey &&
        a.resolutionStatus !== 'RESOLVED'
    );

    if (!duplicateOpen) {
      const alertId = sanitizeId(`ALT_${crewId}_${Date.now()}`);
      try {
        await setDoc(doc(db, 'alerts', alertId), {
          alertId,
          crewId,
          astronautName: params.astronautName,
          severity,
          affectedParameter: paramKey,
          parameterLabel: primary?.label ?? 'Physiological Telemetry',
          previousStatus: 'SAFE',
          newStatus: evaluation.status,
          currentReading: primary?.formattedReading ?? 'Simulated Excursion',
          previousReading: primary?.previousReading ?? 'Baseline Nominal',
          associatedCountermeasure:
            primary?.recommendedCountermeasure ?? 'Follow Medical Chief review guidance.',
          message: evaluation.statusSubtext,
          acknowledgementStatus: 'UNACKNOWLEDGED',
          acknowledgedBy: '',
          acknowledgedByUid: '',
          acknowledgedAt: '',
          resolutionStatus: 'OPEN',
          resolvedBy: '',
          resolvedAt: '',
          timestampLabel: utcStamp,
          isSimulated: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `alerts/${alertId}`);
      }
    }
  }

  await writeAuditLog({
    actorUserId: actorUid,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    action: 'SIMULATION_SCENARIO_TRIGGERED',
    targetRecord: healthPath,
    details: `Triggered ${scenarioId} (${evaluation.status}) for ${crewId}.`
  });
}

export async function acknowledgeAlertInDb(params: {
  alertId: string;
  actorLabel: string;
  actorUid: string;
  actorEmail: string;
  actorRole: UserRole;
}): Promise<void> {
  const path = `alerts/${params.alertId}`;
  const ackAt = getUtcTimeOnly();
  try {
    await updateDoc(doc(db, 'alerts', params.alertId), {
      acknowledgementStatus: 'ACKNOWLEDGED',
      acknowledgedBy: params.actorLabel.slice(0, 160),
      acknowledgedByUid: params.actorUid,
      acknowledgedAt: ackAt,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  await writeAuditLog({
    actorUserId: params.actorUid,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    action: 'ALERT_ACKNOWLEDGED',
    targetRecord: path,
    details: `Acknowledged by ${params.actorLabel} at ${ackAt}. Resolution status preserved.`
  });
}

export async function resolveAlertInDb(params: {
  alertId: string;
  actorLabel: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const path = `alerts/${params.alertId}`;
  const resAt = getUtcTimeOnly();
  try {
    await updateDoc(doc(db, 'alerts', params.alertId), {
      resolutionStatus: 'RESOLVED',
      resolvedBy: params.actorLabel.slice(0, 160),
      resolvedAt: resAt,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  await writeAuditLog({
    actorUserId: params.actorUid,
    actorEmail: params.actorEmail,
    actorRole: 'MEDICAL_CHIEF',
    action: 'ALERT_RESOLVED',
    targetRecord: path,
    details: `Alert resolved by ${params.actorLabel} at ${resAt}.`
  });
}

export async function toggleCountermeasureInDb(params: {
  crewId: string;
  item: CountermeasureItem;
}): Promise<void> {
  const recordId = sanitizeId(`${params.crewId}_${params.item.id}`);
  const nextCompleted = !params.item.completed;
  const path = `countermeasureRecords/${recordId}`;
  try {
    await setDoc(doc(db, 'countermeasureRecords', recordId), {
      recordId,
      crewId: params.crewId,
      countermeasureId: params.item.id,
      code: params.item.code,
      title: params.item.title,
      category: params.item.category,
      schedule: params.item.schedule,
      target: params.item.target,
      intensity: params.item.intensity,
      duration: params.item.duration,
      completionStatus: nextCompleted ? 'COMPLETED' : 'IN_PROGRESS',
      progress: nextCompleted ? 100 : 50,
      notes: params.item.notes,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function submitAssessmentInDb(params: {
  crewId: string;
  authorUserId: string;
  inputs: AssessmentInputs;
  readinessScore: number;
}): Promise<void> {
  const assessmentId = sanitizeId(`ASM_${params.crewId}_${Date.now()}`);
  const path = `healthRecords/${params.crewId}/assessments/${assessmentId}`;
  try {
    await setDoc(doc(db, 'healthRecords', params.crewId, 'assessments', assessmentId), {
      assessmentId,
      crewId: params.crewId,
      authorUserId: params.authorUserId,
      sleepQuality: params.inputs.sleepQuality,
      fatigueLevel: params.inputs.fatigueLevel,
      vestibularComfort: params.inputs.vestibularComfort,
      hydrationAdequacy: params.inputs.hydrationAdequacy,
      visualClarity: params.inputs.visualClarity,
      readinessScore: params.readinessScore,
      notes: params.inputs.notes.slice(0, 1000),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function addSurgeonNoteInDb(params: {
  crewId: string;
  authorUserId: string;
  authorEmail: string;
  authorLabel: string;
  text: string;
}): Promise<void> {
  const noteId = sanitizeId(`NOTE_${params.crewId}_${Date.now()}`);
  const path = `surgeonNotes/${noteId}`;
  const time = getUtcLabel();
  try {
    await setDoc(doc(db, 'surgeonNotes', noteId), {
      noteId,
      crewId: params.crewId,
      authorUserId: params.authorUserId,
      author: params.authorLabel.slice(0, 160),
      time,
      text: params.text.trim().slice(0, 1000),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  await writeAuditLog({
    actorUserId: params.authorUserId,
    actorEmail: params.authorEmail,
    actorRole: 'MEDICAL_CHIEF',
    action: 'SURGEON_NOTE_ADDED',
    targetRecord: path,
    details: `Clinical review note recorded for ${params.crewId}.`
  });
}

export async function updateEvaluationConfigInDb(params: {
  rules: Record<HealthIndicatorKey, EvaluationRule>;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const path = 'evaluationConfig/default';
  try {
    await setDoc(doc(db, 'evaluationConfig', 'default'), {
      configId: 'default',
      rules: params.rules,
      updatedBy: params.actorUid,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  await writeAuditLog({
    actorUserId: params.actorUid,
    actorEmail: params.actorEmail,
    actorRole: 'MEDICAL_CHIEF',
    action: 'EVALUATION_THRESHOLD_UPDATED',
    targetRecord: path,
    details: 'Updated centralized demonstration threshold configuration.'
  });
}

/**
 * Explicitly verifies backend Firestore isolation for a cross-crew URL/API request.
 * Throws a wrapped permission-denied error when Firestore rejects unauthorized access.
 */
export async function verifyAuthorizedCrewHealthAccess(crewId: string): Promise<boolean> {
  const path = `healthRecords/${crewId}`;
  try {
    await getDoc(doc(db, 'healthRecords', crewId));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeEvaluationConfig(
  onData: (rules: Record<HealthIndicatorKey, EvaluationRule>) => void
): () => void {
  return onSnapshot(
    doc(db, 'evaluationConfig', 'default'),
    (snap) => {
      if (snap.exists() && snap.data().rules) {
        onData(snap.data().rules as Record<HealthIndicatorKey, EvaluationRule>);
      }
    },
    (error) => handleFirestoreError(error, OperationType.GET, 'evaluationConfig/default')
  );
}

export function subscribeAstronautHealth(
  crewId: string,
  onRecord: (data: {
    vitals: TelemetryVitalsSnapshot;
    scenarioId: SimulationScenarioId;
    hrv: number;
    hasRecord: boolean;
  }) => void
): () => void {
  const path = `healthRecords/${crewId}`;
  return onSnapshot(
    doc(db, 'healthRecords', crewId),
    (snap) => {
      if (!snap.exists()) {
        onRecord({
          vitals: SIMULATION_SCENARIOS.SAFE.vitals,
          scenarioId: 'SAFE',
          hrv: 64,
          hasRecord: false
        });
        return;
      }
      const d = snap.data();
      onRecord({
        vitals: d.readings as TelemetryVitalsSnapshot,
        scenarioId: (d.scenarioId as SimulationScenarioId) || 'SAFE',
        hrv: Number(d.hrv ?? 64),
        hasRecord: true
      });
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export function subscribeAstronautHistory(
  crewId: string,
  onData: (items: HealthHistoryRecord[]) => void
): () => void {
  const path = `healthRecords/${crewId}/history`;
  const q = query(collection(db, 'healthRecords', crewId, 'history'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const rows: HealthHistoryRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.recordId || d.id),
          date: String(data.date),
          phase: String(data.phase),
          metric: String(data.metric),
          value: String(data.value),
          baselineDelta: String(data.baselineDelta),
          status: data.status as HealthHistoryRecord['status']
        };
      });
      onData(rows);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeAlerts(
  role: UserRole,
  crewId: string,
  onData: (alerts: HealthAlert[]) => void
): () => void {
  const q =
    role === 'MEDICAL_CHIEF'
      ? query(collection(db, 'alerts'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'alerts'), where('crewId', '==', crewId));

  return onSnapshot(
    q,
    (snap) => {
      const sortedDocs = [...snap.docs].sort((a, b) => {
        const ta = a.data().createdAt?.toMillis?.() ?? 0;
        const tb = b.data().createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });

      const list: HealthAlert[] = sortedDocs.map((d) => {
        const data = d.data();
        return {
          id: String(data.alertId || d.id),
          astronautId: String(data.crewId),
          astronautName: String(data.astronautName),
          parameterKey: data.affectedParameter as HealthAlert['parameterKey'],
          parameterLabel: String(data.parameterLabel),
          previousStatus: data.previousStatus as HealthAlert['previousStatus'],
          newStatus: data.newStatus as HealthAlert['newStatus'],
          severity: data.severity as HealthAlert['severity'],
          currentReading: String(data.currentReading),
          previousReading: String(data.previousReading),
          timestamp: String(data.timestampLabel),
          acknowledged: data.acknowledgementStatus === 'ACKNOWLEDGED',
          acknowledgedBy: data.acknowledgedBy ? String(data.acknowledgedBy) : null,
          acknowledgedAt: data.acknowledgedAt ? String(data.acknowledgedAt) : null,
          resolutionStatus: (data.resolutionStatus as HealthAlert['resolutionStatus']) || 'OPEN',
          resolvedBy: data.resolvedBy ? String(data.resolvedBy) : null,
          resolvedAt: data.resolvedAt ? String(data.resolvedAt) : null,
          associatedCountermeasure: String(data.associatedCountermeasure),
          message: String(data.message),
          isSimulated: true
        };
      });
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'alerts')
  );
}

export function subscribeCountermeasures(
  role: UserRole,
  crewId: string,
  onData: (items: CountermeasureItem[], crewMap: Record<string, CountermeasureItem[]>) => void
): () => void {
  const q =
    role === 'MEDICAL_CHIEF'
      ? query(collection(db, 'countermeasureRecords'))
      : query(collection(db, 'countermeasureRecords'), where('crewId', '==', crewId));

  return onSnapshot(
    q,
    (snap) => {
      const crewMap: Record<string, CountermeasureItem[]> = {};
      const ownItems: CountermeasureItem[] = [];

      snap.docs.forEach((d) => {
        const data = d.data();
        const item: CountermeasureItem = {
          id: String(data.countermeasureId),
          code: String(data.code),
          title: String(data.title),
          category: String(data.category),
          schedule: String(data.schedule),
          target: String(data.target),
          intensity: String(data.intensity),
          duration: String(data.duration),
          completed: data.completionStatus === 'COMPLETED',
          progress: Number(data.progress ?? 0),
          notes: String(data.notes)
        };
        const cid = String(data.crewId);
        if (!crewMap[cid]) crewMap[cid] = [];
        crewMap[cid].push(item);
        if (cid === crewId) {
          ownItems.push(item);
        }
      });

      onData(ownItems, crewMap);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'countermeasureRecords')
  );
}

export function subscribeMedicalChiefCrewRoster(
  onData: (members: CrewRosterMember[]) => void
): () => void {
  let crewDocs: Record<string, Record<string, unknown>> = {};
  let healthDocs: Record<string, Record<string, unknown>> = {};
  let notesDocs: Record<string, SurgeonNote[]> = {};

  const emit = () => {
    const ids = Object.keys(crewDocs).sort();
    if (ids.length === 0) {
      onData([]);
      return;
    }
    const members: CrewRosterMember[] = ids.map((cid) => {
      const c = crewDocs[cid] || {};
      const h = healthDocs[cid] || {};
      const vitals = (h.readings as TelemetryVitalsSnapshot) || SIMULATION_SCENARIOS.SAFE.vitals;
      const evalStatus = (h.evaluatedStatus as string) || 'SAFE';
      const status: CrewRosterMember['status'] =
        evalStatus === 'DANGER' ? 'Critical' : evalStatus === 'CAUTION' ? 'Watch' : 'Nominal';

      const identity = getAstronautIdentity(cid);

      return {
        id: cid,
        designationCode: identity?.designationCode,
        name: identity?.fullName || String(c.name || cid),
        rank: identity?.rank,
        role: String(c.missionRole || identity?.missionRole || 'Crew Member'),
        missionIncrement: identity?.missionIncrement,
        flightDay: String(c.missionDay || identity?.flightDay || 'FD-084 / 180'),
        portraitUrl: identity?.portraitUrl,
        portraitAttribution: identity?.portraitAttribution,
        portraitSource: identity?.portraitSource,
        status,
        hr: Number(vitals.heartRate ?? 0),
        hrv: Number(h.hrv ?? 64),
        spo2: Number(vitals.spo2 ?? 0),
        temp: Number(vitals.coreTemp ?? 36.8),
        radiation: Number(vitals.radiation ?? 0.42),
        readiness: Number(c.readiness ?? 90),
        lastSync: 'Firestore Sync (Sim)',
        alertNote: String(h.statusSubtext || 'All channels monitored.'),
        scenarioId: (h.scenarioId as SimulationScenarioId) || 'SAFE',
        vitals,
        notes: notesDocs[cid] || []
      };
    });
    onData(members);
  };

  const unsubCrew = onSnapshot(
    collection(db, 'crew'),
    (snap) => {
      crewDocs = {};
      snap.docs.forEach((d) => {
        crewDocs[d.id] = d.data();
      });
      emit();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'crew')
  );

  const unsubHealth = onSnapshot(
    collection(db, 'healthRecords'),
    (snap) => {
      healthDocs = {};
      snap.docs.forEach((d) => {
        healthDocs[d.id] = d.data();
      });
      emit();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'healthRecords')
  );

  const unsubNotes = onSnapshot(
    query(collection(db, 'surgeonNotes'), orderBy('createdAt', 'desc')),
    (snap) => {
      notesDocs = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const cid = String(data.crewId);
        if (!notesDocs[cid]) notesDocs[cid] = [];
        notesDocs[cid].push({
          id: d.id,
          time: String(data.time),
          author: String(data.author),
          text: String(data.text)
        });
      });
      emit();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'surgeonNotes')
  );

  return () => {
    unsubCrew();
    unsubHealth();
    unsubNotes();
  };
}

export function subscribeProvisionedAccounts(
  onData: (items: ProvisionedAccount[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'provisionedAccounts'),
    (snap) => {
      const items: ProvisionedAccount[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          emailKey: String(data.emailKey || d.id),
          email: String(data.email),
          displayName: String(data.displayName),
          role: data.role as UserRole,
          crewId: String(data.crewId),
          missionRole: String(data.missionRole),
          provisionedBy: String(data.provisionedBy)
        };
      });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'provisionedAccounts')
  );
}

export function subscribeAuditLogs(onData: (logs: AuditLogEntry[]) => void): () => void {
  const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const logs: AuditLogEntry[] = snap.docs.slice(0, 50).map((d) => {
        const data = d.data();
        const ts =
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString().slice(11, 19) + ' UTC'
            : 'Pending';
        return {
          id: String(data.logId || d.id),
          actorUserId: String(data.actorUserId),
          actorEmail: String(data.actorEmail),
          actorRole: data.actorRole as AuditLogEntry['actorRole'],
          action: String(data.action),
          targetRecord: String(data.targetRecord),
          details: String(data.details),
          timestamp: ts
        };
      });
      onData(logs);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'auditLogs')
  );
}

export async function fetchAllUsersForChief(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        userId: String(data.userId || d.id),
        email: String(data.email),
        displayName: String(data.displayName),
        role: data.role as UserRole,
        crewId: String(data.crewId),
        accountStatus: data.accountStatus as UserProfile['accountStatus']
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
}

export async function assignUserCrewRoleInDb(params: {
  targetUserId: string;
  targetEmail: string;
  displayName: string;
  role: UserRole;
  crewId: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const normalizedCrewId = params.role === 'MEDICAL_CHIEF' ? 'MCC-ALL' : params.crewId;
  const path = `users/${params.targetUserId}`;
  try {
    await updateDoc(doc(db, 'users', params.targetUserId), {
      displayName: params.displayName.trim().slice(0, 120),
      role: params.role,
      crewId: normalizedCrewId,
      accountStatus: 'ACTIVE',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  await writeAuditLog({
    actorUserId: params.actorUid,
    actorEmail: params.actorEmail,
    actorRole: 'MEDICAL_CHIEF',
    action: 'USER_ROLE_ASSIGNED',
    targetRecord: path,
    details: `Assigned ${params.targetEmail} -> ${params.role} (${normalizedCrewId}).`
  });
}

export function getAuthIdentityLabel(): string {
  return auth.currentUser?.email || auth.currentUser?.uid || 'Authenticated User';
}
