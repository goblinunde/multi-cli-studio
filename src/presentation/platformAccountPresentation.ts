import type { CodexAccount } from "../types/codex";
import { getCodexPlanBadgeLabel } from "../types/codex";
import type { GeminiAccount } from "../types/gemini";
import { getGeminiAccountDisplayEmail, getGeminiPlanBadge } from "../types/gemini";
import type { KiroAccount } from "../types/kiro";
import { getKiroAccountDisplayEmail, getKiroPlanBadge } from "../types/kiro";

export interface UnifiedQuotaMetric {
  key: string;
  label: string;
  percentage: number;
  quotaClass: "high" | "medium" | "low" | "critical";
  text: string;
}

export interface UnifiedAccountPresentation {
  displayName: string;
  planLabel: string;
  planClass: string;
  quotaItems: UnifiedQuotaMetric[];
}

function getQuotaClass(percentage: number): UnifiedQuotaMetric["quotaClass"] {
  if (percentage >= 90) return "critical";
  if (percentage >= 70) return "low";
  if (percentage >= 40) return "medium";
  return "high";
}

function resolvePlanClass(planLabel: string): string {
  const normalized = planLabel.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (normalized.includes("enterprise") || normalized.includes("team")) return "enterprise";
  if (normalized.includes("ultra")) return "ultra";
  if (normalized.includes("pro") || normalized.includes("business")) return "pro";
  if (normalized.includes("free")) return "free";
  return "unknown";
}

function buildQuotaItems(
  hourlyPercentage?: number | null,
  weeklyPercentage?: number | null
): UnifiedQuotaMetric[] {
  const items: UnifiedQuotaMetric[] = [];
  if (typeof hourlyPercentage === "number") {
    items.push({
      key: "hourly",
      label: "Hourly",
      percentage: hourlyPercentage,
      quotaClass: getQuotaClass(hourlyPercentage),
      text: `Hourly ${hourlyPercentage}%`,
    });
  }
  if (typeof weeklyPercentage === "number") {
    items.push({
      key: "weekly",
      label: "Weekly",
      percentage: weeklyPercentage,
      quotaClass: getQuotaClass(weeklyPercentage),
      text: `Weekly ${weeklyPercentage}%`,
    });
  }
  return items;
}

export function buildQuotaPreviewLines(items: UnifiedQuotaMetric[], maxItems = 2) {
  return items.slice(0, maxItems);
}

export function buildCodexAccountPresentation(
  account: CodexAccount
): UnifiedAccountPresentation {
  const planLabel = getCodexPlanBadgeLabel(account);
  return {
    displayName: account.displayName || account.accountName || account.email,
    planLabel,
    planClass: resolvePlanClass(planLabel),
    quotaItems: buildQuotaItems(
      account.quota?.hourlyPercentage ?? null,
      account.quota?.weeklyPercentage ?? null
    ),
  };
}

export function buildGeminiAccountPresentation(
  account: GeminiAccount
): UnifiedAccountPresentation {
  const planLabel = getGeminiPlanBadge(account);
  return {
    displayName: getGeminiAccountDisplayEmail(account),
    planLabel,
    planClass: resolvePlanClass(planLabel),
    quotaItems: buildQuotaItems(
      account.quota?.hourly_percentage ?? null,
      account.quota?.weekly_percentage ?? null
    ),
  };
}

export function buildKiroAccountPresentation(
  account: KiroAccount
): UnifiedAccountPresentation {
  const planLabel = getKiroPlanBadge(account);
  return {
    displayName: getKiroAccountDisplayEmail(account),
    planLabel,
    planClass: resolvePlanClass(planLabel),
    quotaItems: buildQuotaItems(
      account.quota?.hourly_percentage ?? null,
      account.quota?.weekly_percentage ?? null
    ),
  };
}
