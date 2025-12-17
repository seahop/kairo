use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::db;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub path: String,
    pub title: String,
    pub snippet: String,
    pub score: f64,
    pub matches: Vec<SearchMatch>,
    pub archived: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchMatch {
    pub field: String,   // "title", "content", "code_block", "tag"
    pub text: String,    // The matched text
    pub context: String, // Surrounding context
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntityResult {
    pub entity_type: String, // "ip", "domain", "cve", "username", "mention"
    pub value: String,
    pub note_path: String,
    pub note_title: String,
    pub context: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct SearchQuery {
    pub text: String,
    pub filters: Option<SearchFilters>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchFilters {
    pub tags: Option<Vec<String>>,
    pub folders: Option<Vec<String>>,
    pub entity_types: Option<Vec<String>>,
    pub date_from: Option<i64>,
    pub date_to: Option<i64>,
    pub code_only: Option<bool>,
    pub include_archived: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SavedSearch {
    pub id: String,
    pub name: String,
    pub query: String,
    pub filters: Option<SearchFilters>,
    pub created_at: i64,
}

/// Search notes using full-text search
#[tauri::command]
pub fn search_notes(
    app: AppHandle,
    query: String,
    filters: Option<SearchFilters>,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    let limit = limit.unwrap_or(50);
    db::search_notes(&app, &query, filters.as_ref(), limit).map_err(|e| e.to_string())
}

/// Search for specific entities (IPs, domains, CVEs, etc.)
#[tauri::command]
pub fn search_entities(
    app: AppHandle,
    entity_type: Option<String>,
    pattern: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<EntityResult>, String> {
    let limit = limit.unwrap_or(100);
    db::search_entities(&app, entity_type.as_deref(), pattern.as_deref(), limit)
        .map_err(|e| e.to_string())
}

/// Save a search query for quick access
#[tauri::command]
pub fn save_search(
    app: AppHandle,
    name: String,
    query: String,
    filters: Option<SearchFilters>,
) -> Result<SavedSearch, String> {
    db::save_search(&app, &name, &query, filters.as_ref()).map_err(|e| e.to_string())
}

/// Get all saved searches
#[tauri::command]
pub fn get_saved_searches(app: AppHandle) -> Result<Vec<SavedSearch>, String> {
    db::get_saved_searches(&app).map_err(|e| e.to_string())
}
