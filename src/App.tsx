import { useEffect, useRef, useState } from "react";
import { fetchAllStatuses, SERVICES } from "./services";
import type { ServiceStatus, Severity } from "./types";
import { pickComment } from "./comments";
import { ThisIsFine } from "./ThisIsFine";
import { detectChanges, type ChangeEvent } from "./changes";

const REFRESH_MS = 60_000;

export function App() {
  const [statuses, setStatuses] = useState<ServiceStatus[]>(() =>
    SERVICES.map((config) => ({
      config,
      severity: "unknown" as Severity,
      description: "Loading…",
      fetchedAt: 0,
    })),
  );
  const [lastFetch, setLastFetch] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);

  // Snapshot of the last successfully-fetched statuses. Held in a ref (not
  // state) so the polling loop can read it without re-creating the effect,
  // and so detection only runs when *new* fetched data arrives — not on
  // unrelated re-renders. `null` until the first fetch completes, which is
  // how we suppress phantom "incident" events for the initial unknown→real
  // transition.
  const prevStatusesRef = useRef<ServiceStatus[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const next = await fetchAllStatuses();
      if (cancelled) return;

      if (prevStatusesRef.current) {
        const events = detectChanges(prevStatusesRef.current, next);
        if (events.length > 0) {
          logChangeEvents(events);
        }
      }
      prevStatusesRef.current = next;

      setStatuses(next);
      setLastFetch(Date.now());
      setLoading(false);
    };
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Tick once a second so the "updated Ns ago" display stays current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fires = statuses.filter((s) => isOnFire(s.severity)).length;
  const agoSeconds = lastFetch ? Math.max(0, Math.floor((now - lastFetch) / 1000)) : null;

  return (
    <main className="app">
      <header>
        <h1>Downtime Tracker</h1>
        <p className="subtitle">
          {loading
            ? "Checking…"
            : `${fires} on fire of ${statuses.length} · updated ${formatAgo(agoSeconds)}`}
        </p>
      </header>

      <ThisIsFine fires={fires} />

      <ul className="services">
        {statuses.map((s, i) => (
          <li key={s.config.id} className={`service sev-${s.severity}`}>
            <div className="row">
              <span className="dot" aria-hidden />
              <a className="name" href={s.config.url} target="_blank" rel="noreferrer">
                {s.config.name}
              </a>
              <span className="desc">{s.description}</span>
            </div>
            <p className="comment">"{pickComment(i, s.severity)}"</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

function isOnFire(severity: Severity): boolean {
  return severity === "minor" || severity === "major" || severity === "critical";
}

function formatAgo(seconds: number | null): string {
  if (seconds === null || seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

// Stand-in for the future Tauri notification call.
// Logs each event individually plus a summary line when several services
// changed in the same tick — the same structure the stacked notification
// layer will use ("3 services failing" + per-service detail).
function logChangeEvents(events: ChangeEvent[]): void {
  const newOrWorse = events.filter(
    (e) => e.kind === "incident-new" || e.kind === "incident-worsened",
  );
  if (newOrWorse.length > 1) {
    const names = newOrWorse.map((e) => e.service.config.name).join(", ");
    console.log(`[downtime] Multiple services failing: ${names}`);
  }

  for (const e of events) {
    switch (e.kind) {
      case "incident-new":
        console.log(
          `[downtime] NEW incident — ${e.service.config.name}: ${e.from} → ${e.to} (${e.service.description})`,
        );
        break;
      case "incident-worsened":
        console.log(
          `[downtime] WORSENED — ${e.service.config.name}: ${e.from} → ${e.to} (${e.service.description})`,
        );
        break;
      case "recovered":
        console.log(
          `[downtime] RECOVERED — ${e.service.config.name} (was ${e.from})`,
        );
        break;
    }
  }
}
