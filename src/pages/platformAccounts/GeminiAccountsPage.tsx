import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  Globe,
  KeyRound,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { GeminiOverviewTabsHeader, type GeminiTab } from "../../components/GeminiOverviewTabsHeader";
import { PlatformAccountGridView } from "../../components/platform/PlatformAccountGridView";
import { PlatformAccountListView } from "../../components/platform/PlatformAccountListView";
import { PlatformAccountOverviewToolbar } from "../../components/platform/PlatformAccountOverviewToolbar";
import { PlatformAccountSelectionBar } from "../../components/platform/PlatformAccountSelectionBar";
import { buildGeminiAccountPresentation } from "../../presentation/platformAccountPresentation";
import { useGeminiAccountStore } from "../../stores/useGeminiAccountStore";
import * as geminiService from "../../services/geminiService";
import { bridge, isTauriRuntime } from "../../lib/bridge";
import { downloadJson } from "../../lib/platformAccounts";
import { useStore } from "../../lib/store";

const PAGE_SIZE_OPTIONS = [6, 12, 24] as const;

function formatTimestamp(value?: number | null) {
  if (!value) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value > 1e12 ? value : value * 1000));
}

export function GeminiAccountsPage() {
  const [activeTab, setActiveTab] = useState<GeminiTab>("overview");
  const store = useGeminiAccountStore();
  const settings = useStore((state) => state.settings);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<"all" | "current" | "standby">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [oauthState, setOauthState] = useState<Awaited<
    ReturnType<typeof geminiService.startGeminiOAuthLogin>
  > | null>(null);
  const [oauthCallback, setOauthCallback] = useState("");
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthAwaitingCallback, setOauthAwaitingCallback] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [importInput, setImportInput] = useState("");
  const [exportText, setExportText] = useState("");

  useEffect(() => {
    void store.fetchAccounts();
  }, [store]);

  const searchedAccounts = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return store.accounts;
    return store.accounts.filter((account) => {
      const presentation = buildGeminiAccountPresentation(account);
      return [account.email, account.name, presentation.planLabel]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword));
    });
  }, [searchQuery, store.accounts]);

  const filteredAccounts = useMemo(() => {
    return searchedAccounts.filter((account) => {
      if (accountFilter === "current") return store.currentAccountId === account.id;
      if (accountFilter === "standby") return store.currentAccountId !== account.id;
      return true;
    });
  }, [accountFilter, searchedAccounts, store.currentAccountId]);

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
      await geminiService.completeGeminiOAuthLogin(loginId);
      await store.fetchAccounts();
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
      const next = await geminiService.startGeminiOAuthLogin();
      setOauthState(next);
      setOauthCallback("");
      void waitForOAuthCompletion(next.loginId);
      if (!isTauriRuntime()) {
        window.open(next.verificationUri, "_blank", "noopener,noreferrer");
      }
    } finally {
      setOauthBusy(false);
    }
  }

  async function handleCancelOAuth() {
    if (!oauthState) return;
    setOauthBusy(true);
    setOauthError(null);
    try {
      await geminiService.cancelGeminiOAuthLogin(oauthState.loginId);
      setOauthState(null);
      setOauthCallback("");
    } finally {
      setOauthBusy(false);
    }
  }

  async function handleSubmitCallback() {
    if (!oauthState || !oauthCallback.trim()) return;
    setOauthBusy(true);
    setOauthError(null);
    try {
      await geminiService.submitGeminiOAuthCallbackUrl(
        oauthState.loginId,
        oauthCallback.trim()
      );
      setOauthCallback("");
    } finally {
      setOauthBusy(false);
    }
  }

  async function handleManualAdd() {
    await geminiService.addGeminiAccountWithToken(tokenInput);
    setTokenInput("");
    await store.fetchAccounts();
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
      await geminiService.refreshGeminiToken(accountId);
    }
    await store.fetchAccounts();
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    await store.deleteAccounts(selectedIds);
    setSelectedIds([]);
  }

  async function handleViewModeChange(nextMode: "list" | "grid") {
    if (!settings || settings.platformAccountViewModes.gemini === nextMode) return;
    const updated = await bridge.updateSettings({
      ...settings,
      platformAccountViewModes: {
        ...settings.platformAccountViewModes,
        gemini: nextMode,
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

  const viewMode = settings?.platformAccountViewModes.gemini ?? "grid";

  return (
    <div className="space-y-6">
      <GeminiOverviewTabsHeader active={activeTab} onTabChange={setActiveTab} />

      {activeTab === "overview" ? (
        <div className="space-y-6">
          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[20px] border border-[#e8e3d8] bg-[linear-gradient(135deg,#fcfff8_0%,#ebf8f2_100%)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                OAuth
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                Gemini Browser Login
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-600">
                页面模式已对齐到 provider accounts 结构，优先通过浏览器完成 Gemini OAuth。
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleStartOAuth()}
                  disabled={oauthBusy || oauthAwaitingCallback || Boolean(oauthState)}
                  className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
                >
                  <Globe className="h-4 w-4" />
                  <span>{oauthBusy ? "处理中..." : "开始 OAuth"}</span>
                </button>
                {oauthState ? (
                  <>
                    <div className="inline-flex items-center gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                      <RefreshCw className={oauthAwaitingCallback ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
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
                      Verification URL
                    </div>
                    <div className="mt-2 break-all text-sm text-slate-700">
                      {oauthState.verificationUri}
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={oauthCallback}
                    onChange={(event) => setOauthCallback(event.target.value)}
                    placeholder="需要 fallback 时粘贴浏览器回调链接"
                    className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSubmitCallback()}
                    disabled={oauthBusy || !oauthCallback.trim()}
                    className="rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                  >
                    提交回调
                  </button>
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
                Token / Import
              </div>
              <div className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                补录与导入
              </div>
              <textarea
                rows={3}
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="Access token"
                className="mt-4 w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleManualAdd()}
                  className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>添加账号</span>
                </button>
              </div>
              <textarea
                rows={5}
                value={importInput}
                onChange={(event) => setImportInput(event.target.value)}
                placeholder="粘贴 Gemini 账号 JSON"
                className="mt-4 w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleImportJson()}
                  className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  <Upload className="h-4 w-4" />
                  <span>导入 JSON</span>
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[20px] border border-[#e8e3d8] bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <PlatformAccountOverviewToolbar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              searchPlaceholder="搜索邮箱、plan..."
              viewMode={viewMode}
              onViewModeChange={(mode) => void handleViewModeChange(mode)}
              summary={`Gemini 总计 ${searchedAccounts.length} 个匹配账号，当前显示 ${filteredAccounts.length} 个结果。`}
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
                  count: searchedAccounts.filter((account) => store.currentAccountId === account.id).length,
                  active: accountFilter === "current",
                  onClick: () => setAccountFilter("current"),
                },
                {
                  id: "standby",
                  label: "待机",
                  count: searchedAccounts.filter((account) => store.currentAccountId !== account.id).length,
                  active: accountFilter === "standby",
                  onClick: () => setAccountFilter("standby"),
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
            {exportText ? (
              <div className="mt-4 rounded-[14px] border border-slate-200 bg-[#fbfaf8] p-4">
                <button
                  type="button"
                  onClick={() => downloadJson("gemini_accounts.json", exportText)}
                  className="mb-3 inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <Download className="h-4 w-4" />
                  <span>下载</span>
                </button>
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
              emptyTitle="没有匹配的 Gemini 账号"
              emptyDescription="调整搜索词、筛选条件或先导入一个账号。"
              renderItem={(account) => {
                const presentation = buildGeminiAccountPresentation(account);
                const isCurrent = store.currentAccountId === account.id;
                const isSelected = selectedIds.includes(account.id);

                return (
                  <article className="rounded-[20px] border border-[#e8e3d8] bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(account.id)} />
                      <span>选择</span>
                    </label>
                    <div className="mt-4 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-semibold text-slate-950">{presentation.displayName}</div>
                        <span className={isCurrent ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500"}>
                          {isCurrent ? "Current" : "Standby"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {presentation.planLabel}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{account.email}</div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span>创建于 {formatTimestamp(account.created_at)}</span>
                        <span>最近使用 {formatTimestamp(account.last_used)}</span>
                        {account.tier_id ? <span>{account.tier_id}</span> : null}
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
              emptyTitle="没有匹配的 Gemini 账号"
              emptyDescription="调整搜索词、筛选条件或先导入一个账号。"
              renderItem={(account) => {
                const presentation = buildGeminiAccountPresentation(account);
                const isCurrent = store.currentAccountId === account.id;
                const isSelected = selectedIds.includes(account.id);

                return (
                  <article className="rounded-[20px] border border-[#e8e3d8] bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(account.id)} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-semibold text-slate-950">{presentation.displayName}</div>
                            <span className={isCurrent ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500"}>
                              {isCurrent ? "Current" : "Standby"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {presentation.planLabel}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-slate-500">{account.email}</div>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span>创建于 {formatTimestamp(account.created_at)}</span>
                            <span>最近使用 {formatTimestamp(account.last_used)}</span>
                            {account.tier_id ? <span>{account.tier_id}</span> : null}
                          </div>
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

      {activeTab === "instances" ? (
        <section className="rounded-[20px] border border-[#e8e3d8] bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="text-lg font-semibold text-slate-950">Gemini Instances</div>
          <div className="mt-3 text-sm leading-7 text-slate-600">
            账户页模式已迁入，实例页将在下一步继续对齐 `cockpit-tools-main` 的独立实例管理内容。
          </div>
        </section>
      ) : null}
    </div>
  );
}
