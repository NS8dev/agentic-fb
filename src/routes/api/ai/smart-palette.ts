// POST /api/ai/smart-palette — Extract harmonized textile color palettes from images.
import { createFileRoute } from "@tanstack/react-router";
import rootConfig from "../../../../APP_DATA_0.json";
import { promptForSmartPalette } from "@/lib/fabrixa/ai/prompts";
import { generateGeminiText } from "@/lib/fabrixa/ai/geminiServer";

type AiCfg = {
  apiKey: string;
  baseUrl?: string;
  textModel?: string;
};

const cfg = (rootConfig as { ai: AiCfg }).ai;

function parsePaletteJson(text: string): { colors: string[]; names?: string[] } | null {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      colors?: string[];
      names?: string[];
    };
    if (!Array.isArray(parsed.colors) || parsed.colors.length === 0) return null;
    const colors = parsed.colors
      .map((c) => (typeof c === "string" && c.startsWith("#") ? c.toUpperCase() : null))
      .filter(Boolean) as string[];
    if (!colors.length) return null;
    return { colors, names: parsed.names };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/ai/smart-palette")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            referenceImage?: string;
            styleBrief?: string;
          };

          const text = await generateGeminiText({
            cfg,
            prompt: promptForSmartPalette(body.styleBrief),
            model: cfg.textModel ?? "gemini-2.5-flash-image",
            referenceImage: body.referenceImage,
          });

          const palette = parsePaletteJson(text);
          if (!palette) {
            return Response.json(
              { error: "Could not parse palette from AI response" },
              { status: 502 },
            );
          }

          return Response.json({ ...palette, provider: "gemini" });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Smart palette failed";
          const status =
            msg.includes("GEMINI_API_KEY") || msg.includes("GOOGLE_AI_API_KEY") ? 503 : 500;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
