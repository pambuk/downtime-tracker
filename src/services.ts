import type {
    Indicator,
    ServiceConfig,
    ServiceStatus,
    StatuspageIncident,
    StatuspageSummary,
} from "./types";

// Ordered worst → best for non-maintenance impact comparison.
const SEVERITY_RANK: Record<Indicator, number> = {
    critical: 4,
    major: 3,
    minor: 2,
    maintenance: 1,
    none: 0,
};

const FAKE_STATUSPAGE_URL = import.meta.env.VITE_FAKE_STATUSPAGE_URL;

function serviceList(): ServiceConfig[] {
    const services: ServiceConfig[] = [
        { id: "github", name: "GitHub", url: "https://www.githubstatus.com" },
        { id: "claude", name: "Claude", url: "https://status.claude.com" },
        { id: "openai", name: "OpenAI", url: "https://status.openai.com" },
        { id: "docplanner", name: "DocPlanner", url: "https://status.docplanner.com" },
        { id: "jira", name: "Jira", url: "https://jira-software.status.atlassian.com" },
    ];

    if (FAKE_STATUSPAGE_URL) {
        services.push({
            id: "local-fake",
            name: "Local Fake",
            url: FAKE_STATUSPAGE_URL.replace(/\/$/, ""),
        });
    }

    return services;
}

function promoteForIncidents(
    indicator: Indicator,
    description: string,
    incidents: StatuspageIncident[] | undefined,
): { severity: Indicator; description: string } {
    const unresolved = (incidents ?? []).filter((i) => i.resolved_at === null);
    if (unresolved.length === 0) return { severity: indicator, description };

    // Floor at "minor" so any unresolved incident lights the dot, then take the
    // worst impact across both the top-level indicator and unresolved incidents.
    let worst: Indicator = indicator;
    let source: StatuspageIncident | null = null;
    for (const inc of unresolved) {
        const impact: Indicator = inc.impact === "none" ? "minor" : inc.impact;
        if (SEVERITY_RANK[impact] > SEVERITY_RANK[worst]) {
            worst = impact;
            source = inc;
        }
    }

    if (worst === indicator) return { severity: indicator, description };
    return {
        severity: worst,
        description: source ? source.name : description,
    };
}

export const SERVICES: ServiceConfig[] = serviceList();

export async function fetchStatus(config: ServiceConfig): Promise<ServiceStatus> {
    const fetchedAt = Date.now();

    try {
        const res = await fetch(`${config.url}/api/v2/summary.json`, {
            cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as StatuspageSummary;
        const { severity, description } = promoteForIncidents(
            json.status.indicator,
            json.status.description,
            json.incidents,
        );
        return {
            config,
            severity,
            description,
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
