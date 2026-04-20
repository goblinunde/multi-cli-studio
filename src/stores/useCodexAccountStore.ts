import { create } from "zustand";
import type { CodexAccount } from "../types/codex";
import type { ProviderAccountStoreState } from "./createProviderAccountStore";
import * as codexService from "../services/codexService";

interface CodexAccountState extends ProviderAccountStoreState<CodexAccount> {
  currentAccount: CodexAccount | null;
  fetchCurrentAccount: () => Promise<void>;
}

const CODEX_ACCOUNTS_CACHE_KEY = "multi-cli-studio.codex.accounts.cache";
const CODEX_CURRENT_ACCOUNT_CACHE_KEY = "multi-cli-studio.codex.accounts.current";

function loadCachedCodexAccounts() {
  try {
    const raw = localStorage.getItem(CODEX_ACCOUNTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CodexAccount[]) : [];
  } catch {
    return [];
  }
}

function loadCachedCurrentAccount() {
  try {
    const raw = localStorage.getItem(CODEX_CURRENT_ACCOUNT_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CodexAccount;
  } catch {
    return null;
  }
}

function persistCodexAccounts(accounts: CodexAccount[]) {
  try {
    localStorage.setItem(CODEX_ACCOUNTS_CACHE_KEY, JSON.stringify(accounts));
  } catch {
    // ignore
  }
}

function persistCurrentAccount(account: CodexAccount | null) {
  try {
    if (!account) {
      localStorage.removeItem(CODEX_CURRENT_ACCOUNT_CACHE_KEY);
      return;
    }
    localStorage.setItem(CODEX_CURRENT_ACCOUNT_CACHE_KEY, JSON.stringify(account));
  } catch {
    // ignore
  }
}

export const useCodexAccountStore = create<CodexAccountState>((set, get) => ({
  accounts: loadCachedCodexAccounts(),
  currentAccountId: loadCachedCurrentAccount()?.id ?? null,
  currentAccount: loadCachedCurrentAccount(),
  loading: false,
  error: null,

  fetchCurrentAccountId: async () => get().currentAccount?.id ?? null,

  setCurrentAccountId: (accountId: string | null) => set({ currentAccountId: accountId }),

  fetchAccounts: async () => {
    set({ loading: true, error: null });
    try {
      const accounts = await codexService.listCodexAccounts();
      set({ accounts, loading: false });
      persistCodexAccounts(accounts);
      await get().fetchCurrentAccount();
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  fetchCurrentAccount: async () => {
    try {
      const currentAccount = await codexService.getCurrentCodexAccount();
      set({ currentAccount, currentAccountId: currentAccount?.id ?? null });
      persistCurrentAccount(currentAccount);
    } catch {
      set({ currentAccount: null, currentAccountId: null });
      persistCurrentAccount(null);
    }
  },

  switchAccount: async (accountId: string) => {
    const currentAccount = await codexService.switchCodexAccount(accountId);
    set({ currentAccount, currentAccountId: currentAccount.id });
    persistCurrentAccount(currentAccount);
    await get().fetchAccounts();
  },

  deleteAccounts: async (accountIds: string[]) => {
    if (accountIds.length === 0) return;
    if (accountIds.length === 1) {
      await codexService.deleteCodexAccount(accountIds[0]);
    } else {
      await codexService.deleteCodexAccounts(accountIds);
    }
    await get().fetchAccounts();
  },

  refreshToken: async (accountId: string) => {
    await codexService.refreshCodexAccountProfile(accountId);
    await get().fetchAccounts();
  },

  refreshAllTokens: async () => {
    await codexService.refreshAllCodexQuotas();
    await get().fetchAccounts();
  },

  importFromJson: async (jsonContent: string) => {
    const imported = await codexService.importCodexFromJson(jsonContent);
    await get().fetchAccounts();
    return imported;
  },

  exportAccounts: async (accountIds: string[]) => codexService.exportCodexAccounts(accountIds),

  updateAccountTags: async (accountId: string, tags: string[]) => {
    const updated = await codexService.updateCodexAccountTags(accountId, tags);
    await get().fetchAccounts();
    return updated;
  },
}));

