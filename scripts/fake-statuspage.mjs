#!/usr/bin/env node
import http from "node:http";

const HOST = process.env.FAKE_STATUSPAGE_HOST ?? "127.0.0.1";
const PORT = Number(process.env.FAKE_STATUSPAGE_PORT ?? "8787");
const VALID_INDICATORS = new Set([
  "none",
  "minor",
  "major",
  "critical",
  "maintenance",
]);

let current = {
  indicator: "none",
  description: "All Systems Operational",
  changedAt: new Date().toISOString(),
};

function setStatus(indicator, description) {
  if (!VALID_INDICATORS.has(indicator)) {
    throw new Error(
      `Invalid indicator "${indicator}". Use one of: ${[
        ...VALID_INDICATORS,
      ].join(", ")}`,
    );
  }

  current = {
    indicator,
    description: description ?? descriptionFor(indicator),
    changedAt: new Date().toISOString(),
  };
}

function descriptionFor(indicator) {
  switch (indicator) {
    case "none":
      return "All Systems Operational";
    case "maintenance":
      return "Scheduled maintenance in progress";
    case "minor":
      return "Minor fake incident";
    case "major":
      return "Major fake incident";
    case "critical":
      return "Critical fake incident";
    default:
      return "Status unavailable";
  }
}

function statuspageSummary() {
  const activeIncident =
    current.indicator === "minor" ||
    current.indicator === "major" ||
    current.indicator === "critical";

  return {
    page: {
      id: "local-fake-statuspage",
      name: "Local Fake Statuspage",
      url: `http://${HOST}:${PORT}`,
      time_zone: "Europe/Warsaw",
      updated_at: current.changedAt,
    },
    status: {
      indicator: current.indicator,
      description: current.description,
    },
    components: [],
    incidents: activeIncident
      ? [
          {
            id: "local-fake-incident",
            name: current.description,
            status: "investigating",
            impact: current.indicator,
            created_at: current.changedAt,
            updated_at: current.changedAt,
            monitoring_at: null,
            resolved_at: null,
          },
        ]
      : [],
    scheduled_maintenances: [],
  };
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(body, null, 2));
}

function sendText(res, status, body) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);

    if (req.method === "OPTIONS") {
      sendText(res, 204, "");
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/v2/summary.json") {
      sendJson(res, 200, statuspageSummary());
      return;
    }

    if (req.method === "GET" && url.pathname === "/status") {
      sendJson(res, 200, current);
      return;
    }

    if (req.method === "GET" && url.pathname === "/set") {
      setStatus(
        url.searchParams.get("indicator") ?? "",
        url.searchParams.get("description") ?? undefined,
      );
      sendJson(res, 200, current);
      console.log(`[fake-statuspage] ${current.indicator}: ${current.description}`);
      return;
    }

    if (req.method === "POST" && url.pathname === "/status") {
      const body = await readJson(req);
      setStatus(body.indicator, body.description);
      sendJson(res, 200, current);
      console.log(`[fake-statuspage] ${current.indicator}: ${current.description}`);
      return;
    }

    sendText(
      res,
      404,
      [
        "Local fake Statuspage",
        "",
        "GET  /api/v2/summary.json",
        "GET  /status",
        "GET  /set?indicator=minor",
        "POST /status {\"indicator\":\"major\",\"description\":\"Major fake incident\"}",
        "",
      ].join("\n"),
    );
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[fake-statuspage] listening on http://${HOST}:${PORT}`);
  console.log("[fake-statuspage] change status with:");
  console.log(`  curl "http://${HOST}:${PORT}/set?indicator=minor"`);
  console.log(`  curl "http://${HOST}:${PORT}/set?indicator=major"`);
  console.log(`  curl "http://${HOST}:${PORT}/set?indicator=none"`);
});
