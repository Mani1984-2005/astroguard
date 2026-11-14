import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Canonical paths under /public/assets/ for user-supplied realistic Earth
 * texture maps and GLB/GLTF satellite models.
 *
 * Dropping files at these paths (supports .jpg/.jpeg/.png/.webp and .glb/.gltf)
 * automatically upgrades the procedural fallback assets without modifying code:
 *  - public/assets/earth/earth_day.{jpg,png,webp}
 *  - public/assets/earth/earth_night.{jpg,png,webp}
 *  - public/assets/earth/earth_normal.{jpg,png,webp}
 *  - public/assets/earth/earth_clouds.{png,jpg,webp}
 *  - public/assets/models/satellite_primary.{glb,gltf}
 *  - public/assets/models/satellite_relay.{glb,gltf}
 *  - public/assets/models/satellite_sentinel.{glb,gltf}
 */
export const ORBITAL_ASSET_PATHS = {
  earthDayMap: '/assets/earth/earth_day.jpg',
  earthNightMap: '/assets/earth/earth_night.jpg',
  earthNormalMap: '/assets/earth/earth_normal.jpg',
  earthCloudMap: '/assets/earth/earth_clouds.png',
  satellites: {
    primary: '/assets/models/satellite_primary.glb',
    relay: '/assets/models/satellite_relay.glb',
    sentinel: '/assets/models/satellite_sentinel.glb'
  }
} as const;

export interface OrbitalAssetManifest {
  earth: {
    dayMap: string | null;
    nightMap: string | null;
    normalMap: string | null;
    cloudMap: string | null;
  };
  satellites: {
    primary: string | null;
    relay: string | null;
    sentinel: string | null;
  };
}

export interface LoadedEarthAssetMaps {
  dayMap: THREE.Texture | null;
  nightMap: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  cloudMap: THREE.Texture | null;
}

let cachedManifestPromise: Promise<OrbitalAssetManifest | null> | null = null;

/**
 * Queries the server-side asset manifest so missing optional assets never
 * trigger 404 console noise in the browser.
 */
export async function fetchOrbitalAssetManifest(): Promise<OrbitalAssetManifest | null> {
  if (cachedManifestPromise) {
    return cachedManifestPromise;
  }

  cachedManifestPromise = (async () => {
    try {
      const response = await fetch('/api/orbital-assets/manifest', {
        cache: 'no-cache'
      });
      if (!response.ok) return null;
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/json')) return null;
      return (await response.json()) as OrbitalAssetManifest;
    } catch {
      return null;
    }
  })();

  return cachedManifestPromise;
}

function loadTextureWithColorSpace(
  loader: THREE.TextureLoader,
  url: string,
  isColorMap: boolean,
  maxAnisotropy: number
): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = isColorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.anisotropy = maxAnisotropy;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      () => resolve(null)
    );
  });
}

/**
 * Attempts to load user-supplied Earth textures from public/assets/earth/.
 * Returns null entries for any map not yet provided so callers can mix or
 * fall back cleanly to procedural maps.
 */
export async function loadOptionalEarthAssets(
  maxAnisotropy: number
): Promise<LoadedEarthAssetMaps> {
  const manifest = await fetchOrbitalAssetManifest();
  if (!manifest) {
    return { dayMap: null, nightMap: null, normalMap: null, cloudMap: null };
  }

  const { dayMap: dayUrl, nightMap: nightUrl, normalMap: normUrl, cloudMap: cloudUrl } =
    manifest.earth;

  if (!dayUrl && !nightUrl && !normUrl && !cloudUrl) {
    return { dayMap: null, nightMap: null, normalMap: null, cloudMap: null };
  }

  const loader = new THREE.TextureLoader();
  const [dayMap, nightMap, normalMap, cloudMap] = await Promise.all([
    dayUrl
      ? loadTextureWithColorSpace(loader, dayUrl, true, maxAnisotropy)
      : Promise.resolve(null),
    nightUrl
      ? loadTextureWithColorSpace(loader, nightUrl, true, maxAnisotropy)
      : Promise.resolve(null),
    normUrl
      ? loadTextureWithColorSpace(loader, normUrl, false, maxAnisotropy)
      : Promise.resolve(null),
    cloudUrl
      ? loadTextureWithColorSpace(loader, cloudUrl, true, maxAnisotropy)
      : Promise.resolve(null)
  ]);

  return { dayMap, nightMap, normalMap, cloudMap };
}

/**
 * Attempts to load a user-supplied GLB/GLTF satellite model from public/assets/models/
 * and normalizes its bounding sphere scale to targetRadius.
 */
export async function loadOptionalSatelliteModel(
  slot: keyof OrbitalAssetManifest['satellites'],
  targetRadius: number
): Promise<THREE.Group | null> {
  const manifest = await fetchOrbitalAssetManifest();
  const url = manifest?.satellites[slot];
  if (!url) return null;

  const gltfLoader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  gltfLoader.setDRACOLoader(dracoLoader);

  try {
    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      gltfLoader.load(url, resolve, undefined, reject);
    });

    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scaleFactor = (targetRadius * 2) / maxDim;

    const wrapper = new THREE.Group();
    root.position.sub(center);
    wrapper.add(root);
    wrapper.scale.setScalar(scaleFactor);

    wrapper.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          if ('envMapIntensity' in mat) {
            (mat as THREE.MeshStandardMaterial).envMapIntensity = 1.15;
          }
        });
      }
    });

    return wrapper;
  } catch {
    return null;
  } finally {
    dracoLoader.dispose();
  }
}
