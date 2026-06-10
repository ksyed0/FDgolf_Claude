# MCP Browser Scripts — FDgolf

Markdown step-by-step guides for ad-hoc browser automation using the Playwright MCP tools
(`mcp__plugin_playwright_playwright__*`) in a Claude Code session.

## Prerequisites

1. Local dev stack running:
   ```bash
   cd fdgolf-app && npm run supabase:start
   cd fdgolf-app && npm run dev
   ```
2. You have an admin account seeded in the local Supabase instance.
3. The Playwright MCP plugin is enabled in your Claude Code session.

## How to run

Read the relevant `.md` file in this directory and execute the browser tool calls
described in each step. Each step maps 1-to-1 with a Playwright MCP tool.

## Scripts

| File | Covers | When to use |
|------|--------|-------------|
| `auth-flow.md` | Login, session check, logout | Quick auth regression after auth changes |
| `admin-setup-flow.md` | Create tournament + configure 18 holes | Pre-demo smoke test; post-deploy verification |
