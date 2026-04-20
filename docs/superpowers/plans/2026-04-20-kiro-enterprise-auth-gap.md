# Kiro 企业 OAuth 缺口修复计划

日期：2026-04-20

## 文件职责

- `src-tauri/src/platform_accounts/mod.rs`
  补齐 Kiro 企业 OAuth/刷新/导入的核心逻辑与对应单元测试。
- `docs/superpowers/plans/2026-04-20-kiro-enterprise-auth-gap.md`
  记录本次最小修复范围、测试路径与验证命令。

## 任务 1：锁定缺口并补失败测试

- 文件：`src-tauri/src/platform_accounts/mod.rs`
- 失败测试：
  - 新增测试验证企业 Kiro 账号会命中 AWS IAM Identity Center 刷新判定。
  - 新增测试验证 Kiro 原始导入对象会保留 `authMethod`、`client_secret`、`startUrl`、`idc_region` 等上下文。
  - 新增测试验证 Kiro 本地 auth 快照能解析 `profileArn`、企业 provider 和 refresh 上下文。
- 失败验证命令：
  - `cargo test --manifest-path src-tauri/Cargo.toml kiro_`
  - 预期：新测试因函数/行为缺失而失败。
- 最小实现前置：
  - 只添加与 Kiro 企业分支直接相关的测试。
  - 不改动 Codex/Gemini 流程。
- 通过验证：
  - 重新运行相同测试，确认对应 case 变绿。
- 提交点：
  - `test(kiro): cover enterprise refresh and import context`

## 任务 2：补齐 Kiro 企业刷新判定与 OIDC 优先刷新

- 文件：`src-tauri/src/platform_accounts/mod.rs`
- 失败测试：
  - 使用任务 1 中的企业账号判定测试。
- 失败验证命令：
  - `cargo test --manifest-path src-tauri/Cargo.toml should_prefer_kiro_idc_refresh_for_enterprise_account`
- 最小实现：
  - 增加 Kiro provider/login_option 到企业分支的归一化映射。
  - 增加 `idc_region` / `client_id` / `client_secret` 解析。
  - 刷新时优先走 AWS IAM Identity Center OIDC token endpoint，失败后回退到 Kiro `refreshToken`。
  - 刷新结果回填 `refreshToken`、`idc_region`、`client_id`、`issuer_url` 等上下文。
- 通过验证：
  - 重新运行同一测试并确认通过。
- 提交点：
  - `feat(kiro): prefer idc refresh for enterprise auth`

## 任务 3：补齐 Kiro 专用导入与本机快照解析

- 文件：`src-tauri/src/platform_accounts/mod.rs`
- 失败测试：
  - 使用任务 1 中 Kiro 导入与本机快照测试。
- 失败验证命令：
  - `cargo test --manifest-path src-tauri/Cargo.toml build_kiro_import_auth_token_preserves_enterprise_context`
  - `cargo test --manifest-path src-tauri/Cargo.toml build_kiro_payload_from_snapshot_supports_enterprise_context`
- 最小实现：
  - 新增 Kiro 专用导入 auth/profile/usage 组装函数。
  - `import_kiro_from_json` 改走 Kiro 专用解析，而不是通用 `account_from_value`。
  - 本机导入改用 `build_kiro_payload_from_snapshot` + `build_kiro_record`，保留 `raw` 中的 auth/profile/usage 快照。
- 通过验证：
  - 重新运行同一测试并确认通过。
- 提交点：
  - `feat(kiro): preserve enterprise auth context on import`

## 任务 4：针对性回归验证

- 文件：`src-tauri/src/platform_accounts/mod.rs`
- 验证命令：
  - `cargo test --manifest-path src-tauri/Cargo.toml kiro_`
  - `cargo test --manifest-path src-tauri/Cargo.toml platform_accounts::tests::should_prefer_kiro_idc_refresh_for_enterprise_account`
- 预期输出：
  - 新增 Kiro 相关测试全部通过。
  - 无新的 Rust 编译错误。
- 完成标准：
  - Kiro social/browser 主流程保持不变。
  - 企业 AWS IDC / External IdP 账号至少具备“上下文保留 + 正确刷新策略判定 + IDC 优先刷新回退”的后端基础。
