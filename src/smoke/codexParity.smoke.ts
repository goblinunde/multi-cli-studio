import type { PlatformAccount } from "../lib/platformAccounts";
import type { CodexProviderOverviewItem } from "../services/codexProviderOverviewService";
import type { CodexQuickSwitchTarget } from "../services/codexQuickSwitchService";
import {
  canQuickSwitchCodexProvider,
  resolveCodexQuotaErrorMeta,
} from "../types/codex";

const apiKeyAccount: PlatformAccount = {
  id: "codex-api-key",
  email: "api-key@codex.local",
  displayName: "Codex API Key",
  authMode: "apiKey",
  plan: null,
  status: "active",
  tags: [],
  createdAt: "2026-04-20T00:00:00.000Z",
  lastUsedAt: null,
  detail: null,
  apiProviderId: "provider-openai",
  quotaError: {
    message: "API 返回错误 401 [error_code:token_invalidated]",
  },
};

const quotaMeta = resolveCodexQuotaErrorMeta(apiKeyAccount.quotaError);
const canQuickSwitch = canQuickSwitchCodexProvider(apiKeyAccount);

const target: CodexQuickSwitchTarget = {
  accountId: apiKeyAccount.id,
  providerId: "provider-openai",
};

const providerOverview: CodexProviderOverviewItem = {
  id: "provider-openai",
  name: "OpenAI Official",
  baseUrl: "https://api.openai.com",
  linkedAccountCount: 1,
  linkedAccountNames: ["Codex API Key"],
  enabledForChat: true,
  apiKeyMasked: "sk-••••1234",
  updatedAt: "2026-04-20T00:00:00.000Z",
};

void quotaMeta;
void canQuickSwitch;
void target;
void providerOverview;
