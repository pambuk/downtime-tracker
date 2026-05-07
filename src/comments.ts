import type { Severity } from "./types";

const COMMENTS: Record<Severity, string[]> = {
  none: [
    "Everything is fine. Suspiciously fine.",
    "All clear. Probably a trap.",
    "Nothing on fire. For now.",
    "Green across the board. Enjoy it while it lasts.",
    "Operational. Whatever that means.",
    "No incidents. Don't jinx it.",
    "Quiet. Too quiet.",
    "Status: working. Mood: skeptical.",
    "All systems go. Sure.",
    "Calm before the storm.",
  ],
  minor: [
    "A small fire. Manageable. Probably.",
    "Not great, not terrible.",
    "Things are mostly fine. Mostly.",
    "Just a little smoke. Don't panic.",
    "Some of it works. Try to guess which parts.",
    "A minor inconvenience. Pretend you didn't notice.",
    "Slight degradation. Adjust expectations downward.",
    "It's a minor incident, until it isn't.",
    "A few things on fire. Within tolerance.",
    "Reduced functionality. So, normal.",
  ],
  major: [
    "Yeah, that's a lot of smoke.",
    "Define 'down'.",
    "Have you tried turning it off and on again? They have. It didn't help.",
    "This is no longer fine.",
    "Several things broken. Pick one to be sad about.",
    "Major outage. Maybe go for a walk.",
    "Engineers paged. Coffee consumed. Outcomes pending.",
    "It's not just you. It's everyone.",
    "Status page is honest today.",
    "We're past the 'just refresh it' stage.",
  ],
  critical: [
    "Time to go for a walk.",
    "It's a good day to update your CV.",
    "RIP.",
    "Everything is on fire. Including the fire extinguisher.",
    "Catastrophic failure. Stop trying.",
    "Total outage. Existential dread optional but encouraged.",
    "Production: vibes only.",
    "Service unavailable. Hopes also unavailable.",
    "Take the rest of the day off.",
    "Reboot the universe.",
  ],
  maintenance: [
    "Scheduled chaos.",
    "They knew this was coming. We did not.",
    "Planned downtime. So that makes it okay.",
    "Maintenance window. Window remains broken.",
    "Scheduled for now. Outage tomorrow.",
    "On purpose. Allegedly.",
  ],
  unknown: [
    "Couldn't reach the status page. Make of that what you will.",
    "Schrödinger's service: simultaneously up and down.",
    "No signal. Probably also on fire.",
    "Status unknown. Vibes: bad.",
    "Can't load the status page. Status itself: unclear.",
    "Possibly fine. Possibly cooked.",
  ],
};

// Pick a stable comment for (severity, serviceIndex). The severity supplies a
// rotating starting point in the pool; the service index then offsets from
// that, so N services in the same severity always get N distinct lines as
// long as the pool has at least N entries.
export function pickComment(serviceIndex: number, severity: Severity): string {
  const pool = COMMENTS[severity];
  const offset = (hash(severity) + serviceIndex) % pool.length;
  return pool[offset];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
