import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Bot,
  Boxes,
  Cpu,
  KeyRound,
  Sparkles,
  Waypoints,
} from "lucide-react";
import {
  buildPlatformAccountPath,
  PLATFORM_CENTER_API_PATH,
} from "../lib/platformCenterRoutes";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const PLATFORM_TABS = [
  {
    key: "api",
    label: "API Providers",
    href: PLATFORM_CENTER_API_PATH,
    icon: Cpu,
    description: "保留现有 OpenAI Compatible / Claude / Gemini provider 配置。",
  },
  {
    key: "codex",
    label: "Codex",
    href: buildPlatformAccountPath("codex"),
    icon: Bot,
    description: "OAuth、账号切换、本地访问、Wakeup、会话与模型提供方。",
  },
  {
    key: "gemini",
    label: "Gemini",
    href: buildPlatformAccountPath("gemini"),
    icon: Sparkles,
    description: "OAuth、账号中心、实例注入与启动命令。",
  },
  {
    key: "kiro",
    label: "Kiro",
    href: buildPlatformAccountPath("kiro"),
    icon: Waypoints,
    description: "OAuth、账号中心、实例注入与 credits 视图。",
  },
] as const;

function resolveActiveTab(pathname: string) {
  if (pathname.startsWith(`${PLATFORM_CENTER_API_PATH}`)) {
    return "api";
  }
  if (pathname.startsWith(buildPlatformAccountPath("codex"))) {
    return "codex";
  }
  if (pathname.startsWith(buildPlatformAccountPath("gemini"))) {
    return "gemini";
  }
  if (pathname.startsWith(buildPlatformAccountPath("kiro"))) {
    return "kiro";
  }
  return null;
}

function OverviewCard({
  title,
  copy,
  href,
  icon: Icon,
}: {
  title: string;
  copy: string;
  href: string;
  icon: typeof Cpu;
}) {
  return (
    <Link
      to={href}
      className="group rounded-[20px] border border-[#e8e3d8] bg-white p-6 shadow-[0_16px_44px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-[2px] hover:shadow-[0_22px_50px_rgba(15,23,42,0.10)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#f3f0e8] text-slate-700 transition-all group-hover:bg-[#ece5d8]">
          <Icon className="h-5 w-5" />
        </div>
        <Boxes className="h-5 w-5 text-slate-300 transition-all group-hover:text-slate-500" />
      </div>
      <div className="mt-6 text-lg font-semibold tracking-tight text-slate-950">{title}</div>
      <div className="mt-2 text-sm leading-7 text-slate-500">{copy}</div>
    </Link>
  );
}

function PlatformCenterOverview() {
  return (
    <div className="space-y-6">
      <section className="rounded-[20px] border border-[#e8e3d8] bg-[linear-gradient(135deg,#fffdf8_0%,#f5f0e4_100%)] p-7 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="max-w-3xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Platform Center
          </div>
          <div className="mt-3 text-[30px] font-semibold tracking-tight text-slate-950">
            模型管理已升级为统一平台中心
          </div>
          <div className="mt-4 text-sm leading-7 text-slate-600">
            这里同时承载两类能力：`API Providers` 继续服务 `ModelChatPage`；
            `Codex / Gemini / Kiro` 则负责账号中心、实例、注入、本地访问和外围平台能力。
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {PLATFORM_TABS.map((tab) => (
          <OverviewCard
            key={tab.key}
            title={tab.label}
            copy={tab.description}
            href={tab.href}
            icon={tab.icon}
          />
        ))}
      </section>
    </div>
  );
}

export function PlatformCenterPage() {
  const location = useLocation();
  const activeTab = resolveActiveTab(location.pathname);
  const isOverview = location.pathname === "/settings/model-providers";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[16px] border border-[#eceae4] bg-white/92 px-5 py-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Unified Platform Center
            </div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              账号中心与 API Providers
            </div>
            <div className="mt-2 text-sm text-slate-500">
              统一管理当前项目的聊天 provider、Codex、Gemini 与 Kiro 平台账户。
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-[14px] bg-[#f5f4f1] p-1.5">
            <Link
              to="/settings/model-providers"
              className={cx(
                "inline-flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-sm font-medium transition-all",
                isOverview
                  ? "bg-white text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.10)]"
                  : "text-slate-500 hover:bg-white/80 hover:text-slate-900"
              )}
            >
              <Boxes className="h-4 w-4" />
              <span>概览</span>
            </Link>
            {PLATFORM_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.key}
                  to={tab.href}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-sm font-medium transition-all",
                    activeTab === tab.key
                      ? "bg-white text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.10)]"
                      : "text-slate-500 hover:bg-white/80 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {isOverview ? <PlatformCenterOverview /> : <Outlet />}
    </div>
  );
}
