import { useAuth } from "./useAuth";
import { useEntitlements } from "./entitlements";
import { useSubscriptionStore } from "./subscriptionStore";
import { isCanonicalTierActive } from "./tierMap";

export function useWorkspaceAccess() {
  const { user, loading: authLoading } = useAuth();
  const adminMode = useSubscriptionStore((s) => s.adminMode);
  const { data: ent, isLoading: entLoading, isFetched } = useEntitlements();

  const isAuthenticated = !!user || adminMode;
  const hasActivePlan =
    adminMode ||
    (!!ent &&
      ent.subscriptionTier !== "none" &&
      isCanonicalTierActive(ent.subscriptionTier, ent.basePlanExpiry));

  const canAccessWorkspace =
    adminMode || (isAuthenticated && hasActivePlan && !authLoading && isFetched && !entLoading);

  return {
    user,
    ent,
    authLoading,
    entLoading,
    isAuthenticated,
    hasActivePlan,
    canAccessWorkspace,
    adminMode,
  };
}
