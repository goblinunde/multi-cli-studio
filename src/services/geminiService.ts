import { invoke } from "@tauri-apps/api/core";
import type { GeminiAccount } from "../types/gemini";

export interface GeminiOAuthLoginStartResponse {
  loginId: string;
  verificationUri: string;
  expiresIn: number;
  intervalSeconds: number;
  callbackUrl?: string | null;
}

export async function startGeminiOAuthLogin(): Promise<GeminiOAuthLoginStartResponse> {
  return await invoke("gemini_oauth_login_start");
}

export async function completeGeminiOAuthLogin(loginId: string): Promise<GeminiAccount> {
  return await invoke("gemini_oauth_login_complete", { loginId });
}

export async function cancelGeminiOAuthLogin(loginId?: string): Promise<void> {
  return await invoke("gemini_oauth_login_cancel", { loginId: loginId ?? null });
}

export async function submitGeminiOAuthCallbackUrl(
  loginId: string,
  callbackUrl: string
): Promise<void> {
  return await invoke("gemini_oauth_submit_callback_url", { loginId, callbackUrl });
}

export async function listGeminiAccounts(): Promise<GeminiAccount[]> {
  return await invoke("list_gemini_accounts");
}

export async function deleteGeminiAccount(accountId: string): Promise<void> {
  return await invoke("delete_gemini_account", { accountId });
}

export async function deleteGeminiAccounts(accountIds: string[]): Promise<void> {
  return await invoke("delete_gemini_accounts", { accountIds });
}

export async function importGeminiFromJson(jsonContent: string): Promise<GeminiAccount[]> {
  return await invoke("import_gemini_from_json", { jsonContent });
}

export async function importGeminiFromLocal(): Promise<GeminiAccount[]> {
  return await invoke("import_gemini_from_local");
}

export async function exportGeminiAccounts(accountIds: string[]): Promise<string> {
  return await invoke("export_gemini_accounts", { accountIds });
}

export async function refreshGeminiToken(accountId: string): Promise<GeminiAccount> {
  return await invoke("refresh_gemini_token", { accountId });
}

export async function refreshAllGeminiTokens(): Promise<number> {
  return await invoke("refresh_all_gemini_tokens");
}

export async function addGeminiAccountWithToken(accessToken: string): Promise<GeminiAccount> {
  return await invoke("add_gemini_account_with_token", { accessToken });
}

export async function updateGeminiAccountTags(
  accountId: string,
  tags: string[]
): Promise<GeminiAccount> {
  return await invoke("update_gemini_account_tags", { accountId, tags });
}

export async function injectGeminiAccount(accountId: string): Promise<string> {
  return await invoke("switch_gemini_account", { accountId });
}

