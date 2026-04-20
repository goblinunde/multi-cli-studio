import {
  PlatformOverviewTabsHeader,
  type PlatformOverviewTab,
} from "./platform/PlatformOverviewTabsHeader";

export type KiroTab = PlatformOverviewTab;

export function KiroOverviewTabsHeader({
  active,
  onTabChange,
}: {
  active: KiroTab;
  onTabChange?: (tab: KiroTab) => void;
}) {
  return (
    <PlatformOverviewTabsHeader
      platform="kiro"
      active={active}
      onTabChange={onTabChange}
    />
  );
}

