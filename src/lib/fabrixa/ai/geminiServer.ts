// Server-side Gemini API helpers — image + text generation with multimodal support.

type AiCfg = {
  apiKey: string;
  baseUrl?: string;
  imageModel?: string;
  textModel?: string;
};

export function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

export function getGeminiKey(cfg: AiCfg): string | null {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || cfg.apiKey;
  if (!key || key.startsWith("REPLACE_ME")) return null;
  return key;
}

export function geminiAuth(
  key: string,
  baseUrl: string,
  path: string,
): { url: string; headers: Record<string, string> } {
  const base = (baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  let url = `${base}${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key.startsWith("Bearer ") || key.startsWith("ya29.") || key.startsWith("1/")) {
    headers.Authorization = key.startsWith("Bearer ") ? key : `Bearer ${key}`;
  } else {
    url += `${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
  }
  return { url, headers };
}

const blobToDataUrl = async (blob: Blob): Promise<string> => {
  if (typeof Buffer !== "undefined") {
    const arrayBuffer = await blob.arrayBuffer();
    return `data:image/png;base64,${Buffer.from(arrayBuffer).toString("base64")}`;
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

export function imageDataUrlFromGenerateContent(json: unknown): string | null {
  const parts =
    (json as { candidates?: Array<{ content?: { parts?: unknown[] } }> })?.candidates?.[0]?.content
      ?.parts ?? [];
  for (const part of parts) {
    const p = part as { inlineData?: { mimeType?: string; data?: string } };
    if (p.inlineData?.data) {
      const mime = p.inlineData.mimeType ?? "image/png";
      return `data:${mime};base64,${p.inlineData.data}`;
    }
  }
  return null;
}

export async function imageDataUrlFromImagesApi(json: unknown): Promise<string | null> {
  const j = json as {
    images?: Array<{ imageBytes?: string; b64_json?: string; imageUri?: string }>;
    image?: Array<{ imageBytes?: string; b64_json?: string; imageUri?: string }>;
    data?: Array<{ imageBytes?: string; b64_json?: string; imageUri?: string }>;
  };
  const item = j.images?.[0] || j.image?.[0] || j.data?.[0];
  if (!item) return null;
  if (typeof item.imageBytes === "string") return `data:image/png;base64,${item.imageBytes}`;
  if (typeof item.b64_json === "string") return `data:image/png;base64,${item.b64_json}`;
  if (typeof item.imageUri === "string") {
    const imageRes = await fetch(item.imageUri);
    if (!imageRes.ok) return null;
    return blobToDataUrl(await imageRes.blob());
  }
  return null;
}

export function textFromGenerateContent(json: unknown): string | null {
  const parts =
    (json as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      ?.candidates?.[0]?.content?.parts ?? [];
  const texts = parts.map((p) => p.text ?? "").filter(Boolean);
  return texts.length ? texts.join("\n").trim() : null;
}

export interface GeminiImageOpts {
  cfg: AiCfg;
  prompt: string;
  model: string;
  size?: string;
  referenceImages?: string[];
}

export async function generateGeminiImage(opts: GeminiImageOpts): Promise<string> {
  const key = getGeminiKey(opts.cfg);
  if (!key) throw new Error("Set GEMINI_API_KEY or GOOGLE_AI_API_KEY environment variable");

  const refs = (opts.referenceImages ?? []).map(parseDataUrl).filter(Boolean) as {
    mimeType: string;
    data: string;
  }[];
  const parts: unknown[] = [{ text: opts.prompt }];
  for (const ref of refs) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
  }

  // Primary path: generateContent (handles both text-only and multimodal)
  const { url: gcUrl, headers: gcHeaders } = geminiAuth(
    key,
    opts.cfg.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta",
    `/models/${opts.model}:generateContent`,
  );
  try {
    const res = await fetch(gcUrl, {
      method: "POST",
      headers: gcHeaders,
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const dataUrl = imageDataUrlFromGenerateContent(json);
      if (dataUrl) return dataUrl;
    } else if (refs.length > 0) {
      // If multimodal failed but we have images, don't fall back to text-only endpoint
      const t = await res.text().catch(() => "");
      throw new Error(`Gemini generateContent error ${res.status}: ${t.slice(0, 400)}`);
    }
  } catch (e) {
    if (refs.length > 0) throw e; // Reraise if we needed multimodal
  }

  // Fallback: images:generate endpoint (legacy/Imagen)
  const base = (opts.cfg.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta2").replace(
    /\/$/,
    "",
  );
  const { url, headers } = geminiAuth(key, base, "/images:generate");
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      image_count: 1,
      size: opts.size ?? "1024x1024",
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${t.slice(0, 400)}`);
  }
  const json = await res.json();
  const legacy = imageDataUrlFromGenerateContent(json);
  const dataUrl = legacy ?? (await imageDataUrlFromImagesApi(json));
  if (!dataUrl) throw new Error("Gemini returned no image — try another prompt or model.");
  return dataUrl;
}

export interface GeminiTextOpts {
  cfg: AiCfg;
  prompt: string;
  model: string;
  referenceImage?: string;
}

export async function generateGeminiText(opts: GeminiTextOpts): Promise<string> {
  const key = getGeminiKey(opts.cfg);
  if (!key) throw new Error("Set GEMINI_API_KEY or GOOGLE_AI_API_KEY environment variable");

  const parts: unknown[] = [{ text: opts.prompt }];
  if (opts.referenceImage) {
    const ref = parseDataUrl(opts.referenceImage);
    if (ref) parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
  }

  const { url, headers } = geminiAuth(
    key,
    opts.cfg.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta",
    `/models/${opts.model}:generateContent`,
  );
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ contents: [{ role: "user", parts }] }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${t.slice(0, 400)}`);
  }
  const json = await res.json();
  const text = textFromGenerateContent(json);
  if (!text) throw new Error("Gemini returned no text.");
  return text;
}
