import { invoke } from "@tauri-apps/api/core";
import type { PlatformId } from "../types/platform";

export type ProviderCurrentPlatform = PlatformId;

export async function getProviderCurrentAccountId(
  platform: ProviderCurrentPlatform
): Promise<string | null> {
  try {
    return await invoke<string | null>("get_provider_current_account_id", { platform });
  } catch {
    return null;
  }
}

