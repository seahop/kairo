mod commands;
mod db;
mod fs;
mod git;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize database on app start
            let app_handle = app.handle().clone();

            #[cfg(debug_assertions)]
            {
                // Open devtools in debug mode
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            // Initialize the database manager
            db::init(&app_handle)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Vault commands
            commands::vault::open_vault,
            commands::vault::create_vault,
            commands::vault::get_vault_info,
            commands::vault::close_vault,
            // Note commands
            commands::notes::list_notes,
            commands::notes::read_note,
            commands::notes::write_note,
            commands::notes::delete_note,
            commands::notes::rename_note,
            commands::notes::create_folder,
            // Search commands
            commands::search::search_notes,
            commands::search::search_entities,
            commands::search::save_search,
            commands::search::get_saved_searches,
            // Database commands
            commands::db::reindex_vault,
            commands::db::get_backlinks,
            commands::db::get_graph_data,
            // Git commands
            git::git_status,
            git::git_pull,
            git::git_push,
            git::git_stage_all,
            git::git_stage_file,
            git::git_unstage_file,
            git::git_commit,
            // Kanban commands
            commands::kanban::kanban_list_boards,
            commands::kanban::kanban_get_board,
            commands::kanban::kanban_create_board,
            commands::kanban::kanban_delete_board,
            commands::kanban::kanban_add_column,
            commands::kanban::kanban_remove_column,
            commands::kanban::kanban_get_cards,
            commands::kanban::kanban_add_card,
            commands::kanban::kanban_move_card,
            commands::kanban::kanban_delete_card,
            // Plugin data commands
            commands::plugin::read_plugin_data,
            commands::plugin::write_plugin_data,
            commands::plugin::delete_plugin_data,
            commands::plugin::list_plugin_data,
            // Extension commands
            commands::extensions::list_extension_folders,
            commands::extensions::read_extension_manifest,
            commands::extensions::read_file_text,
            commands::extensions::get_extensions_path,
            commands::extensions::ensure_extensions_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
