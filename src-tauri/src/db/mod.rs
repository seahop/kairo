mod indexer;
mod schema;
mod search;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub use indexer::*;
pub use schema::*;
pub use search::*;

/// Database state managed by Tauri
pub struct DatabaseState {
    pub conn: Option<Connection>,
    pub vault_path: Option<PathBuf>,
}

impl Default for DatabaseState {
    fn default() -> Self {
        Self {
            conn: None,
            vault_path: None,
        }
    }
}

/// Initialize database state
pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(Mutex::new(DatabaseState::default()));
    Ok(())
}

/// Open database for a vault
pub fn open_vault_db(
    app: &AppHandle,
    vault_path: &PathBuf,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = vault_path.join(".kairo").join("index.db");

    // Ensure .kairo directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let conn = Connection::open(&db_path)?;

    // Initialize schema
    schema::init_schema(&conn)?;

    // Store in state
    let state = app.state::<Mutex<DatabaseState>>();
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.conn = Some(conn);
    state.vault_path = Some(vault_path.clone());

    Ok(())
}

/// Close the current vault database
pub fn close_vault_db(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<Mutex<DatabaseState>>();
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.conn = None;
    state.vault_path = None;
    Ok(())
}

/// Get the current vault path
pub fn get_current_vault_path(app: &AppHandle) -> Option<PathBuf> {
    let state = app.state::<Mutex<DatabaseState>>();
    let state = state.lock().ok()?;
    state.vault_path.clone()
}

/// Execute a database operation with the connection
pub fn with_db<F, T>(app: &AppHandle, f: F) -> Result<T, Box<dyn std::error::Error>>
where
    F: FnOnce(&Connection) -> Result<T, Box<dyn std::error::Error>>,
{
    let state = app.state::<Mutex<DatabaseState>>();
    let state = state.lock().map_err(|e| e.to_string())?;

    match &state.conn {
        Some(conn) => f(conn),
        None => Err("No database connection".into()),
    }
}

/// Get note count in the current vault
pub fn get_note_count(app: &AppHandle) -> Result<usize, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))?;
        Ok(count as usize)
    })
}
