// Centralized textile AI system prompts — seamless, repeatable, fabric-print ready.

export const TEXTILE_SEAMLESS_SUFFIX =
  "Output must be a perfectly tileable seamless square textile pattern. All four edges must match when repeated horizontally and vertically. No text, no watermarks, no borders, no logos. Flat lay fabric design suitable for garment printing and CAD repeat.";

export function promptForTextToDesign(userPrompt: string): string {
  return `Generate a production-ready seamless textile/fabric pattern from this description: "${userPrompt}".

Requirements:
- Square 1:1 aspect ratio, flat lay textile artwork
- Motif scale and spacing suitable for fashion fabric repeats
- Clean edges that tile flawlessly in a 2×2 grid
- High detail, print-ready color separation friendly design
${TEXTILE_SEAMLESS_SUFFIX}`;
}

export function promptForSketchToDesign(userPrompt: string): string {
  const brief = userPrompt.trim()
    ? `Design brief: "${userPrompt}".`
    : "Convert the sketch into a polished production pattern.";
  return `Transform the attached sketch/reference into a refined, seamless textile pattern for garment printing.

${brief}

Requirements:
- Preserve the core motif and composition from the reference sketch
- Refine lines, colors, and repeat spacing for professional fabric CAD
- Remove sketch artifacts, pencil noise, and background clutter
- Output a tileable square pattern with matched edges
${TEXTILE_SEAMLESS_SUFFIX}`;
}

export function promptForSmartPalette(styleBrief?: string): string {
  const brief = styleBrief?.trim()
    ? `Style direction: "${styleBrief}".`
    : "Extract a harmonious fashion textile palette.";
  return `${brief}

Analyze the reference image and return ONLY valid JSON (no markdown):
{"colors":["#hex1","#hex2","#hex3","#hex4","#hex5","#hex6"],"names":["name1","name2","name3","name4","name5","name6"]}

Rules:
- 4–8 hex colors (#RRGGBB) that work together for textile design
- Include dominant, secondary, accent, and neutral tones
- Names should be descriptive (e.g. "Deep Navy", "Gold Foil")`;
}

export function promptForPromptEnhance(raw: string): string {
  return `You are a senior textile CAD designer. Expand this brief into a detailed, repeatable fabric pattern specification.

Original brief: "${raw}"

Return ONLY the enhanced prompt text (no JSON, no markdown). Include:
- Motif type and scale (e.g. micro floral, medium geometric)
- Color palette direction with specific hues
- Repeat style (half-drop, straight, mirror) if relevant
- Texture/material feel (jacquard, satin, cotton print)
- Edge behavior: seamless tileable square pattern
- Style adjectives for consistency across generations`;
}

export function promptForImageClean(): string {
  return `Clean and enhance this textile pattern image for professional fabric CAD use.

Requirements:
- Remove noise, compression artifacts, JPEG blocks, and background clutter
- Sharpen motif edges while preserving pattern structure
- Maintain exact colors and repeat layout — do not redesign the pattern
- Keep seamless tileability if present
- Output high-quality flat textile artwork
${TEXTILE_SEAMLESS_SUFFIX}`;
}

export interface LookbookPromptOpts {
  garmentType: string;
  gender: "woman" | "man";
  view: "front" | "back";
  hasPriorFront?: boolean;
}

export function promptForLookbook(opts: LookbookPromptOpts): string {
  const genderLabel = opts.gender === "woman" ? "female" : "male";
  const viewLabel = opts.view === "front" ? "front view" : "back view";
  const consistency =
    opts.view === "back" && opts.hasPriorFront
      ? "Match the same model body, pose framing, lighting, and garment fit as the provided front-view reference."
      : "";

  return `Create a photorealistic fashion lookbook photograph of a faceless ${genderLabel} model wearing a garment (${opts.garmentType}) — ${viewLabel}.

Requirements:
- Faceless: crop at neck or heavily blur/obscure face — no identifiable facial features
- Model wears the EXACT fabric texture/pattern from the attached reference swatch
- Realistic fabric draping, natural folds, and correct garment silhouette for ${opts.garmentType}
- Studio lighting, neutral/plain background, editorial fashion quality
- Show texture detail clearly on the garment surface
- Full body or 3/4 body framing appropriate for lookbook
${consistency}

Do not change the pattern design. Do not add text or watermarks.`;
}

export function promptForImageGen(basePrompt: string): string {
  return promptForTextToDesign(basePrompt);
}

export function promptForImageEdit(basePrompt: string): string {
  return `Modify or reimagine this textile pattern based on: "${basePrompt}". ${TEXTILE_SEAMLESS_SUFFIX}`;
}

export function promptForNeckDesign(basePrompt: string): string {
  return `Design a neckline pattern for a garment based on: "${basePrompt}". Create a close-up detailed design suitable as a fashion neckline template. Include decorative elements if described.`;
}

export function promptForTextToPattern(basePrompt: string): string {
  return promptForTextToDesign(basePrompt);
}

export type ImageTaskType =
  | "imageGen"
  | "imageEdit"
  | "neckDesign"
  | "textToPattern"
  | "textToDesign"
  | "sketchToDesign"
  | "imageClean"
  | "lookbookFront"
  | "lookbookBack";

export function getPromptForTask(
  basePrompt: string,
  task: ImageTaskType,
  opts?: { garmentType?: string; gender?: "woman" | "man"; priorFrontImage?: string },
): string {
  switch (task) {
    case "textToDesign":
    case "textToPattern":
      return promptForTextToDesign(basePrompt);
    case "sketchToDesign":
      return promptForSketchToDesign(basePrompt);
    case "imageClean":
      return promptForImageClean();
    case "lookbookFront":
      return promptForLookbook({
        garmentType: opts?.garmentType ?? "garment",
        gender: opts?.gender ?? "woman",
        view: "front",
      });
    case "lookbookBack":
      return promptForLookbook({
        garmentType: opts?.garmentType ?? "garment",
        gender: opts?.gender ?? "woman",
        view: "back",
        hasPriorFront: !!opts?.priorFrontImage,
      });
    case "neckDesign":
      return promptForNeckDesign(basePrompt);
    case "imageEdit":
      return promptForImageEdit(basePrompt);
    case "imageGen":
    default:
      return promptForImageGen(basePrompt);
  }
}
