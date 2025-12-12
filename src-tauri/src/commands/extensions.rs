use std::fs;
use std::path::Path;

/// List all extension folders in the given directory
#[tauri::command]
pub fn list_extension_folders(path: &str) -> Result<Vec<String>, String> {
    let extensions_path = Path::new(path);

    if !extensions_path.exists() {
        return Ok(vec![]);
    }

    if !extensions_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let mut extension_paths = Vec::new();

    for entry in fs::read_dir(extensions_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();

        // Only include directories that contain a manifest.json
        if entry_path.is_dir() {
            let manifest_path = entry_path.join("manifest.json");
            if manifest_path.exists() {
                extension_paths.push(entry_path.to_string_lossy().to_string());
            }
        }
    }

    Ok(extension_paths)
}

/// Read the manifest.json file from an extension folder
#[tauri::command]
pub fn read_extension_manifest(path: &str) -> Result<String, String> {
    let manifest_path = Path::new(path).join("manifest.json");

    if !manifest_path.exists() {
        return Err("manifest.json not found".to_string());
    }

    fs::read_to_string(&manifest_path).map_err(|e| e.to_string())
}

/// Read a text file (for loading extension entry points)
#[tauri::command]
pub fn read_file_text(path: &str) -> Result<String, String> {
    let file_path = Path::new(path);

    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    fs::read_to_string(file_path).map_err(|e| e.to_string())
}

/// Get the extensions directory path for a vault
#[tauri::command]
pub fn get_extensions_path(vault_path: &str) -> String {
    Path::new(vault_path)
        .join(".kairo")
        .join("extensions")
        .to_string_lossy()
        .to_string()
}

/// Create the extensions directory if it doesn't exist
#[tauri::command]
pub fn ensure_extensions_directory(vault_path: &str) -> Result<String, String> {
    let extensions_path = Path::new(vault_path)
        .join(".kairo")
        .join("extensions");

    if !extensions_path.exists() {
        fs::create_dir_all(&extensions_path).map_err(|e| e.to_string())?;
    }

    Ok(extensions_path.to_string_lossy().to_string())
}
