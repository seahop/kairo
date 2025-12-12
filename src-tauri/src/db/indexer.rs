use regex::Regex;
use rusqlite::params;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tauri::AppHandle;
use walkdir::WalkDir;

use super::with_db;
use crate::commands::notes::NoteMetadata;

/// Index the entire vault
pub async fn index_vault(
    app: &AppHandle,
    vault_path: &PathBuf,
) -> Result<usize, Box<dyn std::error::Error>> {
    let notes_dir = vault_path.join("notes");
    let mut count = 0;

    // Walk through all markdown files
    for entry in WalkDir::new(&notes_dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
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
    vault_path: &PathBuf,
    relative_path: &PathBuf,
) -> Result<(), Box<dyn std::error::Error>> {
    let full_path = vault_path.join(relative_path);
    let content = std::fs::read_to_string(&full_path)?;
    let metadata = std::fs::metadata(&full_path)?;

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

    with_db(app, |conn| {
        // Insert or update the note
        conn.execute(
            r#"
            INSERT INTO notes (id, path, title, content, content_hash, created_at, modified_at, frontmatter)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(path) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                content_hash = excluded.content_hash,
                modified_at = excluded.modified_at,
                frontmatter = excluded.frontmatter
            "#,
            params![id, path_str, title, content, content_hash, created_at, modified_at, frontmatter],
        )?;

        // Clear existing entities, tags, code blocks, and backlinks for this note
        conn.execute("DELETE FROM entities WHERE note_id = ?1", params![id])?;
        conn.execute("DELETE FROM tags WHERE note_id = ?1", params![id])?;
        conn.execute("DELETE FROM code_blocks WHERE note_id = ?1", params![id])?;
        conn.execute("DELETE FROM backlinks WHERE source_id = ?1", params![id])?;

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

        Ok(())
    })
}

/// Remove a note from the index
pub fn remove_note_from_index(app: &AppHandle, path: &str) -> Result<(), Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        conn.execute("DELETE FROM notes WHERE path = ?1", params![path])?;
        Ok(())
    })
}

/// List all notes
pub fn list_all_notes(app: &AppHandle) -> Result<Vec<NoteMetadata>, Box<dyn std::error::Error>> {
    with_db(app, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, path, title, modified_at, created_at FROM notes ORDER BY modified_at DESC",
        )?;

        let notes = stmt
            .query_map([], |row| {
                Ok(NoteMetadata {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    modified_at: row.get(3)?,
                    created_at: row.get(4)?,
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
        if trimmed.starts_with("# ") {
            return trimmed[2..].trim().to_string();
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

fn serde_yaml_to_json(yaml: &str) -> Result<String, Box<dyn std::error::Error>> {
    // Simple key: value parsing
    use std::collections::HashMap;
    let mut map: HashMap<String, serde_json::Value> = HashMap::new();

    for line in yaml.lines() {
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim().to_string();
            let value = value.trim();

            // Handle arrays
            if value.starts_with('[') && value.ends_with(']') {
                let items: Vec<String> = value[1..value.len()-1]
                    .split(',')
                    .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string())
                    .collect();
                map.insert(key, serde_json::json!(items));
            } else {
                map.insert(key, serde_json::json!(value.trim_matches('"').trim_matches('\'')));
            }
        }
    }

    Ok(serde_json::to_string(&map)?)
}

fn extract_entities(content: &str) -> Vec<(String, String, String, i32)> {
    let mut entities = Vec::new();

    // IP addresses (IPv4)
    let ip_re = Regex::new(r"\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b").unwrap();

    // Domains
    let domain_re = Regex::new(r"\b([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)\b").unwrap();

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
            entities.push(("ip".to_string(), cap[1].to_string(), context.clone(), line_num));
        }

        for cap in domain_re.captures_iter(line) {
            let domain = &cap[1];
            // Filter out common non-domains
            if !domain.ends_with(".md") && !domain.ends_with(".rs") && !domain.ends_with(".ts") {
                entities.push(("domain".to_string(), domain.to_string(), context.clone(), line_num));
            }
        }

        for cap in cve_re.captures_iter(line) {
            entities.push(("cve".to_string(), cap[1].to_string(), context.clone(), line_num));
        }

        for cap in username_re.captures_iter(line) {
            entities.push(("username".to_string(), cap[1].to_string(), context.clone(), line_num));
        }

        for cap in mention_re.captures_iter(line) {
            entities.push(("mention".to_string(), cap[1].to_string(), context.clone(), line_num));
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

        if line.starts_with("```") {
            if in_block {
                // End of code block
                blocks.push((current_lang.clone(), current_content.clone(), start_line, line_num));
                current_content.clear();
                current_lang = None;
                in_block = false;
            } else {
                // Start of code block
                in_block = true;
                start_line = line_num;
                let lang = line[3..].trim();
                current_lang = if lang.is_empty() { None } else { Some(lang.to_string()) };
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
        let context = content
            .find(&cap[0])
            .map(|i| {
                let start = i.saturating_sub(30);
                let end = (i + cap[0].len() + 30).min(content.len());
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
                let start = i.saturating_sub(30);
                let end = (i + cap[0].len() + 30).min(content.len());
                content[start..end].to_string()
            })
            .unwrap_or_default();
        links.push((path, context));
    }

    links
}
