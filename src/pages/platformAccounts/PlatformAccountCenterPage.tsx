import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Copy,
  Cpu,
  Download,
  Globe,
  KeyRound,
  Plus,
  RefreshCw,
  Repeat,
  Sparkles,
  Trash2,
  Upload,
  Waypoints,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  downloadJson,
  formatRelativeTime,
  PLATFORM_META,
  type PlatformAccount,
  type PlatformAuthMode,
  type PlatformId,
  summarizePlatformCredits,
} from "../../lib/platformAccounts";
import type { PlatformAccountStoreState } from "../../platformAccounts/stores";
import {
  listCodexQuickSwitchProviders,
  switchCodexAccountProvider,
  type CodexQuickSwitchProviderOption,
} from "../../services/codexQuickSwitchService";
import {
  canQuickSwitchCodexProvider,
  resolveCodexQuotaErrorMeta,
} from "../../types/codex";
import { PLATFORM_CENTER_API_PATH } from "../../lib/platformCenterRoutes";
import { CodexProviderOverviewPanel } from "../../components/codex/CodexProviderOverviewPanel";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function platformIcon(platform: PlatformId) {
  switch (platform) {
    case "codex":
      return Bot;
    case "gemini":
      return Sparkles;
    default:
      return Waypoints;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeTagInput(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function featureInputValue(
  value: string | number | boolean | undefined
): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

export function PlatformAccountCenterPage({
  platform,
  store,
}: {
  platform: PlatformId;
  store: PlatformAccountStoreState;
}) {
  const navigate = useNavigate();
  const meta = PLATFORM_META[platform];
  const Icon = platformIcon(platform);
  const [addMode, setAddMode] = useState<"oauth" | "manual" | "import">("oauth");
  const [manualMode, setManualMode] = useState<PlatformAuthMode>(meta.manualModes[0]);
  const [emailInput, setEmailInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [refreshTokenInput, setRefreshTokenInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [importInput, setImportInput] = useState("");
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [instanceNameInput, setInstanceNameInput] = useState("");
  const [instanceCommandInput, setInstanceCommandInput] = useState<string>(platform);
  const [oauthManualCallback, setOauthManualCallback] = useState("");
  const [activeSection, setActiveSection] = useState<"accounts" | "instances" | string>("accounts");
  const [quickSwitchAccountId, setQuickSwitchAccountId] = useState<string | null>(null);
  const [quickSwitchProviderId, setQuickSwitchProviderId] = useState("");
  const [quickSwitchProviders, setQuickSwitchProviders] = useState<
    CodexQuickSwitchProviderOption[]
  >([]);
  const [quickSwitchLoading, setQuickSwitchLoading] = useState(false);
  const [quickSwitchSubmitting, setQuickSwitchSubmitting] = useState(false);
  const [quickSwitchError, setQuickSwitchError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    state,
    loading,
    message,
    error,
    oauthState,
    exportText,
    load,
    startOAuth,
    completeOAuth,
    cancelOAuth,
    submitOAuthCallback,
    addManualAccount,
    importJson,
    importLocal,
    exportAccounts,
    refreshAllAccounts,
    refreshAccount,
    setCurrentAccount,
    deleteAccounts,
    saveTags,
    updateFeatureState,
    addInstance,
    updateInstance,
    deleteInstance,
    setExportText,
    setMessage,
  } = store;

  useEffect(() => {
    if (!state && !loading) {
      void load();
    }
  }, [load, loading, state]);

  const accounts = state?.accounts ?? [];
  const currentAccount = accounts.find((account) => account.id === state?.currentAccountId) ?? null;
  const selectedFeatureCount = meta.sections.length;
  const quickSwitchAccount =
    platform === "codex" && quickSwitchAccountId
      ? accounts.find((account) => account.id === quickSwitchAccountId) ?? null
      : null;

  const creditsSummary = useMemo(() => {
    if (platform !== "kiro") return null;
    return currentAccount ? summarizePlatformCredits(currentAccount) : "无当前账号";
  }, [currentAccount, platform]);

  useEffect(() => {
    if (platform !== "codex" || !quickSwitchAccountId) return;
    let cancelled = false;

    setQuickSwitchLoading(true);
    setQuickSwitchError(null);

    void listCodexQuickSwitchProviders()
      .then((providers) => {
        if (cancelled) return;
        setQuickSwitchProviders(providers);
        setQuickSwitchProviderId((current) => {
          if (current && providers.some((provider) => provider.id === current)) {
            return current;
          }
          if (
            quickSwitchAccount?.apiProviderId &&
            providers.some((provider) => provider.id === quickSwitchAccount.apiProviderId)
          ) {
            return quickSwitchAccount.apiProviderId;
          }
          return providers[0]?.id ?? "";
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setQuickSwitchProviders([]);
        setQuickSwitchError(
          error instanceof Error ? error.message : "加载 provider 列表失败。"
        );
      })
      .finally(() => {
        if (!cancelled) {
          setQuickSwitchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [platform, quickSwitchAccount?.apiProviderId, quickSwitchAccountId]);

  async function handleStartOAuth() {
    await startOAuth();
  }

  async function handleCompleteOAuth() {
    const success = await completeOAuth();
    if (success) {
      setOauthManualCallback("");
    }
  }

  async function handleCancelOAuth() {
    const success = await cancelOAuth();
    if (success) {
      setOauthManualCallback("");
    }
  }

  async function handleSubmitOAuthCallback() {
    await submitOAuthCallback(oauthManualCallback);
  }

  async function handleManualAdd() {
    const success = await addManualAccount(manualMode, {
      email: emailInput,
      displayName: displayNameInput,
      token: tokenInput,
      apiKey: tokenInput,
      refreshToken: refreshTokenInput,
      baseUrl: baseUrlInput,
    });
    if (success) {
      setEmailInput("");
      setDisplayNameInput("");
      setTokenInput("");
      setRefreshTokenInput("");
      setBaseUrlInput("");
    }
  }

  async function handleImportJson() {
    const success = await importJson(importInput);
    if (success) {
      setImportInput("");
    }
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importJson(text);
    } finally {
      event.target.value = "";
    }
  }

  async function handleImportFromLocal() {
    await importLocal();
  }

  async function handleExportAll() {
    await exportAccounts();
  }

  async function handleRefreshAll() {
    await refreshAllAccounts();
  }

  async function handleRefreshAccount(accountId: string) {
    await refreshAccount(accountId);
  }

  async function handleSetCurrent(accountId: string) {
    await setCurrentAccount(accountId);
  }

  async function handleDeleteAccount(accountId: string) {
    await deleteAccounts([accountId]);
  }

  async function handleSaveTags(account: PlatformAccount) {
    await saveTags(account.id, normalizeTagInput(tagDrafts[account.id] ?? ""));
  }

  function handleFeatureChange(key: string, value: string | number | boolean) {
    updateFeatureState({ [key]: value });
  }

  function handleAddInstance() {
    addInstance({
      name: instanceNameInput,
      accountId: state?.currentAccountId ?? null,
      command: instanceCommandInput,
    });
    setInstanceNameInput("");
    setInstanceCommandInput(platform);
  }

  function handleUpdateInstance(
    instanceId: string,
    updates: { status?: "idle" | "ready" | "running"; command?: string }
  ) {
    updateInstance(instanceId, updates);
  }

  function handleDeleteInstance(instanceId: string) {
    deleteInstance(instanceId);
  }

  async function handleCopyExport() {
    if (!exportText.trim()) return;
    await navigator.clipboard.writeText(exportText);
    setExportText(exportText);
    setMessage("导出 JSON 已复制到剪贴板。");
  }

  function openQuickSwitchModal(account: PlatformAccount) {
    setQuickSwitchAccountId(account.id);
    setQuickSwitchProviderId(account.apiProviderId?.trim() || "");
    setQuickSwitchError(null);
  }

  function closeQuickSwitchModal() {
    setQuickSwitchAccountId(null);
    setQuickSwitchProviderId("");
    setQuickSwitchProviders([]);
    setQuickSwitchLoading(false);
    setQuickSwitchSubmitting(false);
    setQuickSwitchError(null);
  }

  async function handleApplyQuickSwitch() {
    if (platform !== "codex" || !quickSwitchAccount) return;
    if (!quickSwitchProviderId) {
      setQuickSwitchError("请选择要切换的 provider。");
      return;
    }

    setQuickSwitchSubmitting(true);
    setQuickSwitchError(null);
    try {
      await switchCodexAccountProvider({
        accountId: quickSwitchAccount.id,
        providerId: quickSwitchProviderId,
      });
      await load();
      setMessage("Codex API Key 账号已切换到新的 provider。");
      closeQuickSwitchModal();
    } catch (error) {
      setQuickSwitchError(
        error instanceof Error ? error.message : "切换 provider 失败。"
      );
    } finally {
      setQuickSwitchSubmitting(false);
    }
  }

  if (loading || !state) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-[16px] border border-[#eceae4] bg-white/92 shadow-sm">
        <div className="rounded-[12px] border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500 shadow-sm">
          正在加载 {meta.label} 平台中心...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section
        className={cx(
          "overflow-hidden rounded-[24px] border border-[#e8e3d8] bg-gradient-to-br p-7 text-white shadow-[0_18px_46px_rgba(15,23,42,0.10)]",
          meta.accentClass
        )}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 ring-1 ring-white/10">
              <Icon className="h-3.5 w-3.5" />
              <span>{meta.label}</span>
            </div>
            <div className="mt-4 text-[30px] font-semibold tracking-tight">
              {meta.label} 账号中心
            </div>
            <div className="mt-3 max-w-2xl text-sm leading-7 text-white/78">
              {meta.description}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] border border-white/12 bg-white/8 px-5 py-4 backdrop-blur-sm">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/55">Accounts</div>
              <div className="mt-2 text-2xl font-semibold">{accounts.length}</div>
            </div>
            <div className="rounded-[18px] border border-white/12 bg-white/8 px-5 py-4 backdrop-blur-sm">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/55">Current</div>
              <div className="mt-2 truncate text-sm font-semibold">
                {currentAccount?.email ?? "未选择"}
              </div>
            </div>
            <div className="rounded-[18px] border border-white/12 bg-white/8 px-5 py-4 backdrop-blur-sm">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/55">Sections</div>
              <div className="mt-2 text-2xl font-semibold">{selectedFeatureCount + 2}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[16px] border border-[#eceae4] bg-white/92 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "accounts", label: "Accounts", icon: KeyRound },
            { id: "instances", label: "Instances", icon: Cpu },
            ...meta.sections.map((section) => ({
              id: section.id,
              label: section.title,
              icon: ChevronRight,
            })),
          ].map((item) => {
            const TabIcon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={cx(
                  "inline-flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-sm font-medium transition-all",
                  activeSection === item.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-[#f5f4f1] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <TabIcon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {(message || error) && (
        <section
          className={cx(
            "rounded-[14px] border px-5 py-4 text-sm shadow-sm",
            error
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {error ?? message}
        </section>
      )}

      {activeSection === "accounts" ? (
        <div className="space-y-6">
          <section className="rounded-[16px] border border-[#eceae4] bg-white/92 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className="text-lg font-semibold tracking-tight text-slate-950">
                  账号接入
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-500">
                  OAuth 优先；如果当前桌面端后端命令未迁入，也可以先用 token 或 JSON 导入把账号中心数据迁过来。
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshAll}
                  className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>刷新全部</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportAll}
                  className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  <span>导出</span>
                </button>
                <button
                  type="button"
                  onClick={handleImportFromLocal}
                  className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4" />
                  <span>从本地导入</span>
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 rounded-[14px] bg-[#f5f4f1] p-1.5">
              {(["oauth", "manual", "import"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAddMode(mode)}
                  className={cx(
                    "rounded-[12px] px-4 py-2.5 text-sm font-medium transition-all",
                    addMode === mode
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:bg-white/80 hover:text-slate-900"
                  )}
                >
                  {mode === "oauth" ? "OAuth 登录" : mode === "manual" ? "手动添加" : "导入 JSON"}
                </button>
              ))}
            </div>

            {addMode === "oauth" ? (
              <div className="mt-5 rounded-[16px] border border-slate-200 bg-[#fbfaf8] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-xl">
                    <div className="text-sm font-semibold text-slate-950">OAuth 登录</div>
                    <div className="mt-2 text-sm leading-7 text-slate-500">
                      优先调用后端命令生成授权链接和本地回调。如果当前版本还没迁入该平台 OAuth 模块，这里会直接报出缺口。
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleStartOAuth}
                      className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-black"
                    >
                      <Globe className="h-4 w-4" />
                      <span>开始 OAuth</span>
                    </button>
                    {oauthState ? (
                      <button
                        type="button"
                        onClick={handleCancelOAuth}
                        className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>取消</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                {oauthState ? (
                  <div className="mt-5 space-y-4">
                    {(oauthState.authUrl ||
                      oauthState.verificationUriComplete ||
                      oauthState.verificationUri) && (
                      <div className="rounded-[14px] border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          授权链接
                        </div>
                        <div className="mt-2 break-all text-sm text-slate-700">
                          {oauthState.authUrl ||
                            oauthState.verificationUriComplete ||
                            oauthState.verificationUri}
                        </div>
                      </div>
                    )}
                    {oauthState.userCode ? (
                      <div className="rounded-[14px] border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          User Code
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">
                          {oauthState.userCode}
                        </div>
                      </div>
                    ) : null}
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                      <textarea
                        value={oauthManualCallback}
                        onChange={(event) => setOauthManualCallback(event.target.value)}
                        rows={3}
                        placeholder="需要手动回调时，把浏览器回调地址粘贴到这里。"
                        className="min-h-[96px] rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition-all focus:border-slate-300"
                      />
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={handleSubmitOAuthCallback}
                          className="inline-flex items-center justify-center rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                        >
                          提交回调
                        </button>
                        <button
                          type="button"
                          onClick={handleCompleteOAuth}
                          className="inline-flex items-center justify-center rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-black"
                        >
                          完成登录
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {addMode === "manual" ? (
              <div className="mt-5 rounded-[16px] border border-slate-200 bg-[#fbfaf8] p-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-700">账号显示名</span>
                    <input
                      value={displayNameInput}
                      onChange={(event) => setDisplayNameInput(event.target.value)}
                      placeholder="可选"
                      className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-700">邮箱 / 标识</span>
                    <input
                      value={emailInput}
                      onChange={(event) => setEmailInput(event.target.value)}
                      placeholder="user@example.com"
                      className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                    />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {meta.manualModes.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setManualMode(mode)}
                      className={cx(
                        "rounded-[12px] px-3 py-2 text-sm font-medium transition-all",
                        manualMode === mode
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {mode === "apiKey" ? "API Key" : meta.tokenLabel}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2 text-sm lg:col-span-2">
                    <span className="font-medium text-slate-700">
                      {manualMode === "apiKey" ? "API Key" : meta.tokenLabel}
                    </span>
                    <textarea
                      value={tokenInput}
                      onChange={(event) => setTokenInput(event.target.value)}
                      rows={3}
                      placeholder={manualMode === "apiKey" ? "sk-..." : "粘贴 access token / token JSON"}
                      className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                    />
                  </label>
                  {manualMode === "token" ? (
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-slate-700">Refresh Token</span>
                      <input
                        value={refreshTokenInput}
                        onChange={(event) => setRefreshTokenInput(event.target.value)}
                        placeholder="可选"
                        className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                      />
                    </label>
                  ) : null}
                  {platform === "codex" && manualMode === "apiKey" ? (
                    <label className="space-y-2 text-sm">
                      <span className="font-medium text-slate-700">Base URL</span>
                      <input
                        value={baseUrlInput}
                        onChange={(event) => setBaseUrlInput(event.target.value)}
                        placeholder="https://api.openai.com/v1"
                        className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                      />
                    </label>
                  ) : null}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleManualAdd}
                    className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-black"
                  >
                    <Plus className="h-4 w-4" />
                    <span>添加账号</span>
                  </button>
                </div>
              </div>
            ) : null}

            {addMode === "import" ? (
              <div className="mt-5 rounded-[16px] border border-slate-200 bg-[#fbfaf8] p-5">
                <textarea
                  value={importInput}
                  onChange={(event) => setImportInput(event.target.value)}
                  rows={8}
                  placeholder="粘贴账号 JSON；支持单个对象或对象数组。"
                  className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={handleImportFileChange}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                    >
                      <Upload className="h-4 w-4" />
                      <span>选择文件</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleImportJson}
                    className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-black"
                  >
                    <Upload className="h-4 w-4" />
                    <span>导入 JSON</span>
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            {accounts.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-slate-200 bg-[#fbfaf8] px-6 py-10 text-center">
                <div className="text-sm font-semibold text-slate-900">
                  当前还没有 {meta.label} 账号
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-500">
                  先通过 OAuth、手动 token，或从本地客户端/JSON 导入账号。
                </div>
              </div>
            ) : (
              accounts.map((account) => {
                const isCurrent = account.id === state.currentAccountId;
                const isCodexApiKeyAccount =
                  platform === "codex" && canQuickSwitchCodexProvider(account);
                const codexQuotaError =
                  platform === "codex"
                    ? resolveCodexQuotaErrorMeta(account.quotaError)
                    : null;
                const hasCodexQuotaError = Boolean(codexQuotaError?.rawMessage);
                return (
                  <article
                    key={account.id}
                    className="rounded-[16px] border border-[#eceae4] bg-white/92 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-slate-950">
                            {account.displayName || account.email}
                          </div>
                          <span
                            className={cx(
                              "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                              isCurrent
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            )}
                          >
                            {isCurrent ? "Current" : "Standby"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {account.authMode}
                          </span>
                          {account.plan ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {account.plan}
                            </span>
                          ) : null}
                          {hasCodexQuotaError ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-200"
                              title={codexQuotaError?.rawMessage}
                            >
                              <CircleAlert className="h-3.5 w-3.5" />
                              <span>{codexQuotaError?.statusCode || "配额异常"}</span>
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">{account.email}</div>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span>创建于 {formatDate(account.createdAt)}</span>
                          <span>最近使用 {formatRelativeTime(account.lastUsedAt)}</span>
                          {account.detail ? <span>{account.detail}</span> : null}
                        </div>
                        {platform === "codex" ? (
                          <div className="mt-4 space-y-2">
                            {isCodexApiKeyAccount ? (
                              <>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    Provider
                                  </span>
                                  <span>{account.apiProviderName || "未绑定 provider"}</span>
                                  <button
                                    type="button"
                                    onClick={() => openQuickSwitchModal(account)}
                                    className="inline-flex items-center gap-1 rounded-[10px] border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50"
                                    title="快速切换供应商"
                                  >
                                    <Repeat className="h-3.5 w-3.5" />
                                    <span>快速切换供应商</span>
                                  </button>
                                </div>
                                <div className="text-xs text-slate-500">
                                  Base URL：{account.apiBaseUrl || "https://api.openai.com/v1"}
                                </div>
                              </>
                            ) : null}
                            {hasCodexQuotaError ? (
                              <div
                                className="rounded-[12px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800"
                                title={codexQuotaError?.rawMessage}
                              >
                                <div className="flex items-start gap-2">
                                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                                  <div>
                                    <div className="font-medium">Quota Warning</div>
                                    <div className="mt-1 break-all text-xs leading-6">
                                      {codexQuotaError?.displayText}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {account.tags.length > 0 ? (
                            account.tags.map((tag) => (
                              <span
                                key={`${account.id}-${tag}`}
                                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">暂无标签</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!isCurrent ? (
                          <button
                            type="button"
                            onClick={() => void handleSetCurrent(account.id)}
                            className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-all hover:bg-black"
                          >
                            <Check className="h-4 w-4" />
                            <span>设为当前</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleRefreshAccount(account.id)}
                          className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span>刷新</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAccount(account.id)}
                          className="inline-flex items-center gap-2 rounded-[12px] border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-medium text-rose-700 transition-all hover:bg-rose-100"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>删除</span>
                        </button>
                        {isCodexApiKeyAccount ? (
                          <button
                            type="button"
                            onClick={() => openQuickSwitchModal(account)}
                            className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                          >
                            <Repeat className="h-4 w-4" />
                            <span>快速切换供应商</span>
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                      <input
                        value={tagDrafts[account.id] ?? account.tags.join(", ")}
                        onChange={(event) =>
                          setTagDrafts((current) => ({
                            ...current,
                            [account.id]: event.target.value,
                          }))
                        }
                        placeholder="tag1, tag2"
                        className="w-full rounded-[12px] border border-slate-200 bg-[#fbfaf8] px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveTags(account)}
                        className="inline-flex items-center justify-center rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                      >
                        保存标签
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          {exportText ? (
            <section className="rounded-[16px] border border-[#eceae4] bg-white/92 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-950">导出 JSON</div>
                  <div className="mt-1 text-sm text-slate-500">
                    可以直接复制，或保存成 `{platform}_accounts.json`。
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyExport()}
                    className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                  >
                    <Copy className="h-4 w-4" />
                    <span>复制</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadJson(`${platform}_accounts.json`, exportText)
                    }
                    className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-black"
                  >
                    <Download className="h-4 w-4" />
                    <span>下载</span>
                  </button>
                </div>
              </div>
              <textarea
                value={exportText}
                readOnly
                rows={10}
                className="mt-4 w-full rounded-[12px] border border-slate-200 bg-[#fbfaf8] px-4 py-3 font-mono text-xs text-slate-700 outline-none"
              />
            </section>
          ) : null}
        </div>
      ) : null}

      {platform === "codex" && quickSwitchAccount ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[24px] border border-[#e8e3d8] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-lg font-semibold tracking-tight text-slate-950">
                  快速切换供应商
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-500">
                  为当前 Codex API Key 账号直接切换到已有 OpenAI Compatible provider。
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  当前账号：{quickSwitchAccount.displayName || quickSwitchAccount.email}
                </div>
              </div>
              <button
                type="button"
                onClick={closeQuickSwitchModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {quickSwitchAccount.quotaError?.message ? (
                <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <div className="flex items-start gap-2">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-medium">当前账号存在告警</div>
                      <div className="mt-1 break-all text-xs leading-6">
                        {resolveCodexQuotaErrorMeta(quickSwitchAccount.quotaError).displayText}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {quickSwitchLoading ? (
                <div className="rounded-[14px] border border-slate-200 bg-[#fbfaf8] px-4 py-5 text-sm text-slate-500">
                  正在加载可切换的 providers...
                </div>
              ) : quickSwitchProviders.length === 0 ? (
                <div className="rounded-[14px] border border-dashed border-slate-200 bg-[#fbfaf8] px-4 py-5 text-sm text-slate-500">
                  当前没有可用的 OpenAI Compatible provider。先去 API Providers 页面补充。
                </div>
              ) : (
                <div className="space-y-3">
                  {quickSwitchProviders.map((provider) => {
                    const selected = provider.id === quickSwitchProviderId;
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => setQuickSwitchProviderId(provider.id)}
                        className={cx(
                          "flex w-full flex-col items-start rounded-[16px] border px-4 py-4 text-left transition-all",
                          selected
                            ? "border-slate-900 bg-slate-900 text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)]"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="text-sm font-semibold">{provider.name}</div>
                          {selected ? (
                            <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
                              Selected
                            </span>
                          ) : null}
                        </div>
                        <div
                          className={cx(
                            "mt-2 text-xs",
                            selected ? "text-white/70" : "text-slate-500"
                          )}
                        >
                          {provider.baseUrl}
                        </div>
                        <div
                          className={cx(
                            "mt-1 text-xs",
                            selected ? "text-white/60" : "text-slate-400"
                          )}
                        >
                          API Key：{provider.apiKeyMasked}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {quickSwitchError ? (
                <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {quickSwitchError}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-5">
              <button
                type="button"
                onClick={() =>
                  navigate(`${PLATFORM_CENTER_API_PATH}?serviceType=openaiCompatible`)
                }
                className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
              >
                <Globe className="h-4 w-4" />
                <span>管理 API Providers</span>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={closeQuickSwitchModal}
                  className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void handleApplyQuickSwitch()}
                  disabled={
                    quickSwitchSubmitting ||
                    quickSwitchLoading ||
                    !quickSwitchProviders.length ||
                    !quickSwitchProviderId
                  }
                  className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Repeat className="h-4 w-4" />
                  <span>{quickSwitchSubmitting ? "切换中..." : "立即切换"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === "instances" ? (
        <div className="space-y-6">
          <section className="rounded-[16px] border border-[#eceae4] bg-white/92 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <label className="flex-1 space-y-2 text-sm">
                <span className="font-medium text-slate-700">实例名称</span>
                <input
                  value={instanceNameInput}
                  onChange={(event) => setInstanceNameInput(event.target.value)}
                  placeholder="default"
                  className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                />
              </label>
              <label className="flex-1 space-y-2 text-sm">
                <span className="font-medium text-slate-700">启动命令</span>
                <input
                  value={instanceCommandInput}
                  onChange={(event) => setInstanceCommandInput(event.target.value)}
                  placeholder={platform}
                  className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                />
              </label>
              <button
                type="button"
                onClick={handleAddInstance}
                className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-black"
              >
                <Plus className="h-4 w-4" />
                <span>新增实例</span>
              </button>
            </div>
          </section>

          <section className="space-y-4">
            {state.instances.map((instance) => (
              <article
                key={instance.id}
                className="rounded-[16px] border border-[#eceae4] bg-white/92 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-semibold text-slate-950">
                        {instance.name}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {instance.status}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{instance.command}</div>
                    <div className="mt-2 text-xs text-slate-400">
                      更新于 {formatDate(instance.updatedAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateInstance(instance.id, {
                          status:
                            instance.status === "running"
                              ? "ready"
                              : instance.status === "ready"
                                ? "idle"
                                : "running",
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>切换状态</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(instance.command)}
                      className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4" />
                      <span>复制命令</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteInstance(instance.id)}
                      className="inline-flex items-center gap-2 rounded-[12px] border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-medium text-rose-700 transition-all hover:bg-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>删除</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      ) : null}

      {meta.sections.map((section) => {
        if (activeSection !== section.id) return null;
        return (
          <section
            key={section.id}
            className="rounded-[16px] border border-[#eceae4] bg-white/92 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
          >
            <div className="max-w-3xl">
              <div className="text-lg font-semibold tracking-tight text-slate-950">
                {section.title}
              </div>
              <div className="mt-2 text-sm leading-7 text-slate-500">
                {section.description}
              </div>
            </div>

            {platform === "codex" && section.id === "local-access" ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">启用本地入口</span>
                  <select
                    value={featureInputValue(state.featureState.localAccessEnabled)}
                    onChange={(event) =>
                      handleFeatureChange(
                        "localAccessEnabled",
                        event.target.value === "true"
                      )
                    }
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                  >
                    <option value="false">关闭</option>
                    <option value="true">开启</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">路由策略</span>
                  <select
                    value={featureInputValue(state.featureState.localAccessRoutingStrategy)}
                    onChange={(event) =>
                      handleFeatureChange("localAccessRoutingStrategy", event.target.value)
                    }
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                  >
                    <option value="round-robin">round-robin</option>
                    <option value="current-first">current-first</option>
                    <option value="single-fixed">single-fixed</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm lg:col-span-2">
                  <span className="font-medium text-slate-700">Base URL</span>
                  <input
                    value={featureInputValue(state.featureState.localAccessBaseUrl)}
                    onChange={(event) =>
                      handleFeatureChange("localAccessBaseUrl", event.target.value)
                    }
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                  />
                </label>
                <label className="space-y-2 text-sm lg:col-span-2">
                  <span className="font-medium text-slate-700">默认 API Key</span>
                  <input
                    value={featureInputValue(state.featureState.localAccessApiKey)}
                    onChange={(event) =>
                      handleFeatureChange("localAccessApiKey", event.target.value)
                    }
                    placeholder="可选"
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                  />
                </label>
              </div>
            ) : null}

            {platform === "codex" && section.id === "wakeup" ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">启用预热</span>
                  <select
                    value={featureInputValue(state.featureState.wakeupEnabled)}
                    onChange={(event) =>
                      handleFeatureChange("wakeupEnabled", event.target.value === "true")
                    }
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                  >
                    <option value="false">关闭</option>
                    <option value="true">开启</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">间隔（分钟）</span>
                  <input
                    value={featureInputValue(state.featureState.wakeupIntervalMinutes)}
                    onChange={(event) =>
                      handleFeatureChange(
                        "wakeupIntervalMinutes",
                        Number.parseInt(event.target.value || "0", 10) || 0
                      )
                    }
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                  />
                </label>
                <label className="space-y-2 text-sm lg:col-span-2">
                  <span className="font-medium text-slate-700">作用域</span>
                  <select
                    value={featureInputValue(state.featureState.wakeupScope)}
                    onChange={(event) => handleFeatureChange("wakeupScope", event.target.value)}
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                  >
                    <option value="current">current</option>
                    <option value="all">all</option>
                    <option value="selected">selected</option>
                  </select>
                </label>
              </div>
            ) : null}

            {platform === "codex" && section.id === "sessions" ? (
              <div className="mt-5 grid gap-4">
                <div className="rounded-[14px] border border-slate-200 bg-[#fbfaf8] px-4 py-4 text-sm leading-7 text-slate-600">
                  会话管理相关的真实扫描、可见性修复与线程同步仍依赖后端迁移。
                  当前先保留入口与摘要字段，方便把 `cockpit-tools-main` 的能力收束到统一设置导航里。
                </div>
                <textarea
                  value={featureInputValue(state.featureState.sessionSummary)}
                  onChange={(event) =>
                    handleFeatureChange("sessionSummary", event.target.value)
                  }
                  rows={4}
                  placeholder="记录 session sync / visibility repair / backup notes..."
                  className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                />
              </div>
            ) : null}

            {platform === "codex" && section.id === "providers" ? (
              <CodexProviderOverviewPanel accounts={accounts} />
            ) : null}

            {platform === "gemini" && section.id === "launch" ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm lg:col-span-2">
                  <span className="font-medium text-slate-700">默认启动命令</span>
                  <input
                    value={featureInputValue(state.featureState.launchCommand)}
                    onChange={(event) =>
                      handleFeatureChange("launchCommand", event.target.value)
                    }
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">启动配置名</span>
                  <input
                    value={featureInputValue(state.featureState.launchProfile)}
                    onChange={(event) =>
                      handleFeatureChange("launchProfile", event.target.value)
                    }
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                  />
                </label>
                <div className="rounded-[14px] border border-slate-200 bg-[#fbfaf8] px-4 py-4 text-sm text-slate-600">
                  当前实例数 {state.instances.length}。设置命令后，注入成功可直接复制到终端运行。
                </div>
              </div>
            ) : null}

            {(platform === "gemini" || platform === "kiro") &&
            section.id === "injection" ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm lg:col-span-2">
                  <span className="font-medium text-slate-700">默认注入目标</span>
                  <input
                    value={featureInputValue(state.featureState.injectionTarget)}
                    onChange={(event) =>
                      handleFeatureChange("injectionTarget", event.target.value)
                    }
                    placeholder="例如 ~/.config/Code/User/globalStorage/..."
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">自动注入</span>
                  <select
                    value={featureInputValue(state.featureState.autoInject)}
                    onChange={(event) =>
                      handleFeatureChange("autoInject", event.target.value === "true")
                    }
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                  >
                    <option value="false">关闭</option>
                    <option value="true">开启</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">默认命令</span>
                  <input
                    value={featureInputValue(state.featureState.launchCommand)}
                    onChange={(event) =>
                      handleFeatureChange("launchCommand", event.target.value)
                    }
                    className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                  />
                </label>
              </div>
            ) : null}

            {platform === "kiro" && section.id === "credits" ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[14px] border border-slate-200 bg-[#fbfaf8] px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    当前额度
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-950">
                    {creditsSummary}
                  </div>
                </div>
                <textarea
                  value={featureInputValue(state.featureState.creditsNote)}
                  onChange={(event) =>
                    handleFeatureChange("creditsNote", event.target.value)
                  }
                  rows={5}
                  placeholder="记录额度刷新时间、计划说明或异常原因。"
                  className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300"
                />
              </div>
            ) : null}

            {!(
              (platform === "codex" &&
                ["local-access", "wakeup", "sessions", "providers"].includes(section.id)) ||
              (platform === "gemini" && ["launch", "injection"].includes(section.id)) ||
              (platform === "kiro" && ["injection", "credits"].includes(section.id))
            ) ? (
              <div className="mt-5 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700">
                <div className="flex items-start gap-3">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    当前分支已接入统一入口与状态持久化，真实平台能力后续继续向后端迁移。
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
