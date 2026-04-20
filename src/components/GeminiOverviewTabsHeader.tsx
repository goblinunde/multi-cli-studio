import {
  PlatformOverviewTabsHeader,
  type PlatformOverviewTab,
} from "./platform/PlatformOverviewTabsHeader";

export type GeminiTab = PlatformOverviewTab;

export function GeminiOverviewTabsHeader({
  active,
  onTabChange,
}: {
  active: GeminiTab;
  onTabChange?: (tab: GeminiTab) => void;
}) {
  return (
    <PlatformOverviewTabsHeader
      platform="gemini"
      active={active}
      onTabChange={onTabChange}
    />
  );
}

