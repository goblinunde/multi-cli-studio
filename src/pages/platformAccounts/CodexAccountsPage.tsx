import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Globe,
  KeyRound,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { CodexOverviewTabsHeader, type CodexTab } from "../../components/CodexOverviewTabsHeader";
import { CodexProviderOverviewPanel } from "../../components/codex/CodexProviderOverviewPanel";
import { PlatformAccountGridView } from "../../components/platform/PlatformAccountGridView";
import { PlatformAccountListView } from "../../components/platform/PlatformAccountListView";
import { PlatformAccountOverviewToolbar } from "../../components/platform/PlatformAccountOverviewToolbar";
import { PlatformAccountSelectionBar } from "../../components/platform/PlatformAccountSelectionBar";
import { buildCodexAccountPresentation } from "../../presentation/platformAccountPresentation";
import { useCodexAccountStore } from "../../stores/useCodexAccountStore";
import * as codexService from "../../services/codexService";
import { bridge, isTauriRuntime } from "../../lib/bridge";
import { downloadJson, formatRelativeTime } from "../../lib/platformAccounts";
import { useStore } from "../../lib/store";
import { canQuickSwitchCodexProvider, resolveCodexQuotaErrorMeta } from "../../types/codex";

const PAGE_SIZE_OPTIONS = [6, 12, 24] as const;

function formatTimestamp(value?: string | null) {
  if (!value) return "暂无";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function CodexAccountsPage() {
  const [activeTab, setActiveTab] = useState<CodexTab>("overview");
  const store = useCodexAccountStore();
  const settings = useStore((state) => state.settings);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<"all" | "current" | "standby" | "warning">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [oauthState, setOauthState] = useState<Awaited<
    ReturnType<typeof codexService.startCodexOAuthLogin>
  > | null>(null);
  const [oauthCallback, setOauthCallback] = useState("");
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthAwaitingCallback, setOauthAwaitingCallback] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState<"token" | "apiKey">("token");
  const [tokenInput, setTokenInput] = useState("");
  const [refreshTokenInput, setRefreshTokenInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [importInput, setImportInput] = useState("");
  const [exportText, setExportText] = useState("");

  useEffect(() => {
    void store.fetchAccounts();
    void store.fetchCurrentAccount();
  }, [store]);

  const searchedAccounts = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return store.accounts;
    return store.accounts.filter((account) => {
      const presentation = buildCodexAccountPresentation(account);
      return [
        account.email,
        account.displayName,
        account.accountName,
        presentation.planLabel,
        account.apiProviderName,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword));
    });
  }, [searchQuery, store.accounts]);

  const filteredAccounts = useMemo(() => {
    return searchedAccounts.filter((account) => {
      if (accountFilter === "current") return store.currentAccount?.id === account.id;
      if (accountFilter === "standby") return store.currentAccount?.id !== account.id;
      if (accountFilter === "warning") {
        return Boolean(resolveCodexQuotaErrorMeta(account.quotaError).rawMessage);
      }
      return true;
    });
  }, [accountFilter, searchedAccounts, store.currentAccount?.id]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedAccounts = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredAccounts.slice(start, start + pageSize);
  }, [filteredAccounts, pageSize, safeCurrentPage]);
  const pageAccountIds = paginatedAccounts.map((account) => account.id);
  const allPageSelected =
    pageAccountIds.length > 0 && pageAccountIds.every((accountId) => selectedIds.includes(accountId));

  useEffect(() => {
    setCurrentPage(1);
  }, [accountFilter, pageSize, searchQuery]);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => store.accounts.some((account) => account.id === id)));
  }, [store.accounts]);

  function isOauthCancellationError(message: string) {
    return message.includes("OAuth 已取消") || message.includes("被新的登录请求替换");
  }

  async function waitForOAuthCompletion(loginId: string) {
    setOauthAwaitingCallback(true);
    setOauthError(null);
    try {
      await codexService.completeCodexOAuthLogin(loginId);
      await store.fetchAccounts();
      await store.fetchCurrentAccount();
      setOauthState((current) => (current?.loginId === loginId ? null : current));
      setOauthCallback("");
    } catch (error) {
      const message = String(error);
      if (!isOauthCancellationError(message)) {
        setOauthError(message);
      }
    } finally {
      setOauthAwaitingCallback(false);
    }
  }

  async function handleStartOAuth() {
    setOauthBusy(true);
    setOauthError(null);
    try {
      const next = await codexService.startCodexOAuthLogin();
      setOauthState(next);
      setOauthCallback("");
      void waitForOAuthCompletion(next.loginId);
      const url = next.authUrl;
      if (url && !isTauriRuntime()) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setOauthError(String(error));
    } finally {
      setOauthBusy(false);
    }
  }

  async function handleCancelOAuth() {
    if (!oauthState) return;
    setOauthBusy(true);
    setOauthError(null);
    try {
      await codexService.cancelCodexOAuthLogin(oauthState.loginId);
      setOauthState(null);
      setOauthCallback("");
    } catch (error) {
      setOauthError(String(error));
    } finally {
      setOauthBusy(false);
    }
  }

  async function handleSubmitOauthCallback() {
    if (!oauthState || !oauthCallback.trim()) return;
    setOauthBusy(true);
    setOauthError(null);
    try {
      await codexService.submitCodexOAuthCallbackUrl(
        oauthState.loginId,
        oauthCallback.trim()
      );
      setOauthCallback("");
    } catch (error) {
      setOauthError(String(error));
    } finally {
      setOauthBusy(false);
    }
  }

  async function handleManualAdd() {
    if (manualMode === "apiKey") {
      await codexService.addCodexAccountWithApiKey(tokenInput, baseUrlInput || undefined);
    } else {
      await codexService.addCodexAccountWithToken(
        tokenInput,
        tokenInput,
        refreshTokenInput || undefined
      );
    }
    setTokenInput("");
    setRefreshTokenInput("");
    setBaseUrlInput("");
    await store.fetchAccounts();
    await store.fetchCurrentAccount();
  }

  async function handleImportJson() {
    await store.importFromJson(importInput);
    setImportInput("");
  }

  async function handleExport() {
    const content = await store.exportAccounts(filteredAccounts.map((account) => account.id));
    setExportText(content);
  }

  async function handleExportSelected() {
    if (selectedIds.length === 0) return;
    const content = await store.exportAccounts(selectedIds);
    setExportText(content);
  }

  async function handleRefreshSelected() {
    if (selectedIds.length === 0) return;
    for (const accountId of selectedIds) {
      await codexService.refreshCodexAccountProfile(accountId);
    }
    await store.fetchAccounts();
    await store.fetchCurrentAccount();
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    await store.deleteAccounts(selectedIds);
    setSelectedIds([]);
    await store.fetchCurrentAccount();
  }

  async function handleViewModeChange(nextMode: "list" | "grid") {
    if (!settings || settings.platformAccountViewModes.codex === nextMode) return;
    const updated = await bridge.updateSettings({
      ...settings,
      platformAccountViewModes: {
        ...settings.platformAccountViewModes,
        codex: nextMode,
      },
    });
    useStore.setState({ settings: updated });
  }

  function toggleSelected(accountId: string) {
    setSelectedIds((current) =>
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId]
    );
  }

  function toggleSelectPage() {
    setSelectedIds((current) => {
      if (allPageSelected) {
        return current.filter((id) => !pageAccountIds.includes(id));
      }
      return [...new Set([...current, ...pageAccountIds])];
    });
  }

  const tabs: CodexTab[] = ["overview", "instances", "providers", "wakeup", "sessions"];
  const viewMode = settings?.platformAccountViewModes.codex ?? "grid";

  return (
    <div className="space-y-6">
      <CodexOverviewTabsHeader active={activeTab} onTabChange={setActiveTab} tabs={tabs} />

      {activeTab === "overview" ? (
        <div className="space-y-6">
          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[20px] border border-[#e8e3d8] bg-[linear-gradient(135deg,#fffdf8_0%,#f7f3e8_100%)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                OAuth
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                Codex Browser Login
              </div>
              <div className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                当前页面已经切到 provider-specific 模式。点击后会优先拉起浏览器完成登录，保留手动回调输入作为 fallback。
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleStartOAuth()}
                  disabled={oauthBusy || oauthAwaitingCallback || Boolean(oauthState)}
                  className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Globe className="h-4 w-4" />
                  <span>{oauthBusy ? "处理中..." : "开始 OAuth"}</span>
                </button>
                {oauthState ? (
                  <>
                    <div className="inline-flex items-center gap-2 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
                      <RefreshCw className={cx("h-4 w-4", oauthAwaitingCallback && "animate-spin")} />
                      <span>{oauthAwaitingCallback ? "等待浏览器回调..." : "已启动登录"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCancelOAuth()}
                      disabled={oauthBusy}
                      className="inline-flex items-center gap-2 rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>取消</span>
                    </button>
                  </>
                ) : null}
              </div>
              {oauthState ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-[14px] border border-slate-200 bg-white px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Auth URL
                    </div>
                    <div className="mt-2 break-all text-sm text-slate-700">{oauthState.authUrl}</div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                    <textarea
                      rows={3}
                      value={oauthCallback}
                      onChange={(event) => setOauthCallback(event.target.value)}
                      placeholder="需要 fallback 时，把浏览器回调链接粘贴到这里。"
                      className="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSubmitOauthCallback()}
                      disabled={oauthBusy || !oauthCallback.trim()}
                      className="rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      提交回调
                    </button>
                  </div>
                </div>
              ) : null}
              {oauthError ? (
                <div className="mt-4 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {oauthError}
                </div>
              ) : null}
            </div>

            <div className="rounded-[20px] border border-[#e8e3d8] bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Import
              </div>
              <div className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                Token / API Key
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["token", "apiKey"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setManualMode(mode)}
                    className={cx(
                      "rounded-[12px] px-3 py-2 text-sm font-medium",
                      manualMode === mode ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {mode === "apiKey" ? "API Key" : "Token"}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder={manualMode === "apiKey" ? "sk-..." : "粘贴 access token"}
                className="mt-4 w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
              />
              {manualMode === "token" ? (
                <input
                  value={refreshTokenInput}
                  onChange={(event) => setRefreshTokenInput(event.target.value)}
                  placeholder="Refresh token，可选"
                  className="mt-3 w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                />
              ) : (
                <input
                  value={baseUrlInput}
                  onChange={(event) => setBaseUrlInput(event.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="mt-3 w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                />
              )}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleManualAdd()}
                  className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>添加账号</span>
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[20px] border border-[#e8e3d8] bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <PlatformAccountOverviewToolbar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              searchPlaceholder="搜索邮箱、plan、provider..."
              viewMode={viewMode}
              onViewModeChange={(mode) => void handleViewModeChange(mode)}
              summary={`Codex 总计 ${searchedAccounts.length} 个匹配账号，当前显示 ${filteredAccounts.length} 个结果。`}
              filters={[
                {
                  id: "all",
                  label: "全部",
                  count: searchedAccounts.length,
                  active: accountFilter === "all",
                  onClick: () => setAccountFilter("all"),
                },
                {
                  id: "current",
                  label: "当前",
                  count: searchedAccounts.filter((account) => store.currentAccount?.id === account.id).length,
                  active: accountFilter === "current",
                  onClick: () => setAccountFilter("current"),
                },
                {
                  id: "standby",
                  label: "待机",
                  count: searchedAccounts.filter((account) => store.currentAccount?.id !== account.id).length,
                  active: accountFilter === "standby",
                  onClick: () => setAccountFilter("standby"),
                },
                {
                  id: "warning",
                  label: "告警",
                  count: searchedAccounts.filter((account) => Boolean(resolveCodexQuotaErrorMeta(account.quotaError).rawMessage)).length,
                  active: accountFilter === "warning",
                  onClick: () => setAccountFilter("warning"),
                },
              ]}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => void store.refreshAllTokens()}
                    className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>刷新全部</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExport()}
                    className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                  >
                    <Download className="h-4 w-4" />
                    <span>导出当前结果</span>
                  </button>
                </>
              }
              pagination={{
                totalItems: filteredAccounts.length,
                currentPage: safeCurrentPage,
                totalPages,
                pageSize,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                rangeStart: filteredAccounts.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1,
                rangeEnd:
                  filteredAccounts.length === 0
                    ? 0
                    : (safeCurrentPage - 1) * pageSize + paginatedAccounts.length,
                canGoPrevious: safeCurrentPage > 1,
                canGoNext: safeCurrentPage < totalPages,
                onPageSizeChange: setPageSize,
                onPreviousPage: () => setCurrentPage((current) => Math.max(1, current - 1)),
                onNextPage: () => setCurrentPage((current) => Math.min(totalPages, current + 1)),
              }}
            />

            <textarea
              rows={4}
              value={importInput}
              onChange={(event) => setImportInput(event.target.value)}
              placeholder="粘贴 Codex 账号 JSON 进行导入"
              className="mt-4 w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void handleImportJson()}
                className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                <Upload className="h-4 w-4" />
                <span>导入 JSON</span>
              </button>
            </div>

            {exportText ? (
              <div className="mt-4 rounded-[14px] border border-slate-200 bg-[#fbfaf8] p-4">
                <div className="mb-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(exportText)}
                    className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <Copy className="h-4 w-4" />
                    <span>复制</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadJson("codex_accounts.json", exportText)}
                    className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <Download className="h-4 w-4" />
                    <span>下载</span>
                  </button>
                </div>
                <textarea
                  rows={8}
                  readOnly
                  value={exportText}
                  className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 font-mono text-xs text-slate-700 outline-none"
                />
              </div>
            ) : null}
          </section>

          <PlatformAccountSelectionBar
            selectedCount={selectedIds.length}
            totalCount={filteredAccounts.length}
            onToggleSelectPage={toggleSelectPage}
            allPageSelected={allPageSelected}
            actions={[
              {
                id: "refresh",
                label: "刷新已选",
                onClick: () => void handleRefreshSelected(),
                disabled: selectedIds.length === 0,
              },
              {
                id: "export",
                label: "导出已选",
                onClick: () => void handleExportSelected(),
                disabled: selectedIds.length === 0,
              },
              {
                id: "delete",
                label: "删除已选",
                onClick: () => void handleDeleteSelected(),
                disabled: selectedIds.length === 0,
                tone: "danger",
              },
            ]}
          />

          {viewMode === "grid" ? (
            <PlatformAccountGridView
              items={paginatedAccounts}
              getKey={(account) => account.id}
              emptyTitle="没有匹配的 Codex 账号"
              emptyDescription="调整搜索词、筛选条件或先导入一个账号。"
              renderItem={(account) => {
                const presentation = buildCodexAccountPresentation(account);
                const isCurrent = store.currentAccount?.id === account.id;
                const quotaMeta = resolveCodexQuotaErrorMeta(account.quotaError);
                const isSelected = selectedIds.includes(account.id);

                return (
                  <article className="rounded-[20px] border border-[#e8e3d8] bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-500">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(account.id)} />
                        <span>选择</span>
                      </label>
                      {canQuickSwitchCodexProvider(account) ? (
                        <span className="rounded-[12px] border border-slate-200 bg-[#fbfaf8] px-3 py-2 text-xs text-slate-500">
                          可快速切换 Provider
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-semibold text-slate-950">{presentation.displayName}</div>
                        <span
                          className={cx(
                            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                            isCurrent ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {isCurrent ? "Current" : "Standby"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {presentation.planLabel}
                        </span>
                        {quotaMeta.rawMessage ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 ring-1 ring-amber-200">
                            {quotaMeta.statusCode || quotaMeta.errorCode || "Quota Warning"}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{account.email}</div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span>创建于 {formatTimestamp(account.createdAt)}</span>
                        <span>最近使用 {formatRelativeTime(account.lastUsedAt)}</span>
                        {account.apiProviderName ? <span>{account.apiProviderName}</span> : null}
                        {account.apiBaseUrl ? <span>{account.apiBaseUrl}</span> : null}
                      </div>
                      {quotaMeta.rawMessage ? (
                        <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          {quotaMeta.displayText}
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(account.tags || []).length > 0 ? (
                          (account.tags || []).map((tag) => (
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
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      {!isCurrent ? (
                        <button
                          type="button"
                          onClick={() => void store.switchAccount(account.id)}
                          className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-3.5 py-2 text-sm font-medium text-white"
                        >
                          <Check className="h-4 w-4" />
                          <span>设为当前</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void store.refreshToken(account.id)}
                        className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700"
                      >
                        <RefreshCw className="h-4 w-4" />
                        <span>刷新</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void store.deleteAccounts([account.id])}
                        className="inline-flex items-center gap-2 rounded-[12px] border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-medium text-rose-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>删除</span>
                      </button>
                    </div>
                  </article>
                );
              }}
            />
          ) : (
            <PlatformAccountListView
              items={paginatedAccounts}
              getKey={(account) => account.id}
              emptyTitle="没有匹配的 Codex 账号"
              emptyDescription="调整搜索词、筛选条件或先导入一个账号。"
              renderItem={(account) => {
                const presentation = buildCodexAccountPresentation(account);
                const isCurrent = store.currentAccount?.id === account.id;
                const quotaMeta = resolveCodexQuotaErrorMeta(account.quotaError);
                const isSelected = selectedIds.includes(account.id);

                return (
                  <article className="rounded-[20px] border border-[#e8e3d8] bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(account.id)} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-semibold text-slate-950">{presentation.displayName}</div>
                            <span
                              className={cx(
                                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                isCurrent ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                              )}
                            >
                              {isCurrent ? "Current" : "Standby"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {presentation.planLabel}
                            </span>
                            {quotaMeta.rawMessage ? (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 ring-1 ring-amber-200">
                                {quotaMeta.statusCode || quotaMeta.errorCode || "Quota Warning"}
                              </span>
                            ) : null}
                            {canQuickSwitchCodexProvider(account) ? (
                              <span className="rounded-[12px] border border-slate-200 bg-[#fbfaf8] px-3 py-2 text-xs text-slate-500">
                                可快速切换 Provider
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">{account.email}</div>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span>创建于 {formatTimestamp(account.createdAt)}</span>
                            <span>最近使用 {formatRelativeTime(account.lastUsedAt)}</span>
                            {account.apiProviderName ? <span>{account.apiProviderName}</span> : null}
                            {account.apiBaseUrl ? <span>{account.apiBaseUrl}</span> : null}
                          </div>
                          {quotaMeta.rawMessage ? (
                            <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                              {quotaMeta.displayText}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!isCurrent ? (
                          <button
                            type="button"
                            onClick={() => void store.switchAccount(account.id)}
                            className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-3.5 py-2 text-sm font-medium text-white"
                          >
                            <Check className="h-4 w-4" />
                            <span>设为当前</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void store.refreshToken(account.id)}
                          className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span>刷新</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void store.deleteAccounts([account.id])}
                          className="inline-flex items-center gap-2 rounded-[12px] border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-medium text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>删除</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              }}
            />
          )}
        </div>
      ) : null}

      {activeTab === "providers" ? <CodexProviderOverviewPanel accounts={store.accounts} /> : null}

      {activeTab === "instances" ? (
        <section className="rounded-[20px] border border-[#e8e3d8] bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="text-lg font-semibold text-slate-950">Codex Instances</div>
          <div className="mt-3 text-sm leading-7 text-slate-600">
            实例页模式已经从统一平台中心里拆出来；下一步继续把 `cockpit-tools-main` 的实例管理内容接到当前仓库。
          </div>
        </section>
      ) : null}

      {activeTab === "wakeup" ? (
        <section className="rounded-[20px] border border-[#e8e3d8] bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="text-lg font-semibold text-slate-950">Wakeup</div>
          <div className="mt-3 text-sm leading-7 text-slate-600">
            账户页模式已切换；Wakeup 真实任务调度会在 Tauri 模块迁移完成后接入。
          </div>
        </section>
      ) : null}

      {activeTab === "sessions" ? (
        <section className="rounded-[20px] border border-[#e8e3d8] bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="text-lg font-semibold text-slate-950">Session Manager</div>
          <div className="mt-3 text-sm leading-7 text-slate-600">
            当前先完成 provider accounts 迁移；会话扫描、可见性修复和线程同步跟随后端模块一起迁入。
          </div>
        </section>
      ) : null}
    </div>
  );
}
