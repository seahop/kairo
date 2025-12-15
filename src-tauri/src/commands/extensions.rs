use std::fs;
use std::path::{Path, PathBuf};

/// Validate that a path is within an allowed base directory (prevents path traversal)
fn validate_path_within(base: &Path, user_path: &Path) -> Result<PathBuf, String> {
    // Canonicalize the base path
    let canonical_base = base
        .canonicalize()
        .map_err(|_| "Invalid base path".to_string())?;

    // Join and canonicalize the full path
    let full_path = base.join(user_path);
    let canonical_full = full_path
        .canonicalize()
        .map_err(|_| "Path not found or invalid".to_string())?;

    // Verify the canonical path starts with the base
    if !canonical_full.starts_with(&canonical_base) {
        return Err("Access denied: path traversal detected".to_string());
    }

    Ok(canonical_full)
}

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
    let extension = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

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
