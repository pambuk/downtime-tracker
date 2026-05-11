import { useEffect, useRef, useState } from "react";
import { fetchAllStatuses, SERVICES } from "./services";
import type { ServiceStatus, Severity } from "./types";
import { pickComment } from "./comments";
import { ThisIsFine } from "./ThisIsFine";
import { detectChanges } from "./changes";
import { isTauri, openExternal } from "./runtime";
import {
    ensureTauriNotificationPermission,
    notifyChangeEvents,
} from "./notifier";

const REFRESH_MS = 60_000;

function initialStatuses(): ServiceStatus[] {
    return SERVICES.map((config) => ({
        config,
        severity: "unknown" as Severity,
        description: "Loading…",
        fetchedAt: 0,
    }));
}

export function App() {
    const [statuses, setStatuses] = useState<ServiceStatus[]>(initialStatuses);

    const [lastFetch, setLastFetch] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [loading, setLoading] = useState(true);

    // Snapshot used only for notification detection. Held in a ref (not state)
    // so the polling loop can read it without re-creating the effect, and so
    // detection only runs when *new* fetched data arrives — not on unrelated
    // re-renders. Seeded with the loading snapshot so a service that is already
    // in an incident on first fetch still emits a notification.
    const prevStatusesRef = useRef<ServiceStatus[]>(statuses);

    useEffect(() => {
        let cancelled = false;
        const tick = async () => {
            const next = await fetchAllStatuses();
            if (cancelled) return;

            const events = detectChanges(prevStatusesRef.current, next);
            if (events.length > 0) {
                // Pass the *new* fire count so the notification's dog image
                // matches the dog about to render on the page.
                const newFires = next.filter((s) =>
                    isOnFire(s.severity),
                ).length;
                void notifyChangeEvents(events, newFires, next.length);
            }
            prevStatusesRef.current = updateDetectionBaseline(
                prevStatusesRef.current,
                next,
            );

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

    useEffect(() => {
        if (!isTauri()) return;

        let cancelled = false;
        let cleanup: (() => void) | undefined;

        const requestWhenVisible = async () => {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            const appWindow = getCurrentWindow();

            if (await appWindow.isVisible()) {
                void ensureTauriNotificationPermission();
            }

            const unlisten = await appWindow.onFocusChanged(
                ({ payload: focused }) => {
                    if (focused) void ensureTauriNotificationPermission();
                },
            );

            if (cancelled) {
                unlisten();
            } else {
                cleanup = unlisten;
            }
        };

        void requestWhenVisible();

        return () => {
            cancelled = true;
            cleanup?.();
        };
    }, []);

    // Tick once a second so the "updated Ns ago" display stays current.
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const fires = statuses.filter((s) => isOnFire(s.severity)).length;
    const agoSeconds = lastFetch
        ? Math.max(0, Math.floor((now - lastFetch) / 1000))
        : null;
    const nextCheckSeconds = lastFetch
        ? Math.max(0, Math.ceil((REFRESH_MS - (now - lastFetch)) / 1000))
        : null;
    const webStatusText = loading
        ? "Checking…"
        : `${fires} on fire of ${statuses.length} · updated ${formatAgo(agoSeconds)}`;
    const desktopCountdownText = formatCountdown(nextCheckSeconds);
    const desktop = isTauri();

    return (
        <main className={`app ${desktop ? "app-tauri" : "app-web"}`}>
            {!desktop && (
                <header>
                    <h1>Downtime Tracker</h1>
                    <p className="subtitle">{webStatusText}</p>
                </header>
            )}

            <ThisIsFine fires={fires} total={statuses.length} />

            {desktop && (
                <p className="subtitle desktop-status">
                    {loading ? (
                        "Checking…"
                    ) : (
                        <>
                            {fires} on fire of {statuses.length} · next check in{" "}
                            <span className="countdown">
                                {desktopCountdownText}
                            </span>
                        </>
                    )}
                </p>
            )}

            <ul className="services">
                {statuses.map((s, i) => (
                    <li
                        key={s.config.id}
                        className={`service sev-${s.severity}`}
                    >
                        <div className="row">
                            <span className="dot" aria-hidden />
                            <a
                                className="name"
                                href={s.config.url}
                                rel="noreferrer"
                                onClick={(e) => {
                                    // Tauri's webview blocks plain target="_blank" navigation
                                    // (there's no second tab to open into); openExternal hands
                                    // off to the OS default browser. In the web build it
                                    // falls back to window.open.
                                    e.preventDefault();
                                    void openExternal(s.config.url);
                                }}
                            >
                                {s.config.name}
                            </a>
                            <span className="desc">{s.description}</span>
                        </div>
                        <p className="comment">
                            "{pickComment(i, s.severity)}"
                        </p>
                    </li>
                ))}
            </ul>
        </main>
    );
}

function isOnFire(severity: Severity): boolean {
    return (
        severity === "minor" || severity === "major" || severity === "critical"
    );
}

function updateDetectionBaseline(
    prev: ServiceStatus[],
    next: ServiceStatus[],
): ServiceStatus[] {
    const prevById = new Map(prev.map((s) => [s.config.id, s]));
    return next.map((curr) => {
        if (curr.severity !== "unknown") return curr;
        return prevById.get(curr.config.id) ?? curr;
    });
}

function formatAgo(seconds: number | null): string {
    if (seconds === null || seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
}

function formatCountdown(seconds: number | null): string {
    if (seconds === null) return "soon";
    if (seconds <= 0) return "now";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
}
