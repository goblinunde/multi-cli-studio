import type { PlatformAccount, PlatformQuotaError } from "../lib/platformAccounts";

export type CodexApiProviderMode = "openai_builtin" | "custom";

export type CodexAccount = PlatformAccount & {
  apiProviderMode?: CodexApiProviderMode | string | null;
};

export interface CodexQuota {
  hourly_percentage: number;
  hourly_reset_time?: number | null;
  weekly_percentage: number;
  weekly_reset_time?: number | null;
  raw_data?: unknown;
}

export interface CodexQuotaErrorMeta {
  statusCode: string;
  errorCode: string;
  displayText: string;
  rawMessage: string;
}

export function isCodexApiKeyAccount(account: PlatformAccount): account is CodexAccount {
  return account.authMode === "apiKey" || Boolean(account.openaiApiKey);
}

export function resolveCodexQuotaErrorMeta(
  quotaError?: PlatformQuotaError | null
): CodexQuotaErrorMeta {
  if (!quotaError?.message) {
    return {
      statusCode: "",
      errorCode: "",
      displayText: "",
      rawMessage: "",
    };
  }

  const rawMessage = quotaError.message.trim();
  const lowerRawMessage = rawMessage.toLowerCase();
  const requestErrorIndex = lowerRawMessage.indexOf("error sending request");
  const requestErrorMessage =
    requestErrorIndex >= 0
      ? rawMessage.slice(requestErrorIndex).trim()
      : rawMessage;
  const statusCode =
    rawMessage.match(/API 返回错误\s+(\d{3})/i)?.[1] ??
    rawMessage.match(/status[=: ]+(\d{3})/i)?.[1] ??
    "";
  const errorCode =
    quotaError.code?.trim() ??
    rawMessage.match(/\[error_code:([^\]]+)\]/)?.[1]?.trim() ??
    "";

  return {
    statusCode,
    errorCode,
    displayText: errorCode || requestErrorMessage || rawMessage,
    rawMessage,
  };
}

export function canQuickSwitchCodexProvider(account: PlatformAccount) {
  return isCodexApiKeyAccount(account);
}

export function hasCodexAccountStructure(account: PlatformAccount) {
  return Boolean(account.accountStructure?.trim());
}

export function hasCodexAccountName(account: PlatformAccount) {
  return Boolean(account.accountName?.trim());
}

export function isCodexTeamLikePlan(planType?: string | null) {
  const normalized = planType?.trim().toLowerCase() ?? "";
  return normalized.includes("team") || normalized.includes("enterprise");
}

export function getCodexPlanBadgeLabel(account: PlatformAccount) {
  const normalized =
    account.planType?.trim() ||
    account.plan?.trim() ||
    (isCodexApiKeyAccount(account) ? "API KEY" : "TOKEN");
  return normalized.toUpperCase();
}
