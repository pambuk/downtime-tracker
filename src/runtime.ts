// Small runtime-detection layer so the same React app works in two places:
//
//   - In the browser (Vite dev server, `npm run preview`, deployed static
//     site): falls back to web APIs (window.open, Web Notifications).
//   - Inside the Tauri webview (`npm run tauri:dev`, packaged .app): uses
//     the Tauri plugins, which give us native macOS behavior (default
//     browser hand-off, real notification center entries, image
//     attachments).
//
// Tauri plugin imports are dynamic (`await import(...)`) so they're only
// pulled in when actually running under Tauri. In a browser build the
// dynamic branch is never taken; modern bundlers can also tree-shake it
// away if proven unreachable.

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Open `url` in the user's default browser. In the web build this is just
 * window.open; in Tauri it goes through the opener plugin (otherwise the
 * webview would block the navigation).
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
