import type { ServiceConfig, ServiceStatus, StatuspageSummary } from "./types";

export const SERVICES: ServiceConfig[] = [
  { id: "github", name: "GitHub", url: "https://www.githubstatus.com" },
  { id: "claude", name: "Claude", url: "https://status.claude.com" },
  { id: "openai", name: "OpenAI", url: "https://status.openai.com" },
  { id: "docplanner", name: "DocPlanner", url: "https://status.docplanner.com" },
];

export async function fetchStatus(config: ServiceConfig): Promise<ServiceStatus> {
  const fetchedAt = Date.now();
  try {
    const res = await fetch(`${config.url}/api/v2/summary.json`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as StatuspageSummary;
    return {
      config,
      severity: json.status.indicator,
      description: json.status.description,
      fetchedAt,
    };
  } catch (err) {
    return {
      config,
      severity: "unknown",
      description: "Status unavailable",
      fetchedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function fetchAllStatuses(): Promise<ServiceStatus[]> {
  return Promise.all(SERVICES.map(fetchStatus));
}
