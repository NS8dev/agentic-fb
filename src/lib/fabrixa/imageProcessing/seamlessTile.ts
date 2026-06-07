// Seamless tile repair — offset-merge + multi-band edge blending.
import {
  loadImage,
  imageToCanvas,
  canvasToDataUrl,
  getImageData,
  putImageData,
} from "./canvasUtils";

function edgeDeltaScore(data: ImageData): number {
  const { width: w, height: h, data: d } = data;
  let sum = 0;
  let n = 0;
  for (let x = 0; x < w; x++) {
    for (const [y1, y2] of [
      [0, h - 1],
      [h - 1, 0],
    ] as const) {
      const i1 = (y1 * w + x) * 4;
      const i2 = (y2 * w + x) * 4;
      sum +=
        Math.abs(d[i1] - d[i2]) + Math.abs(d[i1 + 1] - d[i2 + 1]) + Math.abs(d[i1 + 2] - d[i2 + 2]);
      n += 3;
    }
  }
  for (let y = 0; y < h; y++) {
    for (const [x1, x2] of [
      [0, w - 1],
      [w - 1, 0],
    ] as const) {
      const i1 = (y * w + x1) * 4;
      const i2 = (y * w + x2) * 4;
      sum +=
        Math.abs(d[i1] - d[i2]) + Math.abs(d[i1 + 1] - d[i2 + 1]) + Math.abs(d[i1 + 2] - d[i2 + 2]);
      n += 3;
    }
  }
  return n ? sum / n : 0;
}

function blendSeam(data: ImageData, band: number): void {
  const { width: w, height: h, data: d } = data;
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const distH = Math.min(Math.abs(x - cx), w - Math.abs(x - cx));
      const distV = Math.min(Math.abs(y - cy), h - Math.abs(y - cy));
      const inBand = distH < band || distV < band;
      if (!inBand) continue;

      const blendH = distH < band ? distH / band : 1;
      const blendV = distV < band ? distV / band : 1;
      const t = Math.min(blendH, blendV);

      const i = (y * w + x) * 4;
      const mx = (x + cx) % w;
      const my = (y + cy) % h;
      const j = (my * w + mx) * 4;

      d[i] = Math.round(d[i] * t + d[j] * (1 - t));
      d[i + 1] = Math.round(d[i + 1] * t + d[j + 1] * (1 - t));
      d[i + 2] = Math.round(d[i + 2] * t + d[j + 2] * (1 - t));
    }
  }
}

function offsetSwap(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const src = getImageData(canvas);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const dst = out.getContext("2d")!.createImageData(w, h);
  const hw = Math.floor(w / 2);
  const hh = Math.floor(h / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = (x + hw) % w;
      const sy = (y + hh) % h;
      const si = (sy * w + sx) * 4;
      const di = (y * w + x) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
  putImageData(out, dst);
  return out;
}

export async function makeSeamlessTile(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  let canvas = imageToCanvas(img);
  canvas = offsetSwap(canvas);

  let band = Math.max(8, Math.floor(Math.min(canvas.width, canvas.height) * 0.04));
  let best = canvas;
  let bestScore = Infinity;

  for (let attempt = 0; attempt < 3; attempt++) {
    const data = getImageData(canvas);
    blendSeam(data, band);
    putImageData(canvas, data);
    const score = edgeDeltaScore(data);
    if (score < bestScore) {
      bestScore = score;
      best = canvas;
    }
    if (score < 12) break;
    band = Math.floor(band * 1.5);
    canvas = offsetSwap(imageToCanvas(img));
  }

  return canvasToDataUrl(best);
}

export async function tilePreview2x2(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const out = document.createElement("canvas");
  out.width = img.naturalWidth * 2;
  out.height = img.naturalHeight * 2;
  const ctx = out.getContext("2d")!;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      ctx.drawImage(img, x * img.naturalWidth, y * img.naturalHeight);
    }
  }
  return canvasToDataUrl(out);
}
