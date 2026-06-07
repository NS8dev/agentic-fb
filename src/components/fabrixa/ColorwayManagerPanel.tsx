import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layers, Plus, Copy, Trash2, Check } from "lucide-react";
import type { Colorway, ProjectColorways } from "@/lib/fabrixa/colorway/colorwayManager";

interface ColorwayManagerPanelProps {
  state: ProjectColorways;
  onCreate: () => void;
  onApply: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export function ColorwayManagerPanel({
  state,
  onCreate,
  onApply,
  onDuplicate,
  onDelete,
  onRename,
}: ColorwayManagerPanelProps) {
  return (
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
        <div className="space-y-2">
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
  );
}

function ColorwayRow({
  colorway,
  active,
  onApply,
  onDuplicate,
  onDelete,
  onRename,
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
      className={`rounded-lg border p-2 ${active ? "border-primary bg-primary/10" : "border-white/10 bg-background/30"}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Input
          defaultValue={colorway.name}
          className="h-7 flex-1 text-xs"
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== colorway.name) {
              onRename(e.target.value.trim());
            }
          }}
        />
        {active && <Check className="h-3.5 w-3.5 text-primary" />}
      </div>
      {colorway.palette && colorway.palette.length > 0 && (
        <div className="mb-2 flex gap-1">
          {colorway.palette.slice(0, 6).map((hex) => (
            <div
              key={hex}
              className="h-4 w-4 rounded-sm border border-white/10"
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={active ? "secondary" : "default"}
          className="h-7 flex-1 text-[10px]"
          onClick={onApply}
        >
          Apply
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={onDuplicate}
          title="Duplicate"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-destructive"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
