import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Eye, EyeOff, Lock, Unlock, Pencil, Trash2, Link2, Unlink,
  ChevronUp, ChevronDown, Plus, Layers, Palette,
} from "lucide-react";
import type { DesignLayer } from "@/lib/fabrixa/garments";
import { newLinkGroupId } from "@/lib/fabrixa/layerUtils";

export interface PartOption {
  key: string;
  label: string;
  layers: DesignLayer[];
}

interface Props {
  layers: DesignLayer[];
  activeLayerId: string | null;
  activePartKey: string;
  selectionMaskDataUrl: string | null;
  partLabel: string;
  allParts: PartOption[];
  onSelectLayer: (id: string | null) => void;
  onEditLayer: (id: string) => void;
  onLayersChange: (layers: DesignLayer[]) => void;
  onCreateFromSelection: () => void;
  onClearSelection: () => void;
}

export function LayersPanel3D({
  layers,
  activeLayerId,
  activePartKey,
  selectionMaskDataUrl,
  partLabel,
  allParts,
  onSelectLayer,
  onEditLayer,
  onLayersChange,
  onCreateFromSelection,
  onClearSelection,
}: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [linkTargetPart, setLinkTargetPart] = useState("");
  const [linkTargetLayer, setLinkTargetLayer] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const updateLayer = (id: string, patch: Partial<DesignLayer>) => {
    onLayersChange(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const moveLayer = (id: string, dir: -1 | 1) => {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= layers.length) return;
    const copy = [...layers];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    onLayersChange(copy);
  };

  const deleteLayer = (id: string) => {
    const layer = layers.find((l) => l.id === id);
    if (layer?.locked) return;
    const next = layers.filter((l) => l.id !== id);
    onLayersChange(next);
    if (activeLayerId === id) onSelectLayer(null);
  };

  const openLinkDialog = (layerId: string) => {
    setLinkSourceId(layerId);
    setLinkTargetPart("");
    setLinkTargetLayer("");
    setLinkOpen(true);
  };

  const confirmLink = () => {
    if (!linkSourceId || !linkTargetPart || !linkTargetLayer) return;
    const source = layers.find((l) => l.id === linkSourceId);
    const targetPart = allParts.find((p) => p.key === linkTargetPart);
    const target = targetPart?.layers.find((l) => l.id === linkTargetLayer);
    if (!source || !target) return;

    const gid = source.linkedGroupId ?? target.linkedGroupId ?? newLinkGroupId();
    const updatedSource = layers.map((l) =>
      l.id === linkSourceId ? { ...l, linkedGroupId: gid } : l,
    );
    onLayersChange(updatedSource);

    // Parent will sync target part via callback — emit custom event via onLayersChange
    // We pass link info through a second call pattern: parent handles cross-part linking.
    window.dispatchEvent(
      new CustomEvent("fabrixa:link-layers", {
        detail: {
          sourcePartKey: activePartKey,
          sourceLayerId: linkSourceId,
          targetPartKey: linkTargetPart,
          targetLayerId: linkTargetLayer,
          groupId: gid,
        },
      }),
    );
    setLinkOpen(false);
  };

  const unlinkLayer = (id: string) => {
    const layer = layers.find((l) => l.id === id);
    if (!layer?.linkedGroupId) return;
    updateLayer(id, { linkedGroupId: null });
  };

  const targetPartLayers = allParts.find((p) => p.key === linkTargetPart)?.layers ?? [];

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary">
          <Layers className="h-3.5 w-3.5" />
          Design Layers — {partLabel}
        </Label>
        {selectionMaskDataUrl && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] bg-background/60"
            onClick={onCreateFromSelection}
          >
            <Plus className="h-3 w-3 mr-1" />
            New from selection
          </Button>
        )}
      </div>

      {selectionMaskDataUrl && (
        <div className="flex items-center justify-between rounded-md border border-dashed border-primary/30 bg-background/40 px-2 py-1.5">
          <span className="text-[10px] text-muted-foreground">3D selection active</span>
          <div className="flex gap-1">
            <Button size="sm" variant="default" className="h-6 px-2 text-[10px]" onClick={onCreateFromSelection}>
              <Palette className="h-3 w-3 mr-1" />Create layer
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-destructive" onClick={onClearSelection}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {layers.length === 0 ? (
        <p className="text-[10px] text-muted-foreground py-2 text-center">
          Lasso a region on the model, then create a layer to design on that surface.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
          {layers.map((layer, i) => {
            const isActive = activeLayerId === layer.id;
            return (
              <div
                key={layer.id}
                className={`rounded-md border p-1.5 transition ${
                  isActive
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-white/10 bg-background/60"
                }`}
                onClick={() => onSelectLayer(layer.id)}
              >
                <div className="flex items-center gap-1.5">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded border border-white/10 bg-[conic-gradient(at_50%_50%,#e9e9ef_25%,#fafafa_0_50%,#e9e9ef_0_75%,#fafafa_0)] bg-[length:8px_8px]">
                    {layer.contentDataUrl ? (
                      <img src={layer.contentDataUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[8px] text-muted-foreground">empty</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {renamingId === layer.id ? (
                      <Input
                        className="h-6 text-[11px] px-1"
                        value={renameVal}
                        onChange={(e) => setRenameVal(e.target.value)}
                        onBlur={() => {
                          if (renameVal.trim()) updateLayer(layer.id, { name: renameVal.trim() });
                          setRenamingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (renameVal.trim()) updateLayer(layer.id, { name: renameVal.trim() });
                            setRenamingId(null);
                          }
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        className="text-[11px] font-medium truncate block w-full text-left hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(layer.id);
                          setRenameVal(layer.name);
                        }}
                        title="Click to rename"
                      >
                        {layer.name}
                        {layer.linkedGroupId && (
                          <Link2 className="inline h-2.5 w-2.5 ml-1 text-primary opacity-70" />
                        )}
                      </button>
                    )}
                    <div className="flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Slider
                        className="flex-1"
                        value={[Math.round(layer.opacity * 100)]}
                        min={0}
                        max={100}
                        step={1}
                        disabled={layer.locked}
                        onValueChange={([v]) => updateLayer(layer.id, { opacity: v / 100 })}
                      />
                      <span className="text-[9px] tabular-nums text-muted-foreground w-7">{Math.round(layer.opacity * 100)}%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-0.5">
                      <Button
                        size="sm" variant="ghost"
                        className="h-5 w-5 p-0"
                        disabled={layer.locked}
                        onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                        title={layer.visible ? "Hide" : "Show"}
                      >
                        {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-5 w-5 p-0"
                        onClick={() => updateLayer(layer.id, { locked: !layer.locked })}
                        title={layer.locked ? "Unlock" : "Lock"}
                      >
                        {layer.locked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3" />}
                      </Button>
                    </div>
                    <div className="flex gap-0.5">
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" disabled={i === 0} onClick={() => moveLayer(layer.id, -1)} title="Move up">
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" disabled={i === layers.length - 1} onClick={() => moveLayer(layer.id, 1)} title="Move down">
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 mt-1.5 pt-1 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm" variant="outline"
                    className="h-6 flex-1 text-[10px] bg-background/50"
                    disabled={layer.locked}
                    onClick={() => onEditLayer(layer.id)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />Edit
                  </Button>
                  {layer.linkedGroupId ? (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => unlinkLayer(layer.id)} title="Unlink">
                      <Unlink className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" disabled={layer.locked} onClick={() => openLinkDialog(layer.id)} title="Link to another part">
                      <Link2 className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm" variant="ghost"
                    className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10"
                    disabled={layer.locked}
                    onClick={() => deleteLayer(layer.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link layer across parts</DialogTitle>
            <DialogDescription>
              Linked layers share design content. Editing one updates all linked layers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Target garment part</Label>
              <Select value={linkTargetPart} onValueChange={(v) => { setLinkTargetPart(v); setLinkTargetLayer(""); }}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select part…" /></SelectTrigger>
                <SelectContent>
                  {allParts.map((p) => (
                    <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {linkTargetPart && (
              <div>
                <Label className="text-xs">Target layer</Label>
                <Select value={linkTargetLayer} onValueChange={setLinkTargetLayer}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select layer…" /></SelectTrigger>
                  <SelectContent>
                    {targetPartLayers.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button onClick={confirmLink} disabled={!linkTargetPart || !linkTargetLayer}>Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
