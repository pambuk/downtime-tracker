// Statuspage v2 summary indicator values.
export type Indicator = "none" | "minor" | "major" | "critical" | "maintenance";

export type Severity = Indicator | "unknown";

export interface ServiceConfig {
  id: string;
  name: string;
  // Statuspage base URL (no trailing slash). Endpoint is `${url}/api/v2/summary.json`.
  url: string;
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
}
