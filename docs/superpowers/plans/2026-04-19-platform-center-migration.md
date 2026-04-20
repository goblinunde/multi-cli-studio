# 平台账号中心迁移执行计划

日期：2026-04-19

## 文件职责

- `src/App.tsx`
  新增统一平台中心路由与旧路由重定向。
- `src/pages/DesktopSettingsPage.tsx`
  保持“模型管理”入口，但指向统一平台中心子路由。
- `src/pages/PlatformCenterPage.tsx`
  统一平台中心外壳与一级导航。
- `src/pages/ModelProvidersPage.tsx`
  适配为 API Providers 子页。
- `src/pages/ModelProviderEditorPage.tsx`
  适配为 API Providers 编辑子页。
- `src/lib/models.ts`
  新增平台中心前端类型，不污染现有 `AppSettings` provider 结构。
- `src/lib/bridge.ts`
  新增 Codex/Gemini/Kiro 账号中心命令桥接接口。
- `src/platformAccounts/*`
  迁入平台类型、服务、store、工具、组件。
- `src/pages/platformAccounts/*`
  迁入并适配 Codex/Gemini/Kiro 账号页与实例页。
- `src-tauri/Cargo.toml`
  增加平台模块所需依赖。
- `src-tauri/src/main.rs`
  先做最小桥接注册，再逐步下沉模块。
- `src-tauri/src/platform_accounts/*`
  承载迁入后的平台账号模块。

## 任务 1：统一平台中心路由骨架

- 测试：新增前端路由测试，验证：
  - `/settings/model-providers` 显示统一平台中心
  - `/settings/model-providers/api` 显示 API Providers
  - 旧 provider 编辑路由仍可访问
- 运行失败验证：执行相关测试，确认因为页面/路由不存在而失败。
- 最小实现：
  - 新增 `PlatformCenterPage.tsx`
  - 更新 `src/App.tsx`
  - 更新 `src/pages/DesktopSettingsPage.tsx`
- 通过验证：重新运行测试并确认通过。
- 提交点：`feat(platform-center): add unified settings entry shell`

## 任务 2：把 API Providers 收编到统一平台中心

- 测试：新增页面测试，验证统一平台中心切换到 `API Providers` 时仍显示当前 provider 列表。
- 运行失败验证：确认新导航下 provider 列表不可见或链接错误。
- 最小实现：
  - 更新 `ModelProvidersPage.tsx`
  - 更新 `ModelProviderEditorPage.tsx`
  - 更新相关跳转链接
- 通过验证：重新运行测试。
- 提交点：`feat(platform-center): embed existing api providers`

## 任务 3：迁入平台账户基础类型、服务、store

- 测试：为 Codex/Gemini/Kiro store 新增单测，验证：
  - 能拉取账户
  - 能切换当前账户
  - 能刷新账户
- 运行失败验证：确认 store/service 未定义。
- 最小实现：
  - 迁入 `types/*`
  - 迁入 `services/*`
  - 新增 `stores/*`
  - 扩展 `bridge.ts`
- 通过验证：重新运行单测。
- 提交点：`feat(platform-center): add account service layer`

## 任务 4：迁入 Codex/Gemini/Kiro 账号页

- 测试：为三个账户页分别增加渲染测试，验证顶层标题、加载态和基础操作按钮。
- 运行失败验证：确认页面无法挂载。
- 最小实现：
  - 迁入 `useProviderAccountsPage`
  - 迁入必要共用组件
  - 接入三个平台账户页到新路由
- 通过验证：重新运行测试。
- 提交点：`feat(platform-center): add codex gemini kiro account pages`

## 任务 5：接入 OAuth 与基础账号操作命令

- 测试：增加 service 层测试，验证 OAuth start/complete/cancel/submitCallback 调用桥接接口。
- 运行失败验证：确认 bridge 或命令不存在。
- 最小实现：
  - 前端桥接接口补齐
  - 后端最小命令注册
  - 命令返回结构与前端类型对齐
- 通过验证：重新运行测试与构建。
- 提交点：`feat(platform-center): wire oauth account commands`

## 任务 6：接入平台实例页与外围能力入口

- 测试：增加页面测试，验证：
  - Codex 显示实例/本地访问/Wakeup 等 tabs
  - Gemini 显示实例/注入入口
  - Kiro 显示实例/注入入口
- 运行失败验证：确认 tabs 或内容缺失。
- 最小实现：
  - 迁入各平台实例页
  - 迁入 Codex 关键外围组件
  - 接入平台内 tabs
- 通过验证：重新运行测试。
- 提交点：`feat(platform-center): add platform peripheral sections`

## 任务 7：迁入后端平台模块

- 测试：增加 Rust 命令层验证，至少覆盖列表命令、OAuth 开始命令与导入导出命令的 smoke test。
- 运行失败验证：确认命令未注册或模块未编译。
- 最小实现：
  - 在 `src-tauri/Cargo.toml` 加依赖
  - 新建 `src-tauri/src/platform_accounts/*`
  - 从 `cockpit-tools-main` 迁入并裁剪 Codex/Gemini/Kiro 模块
  - 在 `main.rs` 注册命令
- 通过验证：运行 `cargo check`
- 提交点：`feat(platform-center): migrate tauri platform account modules`

## 任务 8：回归验证

- 测试：
  - 前端测试全集
  - `npm run build`
  - `cargo check`
  - 旧 provider 聊天路径 smoke test
- 运行失败验证：确认没有回归。
- 最小实现：
  - 修复样式、链接、类型与懒加载问题
- 通过验证：全部通过。
- 提交点：`feat(platform-center): finalize unified platform migration`
