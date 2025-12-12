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
