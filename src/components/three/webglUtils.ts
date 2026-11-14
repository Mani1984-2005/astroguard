import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HealthStatusLevel } from '../../types/astroguard';

export interface WebGLCapabilitiesReport {
  webglAvailable: boolean;
  isSoftwareGl: boolean;
}

let cachedReport: WebGLCapabilitiesReport | null = null;

/**
 * Probes WebGL2/WebGL support and checks the GPU renderer string for software
 * rasterizers (SwiftShader, llvmpipe, WARP) without blocking GPU users.
 */
export function probeWebGLCapabilities(): WebGLCapabilitiesReport {
  if (cachedReport) return cachedReport;
  if (typeof document === 'undefined') {
    cachedReport = { webglAvailable: false, isSoftwareGl: true };
    return cachedReport;
  }

  try {
    const probeCanvas = document.createElement('canvas');
    const gl =
      (probeCanvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (probeCanvas.getContext('webgl') as WebGLRenderingContext | null);

    if (!gl) {
      cachedReport = { webglAvailable: false, isSoftwareGl: true };
      return cachedReport;
    }

    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();

    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    cachedReport = { webglAvailable: true, isSoftwareGl };
    return cachedReport;
  } catch {
    cachedReport = { webglAvailable: false, isSoftwareGl: true };
    return cachedReport;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const envTarget = pmremGenerator.fromScene(envScene, 0.04);
  envScene.dispose();
  pmremGenerator.dispose();
  return envTarget.texture;
}

/**
 * Software WebGL pacing helper: waits for the GPU command fence before scheduling
 * the next animation frame so CPU rasterizers never starve the main UI thread.
 */
export function scheduleAfterDraw(
  renderer: THREE.WebGLRenderer,
  cb: () => void,
  registerTimer: (id: number) => void
): void {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  if (!gl || typeof gl.fenceSync !== 'function') {
    const id = window.setTimeout(cb, 80);
    registerTimer(id);
    return;
  }

  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const poll = () => {
    const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
    if (state === gl.UNSIGNALED) {
      const id = window.setTimeout(poll, 6);
      registerTimer(id);
    } else {
      if (sync) gl.deleteSync(sync);
      const id = window.setTimeout(cb, 80);
      registerTimer(id);
    }
  };
  const id = window.setTimeout(poll, 6);
  registerTimer(id);
}

export function disposeObject3D(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    if (mesh.material) {
      const matList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of matList) {
        materials.add(mat);
        const std = mat as THREE.MeshStandardMaterial;
        if (std.map) textures.add(std.map);
        if (std.roughnessMap) textures.add(std.roughnessMap);
        if (std.normalMap) textures.add(std.normalMap);
        if (std.emissiveMap) textures.add(std.emissiveMap);
      }
    }
  });

  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}

function hash2D(ix: number, iy: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2D(x: number, y: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise2D(x * freq, y * freq);
    freq *= 2.04;
    amp *= 0.5;
  }
  return value;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function paintContinentSeedMask(width: number, height: number): Uint8ClampedArray {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const ctx = maskCanvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const sx = width / 1024;
  const sy = height / 512;

  const polygons: Array<Array<[number, number]>> = [
    // North America & Central America
    [
      [115, 76], [178, 68], [248, 72], [298, 98], [322, 124], [306, 152],
      [288, 178], [262, 196], [250, 214], [272, 236], [264, 246], [234, 234],
      [212, 212], [186, 184], [156, 154], [128, 118]
    ],
    // Greenland
    [[334, 34], [385, 28], [418, 44], [410, 78], [374, 90], [344, 74]],
    // South America
    [
      [268, 250], [304, 252], [342, 276], [362, 308], [348, 346], [322, 392],
      [298, 442], [282, 434], [274, 376], [262, 326], [254, 284]
    ],
    // Europe & Scandinavia
    [
      [456, 146], [462, 112], [488, 86], [534, 72], [568, 84], [552, 118],
      [548, 152], [516, 166], [482, 168], [460, 158]
    ],
    // Asia & Arabian Peninsula & India
    [
      [554, 76], [648, 66], [768, 72], [878, 92], [932, 116], [896, 156],
      [858, 198], [818, 224], [786, 244], [744, 248], [718, 284], [696, 256],
      [660, 232], [628, 246], [588, 226], [566, 184], [546, 142]
    ],
    // Japan / Maritime SE Asia islands
    [[870, 146], [892, 158], [886, 184], [866, 174]],
    [[774, 266], [818, 276], [834, 294], [788, 292]],
    // Africa & Madagascar
    [
      [464, 186], [518, 184], [566, 196], [608, 234], [628, 256], [608, 304],
      [592, 354], [562, 398], [528, 394], [512, 346], [496, 292], [456, 256],
      [448, 218]
    ],
    [[614, 338], [626, 336], [622, 372], [608, 368]],
    // Australia & New Zealand
    [
      [784, 316], [838, 308], [884, 332], [892, 368], [858, 394], [806, 388],
      [774, 362]
    ],
    [[914, 388], [930, 398], [918, 424], [904, 412]]
  ];

  // Soft Gaussian blur on the base continent silhouette so FBM displacement creates crisp natural coastlines
  ctx.filter = `blur(${Math.max(4, Math.round(9 * sx))}px)`;
  ctx.fillStyle = '#ffffff';
  for (const poly of polygons) {
    const len = poly.length;
    ctx.beginPath();
    const startX = ((poly[len - 1][0] + poly[0][0]) / 2) * sx;
    const startY = ((poly[len - 1][1] + poly[0][1]) / 2) * sy;
    ctx.moveTo(startX, startY);
    for (let i = 0; i < len; i++) {
      const curr = poly[i];
      const next = poly[(i + 1) % len];
      ctx.quadraticCurveTo(
        curr[0] * sx,
        curr[1] * sy,
        ((curr[0] + next[0]) / 2) * sx,
        ((curr[1] + next[1]) / 2) * sy
      );
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.filter = 'none';

  return ctx.getImageData(0, 0, width, height).data;
}

/**
 * Procedural realistic Earth texture suite:
 * - surfaceMap (Day albedo: bathymetric oceans, vegetated basins, deserts, mountain ridges, polar caps)
 * - nightMap (Night city-light corridors along populated coasts & continental belts)
 * - normalMap (Sobel-derived terrain relief tangent normal map)
 * - cloudsMap (Swirling FBM cumulus & mid-latitude cyclone cloud deck)
 * - roughnessMap (Specular sun-glint oceans vs matte terrain)
 */
export function createEarthTextures(
  maxAnisotropy: number,
  highDetail = maxAnisotropy > 1
): {
  surfaceMap: THREE.CanvasTexture;
  nightMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  cloudsMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const width = highDetail ? 1280 : 768;
  const height = highDetail ? 640 : 384;

  const maskData = paintContinentSeedMask(width, height);
  const heightField = new Float32Array(width * height);

  const dayCanvas = document.createElement('canvas');
  dayCanvas.width = width;
  dayCanvas.height = height;
  const dayCtx = dayCanvas.getContext('2d')!;
  const dayImg = dayCtx.createImageData(width, height);

  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = width;
  nightCanvas.height = height;
  const nightCtx = nightCanvas.getContext('2d')!;
  const nightImg = nightCtx.createImageData(width, height);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext('2d')!;
  const roughImg = roughCtx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    const latRad = (v - 0.5) * Math.PI;
    const absLat = Math.abs(v - 0.5) * 2; // 0 equator -> 1 pole

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const idx = y * width + x;
      const pIdx = idx * 4;

      // Seamless horizontal wrapping via cylindrical coordinates in 2D noise domain
      const angle = u * Math.PI * 2;
      const nx = Math.cos(angle) * 2.4 + 4.2;
      const nz = Math.sin(angle) * 2.4 + 4.2;
      const ny = v * 4.8;

      const baseMask = maskData[pIdx] / 255;
      const detail = fbm2D(nx * 2.3 + ny * 0.42, nz * 2.3 - ny * 0.36, 5);
      const ridge = fbm2D(nx * 6.4 + 11.3, nz * 6.4 + ny * 3.4, 4);
      const moisture = fbm2D(nx * 2.0 + 21.7, ny * 2.5 + nz * 1.15, 3);

      // Polar Antarctic / Arctic shelf bias
      const antarcticBias = smoothstep(0.84, 0.96, v);
      const landSignal = Math.max(baseMask * 0.86 + (detail - 0.45) * 0.66, antarcticBias);
      const isLand = landSignal > 0.44;
      const elevation = isLand
        ? clamp01((landSignal - 0.44) * 1.9 + (ridge - 0.45) * 0.58)
        : 0;
      heightField[idx] = elevation;

      // Polar snow/ice threshold
      const iceCover = smoothstep(0.75, 0.9, absLat + (detail - 0.5) * 0.14);

      if (!isLand) {
        // Bathymetry: deep sapphire-navy ocean trenches to coastal continental shelf azure-cyan
        const shelf = smoothstep(0.22, 0.44, landSignal);
        const abyssalVar = fbm2D(nx * 3.8 + 4.1, nz * 3.8 + ny * 2.2, 2);
        const oceanR = 3 + shelf * 17 + (1 - Math.cos(latRad)) * 5 + abyssalVar * 4;
        const oceanG = 24 + shelf * 56 + abyssalVar * 6;
        const oceanB = 62 + shelf * 68 + abyssalVar * 10;

        const polarIceOcean = smoothstep(0.86, 0.96, absLat + (detail - 0.5) * 0.08);
        dayImg.data[pIdx] = Math.round(oceanR * (1 - polarIceOcean) + 218 * polarIceOcean);
        dayImg.data[pIdx + 1] = Math.round(oceanG * (1 - polarIceOcean) + 235 * polarIceOcean);
        dayImg.data[pIdx + 2] = Math.round(oceanB * (1 - polarIceOcean) + 250 * polarIceOcean);
        dayImg.data[pIdx + 3] = 255;

        // Smooth ocean specular roughness (low roughness = crisp solar glint)
        const roughVal = Math.round(42 + polarIceOcean * 170);
        roughImg.data[pIdx] = roughVal;
        roughImg.data[pIdx + 1] = roughVal;
        roughImg.data[pIdx + 2] = roughVal;
        roughImg.data[pIdx + 3] = 255;

        // Dark night ocean
        nightImg.data[pIdx] = 2;
        nightImg.data[pIdx + 1] = 6;
        nightImg.data[pIdx + 2] = 15;
        nightImg.data[pIdx + 3] = 255;
      } else {
        // Biome blending: lush equatorial canopy -> subtropical arid belts -> temperate valleys -> alpine rock & snow
        const subtropicalArid =
          smoothstep(0.13, 0.28, absLat) * (1 - smoothstep(0.42, 0.58, absLat));
        const aridity = clamp01(subtropicalArid * (1.18 - moisture * 1.12));

        let r = 24 + ridge * 26;
        let g = 74 + moisture * 34;
        let b = 46 + moisture * 16;

        // Arid desert / warm sandstone blending
        r = r * (1 - aridity) + 142 * aridity;
        g = g * (1 - aridity) + 120 * aridity;
        b = b * (1 - aridity) + 86 * aridity;

        // High elevation rocky / alpine ridges
        const alpine = smoothstep(0.54, 0.88, elevation);
        r = r * (1 - alpine) + 132 * alpine;
        g = g * (1 - alpine) + 138 * alpine;
        b = b * (1 - alpine) + 146 * alpine;

        // Polar & high peak snow
        const snow = clamp01(Math.max(iceCover, smoothstep(0.8, 0.95, elevation)));
        r = r * (1 - snow) + 226 * snow;
        g = g * (1 - snow) + 238 * snow;
        b = b * (1 - snow) + 248 * snow;

        dayImg.data[pIdx] = Math.round(clamp01(r / 255) * 255);
        dayImg.data[pIdx + 1] = Math.round(clamp01(g / 255) * 255);
        dayImg.data[pIdx + 2] = Math.round(clamp01(b / 255) * 255);
        dayImg.data[pIdx + 3] = 255;

        // Matte continents
        const landRough = Math.round(216 - snow * 28);
        roughImg.data[pIdx] = landRough;
        roughImg.data[pIdx + 1] = landRough;
        roughImg.data[pIdx + 2] = landRough;
        roughImg.data[pIdx + 3] = 255;

        // Night-side city lights: sharper golden-amber metropolitan & coastal corridors
        const coastal = 1 - smoothstep(0.06, 0.36, elevation);
        const habitableLat =
          smoothstep(0.05, 0.19, absLat) * (1 - smoothstep(0.62, 0.78, absLat));
        const clusterNoise = fbm2D(nx * 16.5 + 3.1, nz * 16.5 + ny * 10.2, 3);
        const microSpark = hash2D(x * 1.9 + 7, y * 1.9 + 13);
        const cityStrength = clamp01(
          smoothstep(0.56, 0.82, clusterNoise) *
            (0.42 + coastal * 0.85) *
            habitableLat *
            (microSpark > 0.32 ? 1.25 : 0.25) *
            (1 - snow)
        );

        nightImg.data[pIdx] = Math.round(3 + cityStrength * 252);
        nightImg.data[pIdx + 1] = Math.round(7 + cityStrength * 192);
        nightImg.data[pIdx + 2] = Math.round(16 + cityStrength * 88);
        nightImg.data[pIdx + 3] = 255;
      }
    }
  }

  dayCtx.putImageData(dayImg, 0, 0);
  nightCtx.putImageData(nightImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  // Tangent-space Sobel normal map from terrain heightfield
  const normCanvas = document.createElement('canvas');
  normCanvas.width = width;
  normCanvas.height = height;
  const normCtx = normCanvas.getContext('2d')!;
  const normImg = normCtx.createImageData(width, height);
  const strength = 3.8;

  for (let y = 0; y < height; y++) {
    const ym = Math.max(0, y - 1);
    const yp = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const xm = (x - 1 + width) % width;
      const xp = (x + 1) % width;

      const dX = heightField[y * width + xp] - heightField[y * width + xm];
      const dY = heightField[yp * width + x] - heightField[ym * width + x];

      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const pIdx = (y * width + x) * 4;
      normImg.data[pIdx] = Math.round((nx * 0.5 + 0.5) * 255);
      normImg.data[pIdx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normImg.data[pIdx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normImg.data[pIdx + 3] = 255;
    }
  }
  normCtx.putImageData(normImg, 0, 0);

  // Atmospheric swirling cloud layer (FBM streaks + cyclone swirls)
  const cloudW = highDetail ? 1280 : 768;
  const cloudH = highDetail ? 640 : 384;
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = cloudW;
  cloudCanvas.height = cloudH;
  const cloudCtx = cloudCanvas.getContext('2d')!;
  const cloudImg = cloudCtx.createImageData(cloudW, cloudH);

  for (let y = 0; y < cloudH; y++) {
    const v = y / cloudH;
    for (let x = 0; x < cloudW; x++) {
      const u = x / cloudW;
      const angle = u * Math.PI * 2;
      const cx = Math.cos(angle) * 2.1;
      const cz = Math.sin(angle) * 2.1;
      const warp = fbm2D(cx * 1.85 + 3.4, v * 4.8 + cz * 1.85, 3);
      const band = fbm2D(
        cx * 3.4 + warp * 2.1,
        v * 7.6 + cz * 3.0 - warp * 1.35,
        4
      );
      const density = smoothstep(0.45, 0.77, band);
      const pIdx = (y * cloudW + x) * 4;
      cloudImg.data[pIdx] = 238;
      cloudImg.data[pIdx + 1] = 246;
      cloudImg.data[pIdx + 2] = 255;
      cloudImg.data[pIdx + 3] = Math.round(density * 218);
    }
  }
  cloudCtx.putImageData(cloudImg, 0, 0);

  const surfaceMap = new THREE.CanvasTexture(dayCanvas);
  surfaceMap.colorSpace = THREE.SRGBColorSpace;
  surfaceMap.wrapS = THREE.RepeatWrapping;
  surfaceMap.anisotropy = maxAnisotropy;

  const nightMap = new THREE.CanvasTexture(nightCanvas);
  nightMap.colorSpace = THREE.SRGBColorSpace;
  nightMap.wrapS = THREE.RepeatWrapping;
  nightMap.anisotropy = maxAnisotropy;

  const normalMap = new THREE.CanvasTexture(normCanvas);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.anisotropy = maxAnisotropy;

  const cloudsMap = new THREE.CanvasTexture(cloudCanvas);
  cloudsMap.colorSpace = THREE.SRGBColorSpace;
  cloudsMap.wrapS = THREE.RepeatWrapping;
  cloudsMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  return { surfaceMap, nightMap, normalMap, cloudsMap, roughnessMap };
}

export function createSolarPanelTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0B1D3D';
  ctx.fillRect(0, 0, 256, 512);

  // Photovoltaic cell grid
  const cols = 8;
  const rows = 20;
  const cw = 256 / cols;
  const ch = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#112A56' : '#0E244A';
      ctx.fillRect(c * cw + 1.5, r * ch + 1.5, cw - 3, ch - 3);
    }
  }

  // Gold/Copper busbars
  ctx.strokeStyle = 'rgba(217, 167, 74, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 512);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createHullDetailTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(30, 41, 59, 0.38)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  for (let x = 0; x < 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }

  // Subtle NASA-style teal/navy station trim stripe
  ctx.fillStyle = '#1E3A8A';
  ctx.fillRect(0, 118, 256, 8);
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(0, 128, 256, 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

/**
 * Builds a composite 12-part ISS-inspired orbital station THREE.Group with
 * varied PBR materials (brushed titanium hull, gold MLI foil, solar arrays, cupola glass).
 */
export function buildIssStationModel(maxAnisotropy: number): {
  group: THREE.Group;
  beaconMaterials: THREE.MeshBasicMaterial[];
} {
  const group = new THREE.Group();
  const hullTexture = createHullDetailTexture(maxAnisotropy);
  const solarTexture = createSolarPanelTexture(maxAnisotropy);

  const titaniumMat = new THREE.MeshStandardMaterial({
    map: hullTexture,
    color: 0xdbeafe,
    metalness: 0.72,
    roughness: 0.34
  });

  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.85,
    roughness: 0.42
  });

  const goldMliMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.92,
    roughness: 0.22
  });

  const radiatorMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.15,
    roughness: 0.65
  });

  const solarMat = new THREE.MeshStandardMaterial({
    map: solarTexture,
    color: 0x38bdf8,
    metalness: 0.55,
    roughness: 0.2
  });

  const cupolaGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    metalness: 0.1,
    roughness: 0.08,
    clearcoat: 1.0
  });

  // 1. Main Integrated Truss Backbone (along X axis)
  const trussSpine = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.18, 0.18), trussMat);
  group.add(trussSpine);

  // 2. Pressurized Habitat Core (along Z axis perpendicular to truss)
  const coreModule = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 2.5, 24), titaniumMat);
  coreModule.rotation.x = Math.PI / 2;
  group.add(coreModule);

  // 3. Forward Node & Harmony Lab Modules
  const forwardNode = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.85, 20), titaniumMat);
  forwardNode.rotation.z = Math.PI / 2;
  forwardNode.position.set(0.55, 0, 0.72);
  group.add(forwardNode);

  const portLab = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.85, 20), titaniumMat);
  portLab.rotation.z = Math.PI / 2;
  portLab.position.set(-0.55, 0, 0.72);
  group.add(portLab);

  // 4. Gold MLI Docking Collars & Service Section
  const serviceCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.34, 24), goldMliMat);
  serviceCollar.rotation.x = Math.PI / 2;
  serviceCollar.position.set(0, 0, -0.78);
  group.add(serviceCollar);

  const forwardCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 20), goldMliMat);
  forwardCollar.rotation.x = Math.PI / 2;
  forwardCollar.position.set(0, 0, 1.32);
  group.add(forwardCollar);

  // 5. Cupola Observation Dome (nadir facing -Y)
  const cupolaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.14, 16), trussMat);
  cupolaBase.position.set(0, -0.24, 0.28);
  group.add(cupolaBase);

  const cupolaWindow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), cupolaGlassMat);
  cupolaWindow.position.set(0, -0.3, 0.28);
  group.add(cupolaWindow);

  // 6. Communications High-Gain Dish (LatheGeometry)
  const dishPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.12, 0.03),
    new THREE.Vector2(0.2, 0.09)
  ];
  const dishGeo = new THREE.LatheGeometry(dishPoints, 20);
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.8,
    roughness: 0.25,
    side: THREE.DoubleSide
  });
  const dishMesh = new THREE.Mesh(dishGeo, dishMat);
  dishMesh.position.set(0, 0.36, -0.3);
  dishMesh.rotation.x = Math.PI / 6;
  group.add(dishMesh);

  // 7. Four Articulated Photovoltaic Solar Array Wings (left/right pairs)
  const wingXPositions = [-2.35, -1.7, 1.7, 2.35];
  const wingGeo = new THREE.BoxGeometry(0.46, 0.018, 1.85);
  const boomGeo = new THREE.CylinderGeometry(0.03, 0.03, 4.1, 8);

  wingXPositions.forEach((wx) => {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(wx, 0, 0);

    const boom = new THREE.Mesh(boomGeo, trussMat);
    boom.rotation.x = Math.PI / 2;
    wingGroup.add(boom);

    const panelPos = new THREE.Mesh(wingGeo, solarMat);
    panelPos.position.set(0, 0, 1.12);
    wingGroup.add(panelPos);

    const panelNeg = new THREE.Mesh(wingGeo, solarMat);
    panelNeg.position.set(0, 0, -1.12);
    wingGroup.add(panelNeg);

    // Subtle solar tracking pitch angle
    wingGroup.rotation.x = 0.22;
    group.add(wingGroup);
  });

  // 8. Dual Thermal Control Radiator Wings
  const radGeo = new THREE.BoxGeometry(0.32, 0.015, 1.15);
  [-0.9, 0.9].forEach((rx) => {
    const rad = new THREE.Mesh(radGeo, radiatorMat);
    rad.position.set(rx, 0.06, -0.78);
    group.add(rad);
  });

  // 9. Navigation & Telemetry Beacons
  const beaconMaterials: THREE.MeshBasicMaterial[] = [];
  const portBeaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const stbdBeaconMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const coreBeaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  beaconMaterials.push(portBeaconMat, stbdBeaconMat, coreBeaconMat);

  const beaconGeo = new THREE.SphereGeometry(0.055, 10, 10);
  const portBeacon = new THREE.Mesh(beaconGeo, portBeaconMat);
  portBeacon.position.set(-2.78, 0.14, 0);
  group.add(portBeacon);

  const stbdBeacon = new THREE.Mesh(beaconGeo, stbdBeaconMat);
  stbdBeacon.position.set(2.78, 0.14, 0);
  group.add(stbdBeacon);

  const coreBeacon = new THREE.Mesh(beaconGeo, coreBeaconMat);
  coreBeacon.position.set(0, 0.3, 1.32);
  group.add(coreBeacon);

  return { group, beaconMaterials };
}

/**
 * Builds an AstroGuard Telemetry Relay Satellite inspired by deep-space/LEO
 * communications spacecraft: gold MLI octagonal bus, twin articulated
 * photovoltaic solar panel wings, dual parabolic dishes, nadir lasercomm lens,
 * and reaction-control thruster pods.
 */
export function buildRelaySatelliteModel(maxAnisotropy: number): {
  group: THREE.Group;
  beaconMaterials: THREE.MeshBasicMaterial[];
} {
  const group = new THREE.Group();
  const solarTexture = createSolarPanelTexture(maxAnisotropy);
  const hullTexture = createHullDetailTexture(maxAnisotropy);

  const goldMliMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.9,
    roughness: 0.24
  });

  const busMat = new THREE.MeshStandardMaterial({
    map: hullTexture,
    color: 0xe2e8f0,
    metalness: 0.78,
    roughness: 0.3
  });

  const strutMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.85,
    roughness: 0.38
  });

  const solarMat = new THREE.MeshStandardMaterial({
    map: solarTexture,
    color: 0x38bdf8,
    metalness: 0.52,
    roughness: 0.2
  });

  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.55,
    roughness: 0.32,
    side: THREE.DoubleSide
  });

  const opticMat = new THREE.MeshPhysicalMaterial({
    color: 0x67e8f9,
    emissive: 0x0284c7,
    emissiveIntensity: 0.55,
    metalness: 0.15,
    roughness: 0.08,
    clearcoat: 1.0
  });

  // 1. Octagonal Gold-MLI Spacecraft Core Bus
  const coreBus = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.96, 8), goldMliMat);
  group.add(coreBus);

  // 2. Upper Instrument Deck & Lower Propulsion Adapter
  const upperDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.32, 8), busMat);
  upperDeck.position.set(0, 0.62, 0);
  group.add(upperDeck);

  const thrusterBell = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.28, 16, 1, true), strutMat);
  thrusterBell.rotation.x = Math.PI;
  thrusterBell.position.set(0, -0.62, 0);
  group.add(thrusterBell);

  // 3. Main High-Gain Parabolic Dish (LatheGeometry) + Feed Horn
  const dishPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.24, 0.04),
    new THREE.Vector2(0.48, 0.14),
    new THREE.Vector2(0.62, 0.26)
  ];
  const mainDish = new THREE.Mesh(new THREE.LatheGeometry(dishPts, 24), dishMat);
  mainDish.position.set(0, 0.92, 0.16);
  mainDish.rotation.x = Math.PI * 0.28;
  group.add(mainDish);

  const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.34, 10), strutMat);
  feedHorn.position.set(0, 1.04, 0.32);
  feedHorn.rotation.x = Math.PI * 0.28;
  group.add(feedHorn);

  // 4. Secondary Nadir Telemetry Dish & Optical Lasercomm Aperture
  const nadirHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.18, 16), busMat);
  nadirHousing.position.set(0, -0.42, 0.38);
  nadirHousing.rotation.x = Math.PI / 2;
  group.add(nadirHousing);

  const nadirLens = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), opticMat);
  nadirLens.position.set(0, -0.42, 0.48);
  group.add(nadirLens);

  // 5. Twin Articulated Photovoltaic Solar Panel Wings
  const wingPanelGeo = new THREE.BoxGeometry(1.18, 0.02, 0.62);
  const yokeGeo = new THREE.CylinderGeometry(0.028, 0.028, 3.6, 8);
  const mainBoom = new THREE.Mesh(yokeGeo, strutMat);
  mainBoom.rotation.z = Math.PI / 2;
  mainBoom.position.set(0, 0.08, 0);
  group.add(mainBoom);

  [-1, 1].forEach((side) => {
    const wing = new THREE.Group();
    wing.position.set(side * 1.15, 0.08, 0);

    const innerPanel = new THREE.Mesh(wingPanelGeo, solarMat);
    innerPanel.position.set(0, 0, 0.34);
    wing.add(innerPanel);

    const outerPanel = new THREE.Mesh(wingPanelGeo, solarMat);
    outerPanel.position.set(0, 0, -0.34);
    wing.add(outerPanel);

    wing.rotation.x = 0.36;
    group.add(wing);
  });

  // 6. Telemetry Beacons
  const beaconMaterials: THREE.MeshBasicMaterial[] = [];
  const primaryBeaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const aftBeaconMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
  beaconMaterials.push(primaryBeaconMat, aftBeaconMat);

  const beaconGeo = new THREE.SphereGeometry(0.055, 10, 10);
  const b1 = new THREE.Mesh(beaconGeo, primaryBeaconMat);
  b1.position.set(0, 1.24, 0.45);
  group.add(b1);

  const b2 = new THREE.Mesh(beaconGeo, aftBeaconMat);
  b2.position.set(1.78, 0.08, 0);
  group.add(b2);

  return { group, beaconMaterials };
}

/**
 * Builds an AstroGuard Bio-Sentinel Earth Observation Satellite:
 * brushed-titanium avionics frame, asymmetric solar wing + magnetometer boom,
 * nadir multispectral Earth scanner barrel, star-tracker baffle, and thermal shield.
 */
export function buildSentinelSatelliteModel(maxAnisotropy: number): {
  group: THREE.Group;
  beaconMaterials: THREE.MeshBasicMaterial[];
} {
  const group = new THREE.Group();
  const hullTexture = createHullDetailTexture(maxAnisotropy);
  const solarTexture = createSolarPanelTexture(maxAnisotropy);

  const hullMat = new THREE.MeshStandardMaterial({
    map: hullTexture,
    color: 0xcbd5e1,
    metalness: 0.78,
    roughness: 0.28
  });

  const goldFoilMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.9,
    roughness: 0.26
  });

  const darkCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.65,
    roughness: 0.45
  });

  const solarMat = new THREE.MeshStandardMaterial({
    map: solarTexture,
    color: 0x67e8f9,
    metalness: 0.55,
    roughness: 0.22
  });

  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.6,
    metalness: 0.1,
    roughness: 0.06,
    clearcoat: 1.0
  });

  // 1. Sleek Hexagonal/Box Avionics Bus
  const bus = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.58, 1.15), hullMat);
  group.add(bus);

  // 2. Thermal Gold Foil Shielding Cap
  const foilCap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.2, 0.54), goldFoilMat);
  foilCap.position.set(0, 0.26, -0.22);
  group.add(foilCap);

  // 3. Nadir Multispectral Earth Scanner Barrel + Optical Aperture
  const scannerBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.42, 20),
    darkCarbonMat
  );
  scannerBarrel.position.set(0, -0.44, 0.18);
  group.add(scannerBarrel);

  const scannerLens = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 20), lensMat);
  scannerLens.position.set(0, -0.66, 0.18);
  group.add(scannerLens);

  // 4. Asymmetric Long Photovoltaic Array + Magnetometer Counterweight Boom
  const arrayBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.35, 8), darkCarbonMat);
  arrayBoom.rotation.z = Math.PI / 2;
  arrayBoom.position.set(0.95, 0.05, 0);
  group.add(arrayBoom);

  const panelGeo = new THREE.BoxGeometry(0.86, 0.02, 0.72);
  const panelInner = new THREE.Mesh(panelGeo, solarMat);
  panelInner.position.set(1.05, 0.06, 0);
  panelInner.rotation.x = 0.25;
  group.add(panelInner);

  const panelOuter = new THREE.Mesh(panelGeo, solarMat);
  panelOuter.position.set(1.98, 0.06, 0);
  panelOuter.rotation.x = 0.25;
  group.add(panelOuter);

  // Counterweight Magnetometer Boom on opposite side
  const magBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 1.45, 8), darkCarbonMat);
  magBoom.rotation.z = Math.PI / 2;
  magBoom.position.set(-0.98, 0.02, 0);
  group.add(magBoom);

  const magSensor = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), goldFoilMat);
  magSensor.position.set(-1.72, 0.02, 0);
  group.add(magSensor);

  // 5. Star-Tracker Optical Baffle
  const starTracker = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.26, 12), darkCarbonMat);
  starTracker.position.set(-0.18, 0.38, 0.34);
  starTracker.rotation.x = -0.35;
  group.add(starTracker);

  // 6. Telemetry Beacon
  const beaconMaterials: THREE.MeshBasicMaterial[] = [];
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
  beaconMaterials.push(beaconMat);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), beaconMat);
  beacon.position.set(0, 0.42, -0.42);
  group.add(beacon);

  return { group, beaconMaterials };
}

export function getStatusHexColor(status: HealthStatusLevel): number {
  if (status === 'DANGER') return 0xef4444;
  if (status === 'CAUTION') return 0xf59e0b;
  return 0x10b981;
}
