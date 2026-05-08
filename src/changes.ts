import type { ServiceStatus, Severity } from "./types";

// What we tell the notification layer happened between two ticks.
// Keep this shape minimal but specific — the notification layer should
// be able to produce a title/body without re-deriving anything.
export type ChangeEvent =
  | { kind: "incident-new"; service: ServiceStatus; from: Severity; to: Severity }
  | { kind: "severity-changed"; service: ServiceStatus; from: Severity; to: Severity }
  | { kind: "recovered"; service: ServiceStatus; from: Severity };

// Severity ranks used for active-incident detection.
// `unknown` and `maintenance` are intentionally rank 0 — same as `none` —
// because fetch failures and planned maintenance are not active incidents.
// (See CLAUDE.md: maintenance/unknown deliberately don't count as fires.)
const FIRE_RANK: Record<Severity, number> = {
  unknown: 0,
  none: 0,
  maintenance: 0,
  minor: 1,
  major: 2,
  critical: 3,
};

const isFire = (s: Severity): boolean => FIRE_RANK[s] > 0;

/**
 * Compare two snapshots of service statuses and return the events worth
 * notifying about. Pure function: no IO, no side effects.
 *
 * Rules:
 *  - ok → fire        => "incident-new"
 *  - fire → different fire severity           => "severity-changed"
 *  - fire → ok        => "recovered"
 *  - everything else (e.g. fire → unknown, unknown ↔ none, maintenance flips)
 *    is intentionally ignored so we don't spam the user.
 *
 * Services that exist in `next` but not `prev` (or vice versa) are skipped —
 * adding a service mid-session shouldn't generate a fake "incident".
 */
export function detectChanges(
  prev: ServiceStatus[],
  next: ServiceStatus[],
): ChangeEvent[] {
  const prevById = new Map(prev.map((s) => [s.config.id, s]));
  const events: ChangeEvent[] = [];

  for (const curr of next) {
    const before = prevById.get(curr.config.id);
    if (!before) continue;

    const from = before.severity;
    const to = curr.severity;
    if (from === to) continue;

    const fromFire = isFire(from);
    const toFire = isFire(to);

    if (!fromFire && toFire) {
      events.push({ kind: "incident-new", service: curr, from, to });
    } else if (fromFire && to === "none") {
      events.push({ kind: "recovered", service: curr, from });
    } else if (fromFire && toFire && FIRE_RANK[to] !== FIRE_RANK[from]) {
      events.push({ kind: "severity-changed", service: curr, from, to });
    }
  }

  return events;
}
