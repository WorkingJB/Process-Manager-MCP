# Testing the Process Manager MCP Server

This guide covers different ways to test the MCP server.

## Quick Validation Test

First, verify the server builds and the structure is correct:

```bash
# Ensure dependencies are installed and built
npm install
npm run build

# Check that dist/ contains compiled files
ls -la dist/
```

## Method 1: Using MCP Inspector (Recommended for Development)

The MCP Inspector is the official tool for testing MCP servers:

```bash
# Install and run the inspector
npx @modelcontextprotocol/inspector dist/index.js
```

Then set environment variables when prompted, or set them before running:

```bash
export PM_REGION=au
export PM_SITE_NAME=your-site-name
export PM_USERNAME=your.email@example.com
export PM_PASSWORD=your-password
export PM_SCIM_API_KEY=your-scim-key  # Optional

npx @modelcontextprotocol/inspector dist/index.js
```

The Inspector will:
- Show all available tools
- Let you test each tool interactively
- Display request/response data
- Show any errors

## Method 2: Test with Claude Desktop

### macOS Configuration

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "process-manager": {
      "command": "node",
      "args": ["/full/path/to/Process-Manager-MCP/dist/index.js"],
      "env": {
        "PM_REGION": "au",
        "PM_SITE_NAME": "your-site-name",
        "PM_USERNAME": "your.email@example.com",
        "PM_PASSWORD": "your-password",
        "PM_SCIM_API_KEY": "your-scim-key"
      }
    }
  }
}
```

### Windows Configuration

Edit `%APPDATA%\Claude\claude_desktop_config.json` with the same format.

### Testing in Claude Desktop

1. Restart Claude Desktop after updating the config
2. Look for the 🔌 icon indicating MCP tools are available
3. Try queries like:
   - "Search for processes about onboarding"
   - "What processes are related to compliance?"
   - "Show me details of process [process-id]"

## Method 3: Manual Testing with stdio

You can manually test the server using stdio (useful for debugging):

```bash
# Set environment variables
export PM_REGION=au
export PM_SITE_NAME=promapp
export PM_USERNAME=your.email@example.com
export PM_PASSWORD=your-password

# Run the server
node dist/index.js
```

Then send JSON-RPC messages via stdin:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

Expected response will list all 5 tools.

To test a tool (e.g., search_processes):

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_processes","arguments":{"query":"onboarding"}}}
```

Press Ctrl+D or Ctrl+C to exit.

## Test Cases

### 1. List Tools

Should return 5 tools:
- `search_processes`
- `search_documents`
- `search_all`
- `get_process`
- `lookup_user`

### 2. Search Processes

```json
{
  "name": "search_processes",
  "arguments": {
    "query": "onboarding",
    "searchFields": ["title", "objectives"],
    "matchType": "any",
    "pageNumber": 1
  }
}
```

Should return formatted search results.

### 3. Search Documents

```json
{
  "name": "search_documents",
  "arguments": {
    "query": "policy",
    "matchType": "any"
  }
}
```

### 4. Get Process Details

```json
{
  "name": "get_process",
  "arguments": {
    "processId": "00b2107e-e3f5-4921-990a-508b1347cba6"
  }
}
```

Should return detailed process information.

### 5. User Lookup (requires SCIM API key)

```json
{
  "name": "lookup_user",
  "arguments": {
    "email": "user@example.com"
  }
}
```

## Troubleshooting

### Server won't start

- Check that all required environment variables are set
- Verify credentials are correct
- Check that `dist/` directory exists and contains compiled .js files

### Authentication errors

- Verify `PM_USERNAME` and `PM_PASSWORD` are correct
- Check that `PM_REGION` and `PM_SITE_NAME` match your Process Manager URL
- Ensure your account has API access enabled

### "SCIM API key not configured"

- The `lookup_user` tool requires `PM_SCIM_API_KEY`
- Generate a SCIM API key from Process Manager settings
- Add it to your environment variables

### Search returns no results

- Verify you have permission to view the content
- Try broader search terms
- Use `matchType: "any"` instead of "all"

## What to Expect

When the server is working correctly:

1. **Startup**: You should see `Process Manager MCP Server running on stdio` in stderr
2. **Tool calls**: Each tool should return formatted text responses
3. **Errors**: Any API errors will be returned with clear error messages
4. **Authentication**: Tokens are automatically cached and refreshed

## Debugging

Enable verbose logging by checking stderr output:

```bash
node dist/index.js 2>debug.log
```

The debug log will show:
- Server initialization messages
- Any authentication errors
- API request failures
