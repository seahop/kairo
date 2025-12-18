//! Dataview query execution
//!
//! Converts Dataview AST to SQL and executes against the notes database.

use rusqlite::{params_from_iter, Connection, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Query types supported by Dataview
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum QueryType {
    Table,
    List,
    Task,
}

/// Source filter for FROM clause
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FromSource {
    pub source_type: String, // "folder", "tag", "link", "outgoing"
    pub value: String,
}

/// Condition for WHERE clause
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedCondition {
    pub condition_type: String, // "comparison", "and", "or", "not"
    pub field: Option<String>,
    pub operator: Option<String>,
    pub value: Option<serde_json::Value>,
    pub conditions: Option<Vec<SerializedCondition>>,
}

/// Sort clause
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortClause {
    pub field: String,
    pub direction: String, // "ASC" or "DESC"
}

/// The full serialized query from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedQuery {
    pub query_type: String,
    pub fields: Vec<String>,
    pub from_sources: Vec<FromSource>,
    pub where_clause: Option<SerializedCondition>,
    pub sort_clauses: Vec<SortClause>,
    pub group_by: Option<String>,
    pub limit: Option<i32>,
}

/// A single result row
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataviewRow {
    pub path: String,
    pub title: String,
    pub values: HashMap<String, serde_json::Value>,
}

/// Query execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataviewResult {
    #[serde(rename = "type")]
    pub result_type: String,
    pub columns: Option<Vec<String>>,
    pub rows: Vec<DataviewRow>,
    pub error: Option<String>,
    pub execution_time: Option<u64>,
}

impl DataviewResult {
    pub fn error(message: &str) -> Self {
        Self {
            result_type: "LIST".to_string(),
            columns: None,
            rows: vec![],
            error: Some(message.to_string()),
            execution_time: None,
        }
    }
}

/// Execute a dataview query
pub fn execute_query(conn: &Connection, query: &SerializedQuery) -> DataviewResult {
    let start = std::time::Instant::now();

    match build_and_execute(conn, query) {
        Ok(mut result) => {
            result.execution_time = Some(start.elapsed().as_millis() as u64);
            result
        }
        Err(e) => DataviewResult::error(&e),
    }
}

fn build_and_execute(conn: &Connection, query: &SerializedQuery) -> Result<DataviewResult, String> {
    let mut sql = String::new();
    let mut params: Vec<String> = vec![];

    // SELECT clause
    sql.push_str("SELECT n.path, n.title, n.created_at, n.modified_at, n.frontmatter");

    // FROM clause
    sql.push_str(" FROM notes n");

    // Join with tags if needed for filtering
    let needs_tags_join = query.from_sources.iter().any(|s| s.source_type == "tag")
        || condition_references_tags(&query.where_clause);

    if needs_tags_join {
        sql.push_str(" LEFT JOIN tags t ON t.note_id = n.id");
    }

    // WHERE clause
    let mut where_parts: Vec<String> = vec![];

    // Always exclude archived by default
    where_parts.push("n.archived = 0".to_string());

    // FROM sources
    for source in &query.from_sources {
        match source.source_type.as_str() {
            "folder" => {
                let folder = source.value.trim_matches('"').trim_matches('/');
                where_parts.push(format!("n.path LIKE ?"));
                params.push(format!("{}%", folder));
            }
            "tag" => {
                let tag = source.value.trim_matches('#');
                where_parts.push(format!("t.tag = ?"));
                params.push(tag.to_string());
            }
            "link" => {
                // Notes that link TO this note
                let target = source.value.trim_matches(|c| c == '[' || c == ']');
                sql = format!(
                    "{} INNER JOIN backlinks b ON b.source_id = n.id AND b.target_path LIKE ?",
                    sql
                );
                params.push(format!("%{}%", target));
            }
            _ => {}
        }
    }

    // WHERE conditions
    if let Some(ref condition) = query.where_clause {
        let (cond_sql, cond_params) = build_condition(condition)?;
        where_parts.push(cond_sql);
        params.extend(cond_params);
    }

    if !where_parts.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&where_parts.join(" AND "));
    }

    // GROUP BY (if we joined tags, we need to group)
    if needs_tags_join {
        sql.push_str(" GROUP BY n.id");
    }

    // ORDER BY clause
    if !query.sort_clauses.is_empty() {
        sql.push_str(" ORDER BY ");
        let order_parts: Vec<String> = query
            .sort_clauses
            .iter()
            .map(|s| {
                let field = map_field_to_sql(&s.field);
                let dir = if s.direction.to_uppercase() == "DESC" {
                    "DESC"
                } else {
                    "ASC"
                };
                format!("{} {}", field, dir)
            })
            .collect();
        sql.push_str(&order_parts.join(", "));
    } else {
        // Default sort by modified time
        sql.push_str(" ORDER BY n.modified_at DESC");
    }

    // LIMIT clause
    if let Some(limit) = query.limit {
        sql.push_str(&format!(" LIMIT {}", limit));
    }

    // Execute query
    let param_refs: Vec<&dyn rusqlite::ToSql> =
        params.iter().map(|s| s as &dyn rusqlite::ToSql).collect();

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("SQL prepare error: {}", e))?;

    let rows = stmt
        .query_map(params_from_iter(param_refs.iter()), |row| {
            Ok(extract_row(row, &query.fields))
        })
        .map_err(|e| format!("Query error: {}", e))?;

    let mut result_rows = vec![];
    for row_result in rows {
        match row_result {
            Ok(row) => result_rows.push(row),
            Err(e) => return Err(format!("Row error: {}", e)),
        }
    }

    Ok(DataviewResult {
        result_type: query.query_type.clone(),
        columns: if query.query_type == "TABLE" {
            Some(query.fields.clone())
        } else {
            None
        },
        rows: result_rows,
        error: None,
        execution_time: None,
    })
}

fn condition_references_tags(condition: &Option<SerializedCondition>) -> bool {
    match condition {
        None => false,
        Some(c) => {
            if let Some(ref field) = c.field {
                if field.starts_with("file.tags") || field == "tags" {
                    return true;
                }
            }
            if let Some(ref conditions) = c.conditions {
                return conditions
                    .iter()
                    .any(|c| condition_references_tags(&Some(c.clone())));
            }
            false
        }
    }
}

fn build_condition(condition: &SerializedCondition) -> Result<(String, Vec<String>), String> {
    match condition.condition_type.as_str() {
        "comparison" => {
            let field = condition
                .field
                .as_ref()
                .ok_or("Missing field in comparison")?;
            let operator = condition
                .operator
                .as_ref()
                .ok_or("Missing operator in comparison")?;
            let value = condition
                .value
                .as_ref()
                .ok_or("Missing value in comparison")?;

            let sql_field = map_field_to_sql(field);
            let (sql_op, sql_value) = map_operator_and_value(operator, value)?;

            Ok((format!("{} {} ?", sql_field, sql_op), vec![sql_value]))
        }
        "and" => {
            let conditions = condition
                .conditions
                .as_ref()
                .ok_or("Missing conditions in AND")?;
            let mut parts = vec![];
            let mut params = vec![];
            for c in conditions {
                let (sql, p) = build_condition(c)?;
                parts.push(sql);
                params.extend(p);
            }
            Ok((format!("({})", parts.join(" AND ")), params))
        }
        "or" => {
            let conditions = condition
                .conditions
                .as_ref()
                .ok_or("Missing conditions in OR")?;
            let mut parts = vec![];
            let mut params = vec![];
            for c in conditions {
                let (sql, p) = build_condition(c)?;
                parts.push(sql);
                params.extend(p);
            }
            Ok((format!("({})", parts.join(" OR ")), params))
        }
        "not" => {
            let conditions = condition
                .conditions
                .as_ref()
                .ok_or("Missing conditions in NOT")?;
            if conditions.is_empty() {
                return Err("Empty NOT conditions".to_string());
            }
            let (sql, params) = build_condition(&conditions[0])?;
            Ok((format!("NOT ({})", sql), params))
        }
        _ => Err(format!(
            "Unknown condition type: {}",
            condition.condition_type
        )),
    }
}

fn map_field_to_sql(field: &str) -> String {
    match field {
        "file.name" | "title" => "n.title".to_string(),
        "file.path" | "path" => "n.path".to_string(),
        "file.ctime" | "created" => "n.created_at".to_string(),
        "file.mtime" | "modified" => "n.modified_at".to_string(),
        "file.folder" => {
            "substr(n.path, 1, length(n.path) - length(replace(n.path, '/', '')) - 1)".to_string()
        }
        "file.tags" | "tags" => "t.tag".to_string(),
        _ => {
            // Assume it's a frontmatter field
            format!("json_extract(n.frontmatter, '$.{}')", field)
        }
    }
}

fn map_operator_and_value(
    operator: &str,
    value: &serde_json::Value,
) -> Result<(String, String), String> {
    let sql_value = match value {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => if *b { "1" } else { "0" }.to_string(),
        serde_json::Value::Null => "NULL".to_string(),
        _ => value.to_string(),
    };

    let sql_op = match operator.to_uppercase().as_str() {
        "=" => "=",
        "!=" => "!=",
        ">" => ">",
        "<" => "<",
        ">=" => ">=",
        "<=" => "<=",
        "CONTAINS" => return Ok(("LIKE".to_string(), format!("%{}%", sql_value))),
        "STARTSWITH" => return Ok(("LIKE".to_string(), format!("{}%", sql_value))),
        "ENDSWITH" => return Ok(("LIKE".to_string(), format!("%{}", sql_value))),
        _ => return Err(format!("Unknown operator: {}", operator)),
    };

    Ok((sql_op.to_string(), sql_value))
}

fn extract_row(row: &Row, fields: &[String]) -> DataviewRow {
    let path: String = row.get(0).unwrap_or_default();
    let title: String = row.get(1).unwrap_or_default();
    let created_at: i64 = row.get(2).unwrap_or(0);
    let modified_at: i64 = row.get(3).unwrap_or(0);
    let frontmatter: Option<String> = row.get(4).ok();

    let mut values: HashMap<String, serde_json::Value> = HashMap::new();

    // Add standard fields
    values.insert("file.name".to_string(), serde_json::json!(title));
    values.insert("file.path".to_string(), serde_json::json!(path));
    values.insert("file.ctime".to_string(), serde_json::json!(created_at));
    values.insert("file.mtime".to_string(), serde_json::json!(modified_at));

    // Extract folder from path
    if let Some(last_slash) = path.rfind('/') {
        values.insert(
            "file.folder".to_string(),
            serde_json::json!(&path[..last_slash]),
        );
    }

    // Parse frontmatter and extract requested fields
    if let Some(fm_str) = frontmatter {
        if let Ok(fm) = serde_json::from_str::<serde_json::Value>(&fm_str) {
            for field in fields {
                if !field.starts_with("file.") {
                    if let Some(val) = fm.get(field) {
                        values.insert(field.clone(), val.clone());
                    }
                }
            }
        }
    }

    DataviewRow {
        path,
        title,
        values,
    }
}
