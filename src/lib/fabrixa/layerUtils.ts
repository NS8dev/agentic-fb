import { compositeLayers } from "./TextureCompositor";
import type { DesignLayer, PartState } from "./garments";

/** Re-composite design layers and return the new overlay data URL. */
export async function recompositeLayerOverlay(
  layers: DesignLayer[],
): Promise<string | null> {
  return compositeLayers(null, layers);
}

/** Apply a layer patch and re-composite for a single part. */
export async function patchPartLayers(
  state: PartState,
  layers: DesignLayer[],
): Promise<Partial<PartState>> {
  const layerCompositeDataUrl = await recompositeLayerOverlay(layers);
  return { layers, layerCompositeDataUrl };
}

/** Sync content from a source layer to all linked layers across parts. */
export function syncLinkedLayerContent(
  partStates: Record<string, PartState>,
  sourcePartKey: string,
  sourceLayer: DesignLayer,
): Record<string, PartState> {
  if (!sourceLayer.linkedGroupId) return partStates;
  const gid = sourceLayer.linkedGroupId;
  const next = { ...partStates };
  for (const [key, st] of Object.entries(partStates)) {
    const idx = st.layers?.findIndex((l) => l.linkedGroupId === gid);
    if (idx === undefined || idx < 0) continue;
    const layers = [...st.layers];
    layers[idx] = {
      ...layers[idx],
      contentDataUrl: sourceLayer.contentDataUrl,
      contentJson: sourceLayer.contentJson,
      opacity: sourceLayer.opacity,
      visible: sourceLayer.visible,
    };
    next[key] = { ...st, layers };
  }
  return next;
}

/** After syncing linked layers, re-composite every affected part. */
export async function recompositeAllAffected(
  partStates: Record<string, PartState>,
  affectedKeys: string[],
): Promise<Record<string, PartState>> {
  const next = { ...partStates };
  for (const key of affectedKeys) {
    const st = next[key];
    if (!st?.layers?.length) {
      next[key] = { ...st, layerCompositeDataUrl: null };
      continue;
    }
    const layerCompositeDataUrl = await recompositeLayerOverlay(st.layers);
    next[key] = { ...st, layerCompositeDataUrl };
  }
  return next;
}

/** Collect all part keys that share a linked group id. */
export function partKeysWithLinkGroup(
  partStates: Record<string, PartState>,
  groupId: string,
): string[] {
  return Object.entries(partStates)
    .filter(([, st]) => st.layers?.some((l) => l.linkedGroupId === groupId))
    .map(([k]) => k);
}

export function newLayerId(): string {
  return `layer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newLinkGroupId(): string {
  return `link_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
