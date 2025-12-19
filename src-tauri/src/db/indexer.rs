use regex::Regex;
use rusqlite::params;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use walkdir::WalkDir;

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
use crate::commands::notes::NoteMetadata;

/// Clean up notes that no longer exist on disk
fn cleanup_deleted_notes(
    app: &AppHandle,
    vault_path: &PathBuf,
) -> Result<usize, Box<dyn std::error::Error>> {
    // Get all note paths from the database
    let db_paths: Vec<String> = with_db(app, |conn| {
        let mut stmt = conn.prepare("SELECT path FROM notes")?;
        let paths = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(paths)
    })?;

    let mut deleted_count = 0;

    for db_path in db_paths {
        // Construct the full path
        let full_path = vault_path.join(&db_path);

        // Check if the file still exists
        if !full_path.exists() {
            // File no longer exists - remove from database
            let note_id = generate_note_id(&db_path);

            with_db(app, |conn| {
                // Delete all related data
                conn.execute("DELETE FROM entities WHERE note_id = ?1", params![note_id])?;
                conn.execute("DELETE FROM tags WHERE note_id = ?1", params![note_id])?;
                conn.execute("DELETE FROM code_blocks WHERE note_id = ?1", params![note_id])?;
                // Delete outgoing backlinks (by source_id)
                conn.execute("DELETE FROM backlinks WHERE source_id = ?1", params![note_id])?;
                conn.execute("DELETE FROM card_backlinks WHERE source_id = ?1", params![note_id])?;
                conn.execute("DELETE FROM blocks WHERE note_id = ?1", params![note_id])?;
                conn.execute("DELETE FROM aliases WHERE note_id = ?1", params![note_id])?;
                // Delete the note itself
                conn.execute("DELETE FROM notes WHERE id = ?1", params![note_id])?;
                Ok(())
            })?;

            deleted_count += 1;
        }
    }

    Ok(deleted_count)
}

/// Index the entire vault
pub async fn index_vault(
    app: &AppHandle,
    vault_path: &PathBuf,
) -> Result<usize, Box<dyn std::error::Error>> {
    let notes_dir = vault_path.join("notes");
    let mut count = 0;

    // First, clean up deleted files from the database
    cleanup_deleted_notes(app, vault_path)?;

    // Walk through all markdown files
    for entry in WalkDir::new(&notes_dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        if path.is_file() && path.extension().is_some_and(|ext| ext == "md") {
            // Get relative path from vault root
            let relative_path = path
                .strip_prefix(vault_path)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();

            index_single_note(app, vault_path, &PathBuf::from(&relative_path)).await?;
            count += 1;
        }
    }

    Ok(count)
}

/// Index a single note
pub async fn index_single_note(
    app: &AppHandle,
    vault_path: &Path,
    relative_path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let full_path = vault_path.join(relative_path);
    // Use tokio async file operations to avoid blocking
    let content = tokio::fs::read_to_string(&full_path).await?;
    let metadata = tokio::fs::metadata(&full_path).await?;

    let path_str = relative_path.to_string_lossy().to_string();
    let id = generate_note_id(&path_str);
    let title = extract_title(&content, &path_str);
    let content_hash = hash_content(&content);

    let modified_at = metadata
        .modified()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(0);

    let created_at = metadata
        .created()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(modified_at);

    // Parse frontmatter
    let frontmatter = extract_frontmatter(&content);

    // Extract archived status from frontmatter
    let archived = extract_archived(&frontmatter);

    with_db(app, |conn| {
        // Insert or update the note
        conn.execute(
            r#"
            INSERT INTO notes (id, path, title, content, content_hash, created_at, modified_at, frontmatter, archived)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(path) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                content_hash = excluded.content_hash,
                modified_at = excluded.modified_at,
                frontmatter = excluded.frontmatter,
                archived = excluded.archived
            "#,
            params![id, path_str, title, content, content_hash, created_at, modified_at, frontmatter, archived as i32],
        )?;

        // Clear existing entities, tags, code blocks, backlinks, card backlinks, blocks, and aliases for this note
        conn.execute("DELETE FROM entities WHERE note_id = ?1", params![id])?;
        conn.execute("DELETE FROM tags WHERE note_id = ?1", params![id])?;
        conn.execute("DELETE FROM code_blocks WHERE note_id = ?1", params![id])?;
        conn.execute("DELETE FROM backlinks WHERE source_id = ?1", params![id])?;
        conn.execute(
            "DELETE FROM card_backlinks WHERE source_id = ?1",
            params![id],
        )?;
        conn.execute("DELETE FROM blocks WHERE note_id = ?1", params![id])?;
        conn.execute("DELETE FROM aliases WHERE note_id = ?1", params![id])?;

        // Extract and insert entities
        let entities = extract_entities(&content);
        for (entity_type, value, context, line) in entities {
            conn.execute(
                "INSERT INTO entities (note_id, entity_type, value, context, line_number) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, entity_type, value, context, line],
            )?;
        }

        // Extract and insert tags
        let tags = extract_tags(&content, &frontmatter);
        for tag in tags {
            conn.execute(
                "INSERT INTO tags (note_id, tag) VALUES (?1, ?2)",
                params![id, tag],
            )?;
        }

        // Extract and insert code blocks
        let code_blocks = extract_code_blocks(&content);
        for (language, block_content, line_start, line_end) in code_blocks {
            conn.execute(
                "INSERT INTO code_blocks (note_id, language, content, line_start, line_end) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, language, block_content, line_start, line_end],
            )?;
        }

        // Extract and insert backlinks
        let links = extract_links(&content);
        for (target_path, context) in links {
            conn.execute(
                "INSERT OR IGNORE INTO backlinks (source_id, target_path, context) VALUES (?1, ?2, ?3)",
                params![id, target_path, context],
            )?;
        }

        // Extract and insert card backlinks
        let card_links = extract_card_links(&content);
        for (card_title, board_name, context) in card_links {
            // Find the card by title (and optionally board name)
            let card_result = if let Some(bn) = &board_name {
                conn.query_row(
                    r#"
                    SELECT c.id FROM kanban_cards c
                    JOIN kanban_boards b ON c.board_id = b.id
                    WHERE LOWER(c.title) = LOWER(?1) AND LOWER(b.name) = LOWER(?2)
                    LIMIT 1
                    "#,
                    params![card_title, bn],
                    |row| row.get::<_, String>(0),
                )
            } else {
                conn.query_row(
                    "SELECT id FROM kanban_cards WHERE LOWER(title) = LOWER(?1) LIMIT 1",
                    params![card_title],
                    |row| row.get::<_, String>(0),
                )
            };

            if let Ok(card_id) = card_result {
                conn.execute(
                    "INSERT OR IGNORE INTO card_backlinks (source_id, card_id, context) VALUES (?1, ?2, ?3)",
                    params![id, card_id, context],
                )?;
            }
        }

        // Extract and insert block references (for transclusion)
        let blocks = extract_blocks(&content);
        for (block_id, block_content, line_number) in blocks {
            conn.execute(
                "INSERT OR REPLACE INTO blocks (note_id, block_id, content, line_number) VALUES (?1, ?2, ?3, ?4)",
                params![id, block_id, block_content, line_number],
            )?;
        }

        // Extract and insert aliases from frontmatter
        let aliases = extract_aliases(&frontmatter);
        for alias in aliases {
            conn.execute(
                "INSERT OR IGNORE INTO aliases (note_id, alias) VALUES (?1, ?2)",
                params![id, alias],
            )?;
        }

        Ok(())
    })
}

/// Remove a note from the index
pub fn remove_note_from_index(
    app: &AppHandle,
    path: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        conn.execute("DELETE FROM notes WHERE path = ?1", params![path])?;
        Ok(())
    })
}

/// List all notes
pub fn list_all_notes(app: &AppHandle) -> Result<Vec<NoteMetadata>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, path, title, modified_at, created_at, COALESCE(archived, 0), COALESCE(starred, 0) FROM notes ORDER BY modified_at DESC",
        )?;

        let notes = stmt
            .query_map([], |row| {
                Ok(NoteMetadata {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    modified_at: row.get(3)?,
                    created_at: row.get(4)?,
                    archived: row.get::<_, i32>(5)? != 0,
                    starred: row.get::<_, i32>(6)? != 0,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(notes)
    })
}

// Helper functions

fn generate_note_id(path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..8])
}

fn hash_content(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..16])
}

fn extract_title(content: &str, path: &str) -> String {
    // Try to extract title from first H1 heading
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(stripped) = trimmed.strip_prefix("# ") {
            return stripped.trim().to_string();
        }
    }

    // Fall back to filename without extension
    PathBuf::from(path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

fn extract_frontmatter(content: &str) -> Option<String> {
    if content.starts_with("---") {
        let parts: Vec<&str> = content.splitn(3, "---").collect();
        if parts.len() >= 3 {
            // Parse YAML frontmatter
            let yaml = parts[1].trim();
            // Convert to JSON for storage
            if let Ok(value) = serde_yaml_to_json(yaml) {
                return Some(value);
            }
        }
    }
    None
}

/// Extract archived status from frontmatter JSON
fn extract_archived(frontmatter: &Option<String>) -> bool {
    if let Some(fm) = frontmatter {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(fm) {
            // Handle both "true" (string) and true (boolean)
            if let Some(archived) = json.get("archived") {
                return archived == "true" || archived == true;
            }
        }
    }
    false
}

fn serde_yaml_to_json(yaml: &str) -> Result<String, Box<dyn std::error::Error>> {
    use std::collections::HashMap;
    let mut map: HashMap<String, serde_json::Value> = HashMap::new();

    let lines: Vec<&str> = yaml.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];

        // Skip empty lines
        if line.trim().is_empty() {
            i += 1;
            continue;
        }

        // Check for key: value pattern at root level (no leading whitespace)
        if !line.starts_with(' ') && !line.starts_with('\t') {
            if let Some((key, value)) = line.split_once(':') {
                let key = key.trim().to_string();
                let value = value.trim();

                // Handle inline arrays: key: [item1, item2]
                if value.starts_with('[') && value.ends_with(']') {
                    let items: Vec<String> = value[1..value.len() - 1]
                        .split(',')
                        .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                    map.insert(key, serde_json::json!(items));
                    i += 1;
                }
                // Handle multi-line arrays: key:\n  - item1\n  - item2
                else if value.is_empty() {
                    // Look ahead for array items
                    let mut items: Vec<String> = Vec::new();
                    i += 1;

                    while i < lines.len() {
                        let next_line = lines[i];
                        let trimmed = next_line.trim();

                        // Check if it's an array item (starts with -)
                        if let Some(stripped) = trimmed.strip_prefix('-') {
                            let item = stripped
                                .trim()
                                .trim_matches('"')
                                .trim_matches('\'')
                                .to_string();
                            if !item.is_empty() {
                                items.push(item);
                            }
                            i += 1;
                        }
                        // Check if we've hit another root-level key or end
                        else if !next_line.starts_with(' ')
                            && !next_line.starts_with('\t')
                            && !trimmed.is_empty()
                        {
                            break;
                        }
                        // Skip empty lines or other nested content
                        else {
                            i += 1;
                        }
                    }

                    if !items.is_empty() {
                        map.insert(key, serde_json::json!(items));
                    } else {
                        // Empty value, store as empty string
                        map.insert(key, serde_json::json!(""));
                    }
                }
                // Simple key: value
                else {
                    map.insert(
                        key,
                        serde_json::json!(value.trim_matches('"').trim_matches('\'')),
                    );
                    i += 1;
                }
            } else {
                i += 1;
            }
        } else {
            i += 1;
        }
    }

    Ok(serde_json::to_string(&map)?)
}

fn extract_entities(content: &str) -> Vec<(String, String, String, i32)> {
    let mut entities = Vec::new();

    // IP addresses (IPv4)
    let ip_re = Regex::new(r"\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b").unwrap();

    // Domains
    let domain_re =
        Regex::new(r"\b([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)\b").unwrap();

    // CVEs
    let cve_re = Regex::new(r"\b(CVE-\d{4}-\d{4,})\b").unwrap();

    // Usernames (common patterns)
    let username_re = Regex::new(r"\b((?:admin|root|user|guest|administrator)[\w]*)\b").unwrap();

    // @mentions
    let mention_re = Regex::new(r"@(\w+)").unwrap();

    for (line_num, line) in content.lines().enumerate() {
        let line_num = (line_num + 1) as i32;
        let context = line.chars().take(100).collect::<String>();

        for cap in ip_re.captures_iter(line) {
            entities.push((
                "ip".to_string(),
                cap[1].to_string(),
                context.clone(),
                line_num,
            ));
        }

        for cap in domain_re.captures_iter(line) {
            let domain = &cap[1];
            // Filter out common non-domains
            if !domain.ends_with(".md") && !domain.ends_with(".rs") && !domain.ends_with(".ts") {
                entities.push((
                    "domain".to_string(),
                    domain.to_string(),
                    context.clone(),
                    line_num,
                ));
            }
        }

        for cap in cve_re.captures_iter(line) {
            entities.push((
                "cve".to_string(),
                cap[1].to_string(),
                context.clone(),
                line_num,
            ));
        }

        for cap in username_re.captures_iter(line) {
            entities.push((
                "username".to_string(),
                cap[1].to_string(),
                context.clone(),
                line_num,
            ));
        }

        for cap in mention_re.captures_iter(line) {
            entities.push((
                "mention".to_string(),
                cap[1].to_string(),
                context.clone(),
                line_num,
            ));
        }
    }

    entities
}

fn extract_tags(content: &str, frontmatter: &Option<String>) -> Vec<String> {
    let mut tags = Vec::new();

    // Extract from frontmatter
    if let Some(fm) = frontmatter {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(fm) {
            if let Some(tag_array) = json.get("tags").and_then(|t| t.as_array()) {
                for tag in tag_array {
                    if let Some(t) = tag.as_str() {
                        tags.push(t.to_string());
                    }
                }
            }
        }
    }

    // Extract hashtags from content
    let tag_re = Regex::new(r"#([a-zA-Z]\w*)").unwrap();
    for cap in tag_re.captures_iter(content) {
        let tag = cap[1].to_string();
        if !tags.contains(&tag) {
            tags.push(tag);
        }
    }

    tags
}

fn extract_code_blocks(content: &str) -> Vec<(Option<String>, String, i32, i32)> {
    let mut blocks = Vec::new();
    let mut in_block = false;
    let mut current_lang: Option<String> = None;
    let mut current_content = String::new();
    let mut start_line = 0;

    for (line_num, line) in content.lines().enumerate() {
        let line_num = (line_num + 1) as i32;

        if let Some(after_backticks) = line.strip_prefix("```") {
            if in_block {
                // End of code block
                blocks.push((
                    current_lang.clone(),
                    current_content.clone(),
                    start_line,
                    line_num,
                ));
                current_content.clear();
                current_lang = None;
                in_block = false;
            } else {
                // Start of code block
                in_block = true;
                start_line = line_num;
                let lang = after_backticks.trim();
                current_lang = if lang.is_empty() {
                    None
                } else {
                    Some(lang.to_string())
                };
            }
        } else if in_block {
            if !current_content.is_empty() {
                current_content.push('\n');
            }
            current_content.push_str(line);
        }
    }

    blocks
}

fn extract_links(content: &str) -> Vec<(String, String)> {
    let mut links = Vec::new();

    // Wiki-style links: [[path]] or [[path|display]]
    let wiki_re = Regex::new(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]").unwrap();

    // Markdown links to local files: [text](path.md)
    let md_re = Regex::new(r"\[([^\]]+)\]\(([^)]+\.md)\)").unwrap();

    for cap in wiki_re.captures_iter(content) {
        let path = cap[1].trim().to_string();

        // Skip card links (those starting with "card:")
        if path.starts_with("card:") {
            continue;
        }

        let context = content
            .find(&cap[0])
            .map(|i| {
                // Use safe character boundary functions to avoid panics on multi-byte chars
                let start = floor_char_boundary(content, i.saturating_sub(30));
                let end = ceil_char_boundary(content, (i + cap[0].len() + 30).min(content.len()));
                content[start..end].to_string()
            })
            .unwrap_or_default();
        links.push((path, context));
    }

    for cap in md_re.captures_iter(content) {
        let path = cap[2].to_string();
        let context = content
            .find(&cap[0])
            .map(|i| {
                // Use safe character boundary functions to avoid panics on multi-byte chars
                let start = floor_char_boundary(content, i.saturating_sub(30));
                let end = ceil_char_boundary(content, (i + cap[0].len() + 30).min(content.len()));
                content[start..end].to_string()
            })
            .unwrap_or_default();
        links.push((path, context));
    }

    links
}

/// Extract aliases from frontmatter
/// Returns: Vec<String> of aliases
fn extract_aliases(frontmatter: &Option<String>) -> Vec<String> {
    let mut aliases = Vec::new();

    if let Some(fm) = frontmatter {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(fm) {
            // Handle array format: aliases: [alias1, alias2]
            if let Some(alias_array) = json.get("aliases").and_then(|a| a.as_array()) {
                for alias in alias_array {
                    if let Some(a) = alias.as_str() {
                        let trimmed = a.trim();
                        if !trimmed.is_empty() {
                            aliases.push(trimmed.to_string());
                        }
                    }
                }
            }
            // Handle single string format: aliases: my-alias
            else if let Some(alias_str) = json.get("aliases").and_then(|a| a.as_str()) {
                let trimmed = alias_str.trim();
                if !trimmed.is_empty() {
                    aliases.push(trimmed.to_string());
                }
            }
            // Also check for singular "alias" key
            if let Some(alias_array) = json.get("alias").and_then(|a| a.as_array()) {
                for alias in alias_array {
                    if let Some(a) = alias.as_str() {
                        let trimmed = a.trim();
                        if !trimmed.is_empty() && !aliases.contains(&trimmed.to_string()) {
                            aliases.push(trimmed.to_string());
                        }
                    }
                }
            } else if let Some(alias_str) = json.get("alias").and_then(|a| a.as_str()) {
                let trimmed = alias_str.trim();
                if !trimmed.is_empty() && !aliases.contains(&trimmed.to_string()) {
                    aliases.push(trimmed.to_string());
                }
            }
        }
    }

    aliases
}

/// Extract block references from content: lines ending with ^block-id
/// Returns: Vec<(block_id, content, line_number)>
fn extract_blocks(content: &str) -> Vec<(String, String, i32)> {
    let mut blocks = Vec::new();

    // Match lines ending with ^block-id (alphanumeric, hyphens, underscores)
    let block_re = Regex::new(r"^(.+?)\s+\^([a-zA-Z0-9_-]+)\s*$").unwrap();

    for (line_num, line) in content.lines().enumerate() {
        let line_num = (line_num + 1) as i32;

        if let Some(cap) = block_re.captures(line) {
            let block_content = cap[1].trim().to_string();
            let block_id = cap[2].to_string();
            blocks.push((block_id, block_content, line_num));
        }
    }

    blocks
}

/// Extract card links from content: [[card:Card Title]] or [[card:Board Name/Card Title]]
fn extract_card_links(content: &str) -> Vec<(String, Option<String>, String)> {
    let mut card_links = Vec::new();

    // Card links: [[card:title]] or [[card:board/title]] or [[card:title|display]]
    let card_re = Regex::new(r"\[\[card:([^\]|]+)(?:\|[^\]]+)?\]\]").unwrap();

    for cap in card_re.captures_iter(content) {
        let reference = cap[1].trim().to_string();

        // Parse board/title or just title
        let (board_name, card_title) = if reference.contains('/') {
            let parts: Vec<&str> = reference.splitn(2, '/').collect();
            (Some(parts[0].to_string()), parts[1].to_string())
        } else {
            (None, reference)
        };

        // Extract context
        let context = content
            .find(&cap[0])
            .map(|i| {
                let start = floor_char_boundary(content, i.saturating_sub(30));
                let end = ceil_char_boundary(content, (i + cap[0].len() + 30).min(content.len()));
                content[start..end].to_string()
            })
            .unwrap_or_default();

        card_links.push((card_title, board_name, context));
    }

    card_links
}
