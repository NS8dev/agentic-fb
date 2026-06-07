// POST /api/ai/enhance-prompt — Expand vague textile briefs into detailed specs.
import { createFileRoute } from "@tanstack/react-router";
import rootConfig from "../../../../APP_DATA_0.json";
import { promptForPromptEnhance } from "@/lib/fabrixa/ai/prompts";
import { generateGeminiText } from "@/lib/fabrixa/ai/geminiServer";

type AiCfg = {
  apiKey: string;
  baseUrl?: string;
  textModel?: string;
};

const cfg = (rootConfig as { ai: AiCfg }).ai;

export const Route = createFileRoute("/api/ai/enhance-prompt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { prompt?: string };
          const prompt = body.prompt?.trim();
          if (!prompt) {
            return Response.json({ error: "prompt required" }, { status: 400 });
          }

          const enhancedPrompt = await generateGeminiText({
            cfg,
            prompt: promptForPromptEnhance(prompt),
            model: cfg.textModel ?? "gemini-2.5-flash-image",
          });

          return Response.json({ enhancedPrompt, provider: "gemini" });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Enhance failed";
          const status =
            msg.includes("GEMINI_API_KEY") || msg.includes("GOOGLE_AI_API_KEY") ? 503 : 500;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
