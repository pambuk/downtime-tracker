#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // External link clicks (service status pages) are routed through this
    // plugin so they open in the user's default browser instead of being
    // blocked by the webview.
    .plugin(tauri_plugin_opener::init())
    // Native macOS notifications for service severity changes. The frontend
    // calls into this via @tauri-apps/plugin-notification. Notifications are
    // text-only — the visual identity is the app's bundle icon (set via
    // `npm run tauri -- icon`).
    .plugin(tauri_plugin_notification::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
