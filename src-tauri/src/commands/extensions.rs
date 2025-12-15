use std::fs;
use std::path::Path;

/// Validate that a path string doesn't contain traversal patterns
fn reject_traversal_patterns(path: &str) -> Result<(), String> {
    if path.contains("..") || path.contains("\0") {
        return Err("Access denied: invalid path characters".to_string());
    }
    Ok(())
}

/// List all extension folders in the given directory
#[tauri::command]
pub fn list_extension_folders(path: &str) -> Result<Vec<String>, String> {
    reject_traversal_patterns(path)?;

    let extensions_path = Path::new(path);

    if !extensions_path.exists() {
        return Ok(vec![]);
    }

    if !extensions_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    // Verify this is actually a .kairo/extensions directory
    let path_str = extensions_path.to_string_lossy();
    if !path_str.contains(".kairo") || !path_str.contains("extensions") {
        return Err("Access denied: not an extensions directory".to_string());
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
    reject_traversal_patterns(path)?;

    let base_path = Path::new(path);

    // Verify this looks like an extension path
    let path_str = base_path.to_string_lossy();
    if !path_str.contains(".kairo") || !path_str.contains("extensions") {
        return Err("Access denied: not an extensions directory".to_string());
    }

    let manifest_path = base_path.join("manifest.json");

    if !manifest_path.exists() {
        return Err("manifest.json not found".to_string());
    }

    // Verify manifest is within the extension directory
    let canonical_manifest = manifest_path
        .canonicalize()
        .map_err(|_| "Invalid manifest path".to_string())?;
    let canonical_base = base_path
        .canonicalize()
        .map_err(|_| "Invalid base path".to_string())?;

    if !canonical_manifest.starts_with(&canonical_base) {
        return Err("Access denied: path traversal detected".to_string());
    }

    fs::read_to_string(&canonical_manifest).map_err(|e| e.to_string())
}

/// Read a text file (for loading extension entry points)
/// SECURITY: Only allows reading files within .kairo/extensions directories
#[tauri::command]
pub fn read_file_text(path: &str) -> Result<String, String> {
    reject_traversal_patterns(path)?;

    let file_path = Path::new(path);

    // Security: Only allow reading from .kairo/extensions directories
    let path_str = file_path.to_string_lossy();
    if !path_str.contains(".kairo") || !path_str.contains("extensions") {
        return Err("Access denied: can only read files from extensions directory".to_string());
    }

    // Only allow certain file extensions
    let extension = file_path.extension().and_then(|e| e.to_str()).unwrap_or("");

    let allowed_extensions = ["js", "json", "ts", "mjs", "cjs"];
    if !allowed_extensions.contains(&extension) {
        return Err(format!(
            "Access denied: file type '.{}' not allowed",
            extension
        ));
    }

    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    // Verify the file is actually within a .kairo/extensions directory after canonicalization
    let canonical = file_path
        .canonicalize()
        .map_err(|_| "Invalid file path".to_string())?;

    let canonical_str = canonical.to_string_lossy();
    if !canonical_str.contains(".kairo") {
        return Err("Access denied: path traversal detected".to_string());
    }

    // Limit file size to prevent DoS
    let metadata = fs::metadata(&canonical).map_err(|e| e.to_string())?;
    const MAX_FILE_SIZE: u64 = 1024 * 1024; // 1MB
    if metadata.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File too large: {} bytes (max {})",
            metadata.len(),
            MAX_FILE_SIZE
        ));
    }

    fs::read_to_string(&canonical).map_err(|e| e.to_string())
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
    let extensions_path = Path::new(vault_path).join(".kairo").join("extensions");

    if !extensions_path.exists() {
        fs::create_dir_all(&extensions_path).map_err(|e| e.to_string())?;
    }

    Ok(extensions_path.to_string_lossy().to_string())
}

/// Read a manifest.json from any folder (for import preview)
/// This is used when the user selects an extension folder to import
#[tauri::command]
pub fn read_extension_manifest_from_path(path: &str) -> Result<String, String> {
    reject_traversal_patterns(path)?;

    let base_path = Path::new(path);

    if !base_path.exists() {
        return Err("Folder not found".to_string());
    }

    if !base_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let manifest_path = base_path.join("manifest.json");

    if !manifest_path.exists() {
        return Err("No manifest.json found in this folder".to_string());
    }

    fs::read_to_string(&manifest_path).map_err(|e| e.to_string())
}

/// Check if an extension with the given ID already exists in the vault
#[tauri::command]
pub fn extension_exists(vault_path: &str, extension_id: &str) -> Result<bool, String> {
    reject_traversal_patterns(vault_path)?;
    reject_traversal_patterns(extension_id)?;

    let extensions_path = Path::new(vault_path).join(".kairo").join("extensions");
    let extension_path = extensions_path.join(extension_id);

    Ok(extension_path.exists() && extension_path.is_dir())
}

/// Copy an extension folder to the vault's extensions directory
/// If overwrite is true and extension exists, it will be replaced
#[tauri::command]
pub fn import_extension(
    source_path: &str,
    vault_path: &str,
    extension_id: &str,
    overwrite: bool,
) -> Result<String, String> {
    reject_traversal_patterns(source_path)?;
    reject_traversal_patterns(vault_path)?;
    reject_traversal_patterns(extension_id)?;

    // Validate extension_id doesn't contain path separators
    if extension_id.contains('/') || extension_id.contains('\\') {
        return Err("Invalid extension ID".to_string());
    }

    let source = Path::new(source_path);
    if !source.exists() || !source.is_dir() {
        return Err("Source folder not found".to_string());
    }

    // Verify source has manifest.json
    let manifest_path = source.join("manifest.json");
    if !manifest_path.exists() {
        return Err("Source folder does not contain manifest.json".to_string());
    }

    // Ensure extensions directory exists
    let extensions_dir = Path::new(vault_path).join(".kairo").join("extensions");
    if !extensions_dir.exists() {
        fs::create_dir_all(&extensions_dir).map_err(|e| e.to_string())?;
    }

    let dest = extensions_dir.join(extension_id);

    // Check if destination exists
    if dest.exists() {
        if !overwrite {
            return Err("Extension already exists. Use overwrite to replace.".to_string());
        }
        // Remove existing extension
        fs::remove_dir_all(&dest).map_err(|e| format!("Failed to remove existing: {}", e))?;
    }

    // Copy the extension folder recursively
    copy_dir_recursive(source, &dest)?;

    Ok(dest.to_string_lossy().to_string())
}

/// Recursively copy a directory and its contents
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("Failed to create directory: {}", e))?;

    for entry in fs::read_dir(src).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }

    Ok(())
}

/// Read extension settings from the vault's .kairo directory
#[tauri::command]
pub fn read_extension_settings(vault_path: &str) -> Result<String, String> {
    reject_traversal_patterns(vault_path)?;

    let settings_path = Path::new(vault_path)
        .join(".kairo")
        .join("extension-settings.json");

    if !settings_path.exists() {
        // Return empty settings if file doesn't exist
        return Ok("{}".to_string());
    }

    fs::read_to_string(&settings_path).map_err(|e| e.to_string())
}

/// Save extension settings to the vault's .kairo directory
#[tauri::command]
pub fn save_extension_settings(vault_path: &str, settings_json: &str) -> Result<(), String> {
    reject_traversal_patterns(vault_path)?;

    // Validate that it's valid JSON
    serde_json::from_str::<serde_json::Value>(settings_json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let kairo_dir = Path::new(vault_path).join(".kairo");

    // Ensure .kairo directory exists
    if !kairo_dir.exists() {
        fs::create_dir_all(&kairo_dir).map_err(|e| e.to_string())?;
    }

    let settings_path = kairo_dir.join("extension-settings.json");
    fs::write(&settings_path, settings_json).map_err(|e| e.to_string())
}

/// Remove an extension from the vault
#[tauri::command]
pub fn remove_extension(vault_path: &str, extension_id: &str) -> Result<(), String> {
    reject_traversal_patterns(vault_path)?;
    reject_traversal_patterns(extension_id)?;

    // Validate extension_id doesn't contain path separators
    if extension_id.contains('/') || extension_id.contains('\\') {
        return Err("Invalid extension ID".to_string());
    }

    let extension_path = Path::new(vault_path)
        .join(".kairo")
        .join("extensions")
        .join(extension_id);

    // Verify this is actually an extension directory
    if !extension_path.exists() {
        return Err("Extension not found".to_string());
    }

    if !extension_path.is_dir() {
        return Err("Invalid extension path".to_string());
    }

    // Verify it has a manifest.json (safety check that it's actually an extension)
    let manifest_path = extension_path.join("manifest.json");
    if !manifest_path.exists() {
        return Err("Not a valid extension directory".to_string());
    }

    // Remove the extension directory
    fs::remove_dir_all(&extension_path).map_err(|e| format!("Failed to remove extension: {}", e))
}
