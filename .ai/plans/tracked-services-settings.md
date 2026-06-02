# Tracked Services Settings

## Goal

Add UI settings for the list of tracked Statuspage services. The app should keep sensible built-in defaults, but once users edit the list they own it: they can remove, rename, reorder, or change any default service, and they can add their own Statuspage-backed services.

The app must only save services it can poll successfully. For UX, users may paste friendly inputs such as `https://www.githubstatus.com/`; the app should normalize that into the supported Statuspage base URL shape before validation and saving.

## Current State

- `src/services.ts` owns a compile-time `SERVICES` list and `fetchAllStatuses()` polls that global list.
- `src/App.tsx` seeds initial loading statuses from `SERVICES` and starts a polling interval once on mount.
- `src/types.ts` defines `ServiceConfig` as `{ id, name, url }`, where `url` is a Statuspage base URL with no trailing slash.
- The desktop and web builds share the same React source, so settings code must keep browser compatibility.

## UX Scope

- Add a settings entry point in the main UI, likely an icon button near the status summary.
- In desktop, also add a `Preferences...` item to the tray menu that opens/focuses the window and opens the settings UI.
- In settings, show all tracked services as editable rows:
  - enabled/disabled or remove action; prefer remove for true list ownership.
  - display name input.
  - Statuspage URL input.
  - validate/save per row or validate on apply.
  - reorder controls are optional for the first implementation unless the UI naturally needs them.
- Add a primary add-service flow:
  - user enters name and URL.
  - app normalizes URL.
  - app validates the summary endpoint.
  - app saves only if validation passes.
- Add `Restore defaults`, but do not silently re-add defaults after the user removed them.

## Data Model

Create a settings-owned tracked service type, reusing `ServiceConfig` where possible:

```ts
export interface TrackedService extends ServiceConfig {
  source: "builtin" | "custom";
}
```

Persist the full current service list, not just diffs from defaults. This makes "remove default service" durable and easy to reason about.

Suggested persisted shape:

```ts
interface AppSettingsV1 {
  version: 1;
  services: TrackedService[];
}
```

Default behavior:

- If no settings exist, seed from `DEFAULT_SERVICES`.
- If settings exist, use them exactly as stored.
- If the stored list is empty, allow it, but the dashboard should render an empty state instead of polling.
- A future migration can offer a "new default services available" prompt, but this first implementation should avoid implicit list changes.

## URL Normalization

Add a pure helper such as `normalizeStatuspageUrl(input: string): NormalizedStatuspageUrl | ValidationError`.

Accepted examples:

- `https://www.githubstatus.com/`
- `https://www.githubstatus.com`
- `www.githubstatus.com`
- `https://www.githubstatus.com/api/v2/summary.json`
- `https://www.githubstatus.com/api/v2/summary.json?anything=ignored`

Normalization rules:

- trim whitespace.
- prepend `https://` when no scheme is present.
- reject non-HTTP(S) schemes.
- strip query/hash.
- if pathname is `/api/v2/summary.json`, strip it back to the origin/base path.
- trim trailing slashes.
- save only the base URL used by `fetchStatus`, for example `https://www.githubstatus.com`.

Validation rules:

- fetch `${normalizedUrl}/api/v2/summary.json` with `cache: "no-store"`.
- require a successful HTTP response.
- require JSON with `status.indicator` in the known Statuspage indicator set and a string `status.description`.
- optionally infer the display name from `page.name` if Statuspage returns it and the user did not provide a name.

## Persistence

Create a small settings storage module so the rest of the app is not coupled to the storage backend.

Suggested API:

```ts
export async function loadSettings(): Promise<AppSettingsV1>;
export async function saveSettings(settings: AppSettingsV1): Promise<void>;
```

Use:

- Tauri Store plugin when running in desktop.
- `localStorage` fallback in web.

Tauri Store implementation requires:

- npm dependency: `@tauri-apps/plugin-store`.
- Cargo dependency: `tauri-plugin-store`.
- register `tauri_plugin_store::Builder::default().build()` in `src-tauri/src/lib.rs`.
- add `"store:default"` to `src-tauri/capabilities/default.json`.

The official Tauri Store docs describe `load`, `get`, `set`, and `save`, and note that plugin commands must be enabled in capabilities.

## App Wiring

Refactor service polling to accept the selected service list:

- Rename `SERVICES` to `DEFAULT_SERVICES`.
- Change `fetchAllStatuses()` to `fetchAllStatuses(services: ServiceConfig[])`.
- Keep `fetchStatus(config)` as-is except for any URL assumptions clarified by normalization.
- Move `initialStatuses(services)` into `App.tsx` or a helper.
- Load settings before the first real poll, then seed loading statuses from `settings.services`.
- When the settings service list changes:
  - cancel any in-flight poll for the old list.
  - reset displayed statuses to loading rows for the new list.
  - reset `prevStatusesRef.current` to the loading snapshot for the new list.
  - skip notification comparison for the first completed fetch after a list change, or rely on `detectChanges` skipping missing IDs and make sure renamed/re-IDed rows do not look like incidents.

Important detail: service IDs need a stable generation strategy. For custom services, derive from normalized hostname plus a suffix on collision, or use `crypto.randomUUID()` and persist it. For edited built-ins, preserve the existing ID unless the row is deleted and re-added.

## UI Components

Suggested files:

- `src/settings.ts` for settings shape, defaults loading, storage, migration, URL normalization helpers.
- `src/statuspageValidation.ts` or keep validation in `settings.ts` if small.
- `src/SettingsPanel.tsx` for the modal/sheet UI.
- small additions to `src/index.css` for settings layout and controls.

Keep the dashboard as the first screen. Settings should be an overlay or sheet, not a new landing page.

## Edge Cases

- Empty services list: show a friendly empty state and do not start a polling interval.
- Duplicate normalized URLs: reject or merge; reject is simpler and clearer.
- Network validation failure: do not save the new/edited URL; show the failure inline.
- Existing service currently down: validation should accept Statuspage JSON even when indicator is not `none`.
- Fake local Statuspage: preserve `VITE_FAKE_STATUSPAGE_URL` behavior for development. It can be appended to defaults only when the env var is present and no persisted settings exist, or shown as a temporary dev-only row outside saved settings.
- Browser CORS: validation and polling both happen client-side; failures should remain `unknown` for polling, but settings save should block invalid/unreachable URLs.

## Verification

- `npm run typecheck`
- `npm run build`
- Manual web check:
  - default services render on first load.
  - removing GitHub persists after refresh.
  - adding `https://www.githubstatus.com/` normalizes and validates.
  - adding a non-Statuspage URL fails without changing saved settings.
- Manual desktop check:
  - settings load/save in Tauri.
  - tray `Preferences...` opens the settings UI.
  - changing services resets the dashboard without false notifications.
- Fake Statuspage check:
  - `npm run tauri:dev:fake`
  - verify fake service still works in a clean settings state.

## Progress

### Phase 1: Settings Model And Storage

- [ ] 1.1 Add `DEFAULT_SERVICES` and settings types.
- [ ] 1.2 Add load/save settings abstraction with `localStorage` fallback.
- [ ] 1.3 Add Tauri Store dependency, plugin registration, and capability.
- [ ] 1.4 Add migration/default seeding behavior.

### Phase 2: URL Normalization And Validation

- [ ] 2.1 Implement pure URL normalization helper.
- [ ] 2.2 Implement Statuspage summary validation.
- [ ] 2.3 Add focused unit-style coverage if a test runner is introduced; otherwise keep helpers pure and manually verify through UI.

### Phase 3: Polling Refactor

- [ ] 3.1 Change `fetchAllStatuses` to accept a service list.
- [ ] 3.2 Load settings before polling.
- [ ] 3.3 Reset status and notification baselines when services change.
- [ ] 3.4 Handle empty service list.

### Phase 4: Settings UI

- [ ] 4.1 Add settings entry point.
- [ ] 4.2 Add service list editor.
- [ ] 4.3 Add add/edit validation flow.
- [ ] 4.4 Add remove and restore-defaults behavior.
- [ ] 4.5 Add desktop tray `Preferences...` entry.

### Phase 5: Verification

- [ ] 5.1 Run typecheck/build.
- [ ] 5.2 Manually verify web persistence and validation.
- [ ] 5.3 Manually verify desktop persistence and tray entry.
- [ ] 5.4 Update README/CLAUDE docs for adding services through UI.
