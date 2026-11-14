import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { HealthStatusLevel } from '../../types/astroguard';
import {
  buildIssStationModel,
  buildRelaySatelliteModel,
  buildSentinelSatelliteModel,
  createEarthTextures,
  disposeObject3D,
  getStatusHexColor
} from './webglUtils';
import {
  loadOptionalEarthAssets,
  loadOptionalSatelliteModel
} from './orbitalAssets';

export interface EarthProps {
  variant: 'portal' | 'workspace';
  accentStatus?: HealthStatusLevel;
  isSoftwareGl?: boolean;
  reducedMotion?: boolean;
  sunDirection?: [number, number, number];
  showSolidPlanet?: boolean;
  customCenter?: { x: number; y: number; scale: number };
}

// Module-scope reusable math helpers to prevent per-frame GC allocations
const _targetOrbitColor = new THREE.Color();
const _sunDirection = new THREE.Vector3(12, 7, 10).normalize();
const _normalScale = new THREE.Vector2(0.85, 0.85);

const EARTH_RADIUS = 3.92;
const AXIAL_TILT_RAD = THREE.MathUtils.degToRad(23.4);

// Three distinct orbital bands with realistic inclinations, altitudes, and velocities
const ORBIT_PRIMARY_RADIUS = 5.15;
const ORBIT_PRIMARY_TILT: [number, number, number] = [
  THREE.MathUtils.degToRad(22),
  0,
  THREE.MathUtils.degToRad(-28)
];

const ORBIT_RELAY_RADIUS = 5.92;
const ORBIT_RELAY_TILT: [number, number, number] = [
  THREE.MathUtils.degToRad(-18),
  THREE.MathUtils.degToRad(24),
  THREE.MathUtils.degToRad(18)
];

const ORBIT_SENTINEL_RADIUS = 5.52;
const ORBIT_SENTINEL_TILT: [number, number, number] = [
  THREE.MathUtils.degToRad(58),
  THREE.MathUtils.degToRad(-18),
  THREE.MathUtils.degToRad(14)
];

export function Earth({
  variant,
  accentStatus = 'SAFE',
  isSoftwareGl = false,
  reducedMotion = false,
  sunDirection,
  showSolidPlanet = true,
  customCenter
}: EarthProps) {
  useEffect(() => {
    if (sunDirection) {
      _sunDirection.set(sunDirection[0], sunDirection[1], sunDirection[2]).normalize();
    }
  }, [sunDirection]);

  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);

  const isDesktop = size.width >= 1024;
  const isTablet = size.width >= 640 && size.width < 1024;

  const worldGroupRef = useRef<THREE.Group | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const cloudMeshRef = useRef<THREE.Mesh | null>(null);
  const primaryOrbitMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  const primarySatRef = useRef<THREE.Group | null>(null);
  const relaySatRef = useRef<THREE.Group | null>(null);
  const sentinelSatRef = useRef<THREE.Group | null>(null);

  const primaryAngleRef = useRef<number>(-0.55);
  const relayAngleRef = useRef<number>(1.85);
  const sentinelAngleRef = useRef<number>(3.65);

  const maxAnisotropy = useMemo(
    () => Math.min(gl.capabilities.getMaxAnisotropy(), 4),
    [gl]
  );

  // Immediate procedural Earth textures (day albedo, night city lights, normal relief, clouds, ocean roughness)
  const proceduralTextures = useMemo(
    () => createEarthTextures(maxAnisotropy, !isSoftwareGl),
    [maxAnisotropy, isSoftwareGl]
  );

  // Optional user-supplied overrides loaded asynchronously from public/assets/earth/
  const [userEarthMaps, setUserEarthMaps] = useState<{
    dayMap: THREE.Texture | null;
    nightMap: THREE.Texture | null;
    normalMap: THREE.Texture | null;
    cloudMap: THREE.Texture | null;
  }>({ dayMap: null, nightMap: null, normalMap: null, cloudMap: null });

  const [userSatellites, setUserSatellites] = useState<{
    primary: THREE.Group | null;
    relay: THREE.Group | null;
    sentinel: THREE.Group | null;
  }>({ primary: null, relay: null, sentinel: null });

  useEffect(() => {
    let active = true;
    void loadOptionalEarthAssets(maxAnisotropy).then((loaded) => {
      if (!active) {
        loaded.dayMap?.dispose();
        loaded.nightMap?.dispose();
        loaded.normalMap?.dispose();
        loaded.cloudMap?.dispose();
        return;
      }
      if (loaded.dayMap || loaded.nightMap || loaded.normalMap || loaded.cloudMap) {
        setUserEarthMaps(loaded);
      }
    });

    void Promise.all([
      loadOptionalSatelliteModel('primary', 1.4),
      loadOptionalSatelliteModel('relay', 1.15),
      loadOptionalSatelliteModel('sentinel', 1.1)
    ]).then(([primary, relay, sentinel]) => {
      if (!active) {
        if (primary) disposeObject3D(primary);
        if (relay) disposeObject3D(relay);
        if (sentinel) disposeObject3D(sentinel);
        return;
      }
      if (primary || relay || sentinel) {
        setUserSatellites({ primary, relay, sentinel });
      }
    });

    return () => {
      active = false;
    };
  }, [maxAnisotropy]);

  const activeDayMap = userEarthMaps.dayMap || proceduralTextures.surfaceMap;
  const activeNightMap = userEarthMaps.nightMap || proceduralTextures.nightMap;
  const activeNormalMap = userEarthMaps.normalMap || proceduralTextures.normalMap;
  const activeCloudMap = userEarthMaps.cloudMap || proceduralTextures.cloudsMap;

  // PBR Earth Surface Material extended with smooth Twilight Terminator Scattering + City-Light shader
  const earthSurfaceMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: activeDayMap,
      normalMap: activeNormalMap,
      normalScale: _normalScale,
      roughnessMap: proceduralTextures.roughnessMap,
      roughness: 0.78,
      metalness: 0.08
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uNightMap = { value: activeNightMap };
      shader.uniforms.uSunDir = { value: _sunDirection };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vWorldNormalAg;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vWorldNormalAg = normalize(mat3(modelMatrix) * normal);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform sampler2D uNightMap;
           uniform vec3 uSunDir;
           varying vec3 vWorldNormalAg;`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           float sunDot = dot(normalize(vWorldNormalAg), normalize(uSunDir));
           float nightFactor = smoothstep(0.12, -0.22, sunDot);
           float twilightBand = smoothstep(-0.18, 0.02, sunDot) * (1.0 - smoothstep(0.02, 0.2, sunDot));
           vec3 cityLights = texture2D(uNightMap, vMapUv).rgb;
           totalEmissiveRadiance += cityLights * nightFactor * 1.65;
           totalEmissiveRadiance += vec3(0.09, 0.24, 0.48) * twilightBand * 0.24;`
        );
    };

    mat.customProgramCacheKey = () =>
      `ag-earth-daynight-v2-${activeNightMap.uuid}-${activeDayMap.uuid}`;

    return mat;
  }, [activeDayMap, activeNightMap, activeNormalMap, proceduralTextures.roughnessMap]);

  // Dual-layer Atmospheric Rayleigh Scattering Shader (Outer Limb Halo + Inner Atmospheric Veil)
  const outerAtmosphereMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uSunDir: { value: _sunDirection },
          uCoreColor: { value: new THREE.Color(0x1d4ed8) },
          uLimbColor: { value: new THREE.Color(0x67e8f9) }
        },
        vertexShader: `
          varying vec3 vViewNormal;
          varying vec3 vWorldNormal;
          void main() {
            vViewNormal = normalize(normalMatrix * normal);
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uSunDir;
          uniform vec3 uCoreColor;
          uniform vec3 uLimbColor;
          varying vec3 vViewNormal;
          varying vec3 vWorldNormal;
          void main() {
            float rim = pow(clamp(0.74 - dot(vViewNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.5);
            float sunWeight = smoothstep(-0.45, 0.58, dot(normalize(vWorldNormal), normalize(uSunDir)));
            vec3 col = mix(uCoreColor * 0.62, uLimbColor, sunWeight);
            float alpha = clamp(rim * (0.26 + 0.72 * sunWeight), 0.0, 0.9);
            gl_FragColor = vec4(col, alpha);
          }
        `
      }),
    []
  );

  const innerAtmosphereMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uSunDir: { value: _sunDirection },
          uTint: { value: new THREE.Color(0x38bdf8) }
        },
        vertexShader: `
          varying vec3 vViewNormal;
          varying vec3 vWorldNormal;
          varying vec3 vViewDir;
          void main() {
            vViewNormal = normalize(normalMatrix * normal);
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewDir = normalize(-mvPosition.xyz);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 uSunDir;
          uniform vec3 uTint;
          varying vec3 vViewNormal;
          varying vec3 vWorldNormal;
          varying vec3 vViewDir;
          void main() {
            float fresnel = pow(1.0 - max(dot(vViewNormal, vViewDir), 0.0), 3.4);
            float sunWeight = smoothstep(-0.35, 0.65, dot(normalize(vWorldNormal), normalize(uSunDir)));
            float alpha = clamp(fresnel * (0.14 + 0.52 * sunWeight), 0.0, 0.6);
            gl_FragColor = vec4(uTint, alpha);
          }
        `
      }),
    []
  );

  // Composite Procedural Spacecraft Fleet (automatically swapped if user drops GLB/GLTF models)
  const proceduralFleet = useMemo(() => {
    return {
      primary: buildIssStationModel(maxAnisotropy),
      relay: buildRelaySatelliteModel(maxAnisotropy),
      sentinel: buildSentinelSatelliteModel(maxAnisotropy)
    };
  }, [maxAnisotropy]);

  const activePrimaryGroup = userSatellites.primary || proceduralFleet.primary.group;
  const activeRelayGroup = userSatellites.relay || proceduralFleet.relay.group;
  const activeSentinelGroup = userSatellites.sentinel || proceduralFleet.sentinel.group;

  // Clean GPU resource disposal on unmount
  useEffect(() => {
    return () => {
      proceduralTextures.surfaceMap.dispose();
      proceduralTextures.nightMap.dispose();
      proceduralTextures.normalMap.dispose();
      proceduralTextures.cloudsMap.dispose();
      proceduralTextures.roughnessMap.dispose();
      outerAtmosphereMaterial.dispose();
      innerAtmosphereMaterial.dispose();
      disposeObject3D(proceduralFleet.primary.group);
      disposeObject3D(proceduralFleet.relay.group);
      disposeObject3D(proceduralFleet.sentinel.group);
    };
  }, [
    proceduralTextures,
    outerAtmosphereMaterial,
    innerAtmosphereMaterial,
    proceduralFleet
  ]);

  useEffect(() => {
    return () => {
      earthSurfaceMaterial.dispose();
    };
  }, [earthSurfaceMaterial]);

  useEffect(() => {
    return () => {
      userEarthMaps.dayMap?.dispose();
      userEarthMaps.nightMap?.dispose();
      userEarthMaps.normalMap?.dispose();
      userEarthMaps.cloudMap?.dispose();
    };
  }, [userEarthMaps]);

  useEffect(() => {
    return () => {
      if (userSatellites.primary) disposeObject3D(userSatellites.primary);
      if (userSatellites.relay) disposeObject3D(userSatellites.relay);
      if (userSatellites.sentinel) disposeObject3D(userSatellites.sentinel);
    };
  }, [userSatellites]);

  const sphereSegments: [number, number] = isSoftwareGl ? [40, 28] : [64, 48];
  const shellSegments: [number, number] = isSoftwareGl ? [32, 22] : [56, 40];

  // Responsive world framing:
  // - Portal desktop: Left / Central 55-65% hero Earth
  // - Portal tablet/mobile: Centered upper showcase
  // - Workspace: Subtle right-lower orbital presence behind dashboards
  const targetLayout = (() => {
    if (customCenter) {
      return customCenter;
    }
    if (variant === 'portal') {
      if (isDesktop) {
        return { x: -1.65, y: -0.06, scale: 1.04 };
      }
      if (isTablet) {
        return { x: 0, y: 0.95, scale: 0.86 };
      }
      return { x: 0, y: 1.25, scale: 0.72 };
    }
    return { x: 3.3, y: -1.05, scale: 0.95 };
  })();

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const worldGroup = worldGroupRef.current;

    if (worldGroup) {
      worldGroup.position.x = THREE.MathUtils.damp(worldGroup.position.x, targetLayout.x, 3.2, delta);
      worldGroup.position.y = THREE.MathUtils.damp(worldGroup.position.y, targetLayout.y, 3.2, delta);
      const nextScale = THREE.MathUtils.damp(worldGroup.scale.x, targetLayout.scale, 3.2, delta);
      worldGroup.scale.setScalar(nextScale);
    }

    if (primaryOrbitMatRef.current) {
      _targetOrbitColor.setHex(
        variant === 'portal' && accentStatus === 'SAFE' ? 0x38bdf8 : getStatusHexColor(accentStatus)
      );
      primaryOrbitMatRef.current.color.lerp(_targetOrbitColor, Math.min(1, delta * 3));
    }

    if (!reducedMotion) {
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y += delta * 0.045;
      }
      if (cloudMeshRef.current) {
        cloudMeshRef.current.rotation.y += delta * 0.062;
      }

      primaryAngleRef.current += delta * 0.19;
      relayAngleRef.current -= delta * 0.13;
      sentinelAngleRef.current += delta * 0.16;

      // Subtle navigation beacon cadence on spacecraft fleet
      const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 3.4);
      if (proceduralFleet.primary.beaconMaterials[2]) {
        proceduralFleet.primary.beaconMaterials[2].color.setRGB(
          0.22 * pulse + 0.12,
          0.74 * pulse + 0.2,
          0.97
        );
      }
      if (proceduralFleet.relay.beaconMaterials[0]) {
        proceduralFleet.relay.beaconMaterials[0].color.setRGB(
          0.24 + 0.18 * pulse,
          0.82 * pulse + 0.15,
          1.0
        );
      }
      if (proceduralFleet.sentinel.beaconMaterials[0]) {
        proceduralFleet.sentinel.beaconMaterials[0].color.setRGB(
          0.4 * pulse + 0.1,
          0.92,
          0.98
        );
      }
    }

    if (primarySatRef.current) {
      const a = primaryAngleRef.current;
      primarySatRef.current.position.set(
        Math.cos(a) * ORBIT_PRIMARY_RADIUS,
        0,
        Math.sin(a) * ORBIT_PRIMARY_RADIUS
      );
      primarySatRef.current.rotation.y = -a + Math.PI / 2;
    }

    if (relaySatRef.current) {
      const a = relayAngleRef.current;
      relaySatRef.current.position.set(
        Math.cos(a) * ORBIT_RELAY_RADIUS,
        0,
        Math.sin(a) * ORBIT_RELAY_RADIUS
      );
      relaySatRef.current.rotation.y = -a - Math.PI / 2;
      relaySatRef.current.rotation.z = 0.25;
    }

    if (sentinelSatRef.current) {
      const a = sentinelAngleRef.current;
      sentinelSatRef.current.position.set(
        Math.cos(a) * ORBIT_SENTINEL_RADIUS,
        0,
        Math.sin(a) * ORBIT_SENTINEL_RADIUS
      );
      sentinelSatRef.current.rotation.y = -a + Math.PI / 2;
    }
  });

  return (
    <group
      ref={worldGroupRef}
      position={[targetLayout.x, targetLayout.y, 0]}
      scale={targetLayout.scale}
    >
      {/* Planetary Core + Relief + City Lights + Cloud Layer + Dual Atmospheric Scattering (only when rendering procedural Earth) */}
      {showSolidPlanet && (
        <group rotation={[0, 0, AXIAL_TILT_RAD]}>
          <mesh ref={earthMeshRef} material={earthSurfaceMaterial}>
            <sphereGeometry args={[EARTH_RADIUS, sphereSegments[0], sphereSegments[1]]} />
          </mesh>

          <mesh ref={cloudMeshRef}>
            <sphereGeometry args={[EARTH_RADIUS * 1.015, shellSegments[0], shellSegments[1]]} />
            <meshStandardMaterial
              map={activeCloudMap}
              transparent
              opacity={0.62}
              depthWrite={false}
              roughness={0.92}
            />
          </mesh>

          {/* Inner Sunlit Atmospheric Scattering Limb */}
          <mesh material={innerAtmosphereMaterial}>
            <sphereGeometry args={[EARTH_RADIUS * 1.022, shellSegments[0], shellSegments[1]]} />
          </mesh>

          {/* Outer Atmospheric Rayleigh Halo */}
          <mesh material={outerAtmosphereMaterial}>
            <sphereGeometry args={[EARTH_RADIUS * 1.085, shellSegments[0], shellSegments[1]]} />
          </mesh>

          {/* Subtle Equatorial Reference Ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[EARTH_RADIUS * 1.11, 0.007, 6, 128]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.16} />
          </mesh>
        </group>
      )}

      {/* ORBIT 1: Primary Crew Station / Bio-Telemetry Hub (51.6° Inclination) */}
      <group rotation={ORBIT_PRIMARY_TILT}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ORBIT_PRIMARY_RADIUS, 0.014, 8, 144]} />
          <meshBasicMaterial
            ref={primaryOrbitMatRef}
            color="#38bdf8"
            transparent
            opacity={0.42}
          />
        </mesh>

        <group
          ref={primarySatRef}
          position={[
            Math.cos(-0.55) * ORBIT_PRIMARY_RADIUS,
            0,
            Math.sin(-0.55) * ORBIT_PRIMARY_RADIUS
          ]}
          rotation={[0, 0.55 + Math.PI / 2, 0]}
          scale={0.31}
        >
          <primitive object={activePrimaryGroup} />
        </group>
      </group>

      {/* ORBIT 2: Deep-Space Telemetry Relay Satellite */}
      <group rotation={ORBIT_RELAY_TILT}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ORBIT_RELAY_RADIUS, 0.011, 8, 144]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.28} />
        </mesh>

        <group
          ref={relaySatRef}
          position={[
            Math.cos(1.85) * ORBIT_RELAY_RADIUS,
            0,
            Math.sin(1.85) * ORBIT_RELAY_RADIUS
          ]}
          rotation={[0, -1.85 - Math.PI / 2, 0.25]}
          scale={0.27}
        >
          <primitive object={activeRelayGroup} />
        </group>
      </group>

      {/* ORBIT 3: High-Inclination Bio-Sentinel Observation Satellite */}
      <group rotation={ORBIT_SENTINEL_TILT}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ORBIT_SENTINEL_RADIUS, 0.01, 8, 144]} />
          <meshBasicMaterial color="#105bd8" transparent opacity={0.32} />
        </mesh>

        <group
          ref={sentinelSatRef}
          position={[
            Math.cos(3.65) * ORBIT_SENTINEL_RADIUS,
            0,
            Math.sin(3.65) * ORBIT_SENTINEL_RADIUS
          ]}
          rotation={[0, -3.65 + Math.PI / 2, 0]}
          scale={0.28}
        >
          <primitive object={activeSentinelGroup} />
        </group>
      </group>
    </group>
  );
}

export default Earth;
