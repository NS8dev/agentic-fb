import { useEffect, useRef, useState, useCallback } from "react";
import * as fabric from "fabric";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPanel } from "@/components/fabrixa/ColorPanel";
import { toast } from "sonner";
import {
  MousePointer2, Square, Circle as CircleIcon, Type, Image as ImageIcon,
  Brush, Eraser, Trash2, Undo2, Redo2, Copy, Sparkles, Stamp, Replace,
  Lasso, Pentagon, FlipHorizontal2, Wand2, Palette, ArrowUp, Crop,
  MoreHorizontal, Grid3x3, Box
} from "lucide-react";
import { PATTERN_PRESETS, GRADIENT_PRESETS, patternToDataUrl } from "@/lib/fabrixa/presets";
import {
  SelectionMask, type SelectionMode,
} from "@/lib/fabrixa/selectionMask";
import { APP_DATA_0 } from "@/lib/fabrixa/APP_DATA_0";
import { useRunGated } from "@/lib/fabrixa/runGated";
import { makeSeamlessTile } from "@/lib/fabrixa/imageProcessing/seamlessTile";
import { applyGeometricRepeat, type RepeatPreset } from "@/lib/fabrixa/imageProcessing/geometricRepeat";
import { separateColors, type SeparationPlate } from "@/lib/fabrixa/imageProcessing/colorSeparation";
import { cleanImageAlgorithm } from "@/lib/fabrixa/imageProcessing/imageClean";
import { vectorizePattern } from "@/lib/fabrixa/vectorize/tracePattern";
import { generateImage } from "@/lib/fabrixa/ai";
import { CoinCostBadge } from "@/components/fabrixa/CoinCostBadge";
import { getDbData, setDbData } from "@/lib/fabrixa/storage";

// --- NEW ISOLATED VECTOR PATTERNS (SAFE) ---
const EXTRA_PATTERNS = [
  { id: "ext_check", label: "Checkerboard", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><rect width="10" height="10" fill="{{color}}"/><rect x="10" y="10" width="10" height="10" fill="{{color}}"/></svg>` },
  { id: "ext_grid", label: "Clean Grid", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><path d="M 20 0 L 0 0 0 20" fill="none" stroke="{{color}}" stroke-width="1"/></svg>` },
  { id: "ext_dots", label: "Polka Dots", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><circle cx="5" cy="5" r="2.5" fill="{{color}}"/><circle cx="15" cy="15" r="2.5" fill="{{color}}"/></svg>` },
  { id: "ext_diag", label: "Diagonal Lines", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="{{bg}}"/><path d="M-1,1 l2,-2 M0,10 l10,-10 M9,11 l2,-2" stroke="{{color}}" stroke-width="1.5"/></svg>` },
  { id: "ext_tri", label: "Triangles", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><polygon points="10,0 20,20 0,20" fill="{{color}}"/></svg>` },
  { id: "ext_zig", label: "ZigZag", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><path d="M0,10 l5,-5 l10,10 l5,-5" fill="none" stroke="{{color}}" stroke-width="1.5"/></svg>` },
  { id: "ext_plus", label: "Plus Grid", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><path d="M10,0 v20 M0,10 h20" fill="none" stroke="{{color}}" stroke-width="1.5"/></svg>` },
  { id: "ext_waves", label: "Ocean Waves", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><path d="M0,10 Q5,0 10,10 T20,10" fill="none" stroke="{{color}}" stroke-width="1.5"/></svg>` },
  { id: "ext_cross", label: "Crosshatch", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><path d="M0,0 l20,20 M20,0 l-20,20" stroke="{{color}}" stroke-width="1"/></svg>` },
  { id: "ext_diamond", label: "Diamonds", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><polygon points="10,0 20,10 10,20 0,10" fill="{{color}}"/></svg>` },
  { id: "ext_hound", label: "Houndstooth", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><path d="M0,0 h10 v10 h-10 z M10,10 h10 v10 h-10 z M0,10 l5,-5 l5,5 z M10,20 l5,-5 l5,5 z" fill="{{color}}"/></svg>` },
  { id: "ext_half", label: "Half Circles", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><path d="M0,10 a10,10 0 0,0 20,0" fill="{{color}}"/></svg>` },
  { id: "ext_scales", label: "Scales", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><path d="M0,10 a10,10 0 0,0 20,0 M-10,20 a10,10 0 0,0 20,0 M10,20 a10,10 0 0,0 20,0" fill="none" stroke="{{color}}" stroke-width="1"/></svg>` },
  { id: "ext_brick", label: "Brick Wall", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="{{bg}}"/><path d="M0,10 h20 M10,0 v10 M0,10 v10 M20,10 v10" fill="none" stroke="{{color}}" stroke-width="1.5"/></svg>` },
  { id: "ext_hex", label: "Hexagons", svg: `<svg xmlns="http://www.w3.org/2000/svg" width="34.64" height="60"><rect width="34.64" height="60" fill="{{bg}}"/><path d="M17.32,0 L34.64,10 L34.64,30 L17.32,40 L0,30 L0,10 Z M17.32,60 L34.64,50 L34.64,30 M0,30 L0,50 L17.32,60" fill="none" stroke="{{color}}" stroke-width="2"/></svg>` }
];

const getExtraPatternUrl = (p: any, c: string, b: string) => {
  const raw = p.svg.replace(/\{\{color\}\}/g, c).replace(/\{\{bg\}\}/g, b);
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(raw);
};

interface Props {
  onChange: (dataUrl: string, json: string) => void;
  onNavigateAI?: () => void;
  initialMaskUrl?: string | null;
  initialJson?: string | null;
  /** Raster fallback when a layer has content but no saved Fabric JSON. */
  initialContentUrl?: string | null;
  /** Per-part/layer autosave namespace — prevents cross-part canvas bleed. */
  autosaveKey?: string;
  uvWireframeUrl?: string;
}

const SNAP_THRESHOLD = 6;

type Tool = "select" | "brush" | "eraser" | "pattern" | "lasso" | "polygon" | "maskBrush";

export function FabricEditor({ onChange, onNavigateAI, initialMaskUrl, initialJson, initialContentUrl, autosaveKey, uvWireframeUrl }: Props) {
  const runGated = useRunGated();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const historyRef = useRef<{ stack: string[]; index: number; lock: boolean }>({ stack: [], index: -1, lock: false });
  const abortRef = useRef<AbortController | null>(null);

  // Canvas Dimension State
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 600 });
  const sizeRef = useRef(canvasSize);
  useEffect(() => { sizeRef.current = canvasSize; }, [canvasSize]);

  const [bgColor, setBgColor] = useState("#ffffff");
  const [opacity, setOpacity] = useState(100);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [blur, setBlur] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const toolRef = useRef<Tool>(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  const [brushColor, setBrushColor] = useState("#7e3c8c");
  const [brushSize, setBrushSize] = useState(8);
  const [selected, setSelected] = useState<fabric.Object | null>(null);
  const [layers, setLayers] = useState<fabric.Object[]>([]);

  const refreshLayers = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    setLayers([...c.getObjects()].reverse());
  }, []);

  const toggleVisibility = (obj: fabric.Object) => {
    obj.set({ visible: !obj.visible });
    canvasRef.current?.requestRenderAll();
    refreshLayers();
    emit();
  };

  const toggleLock = (obj: fabric.Object) => {
    const locked = !obj.lockMovementX;
    obj.set({
      lockMovementX: locked, lockMovementY: locked,
      lockScalingX: locked, lockScalingY: locked,
      lockRotation: locked, hasControls: !locked,
    });
    canvasRef.current?.requestRenderAll();
    refreshLayers();
  };

  const moveLayer = (obj: fabric.Object, dir: "up" | "down") => {
    const c = canvasRef.current; if (!c) return;
    if (dir === "up") c.bringObjectForward(obj);
    else c.sendObjectBackwards(obj);
    refreshLayers();
    emit();
  };

  const flip = (dir: "h" | "v") => {
    const obj = canvasRef.current?.getActiveObject();
    if (!obj) return;
    if (dir === "h") obj.set({ flipX: !obj.flipX });
    else obj.set({ flipY: !obj.flipY });
    canvasRef.current?.requestRenderAll();
    emit();
  };

  const groupObjects = () => {
    const c = canvasRef.current; if (!c) return;
    const active = c.getActiveObject();
    if (!active || !(active instanceof fabric.ActiveSelection)) return;
    active.toGroup();
    c.requestRenderAll();
    refreshLayers();
    emit();
  };

  const ungroupObjects = () => {
    const c = canvasRef.current; if (!c) return;
    const active = c.getActiveObject();
    if (!active || !(active instanceof fabric.Group)) return;
    active.toActiveSelection();
    c.requestRenderAll();
    refreshLayers();
    emit();
  };

  const [patternColor, setPatternColor] = useState("#7e3c8c");
  const [patternBg, setPatternBg] = useState("#ffffff");
  const [patternBrushId, setPatternBrushId] = useState<string>(PATTERN_PRESETS[0].id);

  // Color replace
  const [replaceFrom, setReplaceFrom] = useState("#ffffff");
  const [replaceTo, setReplaceTo] = useState("#7e3c8c");
  const [replaceTol, setReplaceTol] = useState(40);

  // ----- Tiling Engine State -----
  const [tileRepeat, setTileRepeat] = useState(4);
  const [tileGapX, setTileGapX] = useState(0);
  const [tileGapY, setTileGapY] = useState(0);
  const [tileOffset, setTileOffset] = useState(0); // staggered brick offset (0..1)
  const [repeatPreset, setRepeatPreset] = useState<RepeatPreset>("grid");
  const [separationPlates, setSeparationPlates] = useState<SeparationPlate[]>([]);
  const [separationK, setSeparationK] = useState(4);
  const [cleanUseAi, setCleanUseAi] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const getSourceDataUrl = useCallback((): string | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const active = c.getActiveObject();
    if (active && (active as fabric.FabricImage).type === "image") {
      return (active as fabric.FabricImage).toDataURL({ format: "png", multiplier: 1 });
    }
    return c.toDataURL({ format: "png", multiplier: 1 });
  }, []);

  const replaceWithImage = useCallback(
    async (dataUrl: string, replaceActiveOnly = true) => {
      const c = canvasRef.current;
      if (!c) return;
      const active = c.getActiveObject();
      const img = await fabric.FabricImage.fromURL(dataUrl, { signal: abortRef.current?.signal });
      if (!canvasRef.current || canvasRef.current !== c) return;
      if (active && (active as fabric.FabricImage).type === "image" && replaceActiveOnly) {
        const scale = active.scaleX ?? 1;
        img.set({ left: active.left ?? 0, top: active.top ?? 0, scaleX: scale, scaleY: scale, selectable: true });
        c.remove(active);
      } else {
        const w = c.getWidth();
        const h = c.getHeight();
        const s = Math.min(w / (img.width ?? w), h / (img.height ?? h));
        img.set({ left: 0, top: 0, scaleX: s, scaleY: s, selectable: true });
      }
      c.add(img);
      c.setActiveObject(img);
      c.requestRenderAll();
      emit();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const applyAdvancedTiling = async () => {
    const c = canvasRef.current; if (!c) return;
    const active = c.getActiveObject();
    if (!active) { toast.error("Select an object to tile"); return; }

    const w = c.getWidth(), h = c.getHeight();
    const objDataUrl = active.toDataURL({ format: "png", multiplier: 2 });
    
    const img = new Image();
    img.onload = () => {
      const off = document.createElement("canvas");
      off.width = w * 2; off.height = h * 2;
      const octx = off.getContext("2d")!;
      
      const tw = (w * 2) / tileRepeat;
      const th = (h * 2) / tileRepeat;
      const gw = tileGapX * 2;
      const gh = tileGapY * 2;

      for (let row = -1; row <= tileRepeat + 1; row++) {
        for (let col = -1; col <= tileRepeat + 1; col++) {
          const ox = (row % 2 === 0) ? 0 : tileOffset * tw;
          octx.drawImage(img, col * (tw + gw) + ox, row * (th + gh), tw, th);
        }
      }

      fabric.FabricImage.fromURL(off.toDataURL("image/png"))
        .then((fImg) => {
          if (!canvasRef.current || canvasRef.current !== c) return;
          fImg.set({ left: 0, top: 0, scaleX: 0.5, scaleY: 0.5, selectable: true });
          c.add(fImg);
          c.remove(active);
          c.requestRenderAll();
          emit();
          toast.success("Pattern generated");
        })
        .catch((e) => {
          if (e.name === "AbortError") return;
          console.warn("Pattern application failed", e);
        });
    };
    img.src = objDataUrl;
  };

  const handleGeometricPreset = async () => {
    const src = getSourceDataUrl();
    if (!src) {
      toast.error("Nothing to repeat");
      return;
    }
    await runGated("GEOMETRIC_REPEAT", async () => {
      setIsProcessing(true);
      try {
        const out = await applyGeometricRepeat(src, repeatPreset, {
          repeat: tileRepeat,
          gapX: tileGapX,
          gapY: tileGapY,
          offset: tileOffset,
        });
        await replaceWithImage(out, false);
        toast.success(`${repeatPreset} repeat applied`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Repeat failed");
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const handleSeamlessExtend = async () => {
    const src = getSourceDataUrl();
    if (!src) {
      toast.error("Select an image or use full canvas");
      return;
    }
    await runGated("SEAMLESS_EXTEND", async () => {
      setIsProcessing(true);
      try {
        const out = await makeSeamlessTile(src);
        await replaceWithImage(out);
        toast.success("Seamless tile extended");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Seamless extend failed");
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const handleCleanImage = async () => {
    const src = getSourceDataUrl();
    if (!src) {
      toast.error("Nothing to clean");
      return;
    }
    await runGated("IMAGE_CLEAN", async () => {
      setIsProcessing(true);
      try {
        let out = src;
        if (cleanUseAi) {
          const result = await generateImage({ prompt: "clean textile pattern", task: "imageClean", referenceImage: src });
          out = result.dataUrl;
        } else {
          out = await cleanImageAlgorithm(src);
        }
        await replaceWithImage(out);
        toast.success("Image cleaned");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Clean failed");
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const handleVectorize = async () => {
    const src = getSourceDataUrl();
    if (!src) {
      toast.error("Nothing to vectorize");
      return;
    }
    await runGated("PATTERN_VECTORIZE", async () => {
      setIsProcessing(true);
      try {
        const { svg, pathCount } = await vectorizePattern(src);
        const c = canvasRef.current;
        if (!c) return;
        const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        const result = await fabric.loadSVGFromURL(svgUrl);
        const els = result.objects.filter(Boolean) as fabric.FabricObject[];
        if (!els.length) throw new Error("No paths traced");
        const group = fabric.util.groupSVGElements(els, result.options);
        group.scaleToWidth(Math.min(c.getWidth(), c.getHeight()) * 0.8);
        group.set({ left: 40, top: 40 });
        c.add(group);
        c.setActiveObject(group);
        c.requestRenderAll();
        emit();
        toast.success(`Vectorized (${pathCount} paths)`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Vectorize failed");
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const handleColorSeparation = async () => {
    const src = getSourceDataUrl();
    if (!src) {
      toast.error("Nothing to separate");
      return;
    }
    await runGated("COLOR_SEPARATION", async () => {
      setIsProcessing(true);
      try {
        const plates = await separateColors(src, separationK);
        setSeparationPlates(plates);
        setPanelTab("separation");
        toast.success(`${plates.length} color plates extracted`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Separation failed");
      } finally {
        setIsProcessing(false);
      }
    });
  };

  // ----- Selection / mask -----
  const maskRef = useRef<SelectionMask | null>(null);
  const overlayElRef = useRef<HTMLCanvasElement | null>(null);
  const polyPtsRef = useRef<{ x: number; y: number }[]>([]);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const antsPhaseRef = useRef(0);
  const antsRafRef = useRef<number | null>(null);
  const [selMode, setSelMode] = useState<SelectionMode>("add");
  const [selFeather, setSelFeather] = useState<number>(APP_DATA_0.selection.defaultFeatherPx);
  const [selOpacity, setSelOpacity] = useState<number>(APP_DATA_0.selection.defaultOpacity);
  const [selExpand, setSelExpand] = useState<number>(APP_DATA_0.selection.defaultExpandPx);
  const [selSymmetry, setSelSymmetry] = useState(false);
  const [selBrushSize, setSelBrushSize] = useState<number>(APP_DATA_0.selection.defaultBrushSize);
  const [hasSelection, setHasSelection] = useState(false);
  const [panelTab, setPanelTab] = useState<string>("presets");
  const stageRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openPatterns = useCallback(() => {
    setPanelTab("presets");
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);
  const openCanvas = useCallback(() => {
    requestAnimationFrame(() => {
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const isMaskTool = (t: Tool) => t === "lasso" || t === "polygon" || t === "maskBrush";

  const overlayPoint = (ev: PointerEvent | React.PointerEvent): { x: number; y: number } => {
    const el = overlayElRef.current!;
    const rect = el.getBoundingClientRect();
    const scaleX = el.width / rect.width;
    const scaleY = el.height / rect.height;
    return { x: (ev.clientX - rect.left) * scaleX, y: (ev.clientY - rect.top) * scaleY };
  };

  const renderOverlay = useCallback(() => {
    const ov = overlayElRef.current; const m = maskRef.current;
    if (!ov || !m) return;
    const ctx = ov.getContext("2d")!;
    ctx.clearRect(0, 0, ov.width, ov.height);
    // Soft fill preview of selection
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "rgba(126,60,140,1)";
    // draw mask shape as a tinted overlay
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(m.canvas, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillRect(0, 0, ov.width, ov.height);
    ctx.restore();
    // Marching ants outline (cheap silhouette stroke).
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash(APP_DATA_0.selection.antsDash as unknown as number[]);
    ctx.lineDashOffset = -antsPhaseRef.current;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    // approximate edge by stroking the mask alpha contour via stamping
    ctx.globalCompositeOperation = "source-over";
    // Use a shadow trick to extract a 1px halo (cheap edge).
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 0;
    ctx.drawImage(m.canvas, 0, 0);
    ctx.restore();
    // Polygon-in-progress preview
    if (tool === "polygon" && polyPtsRef.current.length > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(126,60,140,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const p0 = polyPtsRef.current[0];
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < polyPtsRef.current.length; i++) {
        const p = polyPtsRef.current[i];
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      for (const p of polyPtsRef.current) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#7e3c8c"; ctx.fill();
      }
      ctx.restore();
    }
    setHasSelection(!m.isEmpty());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marching-ants animation
  useEffect(() => {
    if (!isMaskTool(tool) && !hasSelection) {
      if (antsRafRef.current) cancelAnimationFrame(antsRafRef.current);
      antsRafRef.current = null;
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last >= APP_DATA_0.selection.antsSpeedMs) {
        antsPhaseRef.current = (antsPhaseRef.current + 1) % 1000;
        last = now;
        renderOverlay();
      }
      antsRafRef.current = requestAnimationFrame(tick);
    };
    antsRafRef.current = requestAnimationFrame(tick);
    return () => { if (antsRafRef.current) cancelAnimationFrame(antsRafRef.current); };
  }, [tool, hasSelection, renderOverlay]);

  // Init mask when fabric canvas is ready
  useEffect(() => {
    if (!canvasRef.current) return;
    if (!maskRef.current) maskRef.current = new SelectionMask(sizeRef.current.w, sizeRef.current.h);
    renderOverlay();
  }, [renderOverlay]);

  // Pointer handlers on overlay
  const onOverlayPointerDown = (e: React.PointerEvent) => {
    if (!isMaskTool(tool)) return;
    const m = maskRef.current; if (!m) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = overlayPoint(e.nativeEvent);
    drawingRef.current = true;
    if (tool === "lasso") {
      polyPtsRef.current = [p];
    } else if (tool === "polygon") {
      if (polyPtsRef.current.length === 0) polyPtsRef.current = [p];
      else if (polyPtsRef.current.length < APP_DATA_0.selection.maxPolygonPoints) polyPtsRef.current.push(p);
      renderOverlay();
    } else if (tool === "maskBrush") {
      const buf = document.createElement("canvas");
      buf.width = sizeRef.current.w; buf.height = sizeRef.current.h;
      const bctx = buf.getContext("2d")!;
      m.paintStrokePoint(bctx, p.x, p.y, selBrushSize, selSymmetry);
      m.commitBuffer(buf, selMode);
      lastPtRef.current = { ...p, t: performance.now() };
      renderOverlay();
    }
  };

  const onOverlayPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    if (!isMaskTool(tool)) return;
    const now = performance.now();
    if (lastPtRef.current && now - lastPtRef.current.t < APP_DATA_0.selection.pointerThrottleMs) return;
    const m = maskRef.current; if (!m) return;
    const p = overlayPoint(e.nativeEvent);
    if (tool === "lasso") {
      polyPtsRef.current.push(p);
      renderOverlay();
    } else if (tool === "maskBrush") {
      const buf = document.createElement("canvas");
      buf.width = sizeRef.current.w; buf.height = sizeRef.current.h;
      const bctx = buf.getContext("2d")!;
      // interpolate between last and current for smooth strokes
      const last = lastPtRef.current!;
      const dx = p.x - last.x, dy = p.y - last.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(dist / (selBrushSize * 0.4)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        m.paintStrokePoint(bctx, last.x + dx * t, last.y + dy * t, selBrushSize, selSymmetry);
      }
      m.commitBuffer(buf, selMode);
      lastPtRef.current = { ...p, t: now };
      renderOverlay();
    }
  };

  const onOverlayPointerUp = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const m = maskRef.current; if (!m) return;
    if (tool === "lasso" && polyPtsRef.current.length >= 3) {
      const buf = document.createElement("canvas");
      buf.width = sizeRef.current.w; buf.height = sizeRef.current.h;
      const bctx = buf.getContext("2d")!;
      m.fillPolygon(bctx, polyPtsRef.current, selSymmetry);
      m.commitBuffer(buf, selMode);
      polyPtsRef.current = [];
    }
    lastPtRef.current = null;
    renderOverlay();
    void e;
  };

  const finishPolygon = () => {
    const m = maskRef.current; if (!m) return;
    if (polyPtsRef.current.length < 3) { polyPtsRef.current = []; renderOverlay(); return; }
    const buf = document.createElement("canvas");
    buf.width = sizeRef.current.w; buf.height = sizeRef.current.h;
    const bctx = buf.getContext("2d")!;
    m.fillPolygon(bctx, polyPtsRef.current, selSymmetry);
    m.commitBuffer(buf, selMode);
    polyPtsRef.current = [];
    renderOverlay();
  };

  const clearSelection = () => {
    maskRef.current?.clear();
    polyPtsRef.current = [];
    renderOverlay();
  };
  const invertSelection = () => { maskRef.current?.invert(); renderOverlay(); };

  /** Apply the current canvas as a "fill source" only inside the selection.
   * This bakes the soft mask into the rasterised result so the 3D pipeline
   * picks it up automatically through the regular texture path. */
  const applyInsideSelection = (fillKind: "color" | "pattern" | "gradient") => {
    const c = canvasRef.current; const m = maskRef.current; if (!c || !m) return;
    if (m.isEmpty()) { return; }
    // Build the fill onto a separate canvas the same size as the fabric canvas.
    const w = sizeRef.current.w, h = sizeRef.current.h;
    const fill = document.createElement("canvas");
    fill.width = w; fill.height = h;
    const fctx = fill.getContext("2d")!;
    if (fillKind === "color") {
      fctx.fillStyle = brushColor; fctx.fillRect(0, 0, w, h);
      bakeInside();
    } else if (fillKind === "pattern") {
      const p1 = PATTERN_PRESETS.find((p) => p.id === patternBrushId);
      const p2 = EXTRA_PATTERNS.find((p) => p.id === patternBrushId);
      let pUrl = "";
      if (p1) pUrl = patternToDataUrl(p1, patternColor, patternBg);
      else if (p2) pUrl = getExtraPatternUrl(p2, patternColor, patternBg);
      else pUrl = patternToDataUrl(PATTERN_PRESETS[0], patternColor, patternBg);

      const img = new Image();
      img.onload = () => {
        const pat = fctx.createPattern(img, "repeat");
        if (pat) { fctx.fillStyle = pat; fctx.fillRect(0, 0, w, h); }
        bakeInside();
      };
      img.src = pUrl;
      return; // async
    } else if (fillKind === "gradient") {
      const g = GRADIENT_PRESETS[0];
      const lg = fctx.createLinearGradient(0, 0, w, h);
      g.stops.forEach((s) => lg.addColorStop(s.offset, s.color));
      fctx.fillStyle = lg; fctx.fillRect(0, 0, w, h);
      bakeInside();
    }

    function bakeInside() {
      const maskUrl = m!.exportSoftMask({
        feather: selFeather, opacity: selOpacity, expand: selExpand, symmetryX: selSymmetry,
      });
      const maskImg = new Image();
      maskImg.onload = async () => {
        if (!canvasRef.current || canvasRef.current !== c) return;
        // Composite: fill * mask -> a single image
        const comp = document.createElement("canvas");
        comp.width = w; comp.height = h;
        const cctx = comp.getContext("2d")!;
        SelectionMask.compositeWithMask(cctx, fill, maskImg, w, h);
        const url = comp.toDataURL("image/png");
        try {
          const fImg = await fabric.FabricImage.fromURL(url, { signal: abortRef.current?.signal });
          if (!canvasRef.current || canvasRef.current !== c) return;
          fImg.set({ left: 0, top: 0, selectable: true, evented: true });
          c!.add(fImg);
          c!.renderAll();
          emit();
        } catch (e: any) {
          if (e.name === "AbortError") return;
          console.warn("Bake inside failed", e);
        }
      };
      maskImg.src = maskUrl;
    }
  };

  const emit = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const overlay = c.getObjects().find(o => (o as any).id === 'maskOverlay');
    const wireframe = c.getObjects().find(o => (o as any).id === 'uvWireframeOverlay');
    if (overlay) overlay.set('visible', false);
    if (wireframe) wireframe.set('visible', false);
    
    const url = c.toDataURL({ format: "png", multiplier: 1 });
    
    if (overlay) overlay.set('visible', true);
    if (wireframe) wireframe.set('visible', true);
    
    try { 
      const jsonObj = c.toJSON(["id", "selectable", "evented", "lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "hasControls", "globalCompositeOperation"]);
      const json = JSON.stringify(jsonObj);
      onChange(url, json);
      const saveKey = autosaveKey ? `fabrixa:autosave:${autosaveKey}` : "fabrixa:autosave";
      setDbData(saveKey, json); 
    } catch { /* ignore */ }
  }, [onChange]);

  const saveHistory = useCallback(() => {
    const c = canvasRef.current; if (!c || historyRef.current.lock) return;
    const json = JSON.stringify(c.toJSON(["id", "selectable", "evented", "lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "hasControls", "globalCompositeOperation"]));
    const h = historyRef.current;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(json);
    if (h.stack.length > 50) h.stack.shift();
    h.index = h.stack.length - 1;
  }, []);

  // ----- init -----
  useEffect(() => {
    if (!canvasElRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;

    const c = new fabric.Canvas(canvasElRef.current, {
      width: canvasSize.w, height: canvasSize.h, backgroundColor: bgColor, preserveObjectStacking: true,
    });
    canvasRef.current = c;

    if (uvWireframeUrl) {
      fabric.FabricImage.fromURL(uvWireframeUrl).then((img) => {
        if (!canvasRef.current || canvasRef.current !== c) return;
        img.scaleToWidth(canvasSize.w);
        img.scaleToHeight(canvasSize.h);
        img.set({ 
          id: 'uvWireframeOverlay',
          absolutePositioned: true, originX: 'left', originY: 'top', left: 0, top: 0,
          selectable: false, evented: false, opacity: 0.8
        });
        c.add(img);
        c.sendObjectToBack(img);
        c.requestRenderAll();
      }).catch(e => console.warn("Failed to load uvWireframeUrl", e));
    }

    if (initialMaskUrl) {
      fabric.FabricImage.fromURL(initialMaskUrl).then((img) => {
        if (!canvasRef.current || canvasRef.current !== c) return;
        img.scaleToWidth(canvasSize.w);
        img.scaleToHeight(canvasSize.h);
        img.set({ absolutePositioned: true, originX: 'left', originY: 'top', left: 0, top: 0 });
        c.clipPath = img;
        
        img.clone().then((overlay: any) => {
          overlay.set({
            id: 'maskOverlay',
            opacity: 0.15,
            selectable: false,
            evented: false,
            globalCompositeOperation: 'source-over',
          });
          c.add(overlay);
          c.sendObjectBackwards(overlay);
          c.requestRenderAll();
        });
        
        c.requestRenderAll();
      }).catch(e => console.warn("Failed to load initialMaskUrl clipPath", e));
    }

    // Restoration logic (Async)
    const initCanvas = async () => {
      const saveKey = autosaveKey ? `fabrixa:autosave:${autosaveKey}` : "fabrixa:autosave";
      const dbRestore = !initialMaskUrl ? await getDbData(saveKey) : null;
      const restore = initialJson || dbRestore;

      if (restore) {
        try {
          const parsed = typeof restore === 'string' ? JSON.parse(restore) : restore;
          if (parsed && typeof parsed === 'object') {
            await c.loadFromJSON(parsed, undefined, { signal: controller.signal });
            if (!canvasRef.current || canvasRef.current !== c) return;
            c.renderAll();
            saveHistory();
            emit();
          } else {
            saveHistory();
          }
        } catch (e) {
          console.warn("Fabric restore error", e);
          saveHistory();
        }
      } else if (initialContentUrl) {
        try {
          const img = await fabric.FabricImage.fromURL(initialContentUrl);
          if (!canvasRef.current || canvasRef.current !== c) return;
          img.scaleToWidth(canvasSize.w);
          img.scaleToHeight(canvasSize.h);
          img.set({ left: 0, top: 0, selectable: true, evented: true });
          c.add(img);
          c.renderAll();
          saveHistory();
          emit();
        } catch (e) {
          console.warn("Failed to load initialContentUrl", e);
          saveHistory();
        }
      } else {
        saveHistory();
      }
    };

    initCanvas();

    const onAny = () => {
      if (!canvasRef.current || canvasRef.current !== c) return;
      saveHistory();
      emit();
      refreshLayers();
    };
    c.on("object:added", onAny);
    c.on("object:modified", onAny);
    c.on("object:removed", onAny);
    c.on("object:scaling", onAny);
    c.on("object:rotating", onAny);
    c.on("mouse:down", (opt) => {
      if (toolRef.current === "eraser" && !c.getActiveObject()) {
        const target = c.findTarget(opt.e);
        if (target) {
          c.setActiveObject(target);
          c.renderAll();
        }
      }
    });
    c.on("path:created", async (e: any) => {
      if (toolRef.current === "eraser" && e.path) {
        const path = e.path;
        // Ensure path is opaque and black for masking
        path.set({ stroke: "black", fill: "black", opacity: 1 });

        const objects = c.getObjects().filter(
          (obj) => obj !== path && (obj as any).id !== "guide" && obj.selectable
        );

        let affected = false;
        for (const target of objects) {
          // Check if eraser path intersects this object
          if (path.intersectsWithObject(target) || target.containsPoint(path.getCenterPoint())) {
            affected = true;
            const clone = await path.clone();
            const center = target.getCenterPoint();
            const angle = target.angle || 0;
            const sX = target.scaleX || 1;
            const sY = target.scaleY || 1;

            // Transform canvas path coordinates to object-local space (accounting for rotation and scale)
            const relX = clone.left - center.x;
            const relY = clone.top - center.y;
            const rad = fabric.util.degreesToRadians(-angle);
            const rotated = fabric.util.rotatePoint(new fabric.Point(relX, relY), new fabric.Point(0, 0), rad);

            clone.set({
              left: rotated.x / sX,
              top: rotated.y / sY,
              angle: (clone.angle || 0) - angle,
              scaleX: clone.scaleX / sX,
              scaleY: clone.scaleY / sY,
              absolutePositioned: false,
              stroke: "black",
              fill: "black",
            });

            if (!target.clipPath || !(target.clipPath instanceof fabric.Group)) {
              const oldClip = target.clipPath;
              const groupItems = oldClip ? [oldClip, clone] : [clone];
              target.clipPath = new fabric.Group(groupItems, {
                inverted: true,
                absolutePositioned: false,
              });
            } else {
              (target.clipPath as fabric.Group).add(clone);
              target.clipPath.set("inverted", true);
            }
            target.set("dirty", true);
          }
        }
        
        // Remove the temporary pink stroke from canvas
        c.remove(path);
        c.requestRenderAll();
        onAny();
      } else {
        onAny();
      }
    });
    c.on("selection:created", (e) => { setSelected(e.selected?.[0] ?? null); refreshLayers(); });
    c.on("selection:updated", (e) => { setSelected(e.selected?.[0] ?? null); refreshLayers(); });
    c.on("selection:cleared", () => { setSelected(null); refreshLayers(); });

    const guideLayer: { v: number | null; h: number | null } = { v: null, h: null };
    c.on("object:moving", (e) => {
      const obj = e.target; if (!obj) return;
      const cw = c.getWidth(); const ch = c.getHeight();
      const w = (obj.width ?? 0) * (obj.scaleX ?? 1);
      const h = (obj.height ?? 0) * (obj.scaleY ?? 1);
      const cx = (obj.left ?? 0) + w / 2; const cy = (obj.top ?? 0) + h / 2;
      const vTargets = [0, cw / 2, cw]; const hTargets = [0, ch / 2, ch];
      guideLayer.v = null; guideLayer.h = null;
      for (const t of vTargets) {
        if (Math.abs(cx - t) < SNAP_THRESHOLD) { obj.set({ left: t - w / 2 }); guideLayer.v = t; break; }
      }
      for (const t of hTargets) {
        if (Math.abs(cy - t) < SNAP_THRESHOLD) { obj.set({ top: t - h / 2 }); guideLayer.h = t; break; }
      }
      c.requestRenderAll();
    });
    c.on("after:render", () => {
      const ctx = (c as unknown as { contextTop: CanvasRenderingContext2D }).contextTop; if (!ctx) return;
      ctx.save(); ctx.strokeStyle = "rgba(126,60,140,0.9)"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      if (guideLayer.v != null) { ctx.beginPath(); ctx.moveTo(guideLayer.v, 0); ctx.lineTo(guideLayer.v, c.getHeight()); ctx.stroke(); }
      if (guideLayer.h != null) { ctx.beginPath(); ctx.moveTo(0, guideLayer.h); ctx.lineTo(c.getWidth(), guideLayer.h); ctx.stroke(); }
      ctx.restore();
    });
    c.on("mouse:up", () => { guideLayer.v = null; guideLayer.h = null; c.requestRenderAll(); });

    return () => {
      // Flawless persistence: save one last time before disposal
      try {
        const lastUrl = c.toDataURL({ format: "png", multiplier: 1 });
        onChange(lastUrl);
        const json = c.toJSON(["id", "selectable", "evented", "lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "hasControls", "globalCompositeOperation"]);
        const saveKey = autosaveKey ? `fabrixa:autosave:${autosaveKey}` : "fabrixa:autosave";
        setDbData(saveKey, JSON.stringify(json));
      } catch (e) { /* ignore */ }

      controller.abort();
      abortRef.current = null;
      try {
        c.dispose();
      } catch (e) {
        console.warn("Fabric disposal error", e);
      }
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update logic when Aspect Ratio / size changes
  useEffect(() => {
    const c = canvasRef.current;
    if (c && !(c as any).disposed && !(c as any)._disposed) {
      c.setDimensions({ width: canvasSize.w, height: canvasSize.h });
      c.renderAll();
    }
    if (maskRef.current) {
      maskRef.current = new SelectionMask(canvasSize.w, canvasSize.h);
      setHasSelection(false);
      renderOverlay();
    }
  }, [canvasSize, renderOverlay]);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.backgroundColor = bgColor; c.renderAll(); emit();
  }, [bgColor, emit]);

  // ----- tool switching (incl Pattern Brush) -----
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.isDrawingMode = tool !== "select" && !isMaskTool(tool);
    if (tool === "brush") {
      const b = new fabric.PencilBrush(c); b.color = brushColor; b.width = brushSize; c.freeDrawingBrush = b;
    } else if (tool === "eraser") {
      const b = new fabric.PencilBrush(c);
      b.width = brushSize * 2;
      // Vibrant eraser pink with enough transparency to see what is under
      b.color = "rgba(255, 105, 180, 0.45)"; 
      c.freeDrawingBrush = b;
    } else if (tool === "pattern") {
      const p1 = PATTERN_PRESETS.find((p) => p.id === patternBrushId);
      const p2 = EXTRA_PATTERNS.find((p) => p.id === patternBrushId);
      let dataUrl = "";
      if (p1) dataUrl = patternToDataUrl(p1, patternColor, patternBg);
      else if (p2) dataUrl = getExtraPatternUrl(p2, patternColor, patternBg);
      else dataUrl = patternToDataUrl(PATTERN_PRESETS[0], patternColor, patternBg);

      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;
        const pb = new fabric.PatternBrush(canvasRef.current);
        pb.source = img as unknown as HTMLCanvasElement;
        pb.width = brushSize * 3;
        canvasRef.current.freeDrawingBrush = pb;
      };
      img.src = dataUrl;
    }
  }, [tool, brushColor, brushSize, bgColor, patternBrushId, patternColor, patternBg]);

  // ----- shape helpers -----
  const addRect = () => { canvasRef.current?.add(new fabric.Rect({ left: 100, top: 100, width: 120, height: 120, fill: brushColor })); };
  const addCircle = () => { canvasRef.current?.add(new fabric.Circle({ left: 100, top: 100, radius: 60, fill: brushColor })); };
  const addTriangle = () => { canvasRef.current?.add(new fabric.Triangle({ left: 100, top: 100, width: 120, height: 120, fill: brushColor })); };
  const addStar = () => {
    const points = [];
    for (let i = 0; i < 5; i++) {
      points.push({ x: 60 + 60 * Math.cos((18 + 72 * i) * Math.PI / 180), y: 60 + 60 * Math.sin((18 + 72 * i) * Math.PI / 180) });
      points.push({ x: 60 + 25 * Math.cos((54 + 72 * i) * Math.PI / 180), y: 60 + 25 * Math.sin((54 + 72 * i) * Math.PI / 180) });
    }
    canvasRef.current?.add(new fabric.Polygon(points, { left: 100, top: 100, fill: brushColor }));
  };
  const addHexagon = () => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      points.push({ x: 60 + 60 * Math.cos((i * 60) * Math.PI / 180), y: 60 + 60 * Math.sin((i * 60) * Math.PI / 180) });
    }
    canvasRef.current?.add(new fabric.Polygon(points, { left: 100, top: 100, fill: brushColor }));
  };
  const addHeart = () => {
    const path = "M 272.70141,238.71731 C 206.46141,238.71731 152.70141,292.47731 152.70141,358.71731 C 152.70141,493.47731 288.96141,566.23731 436.70141,656.23731 C 584.44141,566.23731 720.70141,493.47731 720.70141,358.71731 C 720.70141,292.47731 666.94141,238.71731 600.70141,238.71731 C 534.46141,238.71731 480.70141,292.47731 436.70141,348.71731 C 392.70141,292.47731 338.94141,238.71731 272.70141,238.71731 Z";
    canvasRef.current?.add(new fabric.Path(path, { left: 100, top: 100, fill: brushColor, scaleX: 0.2, scaleY: 0.2 }));
  };
  const addArrow = () => {
    const path = "M 0 40 L 80 40 L 80 0 L 140 60 L 80 120 L 80 80 L 0 80 Z";
    canvasRef.current?.add(new fabric.Path(path, { left: 100, top: 100, fill: brushColor, scaleX: 0.8, scaleY: 0.8 }));
  };

  const addText = () => { canvasRef.current?.add(new fabric.IText("Design", { left: 100, top: 100, fill: brushColor, fontFamily: "sans-serif", fontSize: 48 })); };

  const [importing, setImporting] = useState<string | null>(null);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImporting(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const completeImport = async (mode: "normal" | "fit") => {
    if (!importing || !canvasRef.current) return;
    const c = canvasRef.current;
    try {
      const img = await fabric.FabricImage.fromURL(importing, { signal: abortRef.current?.signal });
      if (!canvasRef.current || canvasRef.current !== c) return;
      if (mode === "fit") {
        const w = canvasSize.w, h = canvasSize.h;
        const s = Math.min(w / img.width, h / img.height);
        img.set({ left: (w - img.width * s) / 2, top: (h - img.height * s) / 2, scaleX: s, scaleY: s });
      } else {
        img.scaleToWidth(280); img.set({ left: 60, top: 60 });
      }
      c.add(img);
      c.setActiveObject(img);
      setImporting(null);
    } catch (e: any) {
      if (e.name === "AbortError") return;
      console.warn("Import failed", e);
      setImporting(null);
    }
  };

  const removeSel = () => {
    const c = canvasRef.current; if (!c) return;
    c.getActiveObjects().forEach((o) => c.remove(o)); c.discardActiveObject();
  };
  const duplicate = async () => {
    const c = canvasRef.current; if (!c) return;
    const obj = c.getActiveObject(); if (!obj) return;
    const cloned = await obj.clone();
    cloned.set({ left: (obj.left ?? 0) + 20, top: (obj.top ?? 0) + 20 });
    c.add(cloned); c.setActiveObject(cloned);
  };
  const undo = () => {
    const h = historyRef.current; const c = canvasRef.current;
    if (!c || h.index <= 0) return;
    h.index--; h.lock = true;
    c.loadFromJSON(JSON.parse(h.stack[h.index]), undefined, { signal: abortRef.current?.signal })
      .then(() => {
        if (!canvasRef.current || canvasRef.current !== c) return;
        c.renderAll(); h.lock = false; emit();
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        console.warn("Undo failed", e);
        h.lock = false;
      });
  };
  const redo = () => {
    const h = historyRef.current; const c = canvasRef.current;
    if (!c || h.index >= h.stack.length - 1) return;
    h.index++; h.lock = true;
    c.loadFromJSON(JSON.parse(h.stack[h.index]), undefined, { signal: abortRef.current?.signal })
      .then(() => {
        if (!canvasRef.current || canvasRef.current !== c) return;
        c.renderAll(); h.lock = false; emit();
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        console.warn("Redo failed", e);
        h.lock = false;
      });
  };
  const clearAll = () => {
    const c = canvasRef.current; if (!c) return;
    c.getObjects().forEach((o) => c.remove(o)); c.backgroundColor = bgColor; c.renderAll();
  };

  // ----- presets -----
  const applyPatternBg = async (id: string) => {
    const c = canvasRef.current; if (!c) return;
    let url = "";
    const p1 = PATTERN_PRESETS.find((x) => x.id === id);
    if (p1) {
      url = patternToDataUrl(p1, patternColor, patternBg);
    } else {
      const p2 = EXTRA_PATTERNS.find((x) => x.id === id);
      if (p2) url = getExtraPatternUrl(p2, patternColor, patternBg);
      else return;
    }
    const img = new Image();
    img.onload = () => {
      const pattern = new fabric.Pattern({ source: img, repeat: "repeat" });
      (c as unknown as { backgroundColor: unknown }).backgroundColor = pattern;
      c.renderAll(); emit();
    };
    img.src = url;
  };

  const applyGradientPreset = (id: string) => {
    const c = canvasRef.current; if (!c) return;
    const g = GRADIENT_PRESETS.find((x) => x.id === id); if (!g) return;
    const obj = c.getActiveObject();
    const grad = new fabric.Gradient({
      type: "linear",
      coords: { x1: 0, y1: 0, x2: obj?.width ?? c.getWidth(), y2: obj?.height ?? c.getHeight() },
      colorStops: g.stops,
    });
    if (obj) { obj.set("fill", grad); }
    else {
      const r = new fabric.Rect({ left: 0, top: 0, width: c.getWidth(), height: c.getHeight(), selectable: false, evented: false, fill: grad });
      c.add(r); c.sendObjectToBack(r);
    }
    c.renderAll(); emit();
  };

  // ----- Color Replace (works on selected image, or whole canvas) -----
  const hexToRgb = (h: string) => {
    const m = h.replace("#", "");
    return { r: parseInt(m.slice(0, 2), 16), g: parseInt(m.slice(2, 4), 16), b: parseInt(m.slice(4, 6), 16) };
  };
  const runColorReplace = async () => {
    const c = canvasRef.current; if (!c) return;
    const obj = c.getActiveObject();
    const sourceUrl = (obj instanceof fabric.FabricImage)
      ? (obj as fabric.FabricImage).getSrc()
      : c.toDataURL({ format: "png", multiplier: 1 });
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      if (!canvasRef.current || canvasRef.current !== c) return;
      const off = document.createElement("canvas");
      off.width = img.width; off.height = img.height;
      const ctx = off.getContext("2d"); if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, off.width, off.height);
      const from = hexToRgb(replaceFrom); const to = hexToRgb(replaceTo);
      const tol = replaceTol * replaceTol * 3;
      for (let i = 0; i < data.data.length; i += 4) {
        const dr = data.data[i] - from.r, dg = data.data[i + 1] - from.g, db = data.data[i + 2] - from.b;
        if (dr * dr + dg * dg + db * db <= tol) {
          data.data[i] = to.r; data.data[i + 1] = to.g; data.data[i + 2] = to.b;
        }
      }
      ctx.putImageData(data, 0, 0);
      const newUrl = off.toDataURL("image/png");
      if (obj instanceof fabric.FabricImage) {
        const replaced = await fabric.FabricImage.fromURL(newUrl);
        replaced.set({ left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle });
        c.remove(obj); c.add(replaced); c.setActiveObject(replaced);
      } else {
        const replaced = await fabric.FabricImage.fromURL(newUrl);
        c.getObjects().forEach((o) => c.remove(o));
        c.backgroundColor = "#ffffff";
        replaced.set({ left: 0, top: 0 });
        c.add(replaced);
      }
      c.renderAll(); emit();
    };
    img.src = sourceUrl;
  };

  // ----- image filters -----
  useEffect(() => {
    const obj = selected; if (!(obj instanceof fabric.FabricImage)) return;
    const filters: unknown[] = [];
    if (hue !== 0) filters.push(new fabric.filters.HueRotation({ rotation: hue / 180 }));
    if (saturation !== 0) filters.push(new fabric.filters.Saturation({ saturation: saturation / 100 }));
    if (contrast !== 0) filters.push(new fabric.filters.Contrast({ contrast: contrast / 100 }));
    if (blur !== 0) filters.push(new fabric.filters.Blur({ blur: blur / 100 }));
    obj.filters = filters as never; obj.applyFilters();
    obj.set({ opacity: opacity / 100 });
    canvasRef.current?.renderAll(); emit();
  }, [hue, saturation, contrast, blur, opacity, selected, emit]);

  // ----- exports -----
  useEffect(() => {
    (window as unknown as { __fabrixa?: unknown }).__fabrixa = {
      exportPNG: (mult = 2) => canvasRef.current?.toDataURL({ format: "png", multiplier: mult }),
      exportJPG: (mult = 2, q = 0.92) => canvasRef.current?.toDataURL({ format: "jpeg", multiplier: mult, quality: q }),
      exportWebP: (mult = 2, q = 0.9) => canvasRef.current?.toDataURL({ format: "webp" as never, multiplier: mult, quality: q }),
      exportTransparent: (mult = 2) => {
        const c = canvasRef.current; if (!c) return null;
        const prev = c.backgroundColor;
        c.backgroundColor = ""; c.renderAll();
        const url = c.toDataURL({ format: "png", multiplier: mult });
        c.backgroundColor = prev; c.renderAll(); return url;
      },
      exportTiled: () => {
        const c = canvasRef.current; if (!c) return null;
        const tile = c.toDataURL({ format: "png", multiplier: 1 });
        return new Promise<string>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const out = document.createElement("canvas");
            out.width = img.width * 3; out.height = img.height * 3;
            const ctx = out.getContext("2d")!;
            for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.drawImage(img, x * img.width, y * img.height);
            resolve(out.toDataURL("image/png"));
          };
          img.src = tile;
        });
      },
      /** Load an external image (from AI / uploads / neck designer) onto the canvas as the base layer. */
      loadImage: async (dataUrl: string, opts?: { replaceCanvas?: boolean }) => {
        const c = canvasRef.current; if (!c) return;
        try {
          const img = await fabric.FabricImage.fromURL(dataUrl, { signal: abortRef.current?.signal });
          if (!canvasRef.current || canvasRef.current !== c) return;
          if (opts?.replaceCanvas) {
            c.getObjects().forEach((o) => c.remove(o));
            const w = c.getWidth(), h = c.getHeight();
            const s = Math.min(w / (img.width ?? w), h / (img.height ?? h));
            img.set({ left: 0, top: 0, scaleX: s, scaleY: s, selectable: true });
          } else {
            img.scaleToWidth(280); img.set({ left: 60, top: 60 });
          }
          c.add(img); c.setActiveObject(img); c.renderAll();
        } catch (e: any) {
          if (e.name === "AbortError") return;
          console.warn("Load image failed", e);
        }
      },
      persist: async () => {
        const c = canvasRef.current; if (!c) return;
        const url = c.toDataURL({ format: "png", multiplier: 1 });
        onChange(url);
        // Include common properties for perfect restoration (id, selectable, etc.)
        const json = c.toJSON(["id", "selectable", "evented", "lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY", "lockRotation", "hasControls", "globalCompositeOperation"]);
        const saveKey = autosaveKey ? `fabrixa:autosave:${autosaveKey}` : "fabrixa:autosave";
        await setDbData(saveKey, JSON.stringify(json));
      },
    };
  }, []);

  // ----- responsive canvas (scales perfectly to screen space) -----
  useEffect(() => {
    const el = stageRef.current; const c = canvasRef.current;
    if (!el || !c) return;
    const fit = () => {
      if (!canvasRef.current || canvasRef.current !== c || (c as any)._disposed) return;
      const padX = 40;
      const padY = 40; // padding to prevent top/bottom touching
      const maxW = el.clientWidth - padX;
      const maxH = el.clientHeight - padY;
      // scales down proportionally by whichever constraint is tighter
      const scale = Math.min(maxW / canvasSize.w, maxH / canvasSize.h, 1); 
      try {
        c.setDimensions({ width: canvasSize.w * scale, height: canvasSize.h * scale }, { cssOnly: true });
      } catch { /* ignore if already disposed */ }
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [canvasSize]);

  // ----- keyboard shortcuts (V/B/E, Ctrl+Z/Y, Delete) -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (meta && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (canvasRef.current?.getActiveObject()) { e.preventDefault(); removeSel(); }
        return;
      }
      if (e.key === "v" || e.key === "V") setTool("select");
      else if (e.key === "b" || e.key === "B") setTool("brush");
      else if (e.key === "e" || e.key === "E") setTool("eraser");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const tbtn = (active: boolean) => active ? "default" : "ghost";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        {/* Toolbar */}
        <div className="grid shrink-0 grid-cols-8 items-center gap-1 rounded-xl border bg-panel/80 p-2 backdrop-blur sm:flex sm:overflow-x-auto sm:[scrollbar-width:thin]">
          <ToolBtn label="Select (V)" onClick={() => setTool("select")} variant={tbtn(tool === "select")}><MousePointer2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Brush (B)" onClick={() => setTool("brush")} variant={tbtn(tool === "brush")}><Brush className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Pattern Brush" onClick={() => setTool("pattern")} variant={tbtn(tool === "pattern")}><Stamp className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Eraser (E)" onClick={() => setTool("eraser")} variant={tbtn(tool === "eraser")}><Eraser className="h-4 w-4" /></ToolBtn>
          <Sep />
          <ToolBtn label="Lasso Select" onClick={() => setTool("lasso")} variant={tbtn(tool === "lasso")}><Lasso className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Polygon Select" onClick={() => setTool("polygon")} variant={tbtn(tool === "polygon")}><Pentagon className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Brush Select" onClick={() => setTool("maskBrush")} variant={tbtn(tool === "maskBrush")}><Wand2 className="h-4 w-4" /></ToolBtn>
          <Sep />
          <Popover>
            <PopoverTrigger asChild>
              <button title="Add Shape" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"><Square className="h-4 w-4" /></button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="grid grid-cols-4 gap-2 w-auto p-2">
              <ToolBtn label="Rectangle" onClick={addRect}><Square className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Circle" onClick={addCircle}><CircleIcon className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Triangle" onClick={addTriangle}><Pentagon className="h-4 w-4" style={{ transform: "rotate(180deg)" }} /></ToolBtn>
              <ToolBtn label="Star" onClick={addStar}><Sparkles className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Hexagon" onClick={addHexagon}><Pentagon className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Heart" onClick={addHeart}><Palette className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Arrow" onClick={addArrow}><ArrowUp className="h-4 w-4" style={{ transform: "rotate(90deg)" }} /></ToolBtn>
            </PopoverContent>
          </Popover>
          <ToolBtn label="Text" onClick={addText}><Type className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Upload image" onClick={() => fileRef.current?.click()}><ImageIcon className="h-4 w-4" /></ToolBtn>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
          <Sep />
          
          {/* Smart Import Dialog */}
          {importing && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-2xl">
                <h3 className="text-lg font-semibold mb-2">Import Image</h3>
                <p className="text-sm text-muted-foreground mb-6">Choose how you want to place this image on your design canvas.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => completeImport("normal")} className="h-24 flex-col gap-2">
                    <ImageIcon className="h-6 w-6" />
                    <span>Normal Size</span>
                  </Button>
                  <Button variant="default" onClick={() => completeImport("fit")} className="h-24 flex-col gap-2">
                    <Crop className="h-6 w-6" />
                    <span>Fit Canvas</span>
                  </Button>
                </div>
                <Button variant="ghost" onClick={() => setImporting(null)} className="mt-4 w-full text-muted-foreground">Cancel</Button>
              </div>
            </div>
          )}
          
          <ToolBtn label="Duplicate" onClick={duplicate}><Copy className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Delete selection" onClick={removeSel}><Trash2 className="h-4 w-4" /></ToolBtn>
          <Sep />
          <ToolBtn label="Undo" onClick={undo}><Undo2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Redo" onClick={redo}><Redo2 className="h-4 w-4" /></ToolBtn>
          <div className="flex shrink-0 items-center gap-1.5 sm:ml-auto sm:pl-2">
            
            {/* Aspect Ratio Selector */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Canvas Aspect Ratio"
                  className="flex h-9 items-center justify-center gap-1.5 rounded-md border bg-background px-2 shadow-sm hover:bg-muted sm:w-auto"
                >
                  <Crop className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline-block text-xs font-medium">Ratio</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" sideOffset={6} className="w-[140px] p-2">
                <div className="grid grid-cols-1 gap-1">
                  <Button variant="ghost" size="sm" className="h-8 justify-start text-xs" onClick={() => setCanvasSize({w: 600, h: 600})}>1:1 Square</Button>
                  <Button variant="ghost" size="sm" className="h-8 justify-start text-xs" onClick={() => setCanvasSize({w: 450, h: 800})}>9:16 Vertical</Button>
                  <Button variant="ghost" size="sm" className="h-8 justify-start text-xs" onClick={() => setCanvasSize({w: 800, h: 450})}>16:9 Horizontal</Button>
                  <Button variant="ghost" size="sm" className="h-8 justify-start text-xs" onClick={() => setCanvasSize({w: 600, h: 750})}>4:5 Portrait</Button>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Color wheel"
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border bg-background px-2 shadow-sm hover:bg-muted sm:w-auto"
                >
                  <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                  <span
                    className="h-5 w-5 rounded border"
                    style={{ background: brushColor }}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={6} className="w-[280px] p-3">
                <ColorPanel
                  color={brushColor}
                  onColorChange={setBrushColor}
                  onApplyGradientTexture={(url) => {
                    const c = canvasRef.current;
                    if (!c) return;
                    fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous", signal: abortRef.current?.signal })
                      .then((img) => {
                        if (!canvasRef.current || canvasRef.current !== c) return;
                        img.scaleToWidth(canvasSize.w);
                        img.set({ left: 0, top: 0, selectable: true });
                        c.add(img);
                        c.requestRenderAll();
                        toast.success("Gradient added as a layer");
                      })
                      .catch((e) => {
                        if (e.name === "AbortError") return;
                        console.warn("Gradient apply failed", e);
                      });
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

        </div>

        {/* Canvas + panel */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pb-20 lg:flex-row lg:overflow-hidden lg:pb-0">
          <div ref={stageRef}
            className="flex min-h-[300px] w-full shrink-0 items-center justify-center overflow-auto pb-12 rounded-xl border bg-[conic-gradient(at_50%_50%,#e9e9ef_25%,#fafafa_0_50%,#e9e9ef_0_75%,#fafafa_0)] bg-[length:24px_24px] p-4 dark:bg-[conic-gradient(at_50%_50%,#2a2a36_25%,#1e1e28_0_50%,#2a2a36_0_75%,#1e1e28_0)] lg:flex-1 lg:shrink">
            <div className="relative rounded-md shadow-2xl ring-1 ring-black/5">
              <canvas ref={canvasElRef} className="touch-none rounded-md" />
              <canvas
                ref={overlayElRef}
                width={canvasSize.w}
                height={canvasSize.h}
                onPointerDown={onOverlayPointerDown}
                onPointerMove={onOverlayPointerMove}
                onPointerUp={onOverlayPointerUp}
                onDoubleClick={() => tool === "polygon" && finishPolygon()}
                className={`absolute inset-0 h-full w-full rounded-md ${isMaskTool(tool) ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"}`}
                style={{ touchAction: "none", mixBlendMode: "normal" }}
              />
            </div>
          </div>

          <div ref={panelRef} className="max-h-none w-full shrink-0 overflow-visible rounded-xl border bg-panel/80 p-3 backdrop-blur lg:max-h-none lg:w-80 lg:overflow-y-auto">
            <Tabs value={panelTab} onValueChange={setPanelTab}>
              <TabsList className="grid h-auto w-full grid-cols-4 gap-1 sm:grid-cols-4 sm:gap-1">
                <TabsTrigger value="presets" className="h-9 px-2 text-[10px]"><Sparkles className="mr-1 h-3 w-3" />Patterns</TabsTrigger>
                <TabsTrigger value="tiling" className="h-9 px-2 text-[10px]"><Grid3x3 className="mr-1 h-3 w-3" />Tiling</TabsTrigger>
                <TabsTrigger value="layers" className="h-9 px-2 text-[10px]"><ArrowUp className="mr-1 h-3 w-3" />Layers</TabsTrigger>
                <TabsTrigger value="style" className="h-9 px-2 text-[10px]">Edit</TabsTrigger>
              </TabsList>

              {/* PATTERNS */}
              <TabsContent value="presets" className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground">Colors</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={patternColor} onChange={(e) => setPatternColor(e.target.value)} className="h-8 w-1/2 p-1" />
                    <Input type="color" value={patternBg} onChange={(e) => setPatternBg(e.target.value)} className="h-8 w-1/2 p-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Library</Label>
                  <div className="mt-1 grid grid-cols-4 gap-2">
                    {PATTERN_PRESETS.map((p) => (
                      <Tooltip key={p.id}>
                        <TooltipTrigger asChild>
                          <button onClick={() => applyPatternBg(p.id)}
                            className="aspect-square overflow-hidden rounded-md border bg-white transition hover:ring-2 hover:ring-primary">
                            <img src={patternToDataUrl(p, patternColor, patternBg)} alt={p.label} className="h-full w-full object-cover" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{p.label}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">Transform</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => flip("h")} className="h-8 text-[10px]"><FlipHorizontal2 className="mr-1.5 h-3 w-3" />Flip H</Button>
                    <Button variant="outline" size="sm" onClick={() => flip("v")} className="h-8 text-[10px]"><FlipHorizontal2 className="mr-1.5 h-3 w-3 rotate-90" />Flip V</Button>
                    <Button variant="outline" size="sm" onClick={groupObjects} className="h-8 text-[10px]">Group</Button>
                    <Button variant="outline" size="sm" onClick={ungroupObjects} className="h-8 text-[10px]">Ungroup</Button>
                  </div>
                </div>
              </TabsContent>

              {/* ADVANCED TILING */}
              <TabsContent value="tiling" className="space-y-4 pt-3">
                <p className="text-[11px] text-muted-foreground">Select any object on canvas and click <strong>Generate Pattern</strong> to create a seamless repeat.</p>
                <div className="space-y-3">
                  <SliderRow label="Repeat Count" value={tileRepeat} min={1} max={24} onChange={setTileRepeat} />
                  <SliderRow label="Horizontal Gap" value={tileGapX} min={0} max={100} onChange={setTileGapX} />
                  <SliderRow label="Vertical Gap" value={tileGapY} min={0} max={100} onChange={setTileGapY} />
                  <SliderRow label="Brick Offset" value={Math.round(tileOffset * 100)} min={0} max={100} onChange={(v) => setTileOffset(v / 100)} />
                </div>
                <Button className="w-full" onClick={applyAdvancedTiling}>
                  <Grid3x3 className="mr-2 h-4 w-4" /> Generate Pattern
                </Button>
              </TabsContent>

              {/* LAYERS PANEL */}
              <TabsContent value="layers" className="space-y-1 pt-3">
                <div className="max-h-[350px] overflow-y-auto space-y-1 pr-1">
                  {layers.map((obj, i) => (
                    <div key={i} className={`group flex items-center gap-2 rounded-md border p-2 transition ${selected === obj ? "border-primary bg-primary/5" : "bg-muted/10 hover:bg-muted/30"}`}>
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-white/50 border flex items-center justify-center">
                        <span className="text-[8px] font-mono text-muted-foreground">{obj.type.slice(0, 3).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-[10px] font-medium">{obj.type} Layer</div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => toggleVisibility(obj)} className={`p-1 hover:text-primary ${!obj.visible ? "text-destructive opacity-100" : ""}`}>
                          {obj.visible ? <ImageIcon className="h-3.5 w-3.5" /> : <Eraser className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => toggleLock(obj)} className={`p-1 hover:text-primary ${obj.lockMovementX ? "text-orange-500 opacity-100" : ""}`}>
                          {obj.lockMovementX ? <Box className="h-3.5 w-3.5" /> : <MousePointer2 className="h-3.5 w-3.5" />}
                        </button>
                        <div className="flex flex-col gap-0.5 ml-1">
                          <button onClick={() => moveLayer(obj, "up")} className="p-0.5 hover:bg-muted rounded"><ArrowUp className="h-2.5 w-2.5" /></button>
                          <button onClick={() => moveLayer(obj, "down")} className="p-0.5 hover:bg-muted rounded"><ArrowUp className="h-2.5 w-2.5 rotate-180" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {layers.length === 0 && <p className="text-center py-8 text-[11px] text-muted-foreground italic">No layers yet</p>}
                </div>
              </TabsContent>

              {/* STYLE / RECOLOR / FILTERS */}
              <TabsContent value="style" className="space-y-4 pt-3">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">Quick Filters</Label>
                    <SliderRow label="Opacity" value={opacity} min={0} max={100} onChange={setOpacity} />
                    <SliderRow label="Hue" value={hue} min={-180} max={180} onChange={setHue} />
                    <SliderRow label="Contrast" value={contrast} min={-100} max={100} onChange={setContrast} />
                    <SliderRow label="Blur" value={blur} min={0} max={100} onChange={setBlur} />
                  </div>
                  
                  <div className="rounded-lg border bg-muted/20 p-2 space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Color Replace</Label>
                    <div className="flex items-center gap-2">
                      <Input type="color" value={replaceFrom} onChange={(e) => setReplaceFrom(e.target.value)} className="h-7 w-1/2 p-1" />
                      <span className="text-[10px]">→</span>
                      <Input type="color" value={replaceTo} onChange={(e) => setReplaceTo(e.target.value)} className="h-7 w-1/2 p-1" />
                    </div>
                    <Button size="sm" variant="outline" className="w-full h-8 text-[10px]" onClick={runColorReplace}>Replace</Button>
                  </div>

                  {/* SELECTION ACTIONS */}
                  <div className="rounded-lg border bg-accent/10 p-2 space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                      <Lasso className="h-3 w-3" /> Selection Tools
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-[10px]" 
                        disabled={!hasSelection}
                        onClick={() => applyInsideSelection("color")}>
                        Fill selection
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-[10px] text-destructive hover:text-destructive" 
                        disabled={!hasSelection}
                        onClick={() => {
                          const m = maskRef.current; if (!m) return;
                          const url = m.exportSoftMask({ feather: 0, opacity: 1, expand: 0 });
                          const img = new Image();
                          img.onload = () => {
                            const fImg = new fabric.FabricImage(img);
                            fImg.set({ left: 0, top: 0, globalCompositeOperation: "destination-out", selectable: false, evented: false });
                            canvasRef.current?.add(fImg);
                            canvasRef.current?.renderAll();
                            emit();
                            toast.success("Area erased");
                          };
                          img.src = url;
                        }}>
                        Erase selection
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-7 flex-1 text-[9px]" onClick={invertSelection}>Invert</Button>
                      <Button size="sm" variant="ghost" className="h-7 flex-1 text-[9px]" onClick={clearSelection}>Clear</Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Mobile quick navigation */}
        <div className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-2 gap-2 sm:hidden">
          <button
            type="button"
            onClick={openCanvas}
            aria-label="Back to canvas"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border bg-background/95 px-4 text-sm font-medium text-foreground shadow-lg backdrop-blur transition active:scale-95"
          >
            <ArrowUp className="h-4 w-4" />
            Canvas
          </button>
          <button
            type="button"
            onClick={openPatterns}
            aria-label="Open patterns"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg ring-1 ring-black/10 transition active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            Patterns
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}

function ToolBtn({ label, children, onClick, variant = "ghost" }: { label: string; children: React.ReactNode; onClick: () => void; variant?: "ghost" | "default" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><Button size="sm" variant={variant} onClick={onClick} className="h-9 w-full shrink-0 px-0 sm:w-auto sm:px-3">{children}</Button></TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
function Sep() { return <div className="hidden sm:block mx-1 h-6 w-px shrink-0 bg-border" />; }

function SliderRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}