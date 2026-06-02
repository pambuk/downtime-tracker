# Login Item Toggle

## Goal

Add a desktop-only UI setting that lets the user choose whether Downtime Tracker starts automatically when the system starts on macOS.

The toggle should reflect the real OS/Tauri autostart state. Do not duplicate this setting in the app settings store.

## Current State

- The desktop app is Tauri 2 with a tray-resident macOS window.
- `src/runtime.ts` already provides `isTauri()` so desktop-only frontend code can be guarded.
- `src-tauri/src/lib.rs` registers opener, notification, and log plugins, and sets macOS activation policy to `Accessory`.
- `src-tauri/capabilities/default.json` currently grants opener, notification, and window permissions only.
- There is no settings UI yet; this toggle should share the settings surface created for tracked services.

## UX Scope

- Show a `Start at login` toggle only in the Tauri desktop build.
- Hide the toggle in the web build.
- Initialize it from the current autostart state.
- While the state is loading or being changed, disable the control.
- If enable/disable fails, revert the UI state and show a compact inline error.
- Put the toggle in the general settings area, separate from tracked services.

Suggested copy:

- Label: `Start at login`
- Secondary text: `Launch Downtime Tracker in the menu bar when macOS starts.`

## Tauri Plugin Setup

Use the official Tauri autostart plugin.

Required project changes:

- npm dependency: `@tauri-apps/plugin-autostart`.
- Cargo dependency: `tauri-plugin-autostart`.
- Initialize the plugin in `src-tauri/src/lib.rs`.
- Add capabilities:
  - `"autostart:allow-enable"`
  - `"autostart:allow-disable"`
  - `"autostart:allow-is-enabled"`

For macOS, initialize with `MacosLauncher::LaunchAgent`.

Important: plugin setup should register the manager only. It should not call `enable()` during app startup, because the user's toggle controls that.

Suggested Rust shape:

```rust
#[cfg(desktop)]
app.handle().plugin(tauri_plugin_autostart::init(
  tauri_plugin_autostart::MacosLauncher::LaunchAgent,
  None,
))?;
```

The official Tauri docs expose frontend APIs `enable()`, `disable()`, and `isEnabled()`, and list the required capabilities for these calls.

## Frontend API Wrapper

Add a small runtime helper module, for example `src/autostart.ts`:

```ts
export async function getAutostartEnabled(): Promise<boolean>;
export async function setAutostartEnabled(enabled: boolean): Promise<void>;
```

Behavior:

- If not Tauri, return `false` or throw a controlled "unsupported" error.
- In Tauri, dynamically import `@tauri-apps/plugin-autostart`.
- `getAutostartEnabled()` calls `isEnabled()`.
- `setAutostartEnabled(true)` calls `enable()`.
- `setAutostartEnabled(false)` calls `disable()`.

Dynamic imports preserve the current web build pattern used by `src/runtime.ts` and `src/notifier.ts`.

## UI Wiring

Add the toggle inside the shared settings panel:

- On panel open or component mount, call `getAutostartEnabled()`.
- Store local state:
  - `enabled`
  - `loading`
  - `saving`
  - `error`
- On toggle:
  - optimistically update or wait for the call; waiting is simpler and less surprising.
  - call `setAutostartEnabled(next)`.
  - read back with `getAutostartEnabled()` after success to avoid drift.
  - if it fails, keep previous state and show an error.

This feature should not affect polling or notifications directly. Autostart only controls whether macOS launches the app after login.

## Desktop Behavior Notes

- The app already starts hidden as a tray-resident app (`visible: false` in `tauri.conf.json`), and `lib.rs` sets `ActivationPolicy::Accessory`.
- Therefore, when launched at login, the expected behavior is: app starts in the menu bar, no Dock item, polling begins in the background.
- Verify this behavior specifically, because a login launch path can expose differences from `tauri dev`.

## Verification

- `npm run typecheck`
- `npm run build`
- `npm run tauri:build`
- Manual desktop check:
  - open settings.
  - toggle `Start at login` on.
  - close/reopen settings and verify it remains on.
  - toggle it off and verify it remains off.
  - inspect macOS System Settings > General > Login Items, if needed.
- Packaged-app check:
  - install or run the built `.app`.
  - toggle on.
  - log out/in or restart if doing full verification.
  - confirm Downtime Tracker launches into the menu bar without opening a visible window.

## Risks

- Autostart behavior can differ between `tauri dev` and a packaged `.app`; trust packaged-app verification more.
- Unsigned local builds may behave differently on newer macOS versions. If the toggle appears to work but login launch does not happen, test with a built app in `/Applications`.
- Capabilities are easy to miss in Tauri 2; missing permissions will look like frontend API failures.

## Progress

### Phase 1: Plugin Wiring

- [ ] 1.1 Add npm and Cargo autostart dependencies.
- [ ] 1.2 Register the Tauri autostart plugin with `MacosLauncher::LaunchAgent`.
- [ ] 1.3 Add autostart permissions to capabilities.

### Phase 2: Frontend Helper

- [ ] 2.1 Add a Tauri-guarded autostart API wrapper.
- [ ] 2.2 Ensure web builds do not import or execute the plugin path.
- [ ] 2.3 Add error handling for unsupported or failed calls.

### Phase 3: Settings UI

- [ ] 3.1 Add `Start at login` toggle to the settings panel.
- [ ] 3.2 Initialize from `isEnabled()`.
- [ ] 3.3 Save through `enable()`/`disable()` and read back after success.
- [ ] 3.4 Hide the toggle in web builds.

### Phase 4: Verification

- [ ] 4.1 Run typecheck/build.
- [ ] 4.2 Build the Tauri app.
- [ ] 4.3 Verify toggle persistence in desktop.
- [ ] 4.4 Verify login launch behavior with the packaged app.
