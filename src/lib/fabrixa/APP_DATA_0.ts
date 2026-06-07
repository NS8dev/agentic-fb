// =============================================================
// APP_DATA_0 — central config for Fabrixa.
// SECRETS (db.firebase, razorpay.*) come from /APP_DATA_0.json in
// the project root — single source of truth, per spec.
// =============================================================
import rootConfig from "../../../APP_DATA_0.json";

const ROOT = rootConfig as {
  db: {
    provider: "firebase" | "supabase";
    firebase: {
      apiKey: string;
      authDomain: string;
      projectId: string;
      storageBucket: string;
      messagingSenderId: string;
      appId: string;
      measurementId?: string;
    };
  };
  razorpay: {
    rzp_key_id: string;
    rzp_key_secret: string;
    rzp_webhook_secret: string;
    currency: string;
  };
  ai: {
    provider: string;
    apiKey: string;
    baseUrl: string;
    imageModel?: string;
    textModel?: string;
  };
};

export const APP_DATA_0 = {
  ai: {
    provider: ROOT.ai.provider as "openai" | "gemini" | "replicate" | "custom",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ROOT.ai.apiKey,
    baseUrl:
      ROOT.ai.baseUrl ??
      (ROOT.ai.provider === "openai"
        ? "https://api.openai.com/v1"
        : "https://generativelanguage.googleapis.com/v1beta2"),
    imageModel: ROOT.ai.imageModel ?? "gemini-2.5-flash-image",
    textModel: ROOT.ai.textModel ?? "gemini-2.5-flash-image",
    models: {
      imageGen: ROOT.ai.imageModel ?? "gemini-2.5-flash-image",
      imageEdit: ROOT.ai.imageModel ?? "gemini-2.5-flash-image",
      neckDesign: ROOT.ai.imageModel ?? "gemini-2.5-flash-image",
      textToPattern: ROOT.ai.textModel ?? "gemini-2.5-flash-image",
      textToDesign: ROOT.ai.imageModel ?? "gemini-2.5-flash-image",
      sketchToDesign: ROOT.ai.imageModel ?? "gemini-2.5-flash-image",
      imageClean: ROOT.ai.imageModel ?? "gemini-2.5-flash-image",
      lookbookFront: ROOT.ai.imageModel ?? "gemini-2.5-flash-image",
      lookbookBack: ROOT.ai.imageModel ?? "gemini-2.5-flash-image",
      promptEnhance: ROOT.ai.textModel ?? "gemini-2.5-flash-image",
      smartPalette: ROOT.ai.textModel ?? "gemini-2.5-flash-image",
    },
    maxRequestsPerMinute: 20,
    maxRequestsPerDay: 500,
    timeoutMs: 60_000,
  },

  db: {
    provider: ROOT.db.provider,
    firebase: ROOT.db.firebase,
    // STRICT: exactly three flat top-level collections. No subcollections.
    collections: {
      users: "users",
      projects: "projects",
      showroomDesigns: "showroomDesigns",
    },
  },

  // ----- Razorpay (read from root APP_DATA_0.json) -----
  razorpay: ROOT.razorpay,

  // ----- Coin economy (per-action costs) -----
  coinCosts: {
    uploadPattern: 2,
    render3d: 3,
    exportNormal: 4,
    exportHd: 6,
    showroomDownload: 6,
    aiGeneration: 10,
    aiTextToDesign: 8,
    aiSketchToDesign: 10,
    aiSmartPalette: 3,
    aiPromptEnhance: 2,
    aiLookbookRender: 15,
    imageClean: 4,
    patternVectorize: 5,
    colorSeparation: 4,
    seamlessExtend: 3,
    geometricRepeat: 2,
  },

  // ----- Subscription tiers -----
  tiers: {
    starter_4000: {
      id: "starter_4000",
      label: "Starter",
      priceInr: 4000,
      dailyAllowance: 50,
      maxSaves: 8,
      maxShowroomDownloadsPerDay: 2,
      allowedModels: ["kurti", "salwar", "gown", "shirt", "tshirt", "pant"],
      allowedMaterials: ["cotton", "satin"],
      allowedBackgrounds: ["transparent", "black"],
      aiIncluded: false,
      allowCustomGlb: false,
      alignmentGuides: false,
    },
    studio_16000: {
      id: "studio_16000",
      label: "Studio",
      priceInr: 16000,
      dailyAllowance: 220,
      maxSaves: 100,
      maxShowroomDownloadsPerDay: 15,
      allowedModels: "ALL" as const,
      allowedMaterials: "ALL" as const,
      allowedBackgrounds: "ALL" as const,
      aiIncluded: true,
      allowCustomGlb: false,
      alignmentGuides: false,
    },
    prod_24000: {
      id: "prod_24000",
      label: "Production",
      priceInr: 24000,
      dailyAllowance: 1200,
      maxSaves: Infinity,
      maxShowroomDownloadsPerDay: 100,
      allowedModels: "ALL" as const,
      allowedMaterials: "ALL" as const,
      allowedBackgrounds: "ALL" as const,
      aiIncluded: true,
      allowCustomGlb: true,
      alignmentGuides: true,
    },
  },

  // ----- AI Pack add-on -----
  aiPack: {
    priceInr: 900,
    dailyRequests: 20,
    durationDays: 30,
  },

  // ----- Admin bypass (loaded from /admin.json at runtime; this is fallback) -----
  admin: {
    enabled: true,
    bypassLabel: "Admin Demo",
  },

  // ===== Legacy fields kept for back-compat with existing editor code =====
  credits: {
    startingBalance: 50,
    dailyFreeGrant: 0,
    costs: {
      aiImageGen: 10,
      aiImageEdit: 10,
      aiNeckDesign: 10,
      export: 4,
      render3d: 3,
    },
    render3dByType: {
      shirt: 3,
      tshirt: 3,
      pant: 3,
      trackpants: 3,
      hoodie: 3,
      skirt: 3,
      lehenga: 3,
      gown: 3,
      kurti: 3,
      kurta: 3,
      salwar: 3,
      coat: 3,
      plazo: 3,
      jacket: 3,
      dress: 3,
    } as Record<string, number>,
  },

  storage: { bucket: "fabrixa-uploads", publicReadPrefix: "public/" },

  features: {
    aiSection: true,
    lassoSelect: true,
    neckDesigner: true,
    gradientColors: true,
    creditSystem: true,
    cloudSync: true,
    subscriptionPaywall: true,
  },

  perf: { maxTextureSize: 1024, maxAnisotropy: 8, targetFps: 30, dprCap: 2 },

  fabricPresets: {
    cotton: {
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.05,
      sheenRoughness: 0.9,
      clearcoat: 0.0,
      envIntensity: 0.65,
    },
    linen: {
      roughness: 0.96,
      metalness: 0.0,
      sheen: 0.1,
      sheenRoughness: 0.8,
      clearcoat: 0.0,
      envIntensity: 0.6,
    },
    silk: {
      roughness: 0.35,
      metalness: 0.05,
      sheen: 0.95,
      sheenRoughness: 0.2,
      clearcoat: 0.15,
      envIntensity: 0.95,
    },
    satin: {
      roughness: 0.25,
      metalness: 0.08,
      sheen: 0.85,
      sheenRoughness: 0.25,
      clearcoat: 0.25,
      envIntensity: 1.05,
    },
    velvet: {
      roughness: 0.98,
      metalness: 0.0,
      sheen: 1.0,
      sheenRoughness: 0.1,
      clearcoat: 0.0,
      envIntensity: 0.55,
    },
    denim: {
      roughness: 0.94,
      metalness: 0.0,
      sheen: 0.03,
      sheenRoughness: 0.9,
      clearcoat: 0.0,
      envIntensity: 0.55,
    },
    chiffon: {
      roughness: 0.6,
      metalness: 0.0,
      sheen: 0.55,
      sheenRoughness: 0.4,
      clearcoat: 0.05,
      envIntensity: 0.85,
    },
    wool: {
      roughness: 0.98,
      metalness: 0.0,
      sheen: 0.35,
      sheenRoughness: 0.5,
      clearcoat: 0.0,
      envIntensity: 0.5,
    },
    leather: {
      roughness: 0.45,
      metalness: 0.15,
      sheen: 0.15,
      sheenRoughness: 0.5,
      clearcoat: 0.4,
      envIntensity: 1.1,
    },
  },

  tiling: {
    defaultMode: "world" as "uv" | "world",
    defaultWorldScale: 0.2,
    triplanarBlend: 4.0,
  },

  debug: { showTilingOverlay: false },

  selection: {
    defaultBrushSize: 36,
    defaultFeatherPx: 12,
    defaultOpacity: 1.0,
    defaultExpandPx: 0,
    antsSpeedMs: 60,
    antsDash: [6, 4] as [number, number],
    pointerThrottleMs: 16,
    maxPolygonPoints: 256,
  },

  embroidery: {
    threadColors: ["#d4af37", "#b8002a", "#1c2538", "#0f3460", "#7e3c8c", "#ffffff"],
    defaultDensity: 3,
  },
} as const;

export type AppConfig = typeof APP_DATA_0;
export type FabricPresetId = keyof typeof APP_DATA_0.fabricPresets;
export const FABRIC_PRESET_IDS = Object.keys(APP_DATA_0.fabricPresets) as FabricPresetId[];

export type SubscriptionTierId = keyof typeof APP_DATA_0.tiers;
export type CoinAction = keyof typeof APP_DATA_0.coinCosts;
