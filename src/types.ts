// Statuspage v2 summary indicator values.
export type Indicator = "none" | "minor" | "major" | "critical" | "maintenance";

export type Severity = Indicator | "unknown";

export interface ServiceConfig {
  id: string;
  name: string;
  // Public status page opened from the UI.
  url: string;
  source?: "statuspage" | "azure-rss";
  // For non-Statuspage services, the machine-readable status feed.
  feedUrl?: string;
}

export interface ServiceStatus {
  config: ServiceConfig;
  severity: Severity;
  description: string;
  fetchedAt: number;
  error?: string;
}

// Shape of the bits we care about from /api/v2/summary.json.
export interface StatuspageSummary {
  status: {
    indicator: Indicator;
    description: string;
  };
  incidents?: StatuspageIncident[];
}

// Statuspage incident impact values (superset of Indicator with "none").
export type IncidentImpact = "none" | "minor" | "major" | "critical" | "maintenance";

export interface StatuspageIncident {
  id: string;
  name: string;
  impact: IncidentImpact;
  resolved_at: string | null;
}
