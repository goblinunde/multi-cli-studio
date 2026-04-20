# Desktop Platform Accounts Full Parity Design

日期：2026-04-20

## 目标

在当前 `multi-cli-studio` 桌面端内，把 `Codex / Gemini / Kiro` 账号页继续向 `cockpit-tools-main` 做大范围迁移，同时补齐全局代理与后台自动刷新：

1. 账户页继续迁入 `cockpit-tools-main` 的整套工具栏/筛选/分页系统，而不只是最小 `list/grid`。
2. 账户页完整支持并持久化 `list / grid` 视图切换。
3. 保留现有 `SSH ProxyJump`。
4. 新增 `cockpit-tools-main` 风格 `Global Proxy`：
   - `global_proxy_enabled`
   - `global_proxy_url`
   - `global_proxy_no_proxy`
5. 额度自动刷新按平台分别配置：
   - `codex_auto_refresh_minutes`
   - `gemini_auto_refresh_minutes`
   - `kiro_auto_refresh_minutes`
6. 自动刷新在 Tauri worker 中执行，不依赖页面是否打开。
7. 全局代理同时作用于：
   - 应用内 HTTP 请求
   - 桌面端受管启动进程

## 非目标

- 不迁入与当前三个平台账户页无关的平台。
- 不迁入与本轮无关的 tray/native menu 完整体系。
- 不替换当前 `DesktopConnectionsSection` 的 SSH 模型。
- 不重做当前应用的顶层路由与设置导航。

## 现状

### 当前仓库

- `src/pages/platformAccounts/CodexAccountsPage.tsx`
- `src/pages/platformAccounts/GeminiAccountsPage.tsx`
- `src/pages/platformAccounts/KiroAccountsPage.tsx`

已经是 provider-specific 页面，但仍处于“简化版账户总览”：

- 只有搜索 + 简单导出/刷新
- 没有上游完整 `view switcher`
- 没有上游完整筛选/标签过滤/批量选择/分页
- 没有统一共享的账户表格/卡片渲染骨架

设置模型当前也没有：

- 平台账户视图模式
- 全局代理
- 平台自动刷新分钟数

### cockpit-tools-main 参考结论

上游账户页完整总览包含：

- 搜索
- `compact / list / grid` 视图切换
- 动态 tier filter
- tag filter
- group by tag
- 批量选择与批量操作
- 分页
- 更丰富的卡片/表格布局

上游设置与运行时包含：

- `global proxy url + no_proxy`
- 平台级自动刷新分钟数
- 代理环境同步到应用内与受管进程

## 方案

### 方案 A：维持前次最小迁移

- 只补 `list/grid`
- 补 proxy 和 auto refresh
- 不迁完整工具栏/筛选/分页

优点：

- 改动面小
- 回归风险低

缺点：

- 不满足你现在明确要求的“继续大规模迁入”
- 后续很可能还要第二次返工

### 方案 B：完整升级账户总览层，同时保留当前项目后端集成方式

- 总览 UI 和状态流最大限度参考 `cockpit-tools-main`
- 后端继续复用当前仓库已经迁好的平台服务与命令
- 代理和自动刷新并入当前 `AppSettings` / `main.rs`

优点：

- 最符合你当前要求
- 不必把上游所有模块生搬硬套进来
- 能在当前应用架构内完成大部分视觉和交互 parity

缺点：

- 前端改动明显增大
- 需要把简化页重构成共享工具栏 + 共享视图容器 + provider-specific column/card extension

### 方案 C：账户页完全照搬上游状态系统

- 直接复制上游更多页面状态、hook、工具栏逻辑
- 尽量少做本地重组

优点：

- 与上游最像

缺点：

- 当前仓库并没有上游完整依赖面
- 很容易把本轮扩成“整个账户中心前端二次迁移”
- 集成风险高于收益

## 决策

采用方案 B，但把总览层范围升级到接近上游完整能力。

也就是：

- 账户页继续大规模迁入 `cockpit-tools-main` 的工具栏/筛选/分页系统
- 视图切换、筛选、分页、批量选择、标签过滤都进入本轮
- `Global Proxy + 分平台自动刷新 + Tauri worker` 按上一版方案保留

## 推荐设计

### 1. 总览层抽象

把三个平台账户页的总览部分拆成共享层，保留平台差异插槽。

共享层提供：

- 搜索
- 视图切换
- tier filter
- tag filter
- group by tag
- 选择态与批量操作容器
- 分页
- grid / list 容器

平台差异通过插槽或配置注入：

- 卡片正文指标
- 表格列定义
- 顶部平台专属补充信息
- 平台动作按钮

### 2. 视图模式

本轮只对外暴露：

- `list`
- `grid`

内部可以保留后续扩展 `compact` 的类型位，但当前 UI 不开放，避免一次把上游第三种模式也拉进来。

持久化位置：

- `AppSettings.platformAccountViewModes`

### 3. 工具栏与筛选

按上游思路迁入，但只覆盖当前三个平台所需最小集合：

- 搜索框
- `list/grid` 切换按钮
- 平台 plan/tier filter
- tag filter dropdown
- `group by tag`
- 批量选择
- 批量导出 / 批量删除 / 批量刷新
- 分页 page size / current page

不在本轮迁入：

- 上游所有平台都能复用的超大通用 filter 框架
- 与当前三平台无关的 group/folder 特殊卡片

### 4. 页面结构

每个平台页继续保留：

- OAuth / Import / 手动添加区
- provider-specific tabs

但在 `overview` tab 内，总览区重构为：

1. `PlatformAccountOverviewToolbar`
2. `PlatformAccountSelectionBar`
3. `PlatformAccountGridView | PlatformAccountListView`
4. `PaginationControls`

### 5. 设置模型

在 `AppSettings` 中新增：

- `platformAccountViewModes: { codex: "list" | "grid"; gemini: "list" | "grid"; kiro: "list" | "grid" }`
- `globalProxyEnabled: boolean`
- `globalProxyUrl: string`
- `globalProxyNoProxy: string`
- `codexAutoRefreshMinutes: number`
- `geminiAutoRefreshMinutes: number`
- `kiroAutoRefreshMinutes: number`

默认值：

- `platformAccountViewModes.* = "grid"`
- `globalProxyEnabled = false`
- `globalProxyUrl = ""`
- `globalProxyNoProxy = ""`
- 自动刷新默认 `10`

### 6. 设置页落点

仍使用当前桌面设置页，不新增一级导航。

新增 `DesktopNetworkSection`，包含两块：

- `Global Proxy`
- `Platform Auto Refresh`

其中：

- `SSH ProxyJump` 继续留在 `DesktopConnectionsSection`
- `Global Proxy` 只放在 `DesktopNetworkSection`

语义分离：

- `ProxyJump` 仅 SSH
- `Global Proxy` 仅 HTTP/HTTPS/SOCKS 及受管进程代理环境

### 7. 全局代理实现

Tauri 侧管理这些环境变量：

- `http_proxy`
- `https_proxy`
- `HTTP_PROXY`
- `HTTPS_PROXY`
- `all_proxy`
- `ALL_PROXY`
- `no_proxy`
- `NO_PROXY`

行为：

- 应用启动时根据 settings 同步
- `update_settings` 后重新同步
- 受管 CLI 启动时注入同样变量
- 关闭全局代理时恢复继承环境

### 8. 自动刷新 worker

在 Tauri 启动流程中新增平台账户后台刷新 worker。

行为：

- 按平台分别读取刷新分钟数
- `<= 0` 视为关闭
- 每个平台独立 tick
- 上一次未完成时不重入

调用目标：

- `Codex -> refresh_all_codex_quotas`
- `Gemini -> refresh_all_gemini_tokens`
- `Kiro -> refresh_all_kiro_tokens`

### 9. 与现有页面协作

账户页手动刷新仍保留。

后台自动刷新修改的是同一份平台账户索引，因此：

- 页面重新获取数据即可看到最新结果
- 如需更及时刷新，本轮可以在前端总览页进入时继续保留显式 `fetchAccounts`

## 文件职责

### 前端

- `src/lib/models.ts`
  扩展 `AppSettings` 与平台账户视图模式类型。
- `src/lib/store.ts`
  承接 settings 更新后的本地状态同步。
- `src/components/platform/PlatformAccountOverviewToolbar.tsx`
  共享搜索/切换/筛选工具栏。
- `src/components/platform/PlatformAccountSelectionBar.tsx`
  共享批量选择和批量动作条。
- `src/components/platform/PlatformAccountGridView.tsx`
  共享卡片视图容器。
- `src/components/platform/PlatformAccountListView.tsx`
  共享列表视图容器。
- `src/components/settings/DesktopNetworkSection.tsx`
  全局代理与平台自动刷新设置。
- `src/pages/DesktopSettingsPage.tsx`
  挂载 `DesktopNetworkSection`。
- `src/pages/platformAccounts/CodexAccountsPage.tsx`
  接入上游风格总览层与平台专属列/卡片内容。
- `src/pages/platformAccounts/GeminiAccountsPage.tsx`
  同上。
- `src/pages/platformAccounts/KiroAccountsPage.tsx`
  同上。

### 后端

- `src-tauri/src/main.rs`
  扩展 `AppSettings` Rust 结构、默认值、normalize、设置持久化、代理环境同步、后台自动刷新 worker。
- `src-tauri/src/platform_accounts/mod.rs`
  继续复用现有刷新逻辑，供 worker 调用。

## 风险

- 完整工具栏/筛选/分页迁入会显著扩大前端改动面。
- 当前三个平台页面结构并不统一，抽共享层时容易把平台差异压平得过头。
- 自动刷新与手动刷新可能同时命中同一平台，需要显式防重入。
- 全局代理若配置错误，会同时影响 app 内请求与受管进程，需要在设置页给出明确说明。

## 自检

- 范围已更新为你明确指定的“大规模迁入账户总览层”。
- `SSH ProxyJump` 与 `Global Proxy` 的边界清晰。
- 自动刷新按平台分别设置，且明确放到 Tauri worker。
- 没有把范围继续扩到 tray/native menu 或其他平台。 
