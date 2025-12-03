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

## Self-Hosting for Enterprise AI Platforms

The Process Manager MCP server can be self-hosted and integrated with enterprise AI platforms like Microsoft Copilot Studio and Salesforce Agentforce. Self-hosting allows you to deploy the server on your own infrastructure while maintaining enterprise security and governance controls.

### Self-Hosting Requirements

To self-host this MCP server for enterprise integration, you'll need:

1. **Server Infrastructure**
   - Node.js 18.0.0 or higher runtime environment
   - Web server capable of handling HTTP/HTTPS requests
   - Public HTTPS endpoint (required for enterprise platforms)

2. **Transport Protocol**
   - The server must support **HTTP with Server-Sent Events (SSE)** transport
   - MCP defines two transport mechanisms:
     - **stdio**: Local communication over standard input/output (used by Claude Desktop)
     - **HTTP+SSE**: Network-based transport for remote deployments (required for Copilot Studio and Agentforce)

3. **Security Requirements**
   - HTTPS/TLS encryption for all network traffic
   - Origin header validation to prevent DNS rebinding attacks
   - Secure storage for Process Manager credentials (environment variables or secret management service)

### Integration with Microsoft Copilot Studio

Microsoft Copilot Studio supports MCP integration, allowing you to connect your self-hosted Process Manager MCP server to Copilot agents.

**Prerequisites:**
- Azure subscription (for deployment)
- Microsoft Copilot Studio account
- Visual Studio Code with Azure Developer CLI (optional, for automated deployment)

**Deployment Steps:**

1. **Prepare Your Server**
   ```bash
   # Build the MCP server
   npm install
   npm run build
   ```

2. **Deploy to a Hosting Platform**

   Choose one of these options:

   - **Azure Container Instances / Azure App Service**: Deploy the server as a containerized application
   - **Local Development with Dev Tunnels**: For testing, use VS Code's dev tunnels to expose localhost
     ```bash
     # Start the server locally
     npm run start
     # Forward port 3000 through VS Code dev tunnels
     # This creates a public URL like: https://something-3000.devtunnels.ms
     ```
   - **Other Cloud Providers**: AWS, Google Cloud, or any platform supporting Node.js applications

3. **Configure Environment Variables**

   Set the required Process Manager credentials as environment variables in your hosting platform:
   ```
   PM_REGION=your-region
   PM_SITE_NAME=your-site
   PM_USERNAME=your-username
   PM_PASSWORD=your-password
   PM_SCIM_API_KEY=your-scim-key (optional)
   ```

4. **Register with Copilot Studio**
   - Open Microsoft Copilot Studio
   - Navigate to your agent settings
   - Select "Add a Tool" → "Model Context Protocol"
   - Import the MCP connector (use "MCP-Streamable-HTTP" connector type)
   - Enter your server's HTTPS base URL as the host
   - Configure authentication if required (API key, OAuth, etc.)

5. **Test the Connection**
   - Copilot Studio will automatically detect available tools from your MCP server
   - Each tool (search_processes, get_process, etc.) will appear as an action
   - Tools automatically update when your server changes

**Important Notes:**
- Generative Orchestration must be enabled in Copilot Studio to use MCP
- Tools and resources are dynamically synchronized from the server
- Enterprise governance controls (DLP, virtual networks) are enforced through Copilot Studio

**Resources:**
- [Microsoft Copilot Studio MCP Documentation](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-extend-action-mcp)
- [MCP Lab for Copilot Studio](https://github.com/microsoft/mcsmcp)
- [MCP in Copilot Studio Announcement](https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/introducing-model-context-protocol-mcp-in-copilot-studio-simplified-integration-with-ai-apps-and-agents/)

### Integration with Salesforce Agentforce

Salesforce Agentforce includes native MCP client support (available in Pilot as of July 2025), enabling seamless connection to self-hosted MCP servers.

**Prerequisites:**
- Salesforce account with Agentforce access
- Heroku account (recommended) or alternative hosting platform
- MCP server built and ready for deployment

**Deployment Steps:**

1. **Build Your MCP Server**
   ```bash
   npm install
   npm run build
   ```

2. **Deploy to Hosting Platform**

   **Recommended: Heroku with AppLink**
   - Heroku provides managed infrastructure with built-in DevOps for MCP servers
   - Heroku AppLink connects to Agentforce with on-demand scaling capabilities
   - Deploy as a Node.js application with Procfile

   **Alternative Hosting:**
   - Any cloud platform supporting Node.js (AWS, Google Cloud, Azure)
   - Ensure HTTPS endpoint is publicly accessible
   - Configure environment variables for Process Manager credentials

3. **Configure Environment Variables**

   Set required credentials in your hosting platform:
   ```
   PM_REGION=your-region
   PM_SITE_NAME=your-site
   PM_USERNAME=your-username
   PM_PASSWORD=your-password
   PM_SCIM_API_KEY=your-scim-key (optional)
   ```

4. **Register with Agentforce**
   - Access the Agentforce admin console
   - Navigate to the MCP Server registry (enterprise-grade policy enforcement)
   - Register your server's HTTPS endpoint
   - Configure authentication and security policies
   - Authorized admins can enforce enterprise-grade policies through the central registry

5. **Connect to Your Agent**
   - Agentforce's native MCP client connects to your server without custom code
   - Available tools automatically appear in the Agentforce interface
   - Configure which tools your agents can access through enterprise governance controls

**Important Notes:**
- Agentforce provides enterprise-grade MCP Server registry with security policy enforcement
- Native MCP client support eliminates the need for custom integration code
- Through AgentExchange, you can access additional MCP servers from 30+ partners
- Universal connector enables Agentforce to access external data sources and tools

**Resources:**
- [Salesforce MCP Support Announcement](https://developer.salesforce.com/blogs/2025/06/introducing-mcp-support-across-salesforce)
- [Agentforce MCP Support](https://www.salesforce.com/agentforce/mcp-support/)
- [Agentforce 3 Launch Announcement](https://www.salesforce.com/in/news/press-releases/2025/06/23/agentforce-3-announcement/)

### General Self-Hosting Best Practices

When self-hosting the MCP server for any enterprise platform:

1. **Security**
   - Always use HTTPS/TLS for production deployments
   - Store credentials in secure secret management services (Azure Key Vault, AWS Secrets Manager, etc.)
   - Implement rate limiting and request validation
   - Use service accounts with minimal required permissions

2. **Monitoring and Logging**
   - Enable application logging for debugging and audit trails
   - Monitor server health and performance metrics
   - Set up alerts for authentication failures or service disruptions

3. **Scalability**
   - Consider load balancing for high-traffic scenarios
   - Use managed hosting platforms with auto-scaling capabilities
   - Cache authentication tokens to reduce API calls to Process Manager

4. **Maintenance**
   - Keep the MCP server updated with latest security patches
   - Test updates in a staging environment before production deployment
   - Document your deployment configuration for team members

**Additional Resources:**
- [Model Context Protocol Specification - Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP Server Examples Repository](https://github.com/modelcontextprotocol/servers)

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

### 6. `get_group_hierarchy`

Get the complete organizational structure of process groups. Recursively builds a tree showing all groups, subgroups, and the processes within them.

**Parameters:**
- `maxDepth` (optional): Maximum depth to traverse (default: unlimited). Use 1 for top-level only, 2 for top-level + direct children, etc.
- `includeProcesses` (optional): Whether to include process listings in the hierarchy (default: true)

**Example:**
```
Show me the organizational structure of all process groups
```

**Returns:** Both formatted text and structured JSON data for AI agent consumption.

### 7. `list_processes`

Get a paginated list of all processes in the Process Manager instance. Returns process metadata including name, state, owner, expert, and group association.

**Parameters:**
- `page` (optional): Page number to retrieve (default: 1)
- `pageSize` (optional): Number of processes per page (default: 20, max: 100)

**Example:**
```
List all processes
```

**Returns:** Both formatted text and structured JSON data for AI agent consumption.

## Usage Examples

Once configured in your MCP client (e.g., Claude Desktop), you can ask questions like:

- "What can you tell me about our onboarding process?"
- "Search for processes related to customer support"
- "Find documents about security policies"
- "Show me the details of process 00b2107e-e3f5-4921-990a-508b1347cba6"
- "Look up the user jane.smith@example.com"
- "What processes have been recently updated that I'm involved in?" (uses search with filters)
- "Show me the organizational structure of all process groups"
- "List all processes in the system"
- "What processes exist in the Finance department?"

## Regional Endpoints

The server supports all Process Manager regional endpoints:

| Region | Site URL Base                | Search API Base               |
|--------|------------------------------|-------------------------------|
| demo   | https://demo.promapp.com     | https://dmo-wus-sch.promapp.io|
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

### SSO Authentication Requirements

If your Process Manager site uses SSO (Single Sign-On) authentication, the username and password credentials **must** come from a non-SSO service account, as SSO users cannot authenticate via the OAuth2 password grant flow.

**To set up credentials for SSO-enabled sites:**

1. **Option 1: Create a Service Account**
   - Create a dedicated service account in Process Manager
   - Configure the account with appropriate read permissions
   - Use the service account's username and password in your MCP configuration

2. **Option 2: Configure a User with Basic Authentication**
   - Temporarily set your site's Security SSO setting to "Optional" (Admin > Settings > Security)
   - Reset the desired user's password through the app authentication system
   - Re-enable "Required" SSO mode
   - The username and password will continue to work with the MCP server even after SSO is re-enabled

**Important:** Service accounts or users with basic authentication credentials can authenticate to the API regardless of SSO settings, allowing the MCP server to function properly while maintaining your site's SSO security for regular users.

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
