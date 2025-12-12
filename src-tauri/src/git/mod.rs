use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;

use crate::db;

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatus {
    #[serde(rename = "isRepo")]
    pub is_repo: bool,
    pub branch: String,
    pub ahead: i32,
    pub behind: i32,
    pub staged: Vec<String>,
    pub modified: Vec<String>,
    pub untracked: Vec<String>,
    #[serde(rename = "hasRemote")]
    pub has_remote: bool,
}

fn get_vault_path(app: &AppHandle) -> Result<PathBuf, String> {
    db::get_current_vault_path(app).ok_or("No vault open".to_string())
}

fn run_git_command(vault_path: &PathBuf, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(vault_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            Err("Git command failed".to_string())
        } else {
            Err(stderr)
        }
    }
}

fn is_git_repo(vault_path: &PathBuf) -> bool {
    Command::new("git")
        .args(["rev-parse", "--git-dir"])
        .current_dir(vault_path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Get git status for the vault
#[tauri::command]
pub fn git_status(app: AppHandle) -> Result<GitStatus, String> {
    let vault_path = get_vault_path(&app)?;

    // Check if it's a git repo
    if !is_git_repo(&vault_path) {
        return Ok(GitStatus {
            is_repo: false,
            branch: String::new(),
            ahead: 0,
            behind: 0,
            staged: vec![],
            modified: vec![],
            untracked: vec![],
            has_remote: false,
        });
    }

    // Get current branch
    let branch = run_git_command(&vault_path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .unwrap_or_else(|_| "unknown".to_string());

    // Check for remote
    let has_remote = run_git_command(&vault_path, &["remote"])
        .map(|r| !r.is_empty())
        .unwrap_or(false);

    // Get ahead/behind counts
    let (ahead, behind) = if has_remote {
        // Fetch latest (silently)
        let _ = run_git_command(&vault_path, &["fetch", "--quiet"]);

        let ahead = run_git_command(&vault_path, &["rev-list", "--count", "@{u}..HEAD"])
            .and_then(|s| s.parse().map_err(|_| "Parse error".to_string()))
            .unwrap_or(0);

        let behind = run_git_command(&vault_path, &["rev-list", "--count", "HEAD..@{u}"])
            .and_then(|s| s.parse().map_err(|_| "Parse error".to_string()))
            .unwrap_or(0);

        (ahead, behind)
    } else {
        (0, 0)
    };

    // Get file status
    let status_output = run_git_command(&vault_path, &["status", "--porcelain"])?;

    let mut staged = vec![];
    let mut modified = vec![];
    let mut untracked = vec![];

    for line in status_output.lines() {
        if line.len() < 3 {
            continue;
        }

        let index_status = line.chars().next().unwrap_or(' ');
        let worktree_status = line.chars().nth(1).unwrap_or(' ');
        let file = line[3..].to_string();

        // Staged files (added, modified, deleted in index)
        if matches!(index_status, 'A' | 'M' | 'D' | 'R' | 'C') {
            staged.push(file.clone());
        }

        // Modified in worktree
        if matches!(worktree_status, 'M' | 'D') {
            modified.push(file.clone());
        }

        // Untracked
        if index_status == '?' && worktree_status == '?' {
            untracked.push(file);
        }
    }

    Ok(GitStatus {
        is_repo: true,
        branch,
        ahead,
        behind,
        staged,
        modified,
        untracked,
        has_remote,
    })
}

/// Pull from remote
#[tauri::command]
pub fn git_pull(app: AppHandle) -> Result<String, String> {
    let vault_path = get_vault_path(&app)?;
    run_git_command(&vault_path, &["pull"])
}

/// Push to remote
#[tauri::command]
pub fn git_push(app: AppHandle) -> Result<String, String> {
    let vault_path = get_vault_path(&app)?;
    run_git_command(&vault_path, &["push"])
}

/// Stage all changes
#[tauri::command]
pub fn git_stage_all(app: AppHandle) -> Result<(), String> {
    let vault_path = get_vault_path(&app)?;
    run_git_command(&vault_path, &["add", "-A"])?;
    Ok(())
}

/// Stage a specific file
#[tauri::command]
pub fn git_stage_file(app: AppHandle, path: String) -> Result<(), String> {
    let vault_path = get_vault_path(&app)?;
    run_git_command(&vault_path, &["add", &path])?;
    Ok(())
}

/// Unstage a specific file
#[tauri::command]
pub fn git_unstage_file(app: AppHandle, path: String) -> Result<(), String> {
    let vault_path = get_vault_path(&app)?;
    run_git_command(&vault_path, &["reset", "HEAD", &path])?;
    Ok(())
}

/// Commit staged changes
#[tauri::command]
pub fn git_commit(app: AppHandle, message: String) -> Result<String, String> {
    let vault_path = get_vault_path(&app)?;

    if message.trim().is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }

    run_git_command(&vault_path, &["commit", "-m", &message])
}
