// Color separation — k-means clustering in RGB space → print plates.
import { loadImage, imageToCanvas, canvasToDataUrl, getImageData } from "./canvasUtils";

export interface SeparationPlate {
  color: string;
  maskDataUrl: string;
  plateDataUrl: string;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function distSq(a: number[], b: number[]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function kMeans(pixels: number[][], k: number, maxIter = 20): number[][] {
  const centroids: number[][] = [];
  const step = Math.max(1, Math.floor(pixels.length / k));
  for (let i = 0; i < k; i++) {
    centroids.push([...pixels[(i * step) % pixels.length]]);
  }

  const assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    for (let i = 0; i < pixels.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = distSq(pixels[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assignments[i] = best;
    }

    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      const a = assignments[i];
      sums[a][0] += pixels[i][0];
      sums[a][1] += pixels[i][1];
      sums[a][2] += pixels[i][2];
      sums[a][3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [
          Math.round(sums[c][0] / sums[c][3]),
          Math.round(sums[c][1] / sums[c][3]),
          Math.round(sums[c][2] / sums[c][3]),
        ];
      }
    }
  }

  return centroids;
}

export async function separateColors(dataUrl: string, k = 4): Promise<SeparationPlate[]> {
  const img = await loadImage(dataUrl);
  const maxDim = 256;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const sw = Math.max(1, Math.round(img.naturalWidth * scale));
  const sh = Math.max(1, Math.round(img.naturalHeight * scale));
  const small = imageToCanvas(img, sw, sh);
  const smallData = getImageData(small);

  const pixels: number[][] = [];
  for (let i = 0; i < smallData.data.length; i += 4) {
    if (smallData.data[i + 3] < 128) continue;
    pixels.push([smallData.data[i], smallData.data[i + 1], smallData.data[i + 2]]);
  }
  if (!pixels.length) return [];

  const clusters = kMeans(pixels, Math.min(k, pixels.length));
  const full = imageToCanvas(img);
  const fullData = getImageData(full);
  const w = full.width;
  const h = full.height;

  const plates: SeparationPlate[] = [];

  for (let ci = 0; ci < clusters.length; ci++) {
    const [cr, cg, cb] = clusters[ci];
    const color = rgbToHex(cr, cg, cb);

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext("2d")!;
    const maskData = maskCtx.createImageData(w, h);

    const plateCanvas = document.createElement("canvas");
    plateCanvas.width = w;
    plateCanvas.height = h;
    const plateCtx = plateCanvas.getContext("2d")!;
    const plateData = plateCtx.createImageData(w, h);

    for (let i = 0; i < fullData.data.length; i += 4) {
      const px = [fullData.data[i], fullData.data[i + 1], fullData.data[i + 2]];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < clusters.length; c++) {
        const d = distSq(px, clusters[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      const on = best === ci && fullData.data[i + 3] > 128;
      maskData.data[i] = 255;
      maskData.data[i + 1] = 255;
      maskData.data[i + 2] = 255;
      maskData.data[i + 3] = on ? 255 : 0;
      plateData.data[i] = cr;
      plateData.data[i + 1] = cg;
      plateData.data[i + 2] = cb;
      plateData.data[i + 3] = on ? 255 : 0;
    }

    maskCtx.putImageData(maskData, 0, 0);
    plateCtx.putImageData(plateData, 0, 0);
    plates.push({
      color,
      maskDataUrl: canvasToDataUrl(maskCanvas),
      plateDataUrl: canvasToDataUrl(plateCanvas),
    });
  }

  return plates;
}
