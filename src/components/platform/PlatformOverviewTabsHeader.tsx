import {
  Bot,
  Clock3,
  FolderOpen,
  Layers,
  Server,
  Sparkles,
  Waypoints,
} from "lucide-react";
import type { ReactNode } from "react";
import type { PlatformId } from "../../types/platform";

export type PlatformOverviewTab =
  | "overview"
  | "wakeup"
  | "instances"
  | "sessions"
  | "providers";

interface PlatformOverviewTabsHeaderProps {
  platform: PlatformId;
  active: PlatformOverviewTab;
  onTabChange?: (tab: PlatformOverviewTab) => void;
  tabs?: PlatformOverviewTab[];
}

function platformIcon(platform: PlatformId): ReactNode {
  if (platform === "gemini") return <Sparkles className="h-4 w-4" />;
  if (platform === "kiro") return <Waypoints className="h-4 w-4" />;
  return <Bot className="h-4 w-4" />;
}

const TAB_META: Record<PlatformOverviewTab, { label: string; icon: ReactNode }> = {
  overview: { label: "账号总览", icon: null },
  wakeup: { label: "Wakeup", icon: <Clock3 className="h-4 w-4" /> },
  instances: { label: "实例", icon: <Layers className="h-4 w-4" /> },
  sessions: { label: "会话", icon: <FolderOpen className="h-4 w-4" /> },
  providers: { label: "Providers", icon: <Server className="h-4 w-4" /> },
};

export function PlatformOverviewTabsHeader({
  platform,
  active,
  onTabChange,
  tabs,
}: PlatformOverviewTabsHeaderProps) {
  const tabOrder: PlatformOverviewTab[] =
    tabs && tabs.length > 0 ? tabs : ["overview", "instances"];

  return (
    <div className="rounded-[16px] border border-[#eceae4] bg-white/92 px-5 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#f3f0e8] text-slate-700">
            {platformIcon(platform)}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Provider Accounts
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-950">
              {platform === "codex" ? "Codex" : platform === "gemini" ? "Gemini" : "Kiro"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-[14px] bg-[#f5f4f1] p-1.5">
          {tabOrder.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange?.(tab)}
              className={
                active === tab
                  ? "inline-flex items-center gap-2 rounded-[12px] bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.10)]"
                  : "inline-flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-sm font-medium text-slate-500 transition-all hover:bg-white/80 hover:text-slate-900"
              }
            >
              {TAB_META[tab].icon}
              <span>{TAB_META[tab].label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
