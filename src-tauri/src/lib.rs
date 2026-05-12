use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  Manager, WindowEvent,
};

#[cfg(target_os = "macos")]
fn show_main_window(app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
  let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
  let _ = app.show();
  let _ = window.show();
  let _ = window.set_focus();
}

#[cfg(not(target_os = "macos"))]
fn show_main_window(_app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
  let _ = window.show();
  let _ = window.set_focus();
}

#[cfg(target_os = "macos")]
fn hide_native_window(window: &tauri::Window) {
  let app = window.app_handle();
  let _ = app.hide();
  let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
}

#[cfg(not(target_os = "macos"))]
fn hide_native_window(window: &tauri::Window) {
  let _ = window.hide();
}

#[cfg(target_os = "macos")]
fn hide_webview_window(window: &tauri::WebviewWindow) {
  let app = window.app_handle();
  let _ = app.hide();
  let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
}

#[cfg(not(target_os = "macos"))]
fn hide_webview_window(window: &tauri::WebviewWindow) {
  let _ = window.hide();
}

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
    // Intercept the window close button: hide the window instead of
    // exiting the app. The user re-opens via the tray icon, and quits
    // explicitly via the tray's right-click menu.
    .on_window_event(|window, event| {
      if window.label() == "main" {
        if let WindowEvent::CloseRequested { api, .. } = event {
          api.prevent_close();
          hide_native_window(window);
        }
      }
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Start as a tray-resident app: no Dock or Cmd-Tab entry while the
      // window is hidden. When the tray icon shows the window, we switch
      // back to `Regular` so the visible app can be reached via Cmd-Tab.
      #[cfg(target_os = "macos")]
      app.set_activation_policy(tauri::ActivationPolicy::Accessory);

      // Right-click context menu for the tray icon. Quit is the only entry
      // for now; we can add "About", "Preferences", etc. later if needed.
      let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&quit])?;

      // Tray icon. We use a separate monochrome flame *template* image
      // here rather than the colorful bundle dog: macOS menu-bar icons are
      // expected to be black-on-transparent template images so the OS can
      // render them in the right shade for the current menu-bar theme
      // (light/dark, hover, active). Using the bundle icon directly makes
      // the tray entry look out of place next to other system icons.
      //
      // `include_bytes!` embeds the PNG in the binary at compile time —
      // no runtime path resolution, works the same in `tauri dev` and in
      // the built `.app`. Source for this image lives in
      // src-tauri/icon-source/tray-icon/.
      let tray_icon = tauri::image::Image::from_bytes(include_bytes!(
        "../icon-source/tray-icon/flameTemplate@2x.png"
      ))
      .expect("invalid tray icon");

      let _tray = TrayIconBuilder::with_id("main")
        .icon(tray_icon)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
          if event.id().as_ref() == "quit" {
            app.exit(0);
          }
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
          } = event
          {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
              if window.is_visible().unwrap_or(false) {
                hide_webview_window(&window);
              } else {
                // Show at the window's last known position. macOS
                // remembers it across hide/show; first launch uses the
                // OS-default centering.
                show_main_window(app, &window);
              }
            }
          }
        })
        .build(app)?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
