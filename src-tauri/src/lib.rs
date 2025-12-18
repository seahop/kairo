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
        .plugin(tauri_plugin_window_state::Builder::new().build())
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

            // Initialize git credential state for session-based caching
            app.manage(git::create_credential_state());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Vault commands
            commands::vault::open_vault,
            commands::vault::create_vault,
            commands::vault::get_vault_info,
            commands::vault::close_vault,
            commands::vault::get_vault_path,
            commands::vault::save_attachment,
            commands::vault::get_vault_user,
            commands::vault::set_vault_user,
            // Note commands
            commands::notes::list_notes,
            commands::notes::read_note,
            commands::notes::write_note,
            commands::notes::delete_note,
            commands::notes::rename_note,
            commands::notes::create_folder,
            commands::notes::set_note_archived,
            // Search commands
            commands::search::search_notes,
            commands::search::search_entities,
            commands::search::save_search,
            commands::search::get_saved_searches,
            // Database commands
            commands::db::reindex_vault,
            commands::db::get_backlinks,
            commands::db::get_graph_data,
            commands::db::get_all_tags,
            commands::db::get_all_mentions,
            // Vault health commands
            commands::db::get_orphan_notes,
            commands::db::get_broken_links,
            commands::db::get_vault_health,
            // Organization helper commands
            commands::db::get_unlinked_mentions,
            commands::db::get_random_note,
            commands::db::get_potential_mocs,
            commands::db::get_notes_by_folder,
            // Git commands
            git::git_status,
            git::git_pull,
            git::git_push,
            git::git_stage_all,
            git::git_stage_file,
            git::git_unstage_file,
            git::git_commit,
            // Git user config commands
            git::git_get_user_config,
            git::git_set_user_config,
            git::git_set_session_passphrase,
            git::git_clear_session_credentials,
            git::git_check_ssh_key,
            // Git note history commands
            git::git_note_history,
            git::git_note_at_commit,
            git::git_restore_note_version,
            // Kanban commands
            commands::kanban::kanban_list_boards,
            commands::kanban::kanban_get_board,
            commands::kanban::kanban_create_board,
            commands::kanban::kanban_delete_board,
            commands::kanban::kanban_add_column,
            commands::kanban::kanban_remove_column,
            commands::kanban::kanban_update_column,
            commands::kanban::kanban_get_cards,
            commands::kanban::kanban_get_card,
            commands::kanban::kanban_add_card,
            commands::kanban::kanban_update_card,
            commands::kanban::kanban_move_card,
            commands::kanban::kanban_delete_card,
            commands::kanban::kanban_archive_card,
            commands::kanban::kanban_get_labels,
            commands::kanban::kanban_create_label,
            commands::kanban::kanban_update_label,
            commands::kanban::kanban_delete_label,
            commands::kanban::kanban_get_board_members,
            commands::kanban::kanban_add_board_member,
            commands::kanban::kanban_remove_board_member,
            commands::kanban::kanban_get_assignee_suggestions,
            commands::kanban::kanban_get_card_backlinks,
            commands::kanban::kanban_get_all_cards,
            commands::kanban::kanban_find_card_by_title,
            // Diagram commands
            commands::diagram::diagram_list_boards,
            commands::diagram::diagram_get_board,
            commands::diagram::diagram_create_board,
            commands::diagram::diagram_update_board,
            commands::diagram::diagram_delete_board,
            commands::diagram::diagram_archive_board,
            commands::diagram::diagram_add_node,
            commands::diagram::diagram_update_node,
            commands::diagram::diagram_delete_node,
            commands::diagram::diagram_bulk_update_nodes,
            commands::diagram::diagram_add_edge,
            commands::diagram::diagram_update_edge,
            commands::diagram::diagram_delete_edge,
            commands::diagram::diagram_link_note,
            commands::diagram::diagram_add_note_link,
            commands::diagram::diagram_remove_note_link,
            commands::diagram::diagram_remove_all_note_links,
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
            commands::extensions::read_extension_manifest_from_path,
            commands::extensions::extension_exists,
            commands::extensions::import_extension,
            commands::extensions::read_extension_settings,
            commands::extensions::save_extension_settings,
            commands::extensions::remove_extension,
            // App settings commands
            commands::settings::get_app_settings,
            commands::settings::get_recent_vaults,
            commands::settings::add_recent_vault,
            commands::settings::get_last_vault,
            commands::settings::set_app_setting,
            commands::settings::get_app_setting,
            commands::settings::remove_recent_vault,
            // Dataview commands
            commands::dataview::execute_dataview_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
