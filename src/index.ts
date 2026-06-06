#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// --- Configuration ---
const PLAUSIBLE_API_BASE = process.env.PLAUSIBLE_API_BASE || "https://plausible.io";
const PLAUSIBLE_API_KEY = process.env.PLAUSIBLE_API_KEY || "";

if (!PLAUSIBLE_API_KEY) {
  console.error("Error: PLAUSIBLE_API_KEY environment variable is required");
  process.exit(1);
}

// --- API Helper ---
async function plausibleFetch(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${PLAUSIBLE_API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${PLAUSIBLE_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Plausible API error ${response.status}: ${errorBody}`
    );
  }

  return response.json();
}

// --- MCP Server Setup ---
const server = new McpServer({
  name: "plausible-analytics",
  version: "1.0.0",
});

// ========================================
// Tool 1: Query Stats (flexible POST endpoint)
// ========================================
server.tool(
  "query_stats",
  "Query Plausible analytics with full flexibility — metrics, dimensions, filters, date ranges. The main stats endpoint.",
  {
    site_id: z.string().describe("The site ID (domain) to query, e.g. 'example.com'"),
    metrics: z.array(z.string()).describe("Metrics to calculate: visitors, visits, pageviews, views_per_visit, visit_duration, events, bounce_rate, scroll_depth, conversion_rate"),
    date_range: z.string().describe("Date range: 'today', 'yesterday', '7d', '30d', 'month', 'year', 'all', or 'YYYY-MM-DD,YYYY-MM-DD'"),
    dimensions: z.array(z.string()).optional().describe("Group by dimensions: visit:source, visit:referrer, visit:utm_source, visit:utm_medium, visit:utm_campaign, visit:utm_content, visit:utm_term, visit:country_name, visit:city_name, visit:screen, visit:browser, visit:browser_version, visit:os, visit:os_version, visit:entry_page, visit:exit_page, event:page, event:name, event:goal, event:props:<key>"),
    filters: z.array(z.string()).optional().describe("Filters like 'visit:source==Google', 'event:page==/blog', 'visit:country_name==United States'"),
    order_by: z.array(z.string()).optional().describe("Order results, e.g. [['visitors', 'desc']]"),
    include: z.array(z.string()).optional().describe("Include extra fields: 'events', 'page', 'custom_props'"),
    limit: z.number().optional().describe("Max results to return (default: 100, max: 10000)"),
  },
  async (params) => {
    const body: any = {
      site_id: params.site_id,
      metrics: params.metrics,
      date_range: params.date_range,
    };
    if (params.dimensions?.length) body.dimensions = params.dimensions;
    if (params.filters?.length) body.filters = params.filters;
    if (params.order_by) body.order_by = params.order_by;
    if (params.include?.length) body.include = params.include;
    if (params.limit) body.pagination = { limit: params.limit };

    const result = await plausibleFetch("/api/v1/stats/query", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ========================================
// Tool 2: Realtime Visitors
// ========================================
server.tool(
  "realtime_visitors",
  "Get the current number of real-time visitors on a site.",
  {
    site_id: z.string().describe("The site ID (domain) to query"),
  },
  async (params) => {
    const result = await plausibleFetch(
      `/api/v1/stats/realtime/visitors?site_id=${encodeURIComponent(params.site_id)}`
    );

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ========================================
// Tool 3: Breakdown — top sources, pages, countries, etc.
// ========================================
server.tool(
  "get_breakdown",
  "Get a breakdown of visitors by a specific dimension (top sources, pages, countries, browsers, etc.).",
  {
    site_id: z.string().describe("The site ID (domain)"),
    property: z.string().describe("Dimension to break down: 'visit:source', 'visit:referrer', 'visit:utm_source', 'visit:country_name', 'visit:city_name', 'visit:browser', 'visit:os', 'visit:screen', 'event:page', 'event:goal'"),
    date_range: z.string().describe("Date range: 'today', '7d', '30d', 'month', 'year', or 'YYYY-MM-DD,YYYY-MM-DD'"),
    filters: z.array(z.string()).optional().describe("Additional filters"),
    limit: z.number().optional().describe("Max results (default 100)"),
  },
  async (params) => {
    const metrics = params.property === "event:goal"
      ? ["visitors", "events"]
      : ["visitors", "pageviews", "visit_duration", "bounce_rate"];

    const body: any = {
      site_id: params.site_id,
      metrics,
      date_range: params.date_range,
      dimensions: [params.property],
    };
    if (params.filters?.length) body.filters = params.filters;
    if (params.limit) body.pagination = { limit: params.limit };

    const result = await plausibleFetch("/api/v1/stats/query", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ========================================
// Tool 4: Timeseries — metrics over time
// ========================================
server.tool(
  "get_timeseries",
  "Get time-series data for one or more metrics — daily, hourly, weekly, or monthly intervals.",
  {
    site_id: z.string().describe("The site ID (domain)"),
    metrics: z.array(z.string()).describe("Metrics: visitors, visits, pageviews, events, bounce_rate, visit_duration"),
    date_range: z.string().describe("Date range: '7d', '30d', 'month', 'year', or 'YYYY-MM-DD,YYYY-MM-DD'"),
    interval: z.string().optional().describe("Interval: 'date' (default), 'month', 'week', 'hour' (last 24h only)"),
    filters: z.array(z.string()).optional().describe("Filters to apply"),
  },
  async (params) => {
    const body: any = {
      site_id: params.site_id,
      metrics: params.metrics,
      date_range: params.date_range,
      dimensions: ["time"],
    };
    if (params.interval) body.interval = params.interval;
    if (params.filters?.length) body.filters = params.filters;

    const result = await plausibleFetch("/api/v1/stats/query", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ========================================
// Tool 5: List Sites
// ========================================
server.tool(
  "list_sites",
  "List all sites in your Plausible account.",
  {},
  async () => {
    const result = await plausibleFetch("/api/v1/sites");

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ========================================
// Tool 6: Get Site Details
// ========================================
server.tool(
  "get_site",
  "Get detailed information about a specific site.",
  {
    site_id: z.string().describe("The site ID (domain) to look up"),
  },
  async (params) => {
    const result = await plausibleFetch(
      `/api/v1/sites/${encodeURIComponent(params.site_id)}`
    );

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ========================================
// Tool 7: Custom Events
// ========================================
server.tool(
  "get_custom_events",
  "Get custom event breakdown — see which events fire most, conversion rates, and revenue.",
  {
    site_id: z.string().describe("The site ID (domain)"),
    date_range: z.string().describe("Date range: '7d', '30d', 'month', 'year'"),
    filters: z.array(z.string()).optional().describe("Filters like 'event:name==signup'"),
  },
  async (params) => {
    const body: any = {
      site_id: params.site_id,
      metrics: ["visitors", "events"],
      date_range: params.date_range,
      dimensions: ["event:name"],
    };
    if (params.filters?.length) body.filters = params.filters;

    const result = await plausibleFetch("/api/v1/stats/query", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ========================================
// Tool 8: Entry Pages
// ========================================
server.tool(
  "get_entry_pages",
  "Get top entry pages — where visitors land on your site.",
  {
    site_id: z.string().describe("The site ID (domain)"),
    date_range: z.string().describe("Date range: '7d', '30d', 'month', 'year'"),
    limit: z.number().optional().describe("Max results (default 100)"),
  },
  async (params) => {
    const body: any = {
      site_id: params.site_id,
      metrics: ["visitors", "visits", "visit_duration", "bounce_rate"],
      date_range: params.date_range,
      dimensions: ["visit:entry_page"],
    };
    if (params.limit) body.pagination = { limit: params.limit };

    const result = await plausibleFetch("/api/v1/stats/query", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ========================================
// Tool 9: Exit Pages
// ========================================
server.tool(
  "get_exit_pages",
  "Get top exit pages — where visitors leave your site.",
  {
    site_id: z.string().describe("The site ID (domain)"),
    date_range: z.string().describe("Date range: '7d', '30d', 'month', 'year'"),
    limit: z.number().optional().describe("Max results (default 100)"),
  },
  async (params) => {
    const body: any = {
      site_id: params.site_id,
      metrics: ["visitors", "visits"],
      date_range: params.date_range,
      dimensions: ["visit:exit_page"],
    };
    if (params.limit) body.pagination = { limit: params.limit };

    const result = await plausibleFetch("/api/v1/stats/query", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ========================================
// Tool 10: UTM Campaigns
// ========================================
server.tool(
  "get_utm_stats",
  "Get UTM campaign, source, and medium breakdowns — see which campaigns drive traffic.",
  {
    site_id: z.string().describe("The site ID (domain)"),
    date_range: z.string().describe("Date range: '7d', '30d', 'month', 'year'"),
    dimension: z.enum(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]).optional().describe("Which UTM dimension (default: utm_campaign)"),
  },
  async (params) => {
    const dim = `visit:${params.dimension || "utm_campaign"}`;
    const body: any = {
      site_id: params.site_id,
      metrics: ["visitors", "visits", "pageviews"],
      date_range: params.date_range,
      dimensions: [dim],
    };

    const result = await plausibleFetch("/api/v1/stats/query", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ========================================
// Tool 11: Device/Browser Breakdown
// ========================================
server.tool(
  "get_device_stats",
  "Get breakdown by device type, browser, OS, and screen size.",
  {
    site_id: z.string().describe("The site ID (domain)"),
    date_range: z.string().describe("Date range: '7d', '30d', 'month', 'year'"),
    dimension: z.enum(["browser", "browser_version", "os", "os_version", "screen"]).optional().describe("Device dimension (default: browser)"),
  },
  async (params) => {
    const dim = `visit:${params.dimension || "browser"}`;
    const body: any = {
      site_id: params.site_id,
      metrics: ["visitors", "visits", "pageviews", "bounce_rate", "visit_duration"],
      date_range: params.date_range,
      dimensions: [dim],
    };

    const result = await plausibleFetch("/api/v1/stats/query", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ========================================
// Tool 12: Goals & Conversions
// ========================================
server.tool(
  "get_goals",
  "Get conversion stats for all configured goals on a site.",
  {
    site_id: z.string().describe("The site ID (domain)"),
    date_range: z.string().describe("Date range: '7d', '30d', 'month', 'year'"),
  },
  async (params) => {
    const body: any = {
      site_id: params.site_id,
      metrics: ["visitors", "events", "conversion_rate"],
      date_range: params.date_range,
      dimensions: ["event:goal"],
    };

    const result = await plausibleFetch("/api/v1/stats/query", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// --- Start Server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Plausible Analytics MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
