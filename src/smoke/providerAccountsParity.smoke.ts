import type { ProviderCurrentPlatform } from "../services/providerCurrentAccountService";
import { useCodexAccountStore } from "../stores/useCodexAccountStore";
import { useGeminiAccountStore } from "../stores/useGeminiAccountStore";
import { useKiroAccountStore } from "../stores/useKiroAccountStore";
import type { CodexAccount } from "../types/codex";
import { getGeminiPlanBadge, type GeminiAccount } from "../types/gemini";
import { getKiroPlanBadge, type KiroAccount } from "../types/kiro";
import type { AppSettings, PlatformAccountViewMode } from "../lib/models";
import type { PlatformId } from "../types/platform";
import type { CodexTab } from "../components/CodexOverviewTabsHeader";
import type { GeminiTab } from "../components/GeminiOverviewTabsHeader";
import type { KiroTab } from "../components/KiroOverviewTabsHeader";
import {
  PlatformAccountOverviewToolbar,
  type PlatformOverviewFilterChip,
  type PlatformOverviewPagination,
} from "../components/platform/PlatformAccountOverviewToolbar";
import {
  PlatformAccountSelectionBar,
  type PlatformOverviewBulkAction,
} from "../components/platform/PlatformAccountSelectionBar";
import { PlatformAccountGridView } from "../components/platform/PlatformAccountGridView";
import { PlatformAccountListView } from "../components/platform/PlatformAccountListView";

const provider: ProviderCurrentPlatform = "gemini";
const platform: PlatformId = "codex";
const codexTab: CodexTab = "overview";
const geminiTab: GeminiTab = "overview";
const kiroTab: KiroTab = "overview";
const viewMode: PlatformAccountViewMode = "grid";

const codexAccount = {} as CodexAccount;
const geminiAccount = {} as GeminiAccount;
const kiroAccount = {} as KiroAccount;
const settings = {} as AppSettings;
const filterChip = {} as PlatformOverviewFilterChip;
const bulkAction = {} as PlatformOverviewBulkAction;
const pagination = {} as PlatformOverviewPagination;

void provider;
void platform;
void codexTab;
void geminiTab;
void kiroTab;
void viewMode;
void codexAccount;
void getGeminiPlanBadge(geminiAccount);
void getKiroPlanBadge(kiroAccount);
void useCodexAccountStore;
void useGeminiAccountStore;
void useKiroAccountStore;
void settings.platformAccountViewModes.codex;
void settings.platformAccountViewModes.gemini;
void settings.platformAccountViewModes.kiro;
void settings.globalProxyEnabled;
void settings.globalProxyUrl;
void settings.globalProxyNoProxy;
void settings.codexAutoRefreshMinutes;
void settings.geminiAutoRefreshMinutes;
void settings.kiroAutoRefreshMinutes;
void PlatformAccountOverviewToolbar;
void PlatformAccountSelectionBar;
void PlatformAccountGridView;
void PlatformAccountListView;
void filterChip.active;
void bulkAction.tone;
void pagination.currentPage;
