import { bridge } from "../lib/bridge";
import type { PlatformAccount } from "../lib/platformAccounts";
import {
  getProvidersForServiceType,
  normalizeProviderSettings,
} from "../lib/modelProviders";
import { isCodexApiKeyAccount } from "../types/codex";

export interface CodexProviderOverviewItem {
  id: string;
  name: string;
  baseUrl: string;
  linkedAccountCount: number;
  linkedAccountNames: string[];
  enabledForChat: boolean;
  apiKeyMasked: string;
  updatedAt: string;
}

function normalizeBaseUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.replace(/\/+$/, "").toLowerCase();
}

function maskApiKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export async function listCodexProviderOverview(
  accounts: PlatformAccount[]
): Promise<CodexProviderOverviewItem[]> {
  const settings = normalizeProviderSettings(await bridge.getSettings());
  const providers = getProvidersForServiceType(settings, "openaiCompatible");

  return providers.map((provider) => {
    const normalizedProviderBaseUrl = normalizeBaseUrl(provider.baseUrl);
    const linkedAccounts = accounts.filter((account) => {
      if (!isCodexApiKeyAccount(account)) return false;
      if (account.apiProviderId?.trim() === provider.id) return true;
      return normalizeBaseUrl(account.apiBaseUrl) === normalizedProviderBaseUrl;
    });

    return {
      id: provider.id,
      name: provider.name.trim() || "OpenAI Compatible Provider",
      baseUrl: provider.baseUrl.trim(),
      linkedAccountCount: linkedAccounts.length,
      linkedAccountNames: linkedAccounts
        .map((account) => account.displayName || account.email)
        .filter(Boolean)
        .slice(0, 3),
      enabledForChat: provider.enabled,
      apiKeyMasked: maskApiKey(provider.apiKey),
      updatedAt: provider.updatedAt,
    };
  });
}
