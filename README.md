# Process Manager MCP Server

An unofficial Model Context Protocol (MCP) server for Nintex Process Manager. This server enables AI applications and chatbots to interact with your Process Manager data through a standardized interface.

## Features

### Phase 1 (Current)

- **Search Processes**: Search across process titles, activities, tasks, objectives, and more
- **Search Documents**: Find documents within your Process Manager instance
- **Search All Content**: Comprehensive search across all entity types (processes, documents, policies, groups)
- **Get Process Details**: Retrieve complete process information including activities, tasks, and metadata
- **User Lookup**: Find user information via SCIM API

### Phase 2 (Planned)

- Create new processes
- Update process content
- Submit processes for approval
- Review processes
- Publish processes

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- A Process Manager account with:
  - Username and password
  - Site name
  - Regional endpoint
  - (Optional) SCIM API key for user lookups

### Install from npm (when published)

```bash
npm install -g process-manager-mcp
```

### Install from source

```bash
git clone https://github.com/WorkingJB/Process-Manager-MCP.git
cd Process-Manager-MCP
npm install
npm run build
```

## Configuration

The MCP server is configured via environment variables:

### Required Environment Variables

- `PM_REGION`: Your Process Manager region (`demo`, `us`, `ca`, `eu`, `au`, or `ae`)
- `PM_SITE_NAME`: Your site name (the part after the region URL, e.g., `promapp`)
- `PM_USERNAME`: Your Process Manager username (email)
- `PM_PASSWORD`: Your Process Manager password

### Optional Environment Variables

- `PM_SCIM_API_KEY`: SCIM API key for user lookups (required for `lookup_user` tool)

### Example Configuration

**For Claude Desktop (MacOS):**

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "process-manager": {
      "command": "node",
      "args": ["/path/to/Process-Manager-MCP/dist/index.js"],
      "env": {
        "PM_REGION": "au",
        "PM_SITE_NAME": "promapp",
        "PM_USERNAME": "your.email@example.com",
        "PM_PASSWORD": "your-password",
        "PM_SCIM_API_KEY": "your-scim-api-key"
      }
    }
  }
}
```

**For Claude Desktop (Windows):**

Edit `%APPDATA%\Claude\claude_desktop_config.json` with the same format as above.

**For other MCP clients:**

Refer to your client's documentation for configuring MCP servers with environment variables.

## Available Tools

### 1. `search_processes`

Search for processes in Process Manager.

**Parameters:**
- `query` (required): The search query
- `searchFields` (optional): Array of fields to search in (`all`, `title`, `activity`, `task`, `notes`, `objectives`, `background`, `keywords`)
- `matchType` (optional): Match type (`any`, `all`, `exact`)
- `pageNumber` (optional): Page number for pagination (default: 1)

**Example:**
```
Search for processes related to "onboarding"
```

### 2. `search_documents`

Search for documents in Process Manager.

**Parameters:**
- `query` (required): The search query
- `matchType` (optional): Match type (`any`, `all`, `exact`)
- `pageNumber` (optional): Page number for pagination (default: 1)

**Example:**
```
Search for documents about "policy"
```

### 3. `search_all`

Search across all content types (processes, documents, policies, groups).

**Parameters:**
- `query` (required): The search query
- `matchType` (optional): Match type (`any`, `all`, `exact`)
- `pageNumber` (optional): Page number for pagination (default: 1)

**Example:**
```
Search for anything related to "compliance"
```

### 4. `get_process`

Get detailed information about a specific process.

**Parameters:**
- `processId` (required): The unique ID of the process (UUID format)

**Example:**
```
Get details for process "00b2107e-e3f5-4921-990a-508b1347cba6"
```

### 5. `lookup_user`

Look up a user by their email address.

**Parameters:**
- `email` (required): The email address of the user

**Example:**
```
Look up user "john.doe@example.com"
```

**Note:** Requires `PM_SCIM_API_KEY` to be configured.

## Usage Examples

Once configured in your MCP client (e.g., Claude Desktop), you can ask questions like:

- "What can you tell me about our onboarding process?"
- "Search for processes related to customer support"
- "Find documents about security policies"
- "Show me the details of process 00b2107e-e3f5-4921-990a-508b1347cba6"
- "Look up the user jane.smith@example.com"
- "What processes have been recently updated that I'm involved in?" (uses search with filters)

## Regional Endpoints

The server supports all Process Manager regional endpoints:

| Region | Site URL Base                | Search API Base               |
|--------|------------------------------|-------------------------------|
| demo   | https://demo.promapp.com     | https://prd-aus-sch.promapp.io|
| us     | https://us.promapp.com       | https://prd-wus-sch.promapp.io|
| ca     | https://ca.promapp.com       | https://prd-cac-sch.promapp.io|
| eu     | https://eu.promapp.com       | https://prd-neu-sch.promapp.io|
| au     | https://au.promapp.com       | https://prd-aus-sch.promapp.io|
| ae     | https://ae.promapp.com       | https://prd-ane-sch.promapp.io|

## Authentication

The server implements a multi-tier authentication system:

1. **Site Authentication**: OAuth2 password grant to obtain a JWT bearer token for API access
2. **Search Authentication**: Uses the site token to obtain a dedicated search API token
3. **SCIM Authentication**: Separate API key for user lookup operations

All tokens are automatically cached and refreshed as needed.

## Security Considerations

### Credentials

- **Never commit credentials** to version control
- Store credentials securely (use environment variables or secure credential managers)
- Rotate passwords and API keys regularly

### User Permissions

- The server respects user permissions from the authenticated account
- Search results and process access are filtered based on the authenticated user's permissions
- Consider creating a dedicated service account with appropriate read-only permissions

### SCIM API Key

- The SCIM API key provides access to **all user data** in your tenant
- Only configure the SCIM API key if absolutely necessary
- Consider alternative approaches for user-specific queries if possible

## Development

### Building

```bash
npm run build
```

### Development Mode (watch for changes)

```bash
npm run dev
```

### Project Structure

```
Process-Manager-MCP/
├── src/
│   ├── index.ts      # Main MCP server and tool handlers
│   ├── auth.ts       # Authentication manager
│   └── config.ts     # Configuration and type definitions
├── dist/             # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## API Documentation Examples

Example API requests and responses are included in the repository:

- `ExampleSiteAuthRequest` - Site authentication
- `ExampleSearchAuthRequest` - Search authentication
- `ExampleSearchRequest` - Process/document search
- `ExampleGetProcessRequest` - Get process details
- `ExampleGetUserRequest` - SCIM user lookup

## Troubleshooting

### "Site authentication failed"

- Verify your `PM_USERNAME` and `PM_PASSWORD` are correct
- Ensure your `PM_REGION` and `PM_SITE_NAME` match your Process Manager URL
- Check if your account has API access enabled

### "Search authentication failed"

- This typically indicates an issue with the site authentication token
- Try restarting the MCP server to refresh the token

### "SCIM API key not configured"

- The `lookup_user` tool requires a SCIM API key
- Generate a SCIM API key from your Process Manager site settings
- Set the `PM_SCIM_API_KEY` environment variable

### "No results found"

- Verify you have permission to view the content you're searching for
- Try broadening your search query
- Check the `matchType` parameter (use `any` for broader matches)

## Contributing

Contributions are welcome! This is an unofficial community project.

### To Do

- [ ] Add resources for exposing process lists, favorites, etc.
- [ ] Add prompts for common Process Manager tasks
- [ ] Implement Phase 2 features (create, update, approve, publish processes)
- [ ] Add support for process variants
- [ ] Add support for risk & compliance data
- [ ] Improve error handling and validation
- [ ] Add unit tests
- [ ] Add integration tests

## License

MIT

## Disclaimer

This is an **unofficial** MCP server for Nintex Process Manager. It is not affiliated with, officially maintained by, or endorsed by Nintex.

Use at your own risk. Always ensure you have proper authorization to access Process Manager data via API.

## Support

For issues, questions, or feature requests, please open an issue on GitHub:
https://github.com/WorkingJB/Process-Manager-MCP/issues
