use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::db;

#[derive(Debug, Serialize, Deserialize)]
pub struct Backlink {
    pub source_id: String,
    pub source_path: String,
    pub source_title: String,
    pub context: String, // The text surrounding the link
}

/// Reindex the entire vault
#[tauri::command]
pub async fn reindex_vault(app: AppHandle) -> Result<usize, String> {
    let vault_path = db::get_current_vault_path(&app).ok_or("No vault open")?;
    db::index_vault(&app, &vault_path)
        .await
        .map_err(|e| e.to_string())
}

/// Get all backlinks to a specific note
#[tauri::command]
pub fn get_backlinks(app: AppHandle, note_path: String) -> Result<Vec<Backlink>, String> {
    db::get_backlinks(&app, &note_path).map_err(|e| e.to_string())
}

/// Get graph data for visualization
#[tauri::command]
pub fn get_graph_data(app: AppHandle) -> Result<db::GraphData, String> {
    db::get_graph_data(&app).map_err(|e| e.to_string())
}

/// Get all unique tags in the vault
#[tauri::command]
pub fn get_all_tags(app: AppHandle) -> Result<Vec<String>, String> {
    db::get_all_tags(&app).map_err(|e| e.to_string())
}

/// Get all unique mentions in the vault
#[tauri::command]
pub fn get_all_mentions(app: AppHandle) -> Result<Vec<String>, String> {
    db::get_all_mentions(&app).map_err(|e| e.to_string())
}

/// Get orphan notes (notes with no incoming or outgoing links)
#[tauri::command]
pub fn get_orphan_notes(app: AppHandle) -> Result<Vec<db::OrphanNote>, String> {
    db::get_orphan_notes(&app).map_err(|e| e.to_string())
}

/// Get broken links (links pointing to non-existent notes)
#[tauri::command]
pub fn get_broken_links(app: AppHandle) -> Result<Vec<db::BrokenLink>, String> {
    db::get_broken_links(&app).map_err(|e| e.to_string())
}

/// Get vault health statistics
#[tauri::command]
pub fn get_vault_health(app: AppHandle) -> Result<db::VaultHealth, String> {
    db::get_vault_health(&app).map_err(|e| e.to_string())
}

/// Get unlinked mentions (note titles that appear in content but aren't wiki-linked)
#[tauri::command]
pub fn get_unlinked_mentions(app: AppHandle) -> Result<Vec<db::UnlinkedMention>, String> {
    db::get_unlinked_mentions(&app).map_err(|e| e.to_string())
}

/// Get a random note for Zettelkasten-style review
#[tauri::command]
pub fn get_random_note(app: AppHandle) -> Result<Option<db::OrphanNote>, String> {
    db::get_random_note(&app).map_err(|e| e.to_string())
}

/// Get notes that could be MOCs (Maps of Content)
#[tauri::command]
pub fn get_potential_mocs(app: AppHandle, min_links: usize) -> Result<Vec<db::GraphNode>, String> {
    db::get_potential_mocs(&app, min_links).map_err(|e| e.to_string())
}

/// Get notes by folder prefix (for PARA-style organization)
#[tauri::command]
pub fn get_notes_by_folder(app: AppHandle, folder_prefix: String) -> Result<Vec<db::OrphanNote>, String> {
    db::get_notes_by_folder(&app, &folder_prefix).map_err(|e| e.to_string())
}
