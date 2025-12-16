use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;

use crate::db::with_db;

// ============= Data Structures =============

/// Viewport state for a diagram board
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Viewport {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

/// A linked note reference
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LinkedNote {
    #[serde(rename = "noteId")]
    pub note_id: String,
    #[serde(rename = "notePath")]
    pub note_path: String,
}

/// A diagram board container
#[derive(Debug, Serialize, Deserialize)]
pub struct DiagramBoard {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    /// Legacy single note link (kept for backwards compatibility)
    #[serde(rename = "noteId")]
    pub note_id: Option<String>,
    #[serde(rename = "notePath")]
    pub note_path: Option<String>,
    /// Multiple linked notes
    #[serde(rename = "linkedNotes")]
    pub linked_notes: Vec<LinkedNote>,
    pub viewport: Viewport,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: i64,
}

/// Data stored in a node's JSON data field
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct NodeData {
    pub label: Option<String>,
    #[serde(rename = "shapeType")]
    pub shape_type: Option<String>, // 'rectangle', 'circle', 'diamond', 'cylinder', 'hexagon'
    pub icon: Option<String>, // Icon identifier (e.g., 'Server', 'Database')
    pub color: Option<String>, // Background color
    #[serde(rename = "borderColor")]
    pub border_color: Option<String>,
    #[serde(rename = "fontSize")]
    pub font_size: Option<f64>,
    // Group/container specific properties
    #[serde(rename = "borderStyle")]
    pub border_style: Option<String>, // 'solid', 'dashed', 'dotted'
    #[serde(rename = "borderWidth")]
    pub border_width: Option<f64>,
    pub opacity: Option<f64>, // 0-1 for fill opacity
    // Selection grouping - nodes with same groupId move together
    #[serde(rename = "selectionGroupId")]
    pub selection_group_id: Option<String>,
    // Text formatting
    #[serde(rename = "fontWeight")]
    pub font_weight: Option<String>, // 'normal', 'bold'
    #[serde(rename = "fontStyle")]
    pub font_style: Option<String>, // 'normal', 'italic'
    #[serde(rename = "textAlign")]
    pub text_align: Option<String>, // 'left', 'center', 'right'
    // Corner radius for rectangles
    #[serde(rename = "borderRadius")]
    pub border_radius: Option<f64>,
    // Layer assignment
    #[serde(rename = "layerId")]
    pub layer_id: Option<String>,
    // Image node specific
    #[serde(rename = "imageUrl")]
    pub image_url: Option<String>,
    #[serde(rename = "imageFit")]
    pub image_fit: Option<String>, // 'contain', 'cover', 'fill'
    // Swimlane specific
    #[serde(rename = "swimlaneOrientation")]
    pub swimlane_orientation: Option<String>, // 'horizontal', 'vertical'
}

/// A node in the diagram (shape, icon, or text)
#[derive(Debug, Serialize, Deserialize)]
pub struct DiagramNode {
    pub id: String,
    #[serde(rename = "boardId")]
    pub board_id: String,
    #[serde(rename = "nodeType")]
    pub node_type: String, // 'shape', 'icon', 'text', 'group'
    #[serde(rename = "positionX")]
    pub position_x: f64,
    #[serde(rename = "positionY")]
    pub position_y: f64,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub data: NodeData,
    #[serde(rename = "zIndex")]
    pub z_index: i32,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Waypoint for edge routing
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Waypoint {
    pub x: f64,
    pub y: f64,
}

/// Data stored in an edge's JSON data field
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct EdgeData {
    pub label: Option<String>,
    pub color: Option<String>,
    pub animated: Option<bool>,
    // Arrow styles
    #[serde(rename = "sourceArrow")]
    pub source_arrow: Option<String>, // 'none', 'arrow', 'arrowclosed', 'diamond', 'circle'
    #[serde(rename = "targetArrow")]
    pub target_arrow: Option<String>,
    // Line styling
    #[serde(rename = "strokeWidth")]
    pub stroke_width: Option<f64>,
    #[serde(rename = "strokeStyle")]
    pub stroke_style: Option<String>, // 'solid', 'dashed', 'dotted'
    // Label positioning
    #[serde(rename = "labelPosition")]
    pub label_position: Option<String>, // 'start', 'center', 'end'
    #[serde(rename = "labelBgColor")]
    pub label_bg_color: Option<String>,
    // Waypoints for manual edge routing
    pub waypoints: Option<Vec<Waypoint>>,
}

/// An edge connecting two nodes
#[derive(Debug, Serialize, Deserialize)]
pub struct DiagramEdge {
    pub id: String,
    #[serde(rename = "boardId")]
    pub board_id: String,
    #[serde(rename = "sourceNodeId")]
    pub source_node_id: String,
    #[serde(rename = "targetNodeId")]
    pub target_node_id: String,
    #[serde(rename = "sourceHandle")]
    pub source_handle: Option<String>, // 'top', 'right', 'bottom', 'left'
    #[serde(rename = "targetHandle")]
    pub target_handle: Option<String>,
    #[serde(rename = "edgeType")]
    pub edge_type: String, // 'default', 'straight', 'step', 'smoothstep'
    pub data: Option<EdgeData>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Full board data including nodes and edges
#[derive(Debug, Serialize, Deserialize)]
pub struct DiagramBoardFull {
    pub board: DiagramBoard,
    pub nodes: Vec<DiagramNode>,
    pub edges: Vec<DiagramEdge>,
}

/// Bulk update request for node positions
#[derive(Debug, Serialize, Deserialize)]
pub struct NodePositionUpdate {
    pub id: String,
    #[serde(rename = "positionX")]
    pub position_x: f64,
    #[serde(rename = "positionY")]
    pub position_y: f64,
}

// ============= Validation =============

/// Valid node types
const VALID_NODE_TYPES: &[&str] = &["shape", "icon", "text", "group", "image", "swimlane"];

/// Valid edge types
const VALID_EDGE_TYPES: &[&str] = &["default", "straight", "step", "smoothstep"];

fn validate_node_type(node_type: &str) -> Result<(), String> {
    if VALID_NODE_TYPES.contains(&node_type) {
        Ok(())
    } else {
        Err(format!(
            "Invalid node type: {}. Must be one of: {:?}",
            node_type, VALID_NODE_TYPES
        ))
    }
}

fn validate_edge_type(edge_type: &str) -> Result<(), String> {
    if VALID_EDGE_TYPES.contains(&edge_type) {
        Ok(())
    } else {
        Err(format!(
            "Invalid edge type: {}. Must be one of: {:?}",
            edge_type, VALID_EDGE_TYPES
        ))
    }
}

// ============= Board Commands =============

/// Helper function to fetch linked notes for a board
fn fetch_linked_notes(conn: &rusqlite::Connection, board_id: &str) -> Vec<LinkedNote> {
    let mut stmt = match conn.prepare(
        "SELECT dbn.note_id, n.path
         FROM diagram_board_notes dbn
         JOIN notes n ON dbn.note_id = n.id
         WHERE dbn.board_id = ?1
         ORDER BY dbn.created_at",
    ) {
        Ok(stmt) => stmt,
        Err(_) => return Vec::new(),
    };

    stmt.query_map(params![board_id], |row| {
        Ok(LinkedNote {
            note_id: row.get(0)?,
            note_path: row.get(1)?,
        })
    })
    .map(|rows| rows.filter_map(|r| r.ok()).collect())
    .unwrap_or_default()
}

/// List all diagram boards
#[tauri::command]
pub fn diagram_list_boards(app: AppHandle) -> Result<Vec<DiagramBoard>, String> {
    with_db(&app, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT b.id, b.name, b.description, b.note_id, n.path, b.viewport, b.created_at, b.modified_at
                 FROM diagram_boards b
                 LEFT JOIN notes n ON b.note_id = n.id
                 ORDER BY b.modified_at DESC"
            )
            .map_err(|e| e.to_string())?;

        let boards: Vec<DiagramBoard> = stmt
            .query_map([], |row| {
                let viewport_json: String = row.get(5)?;
                let viewport: Viewport = serde_json::from_str(&viewport_json).unwrap_or_default();

                Ok(DiagramBoard {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    note_id: row.get(3)?,
                    note_path: row.get(4)?,
                    linked_notes: Vec::new(), // Will be populated below
                    viewport,
                    created_at: row.get(6)?,
                    modified_at: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        // Fetch linked notes for each board
        let boards_with_links: Vec<DiagramBoard> = boards
            .into_iter()
            .map(|mut board| {
                board.linked_notes = fetch_linked_notes(conn, &board.id);
                board
            })
            .collect();

        Ok(boards_with_links)
    })
    .map_err(|e| e.to_string())
}

/// Get a board with all its nodes and edges
#[tauri::command]
pub fn diagram_get_board(app: AppHandle, board_id: String) -> Result<DiagramBoardFull, String> {
    with_db(&app, |conn| {
        // Get board with note path via LEFT JOIN
        let mut board = conn
            .query_row(
                "SELECT b.id, b.name, b.description, b.note_id, n.path, b.viewport, b.created_at, b.modified_at
                 FROM diagram_boards b
                 LEFT JOIN notes n ON b.note_id = n.id
                 WHERE b.id = ?1",
                params![board_id],
                |row| {
                    let viewport_json: String = row.get(5)?;
                    let viewport: Viewport = serde_json::from_str(&viewport_json).unwrap_or_default();

                    Ok(DiagramBoard {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        description: row.get(2)?,
                        note_id: row.get(3)?,
                        note_path: row.get(4)?,
                        linked_notes: Vec::new(), // Will be populated below
                        viewport,
                        created_at: row.get(6)?,
                        modified_at: row.get(7)?,
                    })
                },
            )
            .map_err(|e| e.to_string())?;

        // Fetch linked notes
        board.linked_notes = fetch_linked_notes(conn, &board_id);

        // Get nodes
        let mut node_stmt = conn
            .prepare(
                "SELECT id, board_id, node_type, position_x, position_y, width, height, data, z_index, created_at, updated_at
                 FROM diagram_nodes WHERE board_id = ?1 ORDER BY z_index"
            )
            .map_err(|e| e.to_string())?;

        let nodes: Vec<DiagramNode> = node_stmt
            .query_map(params![board_id], |row| {
                let data_json: String = row.get(7)?;
                let data: NodeData = serde_json::from_str(&data_json).unwrap_or_default();

                Ok(DiagramNode {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    node_type: row.get(2)?,
                    position_x: row.get(3)?,
                    position_y: row.get(4)?,
                    width: row.get(5)?,
                    height: row.get(6)?,
                    data,
                    z_index: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        // Get edges
        let mut edge_stmt = conn
            .prepare(
                "SELECT id, board_id, source_node_id, target_node_id, source_handle, target_handle, edge_type, data, created_at, updated_at
                 FROM diagram_edges WHERE board_id = ?1"
            )
            .map_err(|e| e.to_string())?;

        let edges: Vec<DiagramEdge> = edge_stmt
            .query_map(params![board_id], |row| {
                let data_json: Option<String> = row.get(7)?;
                let data: Option<EdgeData> = data_json.and_then(|s| serde_json::from_str(&s).ok());

                Ok(DiagramEdge {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    source_node_id: row.get(2)?,
                    target_node_id: row.get(3)?,
                    source_handle: row.get(4)?,
                    target_handle: row.get(5)?,
                    edge_type: row.get(6)?,
                    data,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(DiagramBoardFull { board, nodes, edges })
    })
    .map_err(|e| e.to_string())
}

/// Create a new diagram board
#[tauri::command]
pub fn diagram_create_board(
    app: AppHandle,
    name: String,
    description: Option<String>,
) -> Result<DiagramBoard, String> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let viewport = Viewport {
        x: 0.0,
        y: 0.0,
        zoom: 1.0,
    };
    let viewport_json = serde_json::to_string(&viewport).map_err(|e| e.to_string())?;

    with_db(&app, |conn| {
        conn.execute(
            "INSERT INTO diagram_boards (id, name, description, viewport, created_at, modified_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, name, description, viewport_json, now, now],
        )
        .map_err(|e| e.to_string())?;

        Ok(DiagramBoard {
            id,
            name,
            description,
            note_id: None,
            note_path: None,
            linked_notes: Vec::new(),
            viewport,
            created_at: now,
            modified_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Update a diagram board's properties
#[tauri::command]
pub fn diagram_update_board(
    app: AppHandle,
    board_id: String,
    name: Option<String>,
    description: Option<String>,
    viewport: Option<Viewport>,
) -> Result<DiagramBoard, String> {
    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        // Get current board
        let (current_name, current_desc, current_viewport_json, created_at, current_note_id): (String, Option<String>, String, i64, Option<String>) = conn
            .query_row(
                "SELECT name, description, viewport, created_at, note_id FROM diagram_boards WHERE id = ?1",
                params![board_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .map_err(|e| e.to_string())?;

        let new_name = name.unwrap_or(current_name);
        let new_desc = description.or(current_desc);
        let new_viewport = viewport.unwrap_or_else(|| {
            serde_json::from_str(&current_viewport_json).unwrap_or_default()
        });
        let new_viewport_json = serde_json::to_string(&new_viewport).map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE diagram_boards SET name = ?1, description = ?2, viewport = ?3, modified_at = ?4 WHERE id = ?5",
            params![new_name, new_desc, new_viewport_json, now, board_id],
        )
        .map_err(|e| e.to_string())?;

        // Get note path if linked
        let note_path: Option<String> = if let Some(ref nid) = current_note_id {
            conn.query_row(
                "SELECT path FROM notes WHERE id = ?1",
                params![nid],
                |row| row.get(0),
            ).ok()
        } else {
            None
        };

        // Fetch linked notes
        let linked_notes = fetch_linked_notes(conn, &board_id);

        Ok(DiagramBoard {
            id: board_id,
            name: new_name,
            description: new_desc,
            note_id: current_note_id,
            note_path,
            linked_notes,
            viewport: new_viewport,
            created_at,
            modified_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Link or unlink a note to a diagram board (legacy - updates single note_id)
#[tauri::command]
pub fn diagram_link_note(
    app: AppHandle,
    board_id: String,
    note_id: Option<String>,
) -> Result<DiagramBoard, String> {
    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        // Update the note_id
        conn.execute(
            "UPDATE diagram_boards SET note_id = ?1, modified_at = ?2 WHERE id = ?3",
            params![note_id, now, board_id],
        )
        .map_err(|e| e.to_string())?;

        // Get board data
        let (name, description, viewport_json, created_at, current_note_id): (String, Option<String>, String, i64, Option<String>) = conn
            .query_row(
                "SELECT name, description, viewport, created_at, note_id FROM diagram_boards WHERE id = ?1",
                params![board_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .map_err(|e| e.to_string())?;

        let viewport: Viewport = serde_json::from_str(&viewport_json).unwrap_or_default();

        // Get note path if linked
        let note_path: Option<String> = if let Some(ref nid) = current_note_id {
            conn.query_row(
                "SELECT path FROM notes WHERE id = ?1",
                params![nid],
                |row| row.get(0),
            ).ok()
        } else {
            None
        };

        // Fetch linked notes
        let linked_notes = fetch_linked_notes(conn, &board_id);

        Ok(DiagramBoard {
            id: board_id,
            name,
            description,
            note_id: current_note_id,
            note_path,
            linked_notes,
            viewport,
            created_at,
            modified_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Add a note link to a diagram board (multiple notes support)
#[tauri::command]
pub fn diagram_add_note_link(
    app: AppHandle,
    board_id: String,
    note_id: String,
) -> Result<DiagramBoard, String> {
    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        // Verify the note exists
        let _note_path: String = conn
            .query_row(
                "SELECT path FROM notes WHERE id = ?1",
                params![note_id],
                |row| row.get(0),
            )
            .map_err(|_| "Note not found")?;

        // Insert into junction table (ignore if already exists)
        conn.execute(
            "INSERT OR IGNORE INTO diagram_board_notes (board_id, note_id, created_at) VALUES (?1, ?2, ?3)",
            params![board_id, note_id, now],
        )
        .map_err(|e| e.to_string())?;

        // Update board modified_at
        conn.execute(
            "UPDATE diagram_boards SET modified_at = ?1 WHERE id = ?2",
            params![now, board_id],
        )
        .map_err(|e| e.to_string())?;

        // Fetch and return updated board
        let (name, description, viewport_json, created_at, legacy_note_id): (String, Option<String>, String, i64, Option<String>) = conn
            .query_row(
                "SELECT name, description, viewport, created_at, note_id FROM diagram_boards WHERE id = ?1",
                params![board_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .map_err(|e| e.to_string())?;

        let viewport: Viewport = serde_json::from_str(&viewport_json).unwrap_or_default();

        // Get legacy note path if exists
        let legacy_note_path: Option<String> = if let Some(ref nid) = legacy_note_id {
            conn.query_row(
                "SELECT path FROM notes WHERE id = ?1",
                params![nid],
                |row| row.get(0),
            ).ok()
        } else {
            None
        };

        // Fetch linked notes
        let linked_notes = fetch_linked_notes(conn, &board_id);

        Ok(DiagramBoard {
            id: board_id,
            name,
            description,
            note_id: legacy_note_id,
            note_path: legacy_note_path,
            linked_notes,
            viewport,
            created_at,
            modified_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Remove a specific note link from a diagram board
#[tauri::command]
pub fn diagram_remove_note_link(
    app: AppHandle,
    board_id: String,
    note_id: String,
) -> Result<DiagramBoard, String> {
    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        // Remove from junction table
        conn.execute(
            "DELETE FROM diagram_board_notes WHERE board_id = ?1 AND note_id = ?2",
            params![board_id, note_id],
        )
        .map_err(|e| e.to_string())?;

        // Update board modified_at
        conn.execute(
            "UPDATE diagram_boards SET modified_at = ?1 WHERE id = ?2",
            params![now, board_id],
        )
        .map_err(|e| e.to_string())?;

        // Fetch and return updated board
        let (name, description, viewport_json, created_at, legacy_note_id): (String, Option<String>, String, i64, Option<String>) = conn
            .query_row(
                "SELECT name, description, viewport, created_at, note_id FROM diagram_boards WHERE id = ?1",
                params![board_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .map_err(|e| e.to_string())?;

        let viewport: Viewport = serde_json::from_str(&viewport_json).unwrap_or_default();

        // Get legacy note path if exists
        let legacy_note_path: Option<String> = if let Some(ref nid) = legacy_note_id {
            conn.query_row(
                "SELECT path FROM notes WHERE id = ?1",
                params![nid],
                |row| row.get(0),
            ).ok()
        } else {
            None
        };

        // Fetch linked notes
        let linked_notes = fetch_linked_notes(conn, &board_id);

        Ok(DiagramBoard {
            id: board_id,
            name,
            description,
            note_id: legacy_note_id,
            note_path: legacy_note_path,
            linked_notes,
            viewport,
            created_at,
            modified_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Remove all note links from a diagram board
#[tauri::command]
pub fn diagram_remove_all_note_links(
    app: AppHandle,
    board_id: String,
) -> Result<DiagramBoard, String> {
    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        // Remove all from junction table
        conn.execute(
            "DELETE FROM diagram_board_notes WHERE board_id = ?1",
            params![board_id],
        )
        .map_err(|e| e.to_string())?;

        // Also clear legacy note_id
        conn.execute(
            "UPDATE diagram_boards SET note_id = NULL, modified_at = ?1 WHERE id = ?2",
            params![now, board_id],
        )
        .map_err(|e| e.to_string())?;

        // Fetch and return updated board
        let (name, description, viewport_json, created_at): (String, Option<String>, String, i64) =
            conn.query_row(
                "SELECT name, description, viewport, created_at FROM diagram_boards WHERE id = ?1",
                params![board_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|e| e.to_string())?;

        let viewport: Viewport = serde_json::from_str(&viewport_json).unwrap_or_default();

        Ok(DiagramBoard {
            id: board_id,
            name,
            description,
            note_id: None,
            note_path: None,
            linked_notes: Vec::new(),
            viewport,
            created_at,
            modified_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Delete a diagram board (cascades to nodes and edges)
#[tauri::command]
pub fn diagram_delete_board(app: AppHandle, board_id: String) -> Result<(), String> {
    with_db(&app, |conn| {
        conn.execute(
            "DELETE FROM diagram_boards WHERE id = ?1",
            params![board_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .map_err(|e| e.to_string())
}

// ============= Node Commands =============

/// Add a node to a diagram
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn diagram_add_node(
    app: AppHandle,
    board_id: String,
    node_type: String,
    position_x: f64,
    position_y: f64,
    width: Option<f64>,
    height: Option<f64>,
    data: NodeData,
) -> Result<DiagramNode, String> {
    // Validate node type
    validate_node_type(&node_type)?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let data_json = serde_json::to_string(&data).map_err(|e| e.to_string())?;

    with_db(&app, |conn| {
        // Get max z_index
        let max_z: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(z_index), 0) FROM diagram_nodes WHERE board_id = ?1",
                params![board_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let z_index = max_z + 1;

        conn.execute(
            "INSERT INTO diagram_nodes (id, board_id, node_type, position_x, position_y, width, height, data, z_index, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![id, board_id, node_type, position_x, position_y, width, height, data_json, z_index, now, now],
        )
        .map_err(|e| e.to_string())?;

        // Update board modified_at
        conn.execute(
            "UPDATE diagram_boards SET modified_at = ?1 WHERE id = ?2",
            params![now, board_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(DiagramNode {
            id,
            board_id,
            node_type,
            position_x,
            position_y,
            width,
            height,
            data,
            z_index,
            created_at: now,
            updated_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Update a node's properties
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn diagram_update_node(
    app: AppHandle,
    node_id: String,
    position_x: Option<f64>,
    position_y: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
    data: Option<NodeData>,
    z_index: Option<i32>,
) -> Result<DiagramNode, String> {
    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        // Get current node
        let (board_id, node_type, curr_x, curr_y, curr_w, curr_h, curr_data_json, curr_z, created_at):
            (String, String, f64, f64, Option<f64>, Option<f64>, String, i32, i64) = conn
            .query_row(
                "SELECT board_id, node_type, position_x, position_y, width, height, data, z_index, created_at FROM diagram_nodes WHERE id = ?1",
                params![node_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?)),
            )
            .map_err(|e| e.to_string())?;

        let new_x = position_x.unwrap_or(curr_x);
        let new_y = position_y.unwrap_or(curr_y);
        let new_w = width.or(curr_w);
        let new_h = height.or(curr_h);
        let new_z = z_index.unwrap_or(curr_z);
        let new_data = data.unwrap_or_else(|| {
            serde_json::from_str(&curr_data_json).unwrap_or_default()
        });
        let new_data_json = serde_json::to_string(&new_data).map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE diagram_nodes SET position_x = ?1, position_y = ?2, width = ?3, height = ?4, data = ?5, z_index = ?6, updated_at = ?7 WHERE id = ?8",
            params![new_x, new_y, new_w, new_h, new_data_json, new_z, now, node_id],
        )
        .map_err(|e| e.to_string())?;

        // Update board modified_at
        conn.execute(
            "UPDATE diagram_boards SET modified_at = ?1 WHERE id = ?2",
            params![now, board_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(DiagramNode {
            id: node_id,
            board_id,
            node_type,
            position_x: new_x,
            position_y: new_y,
            width: new_w,
            height: new_h,
            data: new_data,
            z_index: new_z,
            created_at,
            updated_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Delete a node (cascades to edges)
#[tauri::command]
pub fn diagram_delete_node(app: AppHandle, node_id: String) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        // Get board_id before delete
        let board_id: String = conn
            .query_row(
                "SELECT board_id FROM diagram_nodes WHERE id = ?1",
                params![node_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        conn.execute("DELETE FROM diagram_nodes WHERE id = ?1", params![node_id])
            .map_err(|e| e.to_string())?;

        // Update board modified_at
        conn.execute(
            "UPDATE diagram_boards SET modified_at = ?1 WHERE id = ?2",
            params![now, board_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    })
    .map_err(|e| e.to_string())
}

/// Bulk update node positions (for drag operations)
#[tauri::command]
pub fn diagram_bulk_update_nodes(
    app: AppHandle,
    board_id: String,
    updates: Vec<NodePositionUpdate>,
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        for update in updates {
            conn.execute(
                "UPDATE diagram_nodes SET position_x = ?1, position_y = ?2, updated_at = ?3 WHERE id = ?4 AND board_id = ?5",
                params![update.position_x, update.position_y, now, update.id, board_id],
            )
            .map_err(|e| e.to_string())?;
        }

        // Update board modified_at
        conn.execute(
            "UPDATE diagram_boards SET modified_at = ?1 WHERE id = ?2",
            params![now, board_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    })
    .map_err(|e| e.to_string())
}

// ============= Edge Commands =============

/// Add an edge between two nodes
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn diagram_add_edge(
    app: AppHandle,
    board_id: String,
    source_node_id: String,
    target_node_id: String,
    source_handle: Option<String>,
    target_handle: Option<String>,
    edge_type: Option<String>,
    data: Option<EdgeData>,
) -> Result<DiagramEdge, String> {
    let edge_type = edge_type.unwrap_or_else(|| "default".to_string());
    validate_edge_type(&edge_type)?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let data_json = data.as_ref().and_then(|d| serde_json::to_string(d).ok());

    with_db(&app, |conn| {
        // Verify both nodes exist and belong to this board
        let source_board: String = conn
            .query_row(
                "SELECT board_id FROM diagram_nodes WHERE id = ?1",
                params![source_node_id],
                |row| row.get(0),
            )
            .map_err(|_| "Source node not found")?;

        let target_board: String = conn
            .query_row(
                "SELECT board_id FROM diagram_nodes WHERE id = ?1",
                params![target_node_id],
                |row| row.get(0),
            )
            .map_err(|_| "Target node not found")?;

        if source_board != board_id || target_board != board_id {
            return Err("Nodes must belong to the same board".into());
        }

        conn.execute(
            "INSERT INTO diagram_edges (id, board_id, source_node_id, target_node_id, source_handle, target_handle, edge_type, data, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![id, board_id, source_node_id, target_node_id, source_handle, target_handle, edge_type, data_json, now, now],
        )
        .map_err(|e| e.to_string())?;

        // Update board modified_at
        conn.execute(
            "UPDATE diagram_boards SET modified_at = ?1 WHERE id = ?2",
            params![now, board_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(DiagramEdge {
            id,
            board_id,
            source_node_id,
            target_node_id,
            source_handle,
            target_handle,
            edge_type,
            data,
            created_at: now,
            updated_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Update an edge's properties
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn diagram_update_edge(
    app: AppHandle,
    edge_id: String,
    source_handle: Option<String>,
    target_handle: Option<String>,
    edge_type: Option<String>,
    data: Option<EdgeData>,
) -> Result<DiagramEdge, String> {
    if let Some(ref et) = edge_type {
        validate_edge_type(et)?;
    }

    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        // Get current edge
        #[allow(clippy::type_complexity)]
        let (board_id, source_node_id, target_node_id, curr_source_handle, curr_target_handle, curr_edge_type, curr_data_json, created_at):
            (String, String, String, Option<String>, Option<String>, String, Option<String>, i64) = conn
            .query_row(
                "SELECT board_id, source_node_id, target_node_id, source_handle, target_handle, edge_type, data, created_at FROM diagram_edges WHERE id = ?1",
                params![edge_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?)),
            )
            .map_err(|e| e.to_string())?;

        let new_source_handle = source_handle.or(curr_source_handle);
        let new_target_handle = target_handle.or(curr_target_handle);
        let new_edge_type = edge_type.unwrap_or(curr_edge_type);
        let new_data = data.or_else(|| {
            curr_data_json.and_then(|s| serde_json::from_str(&s).ok())
        });
        let new_data_json = new_data.as_ref().and_then(|d| serde_json::to_string(d).ok());

        conn.execute(
            "UPDATE diagram_edges SET source_handle = ?1, target_handle = ?2, edge_type = ?3, data = ?4, updated_at = ?5 WHERE id = ?6",
            params![new_source_handle, new_target_handle, new_edge_type, new_data_json, now, edge_id],
        )
        .map_err(|e| e.to_string())?;

        // Update board modified_at
        conn.execute(
            "UPDATE diagram_boards SET modified_at = ?1 WHERE id = ?2",
            params![now, board_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(DiagramEdge {
            id: edge_id,
            board_id,
            source_node_id,
            target_node_id,
            source_handle: new_source_handle,
            target_handle: new_target_handle,
            edge_type: new_edge_type,
            data: new_data,
            created_at,
            updated_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

/// Delete an edge
#[tauri::command]
pub fn diagram_delete_edge(app: AppHandle, edge_id: String) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp();

    with_db(&app, |conn| {
        // Get board_id before delete
        let board_id: String = conn
            .query_row(
                "SELECT board_id FROM diagram_edges WHERE id = ?1",
                params![edge_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        conn.execute("DELETE FROM diagram_edges WHERE id = ?1", params![edge_id])
            .map_err(|e| e.to_string())?;

        // Update board modified_at
        conn.execute(
            "UPDATE diagram_boards SET modified_at = ?1 WHERE id = ?2",
            params![now, board_id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    })
    .map_err(|e| e.to_string())
}
