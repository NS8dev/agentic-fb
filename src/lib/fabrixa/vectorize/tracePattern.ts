// Pattern vectorization — posterize + edge trace → SVG paths.
import { loadImage, imageToCanvas, getImageData } from "../imageProcessing/canvasUtils";

export interface VectorizeResult {
  svg: string;
  pathCount: number;
}

function posterize(data: ImageData, levels: number): ImageData {
  const out = new ImageData(data.width, data.height);
  const step = 255 / (levels - 1);
  for (let i = 0; i < data.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      out.data[i + c] = Math.round(data.data[i + c] / step) * step;
    }
    out.data[i + 3] = data.data[i + 3];
  }
  return out;
}

function sobelEdges(data: ImageData): Uint8Array {
  const { width: w, height: h, data: d } = data;
  const edges = new Uint8Array(w * h);
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sx = 0;
      let sy = 0;
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const lum =
            d[((y + dy) * w + (x + dx)) * 4] * 0.299 +
            d[((y + dy) * w + (x + dx)) * 4 + 1] * 0.587 +
            d[((y + dy) * w + (x + dx)) * 4 + 2] * 0.114;
          sx += lum * gx[k];
          sy += lum * gy[k];
          k++;
        }
      }
      edges[y * w + x] = Math.min(255, Math.sqrt(sx * sx + sy * sy));
    }
  }
  return edges;
}

function traceContours(edges: Uint8Array, w: number, h: number, threshold = 80): string[] {
  const visited = new Uint8Array(w * h);
  const paths: string[] = [];
  const dirs = [
    [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
  ];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (visited[idx] || edges[idx] < threshold) continue;

      const pts: string[] = [`M ${x} ${y}`];
      let cx = x;
      let cy = y;
      let steps = 0;
      visited[idx] = 1;

      while (steps < 2000) {
        let found = false;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (!visited[ni] && edges[ni] >= threshold) {
            visited[ni] = 1;
            cx = nx;
            cy = ny;
            pts.push(`L ${cx} ${cy}`);
            found = true;
            break;
          }
        }
        if (!found) break;
        steps++;
      }

      if (pts.length > 4) paths.push(pts.join(" "));
    }
  }
  return paths;
}

export async function vectorizePattern(dataUrl: string, maxSize = 512): Promise<VectorizeResult> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = imageToCanvas(img, w, h);
  let data = getImageData(canvas);
  data = posterize(data, 6);
  const edges = sobelEdges(data);
  const paths = traceContours(edges, w, h);

  const svgPaths = paths
    .map((p, i) => `<path d="${p}" fill="none" stroke="#222" stroke-width="1" data-id="v${i}"/>`)
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n${svgPaths}\n</svg>`;
  return { svg, pathCount: paths.length };
}
