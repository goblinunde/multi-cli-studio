export interface GeminiQuota {
  hourly_percentage: number;
  hourly_reset_time?: number | null;
  weekly_percentage: number;
  weekly_reset_time?: number | null;
  raw_data?: unknown;
}

export interface GeminiAccount {
  id: string;
  email: string;
  auth_id?: string | null;
  name?: string | null;
  tags?: string[] | null;
  access_token?: string | null;
  refresh_token?: string | null;
  id_token?: string | null;
  token_type?: string | null;
  scope?: string | null;
  expiry_date?: number | null;
  selected_auth_type?: string | null;
  project_id?: string | null;
  tier_id?: string | null;
  plan_name?: string | null;
  membership_type?: string | null;
  subscription_status?: string | null;
  sign_up_type?: string | null;
  gemini_auth_raw?: unknown;
  gemini_usage_raw?: unknown;
  status?: string | null;
  status_reason?: string | null;
  quota_query_last_error?: string | null;
  quota_query_last_error_at?: number | null;
  created_at: number;
  last_used: number;
  plan_type?: string;
  quota?: GeminiQuota;
}

export function getGeminiAccountDisplayEmail(account: GeminiAccount): string {
  const email = account.email?.trim();
  if (email) return email;
  const name = account.name?.trim();
  if (name) return name;
  return account.id;
}

function resolveGeminiPlanBucket(
  rawTier: string
): "free" | "pro" | "ultra" | "unknown" {
  const lower = rawTier.trim().toLowerCase();
  if (!lower) return "unknown";
  if (lower.includes("ultra")) return "ultra";
  if (lower === "standard-tier") return "free";
  if (lower.includes("pro") || lower.includes("premium")) return "pro";
  if (lower === "free-tier" || lower.includes("free")) return "free";
  return "unknown";
}

export function getGeminiPlanBadge(account: GeminiAccount): string {
  const raw = (account.plan_name || account.tier_id || account.plan_type || "").trim();
  const bucket = resolveGeminiPlanBucket(raw);
  if (bucket === "free") return "FREE";
  if (bucket === "pro") return "PRO";
  if (bucket === "ultra") return "ULTRA";
  return "UNKNOWN";
}

