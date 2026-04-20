import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Pencil, Plus, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PlatformAccount } from "../../lib/platformAccounts";
import {
  buildApiProviderEditorPath,
  PLATFORM_CENTER_API_PATH,
} from "../../lib/platformCenterRoutes";
import {
  listCodexProviderOverview,
  type CodexProviderOverviewItem,
} from "../../services/codexProviderOverviewService";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CodexProviderOverviewPanel({
  accounts,
}: {
  accounts: PlatformAccount[];
}) {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<CodexProviderOverviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void listCodexProviderOverview(accounts)
      .then((items) => {
        if (!cancelled) {
          setProviders(items);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setProviders([]);
          setError(
            nextError instanceof Error ? nextError.message : "加载 provider 概览失败。"
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accounts]);

  const linkedAccountsTotal = useMemo(
    () => providers.reduce((sum, item) => sum + item.linkedAccountCount, 0),
    [providers]
  );

  return (
    <div className="mt-5 space-y-5">
      <div className="flex flex-col gap-4 rounded-[16px] border border-slate-200 bg-[#fbfaf8] p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-sm font-semibold text-slate-950">OpenAI Compatible Providers</div>
          <div className="mt-2 text-sm leading-7 text-slate-500">
            当前这里直接读取 `API Providers` 里的 OpenAI Compatible 配置，并统计被多少个
            Codex API Key 账号引用。后续完整迁移时，这里会替换成上游的 provider manager。
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>Providers {providers.length}</span>
            <span>Linked Accounts {linkedAccountsTotal}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`${PLATFORM_CENTER_API_PATH}?serviceType=openaiCompatible`)}
            className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" />
            <span>打开 Provider 列表</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(`${PLATFORM_CENTER_API_PATH}/new?serviceType=openaiCompatible`)}
            className="inline-flex items-center gap-2 rounded-[12px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-black"
          >
            <Plus className="h-4 w-4" />
            <span>新增 Provider</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[16px] border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500">
          正在加载 provider 概览...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && providers.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
          <div className="text-sm font-semibold text-slate-900">
            当前还没有 OpenAI Compatible provider
          </div>
          <div className="mt-2 text-sm leading-7 text-slate-500">
            新建后就可以在 Codex API Key 账号里直接快速切换。
          </div>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {providers.map((provider) => (
            <article
              key={provider.id}
              className="rounded-[16px] border border-[#eceae4] bg-white/92 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-slate-950">
                      {provider.name}
                    </div>
                    {provider.enabledForChat ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                        Chat Default
                      </span>
                    ) : null}
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Linked {provider.linkedAccountCount}
                    </span>
                  </div>
                  <div className="mt-2 break-all text-sm text-slate-500">{provider.baseUrl}</div>
                  <div className="mt-3 text-xs text-slate-400">
                    API Key {provider.apiKeyMasked || "未配置"} · 更新于{" "}
                    {formatDate(provider.updatedAt)}
                  </div>
                  {provider.linkedAccountNames.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {provider.linkedAccountNames.map((name) => (
                        <span
                          key={`${provider.id}-${name}`}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                        >
                          {name}
                        </span>
                      ))}
                      {provider.linkedAccountCount > provider.linkedAccountNames.length ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
                          +{provider.linkedAccountCount - provider.linkedAccountNames.length}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 text-xs text-slate-400">
                      暂无 Codex API Key 账号引用这个 provider。
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(buildApiProviderEditorPath("openaiCompatible", provider.id))
                    }
                    className="inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4" />
                    <span>编辑</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`${PLATFORM_CENTER_API_PATH}?serviceType=openaiCompatible`)}
                    className={cx(
                      "inline-flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50",
                      provider.linkedAccountCount === 0 && "opacity-80"
                    )}
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>管理引用</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
