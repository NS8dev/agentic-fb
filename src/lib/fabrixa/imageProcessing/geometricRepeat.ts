// Geometric pattern repeat presets — grid, brick, half-drop, mirror, diagonal.
import { loadImage, canvasToDataUrl } from "./canvasUtils";

export type RepeatPreset = "grid" | "brick" | "halfDrop" | "mirror" | "diagonal";

export interface RepeatOpts {
  repeat?: number;
  gapX?: number;
  gapY?: number;
  offset?: number;
}

export async function applyGeometricRepeat(
  dataUrl: string,
  preset: RepeatPreset,
  opts: RepeatOpts = {},
): Promise<string> {
  const img = await loadImage(dataUrl);
  const tileRepeat = opts.repeat ?? 4;
  const gapX = opts.gapX ?? 0;
  const gapY = opts.gapY ?? 0;
  const offset = opts.offset ?? (preset === "halfDrop" ? 0.5 : preset === "brick" ? 0.5 : 0);

  const tw = img.naturalWidth;
  const th = img.naturalHeight;
  const out = document.createElement("canvas");
  out.width = tw * 2;
  out.height = th * 2;
  const ctx = out.getContext("2d")!;

  const cellW = (out.width / tileRepeat) + gapX;
  const cellH = (out.height / tileRepeat) + gapY;

  for (let row = -1; row <= tileRepeat + 1; row++) {
    for (let col = -1; col <= tileRepeat + 1; col++) {
      const ox = (row % 2 === 0 || preset === "grid") ? 0 : offset * cellW;
      const x = col * cellW + ox;
      const y = row * cellH;

      ctx.save();
      ctx.translate(x + cellW / 2, y + cellH / 2);

      if (preset === "mirror") {
        if (col % 2 !== 0) ctx.scale(-1, 1);
        if (row % 2 !== 0) ctx.scale(1, -1);
      } else if (preset === "diagonal") {
        ctx.rotate(((col + row) % 2 === 0 ? 0 : Math.PI / 2));
      }

      ctx.drawImage(img, -cellW / 2, -cellH / 2, cellW - gapX, cellH - gapY);
      ctx.restore();
    }
  }

  return canvasToDataUrl(out);
}
