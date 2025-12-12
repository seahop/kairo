use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::db;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteMetadata {
    pub id: String,
    pub path: String,
    pub title: String,
    pub modified_at: i64,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub path: String,
    pub title: String,
    pub content: String,
    pub modified_at: i64,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct FolderEntry {
    pub name: String,
    pub path: String,
    pub is_folder: bool,
    pub children: Option<Vec<FolderEntry>>,
}

/// List all notes in the vault
#[tauri::command]
pub fn list_notes(app: AppHandle) -> Result<Vec<NoteMetadata>, String> {
    db::list_all_notes(&app).map_err(|e| e.to_string())
}

/// Read a note by its path (relative to vault)
#[tauri::command]
pub fn read_note(app: AppHandle, path: String) -> Result<Note, String> {
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault open")?;
    let note_path = vault_path.join(&path);

    if !note_path.exists() {
        return Err(format!("Note not found: {}", path));
    }

    let content = fs::read_to_string(&note_path).map_err(|e| e.to_string())?;
    let metadata = fs::metadata(&note_path).map_err(|e| e.to_string())?;

    let modified_at = metadata
        .modified()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(0);

    let created_at = metadata
        .created()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(modified_at);

    // Extract title from first heading or filename
    let title = extract_title(&content, &path);

    // Generate ID from path
    let id = generate_note_id(&path);

    Ok(Note {
        id,
        path,
        title,
        content,
        modified_at,
        created_at,
    })
}

/// Write/update a note
#[tauri::command]
pub async fn write_note(
    app: AppHandle,
    path: String,
    content: String,
    create_if_missing: bool,
) -> Result<NoteMetadata, String> {
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault open")?;
    let note_path = vault_path.join(&path);

    // Check if note exists
    if !note_path.exists() && !create_if_missing {
        return Err(format!("Note not found: {}", path));
    }

    // Ensure parent directory exists
    if let Some(parent) = note_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Write the file
    fs::write(&note_path, &content).map_err(|e| e.to_string())?;

    // Update index
    db::index_single_note(&app, &vault_path, &PathBuf::from(&path))
        .await
        .map_err(|e| e.to_string())?;

    let metadata = fs::metadata(&note_path).map_err(|e| e.to_string())?;
    let modified_at = metadata
        .modified()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(0);

    let created_at = metadata
        .created()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(modified_at);

    let title = extract_title(&content, &path);
    let id = generate_note_id(&path);

    Ok(NoteMetadata {
        id,
        path,
        title,
        modified_at,
        created_at,
    })
}

/// Delete a note
#[tauri::command]
pub async fn delete_note(app: AppHandle, path: String) -> Result<(), String> {
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault open")?;
    let note_path = vault_path.join(&path);

    if !note_path.exists() {
        return Err(format!("Note not found: {}", path));
    }

    fs::remove_file(&note_path).map_err(|e| e.to_string())?;

    // Remove from index
    db::remove_note_from_index(&app, &path).map_err(|e| e.to_string())?;

    Ok(())
}

/// Rename/move a note
#[tauri::command]
pub async fn rename_note(
    app: AppHandle,
    old_path: String,
    new_path: String,
) -> Result<NoteMetadata, String> {
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault open")?;
    let old_note_path = vault_path.join(&old_path);
    let new_note_path = vault_path.join(&new_path);

    if !old_note_path.exists() {
        return Err(format!("Note not found: {}", old_path));
    }

    if new_note_path.exists() {
        return Err(format!("Note already exists at: {}", new_path));
    }

    // Ensure parent directory exists
    if let Some(parent) = new_note_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Move the file
    fs::rename(&old_note_path, &new_note_path).map_err(|e| e.to_string())?;

    // Update index
    db::remove_note_from_index(&app, &old_path).map_err(|e| e.to_string())?;
    db::index_single_note(&app, &vault_path, &PathBuf::from(&new_path))
        .await
        .map_err(|e| e.to_string())?;

    // Read the note to return metadata
    let content = fs::read_to_string(&new_note_path).map_err(|e| e.to_string())?;
    let metadata = fs::metadata(&new_note_path).map_err(|e| e.to_string())?;

    let modified_at = metadata
        .modified()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(0);

    let created_at = metadata
        .created()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(modified_at);

    let title = extract_title(&content, &new_path);
    let id = generate_note_id(&new_path);

    Ok(NoteMetadata {
        id,
        path: new_path,
        title,
        modified_at,
        created_at,
    })
}

/// Create a folder
#[tauri::command]
pub fn create_folder(app: AppHandle, path: String) -> Result<(), String> {
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault open")?;
    let folder_path = vault_path.join(&path);

    fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;

    Ok(())
}

// Helper functions

fn extract_title(content: &str, path: &str) -> String {
    // Try to extract title from first H1 heading
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(stripped) = trimmed.strip_prefix("# ") {
            return stripped.trim().to_string();
        }
    }

    // Fall back to filename without extension
    PathBuf::from(path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

fn generate_note_id(path: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..8])
}
