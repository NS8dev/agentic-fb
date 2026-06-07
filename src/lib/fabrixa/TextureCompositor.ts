import { DesignLayer, PartState } from "./garments";

/**
 * Loads an image from a URL, returning a Promise that resolves to an HTMLImageElement.
 */
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.substring(0, 30)}...`));
    img.src = src;
  });
}

/**
 * Converts an image to an alpha matte canvas based on luminance/alpha.
 */
function createAlphaMask(mask: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(mask, 0, 0, width, height);
  const img = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < img.data.length; i += 4) {
    // Preserve existing alpha if present, but also consider luminance
    const luminance =
      (img.data[i] * 0.2126 + img.data[i + 1] * 0.7152 + img.data[i + 2] * 0.0722) / 255;
    img.data[i] = 255;
    img.data[i + 1] = 255;
    img.data[i + 2] = 255;
    // The mask's alpha determines transparency. If it's a black/white mask, we use luminance to dictate alpha.
    img.data[i + 3] = Math.round(img.data[i + 3] * luminance);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Composites a stack of layers onto a base texture, returning a new data URL.
 * Base color is NOT baked in, keeping the background transparent if no base texture is provided,
 * allowing the 3D material color to tint the untextured areas.
 *
 * @param baseTextureUrl - Optional base repeating texture
 * @param layers - Array of DesignLayers to composite on top
 * @param width - Resolution of the output texture (default 1024)
 * @param height - Resolution of the output texture (default 1024)
 */
export async function compositeLayers(
  baseTextureUrl: string | null,
  layers: DesignLayer[],
  width: number = 1024,
  height: number = 1024,
): Promise<string | null> {
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const octx = out.getContext("2d")!;

  let hasContent = false;

  // 1. Draw base layer
  if (baseTextureUrl) {
    try {
      const baseImg = await loadImg(baseTextureUrl);
      octx.drawImage(baseImg, 0, 0, width, height);
      hasContent = true;
    } catch (e) {
      console.warn("Failed to load base texture for compositing", e);
    }
  }

  // 2. Composite each visible layer
  for (const layer of layers) {
    if (!layer.visible || !layer.contentDataUrl) continue;

    try {
      const contentImg = await loadImg(layer.contentDataUrl);

      octx.save();
      octx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;

      if (layer.maskUrl) {
        // If layer has a mask, we draw the content into a temp canvas, apply the mask, then draw to output
        const maskImg = await loadImg(layer.maskUrl);
        const tmp = document.createElement("canvas");
        tmp.width = width;
        tmp.height = height;
        const tctx = tmp.getContext("2d")!;

        tctx.drawImage(contentImg, 0, 0, width, height);
        tctx.globalCompositeOperation = "destination-in";
        tctx.drawImage(createAlphaMask(maskImg, width, height), 0, 0);

        octx.drawImage(tmp, 0, 0, width, height);
        hasContent = true;
      } else {
        // No mask, just draw directly over
        octx.drawImage(contentImg, 0, 0, width, height);
        hasContent = true;
      }

      octx.restore();
    } catch (e) {
      console.warn(`Failed to composite layer: ${layer.name}`, e);
    }
  }

  return hasContent ? out.toDataURL("image/png") : null;
}
