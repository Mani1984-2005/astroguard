import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ChevronDown, ChevronUp, Orbit, RotateCcw } from 'lucide-react';
import {
  CrewRosterMember,
  HealthStatusLevel,
  TelemetryVitalsSnapshot
} from '../../types/astroguard';
import {
  buildIssStationModel,
  createStudioEnvironment,
  disposeObject3D,
  prefersReducedMotion,
  probeWebGLCapabilities,
  scheduleAfterDraw
} from './webglUtils';

interface InteractiveCrewOrbitalViewportProps {
  crewRoster: CrewRosterMember[];
  selectedCrewId: string;
  onSelectCrew: (crewId: string) => void;
  selectedVitals?: TelemetryVitalsSnapshot;
  selectedEvalStatus?: HealthStatusLevel;
}

type CameraPreset = 'OVERVIEW' | 'FOCUS_CREW' | 'TOP_ORBIT';

interface CrewNodeDescriptor {
  crewId: string;
  moduleLabel: string;
  position: [number, number, number];
}

const CREW_MODULE_LAYOUT: CrewNodeDescriptor[] = [
  { crewId: 'AG-LEO-01', moduleLabel: 'Harmony Command Node', position: [0, 0.25, 1.38] },
  { crewId: 'AG-LEO-02', moduleLabel: 'Kibo Payload Lab', position: [0.85, 0.2, 0.72] },
  { crewId: 'AG-LEO-03', moduleLabel: 'Quest EVA Airlock', position: [-0.85, 0.2, 0.72] },
  { crewId: 'AG-LEO-04', moduleLabel: 'Destiny Bio-Med Bay', position: [0, 0.25, -0.92] }
];

function rosterStatusToHex(status: CrewRosterMember['status']): number {
  if (status === 'Critical') return 0xef4444;
  if (status === 'Watch') return 0xf59e0b;
  return 0x10b981;
}

function healthLevelToHex(level: HealthStatusLevel): number {
  if (level === 'DANGER') return 0xef4444;
  if (level === 'CAUTION') return 0xf59e0b;
  return 0x10b981;
}

const _rayPointer = new THREE.Vector2();
const _targetCamPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();

export function InteractiveCrewOrbitalViewport({
  crewRoster,
  selectedCrewId,
  onSelectCrew,
  selectedVitals,
  selectedEvalStatus = 'SAFE'
}: InteractiveCrewOrbitalViewportProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  const [hoveredCrewId, setHoveredCrewId] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('OVERVIEW');
  const [presetVersion, setPresetVersion] = useState(0);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const crewRosterRef = useRef(crewRoster);
  const selectedCrewIdRef = useRef(selectedCrewId);
  const onSelectCrewRef = useRef(onSelectCrew);
  const selectedVitalsRef = useRef(selectedVitals);
  const selectedStatusRef = useRef<HealthStatusLevel>(selectedEvalStatus);
  const presetRef = useRef<{ mode: CameraPreset; version: number; active: boolean }>({
    mode: 'OVERVIEW',
    version: 0,
    active: false
  });

  useEffect(() => {
    crewRosterRef.current = crewRoster;
  }, [crewRoster]);

  useEffect(() => {
    selectedCrewIdRef.current = selectedCrewId;
    presetRef.current = {
      mode: cameraPreset === 'TOP_ORBIT' ? 'TOP_ORBIT' : 'FOCUS_CREW',
      version: presetRef.current.version + 1,
      active: true
    };
  }, [selectedCrewId, cameraPreset]);

  useEffect(() => {
    onSelectCrewRef.current = onSelectCrew;
  }, [onSelectCrew]);

  useEffect(() => {
    selectedVitalsRef.current = selectedVitals;
  }, [selectedVitals]);

  useEffect(() => {
    selectedStatusRef.current = selectedEvalStatus;
  }, [selectedEvalStatus]);

  useEffect(() => {
    presetRef.current = {
      mode: cameraPreset,
      version: presetVersion,
      active: true
    };
  }, [cameraPreset, presetVersion]);

  const selectedMember = useMemo(
    () => crewRoster.find((c) => c.id === selectedCrewId) || crewRoster[0],
    [crewRoster, selectedCrewId]
  );

  const hoveredMember = useMemo(
    () => (hoveredCrewId ? crewRoster.find((c) => c.id === hoveredCrewId) || null : null),
    [crewRoster, hoveredCrewId]
  );

  useEffect(() => {
    if (collapsed) return;
    const container = mountRef.current;
    if (!container) return;

    const { webglAvailable, isSoftwareGl } = probeWebGLCapabilities();
    if (!webglAvailable) {
      setWebglOk(false);
      return;
    }

    const reducedMotion = prefersReducedMotion();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch {
      setWebglOk(false);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 300);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      40,
      (container.clientWidth || 640) / Math.max(container.clientHeight || 300, 1),
      0.1,
      80
    );
    camera.position.set(4.1, 2.8, 4.9);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 10.5;
    controls.maxPolarAngle = Math.PI * 0.82;
    controls.target.set(0, 0.1, 0.15);

    const cancelAutoCamera = () => {
      presetRef.current.active = false;
    };
    controls.addEventListener('start', cancelAutoCamera);

    const envTexture = createStudioEnvironment(renderer);
    scene.environment = envTexture;

    // 3-Point Orbital Station Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xfff3db, 2.1);
    keyLight.position.set(6, 7, 5);
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0x38bdf8, 0x050b16, 0.78);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimLight.position.set(-6, -2, -5);
    scene.add(rimLight);

    const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    const { group: stationGroup } = buildIssStationModel(maxAnisotropy);
    scene.add(stationGroup);

    // Subtle orbital telemetry grid plane beneath the station
    const gridRingGeo = new THREE.RingGeometry(2.9, 2.93, 72);
    const gridRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    const gridRing = new THREE.Mesh(gridRingGeo, gridRingMat);
    gridRing.rotation.x = Math.PI / 2;
    gridRing.position.y = -0.58;
    scene.add(gridRing);

    const innerRingGeo = new THREE.RingGeometry(1.75, 1.77, 64);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x105bd8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = -0.58;
    scene.add(innerRing);

    // Interactive Crew Module Beacons (AG-LEO-01..04)
    const hitProxies: THREE.Mesh[] = [];
    const crewVisuals = new Map<
      string,
      {
        position: THREE.Vector3;
        coreMat: THREE.MeshStandardMaterial;
        ringMat: THREE.MeshBasicMaterial;
        rippleMesh: THREE.Mesh;
        rippleMat: THREE.MeshBasicMaterial;
        pillarMesh: THREE.Mesh;
      }
    >();

    const nodeGeo = new THREE.OctahedronGeometry(0.14, 1);
    const ringGeo = new THREE.TorusGeometry(0.24, 0.018, 10, 32);
    const rippleGeo = new THREE.RingGeometry(0.22, 0.26, 32);
    const proxyGeo = new THREE.SphereGeometry(0.38, 12, 12);
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const pillarGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.42, 10);

    CREW_MODULE_LAYOUT.forEach((node) => {
      const group = new THREE.Group();
      group.position.set(node.position[0], node.position[1], node.position[2]);
      scene.add(group);

      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x10b981,
        emissiveIntensity: 0.75,
        metalness: 0.35,
        roughness: 0.2
      });
      const coreMesh = new THREE.Mesh(nodeGeo, coreMat);
      coreMesh.position.y = 0.22;
      group.add(coreMesh);

      const pillarMesh = new THREE.Mesh(pillarGeo, coreMat);
      pillarMesh.position.y = 0.02;
      group.add(pillarMesh);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.85
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.22;
      group.add(ringMesh);

      const rippleMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide
      });
      const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
      rippleMesh.rotation.x = Math.PI / 2;
      rippleMesh.position.y = 0.22;
      group.add(rippleMesh);

      const proxy = new THREE.Mesh(proxyGeo, proxyMat);
      proxy.position.y = 0.22;
      proxy.userData.crewId = node.crewId;
      group.add(proxy);
      hitProxies.push(proxy);

      crewVisuals.set(node.crewId, {
        position: new THREE.Vector3(node.position[0], node.position[1] + 0.22, node.position[2]),
        coreMat,
        ringMat,
        rippleMesh,
        rippleMat,
        pillarMesh
      });
    });

    // Live 3D Biometric Pillar Array on Fore Telemetry Pad (HR, SpO2, Cabin O2, Radiation)
    const telemetryBarsGroup = new THREE.Group();
    telemetryBarsGroup.position.set(0, -0.56, 2.28);
    scene.add(telemetryBarsGroup);

    const barBaseGeo = new THREE.BoxGeometry(0.14, 1, 0.14);
    const barSpecs = [
      { key: 'hr', x: -0.45, color: 0x38bdf8 },
      { key: 'spo2', x: -0.15, color: 0x10b981 },
      { key: 'o2', x: 0.15, color: 0x0ea5e9 },
      { key: 'rad', x: 0.45, color: 0xf59e0b }
    ] as const;

    const barMeshes: Record<string, { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial }> = {};
    barSpecs.forEach((spec) => {
      const mat = new THREE.MeshStandardMaterial({
        color: spec.color,
        emissive: spec.color,
        emissiveIntensity: 0.45,
        metalness: 0.25,
        roughness: 0.28
      });
      const mesh = new THREE.Mesh(barBaseGeo, mat);
      mesh.position.set(spec.x, 0.25, 0);
      mesh.scale.y = 0.5;
      telemetryBarsGroup.add(mesh);
      barMeshes[spec.key] = { mesh, mat };
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting for Click Selection & Throttled Hover
    const raycaster = new THREE.Raycaster();
    let lastHoverTime = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const pickCrewAtEvent = (e: PointerEvent): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      _rayPointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _rayPointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_rayPointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.crewId;
        return typeof hitId === 'string' ? hitId : null;
      }
      return null;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 35) return;
      lastHoverTime = now;
      const crewId = pickCrewAtEvent(e);
      setHoveredCrewId((prev) => (prev === crewId ? prev : crewId));
      renderer.domElement.style.cursor = crewId ? 'pointer' : 'grab';
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moved > 7) return; // Ignore drag orbits
      const crewId = pickCrewAtEvent(e);
      if (crewId) {
        onSelectCrewRef.current(crewId);
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const handleResize = () => {
      const w = container.clientWidth || 640;
      const h = Math.max(container.clientHeight || 300, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);

    let contextLost = false;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    let rafId = 0;
    let timerId = 0;
    let disposed = false;
    let elapsed = 0;
    const clock = new THREE.Clock();

    const updateFrame = (delta: number) => {
      elapsed += delta;
      const currentRoster = crewRosterRef.current;
      const activeId = selectedCrewIdRef.current;

      // Update per-crew 3D beacon status & selected state
      crewVisuals.forEach((vis, crewId) => {
        const member = currentRoster.find((c) => c.id === crewId);
        const isSelected = crewId === activeId;
        const statusColor = member ? rosterStatusToHex(member.status) : 0x10b981;
        const isCritical = member?.status === 'Critical';

        vis.coreMat.color.setHex(isSelected ? 0xffffff : statusColor);
        vis.coreMat.emissive.setHex(statusColor);
        vis.coreMat.emissiveIntensity = isSelected ? 1.35 : 0.7;
        vis.ringMat.color.setHex(isSelected ? 0x38bdf8 : statusColor);
        vis.ringMat.opacity = isSelected ? 1 : 0.72;
        vis.pillarMesh.scale.y = isSelected ? 1.35 : 0.95;

        if ((isCritical || isSelected) && !reducedMotion) {
          const wave = (elapsed * (isCritical ? 1.4 : 0.75)) % 1;
          const s = 1 + wave * 1.45;
          vis.rippleMesh.scale.set(s, s, 1);
          vis.rippleMat.color.setHex(isCritical ? 0xef4444 : 0x38bdf8);
          vis.rippleMat.opacity = (1 - wave) * (isCritical ? 0.85 : 0.45);
        } else {
          vis.rippleMat.opacity = isCritical ? 0.5 : 0;
          vis.rippleMesh.scale.set(1.3, 1.3, 1);
        }
      });

      // Update 4 biometric telemetry bars for the selected crew member
      const vitals = selectedVitalsRef.current;
      const statusHex = healthLevelToHex(selectedStatusRef.current);
      if (vitals) {
        const hrNorm = THREE.MathUtils.clamp(((vitals.heartRate ?? 68) - 40) / 110, 0.15, 1.0);
        const spo2Norm = THREE.MathUtils.clamp(((vitals.spo2 ?? 98) - 80) / 20, 0.15, 1.0);
        const o2Norm = THREE.MathUtils.clamp(((vitals.cabinOxygen ?? 20.9) - 16) / 6, 0.15, 1.0);
        const radNorm = THREE.MathUtils.clamp((vitals.radiation ?? 0.42) / 1.0, 0.18, 1.0);

        const updates: Array<[string, number]> = [
          ['hr', hrNorm],
          ['spo2', spo2Norm],
          ['o2', o2Norm],
          ['rad', radNorm]
        ];
        updates.forEach(([key, norm]) => {
          const entry = barMeshes[key];
          if (!entry) return;
          const targetHeight = 0.22 + norm * 0.78;
          entry.mesh.scale.y = THREE.MathUtils.damp(entry.mesh.scale.y, targetHeight, 5, delta);
          entry.mesh.position.y = entry.mesh.scale.y * 0.5;
          entry.mat.emissive.setHex(selectedStatusRef.current === 'DANGER' ? statusHex : entry.mat.color.getHex());
        });
      }

      // Smooth camera transition for preset buttons or crew selection
      if (presetRef.current.active) {
        const mode = presetRef.current.mode;
        if (mode === 'TOP_ORBIT') {
          _targetCamPos.set(0.2, 6.4, 2.3);
          _targetLook.set(0, 0, 0.15);
        } else if (mode === 'FOCUS_CREW') {
          const nodeVis = crewVisuals.get(activeId);
          if (nodeVis) {
            _targetLook.copy(nodeVis.position);
            _targetCamPos.set(
              nodeVis.position.x + 2.15,
              nodeVis.position.y + 1.65,
              nodeVis.position.z + 2.55
            );
          } else {
            _targetCamPos.set(4.1, 2.8, 4.9);
            _targetLook.set(0, 0.1, 0.15);
          }
        } else {
          _targetCamPos.set(4.1, 2.8, 4.9);
          _targetLook.set(0, 0.1, 0.15);
        }

        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 4.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 4.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 4.5, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLook.x, 4.5, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLook.y, 4.5, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLook.z, 4.5, delta);

        if (camera.position.distanceTo(_targetCamPos) < 0.04) {
          presetRef.current.active = false;
        }
      }

      controls.update();
    };

    updateFrame(0.016);
    renderer.render(scene, camera);

    const tick = () => {
      if (disposed) return;
      if (!contextLost && !document.hidden) {
        const delta = Math.min(clock.getDelta(), 0.1);
        updateFrame(delta);
        renderer.render(scene, camera);
      } else {
        clock.getDelta();
      }

      if (isSoftwareGl) {
        scheduleAfterDraw(renderer, tick, (id) => {
          timerId = id;
        });
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      scheduleAfterDraw(renderer, tick, (id) => {
        timerId = id;
      });
    } else {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      controls.removeEventListener('start', cancelAutoCamera);
      controls.dispose();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      disposeObject3D(scene);
      envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [collapsed]);

  return (
    <div className="rounded-xl ag-surface-elevated overflow-hidden">
      {/* Header Bar */}
      <div className="px-4 py-2.5 border-b border-white/10 bg-[#071124]/90 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Orbit className="w-5 h-5 text-sky-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-mono uppercase tracking-[0.16em] text-sky-300 truncate">
              3D ORBITAL STATION &amp; CREW MODULE MONITOR
            </div>
            <div className="text-xs text-slate-400 truncate">
              Click any 3D station beacon (AG-LEO-01..04) to synchronize portrait &amp; telemetry
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#030712]/80 hover:bg-white/10 border border-white/12 text-xs font-mono text-slate-200 transition-colors whitespace-nowrap shrink-0"
        >
          <span>{collapsed ? 'Expand 3D View' : 'Minimize'}</span>
          {collapsed ? <ChevronDown className="w-4 h-4 text-sky-400" /> : <ChevronUp className="w-4 h-4 text-sky-400" />}
        </button>
      </div>

      {!collapsed && (
        <div className="relative">
          {webglOk ? (
            <div
              ref={mountRef}
              className="w-full h-64 sm:h-72 lg:h-80 bg-[#030712]/80 select-none"
              aria-label="Interactive 3D ISS orbital crew station visualization"
            />
          ) : (
            <div className="w-full h-56 bg-[#030712]/85 flex flex-col items-center justify-center p-4 text-center space-y-2">
              <Orbit className="w-8 h-8 text-sky-400" />
              <div className="text-sm font-semibold text-white">
                2D Orbital Fallback Active (WebGL Context Unavailable)
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {crewRoster.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectCrew(m.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors whitespace-nowrap ${
                      m.id === selectedCrewId
                        ? 'bg-[#105BD8] border-[#38BDF8] text-white'
                        : 'bg-[#0A1428] border-white/15 text-slate-300'
                    }`}
                  >
                    {m.id} · {m.status.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Top-Left Subject Focus Readout (zero backdrop-filter over WebGL) */}
          {webglOk && (hoveredMember || selectedMember) && (
            <div className="pointer-events-none absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-[#030712]/88 border border-sky-400/25 text-xs font-mono space-y-0.5 max-w-[78%]">
              <div className="text-sky-300 font-semibold truncate">
                {hoveredMember
                  ? `HOVER: ${hoveredMember.id} · ${hoveredMember.name}`
                  : `LOCKED: ${selectedMember.id} · ${selectedMember.name}`}
              </div>
              <div className="text-slate-300 truncate tabular-nums">
                {
                  CREW_MODULE_LAYOUT.find(
                    (n) => n.crewId === (hoveredMember?.id || selectedMember?.id)
                  )?.moduleLabel
                }{' '}
                · HR {hoveredMember ? hoveredMember.hr : selectedVitals?.heartRate ?? selectedMember.hr ?? '--'} BPM · SpO2{' '}
                {hoveredMember ? hoveredMember.spo2 : selectedVitals?.spo2 ?? selectedMember.spo2 ?? '--'}%
              </div>
            </div>
          )}

          {/* Bottom Control & Biometric Legend Dock (zero backdrop-filter) */}
          <div className="px-3.5 py-2.5 bg-[#030712]/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-2 text-slate-300">
              <span className="text-sky-400">3D PILLARS:</span>
              <span>HR</span>
              <span className="text-slate-600">/</span>
              <span className="text-emerald-300">SpO2</span>
              <span className="text-slate-600">/</span>
              <span className="text-sky-300">O2</span>
              <span className="text-slate-600">/</span>
              <span className="text-amber-300">RAD</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['OVERVIEW', 'Overview'],
                  ['FOCUS_CREW', 'Focus Crew'],
                  ['TOP_ORBIT', 'Top Orbit']
                ] as const
              ).map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setCameraPreset(preset);
                    setPresetVersion((v) => v + 1);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors whitespace-nowrap ${
                    cameraPreset === preset
                      ? 'bg-[#105BD8] text-white'
                      : 'bg-[#0A1428] text-slate-300 hover:text-white border border-white/12'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setCameraPreset('OVERVIEW');
                  setPresetVersion((v) => v + 1);
                }}
                aria-label="Reset 3D station camera"
                title="Reset 3D camera"
                className="px-2.5 py-1 rounded-md bg-[#0A1428] hover:bg-white/10 border border-white/12 text-slate-300 hover:text-white inline-flex items-center gap-1 whitespace-nowrap transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InteractiveCrewOrbitalViewport;
