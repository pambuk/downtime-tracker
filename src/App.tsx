import { useEffect, useState } from "react";
import { fetchAllStatuses, SERVICES } from "./services";
import type { ServiceStatus, Severity } from "./types";
import { pickComment } from "./comments";
import { ThisIsFine } from "./ThisIsFine";

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

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const next = await fetchAllStatuses();
      if (!cancelled) {
        setStatuses(next);
        setLastFetch(Date.now());
        setLoading(false);
      }
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
        {statuses.map((s) => (
          <li key={s.config.id} className={`service sev-${s.severity}`}>
            <div className="row">
              <span className="dot" aria-hidden />
              <a className="name" href={s.config.url} target="_blank" rel="noreferrer">
                {s.config.name}
              </a>
              <span className="desc">{s.description}</span>
            </div>
            <p className="comment">"{pickComment(s.config.id, s.severity)}"</p>
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
