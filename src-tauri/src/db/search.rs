use rusqlite::params;
use tauri::AppHandle;

use super::with_db;
use crate::commands::db::Backlink;
use crate::commands::search::{EntityResult, SavedSearch, SearchFilters, SearchMatch, SearchResult};

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

        if code_only || filters.as_ref().map_or(false, |f| f.code_only.unwrap_or(false)) {
            // Search only in code blocks
            let mut stmt = conn.prepare(
                r#"
                SELECT n.id, n.path, n.title, cb.content, cb.language
                FROM code_blocks cb
                JOIN notes n ON cb.note_id = n.id
                WHERE cb.content LIKE ?1
                LIMIT ?2
                "#,
            )?;

            let pattern = format!("%{}%", fts_query.replace('*', "%"));
            let rows = stmt.query_map(params![pattern, limit as i64], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<String>>(4)?,
                ))
            })?;

            for row in rows.filter_map(|r| r.ok()) {
                let (id, path, title, code_content, language) = row;
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
                        context: format!("```{}\n{}", language.unwrap_or_default(), code_content.chars().take(200).collect::<String>()),
                    }],
                });
            }
        } else {
            // Full-text search using FTS5
            // Replace wildcards with FTS5 syntax
            let fts_query = fts_query
                .replace('*', "*")  // FTS5 uses * for prefix matching
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" OR ");

            let mut stmt = conn.prepare(
                r#"
                SELECT n.id, n.path, n.title, n.content,
                       bm25(notes_fts, 1.0, 0.75, 0.5, 0.25) as score
                FROM notes_fts
                JOIN notes n ON notes_fts.rowid = n.rowid
                WHERE notes_fts MATCH ?1
                ORDER BY score
                LIMIT ?2
                "#,
            )?;

            let rows = stmt.query_map(params![fts_query, limit as i64], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, f64>(4)?,
                ))
            })?;

            for row in rows.filter_map(|r| r.ok()) {
                let (id, path, title, content, score) = row;

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
                });
            }
        }

        // Apply tag filters if specified
        if let Some(f) = filters {
            if let Some(ref tags) = f.tags {
                let tag_set: std::collections::HashSet<_> = tags.iter().collect();

                results.retain(|r| {
                    let mut stmt = conn.prepare(
                        "SELECT tag FROM tags WHERE note_id = ?1"
                    ).ok();

                    if let Some(ref mut stmt) = stmt {
                        let note_tags: Vec<String> = stmt
                            .query_map(params![r.id], |row| row.get(0))
                            .ok()
                            .map(|rows| rows.filter_map(|r| r.ok()).collect())
                            .unwrap_or_default();

                        note_tags.iter().any(|t| tag_set.contains(t))
                    } else {
                        true
                    }
                });
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
        let (query, params_vec): (String, Vec<Box<dyn rusqlite::ToSql>>) = match (entity_type, pattern_like.as_ref()) {
            (Some(et), Some(p)) => (
                r#"SELECT e.entity_type, e.value, n.path, n.title, e.context
                   FROM entities e
                   JOIN notes n ON e.note_id = n.id
                   WHERE e.entity_type = ?1 AND e.value LIKE ?2
                   ORDER BY e.value LIMIT ?3"#.to_string(),
                vec![Box::new(et.to_string()) as Box<dyn rusqlite::ToSql>,
                     Box::new(p.clone()) as Box<dyn rusqlite::ToSql>,
                     Box::new(limit as i64) as Box<dyn rusqlite::ToSql>]
            ),
            (Some(et), None) => (
                r#"SELECT e.entity_type, e.value, n.path, n.title, e.context
                   FROM entities e
                   JOIN notes n ON e.note_id = n.id
                   WHERE e.entity_type = ?1
                   ORDER BY e.value LIMIT ?2"#.to_string(),
                vec![Box::new(et.to_string()) as Box<dyn rusqlite::ToSql>,
                     Box::new(limit as i64) as Box<dyn rusqlite::ToSql>]
            ),
            (None, Some(p)) => (
                r#"SELECT e.entity_type, e.value, n.path, n.title, e.context
                   FROM entities e
                   JOIN notes n ON e.note_id = n.id
                   WHERE e.value LIKE ?1
                   ORDER BY e.value LIMIT ?2"#.to_string(),
                vec![Box::new(p.clone()) as Box<dyn rusqlite::ToSql>,
                     Box::new(limit as i64) as Box<dyn rusqlite::ToSql>]
            ),
            (None, None) => (
                r#"SELECT e.entity_type, e.value, n.path, n.title, e.context
                   FROM entities e
                   JOIN notes n ON e.note_id = n.id
                   ORDER BY e.value LIMIT ?1"#.to_string(),
                vec![Box::new(limit as i64) as Box<dyn rusqlite::ToSql>]
            ),
        };

        let mut stmt = conn.prepare(&query)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

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
        let filters_json = filters.map(|f| serde_json::to_string(f).ok()).flatten();

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
        // Get all notes as nodes
        let mut nodes_stmt = conn.prepare(
            r#"
            SELECT n.id, n.path, n.title,
                   (SELECT COUNT(*) FROM backlinks WHERE source_id = n.id) as link_count,
                   (SELECT COUNT(*) FROM backlinks b2
                    JOIN notes n2 ON b2.source_id = n2.id
                    WHERE b2.target_path = n.path
                       OR b2.target_path LIKE '%' || replace(n.path, 'notes/', '') || '%'
                   ) as backlink_count
            FROM notes n
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
                let target_id = path_to_id.get(&target_path)
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
pub fn get_backlinks(app: &AppHandle, note_path: &str) -> Result<Vec<Backlink>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn.prepare(
            r#"
            SELECT n.id, n.path, n.title, b.context
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
    if query.starts_with("code:") {
        code_only = true;
        clean_query = query[5..].to_string();
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
        let start = pos.saturating_sub(max_len / 2);
        let end = (pos + query.len() + max_len / 2).min(content.len());

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
        let end = max_len.min(content.len());
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
        let mut stmt = conn.prepare(
            "SELECT DISTINCT value FROM entities WHERE type = 'mention' ORDER BY value"
        )?;
        let mentions: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(mentions)
    })
}
