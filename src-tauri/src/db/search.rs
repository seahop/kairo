use rusqlite::params;
use tauri::AppHandle;

use super::with_db;

/// Safely find a character boundary at or before the given byte index
fn floor_char_boundary(s: &str, index: usize) -> usize {
    if index >= s.len() {
        s.len()
    } else {
        let mut idx = index;
        while idx > 0 && !s.is_char_boundary(idx) {
            idx -= 1;
        }
        idx
    }
}

/// Safely find a character boundary at or after the given byte index
fn ceil_char_boundary(s: &str, index: usize) -> usize {
    if index >= s.len() {
        s.len()
    } else {
        let mut idx = index;
        while idx < s.len() && !s.is_char_boundary(idx) {
            idx += 1;
        }
        idx
    }
}
use crate::commands::db::Backlink;
use crate::commands::search::{
    EntityResult, SavedSearch, SearchFilters, SearchMatch, SearchResult,
};

/// Search notes using FTS5
pub fn search_notes(
    app: &AppHandle,
    query: &str,
    filters: Option<&SearchFilters>,
    limit: usize,
) -> Result<Vec<SearchResult>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        // Parse query for special syntax
        let (fts_query, code_only) = parse_search_query(query);

        let mut results = Vec::new();

        // Check if we should include archived notes
        let include_archived = filters
            .as_ref()
            .and_then(|f| f.include_archived)
            .unwrap_or(false);

        if code_only
            || filters
                .as_ref()
                .is_some_and(|f| f.code_only.unwrap_or(false))
        {
            // Search only in code blocks
            let mut stmt = conn.prepare(
                r#"
                SELECT n.id, n.path, n.title, cb.content, cb.language, COALESCE(n.archived, 0)
                FROM code_blocks cb
                JOIN notes n ON cb.note_id = n.id
                WHERE cb.content LIKE ?1
                AND (COALESCE(n.archived, 0) = 0 OR ?2 = 1)
                LIMIT ?3
                "#,
            )?;

            let pattern = format!("%{}%", fts_query.replace('*', "%"));
            let rows = stmt.query_map(params![pattern, include_archived as i32, limit as i64], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, i32>(5)? != 0,
                ))
            })?;

            for row in rows.filter_map(|r| r.ok()) {
                let (id, path, title, code_content, language, archived) = row;
                let snippet = create_snippet(&code_content, &fts_query, 100);

                results.push(SearchResult {
                    id,
                    path,
                    title,
                    snippet,
                    score: 1.0,
                    matches: vec![SearchMatch {
                        field: "code_block".to_string(),
                        text: fts_query.clone(),
                        context: format!(
                            "```{}\n{}",
                            language.unwrap_or_default(),
                            code_content.chars().take(200).collect::<String>()
                        ),
                    }],
                    archived,
                });
            }
        } else {
            // Full-text search using FTS5
            let fts_query = fts_query
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" OR ");

            let mut stmt = conn.prepare(
                r#"
                SELECT n.id, n.path, n.title, n.content,
                       bm25(notes_fts, 1.0, 0.75, 0.5, 0.25) as score,
                       COALESCE(n.archived, 0)
                FROM notes_fts
                JOIN notes n ON notes_fts.rowid = n.rowid
                WHERE notes_fts MATCH ?1
                AND (COALESCE(n.archived, 0) = 0 OR ?2 = 1)
                ORDER BY score
                LIMIT ?3
                "#,
            )?;

            let rows = stmt.query_map(params![fts_query, include_archived as i32, limit as i64], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, i32>(5)? != 0,
                ))
            })?;

            for row in rows.filter_map(|r| r.ok()) {
                let (id, path, title, content, score, archived) = row;

                // Apply additional filters
                if let Some(f) = filters {
                    if let Some(ref folders) = f.folders {
                        if !folders.iter().any(|folder| path.starts_with(folder)) {
                            continue;
                        }
                    }
                }

                let snippet = create_snippet(&content, query, 150);

                results.push(SearchResult {
                    id,
                    path,
                    title,
                    snippet: snippet.clone(),
                    score: -score, // bm25 returns negative scores, lower is better
                    matches: vec![SearchMatch {
                        field: "content".to_string(),
                        text: query.to_string(),
                        context: snippet,
                    }],
                    archived,
                });
            }
        }

        // Apply tag filters if specified - batch fetch tags to avoid N+1 query
        if let Some(f) = filters {
            if let Some(ref tags) = f.tags {
                let tag_set: std::collections::HashSet<_> = tags.iter().collect();

                // Batch fetch all tags for the result note IDs in a single query
                if !results.is_empty() {
                    let note_ids: Vec<&str> = results.iter().map(|r| r.id.as_str()).collect();

                    // Build a single query with placeholders
                    let placeholders: Vec<String> =
                        (1..=note_ids.len()).map(|i| format!("?{}", i)).collect();
                    let batch_query = format!(
                        "SELECT note_id, tag FROM tags WHERE note_id IN ({})",
                        placeholders.join(", ")
                    );

                    let mut batch_stmt = conn.prepare(&batch_query)?;

                    // Build params vector
                    let params: Vec<&dyn rusqlite::ToSql> = note_ids
                        .iter()
                        .map(|id| id as &dyn rusqlite::ToSql)
                        .collect();

                    // Build a map of note_id -> tags
                    let mut note_tags_map: std::collections::HashMap<String, Vec<String>> =
                        std::collections::HashMap::new();

                    let tag_rows = batch_stmt.query_map(params.as_slice(), |row| {
                        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                    })?;

                    for row in tag_rows.filter_map(|r| r.ok()) {
                        let (note_id, tag) = row;
                        note_tags_map.entry(note_id).or_default().push(tag);
                    }

                    // Filter results based on the batch-fetched tags
                    results.retain(|r| {
                        if let Some(note_tags) = note_tags_map.get(&r.id) {
                            note_tags.iter().any(|t| tag_set.contains(t))
                        } else {
                            false
                        }
                    });
                }
            }
        }

        Ok(results)
    })
}

/// Search for entities
pub fn search_entities(
    app: &AppHandle,
    entity_type: Option<&str>,
    pattern: Option<&str>,
    limit: usize,
) -> Result<Vec<EntityResult>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let pattern_like = pattern.map(|p| p.replace('*', "%"));

        // Build query based on what filters are present
        let (query, params_vec): (String, Vec<Box<dyn rusqlite::ToSql>>) =
            match (entity_type, pattern_like.as_ref()) {
                (Some(et), Some(p)) => (
                    r#"SELECT e.entity_type, e.value, n.path, n.title, e.context
                   FROM entities e
                   JOIN notes n ON e.note_id = n.id
                   WHERE e.entity_type = ?1 AND e.value LIKE ?2
                   ORDER BY e.value LIMIT ?3"#
                        .to_string(),
                    vec![
                        Box::new(et.to_string()) as Box<dyn rusqlite::ToSql>,
                        Box::new(p.clone()) as Box<dyn rusqlite::ToSql>,
                        Box::new(limit as i64) as Box<dyn rusqlite::ToSql>,
                    ],
                ),
                (Some(et), None) => (
                    r#"SELECT e.entity_type, e.value, n.path, n.title, e.context
                   FROM entities e
                   JOIN notes n ON e.note_id = n.id
                   WHERE e.entity_type = ?1
                   ORDER BY e.value LIMIT ?2"#
                        .to_string(),
                    vec![
                        Box::new(et.to_string()) as Box<dyn rusqlite::ToSql>,
                        Box::new(limit as i64) as Box<dyn rusqlite::ToSql>,
                    ],
                ),
                (None, Some(p)) => (
                    r#"SELECT e.entity_type, e.value, n.path, n.title, e.context
                   FROM entities e
                   JOIN notes n ON e.note_id = n.id
                   WHERE e.value LIKE ?1
                   ORDER BY e.value LIMIT ?2"#
                        .to_string(),
                    vec![
                        Box::new(p.clone()) as Box<dyn rusqlite::ToSql>,
                        Box::new(limit as i64) as Box<dyn rusqlite::ToSql>,
                    ],
                ),
                (None, None) => (
                    r#"SELECT e.entity_type, e.value, n.path, n.title, e.context
                   FROM entities e
                   JOIN notes n ON e.note_id = n.id
                   ORDER BY e.value LIMIT ?1"#
                        .to_string(),
                    vec![Box::new(limit as i64) as Box<dyn rusqlite::ToSql>],
                ),
            };

        let mut stmt = conn.prepare(&query)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> =
            params_vec.iter().map(|b| b.as_ref()).collect();

        let mut results = Vec::new();
        let mut rows = stmt.query(params_refs.as_slice())?;

        while let Some(row) = rows.next()? {
            results.push(EntityResult {
                entity_type: row.get(0)?,
                value: row.get(1)?,
                note_path: row.get(2)?,
                note_title: row.get(3)?,
                context: row.get(4)?,
            });
        }

        Ok(results)
    })
}

/// Save a search query
pub fn save_search(
    app: &AppHandle,
    name: &str,
    query: &str,
    filters: Option<&SearchFilters>,
) -> Result<SavedSearch, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let id = uuid::Uuid::new_v4().to_string();
        let created_at = chrono::Utc::now().timestamp();
        let filters_json = filters.and_then(|f| serde_json::to_string(f).ok());

        conn.execute(
            "INSERT INTO saved_searches (id, name, query, filters, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, name, query, filters_json, created_at],
        )?;

        Ok(SavedSearch {
            id,
            name: name.to_string(),
            query: query.to_string(),
            filters: filters.cloned(),
            created_at,
        })
    })
}

/// Get all saved searches
pub fn get_saved_searches(app: &AppHandle) -> Result<Vec<SavedSearch>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, query, filters, created_at FROM saved_searches ORDER BY created_at DESC",
        )?;

        let searches = stmt
            .query_map([], |row| {
                let filters_json: Option<String> = row.get(3)?;
                let filters = filters_json
                    .as_ref()
                    .and_then(|f| serde_json::from_str(f).ok());

                Ok(SavedSearch {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    query: row.get(2)?,
                    filters,
                    created_at: row.get(4)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(searches)
    })
}

/// Graph node for visualization
#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub path: String,
    pub title: String,
    pub link_count: usize,
    pub backlink_count: usize,
    pub archived: bool,
}

/// Graph link for visualization
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct GraphLink {
    pub source: String,
    pub target: String,
    pub context: Option<String>,
}

/// Complete graph data for visualization
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLink>,
}

/// Get graph data for visualization
pub fn get_graph_data(app: &AppHandle) -> Result<GraphData, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        // Use CTEs to pre-compute link counts efficiently instead of correlated subqueries
        let mut nodes_stmt = conn.prepare(
            r#"
            WITH outgoing_links AS (
                SELECT source_id, COUNT(*) as cnt
                FROM backlinks
                GROUP BY source_id
            ),
            incoming_links AS (
                SELECT n.id, COUNT(DISTINCT b.source_id) as cnt
                FROM notes n
                LEFT JOIN backlinks b ON (
                    b.target_path = n.path
                    OR b.target_path = replace(n.path, 'notes/', '')
                    OR b.target_path = replace(replace(n.path, 'notes/', ''), '.md', '')
                )
                GROUP BY n.id
            )
            SELECT n.id, n.path, n.title,
                   COALESCE(ol.cnt, 0) as link_count,
                   COALESCE(il.cnt, 0) as backlink_count,
                   COALESCE(n.archived, 0)
            FROM notes n
            LEFT JOIN outgoing_links ol ON ol.source_id = n.id
            LEFT JOIN incoming_links il ON il.id = n.id
            "#,
        )?;

        let nodes: Vec<GraphNode> = nodes_stmt
            .query_map([], |row| {
                Ok(GraphNode {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    link_count: row.get::<_, i64>(3)? as usize,
                    backlink_count: row.get::<_, i64>(4)? as usize,
                    archived: row.get::<_, i32>(5)? != 0,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Build a map of paths to ids for link resolution
        let path_to_id: std::collections::HashMap<String, String> = nodes
            .iter()
            .map(|n| (n.path.clone(), n.id.clone()))
            .collect();

        // Also map by filename for fuzzy matching
        let filename_to_id: std::collections::HashMap<String, String> = nodes
            .iter()
            .filter_map(|n| {
                std::path::PathBuf::from(&n.path)
                    .file_stem()
                    .map(|s| (s.to_string_lossy().to_lowercase(), n.id.clone()))
            })
            .collect();

        // Get all links
        let mut links_stmt = conn.prepare(
            r#"
            SELECT b.source_id, b.target_path, b.context
            FROM backlinks b
            "#,
        )?;

        let links: Vec<GraphLink> = links_stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .filter_map(|(source_id, target_path, context)| {
                // Try to resolve target path to an id
                let target_id = path_to_id
                    .get(&target_path)
                    .or_else(|| path_to_id.get(&format!("notes/{}.md", target_path)))
                    .or_else(|| path_to_id.get(&format!("{}.md", target_path)))
                    .or_else(|| {
                        // Try filename matching
                        let target_lower = target_path.to_lowercase();
                        filename_to_id.get(&target_lower)
                    })?;

                Some(GraphLink {
                    source: source_id,
                    target: target_id.clone(),
                    context,
                })
            })
            .collect();

        Ok(GraphData { nodes, links })
    })
}

/// Get backlinks to a specific note
pub fn get_backlinks(
    app: &AppHandle,
    note_path: &str,
) -> Result<Vec<Backlink>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn.prepare(
            r#"
            SELECT n.id, n.path, n.title, b.context, COALESCE(n.archived, 0)
            FROM backlinks b
            JOIN notes n ON b.source_id = n.id
            WHERE b.target_path = ?1 OR b.target_path LIKE ?2
            "#,
        )?;

        // Match both exact path and filename-only references
        let filename = std::path::PathBuf::from(note_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        let backlinks = stmt
            .query_map(params![note_path, format!("%{}", filename)], |row| {
                Ok(Backlink {
                    source_id: row.get(0)?,
                    source_path: row.get(1)?,
                    source_title: row.get(2)?,
                    context: row.get(3)?,
                    archived: row.get::<_, i32>(4)? != 0,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(backlinks)
    })
}

// Helper functions

fn parse_search_query(query: &str) -> (String, bool) {
    let mut code_only = false;
    let mut clean_query = query.to_string();

    // Check for code: prefix
    if let Some(stripped) = query.strip_prefix("code:") {
        code_only = true;
        clean_query = stripped.to_string();
    }

    // Check for type: prefixes and remove them (handled separately)
    let type_re = regex::Regex::new(r"type:\w+\s*").unwrap();
    clean_query = type_re.replace_all(&clean_query, "").to_string();

    // Check for tag: prefixes and remove them
    let tag_re = regex::Regex::new(r"tag:\w+\s*").unwrap();
    clean_query = tag_re.replace_all(&clean_query, "").to_string();

    // Check for folder: prefixes and remove them
    let folder_re = regex::Regex::new(r"folder:[^\s]+\s*").unwrap();
    clean_query = folder_re.replace_all(&clean_query, "").to_string();

    (clean_query.trim().to_string(), code_only)
}

fn create_snippet(content: &str, query: &str, max_len: usize) -> String {
    let query_lower = query.to_lowercase();
    let content_lower = content.to_lowercase();

    // Find the position of the query in the content
    if let Some(pos) = content_lower.find(&query_lower) {
        // Use safe character boundary functions to avoid panics on multi-byte chars
        let start = floor_char_boundary(content, pos.saturating_sub(max_len / 2));
        let end = ceil_char_boundary(
            content,
            (pos + query.len() + max_len / 2).min(content.len()),
        );

        let mut snippet = String::new();
        if start > 0 {
            snippet.push_str("...");
        }
        snippet.push_str(&content[start..end]);
        if end < content.len() {
            snippet.push_str("...");
        }

        // Clean up newlines
        snippet.replace('\n', " ").replace("  ", " ")
    } else {
        // No match found, return the beginning of the content
        let end = ceil_char_boundary(content, max_len.min(content.len()));
        let mut snippet = content[..end].to_string();
        if end < content.len() {
            snippet.push_str("...");
        }
        snippet.replace('\n', " ").replace("  ", " ")
    }
}

/// Get all unique tags in the vault
pub fn get_all_tags(app: &AppHandle) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn.prepare("SELECT DISTINCT tag FROM tags ORDER BY tag")?;
        let tags: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(tags)
    })
}

/// Get all unique mentions in the vault
pub fn get_all_mentions(app: &AppHandle) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn
            .prepare("SELECT DISTINCT value FROM entities WHERE type = 'mention' ORDER BY value")?;
        let mentions: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(mentions)
    })
}

// =============================================================================
// Vault Health Functions
// =============================================================================

/// Orphan note information
#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrphanNote {
    pub id: String,
    pub path: String,
    pub title: String,
    pub created_at: i64,
    pub modified_at: i64,
}

/// Broken link information
#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrokenLink {
    pub source_id: String,
    pub source_path: String,
    pub source_title: String,
    pub target_reference: String,
    pub context: Option<String>,
}

/// Vault health statistics
#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultHealth {
    pub total_notes: usize,
    pub total_links: usize,
    pub orphan_count: usize,
    pub broken_link_count: usize,
    pub avg_links_per_note: f64,
    pub most_connected_notes: Vec<GraphNode>,
    pub recently_modified: Vec<OrphanNote>,
}

/// Get orphan notes (notes with no incoming or outgoing links)
pub fn get_orphan_notes(app: &AppHandle) -> Result<Vec<OrphanNote>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn.prepare(
            r#"
            SELECT n.id, n.path, n.title, n.created_at, n.modified_at
            FROM notes n
            WHERE NOT EXISTS (
                SELECT 1 FROM backlinks b WHERE b.source_id = n.id
            )
            AND NOT EXISTS (
                SELECT 1 FROM backlinks b2
                JOIN notes n2 ON b2.source_id = n2.id
                WHERE b2.target_path = n.path
                   OR b2.target_path LIKE '%' || replace(replace(n.path, 'notes/', ''), '.md', '') || '%'
            )
            ORDER BY n.modified_at DESC
            "#,
        )?;

        let orphans: Vec<OrphanNote> = stmt
            .query_map([], |row| {
                Ok(OrphanNote {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    created_at: row.get(3)?,
                    modified_at: row.get(4)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(orphans)
    })
}

/// Get broken links (links pointing to non-existent notes)
pub fn get_broken_links(app: &AppHandle) -> Result<Vec<BrokenLink>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        // Get all note paths for comparison
        let mut paths_stmt = conn.prepare("SELECT path FROM notes")?;
        let note_paths: std::collections::HashSet<String> = paths_stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .filter_map(|r| r.ok())
            .collect();

        // Also create a set of filenames (without extension) for fuzzy matching
        let filenames: std::collections::HashSet<String> = note_paths
            .iter()
            .filter_map(|p| {
                std::path::PathBuf::from(p)
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_lowercase())
            })
            .collect();

        // Get all backlinks
        let mut links_stmt = conn.prepare(
            r#"
            SELECT n.id, n.path, n.title, b.target_path, b.context
            FROM backlinks b
            JOIN notes n ON b.source_id = n.id
            "#,
        )?;

        let broken_links: Vec<BrokenLink> = links_stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<String>>(4)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .filter_map(
                |(source_id, source_path, source_title, target_ref, context)| {
                    // Check if target exists
                    let target_exists = note_paths.contains(&target_ref)
                        || note_paths.contains(&format!("notes/{}.md", target_ref))
                        || note_paths.contains(&format!("{}.md", target_ref))
                        || note_paths.contains(&format!("notes/{}", target_ref))
                        || filenames.contains(&target_ref.to_lowercase());

                    if target_exists {
                        None
                    } else {
                        Some(BrokenLink {
                            source_id,
                            source_path,
                            source_title,
                            target_reference: target_ref,
                            context,
                        })
                    }
                },
            )
            .collect();

        Ok(broken_links)
    })
}

/// Get overall vault health statistics
pub fn get_vault_health(app: &AppHandle) -> Result<VaultHealth, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        // Total notes
        let total_notes: usize =
            conn.query_row("SELECT COUNT(*) FROM notes", [], |row| row.get::<_, i64>(0))? as usize;

        // Total links
        let total_links: usize = conn.query_row("SELECT COUNT(*) FROM backlinks", [], |row| {
            row.get::<_, i64>(0)
        })? as usize;

        // Get orphan count
        let orphan_count: usize = conn.query_row(
            r#"
            SELECT COUNT(*)
            FROM notes n
            WHERE NOT EXISTS (
                SELECT 1 FROM backlinks b WHERE b.source_id = n.id
            )
            AND NOT EXISTS (
                SELECT 1 FROM backlinks b2
                JOIN notes n2 ON b2.source_id = n2.id
                WHERE b2.target_path = n.path
                   OR b2.target_path LIKE '%' || replace(replace(n.path, 'notes/', ''), '.md', '') || '%'
            )
            "#,
            [],
            |row| row.get::<_, i64>(0),
        )? as usize;

        // Average links per note
        let avg_links_per_note = if total_notes > 0 {
            total_links as f64 / total_notes as f64
        } else {
            0.0
        };

        // Most connected notes (top 5)
        let mut connected_stmt = conn.prepare(
            r#"
            SELECT n.id, n.path, n.title,
                   (SELECT COUNT(*) FROM backlinks WHERE source_id = n.id) as out_links,
                   (SELECT COUNT(*) FROM backlinks b2
                    JOIN notes n2 ON b2.source_id = n2.id
                    WHERE b2.target_path = n.path
                       OR b2.target_path LIKE '%' || replace(replace(n.path, 'notes/', ''), '.md', '') || '%'
                   ) as in_links,
                   COALESCE(n.archived, 0)
            FROM notes n
            ORDER BY (out_links + in_links) DESC
            LIMIT 5
            "#,
        )?;

        let most_connected_notes: Vec<GraphNode> = connected_stmt
            .query_map([], |row| {
                Ok(GraphNode {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    link_count: row.get::<_, i64>(3)? as usize,
                    backlink_count: row.get::<_, i64>(4)? as usize,
                    archived: row.get::<_, i32>(5)? != 0,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Recently modified notes
        let mut recent_stmt = conn.prepare(
            r#"
            SELECT id, path, title, created_at, modified_at
            FROM notes
            ORDER BY modified_at DESC
            LIMIT 10
            "#,
        )?;

        let recently_modified: Vec<OrphanNote> = recent_stmt
            .query_map([], |row| {
                Ok(OrphanNote {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    created_at: row.get(3)?,
                    modified_at: row.get(4)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Broken link count (we need to compute this)
        drop(connected_stmt);
        drop(recent_stmt);

        let broken_links = get_broken_links_count(conn)?;

        Ok(VaultHealth {
            total_notes,
            total_links,
            orphan_count,
            broken_link_count: broken_links,
            avg_links_per_note,
            most_connected_notes,
            recently_modified,
        })
    })
}

fn get_broken_links_count(
    conn: &rusqlite::Connection,
) -> Result<usize, Box<dyn std::error::Error>> {
    // Get all note paths for comparison
    let mut paths_stmt = conn.prepare("SELECT path FROM notes")?;
    let note_paths: std::collections::HashSet<String> = paths_stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .filter_map(|r| r.ok())
        .collect();

    let filenames: std::collections::HashSet<String> = note_paths
        .iter()
        .filter_map(|p| {
            std::path::PathBuf::from(p)
                .file_stem()
                .map(|s| s.to_string_lossy().to_lowercase())
        })
        .collect();

    let mut links_stmt = conn.prepare("SELECT target_path FROM backlinks")?;
    let broken_count = links_stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .filter_map(|r| r.ok())
        .filter(|target_ref| {
            !(note_paths.contains(target_ref)
                || note_paths.contains(&format!("notes/{}.md", target_ref))
                || note_paths.contains(&format!("{}.md", target_ref))
                || note_paths.contains(&format!("notes/{}", target_ref))
                || filenames.contains(&target_ref.to_lowercase()))
        })
        .count();

    Ok(broken_count)
}

// =============================================================================
// Organization Helper Functions
// =============================================================================

/// Unlinked mention - where a note title appears in content but isn't linked
#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlinkedMention {
    pub note_id: String,
    pub note_path: String,
    pub note_title: String,
    pub mentioned_in_id: String,
    pub mentioned_in_path: String,
    pub mentioned_in_title: String,
    pub context: String,
}

/// Get unlinked mentions (note titles that appear in content but aren't wiki-linked)
/// Optimized to use FTS5 for O(n) instead of O(n²) performance
pub fn get_unlinked_mentions(
    app: &AppHandle,
) -> Result<Vec<UnlinkedMention>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        // Get all notes with their titles (we'll use FTS5 to search content)
        let mut notes_stmt = conn.prepare("SELECT id, path, title FROM notes")?;
        let notes: Vec<(String, String, String)> = notes_stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Get existing backlinks to know what's already linked
        let mut links_stmt = conn.prepare("SELECT source_id, target_path FROM backlinks")?;
        let existing_links: std::collections::HashSet<(String, String)> = links_stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?.to_lowercase(),
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();

        let mut unlinked = Vec::new();

        // For each note, use FTS5 to find other notes containing the title
        // This is O(n * log(m)) instead of O(n * m) where m is total content size
        for (note_id, note_path, note_title) in &notes {
            if note_title.len() < 3 {
                continue; // Skip very short titles
            }

            let title_lower = note_title.to_lowercase();
            let note_filename = std::path::PathBuf::from(note_path)
                .file_stem()
                .map(|s| s.to_string_lossy().to_lowercase())
                .unwrap_or_default();

            // Use FTS5 to search for notes containing this title
            // Quote the title to search for exact phrase
            let fts_query = format!("\"{}\"", note_title.replace('"', ""));

            let mut search_stmt = conn.prepare(
                r#"
                SELECT n.id, n.path, n.title, n.content
                FROM notes_fts
                JOIN notes n ON notes_fts.rowid = n.rowid
                WHERE notes_fts MATCH ?1
                AND n.id != ?2
                LIMIT 50
                "#,
            )?;

            let matches = search_stmt
                .query_map(params![fts_query, note_id], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                })?
                .filter_map(|r| r.ok());

            for (other_id, other_path, other_title, other_content) in matches {
                // Check if already linked
                let is_linked = existing_links.contains(&(other_id.clone(), title_lower.clone()))
                    || existing_links.contains(&(other_id.clone(), note_filename.clone()))
                    || existing_links.contains(&(other_id.clone(), note_path.to_lowercase()));

                if is_linked {
                    continue;
                }

                // Find context around the mention
                let content_lower = other_content.to_lowercase();
                if let Some(pos) = content_lower.find(&title_lower) {
                    // Use safe character boundary functions to avoid panics on multi-byte chars
                    let start = floor_char_boundary(&other_content, pos.saturating_sub(40));
                    let end = ceil_char_boundary(
                        &other_content,
                        (pos + note_title.len() + 40).min(other_content.len()),
                    );
                    let context = other_content[start..end].to_string();

                    unlinked.push(UnlinkedMention {
                        note_id: note_id.clone(),
                        note_path: note_path.clone(),
                        note_title: note_title.clone(),
                        mentioned_in_id: other_id,
                        mentioned_in_path: other_path,
                        mentioned_in_title: other_title,
                        context: format!("...{}...", context.replace('\n', " ")),
                    });
                }
            }
        }

        Ok(unlinked)
    })
}

/// Get a random note for review (Zettelkasten practice)
pub fn get_random_note(app: &AppHandle) -> Result<Option<OrphanNote>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, path, title, created_at, modified_at FROM notes ORDER BY RANDOM() LIMIT 1",
        )?;

        let note = stmt
            .query_row([], |row| {
                Ok(OrphanNote {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    created_at: row.get(3)?,
                    modified_at: row.get(4)?,
                })
            })
            .ok();

        Ok(note)
    })
}

/// Get notes that could be MOCs (Maps of Content) - notes with many outgoing links
pub fn get_potential_mocs(
    app: &AppHandle,
    min_links: usize,
) -> Result<Vec<GraphNode>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn.prepare(
            r#"
            SELECT n.id, n.path, n.title,
                   (SELECT COUNT(*) FROM backlinks WHERE source_id = n.id) as out_links,
                   (SELECT COUNT(*) FROM backlinks b2
                    JOIN notes n2 ON b2.source_id = n2.id
                    WHERE b2.target_path = n.path
                       OR b2.target_path LIKE '%' || replace(replace(n.path, 'notes/', ''), '.md', '') || '%'
                   ) as in_links,
                   COALESCE(n.archived, 0)
            FROM notes n
            WHERE (SELECT COUNT(*) FROM backlinks WHERE source_id = n.id) >= ?1
            ORDER BY out_links DESC
            "#,
        )?;

        let mocs: Vec<GraphNode> = stmt
            .query_map([min_links as i64], |row| {
                Ok(GraphNode {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    link_count: row.get::<_, i64>(3)? as usize,
                    backlink_count: row.get::<_, i64>(4)? as usize,
                    archived: row.get::<_, i32>(5)? != 0,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(mocs)
    })
}

/// Get notes by folder/prefix for PARA-style organization
pub fn get_notes_by_folder(
    app: &AppHandle,
    folder_prefix: &str,
) -> Result<Vec<OrphanNote>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let pattern = format!("{}%", folder_prefix);
        let mut stmt = conn.prepare(
            "SELECT id, path, title, created_at, modified_at FROM notes WHERE path LIKE ?1 ORDER BY modified_at DESC"
        )?;

        let notes: Vec<OrphanNote> = stmt
            .query_map([pattern], |row| {
                Ok(OrphanNote {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    created_at: row.get(3)?,
                    modified_at: row.get(4)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(notes)
    })
}
