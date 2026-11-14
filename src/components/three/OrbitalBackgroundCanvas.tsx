import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { HealthStatusLevel } from '../../types/astroguard';
import {
  createStudioEnvironment,
  prefersReducedMotion,
  probeWebGLCapabilities
} from './webglUtils';

export const ORBITAL_MOTION_BACKDROP_URL = '/assets/aistudio/image_9ab40c53.png';

interface OrbitalBackgroundCanvasProps {
  variant: 'portal' | 'workspace';
  accentStatus?: HealthStatusLevel;
  onWebGLUnavailable?: () => void;
}

// Module-scope reusable vector to avoid per-frame allocations
const _lookTarget = new THREE.Vector3();
const SUN_LIGHT_POS: [number, number, number] = [13, 6.5, 9];
const SUN_DIRECTION: [number, number, number] = [
  13 / Math.hypot(13, 6.5, 9),
  6.5 / Math.hypot(13, 6.5, 9),
  9 / Math.hypot(13, 6.5, 9)
];

function StudioEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const envTexture = createStudioEnvironment(gl);
    scene.environment = envTexture;
    return () => {
      if (scene.environment === envTexture) {
        scene.environment = null;
      }
      envTexture.dispose();
    };
  }, [gl, scene]);

  return null;
}

/**
 * Curved 3D panoramic depth-displaced backdrop using the user's orbital Earth &
 * satellite photograph/render. Applies spherical concave depth curvature,
 * radial planetary & lower cloud-deck Z-relief, sunlit limb breathing, subtle
 * cloud drift, and smooth edge blending into the deep-space #030712 void.
 */
function MotionSpaceBackdropImage({
  variant,
  isSoftwareGl,
  reducedMotion
}: {
  variant: 'portal' | 'workspace';
  isSoftwareGl: boolean;
  reducedMotion: boolean;
}) {
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const textureRef = useRef<THREE.Texture | null>(null);

  const isDesktop = size.width >= 1024;
  const isTablet = size.width >= 640 && size.width < 1024;

  const geometry = useMemo(() => {
    const segs = isSoftwareGl ? 32 : 64;
    return new THREE.PlaneGeometry(20.5, 20.5, segs, segs);
  }, [isSoftwareGl]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uMap: { value: null as THREE.Texture | null },
          uHasMap: { value: 0 },
          uTime: { value: 0 },
          uDim: { value: variant === 'portal' ? 1.0 : 0.5 },
          uPointer: { value: new THREE.Vector2(0, 0) }
        },
        vertexShader: `
          uniform float uTime;
          uniform vec2 uPointer;
          varying vec2 vUv;
          varying float vCloudBand;
          varying float vSunProximity;

          void main() {
            vUv = uv;
            vec3 pos = position;

            // 1. Subtle concave panoramic dome wrap for natural camera-pan perspective
            float radialSq = pos.x * pos.x + pos.y * pos.y;
            pos.z -= radialSq * 0.0115;

            // 2. Central planetary hemisphere bulge matching the Earth globe in the image
            float earthDist = length(uv - vec2(0.50, 0.515));
            float earthDome = smoothstep(0.28, 0.0, earthDist);
            pos.z += earthDome * 1.45;

            // 3. Lower sunlit cloud deck & foreground satellite depth-relief separation
            float cloudBand = smoothstep(0.40, 0.03, uv.y);
            float fgSatelliteLift = smoothstep(0.28, 0.04, length(uv - vec2(0.80, 0.22)));
            pos.z += cloudBand * 2.15 + fgSatelliteLift * 1.15;

            // 4. Gentle breathing wave along the foreground cloud horizon
            pos.z += sin(uv.x * 5.0 + uTime * 0.35) * 0.08 * cloudBand;

            vCloudBand = cloudBand;
            vSunProximity = smoothstep(0.26, 0.0, length(uv - vec2(0.645, 0.685)));

            // Micro parallax tilt responsiveness
            pos.x += uPointer.x * (0.14 * cloudBand + 0.06 * earthDome);
            pos.y -= uPointer.y * (0.1 * cloudBand + 0.04 * earthDome);

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform float uHasMap;
          uniform float uTime;
          uniform float uDim;
          varying vec2 vUv;
          varying float vCloudBand;
          varying float vSunProximity;

          void main() {
            if (uHasMap < 0.5) {
              gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
              return;
            }

            // Subtle atmospheric motion drift strictly in the lower cloud deck
            vec2 sampleUv = vUv;
            float cloudWave = sin(vUv.y * 18.0 + uTime * 0.22) * 0.0018 * vCloudBand;
            float cloudDrift = sin(uTime * 0.14 + vUv.x * 6.0) * 0.0014 * vCloudBand;
            sampleUv.x = clamp(sampleUv.x + cloudWave + cloudDrift, 0.002, 0.998);
            sampleUv.y = clamp(sampleUv.y + cos(vUv.x * 12.0 + uTime * 0.18) * 0.0012 * vCloudBand, 0.002, 0.998);

            vec4 tex = texture2D(uMap, sampleUv);
            vec3 color = tex.rgb;

            // Subtle sunlit upper-right limb flare pulse & atmospheric sheen
            float sunPulse = 0.5 + 0.5 * sin(uTime * 0.85);
            color += vec3(0.45, 0.72, 1.0) * vSunProximity * (0.045 + 0.04 * sunPulse);

            // Soft alpha vignette fade so the 1:1 composition blends imperceptibly into #030712 with zero edge seam
            float edgeX = smoothstep(0.0, 0.16, vUv.x) * (1.0 - smoothstep(0.84, 1.0, vUv.x));
            float edgeY = smoothstep(0.0, 0.1, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y));
            float vignette = edgeX * edgeY;

            gl_FragColor = vec4(color * uDim, vignette);
          }
        `
      }),
    []
  );

  useEffect(() => {
    material.uniforms.uDim.value = variant === 'portal' ? 0.96 : 0.48;
  }, [variant, material]);

  useEffect(() => {
    let active = true;
    const loader = new THREE.TextureLoader();
    const maxAnisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), 4);

    loader.load(
      ORBITAL_MOTION_BACKDROP_URL,
      (loadedTexture) => {
        if (!active) {
          loadedTexture.dispose();
          return;
        }
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
        loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
        loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.anisotropy = maxAnisotropy;
        loadedTexture.needsUpdate = true;

        textureRef.current?.dispose();
        textureRef.current = loadedTexture;
        material.uniforms.uMap.value = loadedTexture;
        material.uniforms.uHasMap.value = 1;
        invalidate();
      },
      undefined,
      () => {
        if (active) {
          material.uniforms.uHasMap.value = 0;
        }
      }
    );

    return () => {
      active = false;
      textureRef.current?.dispose();
      textureRef.current = null;
      material.uniforms.uMap.value = null;
      material.uniforms.uHasMap.value = 0;
    };
  }, [gl, material, invalidate]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useEffect(() => {
    if (reducedMotion) return;
    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      pointerRef.current.y = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [reducedMotion]);

  const targetTransform = useMemo(() => {
    if (variant === 'portal') {
      if (isDesktop) return { x: -2.45, y: 0.35, z: -9.5, scale: 1.03, rotY: 0.05 };
      if (isTablet) return { x: 0, y: 0.95, z: -9.5, scale: 0.94, rotY: 0 };
      return { x: 0, y: 1.15, z: -9.5, scale: 0.86, rotY: 0 };
    }
    return { x: 1.8, y: -0.25, z: -9.8, scale: 1.05, rotY: -0.04 };
  }, [variant, isDesktop, isTablet]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const mesh = meshRef.current;

    if (!reducedMotion) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
      material.uniforms.uPointer.value.x = THREE.MathUtils.damp(
        material.uniforms.uPointer.value.x,
        pointerRef.current.x,
        3.2,
        delta
      );
      material.uniforms.uPointer.value.y = THREE.MathUtils.damp(
        material.uniforms.uPointer.value.y,
        pointerRef.current.y,
        3.2,
        delta
      );
    }

    if (mesh) {
      const idleZoom = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.16) * 0.03;
      const idleRotY = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.2) * 0.025;
      const pointerRotY = reducedMotion ? 0 : pointerRef.current.x * 0.055;
      const pointerRotX = reducedMotion ? 0 : pointerRef.current.y * 0.035;

      mesh.position.x = THREE.MathUtils.damp(mesh.position.x, targetTransform.x, 3, delta);
      mesh.position.y = THREE.MathUtils.damp(mesh.position.y, targetTransform.y, 3, delta);
      mesh.position.z = THREE.MathUtils.damp(mesh.position.z, targetTransform.z, 3, delta);
      mesh.rotation.y = THREE.MathUtils.damp(
        mesh.rotation.y,
        targetTransform.rotY + idleRotY + pointerRotY,
        3.2,
        delta
      );
      mesh.rotation.x = THREE.MathUtils.damp(mesh.rotation.x, pointerRotX, 3.2, delta);
      const nextScale = THREE.MathUtils.damp(
        mesh.scale.x,
        targetTransform.scale + idleZoom,
        2.5,
        delta
      );
      mesh.scale.setScalar(nextScale);
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[targetTransform.x, targetTransform.y, targetTransform.z]}
      scale={targetTransform.scale}
      renderOrder={-10}
    />
  );
}

function InstancedStarfield({
  isSoftwareGl,
  reducedMotion
}: {
  isSoftwareGl: boolean;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const starCount = isSoftwareGl ? 320 : 840;

  const { geometry, material, matrices, colors } = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.032, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const matArray: THREE.Matrix4[] = [];
    const colorArray: THREE.Color[] = [];

    let seed = 109;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < starCount; i++) {
      const r = 14 + nextRand() * 16;
      const theta = nextRand() * Math.PI * 2;
      const phi = Math.acos(2 * nextRand() - 1);
      dummy.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.65,
        -2.2 - nextRand() * 4.8
      );
      const scale = 0.4 + nextRand() * 1.25;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      matArray.push(dummy.matrix.clone());

      const tint = nextRand();
      if (tint > 0.82) color.setHex(0x67e8f9);
      else if (tint > 0.64) color.setHex(0xbae6fd);
      else if (tint > 0.52) color.setHex(0xfde68a);
      else if (tint > 0.44) color.setHex(0xc4b5fd);
      else color.setHex(0xf1f5f9);
      colorArray.push(color.clone());
    }

    return {
      geometry: geo,
      material: mat,
      matrices: matArray,
      colors: colorArray
    };
  }, [starCount]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < starCount; i++) {
      mesh.setMatrixAt(i, matrices[i]);
      mesh.setColorAt(i, colors[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [starCount, matrices, colors]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_, rawDelta) => {
    if (reducedMotion || !meshRef.current) return;
    const delta = Math.min(rawDelta, 0.1);
    meshRef.current.rotation.y += delta * 0.0065;
    meshRef.current.rotation.x += delta * 0.0018;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, starCount]}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}

/**
 * Subtle near-field orbital dust & horizon atmospheric mist motes providing
 * unmistakable 3D parallax depth cues across the lower cloud deck & space void.
 */
function DeepSpaceParticles({
  isSoftwareGl,
  reducedMotion
}: {
  isSoftwareGl: boolean;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const count = isSoftwareGl ? 56 : 120;

  const { geometry, material, matrices, colors } = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.012, 5, 5);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.38
    });
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const matArray: THREE.Matrix4[] = [];
    const colorArray: THREE.Color[] = [];

    let seed = 4219;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < count; i++) {
      const radius = 5.4 + nextRand() * 9.5;
      const angle = nextRand() * Math.PI * 2;
      const y = (nextRand() - 0.55) * 9.2;
      dummy.position.set(
        Math.cos(angle) * radius - 1.4,
        y,
        Math.sin(angle) * radius * 0.65 - 1.5
      );
      dummy.scale.setScalar(0.5 + nextRand() * 1.2);
      dummy.updateMatrix();
      matArray.push(dummy.matrix.clone());

      const r = nextRand();
      if (r > 0.66) color.setHex(0x67e8f9);
      else if (r > 0.3) color.setHex(0x38bdf8);
      else color.setHex(0xe0f2fe);
      colorArray.push(color.clone());
    }

    return {
      geometry: geo,
      material: mat,
      matrices: matArray,
      colors: colorArray
    };
  }, [count]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, matrices[i]);
      mesh.setColorAt(i, colors[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [count, matrices, colors]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_, rawDelta) => {
    if (reducedMotion || !meshRef.current) return;
    const delta = Math.min(rawDelta, 0.1);
    meshRef.current.rotation.y -= delta * 0.019;
    meshRef.current.rotation.z += delta * 0.003;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      renderOrder={3}
    />
  );
}

function CameraParallaxRig({
  variant,
  reducedMotion
}: {
  variant: 'portal' | 'workspace';
  reducedMotion: boolean;
}) {
  const size = useThree((state) => state.size);
  const pointerRef = useRef({ x: 0, y: 0 });
  const lookRef = useRef({
    x: variant === 'portal' ? -0.35 : 0.85,
    y: variant === 'portal' ? -0.05 : -0.22
  });

  useEffect(() => {
    if (reducedMotion) return;
    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      pointerRef.current.y = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [reducedMotion]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const { camera, clock } = state;
    const isDesktop = size.width >= 1024;

    const targetLookX =
      variant === 'portal' ? (isDesktop ? -0.45 : 0) : 0.65;
    const targetLookY =
      variant === 'portal' ? (isDesktop ? 0.05 : 0.2) : -0.15;

    lookRef.current.x = THREE.MathUtils.damp(lookRef.current.x, targetLookX, 3.2, delta);
    lookRef.current.y = THREE.MathUtils.damp(lookRef.current.y, targetLookY, 3.2, delta);

    const baseZ = variant === 'portal' ? (isDesktop ? 13.4 : 14.2) : 13.2;
    const baseY = variant === 'portal' ? 0.85 : 1.05;

    if (!reducedMotion) {
      const t = clock.elapsedTime;
      const driftX = Math.sin(t * 0.22) * 0.42;
      const driftY = Math.sin(t * 0.17) * 0.18;
      const driftZ = Math.cos(t * 0.15) * 0.48;
      const targetCamX = pointerRef.current.x * 0.95 + driftX;
      const targetCamY = baseY - pointerRef.current.y * 0.52 + driftY;
      const targetCamZ = baseZ + driftZ;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 3, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 3, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 2.5, delta);
    } else {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 3, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, baseY, 3, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, baseZ, 3, delta);
    }

    _lookTarget.set(lookRef.current.x, lookRef.current.y, -2.5);
    camera.lookAt(_lookTarget);
  });

  return null;
}

export function OrbitalBackgroundCanvas({
  variant,
  onWebGLUnavailable
}: OrbitalBackgroundCanvasProps) {
  const { webglAvailable, isSoftwareGl } = useMemo(() => probeWebGLCapabilities(), []);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const [isPageHidden, setIsPageHidden] = React.useState<boolean>(() =>
    typeof document !== 'undefined' ? document.hidden : false
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibilityChange = () => setIsPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!webglAvailable) {
      onWebGLUnavailable?.();
    }
  }, [webglAvailable, onWebGLUnavailable]);

  useEffect(() => {
    return () => {
      cleanupListenersRef.current?.();
      cleanupListenersRef.current = null;
    };
  }, []);

  if (!webglAvailable) {
    return null;
  }

  return (
    <div
      className="w-full h-full"
      aria-hidden="true"
      data-r3f-earth-backdrop="true"
    >
      <Canvas
        dpr={isSoftwareGl ? 1 : [1, 1.75]}
        frameloop={reducedMotion || isPageHidden ? 'demand' : 'always'}
        camera={{ position: [0, 0.85, 13.4], fov: 42, near: 0.1, far: 200 }}
        gl={{
          antialias: !isSoftwareGl,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1
        }}
        onCreated={({ gl, scene, camera }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.setClearColor(0x000000, 0);

          const canvas = gl.domElement;
          const handleContextLost = (event: Event) => {
            event.preventDefault();
          };
          const handleContextCreationError = () => {
            onWebGLUnavailable?.();
          };

          canvas.addEventListener('webglcontextlost', handleContextLost);
          canvas.addEventListener('webglcontextcreationerror', handleContextCreationError);

          cleanupListenersRef.current = () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextcreationerror', handleContextCreationError);
          };

          if (!isSoftwareGl) {
            gl.compile(scene, camera);
          }
        }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <StudioEnvironment />

        {/* Cinematic Orbital Sunlight & Cool Earthshine Rim Lighting Rig */}
        <directionalLight color="#fff6e6" intensity={2.45} position={SUN_LIGHT_POS} />
        <hemisphereLight args={['#38bdf8', '#030712', 0.65]} />
        <directionalLight color="#38bdf8" intensity={1.1} position={[-11, -4, -9]} />

        {/* 3D Depth-Displaced Orbital Image Backdrop */}
        <MotionSpaceBackdropImage
          variant={variant}
          isSoftwareGl={isSoftwareGl}
          reducedMotion={reducedMotion}
        />

        {/* Multi-Plane 3D Parallax Starfield & Near-Field Ionized Micro-Particles */}
        <InstancedStarfield isSoftwareGl={isSoftwareGl} reducedMotion={reducedMotion} />
        <DeepSpaceParticles isSoftwareGl={isSoftwareGl} reducedMotion={reducedMotion} />

        <CameraParallaxRig variant={variant} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}

export default OrbitalBackgroundCanvas;
