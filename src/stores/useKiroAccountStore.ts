import type { KiroAccount } from "../types/kiro";
import * as kiroService from "../services/kiroService";
import { getProviderCurrentAccountId } from "../services/providerCurrentAccountService";
import { createProviderAccountStore } from "./createProviderAccountStore";

const KIRO_ACCOUNTS_CACHE_KEY = "multi-cli-studio.kiro.accounts.cache";
const KIRO_CURRENT_ACCOUNT_ID_KEY = "multi-cli-studio.kiro.current_account_id";

export const useKiroAccountStore = createProviderAccountStore<KiroAccount>(
  KIRO_ACCOUNTS_CACHE_KEY,
  {
    listAccounts: kiroService.listKiroAccounts,
    deleteAccount: kiroService.deleteKiroAccount,
    deleteAccounts: kiroService.deleteKiroAccounts,
    injectAccount: kiroService.injectKiroToVSCode,
    refreshToken: kiroService.refreshKiroToken,
    refreshAllTokens: kiroService.refreshAllKiroTokens,
    importFromJson: kiroService.importKiroFromJson,
    exportAccounts: kiroService.exportKiroAccounts,
    updateAccountTags: kiroService.updateKiroAccountTags,
  },
  {
    getDisplayEmail: (account) => account.email?.trim() || account.user_id?.trim() || account.id,
    getPlanBadge: (account) => account.plan_type || account.plan_name || account.plan_tier || "UNKNOWN",
    getUsage: (account) => {
      const percentage =
        typeof account.quota?.weekly_percentage === "number"
          ? account.quota.weekly_percentage
          : typeof account.quota?.hourly_percentage === "number"
            ? account.quota.hourly_percentage
            : null;
      const reset =
        account.quota?.weekly_reset_time ??
        account.quota?.hourly_reset_time ??
        account.usage_reset_at ??
        null;
      return {
        inlineSuggestionsUsedPercent: percentage,
        chatMessagesUsedPercent: percentage,
        allowanceResetAt: reset,
      };
    },
  },
  {
    platformId: "kiro",
    currentAccountIdKey: KIRO_CURRENT_ACCOUNT_ID_KEY,
    resolveCurrentAccountId: () => getProviderCurrentAccountId("kiro"),
  }
);

