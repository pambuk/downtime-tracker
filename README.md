# Status tracker

A dashboard that polls the status pages of services and displays them with appropriate number of fires. Available as a browser app and a macOS tray app.

![screenshot](screenshot.png)

## Tracked services

- [GitHub](https://www.githubstatus.com/)
- [Claude / Anthropic](https://status.claude.com/)
- [OpenAI](https://status.openai.com/)
- [DocPlanner](https://status.docplanner.com/)
- [Jira](https://jira-software.status.atlassian.com/)

## Getting started

### Web

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The page auto-refreshes statuses every 60 seconds.

### Desktop (macOS)

Requires [Rust](https://rustup.rs/) installed locally.

```bash
npm install
npm run tauri:dev
```

The app lives in the menu bar. Click the tray icon to show/hide the window. Right-click for a menu with a Quit option. Native notifications fire when a service changes status.

### Local notification testing

To test tray/background notifications without waiting for a real outage, run the app with a local fake Statuspage service:

```bash
npm run tauri:dev:fake
```

Open the app once from the tray and grant notification permission, then hide it again. From another terminal, change the fake service status:

```bash
curl "http://127.0.0.1:8787/set?indicator=minor"     # incident-new
curl "http://127.0.0.1:8787/set?indicator=major"     # severity-changed
curl "http://127.0.0.1:8787/set?indicator=none"      # recovered
```

The app polls every 60 seconds, so the notification should appear on the next refresh while the window is still hidden.

## Stack

- Vite 6 + React 19 + TypeScript 5.7
- Tauri 2 (macOS desktop shell)
- No backend — fetches Statuspage v2 endpoints (`/api/v2/summary.json`) directly from the browser (CORS is allowed by all tracked services)

## Adding a service

Append an entry to `SERVICES` in `src/services.ts`. The service must be hosted on Statuspage so the `/api/v2/summary.json` endpoint is available.

## Build

### Web

```bash
npm run build      # typecheck + production build
npm run typecheck  # typecheck only (faster)
npm run preview    # serve dist/ locally
```

### Desktop (macOS)

```bash
npm run tauri:build
```

Produces a `.app` and `.dmg` in `src-tauri/target/release/bundle/`.

## Credits

The "this is fine" dog images were generated using [Codex](https://openai.com/codex).

## License

[MIT](LICENSE)
