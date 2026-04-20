import { create } from "zustand";
import {
  PLATFORM_META,
  addManualPlatformAccount,
  addPlatformInstance,
  cancelPlatformOAuth,
  completePlatformOAuth,
  deletePlatformAccounts,
  deletePlatformInstance,
  exportPlatformAccounts,
  fetchPlatformAccounts,
  importPlatformAccountsFromJson,
  importPlatformAccountsFromLocal,
  refreshAllPlatformAccounts,
  refreshPlatformAccount,
  setCurrentPlatformAccount,
  startPlatformOAuth,
  submitPlatformOAuthCallback,
  updatePlatformAccountTags,
  updatePlatformFeatureState,
  updatePlatformInstance,
  type PlatformAuthMode,
  type PlatformCenterState,
  type PlatformId,
  type PlatformInstance,
  type PlatformManualAccountInput,
  type PlatformOAuthStart,
} from "../lib/platformAccounts";

export interface PlatformAccountStoreState {
  platform: PlatformId;
  state: PlatformCenterState | null;
  loading: boolean;
  message: string | null;
  error: string | null;
  oauthState: PlatformOAuthStart | null;
  exportText: string;
  load: () => Promise<boolean>;
  startOAuth: () => Promise<boolean>;
  completeOAuth: () => Promise<boolean>;
  cancelOAuth: () => Promise<boolean>;
  submitOAuthCallback: (callbackUrl: string) => Promise<boolean>;
  addManualAccount: (
    authMode: PlatformAuthMode,
    input: PlatformManualAccountInput
  ) => Promise<boolean>;
  importJson: (jsonContent: string) => Promise<boolean>;
  importLocal: () => Promise<boolean>;
  exportAccounts: (accountIds?: string[]) => Promise<boolean>;
  refreshAllAccounts: () => Promise<boolean>;
  refreshAccount: (accountId: string) => Promise<boolean>;
  setCurrentAccount: (accountId: string) => Promise<boolean>;
  deleteAccounts: (accountIds: string[]) => Promise<boolean>;
  saveTags: (accountId: string, tags: string[]) => Promise<boolean>;
  updateFeatureState: (updates: Record<string, string | number | boolean>) => void;
  addInstance: (input: {
    name: string;
    accountId?: string | null;
    command?: string;
  }) => void;
  updateInstance: (instanceId: string, updates: Partial<PlatformInstance>) => void;
  deleteInstance: (instanceId: string) => void;
  setExportText: (value: string) => void;
  setMessage: (value: string | null) => void;
  clearFeedback: () => void;
}

function createPlatformAccountStore(platform: PlatformId) {
  const label = PLATFORM_META[platform].label;

  return create<PlatformAccountStoreState>((set, get) => {
    function fail(error: unknown, fallback: string) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : fallback,
        message: null,
      });
      return false;
    }

    function applyState(next: PlatformCenterState, message?: string) {
      set({
        state: next,
        loading: false,
        error: null,
        message: message ?? null,
      });
    }

    return {
      platform,
      state: null,
      loading: false,
      message: null,
      error: null,
      oauthState: null,
      exportText: "",
      async load() {
        set({ loading: true });
        try {
          const next = await fetchPlatformAccounts(platform);
          set({
            state: next,
            loading: false,
            error: null,
          });
          return true;
        } catch (error) {
          return fail(error, `加载 ${label} 账号失败。`);
        }
      },
      async startOAuth() {
        try {
          const next = await startPlatformOAuth(platform);
          set({
            oauthState: next,
            message: `${label} OAuth 已准备，可以在浏览器完成授权。`,
            error: null,
          });
          return true;
        } catch (error) {
          return fail(error, "OAuth 启动失败。");
        }
      },
      async completeOAuth() {
        const loginId = get().oauthState?.loginId;
        if (!loginId) return false;
        try {
          const next = await completePlatformOAuth(platform, loginId);
          set({
            state: next,
            oauthState: null,
            message: "OAuth 登录完成，账号已写入当前平台中心。",
            error: null,
          });
          return true;
        } catch (error) {
          return fail(error, "OAuth 完成失败。");
        }
      },
      async cancelOAuth() {
        try {
          await cancelPlatformOAuth(platform, get().oauthState?.loginId ?? null);
          set({
            oauthState: null,
            message: "OAuth 流程已取消。",
            error: null,
          });
          return true;
        } catch (error) {
          return fail(error, "取消 OAuth 失败。");
        }
      },
      async submitOAuthCallback(callbackUrl) {
        const loginId = get().oauthState?.loginId;
        if (!loginId || !callbackUrl.trim()) return false;
        try {
          await submitPlatformOAuthCallback(platform, loginId, callbackUrl.trim());
          set({
            message: "已提交回调链接，现在可以继续完成登录。",
            error: null,
          });
          return true;
        } catch (error) {
          return fail(error, "提交回调链接失败。");
        }
      },
      async addManualAccount(authMode, input) {
        try {
          const next = await addManualPlatformAccount(platform, authMode, input);
          applyState(next, `${label} 账号已添加。`);
          return true;
        } catch (error) {
          return fail(error, "添加账号失败。");
        }
      },
      async importJson(jsonContent) {
        try {
          const next = await importPlatformAccountsFromJson(platform, jsonContent);
          applyState(next, `${label} 账号已从 JSON 导入。`);
          return true;
        } catch (error) {
          return fail(error, "导入 JSON 失败。");
        }
      },
      async importLocal() {
        try {
          const next = await importPlatformAccountsFromLocal(platform);
          applyState(next, "本地客户端账号已同步。");
          return true;
        } catch (error) {
          return fail(error, "本地导入失败。");
        }
      },
      async exportAccounts(accountIds) {
        try {
          const content = await exportPlatformAccounts(platform, accountIds);
          set({
            exportText: content,
            message: "已生成导出 JSON，可以复制或下载。",
            error: null,
          });
          return true;
        } catch (error) {
          return fail(error, "导出失败。");
        }
      },
      async refreshAllAccounts() {
        try {
          const next = await refreshAllPlatformAccounts(platform);
          applyState(next, "全部账号已刷新。");
          return true;
        } catch (error) {
          return fail(error, "刷新全部账号失败。");
        }
      },
      async refreshAccount(accountId) {
        try {
          const next = await refreshPlatformAccount(platform, accountId);
          applyState(next, "账号状态已刷新。");
          return true;
        } catch (error) {
          return fail(error, "刷新账号失败。");
        }
      },
      async setCurrentAccount(accountId) {
        try {
          const next = await setCurrentPlatformAccount(platform, accountId);
          applyState(next, "当前账号已切换。");
          return true;
        } catch (error) {
          return fail(error, "切换账号失败。");
        }
      },
      async deleteAccounts(accountIds) {
        try {
          const next = await deletePlatformAccounts(platform, accountIds);
          applyState(next, accountIds.length > 1 ? "账号已批量删除。" : "账号已删除。");
          return true;
        } catch (error) {
          return fail(error, "删除账号失败。");
        }
      },
      async saveTags(accountId, tags) {
        try {
          const next = await updatePlatformAccountTags(platform, accountId, tags);
          applyState(next, "标签已更新。");
          return true;
        } catch (error) {
          return fail(error, "更新标签失败。");
        }
      },
      updateFeatureState(updates) {
        const next = updatePlatformFeatureState(platform, updates);
        set({
          state: next,
          error: null,
        });
      },
      addInstance(input) {
        const next = addPlatformInstance(platform, input);
        set({
          state: next,
          message: "实例已添加。",
          error: null,
        });
      },
      updateInstance(instanceId, updates) {
        const next = updatePlatformInstance(platform, instanceId, updates);
        set({
          state: next,
          message: "实例已更新。",
          error: null,
        });
      },
      deleteInstance(instanceId) {
        const next = deletePlatformInstance(platform, instanceId);
        set({
          state: next,
          message: "实例已删除。",
          error: null,
        });
      },
      setExportText(value) {
        set({ exportText: value });
      },
      setMessage(value) {
        set({
          message: value,
          error: null,
        });
      },
      clearFeedback() {
        set({ message: null, error: null });
      },
    };
  });
}

export const useCodexAccountStore = createPlatformAccountStore("codex");
export const useGeminiAccountStore = createPlatformAccountStore("gemini");
export const useKiroAccountStore = createPlatformAccountStore("kiro");
