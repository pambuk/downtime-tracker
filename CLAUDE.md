# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Vite 6 + React 19 + TypeScript 5.7. Browser-only — no backend. Calls Statuspage v2 endpoints (`/api/v2/summary.json`) directly from the client; these allow CORS.

## Commands

- `npm run dev` — Vite dev server with HMR
- `npm run build` — runs `tsc -b` (typecheck via project references) then `vite build`
- `npm run typecheck` — `tsc -b --noEmit`, faster than full build
- `npm run preview` — serve the built `dist/` locally

There is no test runner or linter configured yet. `npm run build` is the de-facto verification step — it fails on any type error.

## Architecture

Single-page React app, all logic client-side:

- `src/services.ts` — `SERVICES` registry (GitHub, Claude, OpenAI) and `fetchStatus` / `fetchAllStatuses`. Network failures don't reject; they resolve to a `ServiceStatus` with `severity: "unknown"` so the UI can render uniformly.
- `src/types.ts` — `Indicator` mirrors Statuspage's five values (`none | minor | major | critical | maintenance`); `Severity = Indicator | "unknown"` adds the local-only fetch-failure state.
- `src/comments.ts` — sarcastic comments keyed by severity. `pickComment(serviceIndex, severity)` picks a stable line for `(severity, serviceIndex)`: the severity hash sets a rotating starting point in the pool, then `serviceIndex` is added on top so N services sharing one severity get N distinct lines (provided the pool has at least N entries — most do, with ~10 lines per severity). Earlier versions hashed `serviceId + severity`, which collided when several services shared a state.
- `src/ThisIsFine.tsx` — the dog. Renders one of 4 PNGs from `src/assets/status-dog/` keyed by fire count (0/1/2/3+); the last entry covers "and beyond" so the component never indexes out of bounds. A small "this is fine." HTML overlay sits on top of the image (the PNGs themselves don't include the speech bubble). Fire count comes from `App` and is "services where `severity ∈ {minor, major, critical}`". Maintenance and unknown deliberately don't count as fires.
- `src/App.tsx` — owns the polling loop (`REFRESH_MS = 60_000`), seeds initial state with `severity: "unknown"` so the first render has a consistent shape, and uses a `cancelled` flag to drop late responses after unmount.

## Conventions

- Severity → CSS color is wired via `.sev-${severity}` class names in `src/index.css`. Adding a new severity means adding both a `--<name>` CSS variable and a `.service.sev-<name> .dot` rule.
- Keep the sarcastic comments and the "this is fine" dog — they're product requirements from the README, not decoration.
- TS config has `noUnusedLocals` and `noUnusedParameters` on; the build will fail on dead variables.

## Adding a service

Append to `SERVICES` in `src/services.ts`. The only requirement is that the URL is a Statuspage-hosted page (so `${url}/api/v2/summary.json` returns the standard summary shape). Non-Statuspage services would need a different fetch path.
