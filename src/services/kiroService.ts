import { invoke } from "@tauri-apps/api/core";
import type { KiroAccount } from "../types/kiro";

export interface KiroOAuthLoginStartResponse {
  loginId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string | null;
  expiresIn: number;
  intervalSeconds: number;
  callbackUrl?: string | null;
}

export interface KiroOAuthLoginStatusResponse {
  loginId: string;
  status: "waiting" | "ready" | "expired" | "cancelled" | "replaced";
  callbackUrl?: string | null;
  expiresAt?: number | null;
}

export async function listKiroAccounts(): Promise<KiroAccount[]> {
  return await invoke("list_kiro_accounts");
}

export async function deleteKiroAccount(accountId: string): Promise<void> {
  return await invoke("delete_kiro_account", { accountId });
}

export async function deleteKiroAccounts(accountIds: string[]): Promise<void> {
  return await invoke("delete_kiro_accounts", { accountIds });
}

export async function importKiroFromJson(jsonContent: string): Promise<KiroAccount[]> {
  return await invoke("import_kiro_from_json", { jsonContent });
}

export async function importKiroFromLocal(): Promise<KiroAccount[]> {
  return await invoke("import_kiro_from_local");
}

export async function exportKiroAccounts(accountIds: string[]): Promise<string> {
  return await invoke("export_kiro_accounts", { accountIds });
}

export async function refreshKiroToken(accountId: string): Promise<KiroAccount> {
  return await invoke("refresh_kiro_token", { accountId });
}

export async function refreshAllKiroTokens(): Promise<number> {
  return await invoke("refresh_all_kiro_tokens");
}

export async function startKiroOAuthLogin(): Promise<KiroOAuthLoginStartResponse> {
  return await invoke("kiro_oauth_login_start");
}

export async function getKiroOAuthLoginStatus(
  loginId: string
): Promise<KiroOAuthLoginStatusResponse> {
  return await invoke("kiro_oauth_login_status", { loginId });
}

export async function completeKiroOAuthLogin(loginId: string): Promise<KiroAccount> {
  return await invoke("kiro_oauth_login_complete", { loginId });
}

export async function cancelKiroOAuthLogin(loginId?: string): Promise<void> {
  return await invoke("kiro_oauth_login_cancel", { loginId: loginId ?? null });
}

export async function submitKiroOAuthCallbackUrl(
  loginId: string,
  callbackUrl: string
): Promise<void> {
  return await invoke("kiro_oauth_submit_callback_url", { loginId, callbackUrl });
}

export async function addKiroAccountWithToken(accessToken: string): Promise<KiroAccount> {
  return await invoke("add_kiro_account_with_token", {
    accessToken,
    access_token: accessToken,
  });
}

export async function updateKiroAccountTags(
  accountId: string,
  tags: string[]
): Promise<KiroAccount> {
  return await invoke("update_kiro_account_tags", { accountId, tags });
}

export async function injectKiroToVSCode(accountId: string): Promise<string> {
  return await invoke("switch_kiro_account", { accountId });
}
