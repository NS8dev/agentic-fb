import { hexToRgb, getLuminance } from "./colorTheory";

/**
 * Recolors a pattern texture non-destructively using destination-in compositing.
 * Plates and newPalette are sorted by luminance before mapping to maintain shading depth.
 */
export async function recolorTexture(
  imageSource: string | HTMLImageElement | HTMLCanvasElement,
  plates: string[],
  newPalette: string[],
): Promise<HTMLCanvasElement> {
  let img: HTMLImageElement | HTMLCanvasElement;
  if (typeof imageSource === "string") {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = (e) => reject(new Error("Failed to load image for recoloring: " + e));
      i.src = imageSource;
    });
  } else {
    img = imageSource;
  }

  const width = img.width || (img as HTMLCanvasElement).width || 512;
  const height = img.height || (img as HTMLCanvasElement).height || 512;

  // 1. Sort plates and newPalette by luminance BEFORE mapping
  const sortedPlates = [...plates].sort((a, b) => getLuminance(a) - getLuminance(b));
  const sortedNewPalette = [...newPalette].sort((a, b) => getLuminance(a) - getLuminance(b));

  // 2. Setup output canvas
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outCtx = outputCanvas.getContext("2d");
  if (!outCtx) {
    throw new Error("Could not get 2D context for output canvas");
  }

  // Clear output canvas
  outCtx.clearRect(0, 0, width, height);

  // 3. Render original to offscreen canvas to access pixels
  const originalCanvas = document.createElement("canvas");
  originalCanvas.width = width;
  originalCanvas.height = height;
  const origCtx = originalCanvas.getContext("2d");
  if (!origCtx) {
    throw new Error("Could not get 2D context for original canvas");
  }
  origCtx.drawImage(img, 0, 0, width, height);
  const originalImageData = origCtx.getImageData(0, 0, width, height);

  const rgbPlates = sortedPlates.map((color) => hexToRgb(color));
  const maskImageDataArray = sortedPlates.map(() => origCtx.createImageData(width, height));

  // 4. Map each pixel to the closest plate
  const data = originalImageData.data;
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) continue;

    let minD = Infinity;
    let closestIdx = -1;

    for (let p = 0; p < rgbPlates.length; p++) {
      const pr = rgbPlates[p].r;
      const pg = rgbPlates[p].g;
      const pb = rgbPlates[p].b;
      // RGB Euclidean distance
      const d = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);
      if (d < minD) {
        minD = d;
        closestIdx = p;
      }
    }

    if (closestIdx !== -1) {
      const maskData = maskImageDataArray[closestIdx].data;
      maskData[i] = r;
      maskData[i + 1] = g;
      maskData[i + 2] = b;
      maskData[i + 3] = a; // preserve alpha
    }
  }

  // 5. Composite each plate mask with its new mapped color
  for (let p = 0; p < sortedPlates.length; p++) {
    const targetColor =
      sortedNewPalette[p] || sortedNewPalette[sortedNewPalette.length - 1] || "#ffffff";

    // Solid color canvas
    const plateCanvas = document.createElement("canvas");
    plateCanvas.width = width;
    plateCanvas.height = height;
    const plateCtx = plateCanvas.getContext("2d");
    if (!plateCtx) continue;

    plateCtx.fillStyle = targetColor;
    plateCtx.fillRect(0, 0, width, height);

    // Mask canvas
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) continue;
    maskCtx.putImageData(maskImageDataArray[p], 0, 0);

    // Apply destination-in: Keeps targetColor only where maskCanvas has content/alpha
    plateCtx.globalCompositeOperation = "destination-in";
    plateCtx.drawImage(maskCanvas, 0, 0);

    // Draw the colored plate to output
    outCtx.drawImage(plateCanvas, 0, 0);
  }

  return outputCanvas;
}
