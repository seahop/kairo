use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Recent vault entry
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentVault {
    pub path: String,
    pub name: String,
    pub last_opened: i64,
}

/// App settings stored in ~/.kairo/settings.json
#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub recent_vaults: Vec<RecentVault>,
    pub last_vault: Option<String>,
    pub theme: Option<String>,
}

/// Get the Kairo config directory (~/.kairo)
fn get_kairo_config_dir() -> Result<PathBuf, String> {
    let config_dir = dirs::home_dir()
        .map(|h| h.join(".kairo"))
        .ok_or_else(|| "Could not determine home directory".to_string())?;

    // Ensure the directory exists
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    Ok(config_dir)
}

/// Get the settings file path
fn get_settings_path() -> Result<PathBuf, String> {
    Ok(get_kairo_config_dir()?.join("settings.json"))
}

/// Read app settings from ~/.kairo/settings.json
fn read_settings() -> Result<AppSettings, String> {
    let path = get_settings_path()?;

    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

/// Write app settings to ~/.kairo/settings.json
fn write_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_path()?;
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// Get all app settings
#[tauri::command]
pub fn get_app_settings() -> Result<AppSettings, String> {
    read_settings()
}

/// Get recent vaults list
#[tauri::command]
pub fn get_recent_vaults() -> Result<Vec<RecentVault>, String> {
    let settings = read_settings()?;
    Ok(settings.recent_vaults)
}

/// Add a vault to recent vaults (or update if exists)
#[tauri::command]
pub fn add_recent_vault(path: String, name: String) -> Result<Vec<RecentVault>, String> {
    let mut settings = read_settings()?;
    let now = chrono::Utc::now().timestamp_millis();

    // Remove if already exists
    settings.recent_vaults.retain(|v| v.path != path);

    // Add to front
    settings.recent_vaults.insert(
        0,
        RecentVault {
            path: path.clone(),
            name,
            last_opened: now,
        },
    );

    // Keep only the 10 most recent
    settings.recent_vaults.truncate(10);

    // Update last vault
    settings.last_vault = Some(path);

    write_settings(&settings)?;
    Ok(settings.recent_vaults)
}

/// Get the last opened vault path
#[tauri::command]
pub fn get_last_vault() -> Result<Option<String>, String> {
    let settings = read_settings()?;
    Ok(settings.last_vault)
}

/// Set a setting value
#[tauri::command]
pub fn set_app_setting(key: String, value: String) -> Result<(), String> {
    let mut settings = read_settings()?;

    match key.as_str() {
        "theme" => settings.theme = Some(value),
        "lastVault" => settings.last_vault = Some(value),
        _ => return Err(format!("Unknown setting key: {}", key)),
    }

    write_settings(&settings)
}

/// Get a setting value
#[tauri::command]
pub fn get_app_setting(key: String) -> Result<Option<String>, String> {
    let settings = read_settings()?;

    let value = match key.as_str() {
        "theme" => settings.theme,
        "lastVault" => settings.last_vault,
        _ => return Err(format!("Unknown setting key: {}", key)),
    };

    Ok(value)
}

/// Remove a vault from recent vaults
#[tauri::command]
pub fn remove_recent_vault(path: String) -> Result<Vec<RecentVault>, String> {
    let mut settings = read_settings()?;
    settings.recent_vaults.retain(|v| v.path != path);

    // Clear last vault if it was the removed one
    if settings.last_vault.as_ref() == Some(&path) {
        settings.last_vault = settings.recent_vaults.first().map(|v| v.path.clone());
    }

    write_settings(&settings)?;
    Ok(settings.recent_vaults)
}
