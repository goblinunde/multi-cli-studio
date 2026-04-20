# Desktop Platform Accounts Proxy Parity Execution Plan

日期：2026-04-20

## 文件职责

- `docs/superpowers/specs/2026-04-20--desktop-platform-accounts-proxy-design.md`
  记录本轮大范围迁移的设计约束与边界。
- `docs/superpowers/plans/2026-04-20-desktop-platform-accounts-proxy-parity.md`
  记录本轮实现步骤、测试路径与验证命令。
- `src/lib/models.ts`
  扩展 `AppSettings` 与平台账户视图模式类型。
- `src/components/platform/*.tsx`
  承载账户总览共享工具栏、列表、卡片、选择条。
- `src/components/settings/DesktopNetworkSection.tsx`
  新增全局代理与平台自动刷新设置区。
- `src/pages/DesktopSettingsPage.tsx`
  挂载 `DesktopNetworkSection`。
- `src/pages/platformAccounts/CodexAccountsPage.tsx`
  接入共享总览系统与 Codex 专属展示。
- `src/pages/platformAccounts/GeminiAccountsPage.tsx`
  接入共享总览系统与 Gemini 专属展示。
- `src/pages/platformAccounts/KiroAccountsPage.tsx`
  接入共享总览系统与 Kiro 专属展示。
- `src/smoke/providerAccountsParity.smoke.ts`
  补共享账户总览类型与 view mode 的编译型 smoke。
- `src-tauri/src/main.rs`
  扩展设置模型、默认值、代理环境同步、平台自动刷新 worker 与对应测试。

## 任务 1：设置模型与 smoke 红灯

- 文件：
  - `src/lib/models.ts`
  - `src/smoke/providerAccountsParity.smoke.ts`
  - `src-tauri/src/main.rs`
- 失败测试：
  - 新增 TypeScript smoke，验证 `AppSettings` 含 `platformAccountViewModes`、`globalProxyEnabled`、`globalProxyUrl`、`globalProxyNoProxy`、三个平台自动刷新分钟数。
  - 新增 Rust 单元测试，验证 `seed_settings` 与 settings 反序列化补默认值。
- 失败验证：
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml settings_`
- 最小实现：
  - 扩展 TS/Rust 设置结构与默认值。
  - 在 Rust normalize 中为旧设置补齐字段。
- 通过验证：
  - 重新运行相同命令并确认通过。
- 提交点：
  - `feat(settings): add platform account proxy and refresh config`

## 任务 2：全局代理红灯与最小实现

- 文件：
  - `src-tauri/src/main.rs`
  - `src/components/settings/DesktopNetworkSection.tsx`
  - `src/pages/DesktopSettingsPage.tsx`
- 失败测试：
  - Rust 单元测试验证：
    - 启用代理时生成 `http_proxy/https_proxy/all_proxy`
    - 有 `no_proxy` 时同时生成 `no_proxy/NO_PROXY`
    - 关闭代理时返回空注入集合
  - TypeScript smoke 验证 `DesktopNetworkSection` 消费新增设置字段。
- 失败验证：
  - `cargo test --manifest-path src-tauri/Cargo.toml proxy_`
  - `npm run build`
- 最小实现：
  - 在 Tauri 增加托管代理环境同步 helper。
  - `update_settings` 后调用同步逻辑。
  - 新增 `DesktopNetworkSection` UI 并挂到桌面设置页。
- 通过验证：
  - 重新运行相同命令并确认通过。
- 提交点：
  - `feat(settings): add global proxy configuration`

## 任务 3：平台自动刷新 worker 红灯与最小实现

- 文件：
  - `src-tauri/src/main.rs`
  - `src-tauri/src/platform_accounts/mod.rs`
- 失败测试：
  - Rust 单元测试验证：
    - 平台自动刷新分钟数 `<= 0` 时禁用
    - 三个平台可独立计算下一次调度
    - 更新 settings 后 worker 读取新配置
- 失败验证：
  - `cargo test --manifest-path src-tauri/Cargo.toml auto_refresh_`
- 最小实现：
  - 增加平台自动刷新调度 helper。
  - 在 Tauri setup 中启动后台 worker。
  - worker 调用现有 `refresh_all_codex_quotas / refresh_all_gemini_tokens / refresh_all_kiro_tokens`。
- 通过验证：
  - 重新运行相同命令并确认通过。
- 提交点：
  - `feat(platform-accounts): add background auto refresh worker`

## 任务 4：账户总览共享层红灯

- 文件：
  - `src/components/platform/PlatformAccountOverviewToolbar.tsx`
  - `src/components/platform/PlatformAccountSelectionBar.tsx`
  - `src/components/platform/PlatformAccountGridView.tsx`
  - `src/components/platform/PlatformAccountListView.tsx`
  - `src/smoke/providerAccountsParity.smoke.ts`
- 失败测试：
  - TypeScript smoke 验证共享组件公开：
    - `list/grid` view mode
    - toolbar filter props
    - bulk action props
    - pagination props
- 失败验证：
  - `npm run build`
- 最小实现：
  - 新增共享组件与类型定义。
  - 先做最小渲染结构，不带平台页接线。
- 通过验证：
  - 重新运行 `npm run build` 并确认通过。
- 提交点：
  - `feat(platform-accounts): add shared overview components`

## 任务 5：Codex 总览迁移

- 文件：
  - `src/pages/platformAccounts/CodexAccountsPage.tsx`
  - `src/components/platform/*.tsx`
- 失败测试：
  - TypeScript build 失败即为红灯，因页面需适配新共享组件。
- 失败验证：
  - `npm run build`
- 最小实现：
  - 把 Codex 总览迁到共享工具栏、选择条、列表/卡片视图。
  - 保留 Codex 平台特有 quota/provider/wakeup 入口展示。
  - 接入 view mode 持久化。
- 通过验证：
  - `npm run build`
- 提交点：
  - `feat(codex): migrate overview toolbar and view modes`

## 任务 6：Gemini 与 Kiro 总览迁移

- 文件：
  - `src/pages/platformAccounts/GeminiAccountsPage.tsx`
  - `src/pages/platformAccounts/KiroAccountsPage.tsx`
  - `src/components/platform/*.tsx`
- 失败测试：
  - TypeScript build 失败即为红灯。
- 失败验证：
  - `npm run build`
- 最小实现：
  - 接入共享工具栏、筛选、分页、列表/卡片双视图。
  - 保留各自平台字段与动作按钮。
- 通过验证：
  - `npm run build`
- 提交点：
  - `feat(platform-accounts): migrate gemini and kiro overview parity`

## 任务 7：最终验证

- 文件：
  - 本轮所有改动文件
- 验证命令：
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml settings_`
  - `cargo test --manifest-path src-tauri/Cargo.toml proxy_`
  - `cargo test --manifest-path src-tauri/Cargo.toml auto_refresh_`
  - `cargo test --manifest-path src-tauri/Cargo.toml platform_accounts::tests`
- 预期输出：
  - 前端编译通过
  - Rust 相关测试全部通过
  - 平台账户相关测试无回归
- 完成标准：
  - 账户页完整支持持久化 `list/grid`
  - 保留 `SSH ProxyJump`
  - 新增 `Global Proxy`
  - 新增分平台自动刷新
  - 自动刷新在 Tauri worker 中运行
