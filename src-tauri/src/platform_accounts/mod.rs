use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::Utc;
use dirs::{data_local_dir, home_dir};
use reqwest::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::{Duration, Instant};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Platform {
    Codex,
    Gemini,
    Kiro,
}

impl Platform {
    fn as_str(self) -> &'static str {
        match self {
            Self::Codex => "codex",
            Self::Gemini => "gemini",
            Self::Kiro => "kiro",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Codex => "Codex",
            Self::Gemini => "Gemini",
            Self::Kiro => "Kiro",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct PlatformAccountRecord {
    id: String,
    email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    display_name: Option<String>,
    auth_mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    plan_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    plan_type: Option<String>,
    status: String,
    #[serde(default)]
    tags: Vec<String>,
    created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_used: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    organization_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    account_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    account_structure: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    api_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    api_provider_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    api_provider_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    api_provider_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    login_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    selected_auth_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tier_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    access_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    refresh_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    id_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    openai_api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    quota: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    quota_error: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    credits_total: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    credits_used: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bonus_total: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bonus_used: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    usage_reset_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    raw: Option<Value>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
struct PlatformAccountIndex {
    #[serde(default)]
    accounts: Vec<PlatformAccountRecord>,
    #[serde(default)]
    current_account_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OAuthPendingState {
    login_id: String,
    platform: String,
    created_at: String,
    #[serde(default)]
    callback_url: Option<String>,
    #[serde(default)]
    callback_received_url: Option<String>,
    #[serde(default)]
    auth_url: Option<String>,
    #[serde(default)]
    expected_state: Option<String>,
    #[serde(default)]
    code_verifier: Option<String>,
    #[serde(default)]
    callback_port: Option<u16>,
    #[serde(default)]
    expires_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct OAuthStartResponse {
    login_id: String,
    auth_url: String,
    verification_uri: String,
    verification_uri_complete: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_code: Option<String>,
    callback_url: String,
    expires_in: i64,
    interval_seconds: i64,
}

#[derive(Debug, Clone)]
struct CodexQuotaSnapshot {
    hourly_percentage: i32,
    hourly_reset_time: Option<i64>,
    hourly_window_minutes: Option<i64>,
    weekly_percentage: i32,
    weekly_reset_time: Option<i64>,
    weekly_window_minutes: Option<i64>,
    raw_data: Value,
}

#[derive(Debug, Clone)]
struct CodexQuotaParseResult {
    snapshot: CodexQuotaSnapshot,
    plan_type: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct GeminiLoadStatus {
    project_id: Option<String>,
    tier_id: Option<String>,
    plan_name: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
struct KiroPayloadSnapshot {
    email: String,
    user_id: Option<String>,
    login_provider: Option<String>,
    access_token: String,
    refresh_token: Option<String>,
    token_type: Option<String>,
    expires_at: Option<i64>,
    idc_region: Option<String>,
    issuer_url: Option<String>,
    client_id: Option<String>,
    scopes: Option<String>,
    login_hint: Option<String>,
    plan_name: Option<String>,
    plan_tier: Option<String>,
    credits_total: Option<f64>,
    credits_used: Option<f64>,
    bonus_total: Option<f64>,
    bonus_used: Option<f64>,
    usage_reset_at: Option<i64>,
    bonus_expire_days: Option<i64>,
    auth_token_raw: Value,
    profile_raw: Option<Value>,
    usage_raw: Option<Value>,
    status: Option<String>,
    status_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiTokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    id_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    expires_in: Option<i64>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiUserInfoResponse {
    id: Option<String>,
    email: Option<String>,
    name: Option<String>,
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn create_id(prefix: &str) -> String {
    format!("{}-{}", prefix, Uuid::new_v4())
}

fn generate_token() -> String {
    let left = Uuid::new_v4().simple().to_string();
    let right = Uuid::new_v4().simple().to_string();
    format!("{}{}", left, right)
}

fn generate_code_challenge(code_verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn oauth_timeout_seconds(platform: Platform) -> i64 {
    match platform {
        Platform::Kiro => 600,
        Platform::Codex | Platform::Gemini => 300,
    }
}

fn oauth_callback_path(platform: Platform) -> &'static str {
    match platform {
        Platform::Codex => "/auth/callback",
        Platform::Gemini => "/oauth2callback",
        Platform::Kiro => "/oauth/callback",
    }
}

fn oauth_allowed_callback_paths(platform: Platform) -> &'static [&'static str] {
    match platform {
        Platform::Kiro => &["/oauth/callback", "/signin/callback"],
        Platform::Codex => &["/auth/callback"],
        Platform::Gemini => &["/oauth2callback"],
    }
}

fn find_available_callback_port() -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|err| format!("无法分配 OAuth 本地回调端口: {}", err))?;
    let port = listener
        .local_addr()
        .map_err(|err| format!("无法读取 OAuth 本地回调端口: {}", err))?
        .port();
    drop(listener);
    Ok(port)
}

fn callback_origin(platform: Platform, port: u16) -> String {
    match platform {
        Platform::Codex => format!("http://localhost:{}{}", port, oauth_callback_path(platform)),
        Platform::Gemini => format!("http://127.0.0.1:{}{}", port, oauth_callback_path(platform)),
        Platform::Kiro => format!("http://localhost:{}", port),
    }
}

const GEMINI_OAUTH_CLIENT_ID_ENV: &str = "MULTI_CLI_STUDIO_GEMINI_OAUTH_CLIENT_ID";
const GEMINI_OAUTH_CLIENT_SECRET_ENV: &str = "MULTI_CLI_STUDIO_GEMINI_OAUTH_CLIENT_SECRET";

fn gemini_oauth_client_id() -> Result<String, String> {
    env::var(GEMINI_OAUTH_CLIENT_ID_ENV)
        .map(|value| value.trim().to_string())
        .map_err(|_| {
            format!(
                "Gemini OAuth 未配置。启动桌面应用前请设置环境变量 {}。",
                GEMINI_OAUTH_CLIENT_ID_ENV
            )
        })
        .and_then(|value| {
            if value.is_empty() {
                Err(format!(
                    "Gemini OAuth 未配置。环境变量 {} 不能为空。",
                    GEMINI_OAUTH_CLIENT_ID_ENV
                ))
            } else {
                Ok(value)
            }
        })
}

fn gemini_oauth_client_secret() -> Result<String, String> {
    env::var(GEMINI_OAUTH_CLIENT_SECRET_ENV)
        .map(|value| value.trim().to_string())
        .map_err(|_| {
            format!(
                "Gemini OAuth 未配置。启动桌面应用前请设置环境变量 {}。",
                GEMINI_OAUTH_CLIENT_SECRET_ENV
            )
        })
        .and_then(|value| {
            if value.is_empty() {
                Err(format!(
                    "Gemini OAuth 未配置。环境变量 {} 不能为空。",
                    GEMINI_OAUTH_CLIENT_SECRET_ENV
                ))
            } else {
                Ok(value)
            }
        })
}

fn build_codex_auth_url(redirect_uri: &str, state_token: &str, code_verifier: &str) -> String {
    const CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
    const AUTH_ENDPOINT: &str = "https://auth.openai.com/oauth/authorize";
    const SCOPES: &str = "openid profile email offline_access";
    const ORIGINATOR: &str = "codex_vscode";
    let code_challenge = generate_code_challenge(code_verifier);
    format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&code_challenge={}&code_challenge_method=S256&id_token_add_organizations=true&codex_cli_simplified_flow=true&state={}&originator={}",
        AUTH_ENDPOINT,
        CLIENT_ID,
        urlencoding::encode(redirect_uri),
        urlencoding::encode(SCOPES),
        code_challenge,
        state_token,
        urlencoding::encode(ORIGINATOR)
    )
}

fn build_gemini_auth_url(redirect_uri: &str, state_token: &str) -> Result<String, String> {
    const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
    let client_id = gemini_oauth_client_id()?;
    const SCOPE: &str = "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";
    Ok(format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&access_type=offline&scope={}&state={}",
        AUTH_ENDPOINT,
        urlencoding::encode(&client_id),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(SCOPE),
        urlencoding::encode(state_token)
    ))
}

fn build_kiro_auth_url(redirect_uri: &str, state_token: &str, code_verifier: &str) -> String {
    const AUTH_ENDPOINT: &str = "https://app.kiro.dev/signin";
    let code_challenge = generate_code_challenge(code_verifier);
    format!(
        "{}?state={}&code_challenge={}&code_challenge_method=S256&redirect_uri={}&redirect_from=KiroIDE",
        AUTH_ENDPOINT,
        urlencoding::encode(state_token),
        urlencoding::encode(&code_challenge),
        urlencoding::encode(redirect_uri)
    )
}

fn build_provider_auth_url(
    platform: Platform,
    redirect_uri: &str,
    state_token: &str,
    code_verifier: &str,
) -> Result<String, String> {
    match platform {
        Platform::Codex => Ok(build_codex_auth_url(redirect_uri, state_token, code_verifier)),
        Platform::Gemini => build_gemini_auth_url(redirect_uri, state_token),
        Platform::Kiro => Ok(build_kiro_auth_url(redirect_uri, state_token, code_verifier)),
    }
}

fn open_url_in_default_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", url]);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(url);
        command
    };

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(url);
        command
    };

    command
        .status()
        .map_err(|err| format!("打开默认浏览器失败: {}", err))
        .map(|_| ())
}

fn parse_request_target(request: &str) -> Option<String> {
    let first_line = request.lines().next()?;
    let mut parts = first_line.split_whitespace();
    let _method = parts.next()?;
    let target = parts.next()?;
    Some(target.to_string())
}

fn extract_query_value(target: &str, key: &str) -> Option<String> {
    let query = target.split('?').nth(1)?;
    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        let pair_key = parts.next()?.trim();
        let pair_value = parts.next().unwrap_or("");
        if pair_key == key {
            return Some(
                urlencoding::decode(pair_value)
                    .map(|value| value.into_owned())
                    .unwrap_or_else(|_| pair_value.to_string()),
            );
        }
    }
    None
}

fn write_http_response(stream: &mut std::net::TcpStream, status_line: &str, body: &str) {
    let response = format!(
        "{}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status_line,
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn spawn_oauth_callback_listener(platform: Platform, pending: OAuthPendingState) {
    thread::spawn(move || {
        let Some(port) = pending.callback_port else {
            return;
        };
        let listener = match TcpListener::bind(("127.0.0.1", port)) {
            Ok(listener) => listener,
            Err(_) => return,
        };
        let _ = listener.set_nonblocking(true);
        let started_at = Instant::now();
        let timeout = Duration::from_secs(
            pending
                .expires_at
                .unwrap_or_else(|| Utc::now().timestamp() + oauth_timeout_seconds(platform))
                .saturating_sub(Utc::now().timestamp()) as u64,
        );

        loop {
            match load_oauth_pending(platform) {
                Ok(Some(state)) if state.login_id == pending.login_id => {}
                _ => break,
            }

            if started_at.elapsed() > timeout {
                break;
            }

            match listener.accept() {
                Ok((mut stream, _)) => {
                    let mut buffer = [0u8; 8192];
                    let bytes_read = match stream.read(&mut buffer) {
                        Ok(size) => size,
                        Err(_) => 0,
                    };
                    if bytes_read == 0 {
                        thread::sleep(Duration::from_millis(120));
                        continue;
                    }
                    let request = String::from_utf8_lossy(&buffer[..bytes_read]).into_owned();
                    let Some(target) = parse_request_target(&request) else {
                        write_http_response(
                            &mut stream,
                            "HTTP/1.1 400 Bad Request",
                            "<html><body>Bad Request</body></html>",
                        );
                        continue;
                    };
                    let path = target.split('?').next().unwrap_or("");
                    if !oauth_allowed_callback_paths(platform).contains(&path) {
                        write_http_response(
                            &mut stream,
                            "HTTP/1.1 404 Not Found",
                            "<html><body>Not Found</body></html>",
                        );
                        continue;
                    }

                    let actual_state = extract_query_value(&target, "state");
                    if let Some(expected_state) = pending.expected_state.as_deref() {
                        if let Some(actual_state) = actual_state.as_deref() {
                            if actual_state != expected_state {
                                write_http_response(
                                    &mut stream,
                                    "HTTP/1.1 400 Bad Request",
                                    "<html><body>OAuth state mismatch</body></html>",
                                );
                                continue;
                            }
                        }
                    }

                    let callback_received_url =
                        format!("http://127.0.0.1:{}{}", port, target.trim());
                    if let Ok(Some(mut state)) = load_oauth_pending(platform) {
                        if state.login_id == pending.login_id {
                            state.callback_received_url = Some(callback_received_url);
                            let _ = save_oauth_pending(platform, &state);
                        }
                    }

                    write_http_response(
                        &mut stream,
                        "HTTP/1.1 200 OK",
                        "<html><body style='font-family:sans-serif;padding:40px;text-align:center;'><h1>授权成功</h1><p>可以关闭此窗口并返回应用。</p><script>setTimeout(function(){window.close();},1200);</script></body></html>",
                    );
                    break;
                }
                Err(_) => {
                    thread::sleep(Duration::from_millis(120));
                }
            }
        }
    });
}

fn app_data_dir() -> Result<PathBuf, String> {
    let base = data_local_dir()
        .or_else(home_dir)
        .ok_or_else(|| "Unable to locate a writable app data directory.".to_string())?
        .join("multi-cli-studio")
        .join("platform-accounts");
    fs::create_dir_all(&base).map_err(|err| err.to_string())?;
    Ok(base)
}

fn index_file(platform: Platform) -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join(format!("{}-accounts.json", platform.as_str())))
}

fn oauth_file(platform: Platform) -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join(format!("{}-oauth-pending.json", platform.as_str())))
}

fn load_index(platform: Platform) -> Result<PlatformAccountIndex, String> {
    let path = index_file(platform)?;
    if !path.exists() {
        return Ok(PlatformAccountIndex::default());
    }

    let raw = fs::read_to_string(&path).map_err(|err| err.to_string())?;
    let mut index =
        serde_json::from_str::<PlatformAccountIndex>(&raw).map_err(|err| err.to_string())?;
    if index.current_account_id.is_none() {
        index.current_account_id = index.accounts.first().map(|account| account.id.clone());
    }
    Ok(index)
}

fn save_index(
    platform: Platform,
    mut index: PlatformAccountIndex,
) -> Result<PlatformAccountIndex, String> {
    if index.current_account_id.is_none() {
        index.current_account_id = index.accounts.first().map(|account| account.id.clone());
    }
    if let Some(current_id) = index.current_account_id.clone() {
        if !index
            .accounts
            .iter()
            .any(|account| account.id == current_id)
        {
            index.current_account_id = index.accounts.first().map(|account| account.id.clone());
        }
    }

    let path = index_file(platform)?;
    let raw = serde_json::to_string_pretty(&index).map_err(|err| err.to_string())?;
    fs::write(path, raw).map_err(|err| err.to_string())?;
    Ok(index)
}

fn load_oauth_pending(platform: Platform) -> Result<Option<OAuthPendingState>, String> {
    let path = oauth_file(platform)?;
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    let pending = serde_json::from_str::<OAuthPendingState>(&raw).map_err(|err| err.to_string())?;
    Ok(Some(pending))
}

fn save_oauth_pending(platform: Platform, pending: &OAuthPendingState) -> Result<(), String> {
    let path = oauth_file(platform)?;
    let raw = serde_json::to_string_pretty(pending).map_err(|err| err.to_string())?;
    fs::write(path, raw).map_err(|err| err.to_string())
}

fn clear_oauth_pending(platform: Platform) -> Result<(), String> {
    let path = oauth_file(platform)?;
    if path.exists() {
        fs::remove_file(path).map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn json_object(value: &Value) -> Option<&serde_json::Map<String, Value>> {
    value.as_object()
}

fn string_field(object: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        object.get(*key).and_then(|value| match value {
            Value::String(text) => {
                let trimmed = text.trim();
                (!trimmed.is_empty()).then(|| trimmed.to_string())
            }
            Value::Number(number) => Some(number.to_string()),
            _ => None,
        })
    })
}

fn value_field(object: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<Value> {
    keys.iter().find_map(|key| object.get(*key).cloned())
}

fn clone_object_value(value: Option<&Value>) -> Option<Value> {
    value.filter(|item| item.is_object()).cloned()
}

fn is_non_empty_json_value(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::String(text) => !text.trim().is_empty(),
        Value::Array(items) => !items.is_empty(),
        Value::Object(object) => !object.is_empty(),
        _ => true,
    }
}

fn number_field(object: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<f64> {
    keys.iter().find_map(|key| match object.get(*key) {
        Some(Value::Number(number)) => number.as_f64(),
        Some(Value::String(text)) => text.trim().parse::<f64>().ok(),
        _ => None,
    })
}

fn nested_string_field(
    object: &serde_json::Map<String, Value>,
    parent_keys: &[&str],
    keys: &[&str],
) -> Option<String> {
    parent_keys.iter().find_map(|parent_key| {
        object
            .get(*parent_key)
            .and_then(json_object)
            .and_then(|child| string_field(child, keys))
    })
}

fn array_of_strings(object: &serde_json::Map<String, Value>, keys: &[&str]) -> Vec<String> {
    keys.iter()
        .find_map(|key| {
            object.get(*key).and_then(|value| {
                value.as_array().map(|items| {
                    items
                        .iter()
                        .filter_map(|item| item.as_str().map(str::trim))
                        .filter(|item| !item.is_empty())
                        .map(ToString::to_string)
                        .collect::<Vec<_>>()
                })
            })
        })
        .unwrap_or_default()
}

fn normalize_auth_mode(platform: Platform, raw: Option<String>, has_api_key: bool) -> String {
    if has_api_key {
        return "apiKey".to_string();
    }

    let normalized = raw.unwrap_or_default().trim().to_ascii_lowercase();
    if normalized.contains("api") {
        return "apiKey".to_string();
    }
    if normalized.contains("oauth") {
        return "oauth".to_string();
    }
    if normalized == "token" {
        return "token".to_string();
    }

    match platform {
        Platform::Codex => "token".to_string(),
        Platform::Gemini | Platform::Kiro => "token".to_string(),
    }
}

fn normalize_status(raw: Option<String>) -> String {
    match raw.unwrap_or_default().trim().to_ascii_lowercase().as_str() {
        "warning" => "warning".to_string(),
        "error" => "error".to_string(),
        _ => "active".to_string(),
    }
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut normalized = Vec::new();
    for tag in tags {
        let trimmed = tag.trim();
        if trimmed.is_empty() {
            continue;
        }
        if normalized.iter().any(|item| item == trimmed) {
            continue;
        }
        normalized.push(trimmed.to_string());
    }
    normalized
}

fn normalize_non_empty(value: Option<&str>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    })
}

fn parse_timestamp_value(value: Option<&Value>) -> Option<i64> {
    let value = value?;
    if let Some(raw) = value.as_i64() {
        return Some(if raw > 10_000_000_000 {
            raw / 1000
        } else {
            raw
        });
    }
    if let Some(raw) = value.as_u64() {
        let raw = raw as i64;
        return Some(if raw > 10_000_000_000 {
            raw / 1000
        } else {
            raw
        });
    }
    if let Some(raw) = value.as_f64() {
        if raw.is_finite() {
            let raw = raw.round() as i64;
            return Some(if raw > 10_000_000_000 {
                raw / 1000
            } else {
                raw
            });
        }
    }
    if let Some(raw) = value.as_str() {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return None;
        }
        if let Ok(parsed) = trimmed.parse::<i64>() {
            return Some(if parsed > 10_000_000_000 {
                parsed / 1000
            } else {
                parsed
            });
        }
        if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(trimmed) {
            return Some(parsed.timestamp());
        }
    }
    None
}

fn decode_jwt_claims(token: &str) -> Option<Value> {
    let payload = token.split('.').nth(1)?;
    let padded = match payload.len() % 4 {
        2 => format!("{}==", payload),
        3 => format!("{}=", payload),
        _ => payload.to_string(),
    };
    let bytes = URL_SAFE_NO_PAD.decode(padded).ok()?;
    serde_json::from_slice::<Value>(&bytes).ok()
}

fn jwt_claim_string(token: &str, keys: &[&str]) -> Option<String> {
    let claims = decode_jwt_claims(token)?;
    let object = claims.as_object()?;
    string_field(object, keys)
}

fn normalize_window_minutes(seconds: Option<i64>) -> Option<i64> {
    let seconds = seconds?;
    (seconds > 0).then_some((seconds + 59) / 60)
}

fn parse_codex_usage_payload(value: &Value) -> Result<CodexQuotaParseResult, String> {
    let object = value
        .as_object()
        .ok_or_else(|| "Codex usage payload 必须是对象".to_string())?;
    let plan_type = string_field(object, &["plan_type"]);
    let rate_limit = object.get("rate_limit").and_then(Value::as_object);
    let primary_window = rate_limit
        .and_then(|value| value.get("primary_window"))
        .and_then(Value::as_object);
    let secondary_window = rate_limit
        .and_then(|value| value.get("secondary_window"))
        .and_then(Value::as_object);

    let hourly_used = primary_window
        .and_then(|value| number_field(value, &["used_percent"]))
        .unwrap_or(0.0)
        .round() as i32;
    let weekly_used = secondary_window
        .and_then(|value| number_field(value, &["used_percent"]))
        .unwrap_or(0.0)
        .round() as i32;

    let hourly_reset_time = primary_window
        .and_then(|value| parse_timestamp_value(value.get("reset_at")))
        .or_else(|| {
            primary_window.and_then(|value| {
                number_field(value, &["reset_after_seconds"])
                    .map(|seconds| Utc::now().timestamp() + seconds.round() as i64)
            })
        });
    let weekly_reset_time = secondary_window
        .and_then(|value| parse_timestamp_value(value.get("reset_at")))
        .or_else(|| {
            secondary_window.and_then(|value| {
                number_field(value, &["reset_after_seconds"])
                    .map(|seconds| Utc::now().timestamp() + seconds.round() as i64)
            })
        });

    Ok(CodexQuotaParseResult {
        snapshot: CodexQuotaSnapshot {
            hourly_percentage: (100 - hourly_used).clamp(0, 100),
            hourly_reset_time,
            hourly_window_minutes: primary_window
                .and_then(|value| number_field(value, &["limit_window_seconds"]))
                .map(|value| value.round() as i64)
                .and_then(|value| normalize_window_minutes(Some(value))),
            weekly_percentage: (100 - weekly_used).clamp(0, 100),
            weekly_reset_time,
            weekly_window_minutes: secondary_window
                .and_then(|value| number_field(value, &["limit_window_seconds"]))
                .map(|value| value.round() as i64)
                .and_then(|value| normalize_window_minutes(Some(value))),
            raw_data: value.clone(),
        },
        plan_type,
    })
}

fn parse_gemini_load_code_assist_status(value: &Value) -> GeminiLoadStatus {
    let project_id = value
        .get("cloudaicompanionProject")
        .and_then(|project| match project {
            Value::String(raw) => normalize_non_empty(Some(raw)),
            Value::Object(obj) => string_field(obj, &["projectId", "id"]),
            _ => None,
        });

    let paid_tier = value.get("paidTier").and_then(Value::as_object);
    let current_tier = value.get("currentTier").and_then(Value::as_object);
    let allowed_tiers = value.get("allowedTiers").and_then(Value::as_array);
    let ineligible_tier = value
        .get("ineligibleTiers")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(Value::as_object);

    let tier_id = paid_tier
        .and_then(|value| string_field(value, &["id"]))
        .or_else(|| current_tier.and_then(|value| string_field(value, &["id"])))
        .or_else(|| ineligible_tier.and_then(|value| string_field(value, &["tierId"])))
        .or_else(|| {
            allowed_tiers.and_then(|items| {
                items.iter().filter_map(Value::as_object).find_map(|value| {
                    value
                        .get("isDefault")
                        .and_then(Value::as_bool)
                        .filter(|is_default| *is_default)
                        .and_then(|_| string_field(value, &["id"]))
                })
            })
        })
        .or_else(|| {
            allowed_tiers.and_then(|items| {
                items
                    .iter()
                    .filter_map(Value::as_object)
                    .find_map(|value| string_field(value, &["id"]))
            })
        });

    let plan_name = paid_tier
        .and_then(|value| string_field(value, &["name"]))
        .or_else(|| current_tier.and_then(|value| string_field(value, &["name"])))
        .or_else(|| tier_id.clone());

    GeminiLoadStatus {
        project_id,
        tier_id,
        plan_name,
    }
}

fn days_until_timestamp(timestamp: Option<i64>) -> Option<i64> {
    let timestamp = timestamp?;
    let diff = timestamp - Utc::now().timestamp();
    (diff >= 0).then_some((diff + 86_399) / 86_400)
}

fn get_path_value<'a>(root: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = root;
    for key in path {
        current = match current {
            Value::Object(map) => map.get(*key)?,
            Value::Array(items) => {
                let index = key.parse::<usize>().ok()?;
                items.get(index)?
            }
            _ => return None,
        };
    }
    Some(current)
}

fn pick_string_value(root: Option<&Value>, paths: &[&[&str]]) -> Option<String> {
    let root = root?;
    for path in paths {
        if let Some(value) = get_path_value(root, path) {
            if let Some(text) = value.as_str() {
                if let Some(normalized) = normalize_non_empty(Some(text)) {
                    return Some(normalized);
                }
            }
            if let Some(number) = value.as_i64() {
                return Some(number.to_string());
            }
            if let Some(number) = value.as_u64() {
                return Some(number.to_string());
            }
        }
    }
    None
}

fn pick_number_value(root: Option<&Value>, paths: &[&[&str]]) -> Option<f64> {
    let root = root?;
    for path in paths {
        if let Some(value) = get_path_value(root, path) {
            if let Some(number) = value.as_f64() {
                if number.is_finite() {
                    return Some(number);
                }
            }
            if let Some(text) = value.as_str() {
                if let Ok(number) = text.trim().parse::<f64>() {
                    if number.is_finite() {
                        return Some(number);
                    }
                }
            }
        }
    }
    None
}

fn extract_kiro_usage_fields(
    usage: Option<&Value>,
) -> (
    Option<String>,
    Option<String>,
    Option<f64>,
    Option<f64>,
    Option<f64>,
    Option<f64>,
    Option<i64>,
    Option<i64>,
) {
    let usage_breakdown = usage
        .and_then(|value| get_path_value(value, &["usageBreakdownList"]))
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .or_else(|| usage.and_then(|value| get_path_value(value, &["usageBreakdowns"])));

    let free_trial = usage_breakdown.and_then(|value| {
        get_path_value(value, &["freeTrialInfo"])
            .or_else(|| get_path_value(value, &["freeTrialUsage"]))
    });

    let plan_name = pick_string_value(
        usage_breakdown,
        &[
            &["displayName"],
            &["displayNamePlural"],
            &["type"],
            &["unit"],
        ],
    );
    let plan_tier = pick_string_value(usage_breakdown, &[&["currency"], &["type"], &["unit"]]);
    let credits_total = pick_number_value(
        usage_breakdown,
        &[
            &["usageLimitWithPrecision"],
            &["usageLimit"],
            &["limit"],
            &["total"],
            &["totalCredits"],
        ],
    );
    let credits_used = pick_number_value(
        usage_breakdown,
        &[
            &["currentUsageWithPrecision"],
            &["currentUsage"],
            &["used"],
            &["usedCredits"],
        ],
    );
    let bonus_total = pick_number_value(
        free_trial,
        &[
            &["usageLimitWithPrecision"],
            &["usageLimit"],
            &["limit"],
            &["total"],
            &["totalCredits"],
        ],
    );
    let bonus_used = pick_number_value(
        free_trial,
        &[
            &["currentUsageWithPrecision"],
            &["currentUsage"],
            &["used"],
            &["usedCredits"],
        ],
    );

    let usage_reset_at = usage
        .and_then(|value| {
            parse_timestamp_value(
                get_path_value(value, &["resetAt"])
                    .or_else(|| get_path_value(value, &["resetTime"]))
                    .or_else(|| get_path_value(value, &["resetOn"]))
                    .or_else(|| get_path_value(value, &["nextDateReset"])),
            )
        })
        .or_else(|| {
            parse_timestamp_value(
                usage_breakdown
                    .and_then(|value| get_path_value(value, &["resetDate"]))
                    .or_else(|| {
                        usage_breakdown.and_then(|value| get_path_value(value, &["resetAt"]))
                    }),
            )
        });

    let bonus_expire_days = pick_number_value(
        free_trial,
        &[&["daysRemaining"], &["expiryDays"], &["expireDays"]],
    )
    .map(|value| value.round() as i64)
    .or_else(|| {
        days_until_timestamp(parse_timestamp_value(
            free_trial.and_then(|value| get_path_value(value, &["expiryDate"])),
        ))
    });

    (
        plan_name,
        plan_tier,
        credits_total,
        credits_used,
        bonus_total,
        bonus_used,
        usage_reset_at,
        bonus_expire_days,
    )
}

fn build_kiro_payload_from_snapshot(
    auth_token: Value,
    profile: Option<Value>,
    usage: Option<Value>,
) -> Result<KiroPayloadSnapshot, String> {
    let access_token = pick_string_value(
        Some(&auth_token),
        &[
            &["accessToken"],
            &["access_token"],
            &["token"],
            &["idToken"],
            &["id_token"],
            &["accessTokenJwt"],
        ],
    )
    .ok_or_else(|| "Kiro 本地授权信息缺少 access token".to_string())?;
    let refresh_token = pick_string_value(
        Some(&auth_token),
        &[&["refreshToken"], &["refresh_token"], &["refreshTokenJwt"]],
    );
    let token_type = pick_string_value(
        Some(&auth_token),
        &[&["tokenType"], &["token_type"], &["authType"]],
    )
    .or_else(|| Some("Bearer".to_string()));
    let expires_at = parse_timestamp_value(
        get_path_value(&auth_token, &["expiresAt"])
            .or_else(|| get_path_value(&auth_token, &["expires_at"]))
            .or_else(|| get_path_value(&auth_token, &["expiry"]))
            .or_else(|| get_path_value(&auth_token, &["expiration"])),
    );

    let id_token_claims = pick_string_value(
        Some(&auth_token),
        &[&["idToken"], &["id_token"], &["idTokenJwt"]],
    )
    .and_then(|value| decode_jwt_claims(&value));
    let access_token_claims = decode_jwt_claims(&access_token);

    let email = pick_string_value(
        profile.as_ref(),
        &[&["email"], &["user", "email"], &["account", "email"]],
    )
    .or_else(|| pick_string_value(Some(&auth_token), &[&["email"], &["userEmail"]]))
    .or_else(|| {
        pick_string_value(
            id_token_claims.as_ref(),
            &[&["email"], &["upn"], &["preferred_username"]],
        )
    })
    .or_else(|| {
        pick_string_value(
            access_token_claims.as_ref(),
            &[&["email"], &["upn"], &["preferred_username"]],
        )
    })
    .or_else(|| pick_string_value(Some(&auth_token), &[&["login_hint"], &["loginHint"]]))
    .unwrap_or_default();
    let user_id = pick_string_value(
        profile.as_ref(),
        &[&["userId"], &["user_id"], &["id"], &["sub"]],
    )
    .or_else(|| pick_string_value(Some(&auth_token), &[&["userId"], &["user_id"], &["sub"]]))
    .or_else(|| pick_string_value(id_token_claims.as_ref(), &[&["sub"]]))
    .or_else(|| pick_string_value(access_token_claims.as_ref(), &[&["sub"]]));
    let login_provider = pick_string_value(
        usage.as_ref(),
        &[
            &["userInfo", "provider", "label"],
            &["userInfo", "provider", "name"],
            &["provider", "label"],
            &["provider", "name"],
        ],
    )
    .or_else(|| {
        pick_string_value(
            profile.as_ref(),
            &[
                &["loginProvider"],
                &["provider"],
                &["authProvider"],
                &["signedInWith"],
            ],
        )
    })
    .or_else(|| {
        pick_string_value(
            Some(&auth_token),
            &[&["login_option"], &["provider"], &["loginProvider"]],
        )
    })
    .map(|value| match value.to_ascii_lowercase().as_str() {
        "google" => "Google".to_string(),
        "github" => "Github".to_string(),
        _ => value,
    });
    let idc_region = pick_string_value(
        Some(&auth_token),
        &[&["idc_region"], &["idcRegion"], &["region"]],
    );
    let issuer_url = pick_string_value(
        Some(&auth_token),
        &[&["issuer_url"], &["issuerUrl"], &["issuer"]],
    );
    let client_id = pick_string_value(Some(&auth_token), &[&["client_id"], &["clientId"]]);
    let scopes = pick_string_value(Some(&auth_token), &[&["scopes"], &["scope"]]);
    let login_hint = pick_string_value(Some(&auth_token), &[&["login_hint"], &["loginHint"]])
        .or_else(|| normalize_non_empty(Some(email.as_str())));

    let (
        plan_name,
        plan_tier,
        credits_total,
        credits_used,
        bonus_total,
        bonus_used,
        usage_reset_at,
        bonus_expire_days,
    ) = extract_kiro_usage_fields(usage.as_ref());

    Ok(KiroPayloadSnapshot {
        email,
        user_id,
        login_provider,
        access_token,
        refresh_token,
        token_type,
        expires_at,
        idc_region,
        issuer_url,
        client_id,
        scopes,
        login_hint,
        plan_name,
        plan_tier,
        credits_total,
        credits_used,
        bonus_total,
        bonus_used,
        usage_reset_at,
        bonus_expire_days,
        auth_token_raw: auth_token,
        profile_raw: profile,
        usage_raw: usage,
        status: None,
        status_reason: None,
    })
}

fn merge_account(index: &mut PlatformAccountIndex, account: PlatformAccountRecord) {
    index.accounts.retain(|item| item.id != account.id);
    index.accounts.insert(0, account.clone());
    index.current_account_id = Some(account.id);
}

fn account_from_value(platform: Platform, value: Value) -> Option<PlatformAccountRecord> {
    let object = json_object(&value)?;

    let openai_api_key = string_field(
        object,
        &["openai_api_key", "api_key", "apiKey", "OPENAI_API_KEY"],
    );
    let access_token = string_field(object, &["access_token", "accessToken"])
        .or_else(|| nested_string_field(object, &["tokens"], &["access_token", "accessToken"]));
    let refresh_token = string_field(object, &["refresh_token", "refreshToken"])
        .or_else(|| nested_string_field(object, &["tokens"], &["refresh_token", "refreshToken"]));
    let id_token = string_field(object, &["id_token", "idToken"])
        .or_else(|| nested_string_field(object, &["tokens"], &["id_token", "idToken"]));
    let id = string_field(object, &["id", "account_id", "auth_id"])
        .or_else(|| nested_string_field(object, &["tokens"], &["account_id"]))
        .unwrap_or_else(|| create_id(&format!("{}-account", platform.as_str())));

    let email = string_field(object, &["email", "github_email"])
        .or_else(|| nested_string_field(object, &["user", "profile"], &["email", "mail", "name"]))
        .or_else(|| string_field(object, &["name", "login_provider"]))
        .unwrap_or_else(|| format!("{}@{}.local", id, platform.as_str()));

    let created_at = string_field(object, &["created_at", "createdAt"]).unwrap_or_else(now_iso);
    let last_used = string_field(object, &["last_used", "lastUsedAt", "last_used_at"]);
    let display_name = string_field(
        object,
        &["display_name", "displayName", "account_name", "name"],
    )
    .or_else(|| nested_string_field(object, &["profile", "user"], &["name", "display_name"]));
    let plan_name = string_field(object, &["plan_name", "plan", "tier_id", "plan_tier"]);
    let plan_type = string_field(object, &["plan_type"]);
    let api_base_url = string_field(
        object,
        &[
            "api_base_url",
            "apiBaseUrl",
            "base_url",
            "baseUrl",
            "OPENAI_BASE_URL",
        ],
    );
    let api_provider_mode = string_field(object, &["api_provider_mode", "apiProviderMode"]);
    let api_provider_id = string_field(object, &["api_provider_id", "apiProviderId"]);
    let api_provider_name = string_field(object, &["api_provider_name", "apiProviderName"]);
    let login_provider = string_field(object, &["login_provider", "selected_auth_type"]);
    let selected_auth_type = string_field(object, &["selected_auth_type", "selectedAuthType"]);
    let user_id = string_field(object, &["user_id", "userId"]);
    let account_id = string_field(object, &["account_id", "accountId"]);
    let organization_id = string_field(object, &["organization_id", "organizationId"]);
    let account_name = string_field(object, &["account_name", "accountName"]);
    let account_structure = string_field(object, &["account_structure", "accountStructure"]);
    let project_id = string_field(object, &["project_id", "projectId"]);
    let tier_id = string_field(object, &["tier_id", "tierId"]);
    let quota = value_field(object, &["quota", "quota_raw", "raw_data"]);
    let quota_error = value_field(object, &["quota_error", "quotaError"]);
    let credits_total = number_field(object, &["credits_total", "prompt_credits_total"]);
    let credits_used = number_field(object, &["credits_used", "prompt_credits_used"]);
    let bonus_total = number_field(object, &["bonus_total"]);
    let bonus_used = number_field(object, &["bonus_used"]);
    let usage_reset_at = string_field(object, &["usage_reset_at"]);
    let detail = string_field(object, &["detail"])
        .or_else(|| api_provider_name.clone())
        .or_else(|| api_base_url.clone())
        .or_else(|| plan_name.clone())
        .or_else(|| login_provider.clone());
    let tags = normalize_tags(array_of_strings(object, &["tags"]));
    let auth_mode = normalize_auth_mode(
        platform,
        string_field(object, &["auth_mode", "authMode", "selected_auth_type"]),
        openai_api_key.is_some(),
    );
    let status = normalize_status(string_field(object, &["status"]));

    Some(PlatformAccountRecord {
        id,
        email,
        display_name,
        auth_mode,
        plan_name,
        plan_type,
        status,
        tags,
        created_at,
        last_used,
        user_id,
        account_id,
        organization_id,
        account_name,
        account_structure,
        api_base_url,
        api_provider_mode,
        api_provider_id,
        api_provider_name,
        login_provider,
        selected_auth_type,
        project_id,
        tier_id,
        access_token,
        refresh_token,
        id_token,
        openai_api_key,
        quota,
        quota_error,
        credits_total,
        credits_used,
        bonus_total,
        bonus_used,
        usage_reset_at,
        detail,
        raw: Some(value),
    })
}

fn account_from_api_key(api_key: String, api_base_url: Option<String>) -> PlatformAccountRecord {
    let timestamp = now_iso();
    PlatformAccountRecord {
        id: create_id("codex-account"),
        email: format!("manual-{}@codex.local", Uuid::new_v4().simple()),
        display_name: Some("Codex API Key".to_string()),
        auth_mode: "apiKey".to_string(),
        plan_name: None,
        plan_type: None,
        status: "active".to_string(),
        tags: Vec::new(),
        created_at: timestamp.clone(),
        last_used: Some(timestamp),
        user_id: None,
        account_id: None,
        organization_id: None,
        account_name: None,
        account_structure: None,
        api_base_url: api_base_url.clone(),
        api_provider_mode: None,
        api_provider_id: None,
        api_provider_name: None,
        login_provider: Some("api-key".to_string()),
        selected_auth_type: None,
        project_id: None,
        tier_id: None,
        access_token: None,
        refresh_token: None,
        id_token: None,
        openai_api_key: Some(api_key),
        quota: None,
        quota_error: None,
        credits_total: None,
        credits_used: None,
        bonus_total: None,
        bonus_used: None,
        usage_reset_at: None,
        detail: api_base_url.or_else(|| Some("OpenAI API Key".to_string())),
        raw: None,
    }
}

fn delete_accounts(platform: Platform, account_ids: &[String]) -> Result<(), String> {
    let mut index = load_index(platform)?;
    index
        .accounts
        .retain(|account| !account_ids.contains(&account.id));
    save_index(platform, index)?;
    Ok(())
}

fn update_tags(
    platform: Platform,
    account_id: &str,
    tags: Vec<String>,
) -> Result<PlatformAccountRecord, String> {
    let mut index = load_index(platform)?;
    let normalized_tags = normalize_tags(tags);
    let mut updated = None;

    for account in &mut index.accounts {
        if account.id == account_id {
            account.tags = normalized_tags.clone();
            updated = Some(account.clone());
            break;
        }
    }

    let updated = updated.ok_or_else(|| format!("Account not found: {}", account_id))?;
    save_index(platform, index)?;
    Ok(updated)
}

fn update_codex_api_key_credentials_record(
    account_id: &str,
    api_key: &str,
    api_base_url: Option<String>,
    api_provider_mode: Option<String>,
    api_provider_id: Option<String>,
    api_provider_name: Option<String>,
) -> Result<PlatformAccountRecord, String> {
    let normalized_api_key = api_key.trim().to_string();
    if normalized_api_key.is_empty() {
        return Err("API Key 不能为空。".to_string());
    }

    let normalized_api_base_url = api_base_url.and_then(|value| {
        let trimmed = value.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    });
    let normalized_provider_mode = api_provider_mode
        .and_then(|value| {
            let trimmed = value.trim().to_ascii_lowercase();
            (!trimmed.is_empty()).then_some(trimmed)
        })
        .or_else(|| {
            normalized_api_base_url.as_ref().map(|base_url| {
                if base_url.contains("api.openai.com") {
                    "openai_builtin".to_string()
                } else {
                    "custom".to_string()
                }
            })
        })
        .or_else(|| Some("openai_builtin".to_string()));
    let normalized_provider_id = api_provider_id.and_then(|value| {
        let trimmed = value.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    });
    let normalized_provider_name = api_provider_name.and_then(|value| {
        let trimmed = value.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    });

    let mut index = load_index(Platform::Codex)?;
    let mut updated = None;
    let now = now_iso();

    for account in &mut index.accounts {
        if account.id != account_id {
            continue;
        }
        if account.auth_mode != "apiKey" && account.openai_api_key.is_none() {
            return Err("仅 API Key 账号支持快速切换供应商。".to_string());
        }

        account.auth_mode = "apiKey".to_string();
        account.openai_api_key = Some(normalized_api_key.clone());
        account.api_base_url = normalized_api_base_url.clone();
        account.api_provider_mode = normalized_provider_mode.clone();
        account.api_provider_id = normalized_provider_id.clone();
        account.api_provider_name = normalized_provider_name.clone();
        account.login_provider = Some("api-key".to_string());
        account.selected_auth_type = Some("apiKey".to_string());
        account.detail = normalized_provider_name
            .clone()
            .or_else(|| normalized_api_base_url.clone())
            .or_else(|| Some("OpenAI API Key".to_string()));
        account.last_used = Some(now.clone());
        updated = Some(account.clone());
        break;
    }

    let updated = updated.ok_or_else(|| format!("Account not found: {}", account_id))?;
    save_index(Platform::Codex, index)?;
    Ok(updated)
}

fn set_current(platform: Platform, account_id: &str) -> Result<PlatformAccountRecord, String> {
    let mut index = load_index(platform)?;
    let account = index
        .accounts
        .iter()
        .find(|account| account.id == account_id)
        .cloned()
        .ok_or_else(|| format!("Account not found: {}", account_id))?;
    index.current_account_id = Some(account_id.to_string());
    save_index(platform, index)?;
    Ok(account)
}

fn export_accounts(platform: Platform, account_ids: &[String]) -> Result<String, String> {
    let index = load_index(platform)?;
    let filtered: Vec<_> = if account_ids.is_empty() {
        index.accounts
    } else {
        index
            .accounts
            .into_iter()
            .filter(|account| account_ids.contains(&account.id))
            .collect()
    };
    serde_json::to_string_pretty(&filtered).map_err(|err| err.to_string())
}

fn current_account(platform: Platform) -> Result<Option<PlatformAccountRecord>, String> {
    let index = load_index(platform)?;
    Ok(index.current_account_id.and_then(|current_id| {
        index
            .accounts
            .into_iter()
            .find(|account| account.id == current_id)
    }))
}

fn pick_kiro_import_usage(raw: &Value) -> Option<Value> {
    let object = raw.as_object()?;
    for key in ["usage", "usageData", "usage_data", "kiro_usage_raw"] {
        if let Some(value) = object.get(key).cloned() {
            if value.is_object() || value.is_array() {
                return Some(value);
            }
        }
    }
    None
}

fn pick_kiro_import_profile(raw: &Value) -> Option<Value> {
    let object = raw.as_object()?;
    for key in ["profile", "profileData", "profile_data", "kiro_profile_raw"] {
        if let Some(value) = clone_object_value(object.get(key)) {
            return Some(value);
        }
    }

    let mut profile = serde_json::Map::new();
    for key in ["profileArn", "profile_arn", "arn"] {
        if let Some(value) = object
            .get(key)
            .filter(|value| is_non_empty_json_value(value))
        {
            profile.insert("arn".to_string(), value.clone());
            break;
        }
    }
    for key in ["provider", "loginProvider"] {
        if let Some(value) = object
            .get(key)
            .filter(|value| is_non_empty_json_value(value))
        {
            profile.insert("name".to_string(), value.clone());
            break;
        }
    }
    for key in ["email", "userEmail"] {
        if let Some(value) = object
            .get(key)
            .filter(|value| is_non_empty_json_value(value))
        {
            profile.insert("email".to_string(), value.clone());
            break;
        }
    }

    if profile.is_empty() {
        None
    } else {
        Some(Value::Object(profile))
    }
}

fn build_kiro_import_auth_token(raw: &Value) -> Result<Value, String> {
    let raw_object = raw
        .as_object()
        .ok_or_else(|| "Kiro 导入 JSON 必须是对象".to_string())?;
    let base = clone_object_value(raw_object.get("kiro_auth_token_raw"))
        .or_else(|| clone_object_value(raw_object.get("authToken")))
        .or_else(|| clone_object_value(raw_object.get("token")))
        .or_else(|| clone_object_value(raw_object.get("auth")))
        .unwrap_or_else(|| raw.clone());
    let mut auth_object = match base {
        Value::Object(object) => object,
        _ => serde_json::Map::new(),
    };

    for key in [
        "accessToken",
        "access_token",
        "token",
        "idToken",
        "id_token",
        "refreshToken",
        "refresh_token",
        "expiresAt",
        "expires_at",
        "expiry",
        "expiration",
        "email",
        "userEmail",
        "userId",
        "user_id",
        "provider",
        "loginProvider",
        "authMethod",
        "login_option",
        "profileArn",
        "profile_arn",
        "arn",
        "login_hint",
        "loginHint",
        "idc_region",
        "idcRegion",
        "region",
        "issuer_url",
        "issuerUrl",
        "issuer",
        "client_id",
        "clientId",
        "client_secret",
        "clientSecret",
        "scope",
        "scopes",
        "startUrl",
        "start_url",
    ] {
        if auth_object.contains_key(key) {
            continue;
        }
        if let Some(value) = raw_object
            .get(key)
            .filter(|value| is_non_empty_json_value(value))
        {
            auth_object.insert(key.to_string(), value.clone());
        }
    }
    Ok(Value::Object(auth_object))
}

fn kiro_account_from_import_value(raw: Value) -> Result<PlatformAccountRecord, String> {
    if !raw.is_object() {
        return Err("Kiro 导入 JSON 必须是对象".to_string());
    }
    let usage = pick_kiro_import_usage(&raw);
    let profile = pick_kiro_import_profile(&raw);
    let auth_token = build_kiro_import_auth_token(&raw)?;
    let snapshot = build_kiro_payload_from_snapshot(auth_token, profile, usage)?;
    Ok(build_kiro_record(snapshot, None))
}

fn import_kiro_accounts_from_json(
    json_content: &str,
) -> Result<Vec<PlatformAccountRecord>, String> {
    let parsed = serde_json::from_str::<Value>(json_content).map_err(|err| err.to_string())?;
    let values = match parsed {
        Value::Array(items) => items,
        value => vec![value],
    };
    if values.is_empty() {
        return Err("导入数组为空".to_string());
    }

    let mut imported = Vec::with_capacity(values.len());
    for (index, value) in values.into_iter().enumerate() {
        let account = kiro_account_from_import_value(value)
            .map_err(|error| format!("第 {} 条 Kiro 账号解析失败: {}", index + 1, error))?;
        imported.push(account);
    }

    let mut account_index = load_index(Platform::Kiro)?;
    for account in &imported {
        merge_account(&mut account_index, account.clone());
    }
    save_index(Platform::Kiro, account_index)?;
    Ok(imported)
}

fn import_accounts_from_json(
    platform: Platform,
    json_content: &str,
) -> Result<Vec<PlatformAccountRecord>, String> {
    let parsed = serde_json::from_str::<Value>(json_content).map_err(|err| err.to_string())?;
    let values = match parsed {
        Value::Array(items) => items,
        value => vec![value],
    };

    let imported: Vec<_> = values
        .into_iter()
        .filter_map(|value| account_from_value(platform, value))
        .collect();
    if imported.is_empty() {
        return Err("JSON 中没有可导入的账号对象。".to_string());
    }

    let mut index = load_index(platform)?;
    for account in &imported {
        merge_account(&mut index, account.clone());
    }
    save_index(platform, index)?;
    Ok(imported)
}

fn hash_identity(prefix: &str, parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part.as_bytes());
        hasher.update([0u8]);
    }
    let digest = hasher.finalize();
    let mut suffix = String::new();
    for byte in digest.iter().take(8) {
        suffix.push_str(format!("{:02x}", byte).as_str());
    }
    format!("{}-{}", prefix, suffix)
}

fn timestamp_to_iso(value: Option<i64>) -> Option<String> {
    value
        .and_then(|timestamp| chrono::DateTime::<Utc>::from_timestamp(timestamp, 0))
        .map(|value| value.to_rfc3339())
}

fn build_quota_error_value(message: &str) -> Value {
    json!({
        "message": message,
        "timestamp": now_iso()
    })
}

fn upsert_platform_account(
    platform: Platform,
    account: PlatformAccountRecord,
) -> Result<PlatformAccountRecord, String> {
    let mut index = load_index(platform)?;
    merge_account(&mut index, account.clone());
    save_index(platform, index)?;
    Ok(account)
}

fn lookup_account(platform: Platform, account_id: &str) -> Result<PlatformAccountRecord, String> {
    load_index(platform)?
        .accounts
        .into_iter()
        .find(|account| account.id == account_id)
        .ok_or_else(|| format!("Account not found: {}", account_id))
}

fn oauth_callback_url(
    platform: Platform,
    login_id: &str,
) -> Result<(OAuthPendingState, String), String> {
    let pending = load_oauth_pending(platform)?
        .ok_or_else(|| format!("No pending {} OAuth login found.", platform.label()))?;
    if pending.login_id != login_id {
        return Err(format!(
            "Unknown {} OAuth login id: {}",
            platform.label(),
            login_id
        ));
    }

    let timeout_at = pending
        .expires_at
        .unwrap_or_else(|| Utc::now().timestamp() + oauth_timeout_seconds(platform));
    let started_at = Instant::now();
    let mut callback_received_url = pending.callback_received_url.clone();

    while callback_received_url.is_none() && Utc::now().timestamp() < timeout_at {
        thread::sleep(Duration::from_millis(250));
        match load_oauth_pending(platform)? {
            Some(state) if state.login_id == login_id => {
                callback_received_url = state.callback_received_url;
            }
            Some(_) => {
                return Err(format!(
                    "{} OAuth 流程已被新的登录请求替换。",
                    platform.label()
                ));
            }
            None => {
                return Err(format!("{} OAuth 已取消。", platform.label()));
            }
        }
        if started_at.elapsed() > Duration::from_secs(oauth_timeout_seconds(platform) as u64) {
            break;
        }
    }

    if callback_received_url.is_none() {
        return Err(format!(
            "{} OAuth 仍未收到本地回调，请完成浏览器授权后重试。",
            platform.label()
        ));
    }

    Ok((pending, callback_received_url.unwrap_or_default()))
}

fn codex_account_id_from_access_token(access_token: &str) -> Option<String> {
    let claims = decode_jwt_claims(access_token)?;
    let auth = claims.get("https://api.openai.com/auth")?.as_object()?;
    string_field(
        auth,
        &[
            "chatgpt_account_id",
            "account_id",
            "chatgptAccountId",
            "workspace_id",
        ],
    )
}

fn codex_org_id_from_access_token(access_token: &str) -> Option<String> {
    let claims = decode_jwt_claims(access_token)?;
    let auth = claims.get("https://api.openai.com/auth")?.as_object()?;
    string_field(
        auth,
        &[
            "organization_id",
            "chatgpt_organization_id",
            "chatgpt_org_id",
            "org_id",
        ],
    )
}

fn codex_user_id_from_id_token(id_token: &str) -> Option<String> {
    let claims = decode_jwt_claims(id_token)?;
    let auth = claims.get("https://api.openai.com/auth")?.as_object()?;
    string_field(auth, &["chatgpt_user_id", "user_id"])
}

fn codex_plan_type_from_id_token(id_token: &str) -> Option<String> {
    let claims = decode_jwt_claims(id_token)?;
    let auth = claims.get("https://api.openai.com/auth")?.as_object()?;
    string_field(auth, &["chatgpt_plan_type", "plan_type"])
}

async fn exchange_codex_oauth_code(
    code: &str,
    code_verifier: &str,
    callback_port: u16,
) -> Result<(String, String, Option<String>, Value), String> {
    let response = reqwest::Client::new()
        .post("https://auth.openai.com/oauth/token")
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            (
                "redirect_uri",
                format!(
                    "http://localhost:{}{}",
                    callback_port,
                    oauth_callback_path(Platform::Codex)
                )
                .as_str(),
            ),
            ("client_id", "app_EMoamEEZ73f0CkXaXp7hrann"),
            ("code_verifier", code_verifier),
        ])
        .send()
        .await
        .map_err(|err| format!("Codex token exchange 失败: {}", err))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|err| format!("读取 Codex token exchange 响应失败: {}", err))?;
    if !status.is_success() {
        return Err(format!(
            "Codex token exchange 返回异常: status={}, body_len={}",
            status,
            body.len()
        ));
    }
    let payload = serde_json::from_str::<Value>(&body)
        .map_err(|err| format!("解析 Codex token exchange 响应失败: {}", err))?;
    let object = payload
        .as_object()
        .ok_or_else(|| "Codex token exchange 响应不是对象".to_string())?;
    let id_token = string_field(object, &["id_token"])
        .ok_or_else(|| "Codex token exchange 响应缺少 id_token".to_string())?;
    let access_token = string_field(object, &["access_token"])
        .ok_or_else(|| "Codex token exchange 响应缺少 access_token".to_string())?;
    let refresh_token = string_field(object, &["refresh_token"]);
    Ok((id_token, access_token, refresh_token, payload))
}

async fn refresh_codex_tokens(
    refresh_token: &str,
    current_id_token: Option<&str>,
) -> Result<(String, String, Option<String>, Value), String> {
    let response = reqwest::Client::new()
        .post("https://auth.openai.com/oauth/token")
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", "app_EMoamEEZ73f0CkXaXp7hrann"),
        ])
        .send()
        .await
        .map_err(|err| format!("Codex token refresh 失败: {}", err))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|err| format!("读取 Codex token refresh 响应失败: {}", err))?;
    if !status.is_success() {
        return Err(format!(
            "Codex token refresh 返回异常: status={}, body_len={}",
            status,
            body.len()
        ));
    }
    let payload = serde_json::from_str::<Value>(&body)
        .map_err(|err| format!("解析 Codex token refresh 响应失败: {}", err))?;
    let object = payload
        .as_object()
        .ok_or_else(|| "Codex token refresh 响应不是对象".to_string())?;
    let id_token = string_field(object, &["id_token"])
        .or_else(|| current_id_token.and_then(|value| normalize_non_empty(Some(value))))
        .ok_or_else(|| "Codex token refresh 响应缺少 id_token".to_string())?;
    let access_token = string_field(object, &["access_token"])
        .ok_or_else(|| "Codex token refresh 响应缺少 access_token".to_string())?;
    let next_refresh_token =
        string_field(object, &["refresh_token"]).or_else(|| Some(refresh_token.to_string()));
    Ok((id_token, access_token, next_refresh_token, payload))
}

async fn fetch_codex_remote_profile(
    access_token: &str,
    account_id: Option<&str>,
) -> Result<(Option<String>, Option<String>, Option<String>, Value), String> {
    let mut request = reqwest::Client::new()
        .get("https://chatgpt.com/backend-api/wham/accounts/check")
        .header(AUTHORIZATION, format!("Bearer {}", access_token))
        .header(ACCEPT, "application/json");
    if let Some(account_id) = account_id.and_then(|value| normalize_non_empty(Some(value))) {
        request = request.header("ChatGPT-Account-Id", account_id);
    }
    let response = request
        .send()
        .await
        .map_err(|err| format!("Codex profile 请求失败: {}", err))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|err| format!("读取 Codex profile 响应失败: {}", err))?;
    if !status.is_success() {
        return Err(format!(
            "Codex profile 接口返回错误 {}，body_len={}",
            status,
            body.len()
        ));
    }
    let payload = serde_json::from_str::<Value>(&body)
        .map_err(|err| format!("解析 Codex profile 响应失败: {}", err))?;
    let record = payload
        .get("account")
        .or_else(|| payload.get("data"))
        .or_else(|| payload.get("record"))
        .unwrap_or(&payload);
    let name = pick_string_value(
        Some(record),
        &[
            &["name"],
            &["display_name"],
            &["account_name"],
            &["organization_name"],
        ],
    );
    let structure = pick_string_value(
        Some(record),
        &[&["structure"], &["account_structure"], &["kind"], &["type"]],
    );
    let remote_account_id = pick_string_value(
        Some(record),
        &[
            &["id"],
            &["account_id"],
            &["chatgpt_account_id"],
            &["workspace_id"],
        ],
    );
    Ok((name, structure, remote_account_id, payload))
}

async fn fetch_codex_quota_snapshot(
    access_token: &str,
    account_id: Option<&str>,
) -> Result<CodexQuotaParseResult, String> {
    let mut request = reqwest::Client::new()
        .get("https://chatgpt.com/backend-api/wham/usage")
        .header(AUTHORIZATION, format!("Bearer {}", access_token))
        .header(ACCEPT, "application/json");
    if let Some(account_id) = account_id.and_then(|value| normalize_non_empty(Some(value))) {
        request = request.header("ChatGPT-Account-Id", account_id);
    }
    let response = request
        .send()
        .await
        .map_err(|err| format!("Codex quota 请求失败: {}", err))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|err| format!("读取 Codex quota 响应失败: {}", err))?;
    if !status.is_success() {
        return Err(format!("API 返回错误 {} [body_len:{}]", status, body.len()));
    }
    let payload = serde_json::from_str::<Value>(&body)
        .map_err(|err| format!("解析 Codex quota 失败: {}", err))?;
    parse_codex_usage_payload(&payload)
}

fn codex_quota_to_value(snapshot: &CodexQuotaSnapshot) -> Value {
    json!({
        "hourlyPercentage": snapshot.hourly_percentage,
        "hourlyResetTime": timestamp_to_iso(snapshot.hourly_reset_time),
        "weeklyPercentage": snapshot.weekly_percentage,
        "weeklyResetTime": timestamp_to_iso(snapshot.weekly_reset_time),
        "hourlyWindowMinutes": snapshot.hourly_window_minutes,
        "weeklyWindowMinutes": snapshot.weekly_window_minutes,
        "rawData": snapshot.raw_data.clone()
    })
}

fn build_codex_record(
    id_token: String,
    access_token: String,
    refresh_token: Option<String>,
    profile: Option<(Option<String>, Option<String>, Option<String>, Value)>,
    quota: Option<CodexQuotaParseResult>,
    quota_error: Option<String>,
    token_raw: Option<Value>,
    existing: Option<PlatformAccountRecord>,
) -> PlatformAccountRecord {
    let email = jwt_claim_string(&id_token, &["email"])
        .or_else(|| existing.as_ref().map(|value| value.email.clone()))
        .unwrap_or_else(|| format!("codex-{}@oauth.local", Uuid::new_v4().simple()));
    let account_id = profile
        .as_ref()
        .and_then(|value| value.2.clone())
        .or_else(|| codex_account_id_from_access_token(&access_token))
        .or_else(|| existing.as_ref().and_then(|value| value.account_id.clone()));
    let organization_id = codex_org_id_from_access_token(&access_token).or_else(|| {
        existing
            .as_ref()
            .and_then(|value| value.organization_id.clone())
    });
    let storage_id = existing
        .as_ref()
        .map(|value| value.id.clone())
        .unwrap_or_else(|| {
            hash_identity(
                "codex-account",
                &[
                    email.as_str(),
                    account_id.as_deref().unwrap_or(""),
                    organization_id.as_deref().unwrap_or(""),
                ],
            )
        });
    let plan_type = quota
        .as_ref()
        .and_then(|value| value.plan_type.clone())
        .or_else(|| codex_plan_type_from_id_token(&id_token))
        .or_else(|| existing.as_ref().and_then(|value| value.plan_type.clone()));
    let account_name = profile
        .as_ref()
        .and_then(|value| value.0.clone())
        .or_else(|| {
            existing
                .as_ref()
                .and_then(|value| value.account_name.clone())
        });
    let account_structure = profile
        .as_ref()
        .and_then(|value| value.1.clone())
        .or_else(|| {
            existing
                .as_ref()
                .and_then(|value| value.account_structure.clone())
        });
    let quota_error_value = quota_error.as_deref().map(build_quota_error_value);
    let status = if quota_error_value.is_some() {
        "warning".to_string()
    } else {
        "active".to_string()
    };
    let created_at = existing
        .as_ref()
        .map(|value| value.created_at.clone())
        .unwrap_or_else(now_iso);
    let tags = existing
        .as_ref()
        .map(|value| value.tags.clone())
        .unwrap_or_default();
    let detail = account_structure.clone().or_else(|| account_name.clone());
    let raw = json!({
        "oauth": token_raw,
        "profile": profile.as_ref().map(|value| value.3.clone()),
        "quota": quota.as_ref().map(|value| value.snapshot.raw_data.clone())
    });

    PlatformAccountRecord {
        id: storage_id,
        email,
        display_name: existing
            .as_ref()
            .and_then(|value| value.display_name.clone())
            .or_else(|| jwt_claim_string(&id_token, &["name"]))
            .or_else(|| account_name.clone()),
        auth_mode: "oauth".to_string(),
        plan_name: account_name.clone().or_else(|| plan_type.clone()),
        plan_type,
        status,
        tags,
        created_at,
        last_used: Some(now_iso()),
        user_id: codex_user_id_from_id_token(&id_token),
        account_id,
        organization_id,
        account_name,
        account_structure,
        api_base_url: None,
        api_provider_mode: Some("openai_builtin".to_string()),
        api_provider_id: None,
        api_provider_name: Some("OpenAI".to_string()),
        login_provider: Some("oauth".to_string()),
        selected_auth_type: Some("oauth".to_string()),
        project_id: None,
        tier_id: None,
        access_token: Some(access_token),
        refresh_token,
        id_token: Some(id_token),
        openai_api_key: None,
        quota: quota
            .as_ref()
            .map(|value| codex_quota_to_value(&value.snapshot)),
        quota_error: quota_error_value,
        credits_total: None,
        credits_used: None,
        bonus_total: None,
        bonus_used: None,
        usage_reset_at: None,
        detail,
        raw: Some(raw),
    }
}

async fn complete_codex_oauth(
    pending: &OAuthPendingState,
    callback_url: &str,
) -> Result<PlatformAccountRecord, String> {
    let code = extract_query_value(callback_url, "code")
        .ok_or_else(|| "Codex OAuth 回调缺少 code 参数".to_string())?;
    let code_verifier = pending
        .code_verifier
        .as_deref()
        .ok_or_else(|| "Codex OAuth 缺少 code_verifier".to_string())?;
    let callback_port = pending
        .callback_port
        .ok_or_else(|| "Codex OAuth 缺少 callback port".to_string())?;
    let (id_token, mut access_token, mut refresh_token, token_raw) =
        exchange_codex_oauth_code(&code, code_verifier, callback_port).await?;
    let mut account_id = codex_account_id_from_access_token(&access_token);
    let mut profile = fetch_codex_remote_profile(&access_token, account_id.as_deref())
        .await
        .ok();
    if account_id.is_none() {
        account_id = profile.as_ref().and_then(|value| value.2.clone());
    }
    let mut quota = fetch_codex_quota_snapshot(&access_token, account_id.as_deref())
        .await
        .ok();
    let mut quota_error = None;
    if quota.is_none() {
        if let Some(refresh) = refresh_token.as_deref() {
            if let Ok((next_id_token, next_access_token, next_refresh_token, _)) =
                refresh_codex_tokens(refresh, Some(id_token.as_str())).await
            {
                access_token = next_access_token;
                refresh_token = next_refresh_token;
                let _ = next_id_token;
                profile = fetch_codex_remote_profile(&access_token, account_id.as_deref())
                    .await
                    .ok();
                quota = fetch_codex_quota_snapshot(&access_token, account_id.as_deref())
                    .await
                    .ok();
            }
        }
        if quota.is_none() {
            quota_error = Some("Codex quota 拉取失败".to_string());
        }
    }
    Ok(build_codex_record(
        id_token,
        access_token,
        refresh_token,
        profile,
        quota,
        quota_error,
        Some(token_raw),
        None,
    ))
}

async fn exchange_gemini_oauth_code(
    code: &str,
    redirect_uri: &str,
) -> Result<GeminiTokenResponse, String> {
    let client_id = gemini_oauth_client_id()?;
    let client_secret = gemini_oauth_client_secret()?;
    let response = reqwest::Client::new()
        .post("https://oauth2.googleapis.com/token")
        .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
        .form(&[
            ("code", code),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|err| format!("Gemini token exchange 失败: {}", err))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "Google OAuth token 交换失败: status={}, body_len={}",
            status,
            body.len()
        ));
    }
    let payload = response
        .json::<GeminiTokenResponse>()
        .await
        .map_err(|err| format!("解析 Google OAuth token 响应失败: {}", err))?;
    if payload.access_token.is_none() {
        return Err(format!(
            "Google OAuth token 响应缺少 access_token: error={:?}, desc={:?}",
            payload.error, payload.error_description
        ));
    }
    Ok(payload)
}

async fn refresh_gemini_access_token(refresh_token: &str) -> Result<GeminiTokenResponse, String> {
    let client_id = gemini_oauth_client_id()?;
    let client_secret = gemini_oauth_client_secret()?;
    let response = reqwest::Client::new()
        .post("https://oauth2.googleapis.com/token")
        .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|err| format!("Gemini token refresh 失败: {}", err))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "刷新 Gemini access_token 失败: status={}, body_len={}",
            status,
            body.len()
        ));
    }
    let payload = response
        .json::<GeminiTokenResponse>()
        .await
        .map_err(|err| format!("解析 Gemini token refresh 响应失败: {}", err))?;
    if payload.access_token.is_none() {
        return Err("Gemini token refresh 响应缺少 access_token".to_string());
    }
    Ok(payload)
}

async fn fetch_gemini_userinfo(access_token: &str) -> Option<GeminiUserInfoResponse> {
    let response = reqwest::Client::new()
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .header(AUTHORIZATION, format!("Bearer {}", access_token))
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    response.json::<GeminiUserInfoResponse>().await.ok()
}

async fn post_gemini_json(
    access_token: &str,
    endpoint: &str,
    payload: &Value,
) -> Result<Value, String> {
    let response = reqwest::Client::new()
        .post(endpoint)
        .header(AUTHORIZATION, format!("Bearer {}", access_token))
        .header(CONTENT_TYPE, "application/json")
        .json(payload)
        .send()
        .await
        .map_err(|err| format!("Gemini 请求失败: {}", err))?;
    if response.status().as_u16() == 401 {
        return Err("UNAUTHORIZED: Gemini access_token 已失效".to_string());
    }
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!(
            "请求 Gemini 接口失败: status={}, body_len={}",
            status,
            body.len()
        ));
    }
    serde_json::from_str::<Value>(&body).map_err(|err| format!("解析 Gemini 接口响应失败: {}", err))
}

async fn load_gemini_status(access_token: &str) -> Result<(GeminiLoadStatus, Value), String> {
    let payload = json!({
        "metadata": {
            "ideType": "IDE_UNSPECIFIED",
            "platform": "PLATFORM_UNSPECIFIED",
            "pluginType": "GEMINI"
        }
    });
    let value = post_gemini_json(
        access_token,
        "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
        &payload,
    )
    .await?;
    Ok((parse_gemini_load_code_assist_status(&value), value))
}

async fn load_gemini_quota(access_token: &str, project_id: &str) -> Result<Value, String> {
    post_gemini_json(
        access_token,
        "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota",
        &json!({ "project": project_id }),
    )
    .await
}

fn build_gemini_record(
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    expiry_date: Option<i64>,
    userinfo: Option<GeminiUserInfoResponse>,
    load_status: GeminiLoadStatus,
    load_status_raw: Option<Value>,
    quota_raw: Option<Value>,
    quota_error: Option<String>,
    existing: Option<PlatformAccountRecord>,
) -> PlatformAccountRecord {
    let email = userinfo
        .as_ref()
        .and_then(|value| value.email.clone())
        .or_else(|| {
            id_token
                .as_deref()
                .and_then(|value| jwt_claim_string(value, &["email"]))
        })
        .or_else(|| existing.as_ref().map(|value| value.email.clone()))
        .unwrap_or_else(|| format!("gemini-{}@oauth.local", Uuid::new_v4().simple()));
    let auth_id = userinfo
        .as_ref()
        .and_then(|value| value.id.clone())
        .or_else(|| {
            id_token
                .as_deref()
                .and_then(|value| jwt_claim_string(value, &["sub"]))
        })
        .or_else(|| existing.as_ref().and_then(|value| value.user_id.clone()));
    let name = userinfo
        .as_ref()
        .and_then(|value| value.name.clone())
        .or_else(|| {
            id_token
                .as_deref()
                .and_then(|value| jwt_claim_string(value, &["name"]))
        })
        .or_else(|| {
            existing
                .as_ref()
                .and_then(|value| value.display_name.clone())
        });
    let storage_id = existing
        .as_ref()
        .map(|value| value.id.clone())
        .unwrap_or_else(|| {
            hash_identity(
                "gemini-account",
                &[email.as_str(), auth_id.as_deref().unwrap_or("")],
            )
        });
    let status = if quota_error.is_some() {
        "warning"
    } else {
        "active"
    }
    .to_string();
    let created_at = existing
        .as_ref()
        .map(|value| value.created_at.clone())
        .unwrap_or_else(now_iso);
    let tags = existing
        .as_ref()
        .map(|value| value.tags.clone())
        .unwrap_or_default();
    let raw = json!({
        "gemini_auth_raw": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "id_token": id_token,
            "token_type": token_type,
            "scope": scope,
            "expiry_date": expiry_date
        },
        "load_status": load_status_raw,
        "gemini_usage_raw": quota_raw
    });
    PlatformAccountRecord {
        id: storage_id,
        email,
        display_name: name,
        auth_mode: "oauth".to_string(),
        plan_name: load_status.plan_name.clone(),
        plan_type: load_status.tier_id.clone(),
        status,
        tags,
        created_at,
        last_used: Some(now_iso()),
        user_id: auth_id,
        account_id: None,
        organization_id: None,
        account_name: None,
        account_structure: None,
        api_base_url: None,
        api_provider_mode: None,
        api_provider_id: None,
        api_provider_name: Some("Google".to_string()),
        login_provider: Some("oauth".to_string()),
        selected_auth_type: Some("oauth-personal".to_string()),
        project_id: load_status.project_id,
        tier_id: load_status.tier_id,
        access_token: raw
            .get("gemini_auth_raw")
            .and_then(Value::as_object)
            .and_then(|value| string_field(value, &["access_token"])),
        refresh_token: raw
            .get("gemini_auth_raw")
            .and_then(Value::as_object)
            .and_then(|value| string_field(value, &["refresh_token"])),
        id_token: raw
            .get("gemini_auth_raw")
            .and_then(Value::as_object)
            .and_then(|value| string_field(value, &["id_token"])),
        openai_api_key: None,
        quota: None,
        quota_error: quota_error.as_deref().map(build_quota_error_value),
        credits_total: None,
        credits_used: None,
        bonus_total: None,
        bonus_used: None,
        usage_reset_at: expiry_date.and_then(|value| timestamp_to_iso(Some(value / 1000))),
        detail: load_status.plan_name.clone(),
        raw: Some(raw),
    }
}

async fn complete_gemini_oauth(
    pending: &OAuthPendingState,
    callback_url: &str,
) -> Result<PlatformAccountRecord, String> {
    let code = extract_query_value(callback_url, "code")
        .ok_or_else(|| "Google OAuth 回调缺少 code 参数".to_string())?;
    let redirect_uri = pending
        .callback_url
        .as_deref()
        .ok_or_else(|| "Gemini OAuth 缺少 callback_url".to_string())?;
    let token = exchange_gemini_oauth_code(&code, redirect_uri).await?;
    let access_token = token
        .access_token
        .clone()
        .ok_or_else(|| "Google OAuth token 响应缺少 access_token".to_string())?;
    let userinfo = fetch_gemini_userinfo(&access_token).await;
    let (load_status, load_status_raw) = load_gemini_status(&access_token).await?;
    let quota_raw = if let Some(project_id) = load_status.project_id.as_deref() {
        load_gemini_quota(&access_token, project_id).await.ok()
    } else {
        None
    };
    Ok(build_gemini_record(
        access_token,
        token.refresh_token.clone(),
        token.id_token.clone(),
        token.token_type.clone(),
        token.scope.clone(),
        token
            .expires_in
            .map(|value| Utc::now().timestamp_millis() + value * 1000),
        userinfo,
        load_status,
        Some(load_status_raw),
        quota_raw,
        None,
        None,
    ))
}

fn callback_path_from_url(callback_url: &str) -> Option<String> {
    if callback_url.starts_with('/') {
        return Some(
            callback_url
                .split('?')
                .next()
                .unwrap_or(callback_url)
                .to_string(),
        );
    }
    let after_scheme = callback_url.split("://").nth(1).unwrap_or(callback_url);
    let slash_index = after_scheme.find('/')?;
    Some(
        after_scheme[slash_index..]
            .split('?')
            .next()
            .unwrap_or("")
            .to_string(),
    )
}

#[derive(Debug, Clone)]
struct KiroOAuthCallbackContext {
    login_option: String,
    issuer_url: Option<String>,
    idc_region: Option<String>,
    client_id: Option<String>,
    scopes: Option<String>,
    login_hint: Option<String>,
    audience: Option<String>,
}

fn normalize_ascii_lower(value: Option<&str>) -> Option<String> {
    normalize_non_empty(value).map(|raw| raw.to_ascii_lowercase())
}

fn provider_from_kiro_login_option(login_option: &str) -> Option<String> {
    match login_option.trim().to_ascii_lowercase().as_str() {
        "google" => Some("Google".to_string()),
        "github" => Some("Github".to_string()),
        _ => None,
    }
}

fn ensure_kiro_expires_at_from_expires_in(token: &mut Value) {
    let Some(object) = token.as_object_mut() else {
        return;
    };
    if object.contains_key("expiresAt") || object.contains_key("expires_at") {
        return;
    }

    let expires_in = object
        .get("expiresIn")
        .or_else(|| object.get("expires_in"))
        .and_then(|value| match value {
            Value::Number(number) => number
                .as_i64()
                .or_else(|| number.as_u64().map(|raw| raw as i64)),
            Value::String(text) => text.trim().parse::<i64>().ok(),
            _ => None,
        })
        .unwrap_or(0);
    if expires_in <= 0 {
        return;
    }

    object.insert(
        "expiresAt".to_string(),
        Value::String((Utc::now() + chrono::Duration::seconds(expires_in)).to_rfc3339()),
    );
}

fn extract_kiro_oauth_code_and_redirect_uri(
    pending: &OAuthPendingState,
    callback_url: &str,
) -> Result<(String, String, KiroOAuthCallbackContext), String> {
    let base_callback_url = pending
        .callback_url
        .as_deref()
        .ok_or_else(|| "Kiro OAuth 缺少 callback_url".to_string())?;
    let callback_path =
        callback_path_from_url(callback_url).ok_or_else(|| "Kiro 回调路径无效".to_string())?;
    if !oauth_allowed_callback_paths(Platform::Kiro).contains(&callback_path.as_str()) {
        return Err("Kiro 回调路径无效".to_string());
    }

    let login_option = extract_query_value(callback_url, "login_option")
        .or_else(|| extract_query_value(callback_url, "loginOption"))
        .unwrap_or_else(|| "google".to_string())
        .trim()
        .to_ascii_lowercase();
    let code = extract_query_value(callback_url, "code");
    if code.is_none() {
        let reason = match login_option.as_str() {
            "builderid" | "awsidc" | "internal" => {
                "当前登录方式需要 Kiro 客户端后续认证流程，暂不支持直接导入，请改用 Google/GitHub 登录。"
            }
            "external_idp" => {
                "当前登录方式为 External IdP，未返回授权 code，暂不支持自动导入。"
            }
            _ => "Kiro 回调缺少 code，无法完成登录。",
        };
        return Err(reason.to_string());
    }

    let redirect_uri = format!(
        "{}{}?login_option={}",
        base_callback_url.trim_end_matches('/'),
        callback_path,
        urlencoding::encode(login_option.as_str())
    );
    Ok((
        code.unwrap_or_default(),
        redirect_uri,
        KiroOAuthCallbackContext {
            login_option,
            issuer_url: extract_query_value(callback_url, "issuer_url")
                .or_else(|| extract_query_value(callback_url, "issuerUrl")),
            idc_region: extract_query_value(callback_url, "idc_region")
                .or_else(|| extract_query_value(callback_url, "idcRegion")),
            client_id: extract_query_value(callback_url, "client_id")
                .or_else(|| extract_query_value(callback_url, "clientId")),
            scopes: extract_query_value(callback_url, "scopes")
                .or_else(|| extract_query_value(callback_url, "scope")),
            login_hint: extract_query_value(callback_url, "login_hint")
                .or_else(|| extract_query_value(callback_url, "loginHint")),
            audience: extract_query_value(callback_url, "audience"),
        },
    ))
}

fn inject_kiro_callback_context_into_auth_token(
    token: &mut Value,
    context: &KiroOAuthCallbackContext,
) {
    if !token.is_object() {
        *token = json!({});
    }
    let Some(object) = token.as_object_mut() else {
        return;
    };

    if !context.login_option.trim().is_empty() {
        object
            .entry("login_option".to_string())
            .or_insert_with(|| Value::String(context.login_option.clone()));
    }
    if let Some(provider) = provider_from_kiro_login_option(&context.login_option) {
        object
            .entry("provider".to_string())
            .or_insert_with(|| Value::String(provider.clone()));
        object
            .entry("loginProvider".to_string())
            .or_insert_with(|| Value::String(provider));
        object
            .entry("authMethod".to_string())
            .or_insert_with(|| Value::String("social".to_string()));
    }
    if let Some(value) = context.issuer_url.as_ref() {
        object
            .entry("issuer_url".to_string())
            .or_insert_with(|| Value::String(value.clone()));
    }
    if let Some(value) = context.idc_region.as_ref() {
        object
            .entry("idc_region".to_string())
            .or_insert_with(|| Value::String(value.clone()));
    }
    if let Some(value) = context.client_id.as_ref() {
        object
            .entry("client_id".to_string())
            .or_insert_with(|| Value::String(value.clone()));
    }
    if let Some(value) = context.scopes.as_ref() {
        object
            .entry("scopes".to_string())
            .or_insert_with(|| Value::String(value.clone()));
    }
    if let Some(value) = context.login_hint.as_ref() {
        object
            .entry("login_hint".to_string())
            .or_insert_with(|| Value::String(value.clone()));
    }
    if let Some(value) = context.audience.as_ref() {
        object
            .entry("audience".to_string())
            .or_insert_with(|| Value::String(value.clone()));
    }
    ensure_kiro_expires_at_from_expires_in(token);
}

async fn exchange_kiro_oauth_code(
    code: &str,
    code_verifier: &str,
    redirect_uri: &str,
) -> Result<Value, String> {
    let response = reqwest::Client::new()
        .post("https://prod.us-east-1.auth.desktop.kiro.dev/oauth/token")
        .header(CONTENT_TYPE, "application/json")
        .json(&json!({
            "code": code,
            "code_verifier": code_verifier,
            "redirect_uri": redirect_uri
        }))
        .send()
        .await
        .map_err(|err| format!("请求 Kiro oauth/token 接口失败: {}", err))?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!(
            "Kiro oauth/token 接口返回异常: status={}, body_len={}",
            status,
            body.len()
        ));
    }
    let payload = serde_json::from_str::<Value>(&body)
        .map_err(|err| format!("解析 Kiro token 响应失败: {}", err))?;
    if let Some(data) = payload.get("data").filter(|value| value.is_object()) {
        Ok(data.clone())
    } else {
        Ok(payload)
    }
}

async fn refresh_kiro_auth_token(refresh_token: &str) -> Result<Value, String> {
    let response = reqwest::Client::new()
        .post("https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken")
        .header(CONTENT_TYPE, "application/json")
        .json(&json!({ "refreshToken": refresh_token }))
        .send()
        .await
        .map_err(|err| format!("请求 Kiro refreshToken 接口失败: {}", err))?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!(
            "Kiro refreshToken 接口返回异常: status={}, body_len={}",
            status,
            body.len()
        ));
    }
    let payload = serde_json::from_str::<Value>(&body)
        .map_err(|err| format!("解析 Kiro refresh 响应失败: {}", err))?;
    if let Some(data) = payload.get("data").filter(|value| value.is_object()) {
        Ok(data.clone())
    } else {
        Ok(payload)
    }
}

fn parse_kiro_profile_arn_region(profile_arn: &str) -> Option<String> {
    profile_arn
        .split(':')
        .nth(3)
        .and_then(|value| normalize_non_empty(Some(value)))
}

fn resolve_kiro_idc_region(auth_token: &Value, existing: &PlatformAccountRecord) -> Option<String> {
    pick_string_value(
        Some(auth_token),
        &[&["idc_region"], &["idcRegion"], &["region"]],
    )
    .and_then(|value| normalize_non_empty(Some(value.as_str())))
    .or_else(|| {
        pick_string_value(
            existing.raw.as_ref(),
            &[
                &["kiro_auth_token_raw", "idc_region"],
                &["kiro_auth_token_raw", "idcRegion"],
            ],
        )
        .and_then(|value| normalize_non_empty(Some(value.as_str())))
    })
    .or_else(|| {
        pick_string_value(
            existing.raw.as_ref(),
            &[
                &["kiro_profile_raw", "arn"],
                &["kiro_auth_token_raw", "profileArn"],
            ],
        )
        .and_then(|profile_arn| parse_kiro_profile_arn_region(profile_arn.as_str()))
    })
}

fn resolve_kiro_idc_client_id(
    auth_token: &Value,
    existing: &PlatformAccountRecord,
) -> Option<String> {
    pick_string_value(
        Some(auth_token),
        &[
            &["client_id"],
            &["clientId"],
            &["clientRegistration", "clientId"],
            &["registration", "clientId"],
            &["oidcClient", "clientId"],
        ],
    )
    .and_then(|value| normalize_non_empty(Some(value.as_str())))
    .or_else(|| {
        pick_string_value(
            existing.raw.as_ref(),
            &[
                &["kiro_auth_token_raw", "client_id"],
                &["kiro_auth_token_raw", "clientId"],
                &["kiro_auth_token_raw", "clientRegistration", "clientId"],
            ],
        )
        .and_then(|value| normalize_non_empty(Some(value.as_str())))
    })
}

fn resolve_kiro_idc_client_secret(auth_token: &Value) -> Option<String> {
    pick_string_value(
        Some(auth_token),
        &[
            &["client_secret"],
            &["clientSecret"],
            &["clientRegistration", "clientSecret"],
            &["clientRegistration", "client_secret"],
            &["registration", "clientSecret"],
            &["oidcClient", "clientSecret"],
        ],
    )
    .and_then(|value| normalize_non_empty(Some(value.as_str())))
}

fn should_prefer_kiro_idc_refresh(auth_token: &Value, existing: &PlatformAccountRecord) -> bool {
    let auth_method_is_idc = normalize_ascii_lower(
        pick_string_value(Some(auth_token), &[&["authMethod"], &["auth_method"]]).as_deref(),
    )
    .map(|value| value == "idc")
    .unwrap_or(false);

    let provider_is_idc = normalize_ascii_lower(
        pick_string_value(
            Some(auth_token),
            &[&["provider"], &["loginProvider"], &["login_option"]],
        )
        .as_deref(),
    )
    .map(|value| {
        matches!(
            value.as_str(),
            "enterprise" | "builderid" | "internal" | "awsidc" | "external_idp"
        )
    })
    .unwrap_or(false);

    let login_provider_is_idc = normalize_ascii_lower(existing.login_provider.as_deref())
        .map(|value| {
            matches!(
                value.as_str(),
                "enterprise" | "builderid" | "internal" | "awsidc" | "external_idp"
            )
        })
        .unwrap_or(false);

    let has_idc_material = resolve_kiro_idc_region(auth_token, existing).is_some()
        && resolve_kiro_idc_client_id(auth_token, existing).is_some()
        && resolve_kiro_idc_client_secret(auth_token).is_some();

    auth_method_is_idc || provider_is_idc || login_provider_is_idc || has_idc_material
}

fn merge_kiro_account_context_into_auth_token(
    auth_token: &mut Value,
    existing: &PlatformAccountRecord,
) {
    if !auth_token.is_object() {
        *auth_token = json!({});
    }
    let Some(target) = auth_token.as_object_mut() else {
        return;
    };
    if let Some(source) = existing
        .raw
        .as_ref()
        .and_then(|raw| raw.get("kiro_auth_token_raw"))
        .and_then(Value::as_object)
    {
        for (key, value) in source {
            target.entry(key.clone()).or_insert_with(|| value.clone());
        }
    }
    if let Some(refresh_token) = existing.refresh_token.as_ref() {
        target
            .entry("refreshToken".to_string())
            .or_insert_with(|| Value::String(refresh_token.clone()));
    }
    if let Some(login_provider) = existing.login_provider.as_ref() {
        target
            .entry("provider".to_string())
            .or_insert_with(|| Value::String(login_provider.clone()));
        target
            .entry("loginProvider".to_string())
            .or_insert_with(|| Value::String(login_provider.clone()));
    }
    if let Some(profile_arn) = pick_string_value(
        existing.raw.as_ref(),
        &[
            &["kiro_profile_raw", "arn"],
            &["kiro_auth_token_raw", "profileArn"],
        ],
    ) {
        target
            .entry("profileArn".to_string())
            .or_insert_with(|| Value::String(profile_arn));
    }
}

async fn refresh_kiro_auth_token_via_idc_oidc(
    refresh_token: &str,
    auth_token: &Value,
    existing: &PlatformAccountRecord,
) -> Result<Value, String> {
    let region = resolve_kiro_idc_region(auth_token, existing)
        .ok_or_else(|| "缺少 idc_region，无法执行 AWS IAM Identity Center 刷新".to_string())?;
    let client_id = resolve_kiro_idc_client_id(auth_token, existing)
        .ok_or_else(|| "缺少 client_id，无法执行 AWS IAM Identity Center 刷新".to_string())?;
    let client_secret = resolve_kiro_idc_client_secret(auth_token)
        .ok_or_else(|| "缺少 client_secret，无法执行 AWS IAM Identity Center 刷新".to_string())?;

    let response = reqwest::Client::new()
        .post(format!("https://oidc.{}.amazonaws.com/token", region))
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
        ])
        .send()
        .await
        .map_err(|err| format!("请求 AWS IAM Identity Center OIDC 刷新接口失败: {}", err))?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!(
            "AWS IAM Identity Center OIDC 刷新接口返回异常: status={}, body_len={}",
            status,
            body.len()
        ));
    }

    let mut payload = serde_json::from_str::<Value>(&body)
        .map_err(|err| format!("解析 AWS IAM Identity Center OIDC 刷新响应失败: {}", err))?;
    if let Some(data) = payload.get("data").filter(|value| value.is_object()) {
        payload = data.clone();
    }
    if !payload.is_object() {
        payload = json!({});
    }
    if let Some(object) = payload.as_object_mut() {
        object
            .entry("refreshToken".to_string())
            .or_insert_with(|| Value::String(refresh_token.to_string()));
        object
            .entry("idc_region".to_string())
            .or_insert_with(|| Value::String(region.clone()));
        object
            .entry("idcRegion".to_string())
            .or_insert_with(|| Value::String(region.clone()));
        object
            .entry("region".to_string())
            .or_insert_with(|| Value::String(region.clone()));
        object
            .entry("client_id".to_string())
            .or_insert_with(|| Value::String(client_id.clone()));
        object
            .entry("clientId".to_string())
            .or_insert_with(|| Value::String(client_id));
        object
            .entry("client_secret".to_string())
            .or_insert_with(|| Value::String(client_secret.clone()));
        object
            .entry("clientSecret".to_string())
            .or_insert_with(|| Value::String(client_secret));
        object
            .entry("authMethod".to_string())
            .or_insert_with(|| Value::String("IdC".to_string()));
        if let Some(provider) = pick_string_value(
            Some(auth_token),
            &[&["provider"], &["loginProvider"], &["login_option"]],
        )
        .and_then(|value| normalize_non_empty(Some(value.as_str())))
        {
            object
                .entry("provider".to_string())
                .or_insert_with(|| Value::String(provider.clone()));
            object
                .entry("loginProvider".to_string())
                .or_insert_with(|| Value::String(provider));
        }
        if let Some(issuer_url) = pick_string_value(
            Some(auth_token),
            &[&["issuer_url"], &["issuerUrl"], &["issuer"]],
        )
        .and_then(|value| normalize_non_empty(Some(value.as_str())))
        {
            object
                .entry("issuer_url".to_string())
                .or_insert_with(|| Value::String(issuer_url.clone()));
            object
                .entry("issuerUrl".to_string())
                .or_insert_with(|| Value::String(issuer_url));
        }
    }
    ensure_kiro_expires_at_from_expires_in(&mut payload);
    Ok(payload)
}

fn kiro_runtime_endpoint(region: Option<&str>) -> String {
    let region = region
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("us-east-1");
    format!("https://q.{}.amazonaws.com", region)
}

async fn fetch_kiro_runtime_usage(access_token: &str, profile_arn: &str) -> Result<Value, String> {
    let region = profile_arn
        .split(':')
        .nth(3)
        .filter(|value| !value.trim().is_empty());
    let url = format!(
        "{}/getUsageLimits?origin=AI_EDITOR&profileArn={}&resourceType=AGENTIC_REQUEST&isEmailRequired=true",
        kiro_runtime_endpoint(region),
        urlencoding::encode(profile_arn)
    );
    let response = reqwest::Client::new()
        .get(&url)
        .header(AUTHORIZATION, format!("Bearer {}", access_token.trim()))
        .send()
        .await
        .map_err(|err| format!("请求 Kiro runtime usage 接口失败: {}", err))?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!(
            "Kiro runtime usage 接口返回异常: status={}, body_len={}",
            status,
            body.len()
        ));
    }
    serde_json::from_str::<Value>(&body)
        .map_err(|err| format!("解析 Kiro runtime usage 响应失败: {}", err))
}

fn build_kiro_record(
    snapshot: KiroPayloadSnapshot,
    existing: Option<PlatformAccountRecord>,
) -> PlatformAccountRecord {
    let profile_arn = pick_string_value(
        snapshot.profile_raw.as_ref(),
        &[&["arn"], &["profileArn"], &["profile", "arn"]],
    )
    .or_else(|| {
        pick_string_value(
            Some(&snapshot.auth_token_raw),
            &[&["profileArn"], &["profile_arn"], &["arn"]],
        )
    });
    let storage_id = existing
        .as_ref()
        .map(|value| value.id.clone())
        .unwrap_or_else(|| {
            hash_identity(
                "kiro-account",
                &[
                    snapshot.email.as_str(),
                    snapshot.user_id.as_deref().unwrap_or(""),
                    profile_arn.as_deref().unwrap_or(""),
                ],
            )
        });
    let raw = json!({
        "kiro_auth_token_raw": snapshot.auth_token_raw,
        "kiro_profile_raw": snapshot.profile_raw,
        "kiro_usage_raw": snapshot.usage_raw
    });
    let created_at = existing
        .as_ref()
        .map(|value| value.created_at.clone())
        .unwrap_or_else(now_iso);
    let tags = existing
        .as_ref()
        .map(|value| value.tags.clone())
        .unwrap_or_default();
    PlatformAccountRecord {
        id: storage_id,
        email: snapshot.email,
        display_name: existing
            .as_ref()
            .and_then(|value| value.display_name.clone()),
        auth_mode: "oauth".to_string(),
        plan_name: snapshot.plan_name.clone(),
        plan_type: snapshot.plan_tier.clone(),
        status: match snapshot.status.as_deref() {
            Some("banned") | Some("error") => "error".to_string(),
            _ => "active".to_string(),
        },
        tags,
        created_at,
        last_used: Some(now_iso()),
        user_id: snapshot.user_id,
        account_id: None,
        organization_id: None,
        account_name: None,
        account_structure: None,
        api_base_url: None,
        api_provider_mode: None,
        api_provider_id: None,
        api_provider_name: Some("Kiro".to_string()),
        login_provider: snapshot.login_provider,
        selected_auth_type: Some("oauth".to_string()),
        project_id: None,
        tier_id: snapshot.plan_tier.clone(),
        access_token: Some(snapshot.access_token),
        refresh_token: snapshot.refresh_token,
        id_token: None,
        openai_api_key: None,
        quota: None,
        quota_error: snapshot
            .status_reason
            .as_deref()
            .map(build_quota_error_value),
        credits_total: snapshot.credits_total,
        credits_used: snapshot.credits_used,
        bonus_total: snapshot.bonus_total,
        bonus_used: snapshot.bonus_used,
        usage_reset_at: timestamp_to_iso(snapshot.usage_reset_at),
        detail: snapshot.plan_name,
        raw: Some(raw),
    }
}

async fn complete_kiro_oauth(
    pending: &OAuthPendingState,
    callback_url: &str,
) -> Result<PlatformAccountRecord, String> {
    let code_verifier = pending
        .code_verifier
        .as_deref()
        .ok_or_else(|| "Kiro OAuth 缺少 code_verifier".to_string())?;
    let (code, redirect_uri, callback_context) =
        extract_kiro_oauth_code_and_redirect_uri(pending, callback_url)?;
    let mut auth_token = exchange_kiro_oauth_code(&code, code_verifier, &redirect_uri).await?;
    inject_kiro_callback_context_into_auth_token(&mut auth_token, &callback_context);
    let mut snapshot = build_kiro_payload_from_snapshot(auth_token.clone(), None, None)?;
    let profile_arn = pick_string_value(
        Some(&auth_token),
        &[&["profileArn"], &["profile_arn"], &["arn"]],
    );
    if let Some(profile_arn) = profile_arn {
        if let Ok(usage) = fetch_kiro_runtime_usage(&snapshot.access_token, &profile_arn).await {
            snapshot = build_kiro_payload_from_snapshot(
                auth_token,
                Some(json!({ "arn": profile_arn })),
                Some(usage),
            )?;
        }
    }
    Ok(build_kiro_record(snapshot, None))
}

async fn finalize_oauth(
    platform: Platform,
    login_id: &str,
) -> Result<PlatformAccountRecord, String> {
    let (pending, callback_url) = oauth_callback_url(platform, login_id)?;
    let account = match platform {
        Platform::Codex => complete_codex_oauth(&pending, &callback_url).await?,
        Platform::Gemini => complete_gemini_oauth(&pending, &callback_url).await?,
        Platform::Kiro => complete_kiro_oauth(&pending, &callback_url).await?,
    };
    let account = upsert_platform_account(platform, account)?;
    clear_oauth_pending(platform)?;
    Ok(account)
}

async fn refresh_codex_account_record(account_id: &str) -> Result<PlatformAccountRecord, String> {
    let existing = lookup_account(Platform::Codex, account_id)?;
    if existing.auth_mode == "apiKey" || existing.openai_api_key.is_some() {
        return Ok(existing);
    }
    let mut id_token = existing
        .id_token
        .clone()
        .ok_or_else(|| "Codex 账号缺少 id_token".to_string())?;
    let mut access_token = existing
        .access_token
        .clone()
        .ok_or_else(|| "Codex 账号缺少 access_token".to_string())?;
    let mut refresh_token = existing.refresh_token.clone();
    if refresh_token.is_some() {
        let refreshed = refresh_codex_tokens(
            refresh_token.as_deref().unwrap_or_default(),
            Some(id_token.as_str()),
        )
        .await?;
        id_token = refreshed.0;
        access_token = refreshed.1;
        refresh_token = refreshed.2;
    }
    let profile = fetch_codex_remote_profile(&access_token, existing.account_id.as_deref())
        .await
        .ok();
    let quota = fetch_codex_quota_snapshot(&access_token, existing.account_id.as_deref())
        .await
        .ok();
    let updated = build_codex_record(
        id_token,
        access_token,
        refresh_token,
        profile,
        quota,
        None,
        None,
        Some(existing),
    );
    upsert_platform_account(Platform::Codex, updated)
}

async fn refresh_all_codex_accounts() -> Result<i32, String> {
    let account_ids: Vec<String> = load_index(Platform::Codex)?
        .accounts
        .into_iter()
        .map(|account| account.id)
        .collect();
    let mut refreshed = 0;
    for account_id in account_ids {
        if refresh_codex_account_record(&account_id).await.is_ok() {
            refreshed += 1;
        }
    }
    Ok(refreshed)
}

async fn refresh_gemini_account_record(account_id: &str) -> Result<PlatformAccountRecord, String> {
    let existing = lookup_account(Platform::Gemini, account_id)?;
    let mut access_token = existing
        .access_token
        .clone()
        .ok_or_else(|| "Gemini 账号缺少 access_token".to_string())?;
    let mut id_token = existing.id_token.clone();
    let mut token_type = None;
    let mut scope = None;
    let mut expiry_date = None;
    if let Some(refresh_token) = existing.refresh_token.as_deref() {
        if let Ok(refreshed) = refresh_gemini_access_token(refresh_token).await {
            access_token = refreshed.access_token.unwrap_or(access_token);
            id_token = refreshed.id_token.or(id_token);
            token_type = refreshed.token_type;
            scope = refreshed.scope;
            expiry_date = refreshed
                .expires_in
                .map(|value| Utc::now().timestamp_millis() + value * 1000);
        }
    }
    let userinfo = fetch_gemini_userinfo(&access_token).await;
    let (load_status, load_status_raw) = load_gemini_status(&access_token).await?;
    let quota_raw = if let Some(project_id) = load_status.project_id.as_deref() {
        load_gemini_quota(&access_token, project_id).await.ok()
    } else {
        None
    };
    let updated = build_gemini_record(
        access_token,
        existing.refresh_token.clone(),
        id_token,
        token_type,
        scope,
        expiry_date,
        userinfo,
        load_status,
        Some(load_status_raw),
        quota_raw,
        None,
        Some(existing),
    );
    upsert_platform_account(Platform::Gemini, updated)
}

async fn refresh_all_gemini_accounts() -> Result<i32, String> {
    let account_ids: Vec<String> = load_index(Platform::Gemini)?
        .accounts
        .into_iter()
        .map(|account| account.id)
        .collect();
    let mut refreshed = 0;
    for account_id in account_ids {
        if refresh_gemini_account_record(&account_id).await.is_ok() {
            refreshed += 1;
        }
    }
    Ok(refreshed)
}

async fn refresh_kiro_account_record(account_id: &str) -> Result<PlatformAccountRecord, String> {
    let existing = lookup_account(Platform::Kiro, account_id)?;
    let refresh_token = existing
        .refresh_token
        .clone()
        .ok_or_else(|| "账号缺少 refresh_token，无法刷新 Kiro 登录态".to_string())?;
    let mut existing_auth_token = existing
        .raw
        .as_ref()
        .and_then(|raw| raw.get("kiro_auth_token_raw"))
        .cloned()
        .unwrap_or_else(|| json!({}));
    merge_kiro_account_context_into_auth_token(&mut existing_auth_token, &existing);

    let prefer_idc = should_prefer_kiro_idc_refresh(&existing_auth_token, &existing);
    let mut refresh_errors = Vec::new();
    let mut auth_token = None;
    if prefer_idc {
        match refresh_kiro_auth_token_via_idc_oidc(&refresh_token, &existing_auth_token, &existing)
            .await
        {
            Ok(token) => auth_token = Some(token),
            Err(error) => {
                refresh_errors.push(format!("AWS IAM Identity Center OIDC 刷新失败: {}", error))
            }
        }
    }
    if auth_token.is_none() {
        match refresh_kiro_auth_token(&refresh_token).await {
            Ok(token) => auth_token = Some(token),
            Err(error) => refresh_errors.push(format!("Kiro refreshToken 接口失败: {}", error)),
        }
    }
    let mut auth_token =
        auth_token.ok_or_else(|| format!("刷新 Kiro 登录态失败: {}", refresh_errors.join("；")))?;
    merge_kiro_account_context_into_auth_token(&mut auth_token, &existing);
    let profile = existing
        .raw
        .as_ref()
        .and_then(|raw| raw.get("kiro_profile_raw").cloned());
    let usage = if let Some(profile_arn) = pick_string_value(
        profile.as_ref(),
        &[&["arn"], &["profileArn"], &["profile", "arn"]],
    )
    .or_else(|| {
        pick_string_value(
            Some(&auth_token),
            &[&["profileArn"], &["profile_arn"], &["arn"]],
        )
    }) {
        fetch_kiro_runtime_usage(
            &pick_string_value(
                Some(&auth_token),
                &[
                    &["accessToken"],
                    &["access_token"],
                    &["token"],
                    &["idToken"],
                    &["id_token"],
                ],
            )
            .ok_or_else(|| "Kiro 刷新结果缺少 access token".to_string())?,
            &profile_arn,
        )
        .await
        .ok()
    } else {
        None
    };
    let snapshot = build_kiro_payload_from_snapshot(auth_token, profile, usage)?;
    let updated = build_kiro_record(snapshot, Some(existing));
    upsert_platform_account(Platform::Kiro, updated)
}

async fn refresh_all_kiro_accounts() -> Result<i32, String> {
    let account_ids: Vec<String> = load_index(Platform::Kiro)?
        .accounts
        .into_iter()
        .map(|account| account.id)
        .collect();
    let mut refreshed = 0;
    for account_id in account_ids {
        if refresh_kiro_account_record(&account_id).await.is_ok() {
            refreshed += 1;
        }
    }
    Ok(refreshed)
}

fn start_oauth(platform: Platform) -> Result<OAuthStartResponse, String> {
    let login_id = create_id(&format!("{}-oauth", platform.as_str()));
    let callback_port = find_available_callback_port()?;
    let callback_url = callback_origin(platform, callback_port);
    let state_token = generate_token();
    let code_verifier = generate_token();
    let auth_url = build_provider_auth_url(platform, &callback_url, &state_token, &code_verifier)?;
    let pending = OAuthPendingState {
        login_id: login_id.clone(),
        platform: platform.as_str().to_string(),
        created_at: now_iso(),
        callback_url: Some(callback_url.clone()),
        callback_received_url: None,
        auth_url: Some(auth_url.clone()),
        expected_state: Some(state_token),
        code_verifier: Some(code_verifier),
        callback_port: Some(callback_port),
        expires_at: Some(Utc::now().timestamp() + oauth_timeout_seconds(platform)),
    };
    save_oauth_pending(platform, &pending)?;
    spawn_oauth_callback_listener(platform, pending.clone());
    let _ = open_url_in_default_browser(&auth_url);

    Ok(OAuthStartResponse {
        login_id: login_id.clone(),
        auth_url: auth_url.clone(),
        verification_uri: auth_url.clone(),
        verification_uri_complete: auth_url,
        user_code: Some(
            login_id
                .chars()
                .take(8)
                .collect::<String>()
                .to_ascii_uppercase(),
        ),
        callback_url,
        expires_in: oauth_timeout_seconds(platform),
        interval_seconds: 1,
    })
}

fn submit_oauth_callback(
    platform: Platform,
    login_id: &str,
    callback_url: &str,
) -> Result<(), String> {
    let mut pending = load_oauth_pending(platform)?
        .ok_or_else(|| format!("No pending {} OAuth login found.", platform.label()))?;
    if pending.login_id != login_id {
        return Err(format!(
            "Unknown {} OAuth login id: {}",
            platform.label(),
            login_id
        ));
    }
    pending.callback_received_url = Some(callback_url.trim().to_string());
    save_oauth_pending(platform, &pending)
}

fn cancel_oauth(platform: Platform, login_id: Option<String>) -> Result<(), String> {
    let pending = load_oauth_pending(platform)?;
    if let Some(existing) = pending {
        if let Some(expected_login_id) = login_id {
            if existing.login_id != expected_login_id {
                return Err(format!(
                    "Unknown {} OAuth login id: {}",
                    platform.label(),
                    expected_login_id
                ));
            }
        }
        clear_oauth_pending(platform)?;
    }
    Ok(())
}

fn read_json_file(path: &Path) -> Result<Value, String> {
    let raw =
        fs::read_to_string(path).map_err(|err| format!("读取 {} 失败: {}", path.display(), err))?;
    serde_json::from_str::<Value>(&raw)
        .map_err(|err| format!("解析 {} 失败: {}", path.display(), err))
}

fn codex_auth_path() -> Result<PathBuf, String> {
    Ok(home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?
        .join(".codex")
        .join("auth.json"))
}

fn gemini_oauth_path() -> Result<PathBuf, String> {
    Ok(home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?
        .join(".gemini")
        .join("oauth_creds.json"))
}

fn gemini_accounts_path() -> Result<PathBuf, String> {
    Ok(home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?
        .join(".gemini")
        .join("google_accounts.json"))
}

fn kiro_auth_token_path() -> Result<PathBuf, String> {
    Ok(home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?
        .join(".aws")
        .join("sso")
        .join("cache")
        .join("kiro-auth-token.json"))
}

fn kiro_profile_path() -> Result<PathBuf, String> {
    Ok(home_dir()
        .ok_or_else(|| "无法获取用户主目录".to_string())?
        .join(".config")
        .join("Kiro")
        .join("User")
        .join("globalStorage")
        .join("kiro.kiroagent")
        .join("profile.json"))
}

fn import_codex_local_account() -> Result<PlatformAccountRecord, String> {
    let path = codex_auth_path()?;
    if !path.exists() {
        return Err("未找到 ~/.codex/auth.json 文件".to_string());
    }
    let value = read_json_file(&path)?;
    let mut account = account_from_value(Platform::Codex, value)
        .ok_or_else(|| "auth.json 缺少可导入的账号信息".to_string())?;
    if account.openai_api_key.is_some() {
        account.auth_mode = "apiKey".to_string();
    }
    account.detail = Some(path.to_string_lossy().to_string());
    Ok(account)
}

fn import_gemini_local_account() -> Result<PlatformAccountRecord, String> {
    let oauth_path = gemini_oauth_path()?;
    if !oauth_path.exists() {
        return Err("未找到 ~/.gemini/oauth_creds.json 文件".to_string());
    }

    let value = read_json_file(&oauth_path)?;
    let mut account = account_from_value(Platform::Gemini, value)
        .ok_or_else(|| "oauth_creds.json 缺少可导入的账号信息".to_string())?;
    if let Ok(accounts_path) = gemini_accounts_path() {
        if accounts_path.exists() {
            if let Ok(accounts_value) = read_json_file(&accounts_path) {
                if let Some(object) = json_object(&accounts_value) {
                    if let Some(active) = string_field(object, &["active"]) {
                        account.email = active;
                    }
                }
            }
        }
    }
    account.detail = Some(oauth_path.to_string_lossy().to_string());
    Ok(account)
}

fn import_kiro_local_account() -> Result<PlatformAccountRecord, String> {
    let auth_path = kiro_auth_token_path()?;
    if !auth_path.exists() {
        return Err(
            "未在本机找到 Kiro 登录信息（~/.aws/sso/cache/kiro-auth-token.json）".to_string(),
        );
    }

    let auth_value = read_json_file(&auth_path)?;
    let profile_value = if let Ok(profile_path) = kiro_profile_path() {
        if profile_path.exists() {
            read_json_file(&profile_path).ok()
        } else {
            None
        }
    } else {
        None
    };
    let snapshot = build_kiro_payload_from_snapshot(auth_value, profile_value, None)?;
    let mut account = build_kiro_record(snapshot, None);
    account.detail = Some(auth_path.to_string_lossy().to_string());
    Ok(account)
}

fn import_from_local(platform: Platform) -> Result<Vec<PlatformAccountRecord>, String> {
    let account = match platform {
        Platform::Codex => import_codex_local_account()?,
        Platform::Gemini => import_gemini_local_account()?,
        Platform::Kiro => import_kiro_local_account()?,
    };

    let mut index = load_index(platform)?;
    merge_account(&mut index, account.clone());
    save_index(platform, index)?;
    Ok(vec![account])
}

#[tauri::command]
pub fn list_codex_accounts() -> Result<Vec<PlatformAccountRecord>, String> {
    Ok(load_index(Platform::Codex)?.accounts)
}

#[tauri::command]
pub fn list_gemini_accounts() -> Result<Vec<PlatformAccountRecord>, String> {
    Ok(load_index(Platform::Gemini)?.accounts)
}

#[tauri::command]
pub fn list_kiro_accounts() -> Result<Vec<PlatformAccountRecord>, String> {
    Ok(load_index(Platform::Kiro)?.accounts)
}

#[tauri::command]
pub fn codex_oauth_login_start() -> Result<OAuthStartResponse, String> {
    start_oauth(Platform::Codex)
}

#[tauri::command]
pub fn gemini_oauth_login_start() -> Result<OAuthStartResponse, String> {
    start_oauth(Platform::Gemini)
}

#[tauri::command]
pub fn kiro_oauth_login_start() -> Result<OAuthStartResponse, String> {
    start_oauth(Platform::Kiro)
}

#[tauri::command]
pub async fn codex_oauth_login_completed(
    login_id: String,
) -> Result<PlatformAccountRecord, String> {
    finalize_oauth(Platform::Codex, &login_id).await
}

#[tauri::command]
pub async fn gemini_oauth_login_complete(
    login_id: String,
) -> Result<PlatformAccountRecord, String> {
    finalize_oauth(Platform::Gemini, &login_id).await
}

#[tauri::command]
pub async fn kiro_oauth_login_complete(login_id: String) -> Result<PlatformAccountRecord, String> {
    finalize_oauth(Platform::Kiro, &login_id).await
}

#[tauri::command]
pub fn codex_oauth_login_cancel(login_id: Option<String>) -> Result<(), String> {
    cancel_oauth(Platform::Codex, login_id)
}

#[tauri::command]
pub fn gemini_oauth_login_cancel(login_id: Option<String>) -> Result<(), String> {
    cancel_oauth(Platform::Gemini, login_id)
}

#[tauri::command]
pub fn kiro_oauth_login_cancel(login_id: Option<String>) -> Result<(), String> {
    cancel_oauth(Platform::Kiro, login_id)
}

#[tauri::command]
pub fn codex_oauth_submit_callback_url(
    login_id: String,
    callback_url: String,
) -> Result<(), String> {
    submit_oauth_callback(Platform::Codex, &login_id, &callback_url)
}

#[tauri::command]
pub fn gemini_oauth_submit_callback_url(
    login_id: String,
    callback_url: String,
) -> Result<(), String> {
    submit_oauth_callback(Platform::Gemini, &login_id, &callback_url)
}

#[tauri::command]
pub fn kiro_oauth_submit_callback_url(
    login_id: String,
    callback_url: String,
) -> Result<(), String> {
    submit_oauth_callback(Platform::Kiro, &login_id, &callback_url)
}

#[tauri::command]
pub fn add_codex_account_with_api_key(
    api_key: String,
    api_base_url: Option<String>,
    _api_provider_mode: Option<String>,
) -> Result<PlatformAccountRecord, String> {
    let account = account_from_api_key(api_key, api_base_url);
    let mut index = load_index(Platform::Codex)?;
    merge_account(&mut index, account.clone());
    save_index(Platform::Codex, index)?;
    Ok(account)
}

#[tauri::command]
pub async fn add_codex_account_with_token(
    id_token: String,
    access_token: String,
    refresh_token: Option<String>,
) -> Result<PlatformAccountRecord, String> {
    let normalized_id_token = normalize_non_empty(Some(id_token.as_str()))
        .ok_or_else(|| "id_token 不能为空".to_string())?;
    let normalized_access_token = normalize_non_empty(Some(access_token.as_str()))
        .ok_or_else(|| "access_token 不能为空".to_string())?;
    let profile = fetch_codex_remote_profile(
        &normalized_access_token,
        codex_account_id_from_access_token(&normalized_access_token).as_deref(),
    )
    .await
    .ok();
    let quota = fetch_codex_quota_snapshot(
        &normalized_access_token,
        codex_account_id_from_access_token(&normalized_access_token).as_deref(),
    )
    .await
    .ok();
    let account = build_codex_record(
        normalized_id_token,
        normalized_access_token,
        refresh_token,
        profile,
        quota,
        None,
        None,
        None,
    );
    upsert_platform_account(Platform::Codex, account)
}

#[tauri::command]
pub async fn add_gemini_account_with_token(
    access_token: String,
) -> Result<PlatformAccountRecord, String> {
    let normalized_access_token = normalize_non_empty(Some(access_token.as_str()))
        .ok_or_else(|| "access_token 不能为空".to_string())?;
    let userinfo = fetch_gemini_userinfo(&normalized_access_token).await;
    let (load_status, load_status_raw) = load_gemini_status(&normalized_access_token).await?;
    let quota_raw = if let Some(project_id) = load_status.project_id.as_deref() {
        load_gemini_quota(&normalized_access_token, project_id)
            .await
            .ok()
    } else {
        None
    };
    let account = build_gemini_record(
        normalized_access_token,
        None,
        None,
        None,
        None,
        None,
        userinfo,
        load_status,
        Some(load_status_raw),
        quota_raw,
        None,
        None,
    );
    upsert_platform_account(Platform::Gemini, account)
}

#[tauri::command]
pub async fn add_kiro_account_with_token(
    access_token: String,
) -> Result<PlatformAccountRecord, String> {
    let normalized_access_token = normalize_non_empty(Some(access_token.as_str()))
        .ok_or_else(|| "access_token 不能为空".to_string())?;
    let snapshot = build_kiro_payload_from_snapshot(
        json!({
            "accessToken": normalized_access_token,
            "tokenType": "Bearer"
        }),
        None,
        None,
    )?;
    let account = build_kiro_record(snapshot, None);
    upsert_platform_account(Platform::Kiro, account)
}

#[tauri::command]
pub fn import_codex_from_json(json_content: String) -> Result<Vec<PlatformAccountRecord>, String> {
    import_accounts_from_json(Platform::Codex, &json_content)
}

#[tauri::command]
pub fn import_gemini_from_json(json_content: String) -> Result<Vec<PlatformAccountRecord>, String> {
    import_accounts_from_json(Platform::Gemini, &json_content)
}

#[tauri::command]
pub fn import_kiro_from_json(json_content: String) -> Result<Vec<PlatformAccountRecord>, String> {
    import_kiro_accounts_from_json(&json_content)
}

#[tauri::command]
pub fn import_codex_from_local() -> Result<Vec<PlatformAccountRecord>, String> {
    import_from_local(Platform::Codex)
}

#[tauri::command]
pub fn import_gemini_from_local() -> Result<Vec<PlatformAccountRecord>, String> {
    import_from_local(Platform::Gemini)
}

#[tauri::command]
pub fn import_kiro_from_local() -> Result<Vec<PlatformAccountRecord>, String> {
    import_from_local(Platform::Kiro)
}

#[tauri::command]
pub fn export_codex_accounts(account_ids: Vec<String>) -> Result<String, String> {
    export_accounts(Platform::Codex, &account_ids)
}

#[tauri::command]
pub fn export_gemini_accounts(account_ids: Vec<String>) -> Result<String, String> {
    export_accounts(Platform::Gemini, &account_ids)
}

#[tauri::command]
pub fn export_kiro_accounts(account_ids: Vec<String>) -> Result<String, String> {
    export_accounts(Platform::Kiro, &account_ids)
}

#[tauri::command]
pub fn switch_codex_account(account_id: String) -> Result<PlatformAccountRecord, String> {
    set_current(Platform::Codex, &account_id)
}

#[tauri::command]
pub fn switch_gemini_account(account_id: String) -> Result<PlatformAccountRecord, String> {
    set_current(Platform::Gemini, &account_id)
}

#[tauri::command]
pub fn switch_kiro_account(account_id: String) -> Result<PlatformAccountRecord, String> {
    set_current(Platform::Kiro, &account_id)
}

#[tauri::command]
pub fn get_current_codex_account() -> Result<Option<PlatformAccountRecord>, String> {
    current_account(Platform::Codex)
}

#[tauri::command]
pub fn get_provider_current_account_id(platform: String) -> Result<Option<String>, String> {
    let platform = match platform.trim().to_ascii_lowercase().as_str() {
        "codex" => Platform::Codex,
        "gemini" => Platform::Gemini,
        "kiro" => Platform::Kiro,
        other => return Err(format!("Unsupported provider platform: {}", other)),
    };
    Ok(load_index(platform)?.current_account_id)
}

#[tauri::command]
pub fn delete_codex_account(account_id: String) -> Result<(), String> {
    delete_accounts(Platform::Codex, &[account_id])
}

#[tauri::command]
pub fn delete_codex_accounts(account_ids: Vec<String>) -> Result<(), String> {
    delete_accounts(Platform::Codex, &account_ids)
}

#[tauri::command]
pub fn delete_gemini_account(account_id: String) -> Result<(), String> {
    delete_accounts(Platform::Gemini, &[account_id])
}

#[tauri::command]
pub fn delete_gemini_accounts(account_ids: Vec<String>) -> Result<(), String> {
    delete_accounts(Platform::Gemini, &account_ids)
}

#[tauri::command]
pub fn delete_kiro_account(account_id: String) -> Result<(), String> {
    delete_accounts(Platform::Kiro, &[account_id])
}

#[tauri::command]
pub fn delete_kiro_accounts(account_ids: Vec<String>) -> Result<(), String> {
    delete_accounts(Platform::Kiro, &account_ids)
}

#[tauri::command]
pub async fn refresh_codex_account_profile(
    account_id: String,
) -> Result<PlatformAccountRecord, String> {
    refresh_codex_account_record(&account_id).await
}

#[tauri::command]
pub async fn refresh_all_codex_quotas() -> Result<i32, String> {
    refresh_all_codex_accounts().await
}

#[tauri::command]
pub async fn refresh_gemini_token(account_id: String) -> Result<PlatformAccountRecord, String> {
    refresh_gemini_account_record(&account_id).await
}

#[tauri::command]
pub async fn refresh_all_gemini_tokens() -> Result<i32, String> {
    refresh_all_gemini_accounts().await
}

#[tauri::command]
pub async fn refresh_kiro_token(account_id: String) -> Result<PlatformAccountRecord, String> {
    refresh_kiro_account_record(&account_id).await
}

#[tauri::command]
pub async fn refresh_all_kiro_tokens() -> Result<i32, String> {
    refresh_all_kiro_accounts().await
}

#[tauri::command]
pub fn update_codex_account_tags(
    account_id: String,
    tags: Vec<String>,
) -> Result<PlatformAccountRecord, String> {
    update_tags(Platform::Codex, &account_id, tags)
}

#[tauri::command]
pub fn update_codex_api_key_credentials(
    account_id: String,
    api_key: String,
    api_base_url: Option<String>,
    api_provider_mode: Option<String>,
    api_provider_id: Option<String>,
    api_provider_name: Option<String>,
) -> Result<PlatformAccountRecord, String> {
    update_codex_api_key_credentials_record(
        &account_id,
        &api_key,
        api_base_url,
        api_provider_mode,
        api_provider_id,
        api_provider_name,
    )
}

#[tauri::command]
pub fn update_gemini_account_tags(
    account_id: String,
    tags: Vec<String>,
) -> Result<PlatformAccountRecord, String> {
    update_tags(Platform::Gemini, &account_id, tags)
}

#[tauri::command]
pub fn update_kiro_account_tags(
    account_id: String,
    tags: Vec<String>,
) -> Result<PlatformAccountRecord, String> {
    update_tags(Platform::Kiro, &account_id, tags)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn make_jwt(payload: Value) -> String {
        let header = URL_SAFE_NO_PAD.encode(r#"{"alg":"none","typ":"JWT"}"#);
        let payload = URL_SAFE_NO_PAD.encode(payload.to_string());
        format!("{}.{}.", header, payload)
    }

    #[test]
    fn codex_usage_snapshot_maps_to_platform_quota() {
        let quota = parse_codex_usage_payload(&json!({
            "plan_type": "chatgptplus",
            "rate_limit": {
                "primary_window": {
                    "used_percent": 15,
                    "limit_window_seconds": 18000,
                    "reset_after_seconds": 900
                },
                "secondary_window": {
                    "used_percent": 45,
                    "limit_window_seconds": 604800,
                    "reset_after_seconds": 7200
                }
            }
        }))
        .expect("quota should parse");

        assert_eq!(quota.plan_type.as_deref(), Some("chatgptplus"));
        assert_eq!(quota.snapshot.hourly_percentage, 85);
        assert_eq!(quota.snapshot.weekly_percentage, 55);
        assert_eq!(quota.snapshot.hourly_window_minutes, Some(300));
        assert_eq!(quota.snapshot.weekly_window_minutes, Some(10080));
    }

    #[test]
    fn gemini_load_status_extracts_project_and_tier() {
        let parsed = parse_gemini_load_code_assist_status(&json!({
            "currentTier": {
                "id": "standard-tier",
                "name": "Free",
                "quotaTier": "FREE"
            },
            "paidTier": {
                "id": "pro-tier",
                "name": "Pro",
                "quotaTier": "PRO"
            },
            "cloudaicompanionProject": {
                "projectId": "projects/demo-project"
            },
            "allowedTiers": [
                { "id": "standard-tier", "isDefault": true }
            ]
        }));

        assert_eq!(parsed.project_id.as_deref(), Some("projects/demo-project"));
        assert_eq!(parsed.tier_id.as_deref(), Some("pro-tier"));
        assert_eq!(parsed.plan_name.as_deref(), Some("Pro"));
    }

    #[test]
    fn kiro_snapshot_extracts_provider_and_credits() {
        let access_token = make_jwt(json!({
            "email": "kiro@example.com",
            "sub": "user-42"
        }));
        let payload = build_kiro_payload_from_snapshot(
            json!({
                "accessToken": access_token,
                "refreshToken": "refresh-123",
                "provider": "google",
                "profileArn": "arn:aws:qdeveloper:us-east-1:123456789012:profile/default"
            }),
            Some(json!({
                "email": "kiro@example.com",
                "arn": "arn:aws:qdeveloper:us-east-1:123456789012:profile/default"
            })),
            Some(json!({
                "usageBreakdownList": [{
                    "displayName": "Kiro Pro",
                    "usageLimitWithPrecision": 1000,
                    "currentUsageWithPrecision": 250,
                    "freeTrialInfo": {
                        "usageLimitWithPrecision": 200,
                        "currentUsageWithPrecision": 50,
                        "daysRemaining": 14
                    },
                    "resetDate": "2026-04-21T00:00:00Z"
                }],
                "userInfo": {
                    "provider": { "label": "Google" }
                }
            })),
        )
        .expect("kiro payload should parse");

        assert_eq!(payload.email, "kiro@example.com");
        assert_eq!(payload.login_provider.as_deref(), Some("Google"));
        assert_eq!(payload.plan_name.as_deref(), Some("Kiro Pro"));
        assert_eq!(payload.credits_total, Some(1000.0));
        assert_eq!(payload.credits_used, Some(250.0));
        assert_eq!(payload.bonus_total, Some(200.0));
        assert_eq!(payload.bonus_used, Some(50.0));
        assert_eq!(payload.bonus_expire_days, Some(14));
    }

    #[test]
    fn should_prefer_kiro_idc_refresh_for_enterprise_account() {
        let account = PlatformAccountRecord {
            id: "kiro-enterprise".to_string(),
            email: "enterprise@example.com".to_string(),
            display_name: None,
            auth_mode: "oauth".to_string(),
            plan_name: None,
            plan_type: None,
            status: "active".to_string(),
            tags: Vec::new(),
            created_at: now_iso(),
            last_used: None,
            user_id: None,
            account_id: None,
            organization_id: None,
            account_name: None,
            account_structure: None,
            api_base_url: None,
            api_provider_mode: None,
            api_provider_id: None,
            api_provider_name: Some("Kiro".to_string()),
            login_provider: Some("Enterprise".to_string()),
            selected_auth_type: Some("oauth".to_string()),
            project_id: None,
            tier_id: None,
            access_token: Some("access-token".to_string()),
            refresh_token: Some("refresh-token".to_string()),
            id_token: None,
            openai_api_key: None,
            quota: None,
            quota_error: None,
            credits_total: None,
            credits_used: None,
            bonus_total: None,
            bonus_used: None,
            usage_reset_at: None,
            detail: None,
            raw: Some(json!({
                "kiro_auth_token_raw": {
                    "authMethod": "IdC",
                    "provider": "Enterprise",
                    "idc_region": "us-east-1",
                    "client_id": "client-id",
                    "client_secret": "client-secret"
                },
                "kiro_profile_raw": {
                    "arn": "arn:aws:qdeveloper:us-east-1:123456789012:profile/default"
                }
            })),
        };
        let auth_token = account
            .raw
            .as_ref()
            .and_then(|raw| raw.get("kiro_auth_token_raw"))
            .cloned()
            .unwrap_or_else(|| json!({}));

        assert!(should_prefer_kiro_idc_refresh(&auth_token, &account));
        assert_eq!(
            resolve_kiro_idc_client_secret(&auth_token).as_deref(),
            Some("client-secret")
        );
        assert_eq!(
            resolve_kiro_idc_region(&auth_token, &account).as_deref(),
            Some("us-east-1")
        );
    }

    #[test]
    fn build_kiro_import_auth_token_preserves_enterprise_context() {
        let auth_token = build_kiro_import_auth_token(&json!({
            "accessToken": "access-token",
            "refreshToken": "refresh-token",
            "provider": "Enterprise",
            "authMethod": "IdC",
            "profileArn": "arn:aws:qdeveloper:us-east-1:123456789012:profile/default",
            "idc_region": "us-east-1",
            "client_id": "client-id",
            "client_secret": "client-secret",
            "startUrl": "https://example.awsapps.com/start",
            "scope": "openid profile"
        }))
        .expect("import auth token should build");

        assert_eq!(
            pick_string_value(Some(&auth_token), &[&["client_secret"]]).as_deref(),
            Some("client-secret")
        );
        assert_eq!(
            pick_string_value(Some(&auth_token), &[&["startUrl"]]).as_deref(),
            Some("https://example.awsapps.com/start")
        );
        assert_eq!(
            pick_string_value(Some(&auth_token), &[&["profileArn"]]).as_deref(),
            Some("arn:aws:qdeveloper:us-east-1:123456789012:profile/default")
        );
    }

    #[test]
    fn kiro_account_from_import_value_preserves_enterprise_refresh_context() {
        let account = kiro_account_from_import_value(json!({
            "accessToken": "access-token",
            "refreshToken": "refresh-token",
            "provider": "Enterprise",
            "authMethod": "IdC",
            "profileArn": "arn:aws:qdeveloper:us-east-1:123456789012:profile/default",
            "idc_region": "us-east-1",
            "client_id": "client-id",
            "client_secret": "client-secret",
            "startUrl": "https://example.awsapps.com/start"
        }))
        .expect("kiro import account should parse");

        assert_eq!(account.login_provider.as_deref(), Some("Enterprise"));
        assert_eq!(
            pick_string_value(
                account.raw.as_ref(),
                &[&["kiro_auth_token_raw", "client_secret"]]
            )
            .as_deref(),
            Some("client-secret")
        );
        assert_eq!(
            pick_string_value(
                account.raw.as_ref(),
                &[&["kiro_auth_token_raw", "startUrl"]]
            )
            .as_deref(),
            Some("https://example.awsapps.com/start")
        );
        assert_eq!(
            pick_string_value(account.raw.as_ref(), &[&["kiro_profile_raw", "arn"]]).as_deref(),
            Some("arn:aws:qdeveloper:us-east-1:123456789012:profile/default")
        );
    }

    #[test]
    fn kiro_callback_without_code_returns_external_idp_reason() {
        let pending = OAuthPendingState {
            login_id: "kiro-oauth-1".to_string(),
            platform: "kiro".to_string(),
            created_at: now_iso(),
            callback_url: Some("http://localhost:39999".to_string()),
            callback_received_url: None,
            auth_url: None,
            expected_state: None,
            code_verifier: Some("verifier".to_string()),
            callback_port: Some(39999),
            expires_at: None,
        };

        let error = extract_kiro_oauth_code_and_redirect_uri(
            &pending,
            "http://localhost:39999/signin/callback?login_option=external_idp",
        )
        .expect_err("external idp callback without code should fail");

        assert!(error.contains("External IdP"));
    }
}
