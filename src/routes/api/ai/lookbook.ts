// POST /api/ai/lookbook — Faceless model wearing garment with exact texture reference.
import { createFileRoute } from "@tanstack/react-router";
import rootConfig from "../../../../APP_DATA_0.json";
import { getPromptForTask } from "@/lib/fabrixa/ai/prompts";
import { generateGeminiImage } from "@/lib/fabrixa/ai/geminiServer";

type AiCfg = {
  apiKey: string;
  baseUrl?: string;
  imageModel?: string;
};

const cfg = (rootConfig as { ai: AiCfg }).ai;

export const Route = createFileRoute("/api/ai/lookbook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            textureImage?: string;
            garmentType?: string;
            gender?: "woman" | "man";
            view?: "front" | "back";
            priorFrontImage?: string;
          };

          if (!body.textureImage) {
            return Response.json({ error: "textureImage required" }, { status: 400 });
          }

          const view = body.view ?? "front";
          const task = view === "back" ? "lookbookBack" : "lookbookFront";
          const model = cfg.imageModel ?? "gemini-2.5-flash-image";

          const promptText = getPromptForTask("lookbook", task, {
            garmentType: body.garmentType ?? "garment",
            gender: body.gender ?? "woman",
            priorFrontImage: body.priorFrontImage,
          });

          const referenceImages = [body.textureImage];
          if (view === "back" && body.priorFrontImage) {
            referenceImages.push(body.priorFrontImage);
          }

          const dataUrl = await generateGeminiImage({
            cfg,
            prompt: promptText,
            model,
            size: "1024x1024",
            referenceImages,
          });

          return Response.json({
            dataUrl,
            view,
            provider: "gemini",
            model,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Lookbook render failed";
          const status =
            msg.includes("GEMINI_API_KEY") || msg.includes("GOOGLE_AI_API_KEY") ? 503 : 500;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
