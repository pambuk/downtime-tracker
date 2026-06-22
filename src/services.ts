import type {
    Indicator,
    ServiceConfig,
    ServiceStatus,
    StatuspageIncident,
    StatuspageSummary,
} from "./types";
import { isTauri } from "./runtime";

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
        {
            id: "slack",
            name: "Slack",
            url: "https://status.slack.com",
            source: "slack-html",
            // Slack retired its JSON status API; the live per-feature grid is
            // only available as HTML on the (post-redirect) status site. The
            // RSS feed is postmortems published after resolution, so it can't
            // report current status.
            feedUrl: "https://slack-status.com/",
        },
        {
            id: "azure",
            name: "Azure",
            url: "https://azure.status.microsoft/en-gb/status",
            source: "azure-rss",
            feedUrl: "https://rssfeed.azure.status.microsoft/en-gb/status/feed/",
        },
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

    if (config.source === "azure-rss") {
        return fetchAzureRssStatus(config, fetchedAt);
    }

    if (config.source === "slack-html") {
        return fetchSlackHtmlStatus(config, fetchedAt);
    }

    return fetchStatuspageStatus(config, fetchedAt);
}

async function fetchStatuspageStatus(
    config: ServiceConfig,
    fetchedAt: number,
): Promise<ServiceStatus> {
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

async function fetchAzureRssStatus(
    config: ServiceConfig,
    fetchedAt: number,
): Promise<ServiceStatus> {
    try {
        if (!config.feedUrl) throw new Error("Missing Azure status feed URL");
        const xml = await fetchText(config.feedUrl);
        const summary = parseAzureRss(xml);

        return {
            config,
            severity: summary.severity,
            description: summary.description,
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

async function fetchSlackHtmlStatus(
    config: ServiceConfig,
    fetchedAt: number,
): Promise<ServiceStatus> {
    try {
        if (!config.feedUrl) throw new Error("Missing Slack status page URL");
        const html = await fetchText(config.feedUrl);
        const summary = parseSlackHtml(html);

        return {
            config,
            severity: summary.severity,
            description: summary.description,
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

// Slack's status page renders each feature row with one of these table icons;
// the image basename is the most stable signal for that feature's state.
const SLACK_ICON_SEVERITY: Record<string, Indicator> = {
    TableCheck: "none",
    TableMaintenance: "maintenance",
    TableNotice: "minor",
    TableIncident: "major",
    TableOutage: "critical",
};

function parseSlackHtml(html: string): { severity: Indicator; description: string } {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // The `#services` grid is the live per-feature status; the visually similar
    // `#services_legend` block above it uses different markup (no `.service`),
    // so it can't leak the legend's icons into our worst-case scan.
    const rows = Array.from(doc.querySelectorAll("#services .service"));
    if (rows.length === 0) {
        throw new Error("Could not find Slack status grid");
    }

    let worst: Indicator = "none";
    const affected: string[] = [];
    for (const row of rows) {
        const src = row.querySelector("img")?.getAttribute("src") ?? "";
        const key = Object.keys(SLACK_ICON_SEVERITY).find((k) => src.includes(k));
        const sev = key ? SLACK_ICON_SEVERITY[key] : "none";
        if (SEVERITY_RANK[sev] > SEVERITY_RANK[worst]) worst = sev;
        if (sev !== "none") {
            const name = row.querySelector(".bold")?.textContent?.trim();
            if (name) affected.push(name);
        }
    }

    if (worst === "none") {
        return { severity: "none", description: "All features operational" };
    }
    return {
        severity: worst,
        description:
            affected.length === 1
                ? affected[0]
                : `${affected.length} features affected: ${affected.join(", ")}`,
    };
}

async function fetchText(url: string): Promise<string> {
    if (isTauri()) {
        const { invoke } = await import("@tauri-apps/api/core");
        return invoke<string>("fetch_text", { url });
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

function parseAzureRss(xml: string): { severity: Indicator; description: string } {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) {
        throw new Error("Invalid Azure status RSS");
    }

    const titles = Array.from(doc.querySelectorAll("channel > item > title"))
        .map((title) => title.textContent?.trim() ?? "")
        .filter(Boolean);

    if (titles.length === 0) {
        return { severity: "none", description: "No active events" };
    }

    const first = titles[0];
    return {
        severity: azureRssSeverity(titles),
        description:
            titles.length === 1
                ? first
                : `${titles.length} active events, including: ${first}`,
    };
}

function azureRssSeverity(titles: string[]): Indicator {
    const text = titles.join(" ").toLowerCase();
    if (/\b(critical|outage|unavailable|down)\b/.test(text)) return "critical";
    if (/\b(degradation|degraded|warning|impact|issues?)\b/.test(text)) {
        return "major";
    }
    return "minor";
}

export function fetchAllStatuses(): Promise<ServiceStatus[]> {
    return Promise.all(SERVICES.map(fetchStatus));
}
