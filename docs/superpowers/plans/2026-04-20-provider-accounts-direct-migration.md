# Provider Accounts Direct Migration Plan

## File Responsibilities

- `src/pages/platformAccounts/CodexAccountsPage.tsx`
  Codex parity account page adapted from `cockpit-tools-main`.
- `src/pages/platformAccounts/GeminiAccountsPage.tsx`
  Gemini parity account page adapted from `cockpit-tools-main`.
- `src/pages/platformAccounts/KiroAccountsPage.tsx`
  Kiro parity account page adapted from `cockpit-tools-main`.
- `src/pages/platformAccounts/PlatformAccountCenterPage.tsx`
  Legacy generic page retained only as fallback during migration.
- `src/services/codexService.ts`
  Codex account/OAuth service layer.
- `src/services/geminiService.ts`
  Gemini account/OAuth service layer.
- `src/services/kiroService.ts`
  Kiro account/OAuth service layer.
- `src/services/providerCurrentAccountService.ts`
  Current-account lookup for migrated stores.
- `src/stores/createProviderAccountStore.ts`
  Shared cockpit-style provider account store factory.
- `src/stores/useCodexAccountStore.ts`
  Codex store.
- `src/stores/useGeminiAccountStore.ts`
  Gemini store.
- `src/stores/useKiroAccountStore.ts`
  Kiro store.
- `src/types/platform.ts`
  Shared platform ID/types for migrated stores/services.
- `src/types/codex.ts`
  Codex parity types and helpers.
- `src/types/gemini.ts`
  Gemini parity types and helpers.
- `src/types/kiro.ts`
  Kiro parity types and helpers.
- `src/presentation/platformAccountPresentation.ts`
  Provider-specific account presentation helpers.
- `src/components/platform/PlatformOverviewTabsHeader.tsx`
  Shared top tabs for provider pages.
- `src/components/CodexOverviewTabsHeader.tsx`
  Codex tabs wrapper.
- `src/components/GeminiOverviewTabsHeader.tsx`
  Gemini tabs wrapper.
- `src/components/KiroOverviewTabsHeader.tsx`
  Kiro tabs wrapper.
- `src/components/ModalErrorMessage.tsx`
  Lightweight modal/form error helper.
- `src/components/PaginationControls.tsx`
  Shared pagination controls.
- `src-tauri/src/platform_accounts/mod.rs`
  Module entry and command exports.
- `src-tauri/src/platform_accounts/oauth_pending_state.rs`
  Pending OAuth persistence.
- `src-tauri/src/platform_accounts/codex_oauth.rs`
  Codex OAuth flow.
- `src-tauri/src/platform_accounts/gemini_oauth.rs`
  Gemini OAuth flow.
- `src-tauri/src/platform_accounts/kiro_oauth.rs`
  Kiro OAuth flow.

## Task 1: Add failing parity smoke coverage

- Files:
  - `src/smoke/providerAccountsParity.smoke.ts`
  - `src-tauri/src/platform_accounts/mod.rs`
- Failing test step:
  - Add a smoke module that imports the new service/store/type surface for `Codex`, `Gemini`, and `Kiro`.
  - Add Rust unit tests for pending OAuth state round-trip helpers.
- Verify failure:
  - `npm run build`
  - `cargo test platform_accounts`
- Expected failure:
  - Missing frontend modules and missing Rust OAuth helper modules.
- Minimal implementation:
  - Create the missing modules with the minimum exported shape to satisfy imports.
- Verify pass:
  - `npm run build`
  - `cargo test platform_accounts`
- Commit step:
  - `feat(platform-accounts): add parity smoke scaffolding`

## Task 2: Migrate shared frontend parity foundation

- Files:
  - `src/types/platform.ts`
  - `src/types/codex.ts`
  - `src/types/gemini.ts`
  - `src/types/kiro.ts`
  - `src/presentation/platformAccountPresentation.ts`
  - `src/services/providerCurrentAccountService.ts`
  - `src/stores/createProviderAccountStore.ts`
  - `src/components/platform/PlatformOverviewTabsHeader.tsx`
  - `src/components/CodexOverviewTabsHeader.tsx`
  - `src/components/GeminiOverviewTabsHeader.tsx`
  - `src/components/KiroOverviewTabsHeader.tsx`
  - `src/components/ModalErrorMessage.tsx`
  - `src/components/PaginationControls.tsx`
- Failing test step:
  - Expand the smoke file to use helper functions from each type/presentation module.
- Verify failure:
  - `npm run build`
- Expected failure:
  - Unimplemented helper functions or missing exports.
- Minimal implementation:
  - Migrate the shared type/helper/store foundation from `cockpit-tools-main`.
  - Remove or adapt i18n-only seams.
- Verify pass:
  - `npm run build`
- Commit step:
  - `feat(platform-accounts): migrate shared parity foundation`

## Task 3: Migrate provider services and stores

- Files:
  - `src/services/codexService.ts`
  - `src/services/geminiService.ts`
  - `src/services/kiroService.ts`
  - `src/stores/useCodexAccountStore.ts`
  - `src/stores/useGeminiAccountStore.ts`
  - `src/stores/useKiroAccountStore.ts`
- Failing test step:
  - Update smoke coverage to instantiate imported store creators and type-check service return shapes.
- Verify failure:
  - `npm run build`
- Expected failure:
  - Missing commands or incompatible return types.
- Minimal implementation:
  - Migrate cockpit service/store patterns and adapt command names to this repo.
- Verify pass:
  - `npm run build`
- Commit step:
  - `feat(platform-accounts): migrate provider services and stores`

## Task 4: Replace provider pages with cockpit-style page mode

- Files:
  - `src/pages/platformAccounts/CodexAccountsPage.tsx`
  - `src/pages/platformAccounts/GeminiAccountsPage.tsx`
  - `src/pages/platformAccounts/KiroAccountsPage.tsx`
  - `src/App.tsx`
- Failing test step:
  - Extend smoke coverage to import the page modules and assert the old generic page is no longer used by those entry files.
- Verify failure:
  - `npm run build`
- Expected failure:
  - Page imports unresolved or old wrappers still present.
- Minimal implementation:
  - Port the provider page mode from `cockpit-tools-main`.
  - Adapt missing UI dependencies to local equivalents.
- Verify pass:
  - `npm run build`
- Commit step:
  - `feat(platform-accounts): migrate codex gemini kiro account pages`

## Task 5: Replace placeholder OAuth backend with real provider modules

- Files:
  - `src-tauri/src/platform_accounts/mod.rs`
  - `src-tauri/src/platform_accounts/oauth_pending_state.rs`
  - `src-tauri/src/platform_accounts/codex_oauth.rs`
  - `src-tauri/src/platform_accounts/gemini_oauth.rs`
  - `src-tauri/src/platform_accounts/kiro_oauth.rs`
  - `src-tauri/src/main.rs`
  - `src-tauri/Cargo.toml`
- Failing test step:
  - Add Rust tests for pending-state persistence and callback URL parsing per provider.
- Verify failure:
  - `cargo test platform_accounts`
- Expected failure:
  - Placeholder implementation lacks provider modules and parsing logic.
- Minimal implementation:
  - Migrate the provider OAuth modules from `cockpit-tools-main`.
  - Wire commands into the current Tauri entrypoint.
  - Preserve current account record persistence and command names used by the frontend.
- Verify pass:
  - `cargo test platform_accounts`
  - `npm run build`
- Commit step:
  - `feat(platform-accounts): migrate real provider oauth flows`

## Task 6: Final verification and review

- Files:
  - Working tree review only.
- Verification steps:
  - `npm run build`
  - `cargo test platform_accounts`
  - `git diff --stat`
- Review step:
  - Perform a focused code review on the migration diff before completion.
- Commit step:
  - Only if explicitly requested.
