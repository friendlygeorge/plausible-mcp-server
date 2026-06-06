# Plausible Analytics MCP Server

MCP server for [Plausible Analytics](https://plausible.io/) — privacy-friendly web analytics. Query traffic, conversions, sources, and device breakdowns from any MCP-compatible AI assistant.

## Features

- **Flexible stats queries** — metrics, dimensions, filters, date ranges
- **Real-time visitors** — live visitor count
- **Traffic breakdowns** — sources, countries, browsers, UTM campaigns
- **Time-series data** — daily, weekly, monthly, hourly intervals
- **Custom events** — event tracking and conversion rates
- **Entry/exit pages** — where visitors land and leave
- **Device analytics** — browser, OS, screen size breakdowns
- **Goal tracking** — conversion stats for all configured goals
- **Site management** — list and inspect sites

## 12 Tools

| Tool | Description |
|------|-------------|
| `query_stats` | Full flexible stats query (the main endpoint) |
| `realtime_visitors` | Current real-time visitor count |
| `get_breakdown` | Breakdown by any dimension (source, page, country, etc.) |
| `get_timeseries` | Metrics over time with configurable intervals |
| `list_sites` | List all sites in your account |
| `get_site` | Get site details |
| `get_custom_events` | Custom event breakdown |
| `get_entry_pages` | Top landing pages |
| `get_exit_pages` | Top exit pages |
| `get_utm_stats` | UTM campaign/source/medium breakdowns |
| `get_device_stats` | Browser, OS, screen size breakdowns |
| `get_goals` | Conversion stats for all goals |

## Setup

### Prerequisites

1. A [Plausible Analytics](https://plausible.io/) account (cloud or self-hosted)
2. An API key — generate one at **Site Settings → API Keys** in your Plausible dashboard

### Configuration

Add to your MCP client config (e.g. Claude Desktop, Cursor):

```json
{
  "mcpServers": {
    "plausible": {
      "command": "node",
      "args": ["/path/to/plausible-mcp-server/dist/index.js"],
      "env": {
        "PLAUSIBLE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

For self-hosted Plausible, also set:

```json
"env": {
  "PLAUSIBLE_API_KEY": "your-api-key",
  "PLAUSIBLE_API_BASE": "https://your-plausible-instance.com"
}
```

### Build from source

```bash
git clone https://github.com/friendlygeorge/plausible-mcp-server.git
cd plausible-mcp-server
npm install
npx tsc
```

## Usage Examples

Once configured, ask your AI assistant:

- "Show me the top traffic sources for my site this month"
- "How many visitors did I get today?"
- "What's the time-series of pageviews for the last 30 days?"
- "Which pages have the highest bounce rate?"
- "Show me UTM campaign performance"
- "What are my top entry pages?"
- "Show conversion rates for all goals"
- "Break down visitors by country for the last week"

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PLAUSIBLE_API_KEY` | Yes | — | Your Plausible API key |
| `PLAUSIBLE_API_BASE` | No | `https://plausible.io` | API base URL (change for self-hosted) |

## Supported Metrics

`visitors`, `visits`, `pageviews`, `views_per_visit`, `visit_duration`, `events`, `bounce_rate`, `scroll_depth`, `conversion_rate`

## Supported Dimensions

`visit:source`, `visit:referrer`, `visit:utm_source`, `visit:utm_medium`, `visit:utm_campaign`, `visit:utm_content`, `visit:utm_term`, `visit:country_name`, `visit:city_name`, `visit:screen`, `visit:browser`, `visit:browser_version`, `visit:os`, `visit:os_version`, `visit:entry_page`, `visit:exit_page`, `event:page`, `event:name`, `event:goal`, `event:props:<key>`

## License

MIT
