import type { ModelProviderServiceType } from "./models";

export type PlatformAccountService = "codex" | "gemini" | "kiro";

export const PLATFORM_CENTER_BASE_PATH = "/settings/model-providers";
export const PLATFORM_CENTER_API_PATH = `${PLATFORM_CENTER_BASE_PATH}/api`;

export function buildPlatformAccountPath(service: PlatformAccountService) {
  return `${PLATFORM_CENTER_BASE_PATH}/accounts/${service}`;
}

export function buildApiProviderEditorPath(
  serviceType: ModelProviderServiceType,
  providerId: string
) {
  return `${PLATFORM_CENTER_API_PATH}/${serviceType}/${encodeURIComponent(providerId)}`;
}

