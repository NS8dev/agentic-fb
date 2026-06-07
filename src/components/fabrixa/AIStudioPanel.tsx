import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image as ImageIcon, Sparkles } from "lucide-react";
import { TextToDesignPanel } from "@/components/fabrixa/ai/TextToDesignPanel";
import { SketchToDesignPanel } from "@/components/fabrixa/ai/SketchToDesignPanel";
import { SmartPalettePanel } from "@/components/fabrixa/ai/SmartPalettePanel";
import { LookbookPanel } from "@/components/fabrixa/ai/LookbookPanel";
import { AIHistoryGrid, type GeneratedDesign } from "@/components/fabrixa/ai/AIHistoryGrid";

export type AIStudioTab = "text" | "sketch" | "palette" | "lookbook";

interface AIStudioPanelProps {
  balance: number;
  initialTab?: AIStudioTab;
  designReference?: string | null;
  textureImage?: string | null;
  garmentType?: string;
  onResult: (url: string, meta: Record<string, unknown>, action: "apply_3d" | "edit_2d") => void;
  onApplyColor?: (hex: string) => void;
  onSaveColorway?: (colors: string[], names?: string[]) => void;
}

export function AIStudioPanel({
  initialTab = "text",
  designReference,
  textureImage,
  garmentType = "garment",
  onResult,
  onApplyColor,
  onSaveColorway,
}: AIStudioPanelProps) {
  const [tab, setTab] = useState<AIStudioTab>(initialTab);
  const [history, setHistory] = useState<GeneratedDesign[]>([]);
  const [sketchRef, setSketchRef] = useState<string | null>(null);

  const addToHistory = (design: GeneratedDesign) => {
    setHistory((prev) => [design, ...prev]);
  };

  const handleApply3d = (design: GeneratedDesign) => {
    onResult(
      design.url,
      { task: design.task ?? "pattern", prompt: design.prompt, model: "ai" },
      "apply_3d",
    );
  };

  const handleEdit2d = (design: GeneratedDesign) => {
    onResult(
      design.url,
      { task: design.task ?? "pattern", prompt: design.prompt, model: "ai" },
      "edit_2d",
    );
  };

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6 lg:flex-row">
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[420px]">
        <div>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Sparkles className="h-5 w-5 text-primary" /> AI Studio
          </h2>
          <p className="text-sm text-muted-foreground">
            Textile-native AI tools — seamless patterns, palettes, and lookbook renders.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as AIStudioTab)} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-panel/50 p-1 lg:grid-cols-4">
            <TabsTrigger value="text" className="text-[10px] sm:text-xs">
              Text to Design
            </TabsTrigger>
            <TabsTrigger value="sketch" className="text-[10px] sm:text-xs">
              Sketch to Design
            </TabsTrigger>
            <TabsTrigger value="palette" className="text-[10px] sm:text-xs">
              Smart Palette
            </TabsTrigger>
            <TabsTrigger value="lookbook" className="text-[10px] sm:text-xs">
              Lookbook
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 rounded-2xl border border-white/10 bg-panel/40 p-4 shadow-lg backdrop-blur-xl">
            <TabsContent value="text" className="mt-0">
              <TextToDesignPanel onGenerated={addToHistory} />
            </TabsContent>
            <TabsContent value="sketch" className="mt-0">
              <SketchToDesignPanel
                onGenerated={addToHistory}
                initialReference={sketchRef ?? designReference}
              />
            </TabsContent>
            <TabsContent value="palette" className="mt-0">
              <SmartPalettePanel
                designReference={designReference}
                onApplyColor={onApplyColor ?? (() => {})}
                onSaveColorway={onSaveColorway}
              />
            </TabsContent>
            <TabsContent value="lookbook" className="mt-0">
              <LookbookPanel textureImage={textureImage ?? null} garmentType={garmentType} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel/20 p-4 shadow-inner backdrop-blur-xl">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <ImageIcon className="h-4 w-4" /> Your Generations
        </h3>
        <AIHistoryGrid
          history={history}
          onUseAsRef={(url) => {
            setSketchRef(url);
            setTab("sketch");
          }}
          onApply3d={handleApply3d}
          onEdit2d={handleEdit2d}
        />
      </div>
    </div>
  );
}
