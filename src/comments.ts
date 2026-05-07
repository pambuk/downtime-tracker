import type { Severity } from "./types";

const COMMENTS: Record<Severity, string[]> = {
  none: [
    "Everything is fine. Suspiciously fine.",
    "All clear. Probably a trap.",
    "Nothing on fire. For now.",
    "Green across the board. Enjoy it while it lasts.",
  ],
  minor: [
    "A small fire. Manageable. Probably.",
    "Not great, not terrible.",
    "Things are mostly fine. Mostly.",
    "Just a little smoke. Don't panic.",
  ],
  major: [
    "Yeah, that's a lot of smoke.",
    "Define 'down'.",
    "Have you tried turning it off and on again? They have. It didn't help.",
    "This is no longer fine.",
  ],
  critical: [
    "Time to go for a walk.",
    "It's a good day to update your CV.",
    "RIP.",
    "Everything is on fire. Including the fire extinguisher.",
  ],
  maintenance: [
    "Scheduled chaos.",
    "They knew this was coming. We did not.",
    "Planned downtime. So that makes it okay.",
  ],
  unknown: [
    "Couldn't reach the status page. Make of that what you will.",
    "Schrödinger's service: simultaneously up and down.",
    "No signal. Probably also on fire.",
  ],
};

// Stable per-render pick keyed by service id + severity, so the comment
// doesn't flicker on every re-render but does change when severity changes.
export function pickComment(serviceId: string, severity: Severity): string {
  const pool = COMMENTS[severity];
  const seed = hash(`${serviceId}:${severity}`);
  return pool[seed % pool.length];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
