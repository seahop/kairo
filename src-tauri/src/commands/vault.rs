use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::db;

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultInfo {
    pub path: String,
    pub name: String,
    pub note_count: usize,
    pub created_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultConfig {
    pub name: String,
    pub version: String,
    pub created_at: i64,
}

/// Open an existing vault at the given path
#[tauri::command]
pub async fn open_vault(app: AppHandle, path: String) -> Result<VaultInfo, String> {
    let vault_path = PathBuf::from(&path);

    // Check if .kairo directory exists
    let kairo_dir = vault_path.join(".kairo");
    if !kairo_dir.exists() {
        return Err("Not a valid Kairo vault (missing .kairo directory)".to_string());
    }

    // Read config
    let config_path = kairo_dir.join("config.json");
    let config: VaultConfig = if config_path.exists() {
        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        return Err("Vault config not found".to_string());
    };

    // Initialize database for this vault
    db::open_vault_db(&app, &vault_path).map_err(|e| e.to_string())?;

    // Index the vault
    db::index_vault(&app, &vault_path)
        .await
        .map_err(|e| e.to_string())?;

    // Get note count
    let note_count = db::get_note_count(&app).map_err(|e| e.to_string())?;

    Ok(VaultInfo {
        path: path.clone(),
        name: config.name,
        note_count,
        created_at: Some(config.created_at),
    })
}

/// Create a new vault at the given path
#[tauri::command]
pub async fn create_vault(app: AppHandle, path: String, name: String) -> Result<VaultInfo, String> {
    let vault_path = PathBuf::from(&path);

    // Create vault directory structure
    let kairo_dir = vault_path.join(".kairo");
    let notes_dir = vault_path.join("notes");
    let templates_dir = vault_path.join("templates");
    let assets_dir = vault_path.join("assets");
    let daily_dir = notes_dir.join("daily");

    fs::create_dir_all(&kairo_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&notes_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&templates_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&daily_dir).map_err(|e| e.to_string())?;

    // Create config
    let created_at = chrono::Utc::now().timestamp();
    let config = VaultConfig {
        name: name.clone(),
        version: "0.1.0".to_string(),
        created_at,
    };

    let config_path = kairo_dir.join("config.json");
    let config_content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&config_path, config_content).map_err(|e| e.to_string())?;

    // Create a welcome note
    let welcome_note = r#"# Welcome to Kairo

This is your new vault. Here are some tips to get started:

## Quick Tips

- Use `Ctrl+K` to open the command palette
- Create new notes with `Ctrl+N`
- Search everything with `Ctrl+Shift+F`

## Folder Structure

- `notes/` - Your markdown notes
- `notes/daily/` - Daily notes
- `templates/` - Note templates
- `assets/` - Images and attachments

Happy note-taking!
"#;

    let welcome_path = notes_dir.join("welcome.md");
    fs::write(&welcome_path, welcome_note).map_err(|e| e.to_string())?;

    // Initialize database
    db::open_vault_db(&app, &vault_path).map_err(|e| e.to_string())?;

    // Index the vault
    db::index_vault(&app, &vault_path)
        .await
        .map_err(|e| e.to_string())?;

    Ok(VaultInfo {
        path,
        name,
        note_count: 1,
        created_at: Some(created_at),
    })
}

/// Get info about the currently open vault
#[tauri::command]
pub fn get_vault_info(app: AppHandle) -> Result<Option<VaultInfo>, String> {
    let vault_path = match db::get_current_vault_path(&app) {
        Some(p) => p,
        None => return Ok(None),
    };

    let kairo_dir = vault_path.join(".kairo");
    let config_path = kairo_dir.join("config.json");

    let config: VaultConfig = if config_path.exists() {
        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        return Err("Vault config not found".to_string());
    };

    let note_count = db::get_note_count(&app).map_err(|e| e.to_string())?;

    Ok(Some(VaultInfo {
        path: vault_path.to_string_lossy().to_string(),
        name: config.name,
        note_count,
        created_at: Some(config.created_at),
    }))
}

/// Close the currently open vault
#[tauri::command]
pub fn close_vault(app: AppHandle) -> Result<(), String> {
    db::close_vault_db(&app).map_err(|e| e.to_string())
}
