import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Image as ImageIcon, Shirt, Wand2, Copy } from "lucide-react";

export interface GeneratedDesign {
  id: string;
  url: string;
  prompt: string;
  task?: string;
}

interface AIHistoryGridProps {
  history: GeneratedDesign[];
  onUseAsRef?: (url: string) => void;
  onApply3d: (design: GeneratedDesign) => void;
  onEdit2d: (design: GeneratedDesign) => void;
}

export function AIHistoryGrid({ history, onUseAsRef, onApply3d, onEdit2d }: AIHistoryGridProps) {
  if (history.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center opacity-50">
        <ImageIcon className="mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Generated designs will appear here.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 pr-4">
      <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2 xl:grid-cols-3">
        {history.map((design) => (
          <div
            key={design.id}
            className="group relative overflow-hidden rounded-xl border border-white/10 bg-background/50 shadow-sm transition-all hover:shadow-md"
          >
            <div className="aspect-square w-full overflow-hidden bg-muted">
              <img
                src={design.url}
                alt={design.prompt}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
            </div>
            <div className="space-y-2 bg-panel/80 p-3 backdrop-blur-md">
              <p className="line-clamp-2 text-xs text-muted-foreground" title={design.prompt}>
                &ldquo;{design.prompt}&rdquo;
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {onUseAsRef && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 flex-1 px-2 text-[10px]"
                    onClick={() => onUseAsRef(design.url)}
                    title="Use as reference"
                  >
                    <Copy className="mr-1 h-3 w-3" /> Use as Ref
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-8 flex-1 bg-primary/20 px-2 text-[10px] text-primary hover:bg-primary/30"
                  onClick={() => onApply3d(design)}
                >
                  <Shirt className="mr-1 h-3 w-3" /> To 3D
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 flex-1 px-2 text-[10px]"
                  onClick={() => onEdit2d(design)}
                >
                  <Wand2 className="mr-1 h-3 w-3" /> To 2D
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
