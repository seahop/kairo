use std::fs;
use tauri::AppHandle;

use crate::db;

/// Read plugin data from the vault's plugin storage
#[tauri::command]
pub fn read_plugin_data(
    app: AppHandle,
    plugin_id: String,
    key: String,
) -> Result<Option<String>, String> {
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault is currently open")?;

    let plugin_dir = vault_path.join(".kairo").join("plugins").join(&plugin_id);
    let data_path = plugin_dir.join(format!("{}.json", key));

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
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault is currently open")?;

    let plugin_dir = vault_path.join(".kairo").join("plugins").join(&plugin_id);

    // Create plugin directory if it doesn't exist
    fs::create_dir_all(&plugin_dir).map_err(|e| e.to_string())?;

    let data_path = plugin_dir.join(format!("{}.json", key));
    fs::write(&data_path, data).map_err(|e| e.to_string())?;

    Ok(())
}

/// Delete plugin data from the vault's plugin storage
#[tauri::command]
pub fn delete_plugin_data(app: AppHandle, plugin_id: String, key: String) -> Result<(), String> {
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault is currently open")?;

    let plugin_dir = vault_path.join(".kairo").join("plugins").join(&plugin_id);
    let data_path = plugin_dir.join(format!("{}.json", key));

    if data_path.exists() {
        fs::remove_file(&data_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// List all keys stored for a plugin
#[tauri::command]
pub fn list_plugin_data(app: AppHandle, plugin_id: String) -> Result<Vec<String>, String> {
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault is currently open")?;

    let plugin_dir = vault_path.join(".kairo").join("plugins").join(&plugin_id);

    if !plugin_dir.exists() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(&plugin_dir).map_err(|e| e.to_string())?;

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
