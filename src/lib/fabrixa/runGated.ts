// Gated features: active plan → daily cap → coin balance → DB spend → action.
import { useCallback } from "react";
import { toast } from "sonner";
import {
  useEntitlements,
  useInvalidateEntitlements,
  checkDailyCap,
  checkCoinBalance,
  type FeatureCostKey,
} from "./entitlements";
import { persistFeatureSpend } from "./spendFeature";
import { useSubscriptionStore } from "./subscriptionStore";
import { openSubscriptionDialog } from "@/components/fabrixa/SubscriptionRequiredDialog";

export function useRunGated() {
  const { data: ent } = useEntitlements();
  const invalidate = useInvalidateEntitlements();

  return useCallback(
    async function runGated<T>(
      feature: FeatureCostKey,
      action: () => Promise<T> | T,
    ): Promise<T | null> {
      const adminMode = useSubscriptionStore.getState().adminMode;

      if (adminMode) {
        // Map FeatureCostKey to CoinAction for local spend
        const mapping: Record<FeatureCostKey, import("./APP_DATA_0").CoinAction | null> = {
          STANDARD_EXPORT: "exportNormal",
          SAVE_PROJECT: null,
          IMAGE_UPLOAD: "uploadPattern",
          HD_RENDER_4K: "exportHd",
          SHOWROOM_UNLOCK: "showroomDownload",
          AI_GENERATION: "aiGeneration",
          MASKED_APPLY: "render3d",
          APPLY_TO_MODEL: "render3d",
          AI_TEXT_TO_DESIGN: "aiTextToDesign",
          AI_SKETCH_TO_DESIGN: "aiSketchToDesign",
          AI_SMART_PALETTE: "aiSmartPalette",
          AI_PROMPT_ENHANCE: "aiPromptEnhance",
          AI_LOOKBOOK_RENDER: "aiLookbookRender",
          IMAGE_CLEAN: "imageClean",
          PATTERN_VECTORIZE: "patternVectorize",
          COLOR_SEPARATION: "colorSeparation",
          SEAMLESS_EXTEND: "seamlessExtend",
          GEOMETRIC_REPEAT: "geometricRepeat",
        };
        const actionKey = mapping[feature];
        if (actionKey) {
          const result = useSubscriptionStore.getState().spend(actionKey);
          if (!result.ok) {
            toast.error(result.reason || "Not enough coins (Admin)");
            return null;
          }
        }
        try {
          return await action();
        } catch (err) {
          toast.error(`Action failed: ${(err as Error).message}`);
          throw err;
        }
      }

      if (!ent || ent.subscriptionTier === "none") {
        openSubscriptionDialog(feature);
        return null;
      }

      const capError = checkDailyCap(ent, feature);
      if (capError) {
        toast.error(capError);
        return null;
      }

      const coinError = checkCoinBalance(ent, feature);
      if (coinError) {
        toast.error(coinError);
        return null;
      }

      const spend = await persistFeatureSpend(ent.userId, feature, ent);
      if (!spend.ok) {
        toast.error(`Could not charge: ${spend.message}`);
        return null;
      }

      useSubscriptionStore.setState({
        coinBalance: spend.patch.coinBalance,
        dailyAiRequestsRemaining:
          spend.patch.dailyAiRequestsRemaining ?? ent.dailyAiRequestsRemaining,
        dailyShowroomDownloadsCount:
          spend.patch.dailyShowroomDownloadsCount ?? ent.dailyShowroomDownloadsCount,
      });
      void invalidate();

      try {
        return await action();
      } catch (err) {
        toast.error(`Action failed: ${(err as Error).message}`);
        throw err;
      }
    },
    [ent, invalidate],
  );
}

export async function runGated<T>(
  _feature: FeatureCostKey,
  fn: () => Promise<T> | T,
): Promise<T | null> {
  console.warn("[runGated] legacy call — migrate to useRunGated()");
  return await fn();
}
