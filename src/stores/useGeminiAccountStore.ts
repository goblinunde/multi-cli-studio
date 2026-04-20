import type { GeminiAccount } from "../types/gemini";
import * as geminiService from "../services/geminiService";
import { getProviderCurrentAccountId } from "../services/providerCurrentAccountService";
import { createProviderAccountStore } from "./createProviderAccountStore";

const GEMINI_ACCOUNTS_CACHE_KEY = "multi-cli-studio.gemini.accounts.cache";
const GEMINI_CURRENT_ACCOUNT_ID_KEY = "multi-cli-studio.gemini.current_account_id";

export const useGeminiAccountStore = createProviderAccountStore<GeminiAccount>(
  GEMINI_ACCOUNTS_CACHE_KEY,
  {
    listAccounts: geminiService.listGeminiAccounts,
    deleteAccount: geminiService.deleteGeminiAccount,
    deleteAccounts: geminiService.deleteGeminiAccounts,
    injectAccount: geminiService.injectGeminiAccount,
    refreshToken: geminiService.refreshGeminiToken,
    refreshAllTokens: geminiService.refreshAllGeminiTokens,
    importFromJson: geminiService.importGeminiFromJson,
    exportAccounts: geminiService.exportGeminiAccounts,
    updateAccountTags: geminiService.updateGeminiAccountTags,
  },
  {
    getDisplayEmail: (account) => account.email?.trim() || account.name?.trim() || account.id,
    getPlanBadge: (account) => account.plan_type || account.plan_name || account.tier_id || "UNKNOWN",
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
        null;
      return {
        inlineSuggestionsUsedPercent: percentage,
        chatMessagesUsedPercent: percentage,
        allowanceResetAt: reset,
      };
    },
  },
  {
    platformId: "gemini",
    currentAccountIdKey: GEMINI_CURRENT_ACCOUNT_ID_KEY,
    resolveCurrentAccountId: () => getProviderCurrentAccountId("gemini"),
  }
);

