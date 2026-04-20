# cockpit-tools-main 平台中心功能对等迁移计划

日期：2026-04-19

## 范围定义

本计划替代 `docs/superpowers/plans/2026-04-19-platform-center-migration.md` 的“第一阶段”目标，升级为 `cockpit-tools-main` 中 `Codex / Gemini / Kiro` 三个平台的功能对等迁移。

“功能对等”在本仓库中的含义：

- 前端页面能力对等：账户页、实例页、平台 tabs、配额/credits 展示、快速切换、导入导出、标签/分组、Local Access、Wakeup、Session Manager、Provider Manager、Launch/Injection。
- 前端状态流对等：页面 store、平台 service、provider current、layout/tray 相关状态源。
- 后端命令对等：账号、实例、OAuth、quota/credits、provider current、group、data transfer、local access、wakeup、session visibility/session manager、tray/native menu。
- 当前项目适配约束不变：
  - `ModelChatPage` 仍只消费 API Providers。
  - Kiro 不接入 `ModelChatPage`。
  - UI 仍挂在当前 `/settings/model-providers` 信息架构下。

## 现状结论

- 当前仓库只完成了统一平台中心骨架、简化账户页、最小 OAuth/导入导出/实例本地状态。
- 当前仓库未迁入上游的：
  - Codex `quickSwitch`、`quota_error`、`CodexModelProviderManager`、`CodexLocalAccessModal`、`CodexSessionManager`、`CodexWakeupContent`
  - Gemini/Kiro 对等实例页与平台专用内容
  - `provider_current_state`
  - `tray` / `tray_layout` / `macos_native_menu`
  - `run_quota_alert_if_needed`
  - 真实 OAuth server / pending state / callback 流

## 文件职责

### 当前仓库目标文件

- `src/App.tsx`
  统一平台中心总路由，挂载账户页与实例页对等入口。
- `src/pages/PlatformCenterPage.tsx`
  统一平台中心顶层导航，承载 API Providers、Codex、Gemini、Kiro 一级入口。
- `src/pages/platformAccounts/CodexAccountsPage.tsx`
  替换当前通用壳子，适配上游 Codex 完整账户页。
- `src/pages/platformAccounts/GeminiAccountsPage.tsx`
  适配上游 Gemini 完整账户页。
- `src/pages/platformAccounts/KiroAccountsPage.tsx`
  适配上游 Kiro 完整账户页。
- `src/pages/platformAccounts/CodexInstancesPage.tsx`
  新增 Codex 实例页。
- `src/pages/platformAccounts/GeminiInstancesPage.tsx`
  新增 Gemini 实例页。
- `src/pages/platformAccounts/KiroInstancesPage.tsx`
  新增 Kiro 实例页。
- `src/platformAccounts/stores.ts`
  迁移为平台 store 汇总入口，避免继续保留当前简化 zustand shape。
- `src/lib/platformAccounts.ts`
  逐步退役当前简化类型/本地存储兜底逻辑，替换为真实类型和 service glue。
- `src/lib/platformCenterRoutes.ts`
  补齐账户页、实例页、子功能页路由构造。
- `src/components/platform/*`
  迁入通用平台 tabs、instances content、quota/usage status 组件。
- `src/components/codex/*`
  迁入 Codex 专属组件。
- `src/services/platform/*`
  承接通用实例 service factory。
- `src/services/codex*.ts`
  Codex 账户、实例、local access、wakeup、provider manager service。
- `src/services/gemini*.ts`
  Gemini 账户、实例、launch/injection service。
- `src/services/kiro*.ts`
  Kiro 账户、实例、injection service。
- `src/services/providerCurrentAccountService.ts`
  当前账户快速切换与 tray 联动接口。
- `src/stores/useCodexAccountStore.ts`
  Codex 完整账户 store。
- `src/stores/useCodexInstanceStore.ts`
  Codex 实例 store。
- `src/stores/useCodexWakeupStore.ts`
  Codex wakeup store。
- `src/stores/useGeminiAccountStore.ts`
  Gemini 账户 store。
- `src/stores/useGeminiInstanceStore.ts`
  Gemini 实例 store。
- `src/stores/useKiroAccountStore.ts`
  Kiro 账户 store。
- `src/stores/useKiroInstanceStore.ts`
  Kiro 实例 store。
- `src/stores/usePlatformLayoutStore.ts`
  tray 布局与平台排序状态。
- `src/presentation/platformAccountPresentation.ts`
  账户显示、plan/quota/credits 展示规则。
- `src/utils/platformMeta.tsx`
  平台图标和 tabs 元数据。
- `src/types/platform.ts`
  通用平台类型。
- `src/types/codex.ts`
  Codex 类型，必须包含 `quota_error`、quick switch/provider manager/local access 相关结构。
- `src/types/gemini.ts`
  Gemini 类型。
- `src/types/kiro.ts`
  Kiro 类型。
- `src/styles/settings-desktop.css`
  统一外壳下的布局适配。
- `src/styles/globals.css`
  对等组件的全局样式入口。

### Tauri 目标文件

- `src-tauri/Cargo.toml`
  新增完整迁移所需依赖与 Tauri feature。
- `src-tauri/src/main.rs`
  清理当前最小注册方式，改为模块化命令注册。
- `src-tauri/src/platform_accounts/mod.rs`
  删除当前简化实现，改为模块入口。
- `src-tauri/src/platform_accounts/codex_account.rs`
  Codex 账户存储、切换、导入导出、quota error 维护。
- `src-tauri/src/platform_accounts/codex_instance.rs`
  Codex 实例。
- `src-tauri/src/platform_accounts/codex_local_access.rs`
  Codex 本地访问。
- `src-tauri/src/platform_accounts/codex_oauth.rs`
  Codex OAuth。
- `src-tauri/src/platform_accounts/codex_quota.rs`
  Codex quota/`quota_error`。
- `src-tauri/src/platform_accounts/codex_session_manager.rs`
  Codex 会话管理。
- `src-tauri/src/platform_accounts/codex_session_visibility.rs`
  Codex session visibility 修复。
- `src-tauri/src/platform_accounts/codex_wakeup.rs`
  Codex wakeup runtime/state。
- `src-tauri/src/platform_accounts/codex_wakeup_scheduler.rs`
  Codex wakeup scheduler。
- `src-tauri/src/platform_accounts/gemini_account.rs`
  Gemini 账户。
- `src-tauri/src/platform_accounts/gemini_instance.rs`
  Gemini 实例。
- `src-tauri/src/platform_accounts/gemini_oauth.rs`
  Gemini OAuth。
- `src-tauri/src/platform_accounts/kiro_account.rs`
  Kiro 账户。
- `src-tauri/src/platform_accounts/kiro_instance.rs`
  Kiro 实例。
- `src-tauri/src/platform_accounts/kiro_oauth.rs`
  Kiro OAuth。
- `src-tauri/src/platform_accounts/oauth.rs`
  通用 OAuth helper。
- `src-tauri/src/platform_accounts/oauth_server.rs`
  本地 OAuth callback server。
- `src-tauri/src/platform_accounts/oauth_pending_state.rs`
  OAuth pending state 持久化。
- `src-tauri/src/platform_accounts/provider_current_state.rs`
  平台当前账号状态。
- `src-tauri/src/platform_accounts/group_settings.rs`
  分组设置。
- `src-tauri/src/platform_accounts/tray.rs`
  tray menu 更新。
- `src-tauri/src/platform_accounts/tray_layout.rs`
  tray 平台布局。
- `src-tauri/src/platform_accounts/macos_native_menu.rs`
  macOS 原生菜单桥接。
- `src-tauri/src/platform_accounts/data_transfer.rs`
  导入导出。

### 上游来源文件

- `cockpit-tools-main/src/pages/CodexAccountsPage.tsx`
- `cockpit-tools-main/src/pages/GeminiAccountsPage.tsx`
- `cockpit-tools-main/src/pages/KiroAccountsPage.tsx`
- `cockpit-tools-main/src/pages/GeminiInstancesPage.tsx`
- `cockpit-tools-main/src/pages/KiroInstancesPage.tsx`
- `cockpit-tools-main/src/components/codex/CodexModelProviderManager.tsx`
- `cockpit-tools-main/src/components/codex/CodexQuickConfigCard.tsx`
- `cockpit-tools-main/src/components/codex/CodexSessionManager.tsx`
- `cockpit-tools-main/src/components/codex/CodexWakeupContent.tsx`
- `cockpit-tools-main/src/components/platform/PlatformInstancesContent.tsx`
- `cockpit-tools-main/src/components/platform/PlatformOverviewTabsHeader.tsx`
- `cockpit-tools-main/src/services/codexService.ts`
- `cockpit-tools-main/src/services/codexInstanceService.ts`
- `cockpit-tools-main/src/services/codexLocalAccessService.ts`
- `cockpit-tools-main/src/services/codexModelProviderService.ts`
- `cockpit-tools-main/src/services/codexWakeupService.ts`
- `cockpit-tools-main/src/services/geminiService.ts`
- `cockpit-tools-main/src/services/geminiInstanceService.ts`
- `cockpit-tools-main/src/services/kiroService.ts`
- `cockpit-tools-main/src/services/kiroInstanceService.ts`
- `cockpit-tools-main/src/services/providerCurrentAccountService.ts`
- `cockpit-tools-main/src/stores/useCodexAccountStore.ts`
- `cockpit-tools-main/src/stores/useCodexInstanceStore.ts`
- `cockpit-tools-main/src/stores/useCodexWakeupStore.ts`
- `cockpit-tools-main/src/stores/useGeminiAccountStore.ts`
- `cockpit-tools-main/src/stores/useGeminiInstanceStore.ts`
- `cockpit-tools-main/src/stores/useKiroAccountStore.ts`
- `cockpit-tools-main/src/stores/useKiroInstanceStore.ts`
- `cockpit-tools-main/src/stores/usePlatformLayoutStore.ts`
- `cockpit-tools-main/src-tauri/src/commands/codex.rs`
- `cockpit-tools-main/src-tauri/src/commands/codex_instance.rs`
- `cockpit-tools-main/src-tauri/src/commands/gemini.rs`
- `cockpit-tools-main/src-tauri/src/commands/gemini_instance.rs`
- `cockpit-tools-main/src-tauri/src/commands/kiro.rs`
- `cockpit-tools-main/src-tauri/src/commands/kiro_instance.rs`
- `cockpit-tools-main/src-tauri/src/commands/provider_current.rs`
- `cockpit-tools-main/src-tauri/src/commands/system.rs`
- `cockpit-tools-main/src-tauri/src/modules/*`

## 迁移原则

- 不回退用户已有未提交改动。
- 不继续扩展当前简化 `src/lib/platformAccounts.ts` 假实现，逐步替换为真实 service/store/command。
- 先完成 Codex 对等能力，再复用通用件推进 Gemini/Kiro。
- 每个任务都要求：
  - 先写失败验证。
  - 明确最小实现。
  - 跑通过验证。
  - 单独提交点。

## 任务 1：建立对等前端骨架与真实类型入口

- 文件：
  - `src/types/platform.ts`
  - `src/types/codex.ts`
  - `src/types/gemini.ts`
  - `src/types/kiro.ts`
  - `src/utils/platformMeta.tsx`
  - `src/presentation/platformAccountPresentation.ts`
  - `src/lib/platformAccounts.ts`
  - `src/platformAccounts/stores.ts`
- 失败测试：
  - 新增类型 smoke test，验证 `quota_error`、quick switch provider、platform tabs 所需字段存在。
  - 命令：
    - `rg -n "quota_error|quickSwitch|PlatformOverviewTabsHeader" src`
  - 预期：
    - 当前仓库缺少或引用失败。
- 失败验证：
  - `npm run build`
  - 预期：类型缺失或当前实现无法支撑新页面。
- 最小实现：
  - 从上游迁入通用平台类型和 presentation 层。
  - 将当前 `src/lib/platformAccounts.ts` 简化逻辑拆为：
    - 类型 re-export
    - service glue
    - 临时兼容适配层
  - 保留现有页面可编译。
- 通过验证：
  - `npm run build`
  - 预期：构建通过。
- 提交点：
  - `feat(platform-center): add parity platform type foundation`

## 任务 2：迁入 Codex 完整账户页主视图

- 文件：
  - `src/pages/platformAccounts/CodexAccountsPage.tsx`
  - `src/components/codex/CodexModelProviderManager.tsx`
  - `src/components/codex/CodexQuickConfigCard.tsx`
  - `src/components/codex/CodexSessionManager.tsx`
  - `src/components/codex/CodexWakeupContent.tsx`
  - `src/components/platform/PlatformOverviewTabsHeader.tsx`
  - `src/components/platform/DosageNotifyQuotaPreview.tsx`
  - `src/components/platform/DosageNotifyUsageStatus.tsx`
  - `src/styles/globals.css`
- 失败测试：
  - 新增页面测试，验证：
    - 出现 `quota_error` badge
    - API Key 账号出现 `快速切换供应商`
    - tabs 包含 `Accounts / Instances / Local Access / Wakeup / Session Manager / Model Providers`
  - 命令：
    - `rg -n "快速切换供应商|quota_error|Session Manager|Wakeup|Model Providers" src/pages/platformAccounts src/components`
- 失败验证：
  - 运行页面测试。
  - 预期：当前页面没有这些元素。
- 最小实现：
  - 迁入上游 Codex 页面与其直接依赖。
  - 替换当前通用页包装方式。
  - 通过适配层把项目路由、样式和 service 名称接回当前仓库。
- 通过验证：
  - 页面测试通过。
  - `npm run build` 通过。
- 提交点：
  - `feat(platform-center): migrate codex parity account page`

## 任务 3：迁入 Codex 实例、Local Access、Session、Provider Manager、Wakeup store/service

- 文件：
  - `src/pages/platformAccounts/CodexInstancesPage.tsx`
  - `src/services/codexService.ts`
  - `src/services/codexInstanceService.ts`
  - `src/services/codexLocalAccessService.ts`
  - `src/services/codexModelProviderService.ts`
  - `src/services/codexWakeupService.ts`
  - `src/services/providerCurrentAccountService.ts`
  - `src/stores/useCodexAccountStore.ts`
  - `src/stores/useCodexInstanceStore.ts`
  - `src/stores/useCodexWakeupStore.ts`
  - `src/components/platform/PlatformInstancesContent.tsx`
  - `src/App.tsx`
  - `src/lib/platformCenterRoutes.ts`
- 失败测试：
  - 新增 store/service 测试，验证：
    - `quick switch provider`
    - `provider current`
    - local access load/save
    - wakeup load/save/run
  - 新增路由测试，验证 Codex Instances 路由可访问。
- 失败验证：
  - `npm run build`
  - 预期：依赖 service/store 未找到。
- 最小实现：
  - 迁入上游 service/store。
  - 把路由改为：
    - `/settings/model-providers/accounts/codex`
    - `/settings/model-providers/accounts/codex/instances`
  - 接入 provider current。
- 通过验证：
  - store/service 测试通过。
  - `npm run build` 通过。
- 提交点：
  - `feat(platform-center): add codex parity platform stores and services`

## 任务 4：迁入 Gemini 完整账户页与实例页

- 文件：
  - `src/pages/platformAccounts/GeminiAccountsPage.tsx`
  - `src/pages/platformAccounts/GeminiInstancesPage.tsx`
  - `src/services/geminiService.ts`
  - `src/services/geminiInstanceService.ts`
  - `src/stores/useGeminiAccountStore.ts`
  - `src/stores/useGeminiInstanceStore.ts`
  - `src/components/GeminiOverviewTabsHeader.tsx`
- 失败测试：
  - 页面测试验证：
    - 顶层 tabs 正确
    - injection/launch command 入口存在
    - 导入导出、刷新、切换可触发 service
- 失败验证：
  - 运行页面测试。
  - 预期：当前 Gemini 页面仍是通用壳子。
- 最小实现：
  - 迁入上游 Gemini 页面、tabs、store、service。
  - 接入当前路由与统一平台中心外壳。
- 通过验证：
  - 页面测试通过。
  - `npm run build` 通过。
- 提交点：
  - `feat(platform-center): migrate gemini parity pages`

## 任务 5：迁入 Kiro 完整账户页与实例页

- 文件：
  - `src/pages/platformAccounts/KiroAccountsPage.tsx`
  - `src/pages/platformAccounts/KiroInstancesPage.tsx`
  - `src/services/kiroService.ts`
  - `src/services/kiroInstanceService.ts`
  - `src/stores/useKiroAccountStore.ts`
  - `src/stores/useKiroInstanceStore.ts`
  - `src/components/KiroOverviewTabsHeader.tsx`
- 失败测试：
  - 页面测试验证：
    - credits/quota 区块显示
    - injection 入口存在
    - 导入导出、刷新可触发 service
- 失败验证：
  - 运行页面测试。
  - 预期：当前 Kiro 页面仍是通用壳子。
- 最小实现：
  - 迁入上游 Kiro 页面、实例页、store、service。
  - 保持不接入 `ModelChatPage`。
- 通过验证：
  - 页面测试通过。
  - `npm run build` 通过。
- 提交点：
  - `feat(platform-center): migrate kiro parity pages`

## 任务 6：用真实 Rust 模块替换当前简化后端

- 文件：
  - `src-tauri/src/platform_accounts/mod.rs`
  - `src-tauri/src/platform_accounts/oauth.rs`
  - `src-tauri/src/platform_accounts/oauth_server.rs`
  - `src-tauri/src/platform_accounts/oauth_pending_state.rs`
  - `src-tauri/src/platform_accounts/provider_current_state.rs`
  - `src-tauri/src/platform_accounts/data_transfer.rs`
  - `src-tauri/src/platform_accounts/group_settings.rs`
  - `src-tauri/src/main.rs`
  - `src-tauri/Cargo.toml`
- 失败测试：
  - Rust smoke test：
    - 列表命令
    - OAuth start/submit/complete
    - provider current 读写
    - import/export
  - 命令：
    - `RUSTC=... cargo check --manifest-path src-tauri/Cargo.toml`
- 失败验证：
  - 当前简化模块不支持真实上游字段和命令。
- 最小实现：
  - 删除当前简化 JSON-only 假实现。
  - 按上游模块结构重新组织代码。
  - 保留当前 app data 目录适配，避免破坏现有项目存储。
- 通过验证：
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - 预期：通过。
- 提交点：
  - `feat(platform-center): replace minimal platform backend with parity module core`

## 任务 7：迁入 Codex Rust 命令和 quota/local access/wakeup/session 能力

- 文件：
  - `src-tauri/src/platform_accounts/codex_account.rs`
  - `src-tauri/src/platform_accounts/codex_instance.rs`
  - `src-tauri/src/platform_accounts/codex_local_access.rs`
  - `src-tauri/src/platform_accounts/codex_oauth.rs`
  - `src-tauri/src/platform_accounts/codex_quota.rs`
  - `src-tauri/src/platform_accounts/codex_session_manager.rs`
  - `src-tauri/src/platform_accounts/codex_session_visibility.rs`
  - `src-tauri/src/platform_accounts/codex_wakeup.rs`
  - `src-tauri/src/platform_accounts/codex_wakeup_scheduler.rs`
  - `src-tauri/src/main.rs`
- 失败测试：
  - Rust smoke test 验证：
    - `list_codex_accounts`
    - `switch_codex_account`
    - `refresh_codex_quota` / `refresh_all_codex_quotas`
    - `codex_wakeup_*`
    - `get/update local access`
    - `session visibility repair`
- 失败验证：
  - `cargo check --manifest-path src-tauri/Cargo.toml`
- 最小实现：
  - 迁入上游 Codex 命令和依赖模块。
  - 修正 crate path、模块名、日志与当前仓库冲突点。
  - 接入当前项目所需 tray/provider current。
- 通过验证：
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - 前端调用 smoke test 通过。
- 提交点：
  - `feat(platform-center): migrate codex parity backend`

## 任务 8：迁入 Gemini/Kiro Rust 命令与实例能力

- 文件：
  - `src-tauri/src/platform_accounts/gemini_account.rs`
  - `src-tauri/src/platform_accounts/gemini_instance.rs`
  - `src-tauri/src/platform_accounts/gemini_oauth.rs`
  - `src-tauri/src/platform_accounts/kiro_account.rs`
  - `src-tauri/src/platform_accounts/kiro_instance.rs`
  - `src-tauri/src/platform_accounts/kiro_oauth.rs`
  - `src-tauri/src/main.rs`
- 失败测试：
  - Rust smoke test 验证：
    - Gemini/Kiro list/import/export/refresh/oauth
    - Gemini/Kiro instance load/save/inject/start commands
- 失败验证：
  - `cargo check --manifest-path src-tauri/Cargo.toml`
- 最小实现：
  - 迁入上游模块并适配当前仓库目录结构。
- 通过验证：
  - `cargo check --manifest-path src-tauri/Cargo.toml`
- 提交点：
  - `feat(platform-center): migrate gemini kiro parity backend`

## 任务 9：迁入 tray/native menu/quota alert/quick switch 机制

- 文件：
  - `src-tauri/src/platform_accounts/tray.rs`
  - `src-tauri/src/platform_accounts/tray_layout.rs`
  - `src-tauri/src/platform_accounts/macos_native_menu.rs`
  - `src/services/providerCurrentAccountService.ts`
  - `src/stores/usePlatformLayoutStore.ts`
  - `src/pages/platformAccounts/CodexAccountsPage.tsx`
  - `src/pages/platformAccounts/GeminiAccountsPage.tsx`
  - `src/pages/platformAccounts/KiroAccountsPage.tsx`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`
- 失败测试：
  - 前端页面测试：
    - `quota_error` badge 展示
    - quick switch modal 打开与提交
  - Rust smoke test：
    - `save_tray_platform_layout`
    - `provider_current`
    - `run_quota_alert_if_needed` 触发后 tray 更新
- 失败验证：
  - 当前仓库不存在这些命令和 UI。
- 最小实现：
  - 迁入 tray/native menu 模块和平台布局 store。
  - 将 quick switch/provider current 完整接回 Codex。
  - 接入 quota alert 调用点。
- 通过验证：
  - 页面测试与 Rust smoke test 通过。
- 提交点：
  - `feat(platform-center): restore tray quick-switch and alert flows`

## 任务 10：回归与清理

- 文件：
  - `src/App.tsx`
  - `src/pages/DesktopSettingsPage.tsx`
  - `src/pages/ModelProvidersPage.tsx`
  - `src/pages/ModelProviderEditorPage.tsx`
  - `src/lib/platformCenterRoutes.ts`
  - `src/lib/platformAccounts.ts`
  - `src/platformAccounts/stores.ts`
  - 迁移期间所有新增兼容层文件
- 失败测试：
  - 运行全量构建和 smoke test。
- 失败验证：
  - `npm run build`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - 旧 provider 路径 smoke test
- 最小实现：
  - 删除已不再使用的简化 store/service/类型层。
  - 保留必要兼容适配。
  - 修复样式、懒加载、路由跳转、类型重复定义。
- 通过验证：
  - `npm run build`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - 验证：
    - `/settings/model-providers/api`
    - `/settings/model-providers/accounts/codex`
    - `/settings/model-providers/accounts/gemini`
    - `/settings/model-providers/accounts/kiro`
  - 预期：全部通过。
- 提交点：
  - `feat(platform-center): finalize cockpit parity migration`

## 具体命令基线

- 前端构建：
  - `npm run build`
- Rust 检查：
  - `RUSTC=/home/yyt/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/rustc /home/yyt/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/cargo check --manifest-path src-tauri/Cargo.toml`
- Rust 格式：
  - `/home/yyt/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/rustfmt --edition 2021 <files>`
- 文本定位：
  - `rg -n "quickSwitch|quota_error|run_quota_alert_if_needed|update_tray_menu" src src-tauri cockpit-tools-main`

## 自检

- 已覆盖前端页面、store、service、路由、样式、Tauri 命令、模块、tray/native menu。
- 已明确现有简化实现需要被替换，而不是继续扩展。
- 计划中没有 `TODO` / `TBD` / “后续处理” 之类占位。
- 每个任务都包含失败验证、最小实现、通过验证、提交点。

## 执行方式

- 建议按本计划内联执行，不再沿用旧的“第一阶段骨架计划”。
- 实施顺序：
  1. Codex 前端对等
  2. Codex 后端对等
  3. Gemini/Kiro 前后端对等
  4. tray/native menu/quota alert 收口
