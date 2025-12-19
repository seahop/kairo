pub mod dataview;
mod indexer;
mod schema;
mod search;

use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub use indexer::*;
pub use search::*;

/// Database state managed by Tauri
#[derive(Default)]
pub struct DatabaseState {
    pub conn: Option<Connection>,
    pub vault_path: Option<PathBuf>,
}

/// Initialize database state
pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(Mutex::new(DatabaseState::default()));
    Ok(())
}

/// Open database for a vault
pub fn open_vault_db(app: &AppHandle, vault_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
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
    state.vault_path = Some(vault_path.to_path_buf());

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

/// Get starred status for a note
pub fn get_note_starred(app: &AppHandle, note_id: &str) -> Result<bool, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let starred: i32 = conn
            .query_row(
                "SELECT COALESCE(starred, 0) FROM notes WHERE id = ?1",
                rusqlite::params![note_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        Ok(starred != 0)
    })
}

/// Set starred status for a note
pub fn set_note_starred(
    app: &AppHandle,
    note_id: &str,
    starred: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        conn.execute(
            "UPDATE notes SET starred = ?1 WHERE id = ?2",
            rusqlite::params![if starred { 1 } else { 0 }, note_id],
        )?;
        Ok(())
    })
}

/// Get aliases for a note
pub fn get_note_aliases(
    app: &AppHandle,
    note_id: &str,
) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn.prepare("SELECT alias FROM aliases WHERE note_id = ?1")?;
        let aliases = stmt
            .query_map(rusqlite::params![note_id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(aliases)
    })
}

/// Resolve a note path by alias (case-insensitive)
pub fn resolve_note_by_alias(
    app: &AppHandle,
    alias: &str,
) -> Result<Option<String>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let path: Result<String, _> = conn.query_row(
            r#"
            SELECT n.path FROM notes n
            JOIN aliases a ON n.id = a.note_id
            WHERE LOWER(a.alias) = LOWER(?1)
            LIMIT 1
            "#,
            rusqlite::params![alias],
            |row| row.get(0),
        );
        Ok(path.ok())
    })
}

/// Get all aliases with their note paths (for autocomplete)
pub fn get_all_aliases(
    app: &AppHandle,
) -> Result<Vec<(String, String, String)>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn.prepare(
            r#"
            SELECT a.alias, n.path, n.title FROM aliases a
            JOIN notes n ON a.note_id = n.id
            ORDER BY a.alias
            "#,
        )?;
        let aliases = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(aliases)
    })
}

// ============================================================================
// Note Versioning Functions
// ============================================================================

/// Create a new version of a note (auto-deduplicates based on content hash)
pub fn create_note_version(
    app: &AppHandle,
    note_id: &str,
    content: &str,
    trigger: &str, // "save", "auto", "manual"
    label: Option<&str>,
) -> Result<Option<i64>, Box<dyn std::error::Error>> {
    use sha2::{Digest, Sha256};

    // Hash the content
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let result = hasher.finalize();
    let content_hash = hex::encode(&result[..16]);

    with_db(app, |conn| {
        // Check if this exact version already exists (deduplication)
        let existing: Result<i64, _> = conn.query_row(
            "SELECT id FROM note_versions WHERE note_id = ?1 AND content_hash = ?2",
            rusqlite::params![note_id, content_hash],
            |row| row.get(0),
        );

        if existing.is_ok() {
            // Version already exists, don't create duplicate
            return Ok(None);
        }

        // Get current timestamp
        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        // Insert new version
        conn.execute(
            r#"
            INSERT INTO note_versions (note_id, content, content_hash, created_at, trigger, label)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
            rusqlite::params![note_id, content, content_hash, created_at, trigger, label],
        )?;

        let version_id = conn.last_insert_rowid();

        // Prune old versions (keep last 50 per note)
        conn.execute(
            r#"
            DELETE FROM note_versions
            WHERE note_id = ?1 AND id NOT IN (
                SELECT id FROM note_versions WHERE note_id = ?1
                ORDER BY created_at DESC LIMIT 50
            )
            "#,
            rusqlite::params![note_id],
        )?;

        Ok(Some(version_id))
    })
}

/// Version info for listing
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NoteVersionInfo {
    pub id: i64,
    pub note_id: String,
    pub created_at: i64,
    pub trigger: String,
    pub label: Option<String>,
    pub content_preview: String, // First 100 chars
}

/// Get version history for a note
pub fn get_note_versions(
    app: &AppHandle,
    note_id: &str,
) -> Result<Vec<NoteVersionInfo>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn.prepare(
            r#"
            SELECT id, note_id, created_at, trigger, label, content
            FROM note_versions
            WHERE note_id = ?1
            ORDER BY created_at DESC
            "#,
        )?;

        let versions = stmt
            .query_map(rusqlite::params![note_id], |row| {
                let content: String = row.get(5)?;
                let preview = content.chars().take(100).collect::<String>();
                Ok(NoteVersionInfo {
                    id: row.get(0)?,
                    note_id: row.get(1)?,
                    created_at: row.get(2)?,
                    trigger: row.get(3)?,
                    label: row.get(4)?,
                    content_preview: preview,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(versions)
    })
}

/// Get a specific version's content
pub fn get_version_content(
    app: &AppHandle,
    version_id: i64,
) -> Result<Option<String>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let content: Result<String, _> = conn.query_row(
            "SELECT content FROM note_versions WHERE id = ?1",
            rusqlite::params![version_id],
            |row| row.get(0),
        );
        Ok(content.ok())
    })
}

/// Label a version (for manual snapshots)
pub fn label_version(
    app: &AppHandle,
    version_id: i64,
    label: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        conn.execute(
            "UPDATE note_versions SET label = ?1 WHERE id = ?2",
            rusqlite::params![label, version_id],
        )?;
        Ok(())
    })
}
