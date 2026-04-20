import {
  updateCodexApiKeyCredentials,
  type PlatformCenterState,
} from "../lib/platformAccounts";
import { bridge } from "../lib/bridge";
import {
  getProvidersForServiceType,
  normalizeProviderSettings,
} from "../lib/modelProviders";

export interface CodexQuickSwitchProviderOption {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
}

export interface CodexQuickSwitchTarget {
  accountId: string;
  providerId: string;
}

function maskApiKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export async function listCodexQuickSwitchProviders(): Promise<CodexQuickSwitchProviderOption[]> {
  const settings = normalizeProviderSettings(await bridge.getSettings());
  return getProvidersForServiceType(settings, "openaiCompatible")
    .filter((provider) => provider.apiKey.trim())
    .map((provider) => ({
      id: provider.id,
      name: provider.name.trim() || "OpenAI Compatible Provider",
      baseUrl: provider.baseUrl.trim(),
      apiKeyMasked: maskApiKey(provider.apiKey),
    }));
}

export async function switchCodexAccountProvider(
  target: CodexQuickSwitchTarget
): Promise<PlatformCenterState> {
  const settings = normalizeProviderSettings(await bridge.getSettings());
  const provider = getProvidersForServiceType(settings, "openaiCompatible").find(
    (item) => item.id === target.providerId
  );
  if (!provider) {
    throw new Error("未找到要切换的 provider。");
  }
  if (!provider.apiKey.trim()) {
    throw new Error("目标 provider 没有可用 API Key。");
  }

  return updateCodexApiKeyCredentials(target.accountId, provider.apiKey, {
    apiBaseUrl: provider.baseUrl,
    apiProviderId: provider.id,
    apiProviderName: provider.name,
  });
}
