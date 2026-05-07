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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const next = await fetchAllStatuses();
      if (!cancelled) {
        setStatuses(next);
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

  const fires = statuses.filter((s) => isOnFire(s.severity)).length;

  return (
    <main className="app">
      <header>
        <h1>Downtime Tracker</h1>
        <p className="subtitle">
          {loading ? "Checking…" : `${fires} on fire of ${statuses.length}`}
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
