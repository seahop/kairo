use rusqlite::Connection;

/// Initialize the database schema
pub fn init_schema(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    conn.execute_batch(
        r#"
        -- Core note index
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            path TEXT UNIQUE NOT NULL,
            title TEXT,
            content TEXT,
            content_hash TEXT,
            created_at INTEGER,
            modified_at INTEGER,
            frontmatter TEXT  -- JSON
        );

        CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(path);
        CREATE INDEX IF NOT EXISTS idx_notes_modified ON notes(modified_at);

        -- Full-text search using FTS5
        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            title,
            content,
            tags,
            code_blocks,
            content='notes',
            content_rowid='rowid',
            tokenize='porter unicode61'
        );

        -- Triggers to keep FTS in sync
        CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
            INSERT INTO notes_fts(rowid, title, content, tags, code_blocks)
            VALUES (NEW.rowid, NEW.title, NEW.content, '', '');
        END;

        CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
            INSERT INTO notes_fts(notes_fts, rowid, title, content, tags, code_blocks)
            VALUES ('delete', OLD.rowid, OLD.title, OLD.content, '', '');
        END;

        CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
            INSERT INTO notes_fts(notes_fts, rowid, title, content, tags, code_blocks)
            VALUES ('delete', OLD.rowid, OLD.title, OLD.content, '', '');
            INSERT INTO notes_fts(rowid, title, content, tags, code_blocks)
            VALUES (NEW.rowid, NEW.title, NEW.content, '', '');
        END;

        -- Entity extraction index (IPs, domains, CVEs, etc.)
        CREATE TABLE IF NOT EXISTS entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
            entity_type TEXT NOT NULL,  -- 'ip', 'domain', 'cve', 'username', 'mention'
            value TEXT NOT NULL,
            context TEXT,  -- Surrounding text for preview
            line_number INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
        CREATE INDEX IF NOT EXISTS idx_entities_value ON entities(value);
        CREATE INDEX IF NOT EXISTS idx_entities_note ON entities(note_id);

        -- Backlinks (note-to-note references)
        CREATE TABLE IF NOT EXISTS backlinks (
            source_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
            target_path TEXT NOT NULL,  -- Path of the target note
            context TEXT,  -- The text surrounding the link
            PRIMARY KEY (source_id, target_path)
        );

        CREATE INDEX IF NOT EXISTS idx_backlinks_target ON backlinks(target_path);

        -- Saved searches
        CREATE TABLE IF NOT EXISTS saved_searches (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            query TEXT NOT NULL,
            filters TEXT,  -- JSON
            created_at INTEGER NOT NULL
        );

        -- Tags (extracted from frontmatter and content)
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
            tag TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
        CREATE INDEX IF NOT EXISTS idx_tags_note ON tags(note_id);

        -- Code blocks (for specialized code search)
        CREATE TABLE IF NOT EXISTS code_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
            language TEXT,
            content TEXT NOT NULL,
            line_start INTEGER,
            line_end INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_code_blocks_note ON code_blocks(note_id);
        CREATE INDEX IF NOT EXISTS idx_code_blocks_lang ON code_blocks(language);

        -- Kanban boards (plugin data, but core enough to include)
        CREATE TABLE IF NOT EXISTS kanban_boards (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            columns TEXT NOT NULL,  -- JSON array with { id, name, color?, isDone }
            created_at INTEGER NOT NULL,
            modified_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS kanban_cards (
            id TEXT PRIMARY KEY,
            board_id TEXT REFERENCES kanban_boards(id) ON DELETE CASCADE,
            column_id TEXT NOT NULL,
            note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            description TEXT,
            position INTEGER NOT NULL,
            created_at INTEGER,
            updated_at INTEGER,
            closed_at INTEGER,
            due_date INTEGER,
            priority TEXT,  -- 'low', 'medium', 'high', 'urgent'
            metadata TEXT  -- JSON: { assignees: string[], labels: string[] }
        );

        CREATE INDEX IF NOT EXISTS idx_kanban_cards_board ON kanban_cards(board_id);
        CREATE INDEX IF NOT EXISTS idx_kanban_cards_column ON kanban_cards(column_id);

        -- Kanban labels (board-level reusable labels)
        CREATE TABLE IF NOT EXISTS kanban_labels (
            id TEXT PRIMARY KEY,
            board_id TEXT REFERENCES kanban_boards(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#6b7280',
            UNIQUE(board_id, name)
        );

        CREATE INDEX IF NOT EXISTS idx_kanban_labels_board ON kanban_labels(board_id);

        -- Kanban board members (people who can be assigned to tasks)
        CREATE TABLE IF NOT EXISTS kanban_board_members (
            id TEXT PRIMARY KEY,
            board_id TEXT REFERENCES kanban_boards(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            added_at INTEGER NOT NULL,
            UNIQUE(board_id, name)
        );

        CREATE INDEX IF NOT EXISTS idx_kanban_members_board ON kanban_board_members(board_id);

        -- Card backlinks (note-to-card references via [[card:title]] syntax)
        CREATE TABLE IF NOT EXISTS card_backlinks (
            source_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
            card_id TEXT REFERENCES kanban_cards(id) ON DELETE CASCADE,
            context TEXT,  -- The text surrounding the link
            PRIMARY KEY (source_id, card_id)
        );

        CREATE INDEX IF NOT EXISTS idx_card_backlinks_card ON card_backlinks(card_id);
        CREATE INDEX IF NOT EXISTS idx_card_backlinks_source ON card_backlinks(source_id);
        "#,
    )?;

    // Run migrations for existing databases
    run_migrations(conn)?;

    Ok(())
}

/// Run database migrations for schema updates
fn run_migrations(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    // Check if kanban_cards has the new columns by trying to select them
    // If they don't exist, add them via ALTER TABLE

    let has_description = conn
        .prepare("SELECT description FROM kanban_cards LIMIT 0")
        .is_ok();

    if !has_description {
        // Add new columns to kanban_cards for existing databases
        conn.execute_batch(
            r#"
            ALTER TABLE kanban_cards ADD COLUMN description TEXT;
            ALTER TABLE kanban_cards ADD COLUMN created_at INTEGER;
            ALTER TABLE kanban_cards ADD COLUMN updated_at INTEGER;
            ALTER TABLE kanban_cards ADD COLUMN closed_at INTEGER;
            ALTER TABLE kanban_cards ADD COLUMN due_date INTEGER;
            ALTER TABLE kanban_cards ADD COLUMN priority TEXT;
            "#,
        )?;

        // Backfill existing cards with current timestamp
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "UPDATE kanban_cards SET created_at = ?1, updated_at = ?1 WHERE created_at IS NULL",
            rusqlite::params![now],
        )?;
    }

    Ok(())
}
