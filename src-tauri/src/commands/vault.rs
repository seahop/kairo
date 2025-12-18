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
    let daily_dir = notes_dir.join("daily");

    fs::create_dir_all(&kairo_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&notes_dir).map_err(|e| e.to_string())?;
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
- Create new notes with `Ctrl+N` or use templates with `Ctrl+Shift+N`
- Search everything with `Ctrl+Shift+F`

## Folder Structure

- `notes/` - Your markdown notes
- `notes/daily/` - Daily notes
- `attachments/` - Images and files (created when you upload)

## Templates

Templates are managed through the app. Press `Ctrl+Shift+N` to create notes from templates, or create your own custom templates.

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

/// Get the current vault path
#[tauri::command]
pub fn get_vault_path(app: AppHandle) -> Result<Option<String>, String> {
    Ok(db::get_current_vault_path(&app).map(|p| p.to_string_lossy().to_string()))
}

/// Result of saving an attachment
#[derive(Debug, Serialize, Deserialize)]
pub struct AttachmentResult {
    /// Relative path from vault root (e.g., "attachments/image.png")
    pub relative_path: String,
    /// Whether the file was renamed due to conflict
    pub renamed: bool,
    /// Original filename if renamed
    pub original_name: Option<String>,
}

/// Save an attachment to the vault's attachments folder
/// Returns the relative path to use in markdown
#[tauri::command]
pub fn save_attachment(
    app: AppHandle,
    filename: String,
    data: Vec<u8>,
) -> Result<AttachmentResult, String> {
    let vault_path =
        db::get_current_vault_path(&app).ok_or_else(|| "No vault is currently open".to_string())?;

    let attachments_dir = vault_path.join("attachments");

    // Create attachments directory if it doesn't exist
    if !attachments_dir.exists() {
        fs::create_dir_all(&attachments_dir).map_err(|e| e.to_string())?;
    }

    // Parse filename into name and extension
    let path = PathBuf::from(&filename);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("attachment");
    let extension = path.extension().and_then(|s| s.to_str()).unwrap_or("");

    // Find a unique filename
    let mut final_name = filename.clone();
    let mut target_path = attachments_dir.join(&final_name);
    let mut counter = 1;
    let mut renamed = false;

    while target_path.exists() {
        renamed = true;
        if extension.is_empty() {
            final_name = format!("{}_{}", stem, counter);
        } else {
            final_name = format!("{}_{}.{}", stem, counter, extension);
        }
        target_path = attachments_dir.join(&final_name);
        counter += 1;
    }

    // Write the file
    fs::write(&target_path, &data).map_err(|e| e.to_string())?;

    let relative_path = format!("attachments/{}", final_name);

    Ok(AttachmentResult {
        relative_path,
        renamed,
        original_name: if renamed { Some(filename) } else { None },
    })
}

/// Get the current user identity for this vault
/// Reads from .kairo-user file in the vault root (gitignored)
#[tauri::command]
pub fn get_vault_user(app: AppHandle) -> Result<Option<String>, String> {
    let vault_path = match db::get_current_vault_path(&app) {
        Some(p) => p,
        None => return Ok(None),
    };

    let user_file = vault_path.join(".kairo-user");
    if !user_file.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&user_file).map_err(|e| e.to_string())?;
    let username = content.trim().to_string();

    if username.is_empty() {
        Ok(None)
    } else {
        Ok(Some(username))
    }
}

/// Set the current user identity for this vault
/// Writes to .kairo-user file in the vault root (should be gitignored)
#[tauri::command]
pub fn set_vault_user(app: AppHandle, username: String) -> Result<(), String> {
    let vault_path =
        db::get_current_vault_path(&app).ok_or_else(|| "No vault is currently open".to_string())?;

    let user_file = vault_path.join(".kairo-user");
    fs::write(&user_file, username.trim()).map_err(|e| e.to_string())?;

    // Ensure .kairo-user is in .gitignore
    let gitignore_path = vault_path.join(".gitignore");
    let gitignore_entry = ".kairo-user";

    if gitignore_path.exists() {
        let content = fs::read_to_string(&gitignore_path).unwrap_or_default();
        if !content.lines().any(|line| line.trim() == gitignore_entry) {
            // Add to .gitignore
            let new_content = if content.ends_with('\n') || content.is_empty() {
                format!("{}{}\n", content, gitignore_entry)
            } else {
                format!("{}\n{}\n", content, gitignore_entry)
            };
            fs::write(&gitignore_path, new_content).map_err(|e| e.to_string())?;
        }
    } else {
        // Create .gitignore with the entry
        fs::write(&gitignore_path, format!("{}\n", gitignore_entry)).map_err(|e| e.to_string())?;
    }

    Ok(())
}
