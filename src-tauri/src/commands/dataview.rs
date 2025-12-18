//! Dataview query commands

use tauri::AppHandle;

use crate::db;
use crate::db::dataview::{DataviewResult, SerializedQuery};

/// Execute a dataview query
#[tauri::command]
pub fn execute_dataview_query(app: AppHandle, query: SerializedQuery) -> Result<DataviewResult, String> {
    db::with_db(&app, |conn| {
        Ok(db::dataview::execute_query(conn, &query))
    })
    .map_err(|e| e.to_string())
}
