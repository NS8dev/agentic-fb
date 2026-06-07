import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Pencil, Upload, X, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { CoinCostBadge } from "@/components/fabrixa/CoinCostBadge";
import { useRunGated } from "@/lib/fabrixa/runGated";
import { generateImage, enhancePrompt } from "@/lib/fabrixa/ai";
import type { GeneratedDesign } from "./AIHistoryGrid";

interface SketchToDesignPanelProps {
  onGenerated: (design: GeneratedDesign) => void;
  initialReference?: string | null;
}

export function SketchToDesignPanel({ onGenerated, initialReference }: SketchToDesignPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(initialReference ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const runGated = useRunGated();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setReferenceImage(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleEnhance = async () => {
    const base = prompt.trim() || "Convert sketch to seamless textile pattern";
    await runGated("AI_PROMPT_ENHANCE", async () => {
      setIsEnhancing(true);
      try {
        const enhanced = await enhancePrompt(base);
        setPrompt(enhanced);
        toast.success("Brief enhanced!");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Enhance failed");
      } finally {
        setIsEnhancing(false);
      }
    });
  };

  const handleGenerate = async () => {
    if (!referenceImage) {
      toast.error("Upload a sketch or reference image.");
      return;
    }
    await runGated("AI_SKETCH_TO_DESIGN", async () => {
      setIsGenerating(true);
      try {
        const effectivePrompt =
          prompt.trim() ||
          "Convert this sketch into a polished seamless textile pattern for garment printing.";
        const result = await generateImage({
          prompt: effectivePrompt,
          task: "sketchToDesign",
          referenceImage,
        });
        onGenerated({
          id: Date.now().toString(),
          url: result.dataUrl,
          prompt: effectivePrompt,
          task: "sketchToDesign",
        });
        toast.success("Sketch converted to pattern!");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Generation failed");
      } finally {
        setIsGenerating(false);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Pencil className="h-4 w-4 text-primary" /> Sketch to Design
        </h3>
        <p className="text-xs text-muted-foreground">
          Upload a sketch — AI refines it into a production-ready seamless pattern.
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sketch / Reference (Required)
        </Label>
        {referenceImage ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10">
            <img src={referenceImage} alt="Sketch" className="h-full w-full object-cover" />
            <Button
              size="icon"
              variant="destructive"
              className="absolute right-2 top-2 h-7 w-7 rounded-full"
              onClick={() => setReferenceImage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-background/30 py-8 transition hover:bg-muted/50"
          >
            <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Upload sketch or reference</span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Design Brief (Optional)
        </Label>
        <Textarea
          placeholder="e.g., refine into jacquard-style floral, keep motif scale medium..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[80px] resize-none bg-background/50"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={handleEnhance} disabled={isEnhancing}>
          {isEnhancing ? "Enhancing..." : "Enhance Brief"}
          <CoinCostBadge feature="AI_PROMPT_ENHANCE" />
        </Button>
        <Button
          className="flex-1 bg-gradient-to-r from-primary to-accent"
          onClick={handleGenerate}
          disabled={isGenerating || !referenceImage}
        >
          {isGenerating ? "Converting..." : "Convert Sketch"}
          <CoinCostBadge feature="AI_SKETCH_TO_DESIGN" />
        </Button>
      </div>
    </div>
  );
}
