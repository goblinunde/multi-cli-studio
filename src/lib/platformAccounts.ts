import { isTauriRuntime } from "./bridge";

export type PlatformId = "codex" | "gemini" | "kiro";
export type PlatformAuthMode = "oauth" | "token" | "apiKey";
export type PlatformAccountStatus = "active" | "warning" | "error";

export interface PlatformQuotaError {
  code?: string | null;
  message: string;
  timestamp?: string | null;
}

export interface PlatformQuotaSnapshot {
  hourlyPercentage?: number | null;
  hourlyResetTime?: string | null;
  weeklyPercentage?: number | null;
  weeklyResetTime?: string | null;
  creditsTotal?: number | null;
  creditsUsed?: number | null;
  bonusTotal?: number | null;
  bonusUsed?: number | null;
  usageResetAt?: string | null;
  rawData?: unknown;
}

export interface PlatformAccount {
  id: string;
  email: string;
  displayName: string | null;
  authMode: PlatformAuthMode;
  plan: string | null;
  status: PlatformAccountStatus;
  tags: string[];
  createdAt: string;
  lastUsedAt: string | null;
  detail: string | null;
  userId?: string | null;
  accountId?: string | null;
  organizationId?: string | null;
  accountName?: string | null;
  accountStructure?: string | null;
  loginProvider?: string | null;
  selectedAuthType?: string | null;
  apiBaseUrl?: string | null;
  apiProviderMode?: string | null;
  apiProviderId?: string | null;
  apiProviderName?: string | null;
  projectId?: string | null;
  tierId?: string | null;
  planType?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  idToken?: string | null;
  openaiApiKey?: string | null;
  quota?: PlatformQuotaSnapshot | null;
  quotaError?: PlatformQuotaError | null;
  creditsTotal?: number | null;
  creditsUsed?: number | null;
  bonusTotal?: number | null;
  bonusUsed?: number | null;
  usageResetAt?: string | null;
  raw?: unknown;
}

export interface PlatformInstance {
  id: string;
  name: string;
  accountId: string | null;
  command: string;
  status: "idle" | "ready" | "running";
  updatedAt: string;
}

export interface PlatformCenterState {
  accounts: PlatformAccount[];
  currentAccountId: string | null;
  instances: PlatformInstance[];
  featureState: Record<string, string | number | boolean>;
}

export interface PlatformManualAccountInput {
  email?: string;
  displayName?: string;
  token?: string;
  apiKey?: string;
  refreshToken?: string;
  baseUrl?: string;
}

export interface PlatformOAuthStart {
  loginId: string;
  authUrl?: string | null;
  verificationUri?: string | null;
  verificationUriComplete?: string | null;
  userCode?: string | null;
  callbackUrl?: string | null;
  expiresIn?: number | null;
  intervalSeconds?: number | null;
}

export interface CodexApiKeyCredentialUpdateInput {
  apiBaseUrl?: string | null;
  apiProviderId?: string | null;
  apiProviderName?: string | null;
}

export interface PlatformMeta {
  id: PlatformId;
  label: string;
  description: string;
  accentClass: string;
  tokenLabel: string;
  manualModes: PlatformAuthMode[];
  sections: Array<{
    id: string;
    title: string;
    description: string;
  }>;
}

type JsonRecord = Record<string, unknown>;

const STORAGE_PREFIX = "multi-cli-studio::platform-center";

export const PLATFORM_META: Record<PlatformId, PlatformMeta> = {
  codex: {
    id: "codex",
    label: "Codex",
    description: "OpenAI Codex 账号中心、本地访问、Wakeup、会话与模型提供方能力。",
    accentClass: "from-slate-900/95 via-slate-800/92 to-slate-700/88",
    tokenLabel: "Token / API Key",
    manualModes: ["token", "apiKey"],
    sections: [
      {
        id: "local-access",
        title: "Local Access",
        description: "管理本地 OpenAI 兼容入口、路由策略和默认 access key。",
      },
      {
        id: "wakeup",
        title: "Wakeup",
        description: "预热或轮换账号，减少 CLI 首次请求延迟。",
      },
      {
        id: "sessions",
        title: "Session Manager",
        description: "记录会话同步、可见性修复和线程整理入口。",
      },
      {
        id: "providers",
        title: "Model Providers",
        description: "维护 Codex 相关的 API 提供方与默认模型偏好。",
      },
    ],
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    description: "Google Gemini 账号中心、实例注入和启动命令管理。",
    accentClass: "from-emerald-700/95 via-teal-700/92 to-cyan-700/88",
    tokenLabel: "Access Token",
    manualModes: ["token"],
    sections: [
      {
        id: "launch",
        title: "Launch Commands",
        description: "维护 Gemini CLI 默认启动命令和注入后的启动提示。",
      },
      {
        id: "injection",
        title: "Instance Injection",
        description: "记录默认实例和注入目标目录。",
      },
    ],
  },
  kiro: {
    id: "kiro",
    label: "Kiro",
    description: "Kiro 账号中心、实例注入以及 credits 额度视图。",
    accentClass: "from-amber-700/95 via-orange-700/92 to-rose-700/88",
    tokenLabel: "Access Token",
    manualModes: ["token"],
    sections: [
      {
        id: "injection",
        title: "Instance Injection",
        description: "维护默认实例、注入目标和常用运行指令。",
      },
      {
        id: "credits",
        title: "Credits Snapshot",
        description: "记录 plan、credits、最近一次额度更新状态。",
      },
    ],
  },
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function toObject(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toPrimitiveRecord(value: unknown): Record<string, string | number | boolean> {
  const record = toObject(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter(([, item]) =>
      typeof item === "string" || typeof item === "number" || typeof item === "boolean"
    )
  ) as Record<string, string | number | boolean>;
}

function formatAuthMode(value: unknown, fallback: PlatformAuthMode): PlatformAuthMode {
  if (value === "oauth" || value === "token" || value === "apiKey") {
    return value;
  }
  return fallback;
}

function formatStatus(value: unknown): PlatformAccountStatus {
  if (value === "warning" || value === "error" || value === "active") {
    return value;
  }
  return "active";
}

function normalizeQuotaError(value: unknown): PlatformQuotaError | null {
  const record = toObject(value);
  if (record) {
    const message =
      toStringValue(record.message) ||
      toStringValue(record.error) ||
      toStringValue(record.reason);
    if (!message) return null;
    return {
      code: toStringValue(record.code),
      message,
      timestamp: toTimestamp(record.timestamp ?? record.created_at ?? record.updated_at),
    };
  }
  const message = toStringValue(value);
  return message
    ? {
        message,
        timestamp: null,
      }
    : null;
}

function normalizeQuotaSnapshot(record: JsonRecord): PlatformQuotaSnapshot | null {
  const quotaRecord = toObject(record.quota ?? record.quota_raw ?? record.raw_data);
  const creditsTotal =
    toNumberValue(record.credits_total) ??
    toNumberValue(record.prompt_credits_total) ??
    toNumberValue(quotaRecord?.credits_total);
  const creditsUsed =
    toNumberValue(record.credits_used) ??
    toNumberValue(record.prompt_credits_used) ??
    toNumberValue(quotaRecord?.credits_used);
  const bonusTotal =
    toNumberValue(record.bonus_total) ?? toNumberValue(quotaRecord?.bonus_total);
  const bonusUsed =
    toNumberValue(record.bonus_used) ?? toNumberValue(quotaRecord?.bonus_used);
  const hourlyPercentage =
    toNumberValue(record.hourly_percentage) ??
    toNumberValue(quotaRecord?.hourly_percentage);
  const weeklyPercentage =
    toNumberValue(record.weekly_percentage) ??
    toNumberValue(quotaRecord?.weekly_percentage);
  const hourlyResetTime = toTimestamp(
    record.hourly_reset_time ?? quotaRecord?.hourly_reset_time
  );
  const weeklyResetTime = toTimestamp(
    record.weekly_reset_time ?? quotaRecord?.weekly_reset_time
  );
  const usageResetAt = toTimestamp(
    record.usage_reset_at ?? quotaRecord?.usage_reset_at
  );

  if (
    hourlyPercentage == null &&
    weeklyPercentage == null &&
    creditsTotal == null &&
    creditsUsed == null &&
    bonusTotal == null &&
    bonusUsed == null &&
    !quotaRecord
  ) {
    return null;
  }

  return {
    hourlyPercentage,
    hourlyResetTime,
    weeklyPercentage,
    weeklyResetTime,
    creditsTotal,
    creditsUsed,
    bonusTotal,
    bonusUsed,
    usageResetAt,
    rawData: quotaRecord ?? null,
  };
}

function storageKey(platform: PlatformId) {
  return `${STORAGE_PREFIX}::${platform}`;
}

function getDefaultFeatureState(platform: PlatformId): Record<string, string | number | boolean> {
  if (platform === "codex") {
    return {
      localAccessEnabled: false,
      localAccessBaseUrl: "http://127.0.0.1:54140/v1",
      localAccessApiKey: "",
      localAccessRoutingStrategy: "round-robin",
      wakeupEnabled: false,
      wakeupIntervalMinutes: 15,
      wakeupScope: "current",
      sessionSummary: "",
      providerNotes: "",
    };
  }
  if (platform === "gemini") {
    return {
      launchCommand: "gemini",
      launchProfile: "default",
      injectionTarget: "",
      autoInject: false,
    };
  }
  return {
    injectionTarget: "",
    autoInject: false,
    launchCommand: "kiro",
    creditsNote: "",
  };
}

function getDefaultInstances(platform: PlatformId): PlatformInstance[] {
  return [
    {
      id: createId(`${platform}-instance`),
      name: platform === "codex" ? "default" : "__default__",
      accountId: null,
      command: platform === "kiro" ? "kiro" : platform,
      status: "ready",
      updatedAt: new Date().toISOString(),
    },
  ];
}

function normalizePlatformAccount(
  platform: PlatformId,
  value: unknown
): PlatformAccount | null {
  const record = toObject(value);
  if (!record) return null;

  const id =
    toStringValue(record.id) ||
    toStringValue(record.account_id) ||
    toStringValue(record.auth_id) ||
    createId(`${platform}-account`);
  const email =
    toStringValue(record.email) ||
    toStringValue(record.github_email) ||
    toStringValue(record.name) ||
    id;
  const displayName =
    toStringValue(record.displayName) ||
    toStringValue(record.display_name) ||
    toStringValue(record.account_name) ||
    toStringValue(record.name);
  const detail =
    toStringValue(record.api_base_url) ||
    toStringValue(record.api_provider_name) ||
    toStringValue(record.project_id) ||
    toStringValue(record.tier_id) ||
    toStringValue(record.plan_name) ||
    toStringValue(record.plan_tier) ||
    toStringValue(record.login_provider) ||
    null;
  const quota = normalizeQuotaSnapshot(record);
  const quotaError = normalizeQuotaError(record.quota_error ?? record.quotaError);

  return {
    id,
    email,
    displayName,
    authMode: formatAuthMode(
      record.authMode ?? record.auth_mode ?? record.selected_auth_type,
      platform === "codex" && toStringValue(record.openai_api_key) ? "apiKey" : "token"
    ),
    plan:
      toStringValue(record.plan) ||
      toStringValue(record.plan_type) ||
      toStringValue(record.plan_name) ||
      toStringValue(record.plan_tier) ||
      toStringValue(record.tier_id) ||
      null,
    status: formatStatus(record.status),
    tags: toStringArray(record.tags),
    createdAt:
      toTimestamp(record.createdAt ?? record.created_at) || new Date().toISOString(),
    lastUsedAt: toTimestamp(record.lastUsedAt ?? record.last_used),
    detail,
    userId: toStringValue(record.user_id ?? record.userId),
    accountId: toStringValue(record.account_id ?? record.accountId),
    organizationId: toStringValue(record.organization_id ?? record.organizationId),
    accountName:
      toStringValue(record.account_name) || toStringValue(record.accountName),
    accountStructure:
      toStringValue(record.account_structure) || toStringValue(record.accountStructure),
    loginProvider: toStringValue(record.login_provider),
    selectedAuthType:
      toStringValue(record.selected_auth_type) || toStringValue(record.selectedAuthType),
    apiBaseUrl: toStringValue(record.api_base_url) || toStringValue(record.apiBaseUrl),
    apiProviderMode:
      toStringValue(record.api_provider_mode) || toStringValue(record.apiProviderMode),
    apiProviderId:
      toStringValue(record.api_provider_id) || toStringValue(record.apiProviderId),
    apiProviderName:
      toStringValue(record.api_provider_name) || toStringValue(record.apiProviderName),
    projectId: toStringValue(record.project_id) || toStringValue(record.projectId),
    tierId: toStringValue(record.tier_id) || toStringValue(record.tierId),
    planType: toStringValue(record.plan_type) || toStringValue(record.planType),
    accessToken: toStringValue(record.access_token) || toStringValue(record.accessToken),
    refreshToken:
      toStringValue(record.refresh_token) || toStringValue(record.refreshToken),
    idToken: toStringValue(record.id_token) || toStringValue(record.idToken),
    openaiApiKey:
      toStringValue(record.openai_api_key) || toStringValue(record.openaiApiKey),
    quota,
    quotaError,
    creditsTotal:
      toNumberValue(record.credits_total) ??
      toNumberValue(record.prompt_credits_total) ??
      quota?.creditsTotal ??
      null,
    creditsUsed:
      toNumberValue(record.credits_used) ??
      toNumberValue(record.prompt_credits_used) ??
      quota?.creditsUsed ??
      null,
    bonusTotal: toNumberValue(record.bonus_total) ?? quota?.bonusTotal ?? null,
    bonusUsed: toNumberValue(record.bonus_used) ?? quota?.bonusUsed ?? null,
    usageResetAt:
      toTimestamp(record.usage_reset_at) || quota?.usageResetAt || null,
    raw: value,
  };
}

function normalizeInstance(value: unknown, platform: PlatformId): PlatformInstance | null {
  const record = toObject(value);
  if (!record) return null;
  const id = toStringValue(record.id) || createId(`${platform}-instance`);
  const name = toStringValue(record.name) || toStringValue(record.instanceName) || id;
  return {
    id,
    name,
    accountId: toStringValue(record.accountId ?? record.account_id),
    command: toStringValue(record.command) || platform,
    status:
      record.status === "idle" || record.status === "running" || record.status === "ready"
        ? record.status
        : "idle",
    updatedAt:
      toTimestamp(record.updatedAt ?? record.updated_at) || new Date().toISOString(),
  };
}

export function loadPlatformCenterState(platform: PlatformId): PlatformCenterState {
  if (typeof window === "undefined") {
    return {
      accounts: [],
      currentAccountId: null,
      instances: getDefaultInstances(platform),
      featureState: getDefaultFeatureState(platform),
    };
  }
  const raw = window.localStorage.getItem(storageKey(platform));
  if (!raw) {
    return {
      accounts: [],
      currentAccountId: null,
      instances: getDefaultInstances(platform),
      featureState: getDefaultFeatureState(platform),
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PlatformCenterState>;
    const accounts = Array.isArray(parsed.accounts)
      ? parsed.accounts
          .map((item) => normalizePlatformAccount(platform, item))
          .filter(Boolean) as PlatformAccount[]
      : [];
    const instances = Array.isArray(parsed.instances)
      ? parsed.instances
          .map((item) => normalizeInstance(item, platform))
          .filter(Boolean) as PlatformInstance[]
      : getDefaultInstances(platform);
    return {
      accounts,
      currentAccountId:
        toStringValue(parsed.currentAccountId) &&
        accounts.some((account) => account.id === parsed.currentAccountId)
          ? parsed.currentAccountId ?? null
          : accounts[0]?.id ?? null,
      instances,
      featureState: {
        ...getDefaultFeatureState(platform),
        ...toPrimitiveRecord(parsed.featureState),
      },
    };
  } catch {
    return {
      accounts: [],
      currentAccountId: null,
      instances: getDefaultInstances(platform),
      featureState: getDefaultFeatureState(platform),
    };
  }
}

export function savePlatformCenterState(platform: PlatformId, state: PlatformCenterState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(platform), JSON.stringify(state));
}

async function invokeOptional<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  if (!isTauriRuntime()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(command, args);
  } catch {
    return null;
  }
}

function oauthCommands(platform: PlatformId) {
  if (platform === "codex") {
    return {
      start: "codex_oauth_login_start",
      complete: "codex_oauth_login_completed",
      cancel: "codex_oauth_login_cancel",
      submit: "codex_oauth_submit_callback_url",
    };
  }
  if (platform === "gemini") {
    return {
      start: "gemini_oauth_login_start",
      complete: "gemini_oauth_login_complete",
      cancel: "gemini_oauth_login_cancel",
      submit: "gemini_oauth_submit_callback_url",
    };
  }
  return {
    start: "kiro_oauth_login_start",
    complete: "kiro_oauth_login_complete",
    cancel: "kiro_oauth_login_cancel",
    submit: "kiro_oauth_submit_callback_url",
  };
}

function listCommand(platform: PlatformId) {
  return `list_${platform}_accounts`;
}

function refreshCommand(platform: PlatformId) {
  if (platform === "gemini") return "refresh_gemini_token";
  if (platform === "kiro") return "refresh_kiro_token";
  return "refresh_codex_account_profile";
}

function refreshAllCommand(platform: PlatformId) {
  if (platform === "gemini") return "refresh_all_gemini_tokens";
  if (platform === "kiro") return "refresh_all_kiro_tokens";
  return "refresh_all_codex_quotas";
}

function deleteCommand(platform: PlatformId) {
  return `delete_${platform}_account`;
}

function deleteManyCommand(platform: PlatformId) {
  return `delete_${platform}_accounts`;
}

function exportCommand(platform: PlatformId) {
  return `export_${platform}_accounts`;
}

function importJsonCommand(platform: PlatformId) {
  return `import_${platform}_from_json`;
}

function importLocalCommand(platform: PlatformId) {
  return `import_${platform}_from_local`;
}

function tagCommand(platform: PlatformId) {
  return `update_${platform}_account_tags`;
}

function currentSwitchCommand(platform: PlatformId) {
  if (platform === "codex") return "switch_codex_account";
  return null;
}

function normalizeCodexApiProviderMode(apiBaseUrl?: string | null) {
  const normalized = apiBaseUrl?.trim() ?? "";
  if (!normalized || /^https:\/\/api\.openai\.com(?:\/v1)?\/?$/i.test(normalized)) {
    return "openai_builtin";
  }
  return "custom";
}

export async function fetchPlatformAccounts(platform: PlatformId): Promise<PlatformCenterState> {
  const backendAccounts = await invokeOptional<unknown[]>(listCommand(platform));
  if (backendAccounts) {
    const next = loadPlatformCenterState(platform);
    next.accounts = backendAccounts
      .map((item) => normalizePlatformAccount(platform, item))
      .filter(Boolean) as PlatformAccount[];
    if (
      !next.currentAccountId ||
      !next.accounts.some((account) => account.id === next.currentAccountId)
    ) {
      next.currentAccountId = next.accounts[0]?.id ?? null;
    }
    savePlatformCenterState(platform, next);
    return next;
  }
  return loadPlatformCenterState(platform);
}

export async function startPlatformOAuth(platform: PlatformId): Promise<PlatformOAuthStart> {
  const commands = oauthCommands(platform);
  const result = await invokeOptional<JsonRecord>(commands.start);
  if (!result) {
    throw new Error(
      `${PLATFORM_META[platform].label} OAuth 后端命令尚未迁入当前桌面端。`
    );
  }
  return {
    loginId: toStringValue(result.loginId ?? result.login_id) || createId(`${platform}-oauth`),
    authUrl: toStringValue(result.authUrl ?? result.auth_url),
    verificationUri: toStringValue(result.verificationUri ?? result.verification_uri),
    verificationUriComplete: toStringValue(
      result.verificationUriComplete ?? result.verification_uri_complete
    ),
    userCode: toStringValue(result.userCode ?? result.user_code),
    callbackUrl: toStringValue(result.callbackUrl ?? result.callback_url),
    expiresIn:
      typeof result.expiresIn === "number" ? result.expiresIn : typeof result.expires_in === "number" ? result.expires_in : null,
    intervalSeconds:
      typeof result.intervalSeconds === "number"
        ? result.intervalSeconds
        : typeof result.interval_seconds === "number"
          ? result.interval_seconds
          : null,
  };
}

export async function submitPlatformOAuthCallback(
  platform: PlatformId,
  loginId: string,
  callbackUrl: string
) {
  const commands = oauthCommands(platform);
  const result = await invokeOptional<void>(commands.submit, { loginId, callbackUrl });
  if (result === null) {
    throw new Error(
      `${PLATFORM_META[platform].label} OAuth 回调提交当前不可用。`
    );
  }
}

export async function completePlatformOAuth(
  platform: PlatformId,
  loginId: string
): Promise<PlatformCenterState> {
  const commands = oauthCommands(platform);
  const result = await invokeOptional<unknown>(commands.complete, { loginId });
  if (!result) {
    throw new Error(
      `${PLATFORM_META[platform].label} OAuth 完成命令当前不可用。`
    );
  }
  const state = loadPlatformCenterState(platform);
  const account = normalizePlatformAccount(platform, result);
  if (!account) {
    throw new Error("OAuth 返回了无法识别的账号数据。");
  }
  const nextAccounts = [
    account,
    ...state.accounts.filter((item) => item.id !== account.id),
  ];
  const next = {
    ...state,
    accounts: nextAccounts,
    currentAccountId: account.id,
  };
  savePlatformCenterState(platform, next);
  return next;
}

export async function cancelPlatformOAuth(platform: PlatformId, loginId?: string | null) {
  const commands = oauthCommands(platform);
  const result = await invokeOptional<void>(commands.cancel, { loginId: loginId ?? null });
  if (result === null && isTauriRuntime()) {
    throw new Error(`${PLATFORM_META[platform].label} OAuth 取消命令当前不可用。`);
  }
}

export async function addManualPlatformAccount(
  platform: PlatformId,
  authMode: PlatformAuthMode,
  input: PlatformManualAccountInput
): Promise<PlatformCenterState> {
  if (platform === "codex" && authMode === "apiKey") {
    const backend = await invokeOptional<unknown>("add_codex_account_with_api_key", {
      apiKey: input.apiKey ?? "",
      apiBaseUrl: input.baseUrl ?? null,
      apiProviderMode: input.baseUrl ? "custom" : "openai_builtin",
    });
    if (backend) {
      const next = loadPlatformCenterState(platform);
      const account = normalizePlatformAccount(platform, backend);
      if (account) {
        next.accounts = [account, ...next.accounts.filter((item) => item.id !== account.id)];
        next.currentAccountId = account.id;
        savePlatformCenterState(platform, next);
      }
      return next;
    }
  }

  if (platform === "codex" && authMode === "token") {
    const backend = await invokeOptional<unknown>("add_codex_account_with_token", {
      idToken: input.token ?? "",
      accessToken: input.token ?? "",
      refreshToken: input.refreshToken ?? null,
    });
    if (backend) {
      const next = loadPlatformCenterState(platform);
      const account = normalizePlatformAccount(platform, backend);
      if (account) {
        next.accounts = [account, ...next.accounts.filter((item) => item.id !== account.id)];
        next.currentAccountId = account.id;
        savePlatformCenterState(platform, next);
      }
      return next;
    }
  }

  if (platform === "gemini") {
    const backend = await invokeOptional<unknown>("add_gemini_account_with_token", {
      accessToken: input.token ?? "",
    });
    if (backend) {
      const next = loadPlatformCenterState(platform);
      const account = normalizePlatformAccount(platform, backend);
      if (account) {
        next.accounts = [account, ...next.accounts.filter((item) => item.id !== account.id)];
        next.currentAccountId = account.id;
        savePlatformCenterState(platform, next);
      }
      return next;
    }
  }

  if (platform === "kiro") {
    const backend = await invokeOptional<unknown>("add_kiro_account_with_token", {
      accessToken: input.token ?? "",
      access_token: input.token ?? "",
    });
    if (backend) {
      const next = loadPlatformCenterState(platform);
      const account = normalizePlatformAccount(platform, backend);
      if (account) {
        next.accounts = [account, ...next.accounts.filter((item) => item.id !== account.id)];
        next.currentAccountId = account.id;
        savePlatformCenterState(platform, next);
      }
      return next;
    }
  }

  const current = loadPlatformCenterState(platform);
  const timestamp = new Date().toISOString();
  const account: PlatformAccount = {
    id: createId(`${platform}-account`),
    email: input.email?.trim() || input.displayName?.trim() || `${platform}-${current.accounts.length + 1}`,
    displayName: input.displayName?.trim() || null,
    authMode,
    plan: null,
    status: "active",
    tags: [],
    createdAt: timestamp,
    lastUsedAt: timestamp,
    detail: authMode === "apiKey" ? input.baseUrl?.trim() || "OpenAI API Key" : "Manual import",
  };
  const next = {
    ...current,
    accounts: [account, ...current.accounts],
    currentAccountId: account.id,
  };
  savePlatformCenterState(platform, next);
  return next;
}

export async function importPlatformAccountsFromJson(
  platform: PlatformId,
  jsonContent: string
): Promise<PlatformCenterState> {
  const backend = await invokeOptional<unknown[]>(importJsonCommand(platform), { jsonContent });
  if (backend) {
    const next = loadPlatformCenterState(platform);
    const imported = backend
      .map((item) => normalizePlatformAccount(platform, item))
      .filter(Boolean) as PlatformAccount[];
    next.accounts = [
      ...imported,
      ...next.accounts.filter((item) => !imported.some((added) => added.id === item.id)),
    ];
    next.currentAccountId = next.accounts[0]?.id ?? null;
    savePlatformCenterState(platform, next);
    return next;
  }

  const parsed = JSON.parse(jsonContent);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const imported = items
    .map((item) => normalizePlatformAccount(platform, item))
    .filter(Boolean) as PlatformAccount[];
  const current = loadPlatformCenterState(platform);
  const next = {
    ...current,
    accounts: [
      ...imported,
      ...current.accounts.filter((item) => !imported.some((added) => added.id === item.id)),
    ],
    currentAccountId: imported[0]?.id ?? current.currentAccountId,
  };
  savePlatformCenterState(platform, next);
  return next;
}

export async function importPlatformAccountsFromLocal(
  platform: PlatformId
): Promise<PlatformCenterState> {
  const backend = await invokeOptional<unknown | unknown[]>(importLocalCommand(platform));
  if (!backend) {
    throw new Error(`${PLATFORM_META[platform].label} 本地导入命令当前不可用。`);
  }
  const items = Array.isArray(backend) ? backend : [backend];
  const imported = items
    .map((item) => normalizePlatformAccount(platform, item))
    .filter(Boolean) as PlatformAccount[];
  const current = loadPlatformCenterState(platform);
  const next = {
    ...current,
    accounts: [
      ...imported,
      ...current.accounts.filter((item) => !imported.some((added) => added.id === item.id)),
    ],
    currentAccountId: imported[0]?.id ?? current.currentAccountId,
  };
  savePlatformCenterState(platform, next);
  return next;
}

export async function exportPlatformAccounts(
  platform: PlatformId,
  accountIds?: string[]
): Promise<string> {
  const backend = await invokeOptional<string>(exportCommand(platform), {
    accountIds: accountIds ?? [],
  });
  if (typeof backend === "string" && backend.trim()) {
    return backend;
  }
  const state = loadPlatformCenterState(platform);
  const filtered =
    accountIds && accountIds.length > 0
      ? state.accounts.filter((account) => accountIds.includes(account.id))
      : state.accounts;
  return JSON.stringify(filtered, null, 2);
}

export async function setCurrentPlatformAccount(
  platform: PlatformId,
  accountId: string
): Promise<PlatformCenterState> {
  const switchCommand = currentSwitchCommand(platform);
  if (switchCommand) {
    await invokeOptional<unknown>(switchCommand, { accountId });
  }
  const state = loadPlatformCenterState(platform);
  const next = { ...state, currentAccountId: accountId };
  savePlatformCenterState(platform, next);
  return next;
}

export async function updateCodexApiKeyCredentials(
  accountId: string,
  apiKey: string,
  input: CodexApiKeyCredentialUpdateInput
): Promise<PlatformCenterState> {
  const trimmedApiKey = apiKey.trim();
  if (!trimmedApiKey) {
    throw new Error("API Key 不能为空。");
  }

  const apiBaseUrl = input.apiBaseUrl?.trim() || null;
  const apiProviderMode = normalizeCodexApiProviderMode(apiBaseUrl);
  const backend = await invokeOptional<unknown>("update_codex_api_key_credentials", {
    accountId,
    apiKey: trimmedApiKey,
    apiBaseUrl,
    apiProviderMode,
    apiProviderId: input.apiProviderId?.trim() || null,
    apiProviderName: input.apiProviderName?.trim() || null,
  });

  const state = loadPlatformCenterState("codex");
  const updated =
    (backend ? normalizePlatformAccount("codex", backend) : null) ??
    state.accounts.find((account) => account.id === accountId);
  if (!updated) {
    throw new Error(`未找到要更新的 Codex 账号：${accountId}`);
  }

  const nextAccount: PlatformAccount = {
    ...updated,
    authMode: "apiKey",
    openaiApiKey: trimmedApiKey,
    apiBaseUrl,
    apiProviderMode,
    apiProviderId: input.apiProviderId?.trim() || null,
    apiProviderName: input.apiProviderName?.trim() || null,
    detail:
      input.apiProviderName?.trim() ||
      apiBaseUrl ||
      updated.detail ||
      "OpenAI API Key",
    lastUsedAt: new Date().toISOString(),
  };
  const next = {
    ...state,
    accounts: state.accounts.map((account) =>
      account.id === accountId ? nextAccount : account
    ),
  };
  savePlatformCenterState("codex", next);
  return next;
}

export async function deletePlatformAccounts(
  platform: PlatformId,
  accountIds: string[]
): Promise<PlatformCenterState> {
  if (accountIds.length === 1) {
    await invokeOptional(deleteCommand(platform), { accountId: accountIds[0] });
  } else if (accountIds.length > 1) {
    await invokeOptional(deleteManyCommand(platform), { accountIds });
  }

  const state = loadPlatformCenterState(platform);
  const nextAccounts = state.accounts.filter((account) => !accountIds.includes(account.id));
  const next = {
    ...state,
    accounts: nextAccounts,
    currentAccountId:
      state.currentAccountId && !accountIds.includes(state.currentAccountId)
        ? state.currentAccountId
        : nextAccounts[0]?.id ?? null,
  };
  savePlatformCenterState(platform, next);
  return next;
}

export async function refreshPlatformAccount(
  platform: PlatformId,
  accountId: string
): Promise<PlatformCenterState> {
  const backend = await invokeOptional<unknown>(refreshCommand(platform), { accountId });
  const state = loadPlatformCenterState(platform);
  const nextAccounts = state.accounts.map((account) => {
    if (account.id !== accountId) return account;
    const refreshed = backend ? normalizePlatformAccount(platform, backend) : null;
    return (
      refreshed ?? {
        ...account,
        status: "active" as const,
        lastUsedAt: new Date().toISOString(),
      }
    );
  });
  const next = { ...state, accounts: nextAccounts };
  savePlatformCenterState(platform, next);
  return next;
}

export async function refreshAllPlatformAccounts(
  platform: PlatformId
): Promise<PlatformCenterState> {
  await invokeOptional(refreshAllCommand(platform));
  const state = loadPlatformCenterState(platform);
  const next = {
    ...state,
    accounts: state.accounts.map((account) => ({
      ...account,
      status: "active" as const,
      lastUsedAt: new Date().toISOString(),
    })),
  };
  savePlatformCenterState(platform, next);
  return next;
}

export async function updatePlatformAccountTags(
  platform: PlatformId,
  accountId: string,
  tags: string[]
): Promise<PlatformCenterState> {
  await invokeOptional(tagCommand(platform), { accountId, tags });
  const state = loadPlatformCenterState(platform);
  const next = {
    ...state,
    accounts: state.accounts.map((account) =>
      account.id === accountId ? { ...account, tags } : account
    ),
  };
  savePlatformCenterState(platform, next);
  return next;
}

export function updatePlatformFeatureState(
  platform: PlatformId,
  updates: Record<string, string | number | boolean>
): PlatformCenterState {
  const state = loadPlatformCenterState(platform);
  const next = {
    ...state,
    featureState: {
      ...state.featureState,
      ...updates,
    },
  };
  savePlatformCenterState(platform, next);
  return next;
}

export function addPlatformInstance(
  platform: PlatformId,
  input: {
    name: string;
    accountId?: string | null;
    command?: string;
  }
): PlatformCenterState {
  const state = loadPlatformCenterState(platform);
  const instance: PlatformInstance = {
    id: createId(`${platform}-instance`),
    name: input.name.trim() || `instance-${state.instances.length + 1}`,
    accountId: input.accountId ?? null,
    command: input.command?.trim() || platform,
    status: "ready",
    updatedAt: new Date().toISOString(),
  };
  const next = {
    ...state,
    instances: [instance, ...state.instances],
  };
  savePlatformCenterState(platform, next);
  return next;
}

export function updatePlatformInstance(
  platform: PlatformId,
  instanceId: string,
  updates: Partial<PlatformInstance>
): PlatformCenterState {
  const state = loadPlatformCenterState(platform);
  const next = {
    ...state,
    instances: state.instances.map((instance) =>
      instance.id === instanceId
        ? {
            ...instance,
            ...updates,
            updatedAt: new Date().toISOString(),
          }
        : instance
    ),
  };
  savePlatformCenterState(platform, next);
  return next;
}

export function deletePlatformInstance(
  platform: PlatformId,
  instanceId: string
): PlatformCenterState {
  const state = loadPlatformCenterState(platform);
  const next = {
    ...state,
    instances: state.instances.filter((instance) => instance.id !== instanceId),
  };
  savePlatformCenterState(platform, next);
  return next;
}

export function downloadJson(fileName: string, content: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function formatRelativeTime(value: string | null) {
  if (!value) return "未使用";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return "未知";
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

export function summarizePlatformCredits(account: PlatformAccount) {
  const raw = toObject(account.raw);
  const total =
    typeof raw?.credits_total === "number" ? raw.credits_total : null;
  const used =
    typeof raw?.credits_used === "number" ? raw.credits_used : null;
  if (total == null) return "无额度数据";
  const left = used == null ? total : Math.max(total - used, 0);
  return `剩余 ${left} / 总量 ${total}`;
}
