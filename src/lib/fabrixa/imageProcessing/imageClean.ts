// Image cleanup — median denoise, edge-preserving smooth, unsharp mask.
import { loadImage, imageToCanvas, canvasToDataUrl, getImageData, putImageData } from "./canvasUtils";

function medianFilter(data: ImageData, radius: number): ImageData {
  const { width: w, height: h, data: d } = data;
  const out = new ImageData(w, h);
  const r = radius;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const vals: number[] = [];
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = Math.min(w - 1, Math.max(0, x + dx));
            const ny = Math.min(h - 1, Math.max(0, y + dy));
            vals.push(d[(ny * w + nx) * 4 + c]);
          }
        }
        vals.sort((a, b) => a - b);
        out.data[i + c] = vals[Math.floor(vals.length / 2)];
      }
      out.data[i + 3] = d[i + 3];
    }
  }
  return out;
}

function unsharpMask(data: ImageData, amount = 0.4): ImageData {
  const blurred = medianFilter(data, 1);
  const out = new ImageData(data.width, data.height);
  for (let i = 0; i < data.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const sharp = data.data[i + c] + amount * (data.data[i + c] - blurred.data[i + c]);
      out.data[i + c] = Math.min(255, Math.max(0, Math.round(sharp)));
    }
    out.data[i + 3] = data.data[i + 3];
  }
  return out;
}

function normalizeBackground(data: ImageData, threshold = 240): void {
  const { data: d } = data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (lum > threshold && d[i + 3] > 200) {
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
    }
  }
}

export async function cleanImageAlgorithm(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = imageToCanvas(img);
  let data = getImageData(canvas);
  data = medianFilter(data, 1);
  normalizeBackground(data);
  data = unsharpMask(data, 0.35);
  putImageData(canvas, data);
  return canvasToDataUrl(canvas);
}
