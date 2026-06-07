import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { CoinCostBadge } from "@/components/fabrixa/CoinCostBadge";
import { useRunGated } from "@/lib/fabrixa/runGated";
import { generateImage, enhancePrompt } from "@/lib/fabrixa/ai";
import type { GeneratedDesign } from "./AIHistoryGrid";

interface TextToDesignPanelProps {
  onGenerated: (design: GeneratedDesign) => void;
}

export function TextToDesignPanel({ onGenerated }: TextToDesignPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const runGated = useRunGated();

  const handleEnhance = async () => {
    if (!prompt.trim()) {
      toast.error("Enter a prompt to enhance.");
      return;
    }
    await runGated("AI_PROMPT_ENHANCE", async () => {
      setIsEnhancing(true);
      try {
        const enhanced = await enhancePrompt(prompt);
        setPrompt(enhanced);
        toast.success("Prompt enhanced!");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Enhance failed");
      } finally {
        setIsEnhancing(false);
      }
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please describe your pattern.");
      return;
    }
    await runGated("AI_TEXT_TO_DESIGN", async () => {
      setIsGenerating(true);
      try {
        const result = await generateImage({ prompt, task: "textToDesign" });
        onGenerated({
          id: Date.now().toString(),
          url: result.dataUrl,
          prompt,
          task: "textToDesign",
        });
        toast.success("Pattern generated!");
        setPrompt("");
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
          <Sparkles className="h-4 w-4 text-primary" /> Text to Design
        </h3>
        <p className="text-xs text-muted-foreground">
          Describe a seamless textile pattern — AI generates a tileable fabric design.
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Prompt
        </Label>
        <Textarea
          placeholder="e.g., seamless Art Deco geometric pattern in gold and navy, medium scale repeat..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[100px] resize-none bg-background/50 backdrop-blur-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleEnhance}
          disabled={isEnhancing || !prompt.trim()}
        >
          {isEnhancing ? "Enhancing..." : "Enhance Prompt"}
          <CoinCostBadge feature="AI_PROMPT_ENHANCE" />
        </Button>
        <Button
          className="flex-1 bg-gradient-to-r from-primary to-accent"
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
        >
          {isGenerating ? "Generating..." : "Generate"}
          <CoinCostBadge feature="AI_TEXT_TO_DESIGN" />
        </Button>
      </div>
    </div>
  );
}
