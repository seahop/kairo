use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;

use crate::db::with_db;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KanbanColumn {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KanbanBoard {
    pub id: String,
    pub name: String,
    pub columns: Vec<KanbanColumn>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KanbanCard {
    pub id: String,
    #[serde(rename = "boardId")]
    pub board_id: String,
    #[serde(rename = "columnId")]
    pub column_id: String,
    pub title: String,
    #[serde(rename = "noteId")]
    pub note_id: Option<String>,
    #[serde(rename = "notePath")]
    pub note_path: Option<String>,
    pub position: i32,
    pub metadata: Option<serde_json::Value>,
}

/// List all kanban boards
#[tauri::command]
pub fn kanban_list_boards(app: AppHandle) -> Result<Vec<KanbanBoard>, String> {
    with_db(&app, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, name, columns, created_at, modified_at FROM kanban_boards ORDER BY modified_at DESC")
            .map_err(|e| e.to_string())?;

        let boards = stmt
            .query_map([], |row| {
                let columns_json: String = row.get(2)?;
                let columns: Vec<KanbanColumn> =
                    serde_json::from_str(&columns_json).unwrap_or_default();

                Ok(KanbanBoard {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    columns,
                    created_at: row.get(3)?,
                    modified_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(boards)
    })
    .map_err(|e| e.to_string())
}

/// Get a specific board
#[tauri::command]
pub fn kanban_get_board(app: AppHandle, board_id: String) -> Result<KanbanBoard, String> {
    with_db(&app, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, name, columns, created_at, modified_at FROM kanban_boards WHERE id = ?1")
            .map_err(|e| e.to_string())?;

        stmt.query_row(params![board_id], |row| {
            let columns_json: String = row.get(2)?;
            let columns: Vec<KanbanColumn> =
                serde_json::from_str(&columns_json).unwrap_or_default();

            Ok(KanbanBoard {
                id: row.get(0)?,
                name: row.get(1)?,
                columns,
                created_at: row.get(3)?,
                modified_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string().into())
    })
    .map_err(|e| e.to_string())
}

/// Create a new board
#[tauri::command]
pub fn kanban_create_board(
    app: AppHandle,
    name: String,
    columns: Vec<String>,
) -> Result<KanbanBoard, String> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    let kanban_columns: Vec<KanbanColumn> = columns
        .into_iter()
        .map(|name| KanbanColumn {
            id: Uuid::new_v4().to_string(),
            name,
            color: None,
        })
        .collect();

    let columns_json = serde_json::to_string(&kanban_columns).map_err(|e| e.to_string())?;

    with_db(&app, |conn| {
        conn.execute(
            "INSERT INTO kanban_boards (id, name, columns, created_at, modified_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, name, columns_json, now, now],
        )
        .map_err(|e| e.to_string())?;

        Ok(KanbanBoard {
            id: id.clone(),
            name,
            columns: kanban_columns,
            created_at: now,
            modified_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Delete a board
#[tauri::command]
pub fn kanban_delete_board(app: AppHandle, board_id: String) -> Result<(), String> {
    with_db(&app, |conn| {
        conn.execute("DELETE FROM kanban_boards WHERE id = ?1", params![board_id])
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}

/// Add a column to a board
#[tauri::command]
pub fn kanban_add_column(app: AppHandle, board_id: String, name: String) -> Result<KanbanBoard, String> {
    with_db(&app, |conn| {
        // Get current columns
        let columns_json: String = conn
            .query_row(
                "SELECT columns FROM kanban_boards WHERE id = ?1",
                params![board_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let mut columns: Vec<KanbanColumn> =
            serde_json::from_str(&columns_json).unwrap_or_default();

        // Add new column
        columns.push(KanbanColumn {
            id: Uuid::new_v4().to_string(),
            name,
            color: None,
        });

        let new_columns_json = serde_json::to_string(&columns).map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "UPDATE kanban_boards SET columns = ?1, modified_at = ?2 WHERE id = ?3",
            params![new_columns_json, now, board_id],
        )
        .map_err(|e| e.to_string())?;

        // Return updated board
        let board_name: String = conn
            .query_row(
                "SELECT name FROM kanban_boards WHERE id = ?1",
                params![board_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let created_at: i64 = conn
            .query_row(
                "SELECT created_at FROM kanban_boards WHERE id = ?1",
                params![board_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        Ok(KanbanBoard {
            id: board_id,
            name: board_name,
            columns,
            created_at,
            modified_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Remove a column from a board
#[tauri::command]
pub fn kanban_remove_column(
    app: AppHandle,
    board_id: String,
    column_id: String,
) -> Result<KanbanBoard, String> {
    with_db(&app, |conn| {
        // Get current columns
        let columns_json: String = conn
            .query_row(
                "SELECT columns FROM kanban_boards WHERE id = ?1",
                params![board_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let mut columns: Vec<KanbanColumn> =
            serde_json::from_str(&columns_json).unwrap_or_default();

        // Remove column
        columns.retain(|c| c.id != column_id);

        let new_columns_json = serde_json::to_string(&columns).map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "UPDATE kanban_boards SET columns = ?1, modified_at = ?2 WHERE id = ?3",
            params![new_columns_json, now, board_id],
        )
        .map_err(|e| e.to_string())?;

        // Delete cards in this column
        conn.execute(
            "DELETE FROM kanban_cards WHERE column_id = ?1",
            params![column_id],
        )
        .map_err(|e| e.to_string())?;

        // Return updated board
        let board_name: String = conn
            .query_row(
                "SELECT name FROM kanban_boards WHERE id = ?1",
                params![board_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let created_at: i64 = conn
            .query_row(
                "SELECT created_at FROM kanban_boards WHERE id = ?1",
                params![board_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        Ok(KanbanBoard {
            id: board_id,
            name: board_name,
            columns,
            created_at,
            modified_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Get cards for a board
#[tauri::command]
pub fn kanban_get_cards(app: AppHandle, board_id: String) -> Result<Vec<KanbanCard>, String> {
    with_db(&app, |conn| {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT c.id, c.board_id, c.column_id, c.title, c.note_id, c.position, c.metadata, n.path
                FROM kanban_cards c
                LEFT JOIN notes n ON c.note_id = n.id
                WHERE c.board_id = ?1
                ORDER BY c.position
                "#,
            )
            .map_err(|e| e.to_string())?;

        let cards = stmt
            .query_map(params![board_id], |row| {
                let metadata_str: Option<String> = row.get(6)?;
                let metadata = metadata_str.and_then(|s| serde_json::from_str(&s).ok());

                Ok(KanbanCard {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    column_id: row.get(2)?,
                    title: row.get(3)?,
                    note_id: row.get(4)?,
                    position: row.get(5)?,
                    metadata,
                    note_path: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(cards)
    })
    .map_err(|e| e.to_string())
}

/// Add a card to a board
#[tauri::command]
pub fn kanban_add_card(
    app: AppHandle,
    board_id: String,
    column_id: String,
    title: String,
    note_id: Option<String>,
) -> Result<KanbanCard, String> {
    let id = Uuid::new_v4().to_string();

    with_db(&app, |conn| {
        // Get max position in column
        let max_pos: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(position), -1) FROM kanban_cards WHERE column_id = ?1",
                params![column_id],
                |row| row.get(0),
            )
            .unwrap_or(-1);

        let position = max_pos + 1;

        conn.execute(
            "INSERT INTO kanban_cards (id, board_id, column_id, title, note_id, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, board_id, column_id, title, note_id, position],
        )
        .map_err(|e| e.to_string())?;

        Ok(KanbanCard {
            id,
            board_id,
            column_id,
            title,
            note_id,
            note_path: None,
            position,
            metadata: None,
        })
    })
    .map_err(|e| e.to_string())
}

/// Move a card to a different column/position
#[tauri::command]
pub fn kanban_move_card(
    app: AppHandle,
    card_id: String,
    to_column_id: String,
    position: i32,
) -> Result<(), String> {
    with_db(&app, |conn| {
        conn.execute(
            "UPDATE kanban_cards SET column_id = ?1, position = ?2 WHERE id = ?3",
            params![to_column_id, position, card_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}

/// Delete a card
#[tauri::command]
pub fn kanban_delete_card(app: AppHandle, card_id: String) -> Result<(), String> {
    with_db(&app, |conn| {
        conn.execute("DELETE FROM kanban_cards WHERE id = ?1", params![card_id])
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}
