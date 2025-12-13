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
    #[serde(rename = "isDone", default)]
    pub is_done: bool,
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

/// Metadata stored in the card's JSON metadata field
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct CardMetadata {
    #[serde(default)]
    pub assignees: Vec<String>,
    #[serde(default)]
    pub labels: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KanbanCard {
    pub id: String,
    #[serde(rename = "boardId")]
    pub board_id: String,
    #[serde(rename = "columnId")]
    pub column_id: String,
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "noteId")]
    pub note_id: Option<String>,
    #[serde(rename = "notePath")]
    pub note_path: Option<String>,
    pub position: i32,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "closedAt")]
    pub closed_at: Option<i64>,
    #[serde(rename = "dueDate")]
    pub due_date: Option<i64>,
    pub priority: Option<String>,
    pub metadata: Option<CardMetadata>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KanbanLabel {
    pub id: String,
    #[serde(rename = "boardId")]
    pub board_id: String,
    pub name: String,
    pub color: String,
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
        .map(|col_name| {
            // Auto-mark "Done" column as a completion column
            let is_done = col_name.eq_ignore_ascii_case("done")
                || col_name.eq_ignore_ascii_case("complete")
                || col_name.eq_ignore_ascii_case("completed")
                || col_name.eq_ignore_ascii_case("finished");
            KanbanColumn {
                id: Uuid::new_v4().to_string(),
                name: col_name,
                color: None,
                is_done,
            }
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
pub fn kanban_add_column(
    app: AppHandle,
    board_id: String,
    name: String,
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

        // Add new column
        columns.push(KanbanColumn {
            id: Uuid::new_v4().to_string(),
            name,
            color: None,
            is_done: false,
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
                SELECT c.id, c.board_id, c.column_id, c.title, c.description, c.note_id,
                       c.position, c.created_at, c.updated_at, c.closed_at, c.due_date,
                       c.priority, c.metadata, n.path
                FROM kanban_cards c
                LEFT JOIN notes n ON c.note_id = n.id
                WHERE c.board_id = ?1
                ORDER BY c.position
                "#,
            )
            .map_err(|e| e.to_string())?;

        let now = chrono::Utc::now().timestamp();
        let cards = stmt
            .query_map(params![board_id], |row| {
                let metadata_str: Option<String> = row.get(12)?;
                let metadata: Option<CardMetadata> =
                    metadata_str.and_then(|s| serde_json::from_str(&s).ok());

                Ok(KanbanCard {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    column_id: row.get(2)?,
                    title: row.get(3)?,
                    description: row.get(4)?,
                    note_id: row.get(5)?,
                    note_path: row.get(13)?,
                    position: row.get(6)?,
                    created_at: row.get::<_, Option<i64>>(7)?.unwrap_or(now),
                    updated_at: row.get::<_, Option<i64>>(8)?.unwrap_or(now),
                    closed_at: row.get(9)?,
                    due_date: row.get(10)?,
                    priority: row.get(11)?,
                    metadata,
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
    let now = chrono::Utc::now().timestamp();

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
            "INSERT INTO kanban_cards (id, board_id, column_id, title, note_id, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, board_id, column_id, title, note_id, position, now, now],
        )
        .map_err(|e| e.to_string())?;

        Ok(KanbanCard {
            id,
            board_id,
            column_id,
            title,
            description: None,
            note_id,
            note_path: None,
            position,
            created_at: now,
            updated_at: now,
            closed_at: None,
            due_date: None,
            priority: None,
            metadata: None,
        })
    })
    .map_err(|e| e.to_string())
}

/// Move a card to a different column/position
#[tauri::command]
pub fn kanban_move_card(
    app: AppHandle,
    board_id: String,
    card_id: String,
    to_column_id: String,
    position: i32,
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        // Get the board's columns to check if destination is a "done" column
        let columns_json: String = conn
            .query_row(
                "SELECT columns FROM kanban_boards WHERE id = ?1",
                params![board_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let columns: Vec<KanbanColumn> =
            serde_json::from_str(&columns_json).unwrap_or_default();

        let target_column = columns.iter().find(|c| c.id == to_column_id);
        let is_done_column = target_column.map(|c| c.is_done).unwrap_or(false);

        // Get the card's current column to check if moving FROM a done column
        let current_column_id: String = conn
            .query_row(
                "SELECT column_id FROM kanban_cards WHERE id = ?1",
                params![card_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let from_column = columns.iter().find(|c| c.id == current_column_id);
        let was_in_done_column = from_column.map(|c| c.is_done).unwrap_or(false);

        // Determine closed_at value:
        // - Moving TO done column: set closed_at = now
        // - Moving FROM done column to non-done: clear closed_at
        // - Otherwise: keep existing value
        if is_done_column && !was_in_done_column {
            // Moving to done column - set closed_at
            conn.execute(
                "UPDATE kanban_cards SET column_id = ?1, position = ?2, updated_at = ?3, closed_at = ?3 WHERE id = ?4",
                params![to_column_id, position, now, card_id],
            )
            .map_err(|e| e.to_string())?;
        } else if !is_done_column && was_in_done_column {
            // Moving from done column - clear closed_at
            conn.execute(
                "UPDATE kanban_cards SET column_id = ?1, position = ?2, updated_at = ?3, closed_at = NULL WHERE id = ?4",
                params![to_column_id, position, now, card_id],
            )
            .map_err(|e| e.to_string())?;
        } else {
            // Just update position and updated_at
            conn.execute(
                "UPDATE kanban_cards SET column_id = ?1, position = ?2, updated_at = ?3 WHERE id = ?4",
                params![to_column_id, position, now, card_id],
            )
            .map_err(|e| e.to_string())?;
        }

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

/// Get a single card by ID
#[tauri::command]
pub fn kanban_get_card(app: AppHandle, card_id: String) -> Result<KanbanCard, String> {
    with_db(&app, |conn| {
        let now = chrono::Utc::now().timestamp();
        conn.query_row(
            r#"
            SELECT c.id, c.board_id, c.column_id, c.title, c.description, c.note_id,
                   c.position, c.created_at, c.updated_at, c.closed_at, c.due_date,
                   c.priority, c.metadata, n.path
            FROM kanban_cards c
            LEFT JOIN notes n ON c.note_id = n.id
            WHERE c.id = ?1
            "#,
            params![card_id],
            |row| {
                let metadata_str: Option<String> = row.get(12)?;
                let metadata: Option<CardMetadata> =
                    metadata_str.and_then(|s| serde_json::from_str(&s).ok());

                Ok(KanbanCard {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    column_id: row.get(2)?,
                    title: row.get(3)?,
                    description: row.get(4)?,
                    note_id: row.get(5)?,
                    note_path: row.get(13)?,
                    position: row.get(6)?,
                    created_at: row.get::<_, Option<i64>>(7)?.unwrap_or(now),
                    updated_at: row.get::<_, Option<i64>>(8)?.unwrap_or(now),
                    closed_at: row.get(9)?,
                    due_date: row.get(10)?,
                    priority: row.get(11)?,
                    metadata,
                })
            },
        )
        .map_err(|e| e.to_string().into())
    })
    .map_err(|e| e.to_string())
}

/// Update card details
#[tauri::command]
pub fn kanban_update_card(
    app: AppHandle,
    card_id: String,
    title: Option<String>,
    description: Option<String>,
    due_date: Option<i64>,
    priority: Option<String>,
    assignees: Option<Vec<String>>,
    labels: Option<Vec<String>>,
) -> Result<KanbanCard, String> {
    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        // Get current card data
        let (current_title, current_desc, current_due, current_priority, current_metadata): (
            String,
            Option<String>,
            Option<i64>,
            Option<String>,
            Option<String>,
        ) = conn
            .query_row(
                "SELECT title, description, due_date, priority, metadata FROM kanban_cards WHERE id = ?1",
                params![card_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .map_err(|e| e.to_string())?;

        // Parse current metadata
        let mut metadata: CardMetadata = current_metadata
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        // Apply updates
        let new_title = title.unwrap_or(current_title);
        let new_description = description.or(current_desc);
        let new_due_date = due_date.or(current_due);
        let new_priority = priority.or(current_priority);

        if let Some(new_assignees) = assignees {
            metadata.assignees = new_assignees;
        }
        if let Some(new_labels) = labels {
            metadata.labels = new_labels;
        }

        let metadata_json = serde_json::to_string(&metadata).map_err(|e| e.to_string())?;

        conn.execute(
            r#"
            UPDATE kanban_cards
            SET title = ?1, description = ?2, due_date = ?3, priority = ?4, metadata = ?5, updated_at = ?6
            WHERE id = ?7
            "#,
            params![new_title, new_description, new_due_date, new_priority, metadata_json, now, card_id],
        )
        .map_err(|e| e.to_string())?;

        // Return updated card by querying it
        let metadata_str: Option<String> = conn
            .query_row(
                "SELECT metadata FROM kanban_cards WHERE id = ?1",
                params![card_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        let metadata: Option<CardMetadata> =
            metadata_str.and_then(|s| serde_json::from_str(&s).ok());

        conn.query_row(
            r#"
            SELECT c.id, c.board_id, c.column_id, c.title, c.description, c.note_id,
                   c.position, c.created_at, c.updated_at, c.closed_at, c.due_date,
                   c.priority, n.path
            FROM kanban_cards c
            LEFT JOIN notes n ON c.note_id = n.id
            WHERE c.id = ?1
            "#,
            params![card_id],
            |row| {
                Ok(KanbanCard {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    column_id: row.get(2)?,
                    title: row.get(3)?,
                    description: row.get(4)?,
                    note_id: row.get(5)?,
                    note_path: row.get(12)?,
                    position: row.get(6)?,
                    created_at: row.get::<_, Option<i64>>(7)?.unwrap_or(now),
                    updated_at: row.get::<_, Option<i64>>(8)?.unwrap_or(now),
                    closed_at: row.get(9)?,
                    due_date: row.get(10)?,
                    priority: row.get(11)?,
                    metadata,
                })
            },
        )
        .map_err(|e| e.to_string().into())
    })
    .map_err(|e| e.to_string())
}

/// Update a column's properties (name, color, isDone)
#[tauri::command]
pub fn kanban_update_column(
    app: AppHandle,
    board_id: String,
    column_id: String,
    name: Option<String>,
    color: Option<String>,
    is_done: Option<bool>,
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

        // Find and update the column
        if let Some(col) = columns.iter_mut().find(|c| c.id == column_id) {
            if let Some(new_name) = name {
                col.name = new_name;
            }
            if let Some(new_color) = color {
                col.color = Some(new_color);
            }
            if let Some(new_is_done) = is_done {
                col.is_done = new_is_done;
            }
        }

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

// ============= Label CRUD operations =============

/// Get all labels for a board
#[tauri::command]
pub fn kanban_get_labels(app: AppHandle, board_id: String) -> Result<Vec<KanbanLabel>, String> {
    with_db(&app, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, board_id, name, color FROM kanban_labels WHERE board_id = ?1 ORDER BY name")
            .map_err(|e| e.to_string())?;

        let labels = stmt
            .query_map(params![board_id], |row| {
                Ok(KanbanLabel {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(labels)
    })
    .map_err(|e| e.to_string())
}

/// Create a new label
#[tauri::command]
pub fn kanban_create_label(
    app: AppHandle,
    board_id: String,
    name: String,
    color: String,
) -> Result<KanbanLabel, String> {
    let id = Uuid::new_v4().to_string();

    with_db(&app, |conn| {
        conn.execute(
            "INSERT INTO kanban_labels (id, board_id, name, color) VALUES (?1, ?2, ?3, ?4)",
            params![id, board_id, name, color],
        )
        .map_err(|e| e.to_string())?;

        Ok(KanbanLabel {
            id,
            board_id,
            name,
            color,
        })
    })
    .map_err(|e| e.to_string())
}

/// Update a label
#[tauri::command]
pub fn kanban_update_label(
    app: AppHandle,
    label_id: String,
    name: String,
    color: String,
) -> Result<KanbanLabel, String> {
    with_db(&app, |conn| {
        conn.execute(
            "UPDATE kanban_labels SET name = ?1, color = ?2 WHERE id = ?3",
            params![name, color, label_id],
        )
        .map_err(|e| e.to_string())?;

        // Get the updated label
        conn.query_row(
            "SELECT id, board_id, name, color FROM kanban_labels WHERE id = ?1",
            params![label_id],
            |row| {
                Ok(KanbanLabel {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3)?,
                })
            },
        )
        .map_err(|e| e.to_string().into())
    })
    .map_err(|e| e.to_string())
}

/// Delete a label
#[tauri::command]
pub fn kanban_delete_label(app: AppHandle, label_id: String) -> Result<(), String> {
    with_db(&app, |conn| {
        conn.execute("DELETE FROM kanban_labels WHERE id = ?1", params![label_id])
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}

// ============= Board Member operations =============

#[derive(Debug, Serialize, Deserialize)]
pub struct BoardMember {
    pub id: String,
    #[serde(rename = "boardId")]
    pub board_id: String,
    pub name: String,
    #[serde(rename = "addedAt")]
    pub added_at: i64,
}

/// Get all members for a board
#[tauri::command]
pub fn kanban_get_board_members(
    app: AppHandle,
    board_id: String,
) -> Result<Vec<BoardMember>, String> {
    with_db(&app, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, board_id, name, added_at FROM kanban_board_members WHERE board_id = ?1 ORDER BY name")
            .map_err(|e| e.to_string())?;

        let members = stmt
            .query_map(params![board_id], |row| {
                Ok(BoardMember {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    name: row.get(2)?,
                    added_at: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(members)
    })
    .map_err(|e| e.to_string())
}

/// Add a member to a board
#[tauri::command]
pub fn kanban_add_board_member(
    app: AppHandle,
    board_id: String,
    name: String,
) -> Result<BoardMember, String> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        conn.execute(
            "INSERT OR IGNORE INTO kanban_board_members (id, board_id, name, added_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, board_id, name, now],
        )
        .map_err(|e| e.to_string())?;

        Ok(BoardMember {
            id,
            board_id,
            name,
            added_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Remove a member from a board
#[tauri::command]
pub fn kanban_remove_board_member(app: AppHandle, member_id: String) -> Result<(), String> {
    with_db(&app, |conn| {
        conn.execute(
            "DELETE FROM kanban_board_members WHERE id = ?1",
            params![member_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}

/// Get assignee suggestions - returns ALL unique members across all boards (global)
#[tauri::command]
pub fn kanban_get_assignee_suggestions(
    app: AppHandle,
    _board_id: Option<String>,
) -> Result<Vec<String>, String> {
    with_db(&app, |conn| {
        // Return all unique member names across all boards
        let mut stmt = conn
            .prepare("SELECT DISTINCT name FROM kanban_board_members ORDER BY name")
            .map_err(|e| e.to_string())?;

        let members: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(members)
    })
    .map_err(|e| e.to_string())
}

// ============= Card Backlinks and Lookup =============

/// A note that references a kanban card
#[derive(Debug, Serialize, Deserialize)]
pub struct CardBacklink {
    #[serde(rename = "noteId")]
    pub note_id: String,
    #[serde(rename = "notePath")]
    pub note_path: String,
    #[serde(rename = "noteTitle")]
    pub note_title: String,
    pub context: Option<String>,
}

/// Get all notes that link to a specific card
#[tauri::command]
pub fn kanban_get_card_backlinks(
    app: AppHandle,
    card_id: String,
) -> Result<Vec<CardBacklink>, String> {
    with_db(&app, |conn| {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT n.id, n.path, n.title, cb.context
                FROM card_backlinks cb
                JOIN notes n ON cb.source_id = n.id
                WHERE cb.card_id = ?1
                ORDER BY n.modified_at DESC
                "#,
            )
            .map_err(|e| e.to_string())?;

        let backlinks = stmt
            .query_map(params![card_id], |row| {
                Ok(CardBacklink {
                    note_id: row.get(0)?,
                    note_path: row.get(1)?,
                    note_title: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    context: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(backlinks)
    })
    .map_err(|e| e.to_string())
}

/// Summary of a card for autocomplete
#[derive(Debug, Serialize, Deserialize)]
pub struct KanbanCardSummary {
    pub id: String,
    pub title: String,
    #[serde(rename = "boardId")]
    pub board_id: String,
    #[serde(rename = "boardName")]
    pub board_name: String,
    #[serde(rename = "columnName")]
    pub column_name: Option<String>,
}

/// Get all cards across all boards (for autocomplete)
#[tauri::command]
pub fn kanban_get_all_cards(app: AppHandle) -> Result<Vec<KanbanCardSummary>, String> {
    with_db(&app, |conn| {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT c.id, c.title, c.board_id, b.name, b.columns, c.column_id
                FROM kanban_cards c
                JOIN kanban_boards b ON c.board_id = b.id
                ORDER BY c.updated_at DESC
                "#,
            )
            .map_err(|e| e.to_string())?;

        let cards = stmt
            .query_map([], |row| {
                let columns_json: String = row.get(4)?;
                let column_id: String = row.get(5)?;
                let columns: Vec<KanbanColumn> =
                    serde_json::from_str(&columns_json).unwrap_or_default();
                let column_name = columns
                    .iter()
                    .find(|c| c.id == column_id)
                    .map(|c| c.name.clone());

                Ok(KanbanCardSummary {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    board_id: row.get(2)?,
                    board_name: row.get(3)?,
                    column_name,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(cards)
    })
    .map_err(|e| e.to_string())
}

/// Find a card by title (and optionally board name)
#[tauri::command]
pub fn kanban_find_card_by_title(
    app: AppHandle,
    title: String,
    board_name: Option<String>,
) -> Result<Option<KanbanCard>, String> {
    with_db(&app, |conn| {
        let now = chrono::Utc::now().timestamp();

        let result = if let Some(bn) = board_name {
            conn.query_row(
                r#"
                SELECT c.id, c.board_id, c.column_id, c.title, c.description, c.note_id,
                       c.position, c.created_at, c.updated_at, c.closed_at, c.due_date,
                       c.priority, c.metadata, n.path
                FROM kanban_cards c
                JOIN kanban_boards b ON c.board_id = b.id
                LEFT JOIN notes n ON c.note_id = n.id
                WHERE LOWER(c.title) = LOWER(?1) AND LOWER(b.name) = LOWER(?2)
                LIMIT 1
                "#,
                params![title, bn],
                |row| {
                    let metadata_str: Option<String> = row.get(12)?;
                    let metadata: Option<CardMetadata> =
                        metadata_str.and_then(|s| serde_json::from_str(&s).ok());

                    Ok(KanbanCard {
                        id: row.get(0)?,
                        board_id: row.get(1)?,
                        column_id: row.get(2)?,
                        title: row.get(3)?,
                        description: row.get(4)?,
                        note_id: row.get(5)?,
                        note_path: row.get(13)?,
                        position: row.get(6)?,
                        created_at: row.get::<_, Option<i64>>(7)?.unwrap_or(now),
                        updated_at: row.get::<_, Option<i64>>(8)?.unwrap_or(now),
                        closed_at: row.get(9)?,
                        due_date: row.get(10)?,
                        priority: row.get(11)?,
                        metadata,
                    })
                },
            )
        } else {
            conn.query_row(
                r#"
                SELECT c.id, c.board_id, c.column_id, c.title, c.description, c.note_id,
                       c.position, c.created_at, c.updated_at, c.closed_at, c.due_date,
                       c.priority, c.metadata, n.path
                FROM kanban_cards c
                LEFT JOIN notes n ON c.note_id = n.id
                WHERE LOWER(c.title) = LOWER(?1)
                LIMIT 1
                "#,
                params![title],
                |row| {
                    let metadata_str: Option<String> = row.get(12)?;
                    let metadata: Option<CardMetadata> =
                        metadata_str.and_then(|s| serde_json::from_str(&s).ok());

                    Ok(KanbanCard {
                        id: row.get(0)?,
                        board_id: row.get(1)?,
                        column_id: row.get(2)?,
                        title: row.get(3)?,
                        description: row.get(4)?,
                        note_id: row.get(5)?,
                        note_path: row.get(13)?,
                        position: row.get(6)?,
                        created_at: row.get::<_, Option<i64>>(7)?.unwrap_or(now),
                        updated_at: row.get::<_, Option<i64>>(8)?.unwrap_or(now),
                        closed_at: row.get(9)?,
                        due_date: row.get(10)?,
                        priority: row.get(11)?,
                        metadata,
                    })
                },
            )
        };

        match result {
            Ok(card) => Ok(Some(card)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string().into()),
        }
    })
    .map_err(|e| e.to_string())
}
