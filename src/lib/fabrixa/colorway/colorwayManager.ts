// Colorway manager — multi-variant garment color/texture snapshots.
import type { PartState } from "../garments";

export interface ColorwayPartSnapshot {
  color: string;
  textureDataUrl?: string | null;
  layerCompositeDataUrl?: string | null;
  originalTextureUrl?: string | null;
  derivedPalette?: string[] | null;
}

export interface Colorway {
  id: string;
  name: string;
  parts: Record<string, ColorwayPartSnapshot>;
  palette?: string[];
  createdAt: string;
}

export interface ProjectColorways {
  activeColorwayId: string | null;
  colorways: Colorway[];
}

export function newColorwayId(): string {
  return `cw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createColorwayFromCurrent(
  name: string,
  partStates: Record<string, PartState>,
  palette?: string[],
): Colorway {
  const parts: Record<string, ColorwayPartSnapshot> = {};
  for (const key of Object.keys(partStates)) {
    const s = partStates[key];
    parts[key] = {
      color: s.color,
      textureDataUrl: s.textureDataUrl,
      layerCompositeDataUrl: s.layerCompositeDataUrl,
      originalTextureUrl: s.originalTextureUrl,
      derivedPalette: s.derivedPalette,
    };
  }
  return {
    id: newColorwayId(),
    name,
    parts,
    palette,
    createdAt: new Date().toISOString(),
  };
}

export function applyColorwayToStates(
  colorway: Colorway,
  partStates: Record<string, PartState>,
): Record<string, PartState> {
  const next = { ...partStates };
  for (const [key, snap] of Object.entries(colorway.parts)) {
    if (!next[key]) continue;
    next[key] = {
      ...next[key],
      color: snap.color,
      ...(snap.textureDataUrl !== undefined ? { textureDataUrl: snap.textureDataUrl } : {}),
      ...(snap.layerCompositeDataUrl !== undefined
        ? { layerCompositeDataUrl: snap.layerCompositeDataUrl }
        : {}),
      originalTextureUrl: snap.originalTextureUrl ?? null,
      derivedPalette: snap.derivedPalette ?? null,
    };
  }
  return next;
}

export function duplicateColorway(colorway: Colorway, name?: string): Colorway {
  return {
    ...colorway,
    id: newColorwayId(),
    name: name ?? `${colorway.name} Copy`,
    createdAt: new Date().toISOString(),
  };
}

export function renameColorway(colorway: Colorway, name: string): Colorway {
  return { ...colorway, name };
}

export function deleteColorway(state: ProjectColorways, id: string): ProjectColorways {
  const colorways = state.colorways.filter((c) => c.id !== id);
  const activeColorwayId =
    state.activeColorwayId === id ? (colorways[0]?.id ?? null) : state.activeColorwayId;
  return { activeColorwayId, colorways };
}

export function createColorwayFromPalette(
  name: string,
  partStates: Record<string, PartState>,
  colors: string[],
  names?: string[],
): Colorway {
  const cw = createColorwayFromCurrent(name, partStates, colors);
  if (names?.length) cw.name = `${name} (${names[0]})`;
  return cw;
}
