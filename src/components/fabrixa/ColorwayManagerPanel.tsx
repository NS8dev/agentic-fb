import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Layers,
  Plus,
  Copy,
  Trash2,
  Check,
  Flame,
  Snowflake,
  Shuffle,
  Sparkles,
  RotateCcw,
  Loader2,
  Palette
} from "lucide-react";
import { toast } from "sonner";
import type { Colorway, ProjectColorways } from "@/lib/fabrixa/colorway/colorwayManager";
import type { PartState } from "@/lib/fabrixa/garments";
import { useRunGated } from "@/lib/fabrixa/runGated";
import { smartPalette } from "@/lib/fabrixa/ai";
import {
  extractPlates,
  generateAlgorithmicPalettes,
  generateHarmoniousPalette
} from "@/lib/fabrixa/imageProcessing/colorTheoryUtils";
import { recolorTexture } from "@/lib/fabrixa/imageProcessing/patternRecolor";
import { CoinCostBadge } from "@/components/fabrixa/CoinCostBadge";

interface ColorwayManagerPanelProps {
  state: ProjectColorways;
  onCreate: () => void;
  onApply: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  // Non-destructive Recolor props
  activePartKey: string;
  activePartState: PartState;
  updateActivePart: (patch: Partial<PartState>) => void;
}

export function ColorwayManagerPanel({
  state,
  onCreate,
  onApply,
  onDuplicate,
  onDelete,
  onRename,
  activePartKey,
  activePartState,
  updateActivePart
}: ColorwayManagerPanelProps) {
  const [styleBrief, setStyleBrief] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSwatchIndex, setActiveSwatchIndex] = useState<number>(0);
  const runGated = useRunGated();
  const lastRecoloredUrlRef = useRef<string | null>(null);

  // Hook for automatic color plate extraction from the active texture
  useEffect(() => {
    const textureUrl = activePartState?.textureDataUrl;
    if (!textureUrl) {
      if (activePartState?.originalTextureUrl || activePartState?.derivedPalette) {
        updateActivePart({
          originalTextureUrl: null,
          derivedPalette: null
        });
      }
      return;
    }

    const isRecolored = textureUrl === lastRecoloredUrlRef.current;
    const hasOriginal = !!activePartState?.originalTextureUrl;

    // Reset if a brand new image texture is applied over an existing one
    if (hasOriginal && !isRecolored && textureUrl !== activePartState.originalTextureUrl) {
      updateActivePart({
        originalTextureUrl: null,
        derivedPalette: null
      });
      lastRecoloredUrlRef.current = null;
      return;
    }

    // Extract colors if not already extracted
    if (!activePartState?.originalTextureUrl) {
      let active = true;
      const runExtract = async () => {
        try {
          const colors = await extractPlates(textureUrl, 5);
          if (active) {
            updateActivePart({
              originalTextureUrl: textureUrl,
              derivedPalette: colors
            });
          }
        } catch (e) {
          console.error("Failed to extract color plates:", e);
        }
      };
      runExtract();
      return () => {
        active = false;
      };
    }
  }, [activePartState?.textureDataUrl, activePartState?.originalTextureUrl, activePartKey]);

  // Recolor the texture with a target palette
  const handleRecolor = async (newPalette: string[], label = "Recolored") => {
    const sourceUrl = activePartState?.originalTextureUrl;
    const originalPlates = activePartState?.derivedPalette;
    if (!sourceUrl || !originalPlates || originalPlates.length === 0) {
      toast.error("No active pattern texture to recolor.");
      return;
    }

    setIsProcessing(true);
    try {
      const canvas = await recolorTexture(sourceUrl, originalPlates, newPalette);
      const dataUrl = canvas.toDataURL("image/png");
      lastRecoloredUrlRef.current = dataUrl;
      updateActivePart({
        textureDataUrl: dataUrl,
        derivedPalette: newPalette
      });
      toast.success(`${label} applied successfully!`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to recolor pattern texture.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Perform algorithmic shift (Warm, Cool, or Analogous)
  const handleAlgorithmicShift = (type: "warm" | "cool" | "analogous") => {
    const currentPlates = activePartState?.derivedPalette;
    if (!currentPlates || currentPlates.length === 0) {
      toast.error("Select a part with an active pattern texture first.");
      return;
    }
    const shifted = generateAlgorithmicPalettes(currentPlates, type);
    const labelMap = { warm: "Warm shift", cool: "Cool shift", analogous: "Analogous shift" };
    void handleRecolor(shifted, labelMap[type]);
  };

  // Perform HSL-rotation-based harmonic recoloring
  const handleHarmonicRecolor = (mode: "triadic" | "complementary" | "split-complementary") => {
    const currentPlates = activePartState?.derivedPalette;
    if (!currentPlates || currentPlates.length === 0) {
      toast.error("Select a part with an active pattern texture first.");
      return;
    }
    const baseColor = currentPlates[Math.min(activeSwatchIndex, currentPlates.length - 1)] || currentPlates[0] || "#ffffff";
    const newPalette = generateHarmoniousPalette(baseColor, mode, currentPlates.length);
    const labelMap = {
      triadic: "Triadic harmony",
      complementary: "Complementary harmony",
      "split-complementary": "Split-Complementary harmony"
    };
    void handleRecolor(newPalette, labelMap[mode]);
  };

  // Trigger AI smart palette extraction
  const handleAiRecolor = async () => {
    const sourceUrl = activePartState?.originalTextureUrl || activePartState?.textureDataUrl;
    if (!sourceUrl) {
      toast.error("Upload or apply a pattern design to recolor with AI.");
      return;
    }
    if (!styleBrief.trim()) {
      toast.error("Please enter a style brief or theme description.");
      return;
    }

    await runGated("AI_SMART_PALETTE", async () => {
      setIsProcessing(true);
      try {
        const result = await smartPalette({ referenceImage: sourceUrl, styleBrief });
        if (result.colors && result.colors.length > 0) {
          await handleRecolor(result.colors, `AI Recolor ("${styleBrief}")`);
        } else {
          toast.error("AI returned an empty palette.");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "AI palette generation failed.");
      } finally {
        setIsProcessing(false);
      }
    });
  };

  // Restore the original un-recolored pattern
  const handleRevert = () => {
    if (activePartState.originalTextureUrl) {
      updateActivePart({
        textureDataUrl: activePartState.originalTextureUrl,
        originalTextureUrl: null,
        derivedPalette: null
      });
      lastRecoloredUrlRef.current = null;
      toast.success("Reverted to original design.");
    }
  };

  // Update a single swatch color manually
  const handleSwatchColorChange = (index: number, nextColor: string) => {
    const currentPlates = activePartState?.derivedPalette;
    if (!currentPlates) return;
    const nextPalette = [...currentPlates];
    nextPalette[index] = nextColor;
    void handleRecolor(nextPalette, "Manual adjustment");
  };

  const hasModifications =
    activePartState?.originalTextureUrl &&
    activePartState?.originalTextureUrl !== activePartState?.textureDataUrl;

  return (
    <div className="space-y-4">
      {/* SECTION 1: COLORWAYS LIST */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Layers className="h-3.5 w-3.5" /> Colorways
          </Label>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onCreate}>
            <Plus className="h-3 w-3" /> New
          </Button>
        </div>
        {state.colorways.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Save garment color/texture variants and switch between them instantly.
          </p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {state.colorways.map((cw) => (
              <ColorwayRow
                key={cw.id}
                colorway={cw}
                active={state.activeColorwayId === cw.id}
                onApply={() => onApply(cw.id)}
                onDuplicate={() => onDuplicate(cw.id)}
                onDelete={() => onDelete(cw.id)}
                onRename={(name) => onRename(cw.id, name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: PATTERN RECOLOR ENGINE */}
      {activePartState?.textureDataUrl && activePartState?.derivedPalette && (
        <div className="rounded-xl border border-white/10 bg-background/20 p-3 space-y-3 shadow-inner">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Palette className="h-3.5 w-3.5 text-primary" /> Pattern Recolor
            </Label>
            {hasModifications && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-1.5 text-[10px] text-destructive hover:bg-destructive/10"
                onClick={handleRevert}
                disabled={isProcessing}
              >
                <RotateCcw className="h-3 w-3" /> Revert
              </Button>
            )}
          </div>

          {/* Color Plate Swatches */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Hero Color Selector (Click to set base / Edit)
            </div>
            <div className="flex flex-wrap gap-2">
              {activePartState.derivedPalette.map((hex, i) => (
                <div key={`${hex}-${i}`} className="group relative">
                  <input
                    type="color"
                    value={hex}
                    onChange={(e) => handleSwatchColorChange(i, e.target.value)}
                    onFocus={() => setActiveSwatchIndex(i)}
                    onClick={() => setActiveSwatchIndex(i)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    title={`Edit Plate ${i + 1} (${hex})`}
                    disabled={isProcessing}
                  />
                  <div
                    className={`h-8 w-8 rounded-full border shadow-md transition-all duration-200 hover:scale-110 active:scale-95 ${
                      activeSwatchIndex === i
                        ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                        : "border-white/20"
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Algorithmic variation controls */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Algorithmic Shifts
            </div>
            <div className="grid grid-cols-3 gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1 bg-background/50 hover:bg-primary/10 hover:border-primary/30"
                onClick={() => handleAlgorithmicShift("warm")}
                disabled={isProcessing}
              >
                <Flame className="h-3 w-3 text-orange-400" /> Warm
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1 bg-background/50 hover:bg-primary/10 hover:border-primary/30"
                onClick={() => handleAlgorithmicShift("cool")}
                disabled={isProcessing}
              >
                <Snowflake className="h-3 w-3 text-blue-400" /> Cool
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1 bg-background/50 hover:bg-primary/10 hover:border-primary/30"
                onClick={() => handleAlgorithmicShift("analogous")}
                disabled={isProcessing}
              >
                <Shuffle className="h-3 w-3 text-purple-400" /> Analog
              </Button>
            </div>
          </div>

          {/* AI Theme generator input */}
          <div className="space-y-1.5 pt-1 border-t border-white/5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary animate-pulse" /> AI Recolor Theme
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="e.g. Vintage Earth, Tokyo Neon..."
                value={styleBrief}
                onChange={(e) => setStyleBrief(e.target.value)}
                className="h-7 text-xs bg-background/40 border-white/10 flex-1"
                disabled={isProcessing}
              />
              <Button
                size="sm"
                className="h-7 px-2 text-[10px] font-semibold gap-1 shrink-0 relative"
                onClick={handleAiRecolor}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>Recolor <CoinCostBadge feature="AI_SMART_PALETTE" className="relative ml-0.5 top-0" /></>
                )}
              </Button>
            </div>
          </div>

          {/* Harmonic Palettes Section */}
          <div className="space-y-1.5 pt-2 border-t border-white/5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Palette className="h-3 w-3 text-primary" /> Harmonic Palettes (HSL)
            </div>
            <div className="grid grid-cols-3 gap-1">
              <Button
                size="sm"
                className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90 text-white border-0 shadow-sm h-7 text-[10px] font-medium gap-1"
                onClick={() => handleHarmonicRecolor("triadic")}
                disabled={isProcessing}
              >
                Triadic
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90 text-white border-0 shadow-sm h-7 text-[10px] font-medium gap-1"
                onClick={() => handleHarmonicRecolor("complementary")}
                disabled={isProcessing}
              >
                Complementary
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90 text-white border-0 shadow-sm h-7 text-[10px] font-medium gap-1"
                onClick={() => handleHarmonicRecolor("split-complementary")}
                disabled={isProcessing}
              >
                Split-Comp
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ColorwayRow({
  colorway,
  active,
  onApply,
  onDuplicate,
  onDelete,
  onRename
}: {
  colorway: Colorway;
  active: boolean;
  onApply: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  return (
    <div
      className={`rounded-lg border p-2 ${
        active ? "border-primary bg-primary/10 shadow" : "border-white/10 bg-background/30"
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <Input
          defaultValue={colorway.name}
          className="h-6 flex-1 text-xs border-transparent bg-transparent focus-visible:bg-background/80"
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== colorway.name) {
              onRename(e.target.value.trim());
            }
          }}
        />
        {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
      </div>
      {colorway.palette && colorway.palette.length > 0 && (
        <div className="mb-2 flex gap-1">
          {colorway.palette.slice(0, 6).map((hex) => (
            <div
              key={hex}
              className="h-4.5 w-4.5 rounded-full border border-white/10"
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant={active ? "secondary" : "default"}
          className="h-6.5 flex-1 text-[10px]"
          onClick={onApply}
        >
          Apply
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6.5 px-2 hover:bg-white/5"
          onClick={onDuplicate}
          title="Duplicate"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6.5 px-2 text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
