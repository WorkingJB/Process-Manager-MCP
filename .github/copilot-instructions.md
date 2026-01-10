# Copilot / Agent Instructions — Process Manager MCP Server

Quick, focused guidance for AI coding agents working on this repo.

## Big picture (what this repo does)
- Implements an MCP (Model Context Protocol) server for Nintex Process Manager that exposes tools (search, get process, lookup user, group hierarchy, list processes, process diagrams) over MCP transports. See `src/index.ts` for the tool definitions and handler implementations.
- Current transport in code: **stdio** (see `new StdioServerTransport()` in `src/index.ts`). README documents both stdio and HTTP+SSE (for enterprise), but the codebase currently implements only stdio.

## Key files to read first
- `src/index.ts` — tool definitions (`TOOLS`), request dispatch, formatting helpers (search/process/group list outputs) and main server startup. Modify tool metadata and input schemas here.
- `src/auth.ts` — authentication, site/search token lifecycle, API/search/SCIM request helpers and regional endpoint mapping.
- `src/config.ts` — types, enums and the `REGIONAL_ENDPOINTS` mapping (useful for region-specific URLs and constants).
- `README.md` — user-facing docs (deployment, environment variables, integration notes). Contains actionable examples for Claude Desktop and enterprise platforms.
- `package.json` — build scripts and dependencies. Note: `start` script is referenced in README examples but is not defined in `package.json` (see "Issues / gotchas" below).
- `test/` — simple integration test clients (`simple-test.mjs`, `test-tools.js`). Use these to validate the server interacts over stdio and returns the expected tools list.

## Environment & runtime (how to run)
- Required Node.js: >= 18.0.0 (declared in `package.json`).
- Required environment variables (used by `src/index.ts` & `src/auth.ts`):
  - `PM_REGION` (demo|us|ca|eu|au|ae)
  - `PM_SITE_NAME`
  - `PM_USERNAME`
  - `PM_PASSWORD`
  - `PM_SCIM_API_KEY` (optional — required for `lookup_user` / SCIM requests)
- Build & run (discoverable patterns):
  - Build: `npm install` then `npm run build` (runs `tsc` and outputs JS in `dist/`).
  - Run: after building, execute the compiled entrypoint directly: `node dist/index.js` (or run the installed CLI `process-manager-mcp` if globally installed). The README suggests `npm run start` but no `start` script exists — use the above instead.
- Tests: build first, then run `node test/simple-test.mjs` to exercise a stdio client against `dist/index.js`. `test/test-tools.js` gives a quick check that the expected tool names are present.

## Project-specific conventions & patterns
- Tools are defined centrally in the `TOOLS` array inside `src/index.ts`. Each tool includes a JSON Schema `inputSchema` and a text `description`. Keep schema and help text in sync when changing inputs or behaviors.
- Auth caching: `AuthManager` caches site/search tokens with expiry heuristics (90% of expiry for site tokens; fixed 8min cache for search tokens). If you need fresh tokens for testing, call methods with `force=true` or restart the process.
- Logging: uses `console.error()` with bracketed tags (e.g., `[AUTH]`, `[SEARCH]`, `[DIAGRAM]`, etc.) for important runtime events — prefer this pattern for new subsystems to keep logs consistent.
- Output format: handlers return an MCP `content` array mixing `type: 'text'` markdown and `type: 'resource'` (JSON or HTML). See `formatSearchResults`, `formatProcessDetails`, and `get_process_diagram` for examples. Maintain both human-readable markdown and JSON resource returns when adding new tools.
- Minimode diagram flow: `get_process_diagram` fetches process details, extracts `ProcessRevisionEditId`, then POSTs to `/Api/v1/Minimode/Process/Generate` to get a permalink. It constructs an iframe HTML resource returned as `ui://` resource. This is a good reference when adding other HTML-rich resources.

## Integration points & external dependencies
- External SDK: `@modelcontextprotocol/sdk` (Server, StdioServerTransport, types) — used to implement MCP server and types.
- Process Manager endpoints: derived from `REGIONAL_ENDPOINTS` in `src/config.ts`. `auth.ts` uses region-specific site and search domains.
- SCIM API: hard-coded base `https://api.promapp.com/api/scim` in `config.ts` — `AuthManager.scimRequest` uses `PM_SCIM_API_KEY` as a bearer token.
- Node-fetch is used for HTTP requests (`node-fetch` package).

## Developer tasks checklist (quick tips)
- Adding/removing/modifying a tool: update the `TOOLS` array in `src/index.ts` and update tests in `test/` accordingly.
- Adding new API calls: put request logic in `src/auth.ts` (or create a new helper file) and reuse token management.
- When changing TypeScript types: update `src/config.ts` as it centralizes interfaces used by formatters and handlers.
- Release/CLI: package defines `bin.process-manager-mcp` pointing to `dist/index.js`, and `prepare` runs `npm run build` for publishing.

## Issues / gotchas discovered
- README suggests `npm run start` (and using dev tunnels to expose `port 3000`), but `package.json` has no `start` script and `src/index.ts` doesn't open a network port — the current server is stdio-only. If HTTP+SSE support is added, it must implement a transport and start an HTTP listener.
- README documents HTTP+SSE transport for enterprise integration; however, only stdio transport is implemented. Tests and current code expect stdio.

## Examples (copyable prompts & snippets for agents)
- Run locally (build + run):
  - `npm install && npm run build && node dist/index.js`
- Run the stdio smoke test after building: `node test/simple-test.mjs`
- Example tool call (via MCP JSON RPC client): `tools/call` with method `search_processes` and params `{ "query": "onboarding" }`.
- Example of adding a tool: duplicate an existing tool entry in `TOOLS`, update `name`, `description` and `inputSchema`, then add a `case` branch in the `server.setRequestHandler(CallToolRequestSchema, ...)` switch and a handler function `handleYourTool`.

---
Please review this draft — tell me if you want extra details (example requests/responses, more references to files, or notes about future HTTP+SSE implementation). If it's OK, I will commit it to `.github/copilot-instructions.md` (or merge with an existing file if you already have one you want preserved).