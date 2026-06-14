import * as THREE from "three";
import { type FabricPresetId } from "@/lib/fabrixa/APP_DATA_0";

export interface TextilePreset {
  roughness: number;
  metalness: number;
  anisotropy: number;
  sheen: number;
  sheenRoughness: number;
  sheenColor: string;
  clearcoat: number;
  clearcoatRoughness: number;
  envMapIntensity: number;
  normalScale: [number, number];
}

export const TEXTILE_PRESETS: Record<FabricPresetId, TextilePreset> = {
  cotton: {
    roughness: 0.92,
    metalness: 0.0,
    anisotropy: 0.0,
    sheen: 0.05,
    sheenRoughness: 0.9,
    sheenColor: "#ffffff",
    clearcoat: 0.0,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.65,
    normalScale: [0.15, 0.15],
  },
  linen: {
    roughness: 0.96,
    metalness: 0.0,
    anisotropy: 0.1,
    sheen: 0.1,
    sheenRoughness: 0.8,
    sheenColor: "#ffffff",
    clearcoat: 0.0,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.6,
    normalScale: [0.35, 0.35],
  },
  silk: {
    roughness: 0.35,
    metalness: 0.05,
    anisotropy: 0.8,
    sheen: 0.95,
    sheenRoughness: 0.2,
    sheenColor: "#ffffff",
    clearcoat: 0.15,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.95,
    normalScale: [0.08, 0.08],
  },
  satin: {
    roughness: 0.25,
    metalness: 0.08,
    anisotropy: 0.6,
    sheen: 0.85,
    sheenRoughness: 0.25,
    sheenColor: "#ffffff",
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
    envMapIntensity: 1.05,
    normalScale: [0.05, 0.05],
  },
  velvet: {
    roughness: 0.98,
    metalness: 0.0,
    anisotropy: 0.2,
    sheen: 1.0,
    sheenRoughness: 0.1,
    sheenColor: "#7e3c8c",
    clearcoat: 0.0,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.55,
    normalScale: [0.4, 0.4],
  },
  denim: {
    roughness: 0.94,
    metalness: 0.0,
    anisotropy: 0.3,
    sheen: 0.03,
    sheenRoughness: 0.9,
    sheenColor: "#ffffff",
    clearcoat: 0.0,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.55,
    normalScale: [0.5, 0.5],
  },
  chiffon: {
    roughness: 0.6,
    metalness: 0.0,
    anisotropy: 0.1,
    sheen: 0.55,
    sheenRoughness: 0.4,
    sheenColor: "#ffffff",
    clearcoat: 0.05,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.85,
    normalScale: [0.1, 0.1],
  },
  wool: {
    roughness: 0.98,
    metalness: 0.0,
    anisotropy: 0.4,
    sheen: 0.35,
    sheenRoughness: 0.5,
    sheenColor: "#ffffff",
    clearcoat: 0.0,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.5,
    normalScale: [0.6, 0.6],
  },
  leather: {
    roughness: 0.45,
    metalness: 0.15,
    anisotropy: 0.0,
    sheen: 0.15,
    sheenRoughness: 0.5,
    sheenColor: "#ffffff",
    clearcoat: 0.4,
    clearcoatRoughness: 0.4,
    envMapIntensity: 1.1,
    normalScale: [0.35, 0.35],
  },
};

/**
 * Generate a procedural, tileable normal map using multiple frequencies of wrapping sine/cosine waves
 * to simulate a realistic fabric normal heightmap and Sobel-filtered normal coordinates.
 */
export function generateProceduralNormalMap(width = 256, height = 256): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const heights = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x / width) * Math.PI * 2;
      const v = (y / height) * Math.PI * 2;
      let h = Math.sin(u * 16) * Math.cos(v * 16) * 0.4;
      h += Math.sin(u * 32 + v * 16) * 0.2;
      h += Math.sin(u * 8 - v * 24) * 0.15;
      h += Math.cos(u * 48) * Math.sin(v * 48) * 0.1;
      heights[y * width + x] = h;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const xp = (x + 1) % width;
      const xm = (x - 1 + width) % width;
      const yp = (y + 1) % height;
      const ym = (y - 1 + height) % height;

      const hL = heights[y * width + xm];
      const hR = heights[y * width + xp];
      const hT = heights[ym * width + x];
      const hB = heights[yp * width + x];

      const strength = 2.0;
      const dx = (hR - hL) * strength;
      const dy = (hB - hT) * strength;
      const dz = 1.0;

      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx = dx / len;
      const ny = dy / len;
      const nz = dz / len;

      const idx = (y * width + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(nz * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const normalCache: Record<string, THREE.Texture> = {};

/**
 * Loads a normal map texture from disk /public/textures/normals/ folder.
 * Falls back to a procedural tileable noise generator if load fails (404/network error).
 */
export function getNormalMap(presetId: FabricPresetId): Promise<THREE.Texture> {
  if (normalCache[presetId]) {
    return Promise.resolve(normalCache[presetId]);
  }

  const url = `/textures/normals/${presetId}.png`;

  return new Promise((resolve) => {
    fetch(url, { method: "GET", cache: "force-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        if (ct.includes("text/html")) throw new Error("HTML fallback page");

        const loader = new THREE.TextureLoader();
        loader.load(
          url,
          (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.colorSpace = THREE.NoColorSpace; // Normal maps are linear data
            normalCache[presetId] = texture;
            resolve(texture);
          },
          undefined,
          (err) => {
            console.warn(`TextureLoader failed for ${url}, using procedural fallback.`, err);
            const fallback = generateProceduralNormalMap();
            normalCache[presetId] = fallback;
            resolve(fallback);
          }
        );
      })
      .catch((err) => {
        console.warn(`Failed to fetch normal map from ${url} (catch/404), using procedural fallback.`, err);
        const fallback = generateProceduralNormalMap();
        normalCache[presetId] = fallback;
        resolve(fallback);
      });
  });
}
