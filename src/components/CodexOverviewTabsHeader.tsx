import {
  PlatformOverviewTabsHeader,
  type PlatformOverviewTab,
} from "./platform/PlatformOverviewTabsHeader";

export type CodexTab = PlatformOverviewTab;

export function CodexOverviewTabsHeader({
  active,
  onTabChange,
  tabs,
}: {
  active: CodexTab;
  onTabChange?: (tab: CodexTab) => void;
  tabs?: CodexTab[];
}) {
  return (
    <PlatformOverviewTabsHeader
      platform="codex"
      active={active}
      onTabChange={onTabChange}
      tabs={tabs}
    />
  );
}

