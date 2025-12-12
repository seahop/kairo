#![allow(dead_code)]

use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// File watcher for detecting changes in the vault
pub struct VaultWatcher {
    watcher: RecommendedWatcher,
}

impl VaultWatcher {
    /// Create a new vault watcher
    pub fn new(app: AppHandle, vault_path: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let (tx, rx) = channel();

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            Config::default().with_poll_interval(Duration::from_secs(2)),
        )?;

        // Watch the notes directory
        let notes_dir = vault_path.join("notes");
        if notes_dir.exists() {
            watcher.watch(&notes_dir, RecursiveMode::Recursive)?;
        }

        // Spawn a thread to handle events
        let app_handle = app.clone();
        std::thread::spawn(move || {
            while let Ok(event) = rx.recv() {
                handle_fs_event(&app_handle, event);
            }
        });

        Ok(Self { watcher })
    }

    /// Stop watching
    pub fn stop(self) -> Result<(), Box<dyn std::error::Error>> {
        // The watcher will be dropped and stop watching
        drop(self.watcher);
        Ok(())
    }
}

fn handle_fs_event(app: &AppHandle, event: Event) {
    use notify::EventKind;

    match event.kind {
        EventKind::Create(_) => {
            for path in event.paths {
                if is_markdown_file(&path) {
                    let _ = app.emit("file-created", path.to_string_lossy().to_string());
                }
            }
        }
        EventKind::Modify(_) => {
            for path in event.paths {
                if is_markdown_file(&path) {
                    let _ = app.emit("file-modified", path.to_string_lossy().to_string());
                }
            }
        }
        EventKind::Remove(_) => {
            for path in event.paths {
                if is_markdown_file(&path) {
                    let _ = app.emit("file-deleted", path.to_string_lossy().to_string());
                }
            }
        }
        _ => {}
    }
}

fn is_markdown_file(path: &Path) -> bool {
    path.extension()
        .is_some_and(|ext| ext == "md" || ext == "markdown")
}
