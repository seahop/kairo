use std::fs;
use std::path::Path;
use tauri::AppHandle;

use crate::db;

/// Validate plugin ID to prevent path traversal
fn validate_plugin_id(id: &str) -> Result<(), String> {
    // Only allow alphanumeric, hyphens, and underscores
    if id.is_empty() || id.len() > 64 {
        return Err("Invalid plugin ID length".to_string());
    }

    if !id
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(
            "Invalid plugin ID: only alphanumeric, hyphens, and underscores allowed".to_string(),
        );
    }

    // Reject traversal patterns
    if id.contains("..") || id.contains('/') || id.contains('\\') || id.contains('\0') {
        return Err("Invalid plugin ID: path traversal detected".to_string());
    }

    Ok(())
}

/// Validate data key to prevent path traversal
fn validate_data_key(key: &str) -> Result<(), String> {
    // Only allow alphanumeric, hyphens, underscores, and dots (but not leading dots)
    if key.is_empty() || key.len() > 128 {
        return Err("Invalid key length".to_string());
    }

    if key.starts_with('.') {
        return Err("Invalid key: cannot start with dot".to_string());
    }

    if !key
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(
            "Invalid key: only alphanumeric, hyphens, underscores, and dots allowed".to_string(),
        );
    }

    // Reject traversal patterns
    if key.contains("..") || key.contains('/') || key.contains('\\') || key.contains('\0') {
        return Err("Invalid key: path traversal detected".to_string());
    }

    Ok(())
}

/// Validate the final path is within the plugin directory
fn validate_plugin_path(
    vault_path: &Path,
    plugin_id: &str,
    key: &str,
) -> Result<std::path::PathBuf, String> {
    let plugin_dir = vault_path.join(".kairo").join("plugins").join(plugin_id);
    let data_path = plugin_dir.join(format!("{}.json", key));

    // If plugin dir exists, verify paths via canonicalization
    if plugin_dir.exists() {
        let canonical_plugin_dir = plugin_dir
            .canonicalize()
            .map_err(|_| "Invalid plugin directory".to_string())?;

        // Verify it's actually within .kairo/plugins
        let canonical_str = canonical_plugin_dir.to_string_lossy();
        if !canonical_str.contains(".kairo") || !canonical_str.contains("plugins") {
            return Err("Access denied: path traversal detected".to_string());
        }
    }

    Ok(data_path)
}

/// Read plugin data from the vault's plugin storage
#[tauri::command]
pub fn read_plugin_data(
    app: AppHandle,
    plugin_id: String,
    key: String,
) -> Result<Option<String>, String> {
    // Validate inputs
    validate_plugin_id(&plugin_id)?;
    validate_data_key(&key)?;

    let vault_path = db::get_current_vault_path(&app).ok_or("No vault is currently open")?;
    let data_path = validate_plugin_path(&vault_path, &plugin_id, &key)?;

    if !data_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&data_path).map_err(|e| e.to_string())?;
    Ok(Some(content))
}

/// Write plugin data to the vault's plugin storage
#[tauri::command]
pub fn write_plugin_data(
    app: AppHandle,
    plugin_id: String,
    key: String,
    data: String,
) -> Result<(), String> {
    // Validate inputs
    validate_plugin_id(&plugin_id)?;
    validate_data_key(&key)?;

    // Limit data size to prevent DoS
    const MAX_DATA_SIZE: usize = 10 * 1024 * 1024; // 10MB
    if data.len() > MAX_DATA_SIZE {
        return Err(format!(
            "Data too large: {} bytes (max {})",
            data.len(),
            MAX_DATA_SIZE
        ));
    }

    let vault_path = db::get_current_vault_path(&app).ok_or("No vault is currently open")?;
    let plugin_dir = vault_path.join(".kairo").join("plugins").join(&plugin_id);

    // Create plugin directory if it doesn't exist
    fs::create_dir_all(&plugin_dir).map_err(|e| e.to_string())?;

    let data_path = validate_plugin_path(&vault_path, &plugin_id, &key)?;
    fs::write(&data_path, data).map_err(|e| e.to_string())?;

    Ok(())
}

/// Delete plugin data from the vault's plugin storage
#[tauri::command]
pub fn delete_plugin_data(app: AppHandle, plugin_id: String, key: String) -> Result<(), String> {
    // Validate inputs
    validate_plugin_id(&plugin_id)?;
    validate_data_key(&key)?;

    let vault_path = db::get_current_vault_path(&app).ok_or("No vault is currently open")?;
    let data_path = validate_plugin_path(&vault_path, &plugin_id, &key)?;

    if data_path.exists() {
        fs::remove_file(&data_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// List all keys stored for a plugin
#[tauri::command]
pub fn list_plugin_data(app: AppHandle, plugin_id: String) -> Result<Vec<String>, String> {
    // Validate plugin ID
    validate_plugin_id(&plugin_id)?;

    let vault_path = db::get_current_vault_path(&app).ok_or("No vault is currently open")?;

    let plugin_dir = vault_path.join(".kairo").join("plugins").join(&plugin_id);

    if !plugin_dir.exists() {
        return Ok(vec![]);
    }

    // Verify the plugin directory is valid after canonicalization
    let canonical_dir = plugin_dir
        .canonicalize()
        .map_err(|_| "Invalid plugin directory".to_string())?;

    let canonical_str = canonical_dir.to_string_lossy();
    if !canonical_str.contains(".kairo") || !canonical_str.contains("plugins") {
        return Err("Access denied: path traversal detected".to_string());
    }

    let entries = fs::read_dir(&canonical_dir).map_err(|e| e.to_string())?;

    let keys: Vec<String> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.extension()?.to_str()? == "json" {
                path.file_stem()?.to_str().map(|s| s.to_string())
            } else {
                None
            }
        })
        .collect();

    Ok(keys)
}
