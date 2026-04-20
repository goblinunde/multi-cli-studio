import { create } from "zustand";
import type { PlatformId } from "../types/platform";

type ProviderUsage = {
  inlineSuggestionsUsedPercent: number | null;
  chatMessagesUsedPercent: number | null;
  allowanceResetAt?: number | null;
  remainingCompletions?: number | null;
  remainingChat?: number | null;
  totalCompletions?: number | null;
  totalChat?: number | null;
};

type ProviderAccountAugmentation = {
  id: string;
  email?: string | null;
  plan_type?: string | null;
  quota?: unknown;
};

type ProviderService<TAccount> = {
  listAccounts: () => Promise<TAccount[]>;
  deleteAccount: (accountId: string) => Promise<void>;
  deleteAccounts: (accountIds: string[]) => Promise<void>;
  injectAccount?: (accountId: string) => Promise<unknown>;
  refreshToken: (accountId: string) => Promise<unknown>;
  refreshAllTokens: () => Promise<unknown>;
  importFromJson: (jsonContent: string) => Promise<TAccount[]>;
  exportAccounts: (accountIds: string[]) => Promise<string>;
  updateAccountTags: (accountId: string, tags: string[]) => Promise<TAccount>;
};

type ProviderMapper<TAccount> = {
  getDisplayEmail: (account: TAccount) => string;
  getPlanBadge: (account: TAccount) => string;
  getUsage: (account: TAccount) => ProviderUsage;
};

type ProviderStoreOptions = {
  platformId: PlatformId;
  currentAccountIdKey?: string;
  resolveCurrentAccountId?: () => Promise<string | null>;
};

export interface ProviderAccountStoreState<TAccount> {
  accounts: TAccount[];
  currentAccountId: string | null;
  loading: boolean;
  error: string | null;
  fetchCurrentAccountId: () => Promise<string | null>;
  setCurrentAccountId: (accountId: string | null) => void;
  fetchAccounts: () => Promise<void>;
  switchAccount: (accountId: string) => Promise<void>;
  deleteAccounts: (accountIds: string[]) => Promise<void>;
  refreshToken: (accountId: string) => Promise<void>;
  refreshAllTokens: () => Promise<void>;
  importFromJson: (jsonContent: string) => Promise<TAccount[]>;
  exportAccounts: (accountIds: string[]) => Promise<string>;
  updateAccountTags: (accountId: string, tags: string[]) => Promise<TAccount>;
}

export function createProviderAccountStore<TAccount extends ProviderAccountAugmentation>(
  cacheKey: string,
  service: ProviderService<TAccount>,
  mapper: ProviderMapper<TAccount>,
  options: ProviderStoreOptions
) {
  const currentAccountIdKey = options.currentAccountIdKey ?? null;

  const loadCachedAccounts = (): TAccount[] => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as TAccount[]) : [];
    } catch {
      return [];
    }
  };

  const persistAccountsCache = (accounts: TAccount[]) => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(accounts));
    } catch {
      // ignore
    }
  };

  const loadCurrentAccountId = (): string | null => {
    if (!currentAccountIdKey) return null;
    try {
      const raw = localStorage.getItem(currentAccountIdKey);
      const value = raw?.trim();
      return value ? value : null;
    } catch {
      return null;
    }
  };

  const persistCurrentAccountId = (accountId: string | null) => {
    if (!currentAccountIdKey) return;
    try {
      if (accountId) {
        localStorage.setItem(currentAccountIdKey, accountId);
      } else {
        localStorage.removeItem(currentAccountIdKey);
      }
    } catch {
      // ignore
    }
  };

  const normalizeCurrentAccountId = (
    accountId: string | null | undefined,
    accounts: TAccount[]
  ): string | null => {
    const value = accountId?.trim();
    if (!value) return null;
    if (accounts.length === 0) return value;
    return accounts.some((account) => account.id === value) ? value : null;
  };

  const mapAccountsForUnifiedView = (accounts: TAccount[]): TAccount[] => {
    return accounts.map((account) => {
      const usage = mapper.getUsage(account);
      const hourlyPct =
        usage.inlineSuggestionsUsedPercent ?? usage.chatMessagesUsedPercent;
      const weeklyPct =
        usage.chatMessagesUsedPercent ?? usage.inlineSuggestionsUsedPercent;
      const quota =
        hourlyPct == null && weeklyPct == null
          ? undefined
          : {
              hourly_percentage: hourlyPct ?? 0,
              weekly_percentage: weeklyPct ?? 0,
              hourly_reset_time: usage.allowanceResetAt ?? null,
              weekly_reset_time: usage.allowanceResetAt ?? null,
              raw_data: {
                remainingCompletions: usage.remainingCompletions,
                remainingChat: usage.remainingChat,
                totalCompletions: usage.totalCompletions,
                totalChat: usage.totalChat,
              },
            };

      return {
        ...account,
        email: mapper.getDisplayEmail(account),
        plan_type: mapper.getPlanBadge(account),
        quota,
      };
    });
  };

  return create<ProviderAccountStoreState<TAccount>>((set, get) => ({
    accounts: loadCachedAccounts(),
    currentAccountId: loadCurrentAccountId(),
    loading: false,
    error: null,

    fetchCurrentAccountId: async () => {
      const accounts = get().accounts;
      if (accounts.length === 0) {
        set({ currentAccountId: null });
        persistCurrentAccountId(null);
        return null;
      }

      try {
        const resolvedAccountId = options.resolveCurrentAccountId
          ? await options.resolveCurrentAccountId()
          : get().currentAccountId;
        const currentAccountId = normalizeCurrentAccountId(resolvedAccountId, accounts);
        set({ currentAccountId });
        persistCurrentAccountId(currentAccountId);
        return currentAccountId;
      } catch {
        const currentAccountId = normalizeCurrentAccountId(get().currentAccountId, accounts);
        set({ currentAccountId });
        persistCurrentAccountId(currentAccountId);
        return currentAccountId;
      }
    },

    setCurrentAccountId: (accountId: string | null) => {
      const currentAccountId = normalizeCurrentAccountId(accountId, get().accounts);
      set({ currentAccountId });
      persistCurrentAccountId(currentAccountId);
    },

    fetchAccounts: async () => {
      set({ loading: true, error: null });
      try {
        const accounts = await service.listAccounts();
        const mapped = mapAccountsForUnifiedView(accounts);
        set({ accounts: mapped, loading: false });
        persistAccountsCache(mapped);
        await get().fetchCurrentAccountId();
      } catch (error) {
        set({ error: String(error), loading: false });
      }
    },

    switchAccount: async (accountId: string) => {
      if (service.injectAccount) {
        await service.injectAccount(accountId);
      }
      get().setCurrentAccountId(accountId);
      await get().fetchAccounts();
    },

    deleteAccounts: async (accountIds: string[]) => {
      if (accountIds.length === 0) return;
      if (accountIds.length === 1) {
        await service.deleteAccount(accountIds[0]);
      } else {
        await service.deleteAccounts(accountIds);
      }
      await get().fetchAccounts();
    },

    refreshToken: async (accountId: string) => {
      await service.refreshToken(accountId);
      await get().fetchAccounts();
    },

    refreshAllTokens: async () => {
      await service.refreshAllTokens();
      await get().fetchAccounts();
    },

    importFromJson: async (jsonContent: string) => {
      const imported = await service.importFromJson(jsonContent);
      await get().fetchAccounts();
      return imported;
    },

    exportAccounts: async (accountIds: string[]) => service.exportAccounts(accountIds),

    updateAccountTags: async (accountId: string, tags: string[]) => {
      const updated = await service.updateAccountTags(accountId, tags);
      await get().fetchAccounts();
      return updated;
    },
  }));
}

