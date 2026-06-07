// POST /api/ai/generate — Google Gemini image generation with multimodal reference support.
import { createFileRoute } from "@tanstack/react-router";
import rootConfig from "../../../../APP_DATA_0.json";
import { getPromptForTask, type ImageTaskType } from "@/lib/fabrixa/ai/prompts";
import { generateGeminiImage } from "@/lib/fabrixa/ai/geminiServer";

type AiCfg = {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  imageModel?: string;
  textModel?: string;
};

const cfg = (rootConfig as { ai: AiCfg }).ai;

const IMAGE_TASKS: ImageTaskType[] = [
  "imageGen",
  "imageEdit",
  "neckDesign",
  "textToPattern",
  "textToDesign",
  "sketchToDesign",
  "imageClean",
  "lookbookFront",
  "lookbookBack",
];

const getModelForTask = (task: ImageTaskType): string => {
  const imageModel = cfg.imageModel ?? "gemini-2.5-flash-image";
  const textModel = cfg.textModel ?? "gemini-2.5-flash-image";
  if (task === "textToPattern") return textModel;
  return imageModel;
};

export const Route = createFileRoute("/api/ai/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            prompt?: string;
            task?: string;
            referenceImage?: string;
            referenceImages?: string[];
            size?: string;
            garmentType?: string;
            gender?: "woman" | "man";
            priorFrontImage?: string;
          };

          const task = (body.task || "imageGen") as ImageTaskType;
          if (!IMAGE_TASKS.includes(task)) {
            return Response.json({ error: `Unknown task: ${task}` }, { status: 400 });
          }

          const needsPrompt = task !== "imageClean" && !task.startsWith("lookbook");
          const prompt =
            body.prompt?.trim() ||
            (needsPrompt ? "" : task === "imageClean" ? "clean pattern" : "lookbook render");

          if (needsPrompt && !prompt && !body.referenceImage && !body.referenceImages?.length) {
            return Response.json({ error: "prompt required" }, { status: 400 });
          }

          if (task === "sketchToDesign" && !body.referenceImage && !body.referenceImages?.length) {
            return Response.json(
              { error: "referenceImage required for sketch-to-design" },
              { status: 400 },
            );
          }

          const size = body.size || "1024x1024";
          const model = getModelForTask(task);

          const promptText = getPromptForTask(prompt, task, {
            garmentType: body.garmentType,
            gender: body.gender,
            priorFrontImage: body.priorFrontImage,
          });

          const referenceImages: string[] = [];
          if (body.referenceImage) referenceImages.push(body.referenceImage);
          if (body.referenceImages) referenceImages.push(...body.referenceImages);
          if (body.priorFrontImage && task === "lookbookBack") {
            referenceImages.push(body.priorFrontImage);
          }

          const dataUrl = await generateGeminiImage({
            cfg,
            prompt: promptText,
            model,
            size,
            referenceImages: referenceImages.length ? referenceImages : undefined,
          });

          return Response.json({
            dataUrl,
            provider: "gemini",
            model,
            task,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "AI failed";
          const status =
            msg.includes("GEMINI_API_KEY") || msg.includes("GOOGLE_AI_API_KEY") ? 503 : 500;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
