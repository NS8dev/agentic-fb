import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Download,
  Sparkles,
  ImageDown,
  FileImage,
  FileText,
  ImageOff,
  Grid3x3,
  Wand2,
  Shirt,
  CheckCircle2,
  HelpCircle,
  RotateCw,
  Globe2,
  Settings,
  LogOut,
  Cloud,
  CloudDownload,
  Coins,
  Scissors,
  MoreVertical,
  User as UserIcon,
  Crown,
  Calendar,
  Palette,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { GarmentMenu } from "@/components/fabrixa/GarmentMenu";
import { loadGarmentModel } from "@/lib/fabrixa/modelLoader";
import { ThemeToggle } from "@/components/fabrixa/ThemeToggle";
import { FabricEditor } from "@/components/fabrixa/FabricEditor";
import { GarmentPreview } from "@/components/fabrixa/GarmentPreview";
import { LassoOverlay } from "@/components/fabrixa/LassoSelector";
import { LayersPanel3D } from "@/components/fabrixa/LayersPanel3D";
import { ColorPanel, ColorPickerBlock } from "@/components/fabrixa/ColorPanel";
import { SettingsPanel, loadStoredPrefs } from "@/components/fabrixa/SettingsPanel";
import { ColorwayManagerPanel } from "@/components/fabrixa/ColorwayManagerPanel";
import {
  type ProjectColorways,
  createColorwayFromCurrent,
  applyColorwayToStates,
  duplicateColorway,
  renameColorway,
  deleteColorway,
  createColorwayFromPalette,
} from "@/lib/fabrixa/colorway/colorwayManager";
import { DEFAULT_GARMENT_ID, isGarmentAvailable } from "@/lib/fabrixa/garmentCatalog";
import { useWorkspaceAccess } from "@/lib/fabrixa/workspaceAccess";
import { AIStudioPanel } from "@/components/fabrixa/AIStudioPanel";
import { NeckDesignerPanel } from "@/components/fabrixa/NeckDesignerPanel";
import { useAuth } from "@/lib/fabrixa/useAuth";
import {
  saveProject,
  loadProject,
  recordExport,
  recordAiDesign,
  recordRender3d,
} from "@/lib/fabrixa/cloudSave";
import {
  GARMENT_TYPES,
  getGarment,
  initStatesFor,
  partKey,
  defaultPartState,
  type GarmentTypeId,
  type PartState,
  type DesignLayer,
} from "@/lib/fabrixa/garments";
import { getDbData, setDbData } from "@/lib/fabrixa/storage";
import { compositeLayers } from "@/lib/fabrixa/TextureCompositor";
import {
  newLayerId,
  recompositeLayerOverlay,
  recompositeAllAffected,
  partKeysWithLinkGroup,
} from "@/lib/fabrixa/layerUtils";
import { APP_DATA_0, FABRIC_PRESET_IDS, type FabricPresetId } from "@/lib/fabrixa/APP_DATA_0";
import { PATTERN_PRESETS, GRADIENT_PRESETS, patternToDataUrl } from "@/lib/fabrixa/presets";
import { SCENE_PRESETS, type ScenePresetId } from "@/lib/fabrixa/scenePresets";
import { THEMES, type ThemeId } from "@/lib/fabrixa/themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { SubscriptionExpiredOverlay } from "@/components/fabrixa/SubscriptionExpiredOverlay";
import { PricingDialog } from "@/components/fabrixa/PricingDialog";
import { useSubscriptionStore } from "@/lib/fabrixa/subscriptionStore";
import { useRunGated } from "@/lib/fabrixa/runGated";
import { garmentsForPlan, isGarmentAllowedForTier } from "@/lib/fabrixa/planAccess";
import { CoinCostBadge } from "@/components/fabrixa/CoinCostBadge";
import { useEntitlements } from "@/lib/fabrixa/entitlements";
import { storeTierFromSupabase } from "@/lib/fabrixa/tierMap";

interface FabrixaApi {
  exportPNG: (mult?: number) => string | null;
  exportJPG: (mult?: number, q?: number) => string | null;
  exportWebP: (mult?: number, q?: number) => string | null;
  exportTransparent: (mult?: number) => string | null;
  exportTiled: () => Promise<string> | null;
  loadImage: (dataUrl: string, opts?: { replaceCanvas?: boolean }) => Promise<void>;
  persist: () => Promise<{ url: string; json: string }>;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function maskImageToAlphaCanvas(
  mask: HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(mask, 0, 0, width, height);
  const img = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < img.data.length; i += 4) {
    const luminance =
      (img.data[i] * 0.2126 + img.data[i + 1] * 0.7152 + img.data[i + 2] * 0.0722) / 255;
    img.data[i] = 255;
    img.data[i + 1] = 255;
    img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(img.data[i + 3] * luminance);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function readInitialPrefs() {
  if (typeof window === "undefined") {
    return {
      exportQuality: "web" as const,
      defaultGarmentId: DEFAULT_GARMENT_ID,
      sceneId: "studio" as ScenePresetId,
    };
  }
  const p = loadStoredPrefs();
  const gid =
    p.defaultGarmentId && isGarmentAvailable(p.defaultGarmentId)
      ? p.defaultGarmentId
      : DEFAULT_GARMENT_ID;
  return {
    exportQuality: p.exportQuality ?? "web",
    defaultGarmentId: gid,
    sceneId: (p.sceneId ?? "studio") as ScenePresetId,
  };
}

export function FabrixaApp() {
  const { canAccessWorkspace, ent: entData } = useWorkspaceAccess();
  const initial = useMemo(() => readInitialPrefs(), []);

  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [designJson, setDesignJson] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<GarmentTypeId>(initial.defaultGarmentId);
  const [defaultGarmentId, setDefaultGarmentId] = useState<GarmentTypeId>(initial.defaultGarmentId);
  const garment = useMemo(() => getGarment(typeId), [typeId]);

  useEffect(() => {
    if (!isGarmentAvailable(typeId)) setTypeId(DEFAULT_GARMENT_ID);
  }, [typeId]);

  const [partStates, setPartStates] = useState<Record<string, PartState>>(() => {
    let obj: Record<string, PartState> = {};
    for (const g of GARMENT_TYPES) obj = { ...obj, ...initStatesFor(g) };
    return obj;
  });

  const [colorwayState, setColorwayState] = useState<ProjectColorways>(() => ({
    activeColorwayId: null,
    colorways: [],
  }));

  const [activePart, setActivePart] = useState<string>(() =>
    partKey(initial.defaultGarmentId, getGarment(initial.defaultGarmentId).parts[0]?.id ?? "body"),
  );
  const [sceneId, setSceneId] = useState<ScenePresetId>(initial.sceneId);
  const [view, setView] = useState<"design" | "preview" | "ai">("design");
  const [autoRotate, setAutoRotate] = useState(false);
  const [showMannequin, setShowMannequin] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return "default";
    return (window.localStorage.getItem("fabrixa:theme") as ThemeId) || "default";
  });
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "jpg" | "webp" | "pdf">("png");
  const [exportQuality, setExportQuality] = useState<"web" | "print" | "hd">(initial.exportQuality);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [lassoActive, setLassoActive] = useState(false);
  const [lassoMode, setLassoMode] = useState<"brush" | "freehand" | "polygon">("freehand");
  const [lassoBrushSize, setLassoBrushSize] = useState(32);
  const [showTilingOverlay, setShowTilingOverlay] = useState(false);
  const [regionFillKind, setRegionFillKind] = useState<"color" | "pattern" | "gradient">("color");
  const [regionColor, setRegionColor] = useState("#ffffff");
  const [regionPatternId, setRegionPatternId] = useState("dots");
  const [regionGradientId, setRegionGradientId] = useState("sunset");
  const [regionPreviewUrl, setRegionPreviewUrl] = useState<string | null>(null);
  const [neckOpen, setNeckOpen] = useState(false);
  const [uvWireframes, setUvWireframes] = useState<Record<string, string>>({});
  const handleUvWireframeGenerated = useCallback((key: string, url: string) => {
    setUvWireframes((prev) => ({ ...prev, [key]: url }));
  }, []);
  const autoLoadedRef = useMemo(() => ({ done: false }), []);
  const runGated = useRunGated();
  const applyDailyResetIfNeeded = useSubscriptionStore((s) => s.applyDailyResetIfNeeded);
  const hydrateFromUserDoc = useSubscriptionStore((s) => s.hydrateFromUserDoc);
  const subTier = useSubscriptionStore((s) => s.subscriptionTier);
  const adminMode = useSubscriptionStore((s) => s.adminMode);
  const coinBalance = useSubscriptionStore((s) => s.coinBalance);

  useEffect(() => {
    applyDailyResetIfNeeded();
  }, [applyDailyResetIfNeeded]);

  useEffect(() => {
    if (!entData) return;
    const storeTier =
      entData.subscriptionTier === "none" ? null : storeTierFromSupabase(entData.subscriptionTier);
    hydrateFromUserDoc({
      subscriptionTier: storeTier,
      basePlanExpiry: entData.basePlanExpiry ? new Date(entData.basePlanExpiry).getTime() : null,
      coinBalance: entData.coinBalance,
      dailyAllowance: entData.dailyAllowance,
      hasAiPack: entData.hasAiPack,
      aiPackExpiry: entData.aiPackExpiry ? new Date(entData.aiPackExpiry).getTime() : null,
      dailyAiRequestsRemaining: entData.dailyAiRequestsRemaining,
      dailyShowroomDownloadsCount: entData.dailyShowroomDownloadsCount,
      lastDailyResetAt: entData.lastDailyResetAt ? new Date(entData.lastDailyResetAt).getTime() : 0,
    });
  }, [entData, hydrateFromUserDoc]);

  useEffect(() => {
    if (Object.keys(partStates).length === 0) return;
    const timer = setTimeout(() => {
      setDbData("fabrixa:parts-v2", JSON.stringify(partStates));
    }, 1000); // 1s debounce
    return () => clearTimeout(timer);
  }, [partStates]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDbData("fabrixa:colorways", JSON.stringify(colorwayState));
    }, 1000); // 1s debounce
    return () => clearTimeout(timer);
  }, [colorwayState]);

  useEffect(() => {
    getDbData("fabrixa:colorways").then((saved) => {
      if (saved) {
        try {
          setColorwayState(JSON.parse(saved));
        } catch {
          /* ignore */
        }
      }
    });
  }, []);

  useEffect(() => {
    getDbData("fabrixa:parts-v2").then((saved) => {
      if (saved) {
        try {
          setPartStates(JSON.parse(saved));
        } catch (e) {
          console.warn("Failed to load parts from IndexedDB", e);
        }
      }
    });
  }, []);

  const { user, signOut } = useAuth();

  // Migrate legacy saves that stored layer composite in texturePaddedDataUrl
  useEffect(() => {
    let migrated = false;
    const next: Record<string, (typeof partStates)[string]> = {};
    for (const [key, st] of Object.entries(partStates)) {
      if (st.layers?.length && !st.layerCompositeDataUrl && st.texturePaddedDataUrl) {
        next[key] = {
          ...st,
          layerCompositeDataUrl: st.texturePaddedDataUrl,
          texturePaddedDataUrl: null,
        };
        migrated = true;
      }
    }
    if (migrated) setPartStates((prev) => ({ ...prev, ...next }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window !== "undefined" && !window.localStorage.getItem("fabrixa:onboarded")) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const idle = (cb: () => void) => {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(cb);
      else setTimeout(cb, 1200);
    };
    idle(() => {
      for (const g of GARMENT_TYPES) {
        if (!g.modelPath) continue;
        void loadGarmentModel(g.modelPath);
      }
    });
  }, []);
  useEffect(() => {
    const firstPart = garment.parts[0];
    if (firstPart) {
      const first = partKey(garment.id, firstPart.id);
      if (!activePart.startsWith(garment.id + ".")) setActivePart(first);
    }

    setPartStates((prev) => {
      const next = { ...prev };
      for (const p of garment.parts) {
        const k = partKey(garment.id, p.id);
        if (!next[k]) next[k] = defaultPartState(p.defaultColor);
      }
      return next;
    });
  }, [typeId, garment, activePart]);

  const finishOnboarding = () => {
    localStorage.setItem("fabrixa:onboarded", "1");
    setShowOnboarding(false);
  };

  const updateActivePart = (patch: Partial<PartState>) =>
    setPartStates((prev) => ({ ...prev, [activePart]: { ...prev[activePart], ...patch } }));

  const api = () => (window as unknown as { __fabrixa?: FabrixaApi }).__fabrixa;

  const activeLabel =
    garment.parts.find((p) => partKey(garment.id, p.id) === activePart)?.label ?? "part";

  const changeView = async (next: "design" | "preview" | "ai") => {
    if (view === "design") {
      try {
        await api()?.persist();
      } catch (e) {
        console.warn("Design persistence failed before view change", e);
      }
    }
    setView(next);
  };

  const applyLayersToPart = async (
    partKey_: string,
    layers: DesignLayer[],
    extra: Partial<PartState> = {},
  ) => {
    const layerCompositeDataUrl = await recompositeLayerOverlay(layers);
    setPartStates((prev) => {
      if (!prev[partKey_]) return prev;
      return {
        ...prev,
        [partKey_]: { ...prev[partKey_], layers, layerCompositeDataUrl, ...extra },
      };
    });
  };

  const applyToModel = async (jumpToPreview = true) => {
    const a = api();
    let currentUrl = designUrl;
    let currentJson = designJson;

    if (a) {
      try {
        const res = await a.persist();
        if (res) {
          currentUrl = res.url;
          currentJson = res.json;
        }
      } catch (e) {
        console.warn("Persistence before apply failed", e);
      }
    }

    if (!currentUrl) {
      toast.error("Add something to the canvas first");
      return;
    }
    const state = partStates[activePart];
    if (!state) return;

    const hasMask = !!state.selectionMaskDataUrl;
    const feature = activeLayerId || hasMask ? "MASKED_APPLY" : "APPLY_TO_MODEL";

    if (activeLayerId) {
      const layer = state.layers?.find((l) => l.id === activeLayerId);
      if (layer?.locked) {
        toast.error("Layer is locked — unlock it to apply changes");
        return;
      }
    }

    await runGated(feature, async () => {
      const nextLayers = [...(state.layers || [])];
      let newBase = state.textureDataUrl;
      let clearSelection = false;

      if (activeLayerId) {
        const idx = nextLayers.findIndex((l) => l.id === activeLayerId);
        if (idx !== -1 && !nextLayers[idx].locked) {
          const updated = {
            ...nextLayers[idx],
            contentDataUrl: currentUrl!,
            contentJson: currentJson || undefined,
          };
          nextLayers[idx] = updated;
          const gid = updated.linkedGroupId;
          if (gid) {
            const affected = partKeysWithLinkGroup(partStates, gid);
            let next = { ...partStates };
            for (const key of affected) {
              const li = next[key].layers.findIndex((l) => l.linkedGroupId === gid);
              if (li < 0) continue;
              const ls = [...next[key].layers];
              ls[li] = {
                ...ls[li],
                contentDataUrl: currentUrl!,
                contentJson: currentJson || undefined,
              };
              next[key] = { ...next[key], layers: ls };
            }
            next = await recompositeAllAffected(next, affected);
            next[activePart] = {
              ...next[activePart],
              layers: nextLayers,
              selectionMaskDataUrl: hasMask ? null : state.selectionMaskDataUrl,
            };
            setPartStates(next);
            setActiveLayerId(null);
            toast.success(`Updated linked layer on ${activeLabel}`);
            if (jumpToPreview) await changeView("preview");
            return;
          }
          toast.success(`Updated layer on ${activeLabel}`);
        }
      } else if (hasMask) {
        const layerId = newLayerId();
        nextLayers.push({
          id: layerId,
          name: `Selection ${nextLayers.length + 1}`,
          maskUrl: state.selectionMaskDataUrl!,
          contentDataUrl: currentUrl!,
          contentJson: currentJson || undefined,
          visible: true,
          opacity: 1,
        });
        clearSelection = true;
        toast.success(`Applied design to selected region on ${activeLabel}`);
      } else {
        newBase = currentUrl;
        toast.success(`Applied base design to ${activeLabel}`, {
          icon: <CheckCircle2 className="h-4 w-4" />,
        });
      }

      const finalUrl = await compositeLayers(null, nextLayers);
      setPartStates((prev) => ({
        ...prev,
        [activePart]: {
          ...prev[activePart],
          layers: nextLayers,
          textureDataUrl: newBase!,
          layerCompositeDataUrl: finalUrl,
          selectionMaskDataUrl: clearSelection ? null : prev[activePart].selectionMaskDataUrl,
        },
      }));
      setActiveLayerId(null);
      if (jumpToPreview) await changeView("preview");
    });
  };

  const onCreateColorway = (name?: string) => {
    const finalName = name || `Colorway ${colorwayState.colorways.length + 1}`;
    const cw = createColorwayFromCurrent(finalName, partStates);
    setColorwayState((prev) => ({
      ...prev,
      activeColorwayId: cw.id,
      colorways: [cw, ...prev.colorways],
    }));
    toast.success(`Colorway "${finalName}" created`);
  };

  const onApplyColorway = (id: string) => {
    const cw = colorwayState.colorways.find((c) => c.id === id);
    if (!cw) return;
    const next = applyColorwayToStates(cw, partStates);
    setPartStates(next);
    setColorwayState((prev) => ({ ...prev, activeColorwayId: id }));
    toast.success(`Applied colorway "${cw.name}"`);
  };

  const onDuplicateColorway = (id: string) => {
    const cw = colorwayState.colorways.find((c) => c.id === id);
    if (!cw) return;
    const dup = duplicateColorway(cw);
    setColorwayState((prev) => ({
      ...prev,
      colorways: [dup, ...prev.colorways],
    }));
    toast.success(`Duplicated "${cw.name}"`);
  };

  const onDeleteColorway = (id: string) => {
    setColorwayState((prev) => deleteColorway(prev, id));
    toast.success("Colorway deleted");
  };

  const onRenameColorway = (id: string, name: string) => {
    setColorwayState((prev) => ({
      ...prev,
      colorways: prev.colorways.map((c) => (c.id === id ? renameColorway(c, name) : c)),
    }));
  };

  const handleLassoMask = (key: string, dataUrl: string, triCount: number) => {
    setLassoActive(false);
    if (!dataUrl || triCount === 0) {
      toast.error("Nothing selected — try rotating the model or drawing a larger region.");
      return;
    }
    setPartStates((prev) => ({ ...prev, [key]: { ...prev[key], selectionMaskDataUrl: dataUrl } }));
    toast.success(
      `Selected ${triCount} surface(s) on ${activeLabel}. Create a layer or edit in 2D.`,
    );
  };

  const clearLassoMask = () => {
    setPartStates((prev) => ({
      ...prev,
      [activePart]: { ...prev[activePart], selectionMaskDataUrl: null },
    }));
    toast("Selection cleared");
  };

  const createLayerFromSelection = (openEditor = false) => {
    const state = partStates[activePart];
    if (!state?.selectionMaskDataUrl) return;
    const id = newLayerId();
    const newLayer: DesignLayer = {
      id,
      name: `Layer ${(state.layers?.length || 0) + 1}`,
      maskUrl: state.selectionMaskDataUrl,
      contentDataUrl: "",
      visible: true,
      opacity: 1,
    };
    const nextLayers = [...(state.layers || []), newLayer];
    void applyLayersToPart(activePart, nextLayers, { selectionMaskDataUrl: null });
    setActiveLayerId(id);
    if (openEditor) void changeView("design");
    toast.success(`Created layer on ${activeLabel}`);
  };

  const handleEditSelection = () => createLayerFromSelection(true);

  const handleLayersChange = async (layers: DesignLayer[]) => {
    await applyLayersToPart(activePart, layers);
  };

  const handleEditLayer = (layerId: string) => {
    const layer = partStates[activePart]?.layers?.find((l) => l.id === layerId);
    if (layer?.locked) {
      toast.error("Layer is locked — unlock to edit");
      return;
    }
    setActiveLayerId(layerId);
    setDesignUrl(layer?.contentDataUrl || null);
    setDesignJson(layer?.contentJson || null);
    void changeView("design");
  };

  const partStatesRef = useRef(partStates);
  partStatesRef.current = partStates;

  useEffect(() => {
    const onLink = async (e: Event) => {
      const d = (e as CustomEvent).detail as {
        sourcePartKey: string;
        sourceLayerId: string;
        targetPartKey: string;
        targetLayerId: string;
        groupId: string;
      };
      if (!d?.groupId) return;
      let next = { ...partStatesRef.current };
      const srcLayers = [...(next[d.sourcePartKey]?.layers ?? [])];
      const srcIdx = srcLayers.findIndex((l) => l.id === d.sourceLayerId);
      const tgtLayers = [...(next[d.targetPartKey]?.layers ?? [])];
      const tgtIdx = tgtLayers.findIndex((l) => l.id === d.targetLayerId);
      if (srcIdx < 0 || tgtIdx < 0) return;
      srcLayers[srcIdx] = { ...srcLayers[srcIdx], linkedGroupId: d.groupId };
      tgtLayers[tgtIdx] = { ...tgtLayers[tgtIdx], linkedGroupId: d.groupId };
      next[d.sourcePartKey] = { ...next[d.sourcePartKey], layers: srcLayers };
      next[d.targetPartKey] = { ...next[d.targetPartKey], layers: tgtLayers };
      next = await recompositeAllAffected(next, [d.sourcePartKey, d.targetPartKey]);
      setPartStates(next);
      toast.success("Layers linked");
    };
    window.addEventListener("fabrixa:link-layers", onLink);
    return () => {
      window.removeEventListener("fabrixa:link-layers", onLink);
    };
  }, []);

  const download = (dataUrl: string, name: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name;
    a.click();
  };

  const reencodeDataUrl = async (
    src: string,
    format: "png" | "jpeg" | "webp",
    mult: number,
    quality?: number,
    transparent = false,
  ): Promise<string> => {
    const img = await loadImg(src);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * mult));
    c.height = Math.max(1, Math.round(img.height * mult));
    const cx = c.getContext("2d")!;
    if (!transparent && format !== "png") {
      cx.fillStyle = "#ffffff";
      cx.fillRect(0, 0, c.width, c.height);
    }
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = "high";
    cx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(`image/${format}`, quality);
  };

  const tileDataUrl = async (src: string, repeat = 2): Promise<string> => {
    const img = await loadImg(src);
    const c = document.createElement("canvas");
    c.width = img.width * repeat;
    c.height = img.height * repeat;
    const cx = c.getContext("2d")!;
    for (let y = 0; y < repeat; y++)
      for (let x = 0; x < repeat; x++) cx.drawImage(img, x * img.width, y * img.height);
    return c.toDataURL("image/png");
  };

  const runExport = async () => {
    const mult = exportQuality === "hd" ? 3 : exportQuality === "print" ? 2 : 1;
    const a = api();
    if (!a && !designUrl) {
      toast.error("Nothing to export — design something in 2D first");
      return;
    }
    const feature = exportQuality === "hd" ? "HD_RENDER_4K" : "STANDARD_EXPORT";
    await runGated(feature, async () => {
      const q = exportQuality === "web" ? 0.85 : 0.95;
      let u: string | null | undefined = null;
      if (exportFormat === "png") {
        u =
          a?.exportPNG(mult) ?? (designUrl ? await reencodeDataUrl(designUrl, "png", mult) : null);
        if (u) download(u, `fabrixa-${exportQuality}.png`);
      } else if (exportFormat === "jpg") {
        u =
          a?.exportJPG(mult, q) ??
          (designUrl ? await reencodeDataUrl(designUrl, "jpeg", mult, q) : null);
        if (u) download(u, `fabrixa-${exportQuality}.jpg`);
      } else if (exportFormat === "webp") {
        u =
          a?.exportWebP(mult, q) ??
          (designUrl ? await reencodeDataUrl(designUrl, "webp", mult, q) : null);
        if (u) download(u, `fabrixa-${exportQuality}.webp`);
      } else if (exportFormat === "pdf") {
        u =
          a?.exportPNG(mult) ?? (designUrl ? await reencodeDataUrl(designUrl, "png", mult) : null);
        if (!u) throw new Error("Export failed");
        const pdf = new jsPDF({ unit: "pt", format: "a4" });
        const w = pdf.internal.pageSize.getWidth() - 40;
        pdf.addImage(u, "PNG", 20, 20, w, w);
        pdf.save(`fabrixa-${exportQuality}.pdf`);
      }
      if (!u) throw new Error("Export failed");
      if (user) void recordExport(user.uid, { format: exportFormat, quality: exportQuality });
      toast.success(`Exported ${exportFormat.toUpperCase()} (${exportQuality})`);
      setExportOpen(false);
    });
  };

  const quickExport = async (kind: "transparent" | "tiled") => {
    const a = api();
    if (!a && !designUrl) {
      toast.error("Nothing to export — design something in 2D first");
      return;
    }
    await runGated("STANDARD_EXPORT", async () => {
      let u: string | null | undefined = null;
      if (kind === "transparent") {
        u =
          a?.exportTransparent(2) ??
          (designUrl ? await reencodeDataUrl(designUrl, "png", 2, undefined, true) : null);
        if (u) download(u, "fabrixa-transparent.png");
      } else if (kind === "tiled") {
        const p = a?.exportTiled();
        u = p ? await p : designUrl ? await tileDataUrl(designUrl, 2) : null;
        if (u) download(u, "fabrixa-tiled.png");
      }
      if (!u) throw new Error("Export failed");
      if (user) void recordExport(user.uid, { format: kind, quality: "web" });
      toast.success(`Exported ${kind}`);
    });
  };

  const handleRealisticExport = async (side: "front" | "back") => {
    await runGated("HD_RENDER_4K", async () => {
      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Render timeout"));
          }
        }, 8000);
        const event = new CustomEvent("fabrixa:capture-3d", {
          detail: {
            side,
            onCapture: (url: string) => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              download(url, `fabrixa-realistic-${side}.png`);
              if (user) void recordExport(user.uid, { format: `realistic-${side}`, quality: "hd" });
              toast.success(`Realistic ${side} view exported`);
              resolve();
            },
          },
        });
        window.dispatchEvent(event);
      });
    });
  };

  const handleSave = async () => {
    setDbData("fabrixa:parts-v2", JSON.stringify(partStates));
    if (!user) {
      toast.success("Saved locally");
      return;
    }
    await runGated("SAVE_PROJECT", async () => {
      try {
        await saveProject(user.uid, { canvasState: { partStates, typeId } });
        toast.success("Saved to cloud");
      } catch (e) {
        console.error(e);
        toast.success("Saved locally (cloud sync unavailable)");
      }
    });
  };

  const handleLoadCloud = async () => {
    if (!user) {
      toast.info("Sign in to load from cloud");
      return;
    }
    try {
      const data = await loadProject(user.uid);
      if (!data) {
        toast.info("No cloud save yet");
        return;
      }
      setPartStates((prev) => ({ ...prev, ...data.canvasState.partStates }));
      if (data.canvasState.typeId) setTypeId(data.canvasState.typeId as GarmentTypeId);
      toast.success("Loaded from cloud");
    } catch (e) {
      console.error(e);
      toast.error("Cloud load failed");
    }
  };

  useEffect(() => {
    if (!user || autoLoadedRef.done) return;
    autoLoadedRef.done = true;
    loadProject(user.uid)
      .then((data) => {
        if (!data) return;
        setPartStates((prev) => ({ ...prev, ...data.canvasState.partStates }));
        if (data.canvasState.typeId) setTypeId(data.canvasState.typeId as GarmentTypeId);
        toast.success("Cloud project restored");
      })
      .catch(() => {
        /* ignore */
      });
  }, [user, autoLoadedRef]);

  useEffect(() => {
    if (view !== "preview" || !user) return;
    void recordRender3d(user.uid, { typeId, scene: sceneId });
  }, [view, typeId, user]);

  useEffect(() => {
    const st = partStates[activePart];
    if (!st) return;
    const gap = Math.max(0, Math.min(50, st.tileGap ?? 0));
    if (!st.textureDataUrl || gap === 0) {
      if (st.texturePaddedDataUrl) {
        setPartStates((prev) => ({
          ...prev,
          [activePart]: { ...prev[activePart], texturePaddedDataUrl: null },
        }));
      }
      return;
    }
    // tileGap only affects the base fabric map — never touch layerCompositeDataUrl
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const img = await loadImg(st.textureDataUrl!);
        const padPct = gap / 100;
        const W = 512;
        const inner = Math.round(W * (1 - padPct));
        const off = Math.round((W - inner) / 2);
        const c = document.createElement("canvas");
        c.width = W;
        c.height = W;
        const cx = c.getContext("2d")!;
        cx.fillStyle = "#ffffff";
        cx.fillRect(0, 0, W, W);
        cx.imageSmoothingEnabled = true;
        cx.imageSmoothingQuality = "high";
        cx.drawImage(img, off, off, inner, inner);
        const url = c.toDataURL("image/png");
        if (cancelled) return;
        setPartStates((prev) => ({
          ...prev,
          [activePart]: { ...prev[activePart], texturePaddedDataUrl: url },
        }));
      } catch {
        /* ignore */
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [activePart, partStates[activePart]?.textureDataUrl, partStates[activePart]?.tileGap]);

  const composeSelectionFillLayer = async (): Promise<string | null> => {
    const state = partStates[activePart];
    if (!state?.selectionMaskDataUrl) return null;
    const W = 1024,
      H = 1024;
    const fill = document.createElement("canvas");
    fill.width = W;
    fill.height = H;
    const fctx = fill.getContext("2d")!;
    if (regionFillKind === "color") {
      fctx.fillStyle = regionColor;
      fctx.fillRect(0, 0, W, H);
    } else if (regionFillKind === "gradient") {
      const g = GRADIENT_PRESETS.find((x) => x.id === regionGradientId) ?? GRADIENT_PRESETS[0];
      const lg = fctx.createLinearGradient(0, 0, W, H);
      g.stops.forEach((s) => lg.addColorStop(s.offset, s.color));
      fctx.fillStyle = lg;
      fctx.fillRect(0, 0, W, H);
    } else {
      const preset = PATTERN_PRESETS.find((p) => p.id === regionPatternId) ?? PATTERN_PRESETS[0];
      const url = patternToDataUrl(preset, regionColor, "#ffffff");
      const pImg = await loadImg(url);
      const pat = fctx.createPattern(pImg, "repeat");
      if (pat) {
        fctx.fillStyle = pat;
        fctx.fillRect(0, 0, W, H);
      }
    }
    const mask = await loadImg(state.selectionMaskDataUrl);
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const octx = out.getContext("2d")!;
    octx.drawImage(fill, 0, 0, W, H);
    octx.globalCompositeOperation = "destination-in";
    octx.drawImage(maskImageToAlphaCanvas(mask, W, H), 0, 0);
    return out.toDataURL("image/png");
  };

  const composeSelectionFillPreview = async (): Promise<string | null> => {
    const state = partStates[activePart];
    if (!state?.selectionMaskDataUrl) return null;
    const layerContent = await composeSelectionFillLayer();
    if (!layerContent) return null;
    const W = 1024,
      H = 1024;
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const octx = out.getContext("2d")!;
    if (state.textureDataUrl) {
      const base = await loadImg(state.textureDataUrl);
      octx.drawImage(base, 0, 0, W, H);
    } else {
      octx.fillStyle = state.color || "#ffffff";
      octx.fillRect(0, 0, W, H);
    }
    const layerImg = await loadImg(layerContent);
    octx.drawImage(layerImg, 0, 0);
    return out.toDataURL("image/png");
  };

  const applyToSelection = async () => {
    const state = partStates[activePart];
    if (!state?.selectionMaskDataUrl) {
      toast.error("Lasso a region on the 3D model first");
      return;
    }
    await runGated("MASKED_APPLY", async () => {
      const layerContent = await composeSelectionFillLayer();
      if (!layerContent) return;
      const nextLayers = [...(state.layers || [])];
      const id =
        activeLayerId && nextLayers.find((l) => l.id === activeLayerId && !l.locked)
          ? activeLayerId
          : newLayerId();
      const idx = nextLayers.findIndex((l) => l.id === id);
      const layerPatch: DesignLayer = {
        id,
        name: idx >= 0 ? nextLayers[idx].name : `Selection ${nextLayers.length + 1}`,
        maskUrl: state.selectionMaskDataUrl!,
        contentDataUrl: layerContent,
        visible: true,
        opacity: 1,
        locked: idx >= 0 ? nextLayers[idx].locked : false,
        linkedGroupId: idx >= 0 ? nextLayers[idx].linkedGroupId : null,
      };
      if (idx >= 0) nextLayers[idx] = { ...nextLayers[idx], ...layerPatch };
      else nextLayers.push(layerPatch);
      await applyLayersToPart(activePart, nextLayers, { selectionMaskDataUrl: null });
      setActiveLayerId(null);
      toast.success(`Applied fill to selected layer on ${activeLabel}`);
    });
  };

  useEffect(() => {
    let cancelled = false;
    const state = partStates[activePart];
    if (!state?.selectionMaskDataUrl) {
      setRegionPreviewUrl(null);
      return;
    }
    const t = setTimeout(() => {
      composeSelectionFillPreview()
        .then((url) => {
          if (!cancelled) setRegionPreviewUrl(url);
        })
        .catch(() => {});
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    activePart,
    regionFillKind,
    regionColor,
    regionPatternId,
    regionGradientId,
    partStates[activePart]?.selectionMaskDataUrl,
    partStates[activePart]?.textureDataUrl,
    partStates[activePart]?.color,
  ]);

  const activeState = partStates[activePart] ?? defaultPartState("#ffffff");
  const scene = SCENE_PRESETS.find((s) => s.id === sceneId)!;

  if (!canAccessWorkspace) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <>
        <div className="flex h-screen flex-col bg-background text-foreground">
          {/* PREMIUM GLASSMORPHIC TOP BAR */}
          <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-white/10 bg-background/60 px-2 backdrop-blur-2xl shadow-sm sm:gap-2 sm:px-4 z-50">
            <div className="flex items-center gap-2">
              <div className="hidden h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md sm:flex">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold tracking-tight">Fabrixa</div>
                <div className="text-[10px] text-muted-foreground">Studio</div>
              </div>
            </div>

            <Tabs
              value={view}
              onValueChange={(v) => void changeView(v as "design" | "preview" | "ai")}
              className="sm:ml-4"
            >
              <TabsList className="h-9 bg-panel/50 backdrop-blur-md border border-white/5">
                <TabsTrigger value="design" className="gap-1.5 text-xs">
                  <Wand2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Design</span>
                  <span className="sm:hidden">2D</span>
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1.5 text-xs">
                  <Shirt className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">3D Preview</span>
                  <span className="sm:hidden">3D</span>
                </TabsTrigger>
                <TabsTrigger value="ai" className="gap-1.5 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">AI Studio</span>
                  <span className="sm:hidden">AI</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <GarmentMenu
              value={typeId}
              onChange={(v) => setTypeId(v)}
              className="ml-1 hidden sm:flex w-44"
            />

            <div className="ml-auto flex min-w-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="hidden items-center gap-1 rounded-full border border-white/10 bg-panel/40 px-2.5 py-1 text-xs tabular-nums hover:bg-muted/50 sm:inline-flex backdrop-blur-md"
                    onClick={() => void changeView("ai")}
                  >
                    <Coins className="h-3.5 w-3.5 text-primary" />
                    <span>{coinBalance}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Coins · AI left today: {entData?.dailyAiRequestsRemaining ?? "—"}
                  {subTier ? ` · Tier: ${subTier}` : ""}
                  {adminMode ? " · ADMIN BYPASS" : ""}
                </TooltipContent>
              </Tooltip>
              <Button
                size="sm"
                variant="outline"
                className="hidden h-7 px-2 text-xs sm:inline-flex bg-panel/40 backdrop-blur-md border-white/10"
                onClick={() => setPricingOpen(true)}
              >
                {subTier ? "Manage plan" : "Upgrade"}
              </Button>

              {view === "design" &&
                (() => {
                  const hasMask = !!partStates[activePart]?.selectionMaskDataUrl;
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          onClick={() => applyToModel(true)}
                          disabled={!designUrl}
                          className="h-9 w-9 bg-gradient-to-r from-primary to-accent p-0 text-primary-foreground shadow hover:opacity-90 sm:h-9 sm:w-auto sm:px-3"
                        >
                          <CheckCircle2 className="h-4 w-4 sm:mr-1.5" />
                          <span className="hidden sm:inline">Apply to {activeLabel}</span>
                          <CoinCostBadge
                            feature={hasMask ? "MASKED_APPLY" : "APPLY_TO_MODEL"}
                            className="hidden sm:inline-flex"
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {hasMask
                          ? `Apply design only inside your selection on ${activeLabel} (half-price)`
                          : `Apply your 2D design to ${activeLabel}`}
                      </TooltipContent>
                    </Tooltip>
                  );
                })()}

              <div className="hidden items-center gap-1 sm:flex">
                <IconBtn label="Neck Designer" onClick={() => setNeckOpen(true)}>
                  <Scissors className="h-4 w-4" />
                </IconBtn>
                <IconBtn label={user ? "Save to cloud" : "Save (local)"} onClick={handleSave}>
                  {user ? <Cloud className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                </IconBtn>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" title="Export" className="hover:bg-white/5">
                      <Download className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 bg-background/80 backdrop-blur-2xl border-white/10"
                  >
                    <DropdownMenuLabel>Export design</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => {
                        setExportFormat("png");
                        setExportOpen(true);
                      }}
                    >
                      <FileImage className="mr-2 h-4 w-4" />
                      PNG…
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setExportFormat("jpg");
                        setExportOpen(true);
                      }}
                    >
                      <ImageDown className="mr-2 h-4 w-4" />
                      JPG…
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setExportFormat("webp");
                        setExportOpen(true);
                      }}
                    >
                      <Globe2 className="mr-2 h-4 w-4" />
                      WebP…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Realistic Renders (3D)</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleRealisticExport("front")}>
                      <Shirt className="mr-2 h-4 w-4" /> Export Front View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRealisticExport("back")}>
                      <Shirt className="mr-2 h-4 w-4" /> Export Back View
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => quickExport("transparent")}>
                      <ImageOff className="mr-2 h-4 w-4" />
                      Transparent PNG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => quickExport("tiled")}>
                      <Grid3x3 className="mr-2 h-4 w-4" />
                      Tiled Repeat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <IconBtn label="Help / tour" onClick={() => setShowOnboarding(true)}>
                  <HelpCircle className="h-4 w-4" />
                </IconBtn>
                <ThemeToggle />
                <IconBtn label="Settings" onClick={() => setSettingsOpen(true)}>
                  <Settings className="h-4 w-4" />
                </IconBtn>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="sm:hidden" title="More">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-background/80 backdrop-blur-2xl border-white/10"
                >
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Actions</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
                      <Coins className="h-3 w-3 text-primary" />
                      {coinBalance}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setNeckOpen(true)}>
                    <Scissors className="mr-2 h-4 w-4" />
                    Neck Designer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSave}>
                    {user ? <Cloud className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                    {user ? "Save to cloud" : "Save (local)"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Export
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => {
                      setExportFormat("png");
                      setExportOpen(true);
                    }}
                  >
                    <FileImage className="mr-2 h-4 w-4" />
                    PNG…
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setExportFormat("jpg");
                      setExportOpen(true);
                    }}
                  >
                    <ImageDown className="mr-2 h-4 w-4" />
                    JPG…
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setExportFormat("webp");
                      setExportOpen(true);
                    }}
                  >
                    <Globe2 className="mr-2 h-4 w-4" />
                    WebP…
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => quickExport("tiled")}>
                    <Grid3x3 className="mr-2 h-4 w-4" />
                    Tiled Repeat
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Realistic Renders (3D)
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleRealisticExport("front")}>
                    <Shirt className="mr-2 h-4 w-4" /> Export Front View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleRealisticExport("back")}>
                    <Shirt className="mr-2 h-4 w-4" /> Export Back View
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => quickExport("transparent")}>
                    <ImageOff className="mr-2 h-4 w-4" />
                    Transparent PNG
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowOnboarding(true)}>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Help / tour
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="hidden sm:inline-flex border-white/10 bg-panel/40 backdrop-blur-md"
                      title={user.email ?? "Account"}
                    >
                      <Avatar className="h-6 w-6">
                        {user.photoURL ? <AvatarImage src={user.photoURL} /> : null}
                        <AvatarFallback className="text-[10px]">
                          {(user.email ?? "U")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 bg-background/80 backdrop-blur-2xl border-white/10"
                  >
                    <DropdownMenuLabel className="truncate">
                      {user.displayName ?? user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSave}>
                      <Cloud className="mr-2 h-4 w-4" />
                      Save to cloud
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLoadCloud}>
                      <CloudDownload className="mr-2 h-4 w-4" />
                      Load from cloud
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={async () => {
                        useSubscriptionStore.getState().resetAll();
                        await signOut();
                        toast.success("Signed out");
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>

          <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-background/40 px-3 py-1.5 sm:hidden backdrop-blur-xl">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Garment
            </span>
            <GarmentMenu
              value={typeId}
              onChange={(v) => setTypeId(v)}
              className="min-w-0 flex-1"
              mobile
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-background/40 px-3 py-2 backdrop-blur-xl sm:flex-nowrap sm:overflow-x-auto">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Editing
            </span>
            {garment.parts.map((p) => {
              const k = partKey(garment.id, p.id);
              return (
                <button
                  key={k}
                  onClick={() => setActivePart(k)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                    activePart === k
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background/50 hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
            <span className="ml-auto hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
              Tip: in 3D, click a part to select it
            </span>
          </div>

          {/* MAIN */}
          <div className="flex-1 overflow-hidden relative">
            {/* Keep editor mounted so export API works from any view */}
            <div
              className={
                view === "design"
                  ? "h-full min-h-0 p-3"
                  : "pointer-events-none fixed -left-[10000px] top-0 h-[600px] w-[600px] opacity-0"
              }
              aria-hidden={view !== "design"}
            >
              <FabricEditor
                key={`${activePart}-${activeLayerId ?? "base"}`}
                autosaveKey={`${activePart}-${activeLayerId ?? "base"}`}
                onChange={(url, json) => {
                  setDesignUrl(url);
                  setDesignJson(json);
                }}
                initialMaskUrl={
                  activeLayerId
                    ? partStates[activePart]?.layers?.find((l) => l.id === activeLayerId)?.maskUrl
                    : null
                }
                initialJson={
                  activeLayerId
                    ? partStates[activePart]?.layers?.find((l) => l.id === activeLayerId)
                        ?.contentJson
                    : null
                }
                initialContentUrl={
                  activeLayerId
                    ? partStates[activePart]?.layers?.find((l) => l.id === activeLayerId)
                        ?.contentDataUrl
                    : null
                }
                uvWireframeUrl={uvWireframes[activePart]}
              />
            </div>
            {view === "ai" ? (
              <div className="h-full overflow-auto bg-background/40 backdrop-blur-xl">
                <AIStudioPanel
                  balance={coinBalance}
                  onSaveColorway={(palette) => {
                    const cw = createColorwayFromPalette("AI Palette", partStates, palette);
                    setColorwayState((prev) => ({
                      ...prev,
                      activeColorwayId: cw.id,
                      colorways: [cw, ...prev.colorways],
                    }));
                    toast.success("Created colorway from AI palette");
                  }}
                  onResult={async (url, meta, action) => {
                    if (meta.model !== "upload" && user) {
                      void recordAiDesign(user.uid, {
                        task: meta.task,
                        prompt: meta.prompt,
                        model: meta.model,
                      });
                    }

                    if (action === "apply_3d") {
                      setPartStates((prev) => ({
                        ...prev,
                        [activePart]: {
                          ...prev[activePart],
                          textureDataUrl: url,
                          tilingMode: "world",
                          layerCompositeDataUrl: null,
                          layers: [],
                        },
                      }));
                      setActiveLayerId(null);
                      await changeView("preview");
                      toast.success(`Applied AI design to ${activeLabel} base fabric`);
                    } else if (action === "edit_2d") {
                      setDesignUrl(url);
                      await changeView("design");
                      requestAnimationFrame(() => {
                        void api()?.loadImage(url, { replaceCanvas: true });
                      });
                      toast.success("Loaded into 2D editor");
                    }
                  }}
                />
              </div>
            ) : view === "preview" ? (
              <div className="grid h-full grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-[1fr_320px]">
                <div className="flex h-[70vh] min-h-[420px] flex-col gap-2 overflow-hidden lg:h-auto lg:min-h-[50vh]">
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-background/40 p-2 backdrop-blur-xl shadow-lg">
                    <div className="flex items-center gap-1">
                      {SCENE_PRESETS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSceneId(s.id)}
                          className={`rounded-md border px-2.5 py-1 text-xs transition ${
                            sceneId === s.id
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-3">
                      <Button
                        size="sm"
                        variant={lassoActive && lassoMode === "brush" ? "default" : "outline"}
                        onClick={() => {
                          setLassoMode("brush");
                          setLassoActive((v) => (lassoMode === "brush" ? !v : true));
                        }}
                        className="h-7 gap-1 text-xs bg-background/50 border-white/10"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        {lassoActive && lassoMode === "brush" ? "Brush…" : "3D Brush"}
                      </Button>
                      {lassoActive && lassoMode === "brush" && (
                        <div className="flex items-center gap-1.5 w-28">
                          <Slider
                            value={[lassoBrushSize]}
                            min={8}
                            max={64}
                            step={2}
                            onValueChange={([v]) => setLassoBrushSize(v)}
                          />
                          <span className="text-[9px] tabular-nums text-muted-foreground">
                            {lassoBrushSize}
                          </span>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant={lassoActive && lassoMode === "freehand" ? "default" : "outline"}
                        onClick={() => {
                          setLassoMode("freehand");
                          setLassoActive((v) => (lassoMode === "freehand" ? !v : true));
                        }}
                        className="h-7 gap-1 text-xs bg-background/50 border-white/10"
                      >
                        <Scissors className="h-3.5 w-3.5" />
                        {lassoActive && lassoMode === "freehand" ? "Freehand…" : "Freehand"}
                      </Button>
                      <Button
                        size="sm"
                        variant={lassoActive && lassoMode === "polygon" ? "default" : "outline"}
                        onClick={() => {
                          setLassoMode("polygon");
                          setLassoActive((v) => (lassoMode === "polygon" ? !v : true));
                        }}
                        className="h-7 gap-1 text-xs bg-background/50 border-white/10"
                      >
                        <Scissors className="h-3.5 w-3.5" />
                        {lassoActive && lassoMode === "polygon" ? "Polygon…" : "Polygon"}
                      </Button>

                      {activeState.selectionMaskDataUrl && (
                        <div className="flex items-center gap-1 animate-in fade-in zoom-in ml-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={handleEditSelection}
                            className="h-7 text-xs bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          >
                            <Palette className="h-3.5 w-3.5 mr-1" />
                            Edit in 2D
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={clearLassoMask}
                            className="h-7 text-xs text-destructive"
                          >
                            Clear
                          </Button>
                        </div>
                      )}
                      <Sep />
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRealisticExport("front")}
                          className="h-7 px-2 text-[10px] bg-background/50 border-white/10"
                        >
                          Front Render
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRealisticExport("back")}
                          className="h-7 px-2 text-[10px] bg-background/50 border-white/10"
                        >
                          Back Render
                        </Button>
                      </div>
                      <Sep />
                      <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch checked={autoRotate} onCheckedChange={setAutoRotate} />
                        <RotateCw className="h-3 w-3" />
                        Spin
                      </Label>
                    </div>
                  </div>
                  <div
                    className="relative flex-1 min-h-[min(70vh,720px)] overflow-hidden rounded-2xl border border-white/10 bg-panel shadow-inner"
                    style={
                      sceneId === "transparent"
                        ? {
                            backgroundImage:
                              "conic-gradient(at 50% 50%, #e9e9ef 25%, #fafafa 0 50%, #e9e9ef 0 75%, #fafafa 0)",
                            backgroundSize: "24px 24px",
                          }
                        : undefined
                    }
                  >
                    <GarmentPreview
                      typeId={typeId}
                      partStates={partStates}
                      activePart={activePart}
                      scene={SCENE_PRESETS.find((s) => s.id === sceneId)!}
                      autoRotate={autoRotate}
                      showMannequin={showMannequin}
                      onSelectPart={setActivePart}
                      lassoActive={lassoActive}
                      lassoMode={lassoMode}
                      onLassoMask={handleLassoMask}
                      onUvWireframeGenerated={handleUvWireframeGenerated}
                    />
                    <LassoOverlay
                      enabled={lassoActive}
                      mode={lassoMode}
                      brushSize={lassoBrushSize}
                      onCancel={() => setLassoActive(false)}
                    />
                    <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-background/70 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
                      {lassoActive
                        ? "Drag to lasso a region · OrbitControls paused"
                        : "Click a part to edit · Drag · Scroll · Right-drag pans"}
                    </div>
                    {activeState.selectionMaskDataUrl && !lassoActive && (
                      <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-primary/90 px-2 py-1 text-[10px] font-medium text-primary-foreground backdrop-blur">
                        Selection active on {activeLabel} — Apply restricts to this region
                      </div>
                    )}
                    {showTilingOverlay && (
                      <div className="pointer-events-none absolute right-2 top-2 max-w-[220px] rounded-md border bg-background/85 px-2.5 py-2 text-[10px] leading-relaxed text-foreground shadow backdrop-blur">
                        <div className="mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-primary">
                          <Grid3x3 className="h-3 w-3" />
                          Tiling debug
                        </div>
                        <div className="space-y-0.5 tabular-nums">
                          <div>
                            <span className="text-muted-foreground">Part:</span> {activeLabel}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Fabric:</span>{" "}
                            <span className="capitalize">
                              {activeState.fabricPreset ?? "cotton"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Mode:</span>{" "}
                            {activeState.tilingMode ?? APP_DATA_0.tiling.defaultMode}
                          </div>
                          {(activeState.tilingMode ?? APP_DATA_0.tiling.defaultMode) === "world" ? (
                            <div>
                              <span className="text-muted-foreground">World scale:</span>{" "}
                              {(
                                activeState.worldTilingScale ?? APP_DATA_0.tiling.defaultWorldScale
                              ).toFixed(2)}
                              m
                            </div>
                          ) : (
                            <div>
                              <span className="text-muted-foreground">UV repeat:</span>{" "}
                              {activeState.textureScale.toFixed(1)}×
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Rotation:</span>{" "}
                            {activeState.textureRotation.toFixed(0)}°
                          </div>
                          <div>
                            <span className="text-muted-foreground">Texture:</span>{" "}
                            {activeState.textureDataUrl ? "yes" : "—"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sidebar */}
                <div className="flex flex-col gap-3 overflow-y-auto">
                  <ColorwayManagerPanel
                    state={colorwayState}
                    onCreate={onCreateColorway}
                    onApply={onApplyColorway}
                    onDuplicate={onDuplicateColorway}
                    onDelete={onDeleteColorway}
                    onRename={onRenameColorway}
                  />

                  {/* Per-part controls */}
                  <div className="rounded-2xl border border-white/10 bg-background/50 p-4 backdrop-blur-2xl shadow-2xl">
                    <div className="mb-3 flex items-center justify-between">
                      <Label className="text-xs uppercase text-muted-foreground">
                        {activeLabel}
                      </Label>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-background/40 border-white/10"
                        onClick={() => void changeView("design")}
                      >
                        <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                        Edit design
                      </Button>
                    </div>

                    <div className="mb-3 aspect-square w-full overflow-hidden rounded-md border border-white/10 bg-[conic-gradient(at_50%_50%,#e9e9ef_25%,#fafafa_0_50%,#e9e9ef_0_75%,#fafafa_0)] bg-[length:16px_16px]">
                      {activeState.layerCompositeDataUrl || activeState.textureDataUrl ? (
                        <img
                          src={
                            activeState.layerCompositeDataUrl || activeState.textureDataUrl || ""
                          }
                          alt="texture"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground bg-panel/30">
                          No texture yet
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <LayersPanel3D
                        layers={activeState.layers ?? []}
                        activeLayerId={activeLayerId}
                        activePartKey={activePart}
                        selectionMaskDataUrl={activeState.selectionMaskDataUrl ?? null}
                        partLabel={activeLabel}
                        allParts={garment.parts.map((p) => {
                          const k = partKey(garment.id, p.id);
                          return { key: k, label: p.label, layers: partStates[k]?.layers ?? [] };
                        })}
                        onSelectLayer={setActiveLayerId}
                        onEditLayer={handleEditLayer}
                        onLayersChange={(layers) => void handleLayersChange(layers)}
                        onCreateFromSelection={() => createLayerFromSelection(true)}
                        onClearSelection={clearLassoMask}
                      />

                      <div>
                        <Label className="mb-2 block text-xs uppercase text-muted-foreground">
                          Color
                        </Label>
                        <ColorPanel
                          color={activeState.color}
                          onColorChange={(hex) => updateActivePart({ color: hex })}
                          onApplyGradientTexture={(url) => {
                            updateActivePart({ textureDataUrl: url });
                            toast.success(`Gradient applied to ${activeLabel}`);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                          Fabric
                        </Label>
                        <Select
                          value={activeState.fabricPreset ?? "cotton"}
                          onValueChange={(v) =>
                            updateActivePart({ fabricPreset: v as FabricPresetId })
                          }
                        >
                          <SelectTrigger className="h-9 bg-background/40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FABRIC_PRESET_IDS.map((id) => (
                              <SelectItem key={id} value={id} className="capitalize">
                                {id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">
                          Tiling mode
                        </Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(["world", "uv"] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => updateActivePart({ tilingMode: m })}
                              className={`rounded-md border px-2 py-1.5 text-xs transition ${
                                (activeState.tilingMode ?? APP_DATA_0.tiling.defaultMode) === m
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border hover:bg-muted/50 bg-background/30"
                              }`}
                            >
                              {m === "world" ? "World (seamless)" : "UV (continuous)"}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(activeState.tilingMode ?? APP_DATA_0.tiling.defaultMode) === "world" ? (
                        <SliderRow
                          label="World tile scale (smaller = denser)"
                          value={
                            activeState.worldTilingScale ?? APP_DATA_0.tiling.defaultWorldScale
                          }
                          min={0.05}
                          max={2}
                          step={0.05}
                          onChange={(v) => updateActivePart({ worldTilingScale: v })}
                        />
                      ) : (
                        <SliderRow
                          label="Pattern repeat (tile count)"
                          value={activeState.textureScale}
                          min={0.5}
                          max={12}
                          step={0.5}
                          onChange={(v) => updateActivePart({ textureScale: v })}
                        />
                      )}
                      <SliderRow
                        label="Pattern rotation"
                        value={activeState.textureRotation}
                        min={0}
                        max={360}
                        step={1}
                        onChange={(v) => updateActivePart({ textureRotation: v })}
                      />
                      <SliderRow
                        label="Pattern X offset"
                        value={activeState.textureOffsetX ?? 0}
                        min={-1}
                        max={1}
                        step={0.01}
                        onChange={(v) => updateActivePart({ textureOffsetX: v })}
                      />
                      <SliderRow
                        label="Pattern Y offset"
                        value={activeState.textureOffsetY ?? 0}
                        min={-1}
                        max={1}
                        step={0.01}
                        onChange={(v) => updateActivePart({ textureOffsetY: v })}
                      />
                      <SliderRow
                        label="Reflection intensity"
                        value={activeState.reflectionIntensity ?? 0.5}
                        min={0}
                        max={2}
                        step={0.05}
                        onChange={(v) => updateActivePart({ reflectionIntensity: v })}
                      />
                      <SliderRow
                        label="Tile spacing (white gap between tiles)"
                        value={activeState.tileGap ?? 0}
                        min={0}
                        max={50}
                        step={1}
                        onChange={(v) => updateActivePart({ tileGap: v })}
                      />
                      <div className="flex items-center justify-between rounded-md border border-white/5 bg-background/30 px-2 py-1.5 backdrop-blur-sm">
                        <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Grid3x3 className="h-3.5 w-3.5" />
                          Tiling overlay
                        </Label>
                        <Switch
                          checked={showTilingOverlay}
                          onCheckedChange={setShowTilingOverlay}
                        />
                      </div>
                      <Button
                        size="sm"
                        className="w-full shadow-md"
                        onClick={() => applyToModel(false)}
                        disabled={!designUrl}
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        Apply current design here
                        <CoinCostBadge
                          feature={
                            activeState.selectionMaskDataUrl ? "MASKED_APPLY" : "APPLY_TO_MODEL"
                          }
                        />
                      </Button>
                      {activeState.textureDataUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full text-xs text-muted-foreground hover:bg-white/5"
                          onClick={() => updateActivePart({ textureDataUrl: null })}
                        >
                          Remove texture
                        </Button>
                      )}

                      <div className="mt-2 space-y-2 rounded-xl border border-white/5 bg-panel/30 p-3 backdrop-blur-md shadow-inner">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs uppercase text-muted-foreground">
                            Selected region
                          </Label>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] ${activeState.selectionMaskDataUrl ? "bg-primary text-primary-foreground shadow" : "bg-muted/50 text-muted-foreground"}`}
                          >
                            {activeState.selectionMaskDataUrl ? "Active" : "None"}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Use Freehand or Polygon above to lasso a region on the model, then edit
                          and apply below — it bakes into the texture instantly.
                        </p>
                        <div className="grid grid-cols-3 gap-1">
                          {(["color", "pattern", "gradient"] as const).map((k) => (
                            <button
                              key={k}
                              onClick={() => setRegionFillKind(k)}
                              className={`rounded-md border px-2 py-1 text-[11px] capitalize transition ${regionFillKind === k ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50 bg-background/40"}`}
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                        {regionFillKind === "color" && (
                          <ColorPickerBlock
                            color={regionColor}
                            onColorChange={setRegionColor}
                            compact
                          />
                        )}
                        {regionFillKind === "pattern" && (
                          <>
                            <div className="grid grid-cols-4 gap-1.5">
                              {PATTERN_PRESETS.slice(0, 8).map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => setRegionPatternId(p.id)}
                                  className={`aspect-square overflow-hidden rounded-md border border-white/20 bg-white transition hover:ring-2 hover:ring-primary shadow-sm ${regionPatternId === p.id ? "ring-2 ring-primary" : ""}`}
                                  title={p.label}
                                >
                                  <img
                                    src={patternToDataUrl(p, regionColor, "#ffffff")}
                                    alt={p.label}
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 bg-background/30 p-2 rounded-md border border-white/5">
                              <Label className="text-xs text-muted-foreground">Ink</Label>
                              <input
                                type="color"
                                value={regionColor}
                                onChange={(e) => setRegionColor(e.target.value)}
                                className="h-8 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
                              />
                            </div>
                          </>
                        )}
                        {regionFillKind === "gradient" && (
                          <div className="grid grid-cols-3 gap-1.5">
                            {GRADIENT_PRESETS.map((g) => (
                              <button
                                key={g.id}
                                onClick={() => setRegionGradientId(g.id)}
                                className={`h-10 rounded-md border border-white/20 transition hover:ring-2 hover:ring-primary shadow-sm ${regionGradientId === g.id ? "ring-2 ring-primary" : ""}`}
                                style={{
                                  background: `linear-gradient(135deg, ${g.stops[0].color}, ${g.stops[1].color})`,
                                }}
                                aria-label={g.label}
                              />
                            ))}
                          </div>
                        )}
                        <Button
                          size="sm"
                          className="w-full shadow-md"
                          disabled={!activeState.selectionMaskDataUrl}
                          onClick={() => void applyToSelection()}
                        >
                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                          Apply to selection
                          <CoinCostBadge feature="MASKED_APPLY" />
                        </Button>
                        {activeState.selectionMaskDataUrl && (
                          <div className="mt-2">
                            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                              Preview
                            </div>
                            <div className="aspect-square w-full overflow-hidden rounded-md border border-white/10 bg-[conic-gradient(at_50%_50%,#e9e9ef_25%,#fafafa_0_50%,#e9e9ef_0_75%,#fafafa_0)] bg-[length:16px_16px]">
                              {regionPreviewUrl ? (
                                <img
                                  src={regionPreviewUrl}
                                  alt="region preview"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground bg-panel/30">
                                  Generating…
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <Dialog open={exportOpen} onOpenChange={setExportOpen}>
            <DialogContent className="sm:max-w-md bg-background/80 backdrop-blur-2xl border-white/10 shadow-2xl">
              <DialogHeader>
                <DialogTitle>Export as {exportFormat.toUpperCase()}</DialogTitle>
                <DialogDescription>Choose a quality preset.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-2 py-2">
                {(
                  [
                    { id: "web", label: "Web", desc: "1× · small file" },
                    { id: "print", label: "Print", desc: "2× · sharp" },
                    { id: "hd", label: "HD", desc: "3× · max" },
                  ] as const
                ).map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setExportQuality(q.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      exportQuality === q.id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-white/10 hover:bg-muted/50 bg-background/40"
                    }`}
                  >
                    <div className="text-sm font-medium">{q.label}</div>
                    <div className="text-[10px] text-muted-foreground">{q.desc}</div>
                  </button>
                ))}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setExportOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={runExport} className="shadow-md">
                  <Download className="mr-1.5 h-4 w-4" />
                  Export
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <SettingsPanel
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            user={user}
            onSignOut={async () => {
              useSubscriptionStore.getState().resetAll();
              await signOut();
              toast.success("Signed out");
            }}
            onOpenPricing={() => {
              setSettingsOpen(false);
              setPricingOpen(true);
            }}
            onReplayTour={() => setShowOnboarding(true)}
            themeId={themeId}
            onThemeId={setThemeId}
            sceneId={sceneId}
            onSceneId={setSceneId}
            autoRotate={autoRotate}
            onAutoRotate={setAutoRotate}
            showMannequin={showMannequin}
            onShowMannequin={setShowMannequin}
            showTilingOverlay={showTilingOverlay}
            onShowTilingOverlay={setShowTilingOverlay}
            defaultGarmentId={defaultGarmentId}
            onDefaultGarmentId={(id) => {
              setDefaultGarmentId(id);
              setTypeId(id);
            }}
            coinBalance={coinBalance}
          />

          <Dialog
            open={showOnboarding}
            onOpenChange={(o) => {
              if (!o) finishOnboarding();
              else setShowOnboarding(true);
            }}
          >
            <DialogContent className="sm:max-w-lg bg-background/80 backdrop-blur-2xl border-white/10 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Welcome to Fabrixa
                </DialogTitle>
                <DialogDescription>
                  Design beautiful textiles & garments in a few clicks.
                </DialogDescription>
              </DialogHeader>
              <ol className="space-y-3 py-2 text-sm">
                <Step n={1} title="Pick a garment">
                  Top bar → choose Kurti, Saree, Shirt, Hoodie, Dress, Pants, etc.
                </Step>
                <Step n={2} title="Design in 2D">
                  Use presets, the <strong>Pattern Brush</strong>, gradients, or upload an image.
                  Try <strong>Color Replace</strong> to swap colors in any uploaded design.
                </Step>
                <Step n={3} title="Apply to a part">
                  Pick a part chip (Body, Sleeves, Collar…) and hit <strong>Apply</strong>. In 3D,
                  just <strong>click a part</strong> to select it.
                </Step>
                <Step n={4} title="Style the look">
                  Toggle the mannequin, change scene (Studio / Runway), and pick a theme in
                  Settings.
                </Step>
              </ol>
              <DialogFooter>
                <Button onClick={finishOnboarding} className="shadow-md">
                  Got it — let's design
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={neckOpen} onOpenChange={setNeckOpen}>
            <DialogContent className="sm:max-w-xl bg-background/80 backdrop-blur-2xl border-white/10 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Scissors className="h-4 w-4" />
                  Neck Designer
                </DialogTitle>
                <DialogDescription>
                  Generate or pick a neckline for {garment.label}.
                </DialogDescription>
              </DialogHeader>
              <NeckDesignerPanel
                garment={garment}
                balance={coinBalance}
                onApply={(url, partId, meta) => {
                  const key = partKey(garment.id, partId);
                  setPartStates((prev) => ({
                    ...prev,
                    [key]: {
                      ...prev[key],
                      textureDataUrl: url,
                      layers: [],
                      layerCompositeDataUrl: null,
                    },
                  }));
                  setActivePart(key);
                  if (user) {
                    void recordAiDesign(user.uid, {
                      task: "neckDesign",
                      prompt: meta.prompt,
                      model: meta.model,
                    });
                  }
                  setNeckOpen(false);
                  void changeView("preview");
                }}
              />
            </DialogContent>
          </Dialog>

          <PricingDialog open={pricingOpen} onOpenChange={setPricingOpen} />

          <footer className="shrink-0 border-t border-white/10 bg-background/60 py-1.5 text-center text-[10px] text-muted-foreground backdrop-blur-2xl">
            Fabrixa · Axiom Dynamics
          </footer>
        </div>
        <SubscriptionExpiredOverlay />
      </>
    </TooltipProvider>
  );
}

function IconBtn({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={onClick} className="hover:bg-white/5">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="bg-panel/80 backdrop-blur-md">{label}</TooltipContent>
    </Tooltip>
  );
}

function Sep() {
  return <div className="hidden sm:block mx-1 h-6 w-px shrink-0 bg-white/10" />;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm">
        {n}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{step < 1 ? value.toFixed(1) : value.toFixed(0)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="py-1"
      />
    </div>
  );
}
