use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::db;
use crate::db::with_db;
use crate::fs::watcher::VaultWatcher;

/// State for the file watcher
pub struct WatcherState {
    pub watcher: Option<VaultWatcher>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self { watcher: None }
    }
}

/// Entries that should be in every vault's .gitignore
const GITIGNORE_ENTRIES: &[&str] = &[
    ".kairo/index.db",
    ".kairo/index.db-journal",
    ".kairo/index.db-wal",
    ".kairo/index.db-shm",
    ".kairo-user",
];

/// Ensure the vault's .gitignore has all necessary entries
fn ensure_gitignore(vault_path: &Path) {
    let gitignore_path = vault_path.join(".gitignore");

    let existing_content = if gitignore_path.exists() {
        fs::read_to_string(&gitignore_path).unwrap_or_default()
    } else {
        String::new()
    };

    let existing_lines: Vec<&str> = existing_content.lines().map(|l| l.trim()).collect();

    let mut missing_entries: Vec<&str> = Vec::new();
    for entry in GITIGNORE_ENTRIES {
        if !existing_lines.contains(entry) {
            missing_entries.push(entry);
        }
    }

    if !missing_entries.is_empty() {
        let mut new_content = existing_content;

        // Add header comment if we're adding to an empty or non-existent file
        if new_content.is_empty() {
            new_content.push_str("# Kairo generated files\n");
        } else if !new_content.ends_with('\n') {
            new_content.push('\n');
        }

        for entry in missing_entries {
            new_content.push_str(entry);
            new_content.push('\n');
        }

        let _ = fs::write(&gitignore_path, new_content);
    }
}

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

    // Ensure gitignore has all necessary entries (for existing vaults)
    ensure_gitignore(&vault_path);

    // Initialize database for this vault
    db::open_vault_db(&app, &vault_path).map_err(|e| e.to_string())?;

    // Index the vault
    db::index_vault(&app, &vault_path)
        .await
        .map_err(|e| e.to_string())?;

    // Start file watcher
    if let Ok(watcher) = VaultWatcher::new(app.clone(), vault_path.clone()) {
        let state = app.state::<Mutex<WatcherState>>();
        if let Ok(mut guard) = state.lock() {
            guard.watcher = Some(watcher);
        };
    }

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

    // Create .gitignore for vault-specific files
    ensure_gitignore(&vault_path);

    // Initialize database
    db::open_vault_db(&app, &vault_path).map_err(|e| e.to_string())?;

    // Index the vault
    db::index_vault(&app, &vault_path)
        .await
        .map_err(|e| e.to_string())?;

    // Start file watcher
    if let Ok(watcher) = VaultWatcher::new(app.clone(), vault_path.clone()) {
        let state = app.state::<Mutex<WatcherState>>();
        if let Ok(mut guard) = state.lock() {
            guard.watcher = Some(watcher);
        };
    }

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

/// Result from setting vault user (includes auto-created board if any)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetUserResult {
    pub username: String,
    pub created_board: bool,
    pub board_id: Option<String>,
}

/// Set the current user identity for this vault
/// Writes to .kairo-user file and auto-creates personal kanban board + member entry
#[tauri::command]
pub fn set_vault_user(app: AppHandle, username: String) -> Result<SetUserResult, String> {
    let vault_path =
        db::get_current_vault_path(&app).ok_or_else(|| "No vault is currently open".to_string())?;

    let username = username.trim().to_string();
    if username.is_empty() {
        return Err("Username cannot be empty".to_string());
    }

    // Check if name is taken and create board/member if needed
    let (created_board, board_id) = with_db(&app, |conn| {
        let username_lower = username.to_lowercase();

        // Check if a personal board with this owner already exists
        let existing_board: Option<String> = conn
            .query_row(
                "SELECT id FROM kanban_boards WHERE LOWER(owner_name) = ?1",
                params![username_lower],
                |row| row.get(0),
            )
            .ok();

        if let Some(board_id) = existing_board {
            // Board exists - make sure user is in members table
            let member_exists: bool = conn
                .query_row(
                    "SELECT 1 FROM kanban_board_members WHERE LOWER(name) = ?1",
                    params![username_lower],
                    |_| Ok(true),
                )
                .unwrap_or(false);

            if !member_exists {
                let member_id = Uuid::new_v4().to_string();
                let now = chrono::Utc::now().timestamp();
                conn.execute(
                    "INSERT INTO kanban_board_members (id, board_id, name, added_at) VALUES (?1, ?2, ?3, ?4)",
                    params![member_id, board_id, username, now],
                )
                .map_err(|e| e.to_string())?;
            }

            return Ok((false, Some(board_id)));
        }

        // No existing board - create one
        let now = chrono::Utc::now().timestamp();
        let board_id = Uuid::new_v4().to_string();

        // Default columns for personal boards
        let default_columns = vec![
            ("Created", false),
            ("In Progress", false),
            ("Waiting on Others", false),
            ("Delayed", false),
            ("Closed", true),
            ("Backlog", false),
        ];

        #[derive(serde::Serialize)]
        struct KanbanColumn {
            id: String,
            name: String,
            color: Option<String>,
            #[serde(rename = "isDone")]
            is_done: bool,
        }

        let kanban_columns: Vec<KanbanColumn> = default_columns
            .into_iter()
            .map(|(name, is_done)| KanbanColumn {
                id: Uuid::new_v4().to_string(),
                name: name.to_string(),
                color: None,
                is_done,
            })
            .collect();

        let columns_json = serde_json::to_string(&kanban_columns).map_err(|e| e.to_string())?;

        // Create the personal board
        conn.execute(
            "INSERT INTO kanban_boards (id, name, columns, owner_name, created_at, modified_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![board_id, username, columns_json, username, now, now],
        )
        .map_err(|e| e.to_string())?;

        // Add user as a board member
        let member_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO kanban_board_members (id, board_id, name, added_at) VALUES (?1, ?2, ?3, ?4)",
            params![member_id, board_id, username, now],
        )
        .map_err(|e| e.to_string())?;

        Ok((true, Some(board_id.clone())))
    })
    .map_err(|e| e.to_string())?;

    // Write to .kairo-user file
    let user_file = vault_path.join(".kairo-user");
    fs::write(&user_file, &username).map_err(|e| e.to_string())?;

    // Ensure gitignore has all necessary entries (including .kairo-user)
    ensure_gitignore(&vault_path);

    Ok(SetUserResult {
        username,
        created_board,
        board_id,
    })
}
