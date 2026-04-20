# Provider Accounts Direct Migration

## Goal

Directly migrate the `cockpit-tools-main` provider accounts mode for `Codex`, `Gemini`, and `Kiro` into `multi-cli-studio`, including:

- provider-specific account pages and page flow
- provider services and stores
- real OAuth browser launch and local callback handling
- richer account presentation modeled after `cockpit-tools-main`

## Scope

- Replace the current generic `PlatformAccountCenterPage` path for:
  - `src/pages/platformAccounts/CodexAccountsPage.tsx`
  - `src/pages/platformAccounts/GeminiAccountsPage.tsx`
  - `src/pages/platformAccounts/KiroAccountsPage.tsx`
- Introduce cockpit-style account services, stores, and provider presentation helpers.
- Replace placeholder OAuth flow in `src-tauri/src/platform_accounts/mod.rs` with real provider-specific OAuth modules and persisted pending state.
- Keep the current app shell, routing tree, and settings information architecture.

## Non-goals

- Full migration of tray/native menu/platform layout infrastructure.
- Full migration of all `cockpit-tools-main` utility pages outside `Codex/Gemini/Kiro` accounts.
- Full i18n system migration.
- Full modal system parity where current app can use simpler local UI.

## Constraints

- Current project does not have the `cockpit-tools-main` i18n/runtime plugin stack.
- Current project already has a platform center shell and model provider configuration path that must remain intact.
- Existing user data in local account indexes must remain readable.

## Decisions

1. Keep current route structure under `/settings/model-providers`.
2. Migrate cockpit page mode and data flow, but adapt UI dependencies to local equivalents where direct imports would pull in unrelated infrastructure.
3. Split backend OAuth into provider-specific modules under `src-tauri/src/platform_accounts/`.
4. Preserve the current generic platform account record format as the persisted storage format where practical, and enrich it with real OAuth/account fields.
5. Prefer direct source migration from `cockpit-tools-main` for logic-heavy code, and adapt only integration seams.

## Risks

- Frontend parity pages depend on a wide utility surface in the source repo.
- OAuth implementations differ materially across providers, so backend integration risk is higher than the page migration risk.
- Current monolithic `src-tauri/src/main.rs` command registration can make module wiring noisy.

## Success Criteria

- Clicking OAuth login for `Codex`, `Gemini`, or `Kiro` opens the default browser and can complete via local callback without manual paste in the normal path.
- The three provider pages no longer render through the old generic page component.
- Account cards show provider-specific data closer to `cockpit-tools-main` than the current generic cards.
- `npm run build` and `cargo test` pass for the migrated areas.
