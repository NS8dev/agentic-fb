import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Palette, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { CoinCostBadge } from "@/components/fabrixa/CoinCostBadge";
import { useRunGated } from "@/lib/fabrixa/runGated";
import { smartPalette } from "@/lib/fabrixa/ai";

interface SmartPalettePanelProps {
  designReference?: string | null;
  onApplyColor: (hex: string) => void;
  onSaveColorway?: (colors: string[], names?: string[]) => void;
}

export function SmartPalettePanel({
  designReference,
  onApplyColor,
  onSaveColorway,
}: SmartPalettePanelProps) {
  const [referenceImage, setReferenceImage] = useState<string | null>(designReference ?? null);
  const [styleBrief, setStyleBrief] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const handleExtract = async () => {
    const ref = referenceImage ?? designReference;
    if (!ref) {
      toast.error("Upload or provide a design reference image.");
      return;
    }
    await runGated("AI_SMART_PALETTE", async () => {
      setIsLoading(true);
      try {
        const result = await smartPalette({ referenceImage: ref, styleBrief });
        setColors(result.colors);
        setNames(result.names ?? []);
        toast.success(`Extracted ${result.colors.length} colors`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Palette extraction failed");
      } finally {
        setIsLoading(false);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Palette className="h-4 w-4 text-primary" /> Smart Palette
        </h3>
        <p className="text-xs text-muted-foreground">
          AI extracts a harmonized color palette from your design for consistent colorways.
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Reference Image
        </Label>
        {referenceImage || designReference ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10">
            <img
              src={referenceImage ?? designReference!}
              alt="Reference"
              className="h-full w-full object-cover"
            />
            {referenceImage && (
              <Button
                size="icon"
                variant="destructive"
                className="absolute right-2 top-2 h-7 w-7 rounded-full"
                onClick={() => setReferenceImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-background/30 py-6 transition hover:bg-muted/50"
          >
            <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Upload design reference</span>
          </div>
        )}
        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Style Direction (Optional)
        </Label>
        <Textarea
          placeholder="e.g., autumn earth tones, luxury metallic accents..."
          value={styleBrief}
          onChange={(e) => setStyleBrief(e.target.value)}
          className="min-h-[60px] resize-none bg-background/50"
        />
      </div>
      <Button className="w-full" onClick={handleExtract} disabled={isLoading}>
        {isLoading ? "Extracting..." : "Extract Palette"}
        <CoinCostBadge feature="AI_SMART_PALETTE" />
      </Button>
      {colors.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Palette Swatches
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {colors.map((hex, i) => (
              <button
                key={hex + i}
                type="button"
                className="group flex flex-col items-center gap-1 rounded-lg border border-white/10 p-2 transition hover:border-primary"
                onClick={() => {
                  onApplyColor(hex);
                  toast.success(`Applied ${hex}`);
                }}
                title={`Apply ${hex}`}
              >
                <div
                  className="h-10 w-full rounded-md border border-white/10 shadow-inner"
                  style={{ backgroundColor: hex }}
                />
                <span className="text-[10px] font-mono text-muted-foreground">{hex}</span>
                {names[i] && (
                  <span className="text-[9px] text-muted-foreground">{names[i]}</span>
                )}
              </button>
            ))}
          </div>
          {onSaveColorway && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onSaveColorway(colors, names);
                toast.success("Saved as colorway");
              }}
            >
              Save as Colorway
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
