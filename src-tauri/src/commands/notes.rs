use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

use crate::db;

/// Validate that a relative path doesn't escape the vault directory
fn validate_vault_path(vault_path: &Path, relative_path: &str) -> Result<PathBuf, String> {
    // Reject obvious traversal attempts
    if relative_path.contains("..") || relative_path.contains("\0") {
        return Err("Access denied: invalid path characters".to_string());
    }

    // Build the full path
    let full_path = vault_path.join(relative_path);

    // Canonicalize both paths for comparison
    // Note: For new files, we canonicalize the parent directory
    let canonical_vault = vault_path
        .canonicalize()
        .map_err(|_| "Invalid vault path".to_string())?;

    // If the file exists, canonicalize it directly
    if full_path.exists() {
        let canonical_full = full_path
            .canonicalize()
            .map_err(|_| "Invalid path".to_string())?;

        if !canonical_full.starts_with(&canonical_vault) {
            return Err("Access denied: path traversal detected".to_string());
        }

        return Ok(canonical_full);
    }

    // For new files, verify the parent directory is within vault
    if let Some(parent) = full_path.parent() {
        // Create parent if needed for the check
        if parent.exists() {
            let canonical_parent = parent
                .canonicalize()
                .map_err(|_| "Invalid parent path".to_string())?;

            if !canonical_parent.starts_with(&canonical_vault) {
                return Err("Access denied: path traversal detected".to_string());
            }
        }
    }

    // Return the non-canonical path for new files
    Ok(full_path)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteMetadata {
    pub id: String,
    pub path: String,
    pub title: String,
    pub modified_at: i64,
    pub created_at: i64,
    pub archived: bool,
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
    let note_path = validate_vault_path(&vault_path, &path)?;

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
    let note_path = validate_vault_path(&vault_path, &path)?;

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
    let archived = extract_archived(&content);

    Ok(NoteMetadata {
        id,
        path,
        title,
        modified_at,
        created_at,
        archived,
    })
}

/// Delete a note
#[tauri::command]
pub async fn delete_note(app: AppHandle, path: String) -> Result<(), String> {
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault open")?;
    let note_path = validate_vault_path(&vault_path, &path)?;

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
    let old_note_path = validate_vault_path(&vault_path, &old_path)?;
    let new_note_path = validate_vault_path(&vault_path, &new_path)?;

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
    let archived = extract_archived(&content);

    Ok(NoteMetadata {
        id,
        path: new_path,
        title,
        modified_at,
        created_at,
        archived,
    })
}

/// Create a folder
#[tauri::command]
pub fn create_folder(app: AppHandle, path: String) -> Result<(), String> {
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault open")?;
    let folder_path = validate_vault_path(&vault_path, &path)?;

    fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;

    Ok(())
}

/// Set the archived status of a note
#[tauri::command]
pub async fn set_note_archived(
    app: AppHandle,
    path: String,
    archived: bool,
) -> Result<NoteMetadata, String> {
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault open")?;
    let note_path = validate_vault_path(&vault_path, &path)?;

    if !note_path.exists() {
        return Err(format!("Note not found: {}", path));
    }

    // Read current content
    let content = fs::read_to_string(&note_path).map_err(|e| e.to_string())?;

    // Update frontmatter with archived status
    let new_content = update_frontmatter_archived(&content, archived);

    // Write the updated file
    fs::write(&note_path, &new_content).map_err(|e| e.to_string())?;

    // Re-index the note
    db::index_single_note(&app, &vault_path, &PathBuf::from(&path))
        .await
        .map_err(|e| e.to_string())?;

    // Return updated metadata
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

    let title = extract_title(&new_content, &path);
    let id = generate_note_id(&path);

    Ok(NoteMetadata {
        id,
        path,
        title,
        modified_at,
        created_at,
        archived,
    })
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

/// Extract archived status from content frontmatter
fn extract_archived(content: &str) -> bool {
    if !content.starts_with("---") {
        return false;
    }

    let parts: Vec<&str> = content.splitn(3, "---").collect();
    if parts.len() < 3 {
        return false;
    }

    let yaml = parts[1].trim();
    for line in yaml.lines() {
        let line = line.trim();
        if line.starts_with("archived:") {
            let value = line.trim_start_matches("archived:").trim();
            // Handle both `archived: true` and `archived: "true"`
            return value == "true" || value == "\"true\"" || value == "'true'";
        }
    }

    false
}

/// Update frontmatter with archived status
fn update_frontmatter_archived(content: &str, archived: bool) -> String {
    let archived_line = if archived {
        "archived: true"
    } else {
        "archived: false"
    };

    if content.starts_with("---") {
        let parts: Vec<&str> = content.splitn(3, "---").collect();
        if parts.len() >= 3 {
            let yaml = parts[1].trim();
            let rest = parts[2];

            // Check if archived field already exists
            let mut new_yaml_lines: Vec<String> = Vec::new();
            let mut found_archived = false;

            for line in yaml.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("archived:") {
                    new_yaml_lines.push(archived_line.to_string());
                    found_archived = true;
                } else {
                    new_yaml_lines.push(line.to_string());
                }
            }

            if !found_archived {
                new_yaml_lines.push(archived_line.to_string());
            }

            return format!("---\n{}\n---{}", new_yaml_lines.join("\n"), rest);
        }
    }

    // No frontmatter exists, create one
    format!("---\n{}\n---\n\n{}", archived_line, content)
}
