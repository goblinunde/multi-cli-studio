import { invoke } from "@tauri-apps/api/core";
import type { CodexAccount, CodexApiProviderMode } from "../types/codex";

export interface CodexOAuthLoginStartResponse {
  loginId: string;
  authUrl: string;
  callbackUrl?: string | null;
}

export async function listCodexAccounts(): Promise<CodexAccount[]> {
  return await invoke("list_codex_accounts");
}

export async function getCurrentCodexAccount(): Promise<CodexAccount | null> {
  return await invoke("get_current_codex_account");
}

export async function refreshCodexAccountProfile(accountId: string): Promise<CodexAccount> {
  return await invoke("refresh_codex_account_profile", { accountId });
}

export async function switchCodexAccount(accountId: string): Promise<CodexAccount> {
  return await invoke("switch_codex_account", { accountId });
}

export async function deleteCodexAccount(accountId: string): Promise<void> {
  return await invoke("delete_codex_account", { accountId });
}

export async function deleteCodexAccounts(accountIds: string[]): Promise<void> {
  return await invoke("delete_codex_accounts", { accountIds });
}

export async function importCodexFromLocal(): Promise<CodexAccount[]> {
  return await invoke("import_codex_from_local");
}

export async function importCodexFromJson(jsonContent: string): Promise<CodexAccount[]> {
  return await invoke("import_codex_from_json", { jsonContent });
}

export async function exportCodexAccounts(accountIds: string[]): Promise<string> {
  return await invoke("export_codex_accounts", { accountIds });
}

export async function refreshAllCodexQuotas(): Promise<number> {
  return await invoke("refresh_all_codex_quotas");
}

export async function startCodexOAuthLogin(): Promise<CodexOAuthLoginStartResponse> {
  return await invoke("codex_oauth_login_start");
}

export async function completeCodexOAuthLogin(loginId: string): Promise<CodexAccount> {
  return await invoke("codex_oauth_login_completed", { loginId });
}

export async function cancelCodexOAuthLogin(loginId?: string): Promise<void> {
  return await invoke("codex_oauth_login_cancel", { loginId: loginId ?? null });
}

export async function submitCodexOAuthCallbackUrl(
  loginId: string,
  callbackUrl: string
): Promise<void> {
  return await invoke("codex_oauth_submit_callback_url", { loginId, callbackUrl });
}

export async function addCodexAccountWithToken(
  idToken: string,
  accessToken: string,
  refreshToken?: string
): Promise<CodexAccount> {
  return await invoke("add_codex_account_with_token", {
    idToken,
    accessToken,
    refreshToken: refreshToken ?? null,
  });
}

export async function addCodexAccountWithApiKey(
  apiKey: string,
  apiBaseUrl?: string,
  apiProviderMode?: CodexApiProviderMode,
  apiProviderId?: string,
  apiProviderName?: string
): Promise<CodexAccount> {
  return await invoke("add_codex_account_with_api_key", {
    apiKey,
    apiBaseUrl: apiBaseUrl ?? null,
    apiProviderMode: apiProviderMode ?? null,
    apiProviderId: apiProviderId ?? null,
    apiProviderName: apiProviderName ?? null,
  });
}

export async function updateCodexApiKeyCredentials(
  accountId: string,
  apiKey: string,
  apiBaseUrl?: string,
  apiProviderMode?: CodexApiProviderMode,
  apiProviderId?: string,
  apiProviderName?: string
): Promise<CodexAccount> {
  return await invoke("update_codex_api_key_credentials", {
    accountId,
    apiKey,
    apiBaseUrl: apiBaseUrl ?? null,
    apiProviderMode: apiProviderMode ?? null,
    apiProviderId: apiProviderId ?? null,
    apiProviderName: apiProviderName ?? null,
  });
}

export async function updateCodexAccountTags(
  accountId: string,
  tags: string[]
): Promise<CodexAccount> {
  return await invoke("update_codex_account_tags", { accountId, tags });
}

