export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Converts a hex color string to RGB.
 */
export function hexToRgb(hex: string): RGB {
  const clean = hex.replace(/^#/, "");
  const bigint = parseInt(clean, 16);
  if (clean.length === 3) {
    const r = ((bigint >> 8) & 0xf) * 17;
    const g = ((bigint >> 4) & 0xf) * 17;
    const b = (bigint & 0xf) * 17;
    return { r, g, b };
  } else {
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
  }
}

/**
 * Converts RGB values (0..255) to a hex color string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  return "#" + ((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1);
}

/**
 * Converts RGB to HSL.
 * h: 0..360, s: 0..100, l: 0..100
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Converts HSL to RGB.
 * h: 0..360, s: 0..100, l: 0..100
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360;
  s /= 100;
  l /= 100;
  let r = l,
    g = l,
    b = l;
  if (s !== 0) {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Calculates relative luminance using the formula: (0.299 * R + 0.587 * G + 0.114 * B)
 */
export function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Generates Warm, Cool, or Analogous shifted colorways from a base palette.
 */
export function generateAlgorithmicPalettes(
  basePalette: string[],
  type: "warm" | "cool" | "analogous",
): string[] {
  return basePalette.map((hex) => {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const { l } = hsl;
    let { h, s } = hsl;

    if (type === "warm") {
      // Warm shift: pull hue towards 15 degrees (red/orange)
      const targetH = 15;
      const diff = ((targetH - h + 540) % 360) - 180;
      h = (h + diff * 0.65 + 360) % 360;
      s = Math.max(s, 50); // Keep warm colors vibrant
    } else if (type === "cool") {
      // Cool shift: pull hue towards 210 degrees (cool blue)
      const targetH = 210;
      const diff = ((targetH - h + 540) % 360) - 180;
      h = (h + diff * 0.65 + 360) % 360;
      s = Math.max(s, 40); // Keep cool colors clean/vivid
    } else if (type === "analogous") {
      // Analogous: pull hues to group closer to the dominant (first) color
      const firstRgb = hexToRgb(basePalette[0] || "#ffffff");
      const firstHsl = rgbToHsl(firstRgb.r, firstRgb.g, firstRgb.b);
      const targetH = firstHsl.h;
      const diff = ((targetH - h + 540) % 360) - 180;
      h = (h + diff * 0.75 + 360) % 360;
    }

    const newRgb = hslToRgb(h, s, l);
    return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
  });
}

/**
 * Quantize colors using a grid-bucket approach to extract the top maxColors representative colors.
 */
export async function extractPlates(
  imageSource: string | HTMLImageElement | HTMLCanvasElement,
  maxColors = 5,
): Promise<string[]> {
  let img: HTMLImageElement | HTMLCanvasElement;
  if (typeof imageSource === "string") {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = (e) => reject(new Error("Failed to load image for color extraction: " + e));
      i.src = imageSource;
    });
  } else {
    img = imageSource;
  }

  // Draw to a smaller canvas for fast pixel scanning
  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  // Use a map to count colors grouped by a grid bucket (RGB space divided by 32)
  const buckets: Record<string, { rSum: number; gSum: number; bSum: number; count: number }> = {};

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Ignore highly transparent pixels
    if (a < 50) continue;

    // Bucket size 32
    const bucketKey = `${Math.floor(r / 32)},${Math.floor(g / 32)},${Math.floor(b / 32)}`;

    if (!buckets[bucketKey]) {
      buckets[bucketKey] = { rSum: 0, gSum: 0, bSum: 0, count: 0 };
    }
    buckets[bucketKey].rSum += r;
    buckets[bucketKey].gSum += g;
    buckets[bucketKey].bSum += b;
    buckets[bucketKey].count++;
  }

  const sortedBuckets = Object.values(buckets).sort((a, b) => b.count - a.count);

  const result: string[] = [];
  const limit = Math.min(maxColors, sortedBuckets.length);
  for (let i = 0; i < limit; i++) {
    const b = sortedBuckets[i];
    const r = Math.round(b.rSum / b.count);
    const g = Math.round(b.gSum / b.count);
    const bVal = Math.round(b.bSum / b.count);
    result.push(rgbToHex(r, g, bVal));
  }

  // Fallbacks if fewer colors than maxColors
  const fallbacks = ["#ffffff", "#000000", "#888888", "#ff0000", "#0000ff"];
  while (result.length < maxColors) {
    const fb = fallbacks[result.length % fallbacks.length];
    if (!result.includes(fb)) {
      result.push(fb);
    } else {
      result.push(rgbToHex(Math.random() * 255, Math.random() * 255, Math.random() * 255));
    }
  }

  return result;
}

/**
 * Generates a harmonious color palette from a base color hex.
 * Mode options:
 * - 'triadic': base, +120 degrees, +240 degrees.
 * - 'complementary': base, +180 degrees.
 * - 'split-complementary': base, +150 degrees, +210 degrees.
 * Generates shades/tints to fill out the requested count.
 */
export function generateHarmoniousPalette(
  baseHex: string,
  mode: "triadic" | "complementary" | "split-complementary",
  count = 5,
): string[] {
  const rgb = hexToRgb(baseHex);
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const palette: string[] = [];

  const addHsl = (hue: number, sat: number, lit: number) => {
    const r = hslToRgb((hue + 360) % 360, sat, lit);
    palette.push(rgbToHex(r.r, r.g, r.b));
  };

  if (mode === "triadic") {
    // 3 base hues: h, h+120, h+240
    addHsl(h, s, l);
    addHsl(h + 120, s, l);
    addHsl(h + 240, s, l);
    // Fill remaining with variations
    addHsl(h, Math.max(10, s * 0.85), Math.max(10, l * 0.65));
    addHsl(h + 120, Math.max(10, s * 0.85), Math.min(95, l * 1.3));
    addHsl(h + 240, Math.max(10, s * 0.85), Math.max(10, l * 0.65));
  } else if (mode === "complementary") {
    // 2 base hues: h, h+180
    addHsl(h, s, l);
    addHsl(h + 180, s, l);
    // Fill remaining with variations
    addHsl(h, Math.max(10, s * 0.85), Math.max(10, l * 0.6));
    addHsl(h + 180, Math.max(10, s * 0.85), Math.min(95, l * 1.35));
    addHsl(h, Math.max(10, s * 0.85), Math.min(95, l * 1.35));
    addHsl(h + 180, Math.max(10, s * 0.85), Math.max(10, l * 0.6));
  } else if (mode === "split-complementary") {
    // 3 base hues: h, h+150, h+210
    addHsl(h, s, l);
    addHsl(h + 150, s, l);
    addHsl(h + 210, s, l);
    // Fill remaining with variations
    addHsl(h, Math.max(10, s * 0.85), Math.max(10, l * 0.65));
    addHsl(h + 150, Math.max(10, s * 0.85), Math.min(95, l * 1.3));
    addHsl(h + 210, Math.max(10, s * 0.85), Math.max(10, l * 0.65));
  }

  // Slice or pad to match the count exactly
  const result = palette.slice(0, count);
  const fallbacks = ["#ffffff", "#000000", "#888888", "#ff0000", "#0000ff"];
  while (result.length < count) {
    const fb = fallbacks[result.length % fallbacks.length];
    if (!result.includes(fb)) {
      result.push(fb);
    } else {
      result.push(rgbToHex(Math.random() * 255, Math.random() * 255, Math.random() * 255));
    }
  }
  return result;
}
