export interface KiroQuota {
  hourly_percentage: number;
  hourly_reset_time?: number | null;
  weekly_percentage: number;
  weekly_reset_time?: number | null;
  raw_data?: unknown;
}

export interface KiroAccount {
  id: string;
  email: string;
  user_id?: string | null;
  login_provider?: string | null;
  tags?: string[] | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_type?: string | null;
  expires_at?: number | null;
  idc_region?: string | null;
  issuer_url?: string | null;
  client_id?: string | null;
  scopes?: string | null;
  login_hint?: string | null;
  plan_name?: string | null;
  plan_tier?: string | null;
  credits_total?: number | null;
  credits_used?: number | null;
  bonus_total?: number | null;
  bonus_used?: number | null;
  usage_reset_at?: number | null;
  bonus_expire_days?: number | null;
  kiro_auth_token_raw?: unknown;
  kiro_profile_raw?: unknown;
  kiro_usage_raw?: unknown;
  status?: string | null;
  status_reason?: string | null;
  quota_query_last_error?: string | null;
  quota_query_last_error_at?: number | null;
  created_at: number;
  last_used: number;
  plan_type?: string;
  quota?: KiroQuota;
}

export function getKiroAccountDisplayEmail(account: KiroAccount): string {
  const email = account.email?.trim();
  if (email) return email;
  const userId = account.user_id?.trim();
  if (userId) return userId;
  return account.id;
}

export function getKiroPlanBadge(account: KiroAccount): string {
  const raw = (
    account.plan_type ||
    account.plan_name ||
    account.plan_tier ||
    ""
  )
    .trim()
    .toLowerCase();
  if (!raw) return "UNKNOWN";
  if (raw.includes("enterprise")) return "ENTERPRISE";
  if (raw.includes("business")) return "BUSINESS";
  if (raw.includes("individual")) return "INDIVIDUAL";
  if (raw.includes("pro")) return "PRO";
  if (raw.includes("free")) return "FREE";
  return raw.toUpperCase();
}
