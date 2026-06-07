import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Download } from "lucide-react";
import { toast } from "sonner";
import { CoinCostBadge } from "@/components/fabrixa/CoinCostBadge";
import { useRunGated } from "@/lib/fabrixa/runGated";
import { generateLookbook } from "@/lib/fabrixa/ai";

interface LookbookPanelProps {
  textureImage: string | null;
  garmentType: string;
}

export function LookbookPanel({ textureImage, garmentType }: LookbookPanelProps) {
  const [gender, setGender] = useState<"woman" | "man">("woman");
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [isGeneratingFront, setIsGeneratingFront] = useState(false);
  const [isGeneratingBack, setIsGeneratingBack] = useState(false);
  const runGated = useRunGated();

  const download = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  const handleGenerateFront = async () => {
    if (!textureImage) {
      toast.error("Apply a design to the garment first.");
      return;
    }
    await runGated("AI_LOOKBOOK_RENDER", async () => {
      setIsGeneratingFront(true);
      try {
        const result = await generateLookbook({
          textureImage,
          garmentType,
          gender,
          view: "front",
        });
        setFrontUrl(result.dataUrl);
        toast.success("Front lookbook render ready!");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Front render failed");
      } finally {
        setIsGeneratingFront(false);
      }
    });
  };

  const handleGenerateBack = async () => {
    if (!textureImage) {
      toast.error("Apply a design to the garment first.");
      return;
    }
    await runGated("AI_LOOKBOOK_RENDER", async () => {
      setIsGeneratingBack(true);
      try {
        const result = await generateLookbook({
          textureImage,
          garmentType,
          gender,
          view: "back",
          priorFrontImage: frontUrl ?? undefined,
        });
        setBackUrl(result.dataUrl);
        toast.success("Back lookbook render ready!");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Back render failed");
      } finally {
        setIsGeneratingBack(false);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4 text-primary" /> Lookbook
        </h3>
        <p className="text-xs text-muted-foreground">
          Generate faceless model photos wearing your exact garment texture — front and back views.
        </p>
      </div>
      {!textureImage && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Apply a design to the garment in 3D Preview first — texture will be used as reference.
        </p>
      )}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Model
        </Label>
        <Select value={gender} onValueChange={(v) => setGender(v as "woman" | "man")}>
          <SelectTrigger className="bg-background/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="woman">Woman</SelectItem>
            <SelectItem value="man">Man</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={handleGenerateFront}
          disabled={isGeneratingFront || !textureImage}
        >
          {isGeneratingFront ? "Rendering..." : "Front View"}
          <CoinCostBadge feature="AI_LOOKBOOK_RENDER" />
        </Button>
        <Button
          className="flex-1"
          variant="outline"
          onClick={handleGenerateBack}
          disabled={isGeneratingBack || !textureImage}
        >
          {isGeneratingBack ? "Rendering..." : "Back View"}
          <CoinCostBadge feature="AI_LOOKBOOK_RENDER" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase text-muted-foreground">Front</Label>
          <div className="aspect-[3/4] overflow-hidden rounded-xl border border-white/10 bg-muted">
            {frontUrl ? (
              <img src={frontUrl} alt="Front lookbook" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Not generated
              </div>
            )}
          </div>
          {frontUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => download(frontUrl, "lookbook-front.png")}
            >
              <Download className="mr-1 h-3 w-3" /> Download
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase text-muted-foreground">Back</Label>
          <div className="aspect-[3/4] overflow-hidden rounded-xl border border-white/10 bg-muted">
            {backUrl ? (
              <img src={backUrl} alt="Back lookbook" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Not generated
              </div>
            )}
          </div>
          {backUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => download(backUrl, "lookbook-back.png")}
            >
              <Download className="mr-1 h-3 w-3" /> Download
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
