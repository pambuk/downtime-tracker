import type { ChangeEvent } from "./changes";
import { isTauri } from "./runtime";

// Dog images for the *browser* notification fallback only. The Web
// Notifications API supports a small `icon` URL natively, and Vite gives us
// hashed asset URLs for these imports.
//
// The Tauri build doesn't use these — its notifications are text-only and
// the visual identity comes from the app's bundle icon (the dog-themed
// icon we generated via `npm run tauri -- icon`). That's because macOS's
// `UNNotificationAttachment` API is unreliable in practice for unbundled
// dev builds and has system-level constraints we couldn't get past for
// our use case; trying to attach a per-notification image gave us no
// reliable behavior across `tauri dev` and `tauri build`.
import dog0 from "./assets/status-dog-smile/status-dog-smile-0-normal.png";
import dog1 from "./assets/status-dog-smile/status-dog-smile-1-one-flame.png";
import dog2 from "./assets/status-dog-smile/status-dog-smile-2-more-flames.png";
import dog3 from "./assets/status-dog-smile/status-dog-smile-3-room-on-fire.png";

const DOG_BROWSER_URLS = [dog0, dog1, dog2, dog3];

function dogIndex(fires: number): number {
  // Same convention as ThisIsFine.tsx: clamp to the last image so 3+
  // fires all use the "room on fire" dog.
  return Math.min(Math.max(fires, 0), DOG_BROWSER_URLS.length - 1);
}

function formatEvent(e: ChangeEvent): { title: string; body: string } {
  switch (e.kind) {
    case "incident-new":
      return {
        title: `${e.service.config.name} on fire`,
        body: e.service.description,
      };
    case "incident-worsened":
      return {
        title: `${e.service.config.name} got worse`,
        body: `${e.from} → ${e.to}: ${e.service.description}`,
      };
    case "recovered":
      return {
        title: `${e.service.config.name} is back`,
        body: "All systems operational.",
      };
  }
}

// Console output for the dev loop — fires regardless of notification
// permission, so you can verify the detection is wiring up before granting
// macOS notification access.
function logEvents(events: ChangeEvent[]): void {
  const newOrWorse = events.filter(
    (e) => e.kind === "incident-new" || e.kind === "incident-worsened",
  );
  if (newOrWorse.length > 1) {
    const names = newOrWorse.map((e) => e.service.config.name).join(", ");
    console.log(`[downtime] Multiple services failing: ${names}`);
  }
  for (const e of events) {
    const { title, body } = formatEvent(e);
    console.log(`[downtime] ${e.kind}: ${title} — ${body}`);
  }
}

/**
 * Notify the user about each change event.
 *
 * macOS stacks notifications from the same app automatically, so we send
 * one notification per event and let the OS handle grouping. Clicking any
 * of them activates the Tauri app (default macOS behavior) which brings
 * the window to the front — no extra wiring needed.
 *
 * `fireCount` is unused on the desktop (where the visual is the bundle
 * icon, picked once at build time) but kept in the signature so the
 * browser fallback can pick a per-notification icon matching the page.
 */
export async function notifyChangeEvents(
  events: ChangeEvent[],
  fireCount: number,
): Promise<void> {
  if (events.length === 0) return;
  logEvents(events);

  if (isTauri()) {
    const {
      isPermissionGranted,
      requestPermission,
      sendNotification,
    } = await import("@tauri-apps/plugin-notification");

    let granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      granted = result === "granted";
    }
    if (!granted) return;

    for (const e of events) {
      const { title, body } = formatEvent(e);
      sendNotification({ title, body });
    }
    return;
  }

  // Browser fallback. The Web Notifications API icon field accepts a URL,
  // and unlike macOS UNNotificationAttachment it actually renders the
  // image reliably across browsers. So the browser build still gets a
  // per-notification dog matching the current fire count.
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return;

  const icon = DOG_BROWSER_URLS[dogIndex(fireCount)];
  for (const e of events) {
    const { title, body } = formatEvent(e);
    new Notification(title, { body, icon });
  }
}
