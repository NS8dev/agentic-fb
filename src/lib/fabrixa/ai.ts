// AI image generation — Google Gemini via /api routes, demo fallback when unconfigured.
import { APP_DATA_0 } from "@/lib/fabrixa/APP_DATA_0";

export type AiTask =
  | "imageGen"
  | "imageEdit"
  | "neckDesign"
  | "textToPattern"
  | "textToDesign"
  | "sketchToDesign"
  | "imageClean"
  | "lookbookFront"
  | "lookbookBack";

export interface GenerateOpts {
  prompt: string;
  size?: "512x512" | "1024x1024";
  task?: AiTask;
  referenceImage?: string;
  referenceImages?: string[];
  garmentType?: string;
  gender?: "woman" | "man";
  priorFrontImage?: string;
}

export interface GenerateResult {
  dataUrl: string;
  provider: string;
  model: string;
}

export interface PaletteResult {
  colors: string[];
  names?: string[];
  provider: string;
}

export function isAiConfigured(): boolean {
  const k = APP_DATA_0.ai.apiKey;
  return !!k && !k.startsWith("REPLACE_ME") && !/DUMMY/i.test(k);
}

function isDemoMode(): boolean {
  const key = APP_DATA_0.ai.apiKey;
  return !key || key.startsWith("REPLACE_ME") || /DUMMY/i.test(key);
}

function demoImageFromPrompt(prompt: string, label = "DEMO"): string {
  const size = 1024;
  const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!c) return "";
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  let h = 0;
  for (let i = 0; i < prompt.length; i++) h = (h * 31 + prompt.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 140) % 360;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, `hsl(${h1} 70% 55%)`);
  g.addColorStop(1, `hsl(${h2} 70% 45%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let y = 32; y < size; y += 64) {
    for (let x = 32; x < size; x += 64) {
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.fillText(`${label} · ` + prompt.slice(0, 40), 24, size - 32);
  return c.toDataURL("image/png");
}

function demoLookbookImage(prompt: string, view: string): string {
  const size = 1024;
  const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!c) return "";
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#e8e4df";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(size * 0.35, size * 0.15, size * 0.3, size * 0.12);
  ctx.fillStyle = "#888";
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.2, size * 0.08, size * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  const grd = ctx.createLinearGradient(0, size * 0.3, 0, size * 0.9);
  grd.addColorStop(0, "hsl(220 40% 55%)");
  grd.addColorStop(1, "hsl(220 50% 40%)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(size * 0.32, size * 0.32);
  ctx.lineTo(size * 0.68, size * 0.32);
  ctx.lineTo(size * 0.72, size * 0.88);
  ctx.lineTo(size * 0.28, size * 0.88);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.font = "bold 24px system-ui";
  ctx.fillText(`LOOKBOOK DEMO · ${view.toUpperCase()}`, 24, size - 24);
  ctx.font = "16px system-ui";
  ctx.fillText(prompt.slice(0, 50), 24, size - 56);
  return c.toDataURL("image/png");
}

async function generateViaGeminiApi(
  prompt: string,
  task: string,
  opts?: Omit<GenerateOpts, "prompt" | "task">,
): Promise<GenerateResult> {
  const res = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      task,
      referenceImage: opts?.referenceImage,
      referenceImages: opts?.referenceImages,
      size: opts?.size,
      garmentType: opts?.garmentType,
      gender: opts?.gender,
      priorFrontImage: opts?.priorFrontImage,
    }),
  });
  const json = (await res.json()) as {
    dataUrl?: string;
    provider?: string;
    model?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? `AI failed (${res.status})`);
  if (!json.dataUrl) throw new Error("AI returned no image");
  return {
    dataUrl: json.dataUrl,
    provider: json.provider ?? "gemini",
    model: json.model ?? APP_DATA_0.ai.models.imageGen,
  };
}

export async function generateImage(opts: GenerateOpts): Promise<GenerateResult> {
  const task = opts.task ?? "imageGen";
  const model = (APP_DATA_0.ai.models as Record<string, string>)[task] ?? APP_DATA_0.ai.models.imageGen;
  const size = opts.size ?? "1024x1024";

  if (isDemoMode()) {
    await new Promise((r) => setTimeout(r, 600));
    const label =
      task === "lookbookFront" || task === "lookbookBack"
        ? "LOOKBOOK"
        : task === "sketchToDesign"
          ? "SKETCH"
          : "DEMO";
    const dataUrl =
      task === "lookbookFront" || task === "lookbookBack"
        ? demoLookbookImage(opts.prompt, task === "lookbookBack" ? "back" : "front")
        : demoImageFromPrompt(opts.prompt, label);
    return { dataUrl, provider: "demo", model: "demo-swatch" };
  }

  if (APP_DATA_0.ai.provider === "gemini") {
    return generateViaGeminiApi(opts.prompt, task, opts);
  }

  if (APP_DATA_0.ai.provider === "openai") {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), APP_DATA_0.ai.timeoutMs);
    try {
      const res = await fetch(`${APP_DATA_0.ai.baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${APP_DATA_0.ai.apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: opts.prompt,
          n: 1,
          size,
          response_format: "b64_json",
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`AI failed (${res.status}): ${t.slice(0, 240)}`);
      }
      const json = (await res.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
      };
      const first = json.data?.[0];
      if (first?.b64_json) {
        return {
          dataUrl: `data:image/png;base64,${first.b64_json}`,
          provider: "openai",
          model,
        };
      }
      if (first?.url) {
        const blob = await (await fetch(first.url)).blob();
        return {
          dataUrl: await blobToDataUrl(blob),
          provider: "openai",
          model,
        };
      }
      throw new Error("AI returned no image.");
    } finally {
      clearTimeout(tm);
    }
  }

  throw new Error(`Provider not implemented: ${APP_DATA_0.ai.provider}`);
}

export async function enhancePrompt(prompt: string): Promise<string> {
  if (isDemoMode()) {
    await new Promise((r) => setTimeout(r, 400));
    return `${prompt}. Seamless tileable square textile pattern with matched edges, fashion-forward color palette, print-ready motif scale, no text or watermarks.`;
  }
  const res = await fetch("/api/ai/enhance-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const json = (await res.json()) as { enhancedPrompt?: string; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Enhance failed");
  if (!json.enhancedPrompt) throw new Error("No enhanced prompt returned");
  return json.enhancedPrompt;
}

export async function smartPalette(opts: {
  referenceImage?: string;
  styleBrief?: string;
}): Promise<PaletteResult> {
  if (isDemoMode()) {
    await new Promise((r) => setTimeout(r, 500));
    return {
      colors: ["#1B2A4A", "#C9A227", "#E8DCC8", "#8B4513", "#2E8B57", "#B22222"],
      names: ["Deep Navy", "Gold", "Cream", "Brown", "Forest", "Crimson"],
      provider: "demo",
    };
  }
  const res = await fetch("/api/ai/smart-palette", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const json = (await res.json()) as PaletteResult & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Smart palette failed");
  return json;
}

export async function generateLookbook(opts: {
  textureImage: string;
  garmentType: string;
  gender: "woman" | "man";
  view: "front" | "back";
  priorFrontImage?: string;
}): Promise<GenerateResult> {
  if (isDemoMode()) {
    await new Promise((r) => setTimeout(r, 800));
    return {
      dataUrl: demoLookbookImage(`${opts.garmentType} ${opts.gender}`, opts.view),
      provider: "demo",
      model: "demo-lookbook",
    };
  }
  const res = await fetch("/api/ai/lookbook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const json = (await res.json()) as {
    dataUrl?: string;
    provider?: string;
    model?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? "Lookbook failed");
  if (!json.dataUrl) throw new Error("Lookbook returned no image");
  return {
    dataUrl: json.dataUrl,
    provider: json.provider ?? "gemini",
    model: json.model ?? APP_DATA_0.ai.models.lookbookFront,
  };
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}
