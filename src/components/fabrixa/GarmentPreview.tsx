import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Bounds, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  getGarment,
  type GarmentTypeId,
  type PartState,
  partKey,
} from "@/lib/fabrixa/garments";
import type { ScenePreset } from "@/lib/fabrixa/scenePresets";
import { loadGarmentModel, disposeScene } from "@/lib/fabrixa/modelLoader";
import { resolveMeshPartId } from "@/lib/fabrixa/meshUtils";
import {
  textureCache,
  applyTextureTransform,
  acquireLayerTexture,
  textureScaleToWorldScale,
} from "@/lib/fabrixa/textureCache";
import { APP_DATA_0 } from "@/lib/fabrixa/APP_DATA_0";
import {
  enableWorldTiling,
  updateWorldTilingUniforms,
  setLayerMap,
} from "@/lib/fabrixa/worldTiling";
import { LassoComputer } from "@/components/fabrixa/LassoSelector";
import { generateUvWireframe } from "@/lib/fabrixa/uvWireframe";

interface Props {
  typeId: GarmentTypeId;
  partStates: Record<string, PartState>;
  activePart: string;
  scene: ScenePreset;
  autoRotate: boolean;
  showMannequin: boolean;
  onSelectPart: (partKey: string) => void;
  lassoActive?: boolean;
  lassoMode?: "freehand" | "polygon" | "brush";
  onLassoMask?: (partKey: string, dataUrl: string, triCount: number) => void;
  onUvWireframeGenerated?: (partKey: string, dataUrl: string) => void;
}

/* ============================================================
 * Material application — single source of truth for recoloring
 * and texturing a mesh. Used by both GLB and procedural paths.
 * ============================================================ */

interface AppliedMaterialState {
  /** Last applied texture src — used to release from cache when changed. */
  appliedTextureSrc: string | null;
  /** Last applied layer src */
  appliedLayerSrc: string | null;
  /** Cached pointer to the GLB's original baked baseColor map (if any).
   *  We preserve it so we can restore it whenever the user clears their
   *  custom texture, keeping the original look intact. */
  originalMap: THREE.Texture | null;
  originalMapCached: boolean;
  /** Cached original base color so neutral state restores the model's look. */
  originalColor: THREE.Color | null;
}

const MATERIAL_USERDATA_KEY = "__fabrixa_applied";
const emptyBaseTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
emptyBaseTex.colorSpace = THREE.SRGBColorSpace;
emptyBaseTex.flipY = false;
emptyBaseTex.needsUpdate = true;

function getOrInitState(mat: THREE.Material): AppliedMaterialState {
  const ud = mat.userData as Record<string, unknown>;
  let s = ud[MATERIAL_USERDATA_KEY] as AppliedMaterialState | undefined;
  if (!s) {
    s = {
      appliedTextureSrc: null,
      appliedLayerSrc: null,
      originalMap: null,
      originalMapCached: false,
      originalColor: null,
    };
    ud[MATERIAL_USERDATA_KEY] = s;
  }
  return s;
}

/** Resolve the composited design-layer overlay (independent from base fabric). */
function resolveLayerCompositeSrc(state: PartState | undefined): string | null {
  if (!state) return null;
  if (state.layerCompositeDataUrl) return state.layerCompositeDataUrl;
  // Legacy saves stored layer composite in texturePaddedDataUrl
  if (state.layers?.length) return state.texturePaddedDataUrl ?? null;
  return null;
}

/** Base fabric map — uses tile-gap padding when active. */
function resolveBaseTextureSrc(state: PartState | undefined): string | null {
  if (!state?.textureDataUrl) return null;
  const gap = state.tileGap ?? 0;
  if (gap > 0 && state.texturePaddedDataUrl) return state.texturePaddedDataUrl;
  return state.textureDataUrl;
}

function applyPartToMaterial(
  material: THREE.Material,
  state: PartState | undefined,
  isActive: boolean,
) {
  if (!material) return;
  
  // Upgrade to Physical Material if needed for hyper-realism features (sheen, clearcoat)
  // We use standard material properties first then physical ones.
  const mat = material as THREE.MeshPhysicalMaterial;
  const internal = getOrInitState(mat);

  // ---- DEFAULT WHITE: strip baked GLB color/textures on first touch ----
  if (!internal.originalMapCached) {
    internal.originalMap = mat.map ?? null;
    internal.originalColor = mat.color ? mat.color.clone() : null;
    internal.originalMapCached = true;
    mat.map = emptyBaseTex; // Ensure USE_MAP is active
    mat.emissiveMap = null;
    if (mat.emissive && typeof mat.emissive.set === "function") mat.emissive.set("#000000");
    if (mat.color && typeof mat.color.set === "function") mat.color.set("#ffffff");
    mat.needsUpdate = true;
  }

  // ---- COLOR (clean white when neutral, tints when user picks one) ----
  const userColor = state?.color;
  const isUserColor =
    !!userColor && userColor !== "#ffffff" && userColor !== "#dddddd";
  if (mat.color && typeof mat.color.set === "function") {
    mat.color.set(isUserColor ? userColor! : "#ffffff");
  }

  // ---- BASE TEXTURE ----
  const desiredSrc = resolveBaseTextureSrc(state);
  if (desiredSrc !== internal.appliedTextureSrc) {
    // Release old texture before acquiring new one
    if (internal.appliedTextureSrc) {
      textureCache.release(internal.appliedTextureSrc, mat.map === emptyBaseTex ? null : mat.map);
    }
    
    if (desiredSrc) {
      const t = textureCache.acquire(desiredSrc);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = APP_DATA_0.perf.maxAnisotropy;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
      t.needsUpdate = true;
      mat.map = t;
      
      // Hyper-realism: use texture as emissive map to ensure "exact" colors 
      mat.emissiveMap = t;
      if (mat.emissive && typeof mat.emissive.set === "function") mat.emissive.set("#ffffff");
      mat.emissiveIntensity = 0.4;
    } else {
      mat.map = emptyBaseTex;
      mat.emissiveMap = null;
      if (mat.emissive && typeof mat.emissive.set === "function") {
        mat.emissive.set("#000000");
        mat.emissiveIntensity = 0;
      }
    }
    internal.appliedTextureSrc = desiredSrc;
    mat.needsUpdate = true;
  }

  // ---- LAYER TEXTURE (UV-mapped overlays — independent from base fabric tiling) ----
  const layerSrc = resolveLayerCompositeSrc(state);
  if (layerSrc !== internal.appliedLayerSrc) {
    if (internal.appliedLayerSrc) {
      textureCache.release(internal.appliedLayerSrc, null);
    }
    if (layerSrc) {
      const lt = acquireLayerTexture(layerSrc);
      lt.colorSpace = THREE.SRGBColorSpace;
      lt.anisotropy = APP_DATA_0.perf.maxAnisotropy;
      lt.minFilter = THREE.LinearMipmapLinearFilter;
      lt.magFilter = THREE.LinearFilter;
      lt.generateMipmaps = true;
      lt.needsUpdate = true;
      setLayerMap(mat, lt);
    } else {
      setLayerMap(mat, null);
    }
    internal.appliedLayerSrc = layerSrc;
  }

  // ---- TILING (UV vs world-space triplanar) ----
  const tilingMode = state?.tilingMode ?? "world";
  const tex = mat.map !== emptyBaseTex ? mat.map : null;
  if (tex && state) {
    applyTextureTransform(tex, {
      scale: state.textureScale ?? 8,
      rotation: state.textureRotation ?? 0,
      offsetX: state.textureOffsetX ?? 0,
      offsetY: state.textureOffsetY ?? 0,
    });
    if (mat.emissiveMap) {
      applyTextureTransform(mat.emissiveMap, {
        scale: state.textureScale ?? 8,
        rotation: state.textureRotation ?? 0,
        offsetX: state.textureOffsetX ?? 0,
        offsetY: state.textureOffsetY ?? 0,
      });
    }
  }

  // Both modes use world-space triplanar for continuous fabric across all mesh
  // parts. UV mode maps textureScale → world scale; world mode uses worldTilingScale.
  // Design layers remain UV-mapped independently via the shader overlay.
  const worldScale =
    tilingMode === "world"
      ? (state?.worldTilingScale ?? APP_DATA_0.tiling.defaultWorldScale)
      : textureScaleToWorldScale(state?.textureScale ?? 8);
  const tilingOpts = {
    worldScale,
    rotationDeg: state?.textureRotation ?? 0,
    offsetX: state?.textureOffsetX ?? 0,
    offsetY: state?.textureOffsetY ?? 0,
  };
  enableWorldTiling(mat, tilingOpts);
  updateWorldTilingUniforms(mat, tilingOpts);

  // ---- FABRIC PRESET ----
  const presetId = state?.fabricPreset ?? "cotton";
  const preset = APP_DATA_0.fabricPresets[presetId] ?? APP_DATA_0.fabricPresets.cotton;
  
  if (mat.roughness !== undefined) mat.roughness = state?.roughness ?? preset.roughness;
  if (mat.metalness !== undefined) mat.metalness = preset.metalness;
  
  if (mat.sheen !== undefined) {
    mat.sheen = preset.sheen;
    mat.sheenRoughness = preset.sheenRoughness;
    if (!mat.sheenColor) mat.sheenColor = new THREE.Color("#ffffff");
  }
  
  if (mat.clearcoat !== undefined) {
    mat.clearcoat = preset.clearcoat;
    mat.clearcoatRoughness = 0.4;
  }
  
  mat.envMapIntensity = state?.reflectionIntensity ?? preset.envIntensity;

  // ---- ACTIVE PART HIGHLIGHT ----
  if (isActive && mat.emissive && typeof mat.emissive.set === "function") {
    if (mat.map) {
      mat.emissive.set("#b192c4"); 
      mat.emissiveIntensity = 0.65;
    } else {
      mat.emissive.set("#7e3c8c");
      mat.emissiveIntensity = 0.25;
    }
  } else if (!desiredSrc && mat.emissive && typeof mat.emissive.set === "function") {
    mat.emissive.set("#000000");
    mat.emissiveIntensity = 0;
  } else if (mat.emissive && typeof mat.emissive.set === "function") {
    mat.emissive.set("#ffffff");
    mat.emissiveIntensity = 0.4;
  }
}

/** Normalize GLB materials to Physical for hyper-realism. */
function normalizeToPhysical(mat: THREE.Material | undefined | null): THREE.MeshPhysicalMaterial | null {
  if (!mat) return null;
  if (mat instanceof THREE.MeshPhysicalMaterial) return mat;
  try {
    const p = new THREE.MeshPhysicalMaterial();
    p.copy(mat);
    return p;
  } catch (e) {
    console.warn("[normalizeToPhysical] failed to copy material", e);
    return null;
  }
}

function releaseAllMaterialTextures(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      const s = (m.userData as Record<string, unknown>)[MATERIAL_USERDATA_KEY] as
        | AppliedMaterialState
        | undefined;
      if (s?.appliedTextureSrc) {
        const mm = m as THREE.MeshStandardMaterial;
        textureCache.release(s.appliedTextureSrc, mm.map ?? null);
        s.appliedTextureSrc = null;
        mm.map = null;
      }
    }
  });
}

/* ============================================================
 * GLB-driven garment view
 * ============================================================ */

function GlbGarment({
  typeId, partStates, activePart, onSelectPart, scene, onUvWireframeGenerated
}: {
  typeId: GarmentTypeId;
  partStates: Record<string, PartState>;
  activePart: string;
  onSelectPart: (k: string) => void;
  scene: THREE.Group;
  onUvWireframeGenerated?: (partKey: string, dataUrl: string) => void;
}) {
  const garment = getGarment(typeId);
  const wireframeCache = useRef<Record<string, string>>({});

  useEffect(() => {
    let meshIndex = 0;
    try {
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh || !mesh.isMesh) return;
        
        // Upgrade material once to Physical for hyper-realism
        if (!(mesh.material instanceof THREE.MeshPhysicalMaterial)) {
          if (Array.isArray(mesh.material)) {
            mesh.material = (mesh.material as THREE.Material[])
              .map((m) => normalizeToPhysical(m))
              .filter(Boolean) as THREE.MeshPhysicalMaterial[];
          } else {
            const p = normalizeToPhysical(mesh.material);
            if (p) mesh.material = p;
          }
        }

        const partId = resolveMeshPartId(garment, mesh, meshIndex++);
        const key = partKey(garment.id, partId);
        const state = partStates[key];
        const isActive = activePart === key;
        
        if (isActive && onUvWireframeGenerated && !wireframeCache.current[key]) {
          const wireframeUrl = generateUvWireframe(mesh);
          wireframeCache.current[key] = wireframeUrl;
          onUvWireframeGenerated(key, wireframeUrl);
        }

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if (!m) return;
          try {
            applyPartToMaterial(m, state, isActive);
          } catch (e) {
            console.warn("[GlbGarment] material application failed", key, e);
          }
        });
        mesh.userData.partKey = key;
      });
    } catch (e) {
      console.warn("[GlbGarment] traverse failed", e);
    }
  }, [scene, garment, partStates, activePart]);

  // Handle scene disposal on unmount - this is the "owner" of this cloned scene instance
  useEffect(() => {
    return () => {
      releaseAllMaterialTextures(scene);
      disposeScene(scene);
    };
  }, [scene]);

  return (
    <primitive
      object={scene}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        const k = (e.object.userData as { partKey?: string }).partKey;
        if (k) onSelectPart(k);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    />
  );
}

/* ============================================================
 * Procedural fallback meshes
 * ============================================================ */

type ProcProps = {
  typeId: GarmentTypeId;
  partStates: Record<string, PartState>;
  activePart: string;
  onSelectPart: (k: string) => void;
};

function PartMesh({
  typeId, partId, partStates, activePart, onSelectPart, children, ...props
}: ProcProps & {
  partId: string;
  children: React.ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const k = partKey(typeId, partId);
  const state = partStates[k];
  const isActive = activePart === k;

  useEffect(() => {
    if (matRef.current) applyPartToMaterial(matRef.current, state, isActive);
  });

  // Release texture refs from this material on unmount
  useEffect(() => {
    const mat = matRef.current;
    return () => {
      if (!mat) return;
      const s = (mat.userData as Record<string, unknown>)[MATERIAL_USERDATA_KEY] as
        | AppliedMaterialState | undefined;
      if (s?.appliedTextureSrc) {
        textureCache.release(s.appliedTextureSrc, mat.map ?? null);
        s.appliedTextureSrc = null;
        mat.map = null;
      }
    };
  }, []);

  return (
    <mesh
      {...props}
      castShadow
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelectPart(k); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      {children}
      <meshPhysicalMaterial ref={matRef} />
    </mesh>
  );
}

/* — per-garment procedural geometry. Each PartMesh covers a single part id. — */

const Mirror = (els: (s: -1 | 1) => React.ReactNode) => [-1, 1].map((s) => els(s as -1 | 1));

function Shirt(p: ProcProps) {
  return (
    <group position={[0, -0.8, 0]}>
      <PartMesh {...p} partId="body" position={[0, 1.3, 0]}><boxGeometry args={[1.0, 1.5, 0.45]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="sleeves" position={[s * 0.65, 1.55, 0]} rotation={[0, 0, s * 0.35]}>
          <cylinderGeometry args={[0.16, 0.18, 1.0, 16]} />
        </PartMesh>
      ))}
      {Mirror((s) => (
        <PartMesh key={`c${s}`} {...p} partId="cuffs" position={[s * 1.1, 1.05, 0]} rotation={[0, 0, s * 0.35]}>
          <cylinderGeometry args={[0.19, 0.19, 0.1, 16]} />
        </PartMesh>
      ))}
      <PartMesh {...p} partId="collar" position={[0, 2.0, 0.1]} rotation={[0.4, 0, 0]}>
        <torusGeometry args={[0.22, 0.05, 12, 24, Math.PI]} />
      </PartMesh>
      {[1.7, 1.4, 1.1, 0.8].map((y, i) => (
        <PartMesh key={i} {...p} partId="buttons" position={[0, y, 0.23]}>
          <sphereGeometry args={[0.03, 12, 12]} />
        </PartMesh>
      ))}
    </group>
  );
}

function TShirt(p: ProcProps) {
  return (
    <group position={[0, -0.8, 0]}>
      <PartMesh {...p} partId="body" position={[0, 1.4, 0]}><boxGeometry args={[1.0, 1.2, 0.45]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="sleeves" position={[s * 0.65, 1.75, 0]} rotation={[0, 0, s * 0.4]}>
          <cylinderGeometry args={[0.18, 0.18, 0.4, 16]} />
        </PartMesh>
      ))}
      <PartMesh {...p} partId="collar" position={[0, 2.0, 0]}><torusGeometry args={[0.18, 0.04, 12, 24]} /></PartMesh>
    </group>
  );
}

function Pant(p: ProcProps) {
  return (
    <group position={[0, -1.2, 0]}>
      <PartMesh {...p} partId="waistband" position={[0, 1.45, 0]}><cylinderGeometry args={[0.45, 0.45, 0.12, 24]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="legs" position={[s * 0.2, 0.5, 0]}>
          <cylinderGeometry args={[0.18, 0.22, 1.7, 16]} />
        </PartMesh>
      ))}
      {Mirror((s) => (
        <PartMesh key={`p${s}`} {...p} partId="pocket" position={[s * 0.32, 1.15, 0.2]}>
          <boxGeometry args={[0.22, 0.18, 0.02]} />
        </PartMesh>
      ))}
    </group>
  );
}

function Top(p: ProcProps) {
  return (
    <group position={[0, -0.6, 0]}>
      <PartMesh {...p} partId="body" position={[0, 1.4, 0]}><cylinderGeometry args={[0.42, 0.48, 1.0, 24]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="sleeves" position={[s * 0.55, 1.65, 0]} rotation={[0, 0, s * 0.4]}>
          <cylinderGeometry args={[0.14, 0.16, 0.55, 16]} />
        </PartMesh>
      ))}
      <PartMesh {...p} partId="neckline" position={[0, 1.95, 0]}><torusGeometry args={[0.18, 0.035, 12, 24]} /></PartMesh>
    </group>
  );
}

function TrackPants(p: ProcProps) {
  return (
    <group position={[0, -1.2, 0]}>
      <PartMesh {...p} partId="waistband" position={[0, 1.45, 0]}><cylinderGeometry args={[0.46, 0.46, 0.14, 24]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="legs" position={[s * 0.22, 0.5, 0]}>
          <cylinderGeometry args={[0.2, 0.22, 1.75, 16]} />
        </PartMesh>
      ))}
      {Mirror((s) => (
        <PartMesh key={`st${s}`} {...p} partId="stripes" position={[s * 0.42, 0.5, 0]}>
          <boxGeometry args={[0.04, 1.7, 0.02]} />
        </PartMesh>
      ))}
    </group>
  );
}

function Hoodie(p: ProcProps) {
  return (
    <group position={[0, -0.8, 0]}>
      <PartMesh {...p} partId="body" position={[0, 1.3, 0]}><boxGeometry args={[1.1, 1.5, 0.5]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="sleeves" position={[s * 0.7, 1.55, 0]} rotation={[0, 0, s * 0.35]}>
          <cylinderGeometry args={[0.18, 0.2, 1.0, 16]} />
        </PartMesh>
      ))}
      {Mirror((s) => (
        <PartMesh key={`c${s}`} {...p} partId="cuffs" position={[s * 1.15, 1.05, 0]} rotation={[0, 0, s * 0.35]}>
          <cylinderGeometry args={[0.21, 0.21, 0.12, 16]} />
        </PartMesh>
      ))}
      <PartMesh {...p} partId="hood" position={[0, 2.15, -0.1]}>
        <sphereGeometry args={[0.42, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
      </PartMesh>
      <PartMesh {...p} partId="pocket" position={[0, 0.95, 0.27]}><boxGeometry args={[0.7, 0.35, 0.05]} /></PartMesh>
    </group>
  );
}

function Skirt(p: ProcProps) {
  return (
    <group position={[0, -1, 0]}>
      <PartMesh {...p} partId="waistband" position={[0, 1.45, 0]}><cylinderGeometry args={[0.52, 0.52, 0.12, 24]} /></PartMesh>
      <PartMesh {...p} partId="skirt" position={[0, 0.8, 0]}><coneGeometry args={[0.95, 1.3, 24, 1, true]} /></PartMesh>
    </group>
  );
}

function Lehenga(p: ProcProps) {
  return (
    <group position={[0, -1.4, 0]}>
      <PartMesh {...p} partId="blouse" position={[0, 2.0, 0]}><cylinderGeometry args={[0.42, 0.5, 0.55, 24]} /></PartMesh>
      <PartMesh {...p} partId="skirt" position={[0, 0.6, 0]}><coneGeometry args={[1.4, 2.0, 32, 1, true]} /></PartMesh>
      <PartMesh {...p} partId="border" position={[0, -0.35, 0]}><torusGeometry args={[1.4, 0.05, 12, 48]} /></PartMesh>
      <PartMesh {...p} partId="dupatta" position={[0.35, 1.7, 0.35]} rotation={[0.2, 0.2, -0.2]}>
        <planeGeometry args={[1.7, 2.4, 16, 16]} />
      </PartMesh>
    </group>
  );
}

function Gown(p: ProcProps) {
  return (
    <group position={[0, -1.2, 0]}>
      <PartMesh {...p} partId="bodice" position={[0, 1.9, 0]}><cylinderGeometry args={[0.4, 0.5, 0.7, 24]} /></PartMesh>
      <PartMesh {...p} partId="skirt" position={[0, 0.6, 0]}><coneGeometry args={[1.2, 1.8, 32, 1, true]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="sleeves" position={[s * 0.55, 1.85, 0]} rotation={[0, 0, s * 0.4]}>
          <cylinderGeometry args={[0.12, 0.16, 1.0, 16]} />
        </PartMesh>
      ))}
      <PartMesh {...p} partId="trim" position={[0, -0.3, 0]}><torusGeometry args={[1.2, 0.04, 8, 48]} /></PartMesh>
    </group>
  );
}

function Kurti(p: ProcProps) {
  return (
    <group position={[0, -1, 0]}>
      <PartMesh {...p} partId="body" position={[0, 1.4, 0]}><cylinderGeometry args={[0.55, 0.7, 1.6, 32]} /></PartMesh>
      <PartMesh {...p} partId="neckline" position={[0, 2.1, 0]}><torusGeometry args={[0.18, 0.04, 12, 24]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="sleeves" position={[s * 0.65, 1.85, 0]} rotation={[0, 0, s * 0.3]}>
          <cylinderGeometry args={[0.16, 0.18, 0.7, 16]} />
        </PartMesh>
      ))}
      <PartMesh {...p} partId="hem" position={[0, 0.55, 0]}><torusGeometry args={[0.7, 0.04, 8, 48]} /></PartMesh>
    </group>
  );
}

function Kurta(p: ProcProps) {
  return (
    <group position={[0, -1.1, 0]}>
      <PartMesh {...p} partId="body" position={[0, 1.4, 0]}><cylinderGeometry args={[0.55, 0.62, 1.9, 24]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="sleeves" position={[s * 0.65, 1.85, 0]} rotation={[0, 0, s * 0.3]}>
          <cylinderGeometry args={[0.17, 0.19, 1.0, 16]} />
        </PartMesh>
      ))}
      <PartMesh {...p} partId="collar" position={[0, 2.25, 0]}><cylinderGeometry args={[0.18, 0.18, 0.12, 16]} /></PartMesh>
      <PartMesh {...p} partId="placket" position={[0, 1.6, 0.56]}><boxGeometry args={[0.08, 0.9, 0.02]} /></PartMesh>
      {[2.05, 1.85, 1.65, 1.45].map((y, i) => (
        <PartMesh key={i} {...p} partId="buttons" position={[0, y, 0.58]}>
          <sphereGeometry args={[0.025, 12, 12]} />
        </PartMesh>
      ))}
    </group>
  );
}

function Salwar(p: ProcProps) {
  return (
    <group position={[0, -1.2, 0]}>
      <PartMesh {...p} partId="waistband" position={[0, 1.45, 0]}><cylinderGeometry args={[0.5, 0.5, 0.12, 24]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="legs" position={[s * 0.22, 0.55, 0]}>
          <cylinderGeometry args={[0.36, 0.18, 1.7, 16]} />
        </PartMesh>
      ))}
      {Mirror((s) => (
        <PartMesh key={`c${s}`} {...p} partId="cuffs" position={[s * 0.22, -0.32, 0]}>
          <cylinderGeometry args={[0.19, 0.19, 0.1, 16]} />
        </PartMesh>
      ))}
    </group>
  );
}

function Coat(p: ProcProps) {
  return (
    <group position={[0, -1, 0]}>
      <PartMesh {...p} partId="body" position={[0, 1.2, 0]}><boxGeometry args={[1.1, 2.0, 0.55]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="sleeves" position={[s * 0.7, 1.45, 0]} rotation={[0, 0, s * 0.32]}>
          <cylinderGeometry args={[0.18, 0.2, 1.3, 16]} />
        </PartMesh>
      ))}
      <PartMesh {...p} partId="collar" position={[0, 2.05, 0.05]} rotation={[0.4, 0, 0]}>
        <torusGeometry args={[0.25, 0.05, 12, 24, Math.PI]} />
      </PartMesh>
      {Mirror((s) => (
        <PartMesh key={`l${s}`} {...p} partId="lapel" position={[s * 0.25, 1.6, 0.28]} rotation={[0, 0, -s * 0.2]}>
          <boxGeometry args={[0.18, 0.8, 0.04]} />
        </PartMesh>
      ))}
      {[1.7, 1.4, 1.1, 0.8].map((y, i) => (
        <PartMesh key={i} {...p} partId="buttons" position={[0, y, 0.28]}>
          <sphereGeometry args={[0.035, 12, 12]} />
        </PartMesh>
      ))}
    </group>
  );
}

function Plazo(p: ProcProps) {
  return (
    <group position={[0, -1.2, 0]}>
      <PartMesh {...p} partId="waistband" position={[0, 1.45, 0]}><cylinderGeometry args={[0.48, 0.48, 0.12, 24]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="legs" position={[s * 0.25, 0.5, 0]}>
          <cylinderGeometry args={[0.42, 0.22, 1.75, 24]} />
        </PartMesh>
      ))}
    </group>
  );
}

function Blouse(p: ProcProps) {
  return (
    <group position={[0, -0.4, 0]}>
      <PartMesh {...p} partId="body" position={[0, 1.6, 0]}><cylinderGeometry args={[0.42, 0.48, 0.7, 24]} /></PartMesh>
      {Mirror((s) => (
        <PartMesh key={s} {...p} partId="sleeves" position={[s * 0.55, 1.75, 0]} rotation={[0, 0, s * 0.45]}>
          <cylinderGeometry args={[0.12, 0.16, 0.4, 16]} />
        </PartMesh>
      ))}
      <PartMesh {...p} partId="neckline" position={[0, 2.0, 0]}><torusGeometry args={[0.17, 0.035, 12, 24]} /></PartMesh>
    </group>
  );
}

function Saree(p: ProcProps) {
  return (
    <group position={[0, -1.2, 0]}>
      <PartMesh {...p} partId="blouse" position={[0, 1.9, 0]}><cylinderGeometry args={[0.45, 0.5, 0.55, 24]} /></PartMesh>
      <PartMesh {...p} partId="pleats" position={[0, 0.8, 0]}><cylinderGeometry args={[0.55, 0.9, 1.7, 32]} /></PartMesh>
      <PartMesh {...p} partId="border" position={[0, -0.05, 0]}><torusGeometry args={[0.9, 0.06, 12, 32]} /></PartMesh>
      <PartMesh {...p} partId="pallu" position={[0.3, 1.6, 0.35]} rotation={[0.2, 0.2, -0.2]}>
        <planeGeometry args={[1.6, 2.2, 16, 16]} />
      </PartMesh>
    </group>
  );
}

const PROCEDURAL: Partial<Record<GarmentTypeId, React.FC<ProcProps>>> = {
  shirt: Shirt,
  tshirt: TShirt,
  pant: Pant,
  trackpants: TrackPants,
  hoodie: Hoodie,
  skirt: Skirt,
  lehenga: Lehenga,
  gown: Gown,
  kurti: Kurti,
  kurta: Kurta,
  salwar: Salwar,
  coat: Coat,
  plazo: Plazo,
  jacket: Coat,
  dress: Gown,
};

function ProceduralGarment(p: ProcProps) {
  const Comp = PROCEDURAL[p.typeId] || Shirt;
  return <Comp {...p} />;
}

/* ============================================================
 * Mannequin (optional)
 * ============================================================ */
function Mannequin({ visible, gender }: { visible: boolean; gender: "men" | "women" | "unisex" }) {
  if (!visible) return null;
  const skin = "#e8c39a";
  return (
    <group>
      <mesh position={[0, 2.55, 0]}><sphereGeometry args={[0.27, 24, 24]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
      <mesh position={[0, 2.2, 0]}><cylinderGeometry args={[0.09, 0.11, 0.18, 12]} /><meshStandardMaterial color={skin} /></mesh>
      {gender === "women" && (
        <mesh position={[0, 1.55, 0.15]}><sphereGeometry args={[0.18, 16, 16]} /><meshStandardMaterial color={skin} /></mesh>
      )}
    </group>
  );
}

/* ============================================================
 * Auto-spin
 * ============================================================ */
function AutoSpin({ enabled, groupRef }: { enabled: boolean; groupRef: React.RefObject<THREE.Group | null> }) {
  useFrame((_, dt) => { if (enabled && groupRef.current) groupRef.current.rotation.y += dt * 0.35; });
  return null;
}

/** Fixes blank first frame when frameloop is demand + container resize. */
function CanvasInvalidator({ typeId }: { typeId: GarmentTypeId }) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    let frames = 0;
    const tick = () => {
      invalidate();
      if (++frames < 16) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [typeId, invalidate]);

  useEffect(() => {
    const el = gl.domElement.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => invalidate());
    ro.observe(el);
    return () => ro.disconnect();
  }, [gl, invalidate]);

  return null;
}

/* ============================================================
 * Garment loader — tries GLB first, falls back to procedural.
 * ============================================================ */

interface LoadState {
  status: "idle" | "loading" | "ready" | "fallback";
  scene: THREE.Group | null;
}

function GarmentBody({
  typeId, partStates, activePart, onSelectPart, onUvWireframeGenerated
}: ProcProps & { onUvWireframeGenerated?: (partKey: string, dataUrl: string) => void }) {
  const [load, setLoad] = useState<LoadState>({ status: "loading", scene: null });

  useEffect(() => {
    let cancelled = false;
    let activeScene: THREE.Group | null = null;
    const garment = getGarment(typeId);
    setLoad({ status: "loading", scene: null });

    if (!garment.modelPath) {
      setLoad({ status: "fallback", scene: null });
      return;
    }

    loadGarmentModel(garment.modelPath).then((res) => {
      if (cancelled) {
        if (res.scene) disposeScene(res.scene);
        return;
      }
      if (res.ok && res.scene) {
        setLoad({ status: "ready", scene: res.scene });
      } else {
        setLoad({ status: "fallback", scene: null });
      }
    });

    return () => {
      cancelled = true;
      // We no longer dispose activeScene here - GlbGarment (the child) 
      // now "owns" the cloned instance and disposes it on unmount.
      // This prevents race conditions during fast transitions.
    };
  }, [typeId]);

  if (load.status === "loading") {
    return (
      <Html center>
        <div className="rounded-md bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow backdrop-blur">
          Loading {getGarment(typeId).label}…
        </div>
      </Html>
    );
  }

  if (load.status === "ready" && load.scene) {
    return (
      <Bounds fit clip observe margin={1.25}>
        <GlbGarment
          typeId={typeId}
          partStates={partStates}
          activePart={activePart}
          onSelectPart={onSelectPart}
          scene={load.scene}
          onUvWireframeGenerated={onUvWireframeGenerated}
        />
      </Bounds>
    );
  }

  // Fallback procedural
  return (
    <Bounds fit clip observe margin={1.25}>
      <ProceduralGarment
        typeId={typeId}
        partStates={partStates}
        activePart={activePart}
        onSelectPart={onSelectPart}
      />
    </Bounds>
  );
}

/* ============================================================
 * Snapshot / Capture Handler
 * ============================================================ */

function CaptureHandler() {
  const { gl, scene, camera, size } = useThree();

  useEffect(() => {
    const handleCapture = async (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        side: "front" | "back";
        onCapture: (dataUrl: string) => void;
      };
      if (!detail) return;

      const originalTarget = new THREE.Vector3(0, 0.6, 0);
      const originalPos = camera.position.clone();

      // Position camera for front or back
      if (detail.side === "front") {
        camera.position.set(0, 1.2, 4.5);
      } else {
        camera.position.set(0, 1.2, -4.5);
      }
      camera.lookAt(originalTarget);
      camera.updateMatrixWorld();

      // High quality render: temporarily increase size if needed, or just force a render.
      // We force a high-DPR render by manually calling gl.render.
      const dpr = 3; // Force 3x for "realistic high quality"
      const w = size.width * dpr;
      const h = size.height * dpr;
      
      const originalDPR = gl.getPixelRatio();
      gl.setPixelRatio(dpr);
      gl.setSize(size.width, size.height, false);
      
      // Ensure everything is updated
      try {
        if (gl && scene && camera) {
          gl.render(scene, camera);
        }
      } catch (e) {
        console.warn("Capture render failed", e);
      }

      const dataUrl = gl.domElement.toDataURL("image/png");
      detail.onCapture(dataUrl);

      // Restore
      gl.setPixelRatio(originalDPR);
      gl.setSize(size.width, size.height, false);
      camera.position.copy(originalPos);
      camera.lookAt(originalTarget);
    };

    window.addEventListener("fabrixa:capture-3d", handleCapture);
    return () => window.removeEventListener("fabrixa:capture-3d", handleCapture);
  }, [gl, scene, camera, size]);

  return null;
}

/* ============================================================
 * Public component
 * ============================================================ */

export function GarmentPreview({
  typeId, partStates, activePart, scene, autoRotate, showMannequin, onSelectPart,
  lassoActive = false, lassoMode = "freehand", onLassoMask, onUvWireframeGenerated,
}: Props) {
  const orbitLocked = lassoActive && lassoMode !== "polygon";
  const groupRef = useRef<THREE.Group>(null);
  const garment = useMemo(() => getGarment(typeId), [typeId]);
  const isTransparent = scene.id === "transparent";

  useEffect(() => () => { document.body.style.cursor = "default"; }, []);

  // PERF: only render continuously when something needs to animate (spin /
  // lasso). Otherwise demand-render so idle GPU drops to ~0%.
  return (
    <Canvas
      shadows={false}
      camera={{ position: [0, 1.2, 4.5], fov: 40 }}
      dpr={[1, Math.min(1.5, APP_DATA_0.perf.dprCap)]}
      frameloop="always"
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        alpha: true,
        preserveDrawingBuffer: true, // Required for toDataURL to work outside the render loop
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
      style={{ background: isTransparent ? "transparent" : scene.background, width: "100%", height: "100%" }}
    >
      <CaptureHandler />
      {/* Hyper-realistic Studio Rig: 3-point + Rim + Fill */}
      <ambientLight intensity={scene.ambient * 0.8} />
      <hemisphereLight args={["#ffffff", "#cfd0e0", 0.45]} />
      <directionalLight position={[4, 8, 5]} intensity={scene.keyIntensity * 1.2} />
      <directionalLight position={[-5, 4, -3]} intensity={scene.keyIntensity * 0.6} color="#dfe4ff" />
      <directionalLight position={[0, 5, -6]} intensity={scene.keyIntensity * 0.5} color="#ffe9d0" />
      <directionalLight position={[0, -4, 3]} intensity={0.3} color="#ffffff" />
      <CanvasInvalidator typeId={typeId} />
      <Suspense fallback={null}>
        <group ref={groupRef}>
          <GarmentBody
            typeId={typeId}
            partStates={partStates}
            activePart={activePart}
            onSelectPart={onSelectPart}
            onUvWireframeGenerated={onUvWireframeGenerated}
          />
          <Mannequin visible={showMannequin} gender={garment.gender ?? "unisex"} />
        </group>
        <Environment preset={scene.envPreset} />
      </Suspense>
      {!isTransparent && (
        <ContactShadows
          position={[0, -1.21, 0]}
          opacity={scene.shadowOpacity * 1.1}
          scale={8}
          blur={3.5}
          far={4}
          resolution={512}
          color="#000000"
        />
      )}
      <OrbitControls
        enablePan={!orbitLocked}
        enableZoom={!orbitLocked}
        enableRotate={!orbitLocked}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2.2}
        maxDistance={8}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.85}
        target={[0, 0.6, 0]}
      />
      <AutoSpin enabled={autoRotate && !orbitLocked} groupRef={groupRef} />
      {lassoActive && onLassoMask && (
        <LassoComputer activePart={activePart} onMask={onLassoMask} />
      )}
    </Canvas>
  );
}
