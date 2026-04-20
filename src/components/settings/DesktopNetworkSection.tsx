import { useEffect, useState } from "react";
import { Gauge, LoaderCircle, Network, Save } from "lucide-react";
import { bridge } from "../../lib/bridge";
import { useStore } from "../../lib/store";
import type { AppSettings } from "../../lib/models";

function normalizeMinutesInput(value: string, fallback: number) {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function DesktopNetworkSection({ settings }: { settings: AppSettings | null }) {
  const [globalProxyEnabled, setGlobalProxyEnabled] = useState(false);
  const [globalProxyUrl, setGlobalProxyUrl] = useState("");
  const [globalProxyNoProxy, setGlobalProxyNoProxy] = useState("");
  const [codexAutoRefreshMinutes, setCodexAutoRefreshMinutes] = useState("10");
  const [geminiAutoRefreshMinutes, setGeminiAutoRefreshMinutes] = useState("10");
  const [kiroAutoRefreshMinutes, setKiroAutoRefreshMinutes] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGlobalProxyEnabled(settings?.globalProxyEnabled === true);
    setGlobalProxyUrl(settings?.globalProxyUrl ?? "");
    setGlobalProxyNoProxy(settings?.globalProxyNoProxy ?? "");
    setCodexAutoRefreshMinutes(String(settings?.codexAutoRefreshMinutes ?? 10));
    setGeminiAutoRefreshMinutes(String(settings?.geminiAutoRefreshMinutes ?? 10));
    setKiroAutoRefreshMinutes(String(settings?.kiroAutoRefreshMinutes ?? 10));
  }, [settings]);

  async function handleSave() {
    if (!settings) {
      setError("设置尚未加载完成。");
      return;
    }

    const nextProxyUrl = globalProxyUrl.trim();
    const nextNoProxy = globalProxyNoProxy.trim();
    if (globalProxyEnabled && !nextProxyUrl) {
      setError("启用全局代理时，代理地址不能为空。");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const updated = await bridge.updateSettings({
        ...settings,
        globalProxyEnabled,
        globalProxyUrl: nextProxyUrl,
        globalProxyNoProxy: nextNoProxy,
        codexAutoRefreshMinutes: normalizeMinutesInput(
          codexAutoRefreshMinutes,
          settings.codexAutoRefreshMinutes
        ),
        geminiAutoRefreshMinutes: normalizeMinutesInput(
          geminiAutoRefreshMinutes,
          settings.geminiAutoRefreshMinutes
        ),
        kiroAutoRefreshMinutes: normalizeMinutesInput(
          kiroAutoRefreshMinutes,
          settings.kiroAutoRefreshMinutes
        ),
      });
      useStore.setState({ settings: updated });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section">
      <div className="flex flex-col gap-4">
        <div>
          <div className="settings-section-title">网络</div>
          <div className="settings-section-subtitle">
            保留 SSH `ProxyJump` 独立配置，同时给桌面端 HTTP 请求和受管进程补全 cockpit 风格的 Global Proxy。
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Network className="h-4 w-4" />
                  <span>Global Proxy</span>
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-500">
                  生效范围包括账号额度刷新、OAuth / profile / quota 请求，以及后续由桌面端拉起的受管命令。
                </div>
              </div>
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={globalProxyEnabled}
                  onChange={(event) => setGlobalProxyEnabled(event.target.checked)}
                />
                启用
              </label>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                <span>Proxy URL</span>
                <input
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-300 focus:bg-white"
                  value={globalProxyUrl}
                  onChange={(event) => setGlobalProxyUrl(event.target.value)}
                  placeholder="http://127.0.0.1:7890 或 socks5://127.0.0.1:7890"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                <span>no_proxy</span>
                <input
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-300 focus:bg-white"
                  value={globalProxyNoProxy}
                  onChange={(event) => setGlobalProxyNoProxy(event.target.value)}
                  placeholder="localhost,127.0.0.1,.corp.internal"
                />
                <span className="text-xs leading-5 text-slate-500">
                  逗号分隔。这里只影响全局网络代理，不会覆盖 SSH 连接上的 `ProxyJump`。
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-2 text-sm font-semibold text-slate-900">
              <Gauge className="mt-0.5 h-4 w-4" />
              <div>
                <div>账号额度自动刷新</div>
                <div className="mt-2 text-sm font-normal leading-6 text-slate-500">
                  分平台设置后台刷新间隔，单位为分钟。填 `0` 表示禁用，Tauri worker 会在页面关闭后继续运行。
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                <span>Codex</span>
                <input
                  inputMode="numeric"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-300 focus:bg-white"
                  value={codexAutoRefreshMinutes}
                  onChange={(event) => setCodexAutoRefreshMinutes(event.target.value)}
                  placeholder="10"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                <span>Gemini</span>
                <input
                  inputMode="numeric"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-300 focus:bg-white"
                  value={geminiAutoRefreshMinutes}
                  onChange={(event) => setGeminiAutoRefreshMinutes(event.target.value)}
                  placeholder="10"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                <span>Kiro</span>
                <input
                  inputMode="numeric"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-300 focus:bg-white"
                  value={kiroAutoRefreshMinutes}
                  onChange={(event) => setKiroAutoRefreshMinutes(event.target.value)}
                  placeholder="10"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="dcc-action-button"
            onClick={() => void handleSave()}
            disabled={busy}
          >
            {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
            保存网络设置
          </button>
          <div className="text-xs text-slate-500">
            代理变更会立即同步到桌面端运行时环境；自动刷新间隔由后台 worker 读取最新设置。
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>
    </section>
  );
}
