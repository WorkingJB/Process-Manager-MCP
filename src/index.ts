#!/usr/bin/env node

/**
 * Nintex Process Manager MCP Server
 *
 * Provides MCP tools for interacting with Process Manager:
 * - Search processes and documents
 * - Get process details
 * - Look up user information
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { AuthManager } from './auth.js';
import {
  ProcessManagerConfig,
  Region,
  EntityType,
  ProcessSearchField,
  SearchMatchType,
  SearchResponse,
  ProcessResponse,
  ProcessSummaryResponse,
  ScimUserResponse,
  TreeItem,
  TreeItemsResponse,
  ProcessListItem,
  ProcessListResponse,
  MinimodeGenerateRequest,
  MinimodeGenerateResponse,
  REGIONAL_ENDPOINTS,
  AutomationType,
  AutomationConfidence,
  StepAutomationOpportunity,
  ProcessAutomationAnalysis,
  Activity,
  Task,
} from './config.js';

// Load configuration from environment variables
const config: ProcessManagerConfig = {
  region: (process.env.PM_REGION as Region) || 'au',
  siteName: process.env.PM_SITE_NAME || '',
  username: process.env.PM_USERNAME || '',
  password: process.env.PM_PASSWORD || '',
  scimApiKey: process.env.PM_SCIM_API_KEY,
};

// Validate required configuration
if (!config.siteName || !config.username || !config.password) {
  console.error(
    'Error: Missing required configuration. Please set PM_SITE_NAME, PM_USERNAME, and PM_PASSWORD environment variables.'
  );
  process.exit(1);
}

const authManager = new AuthManager(config);

/**
 * Context window management constants
 * Following Block's best practice: guard against context overflows
 */
const OUTPUT_LIMITS = {
  // Maximum characters for text output (roughly ~25k tokens)
  MAX_TEXT_CHARS: 100000,
  // Maximum items in list responses before truncation
  MAX_LIST_ITEMS: 50,
  // Maximum depth for hierarchy traversal
  MAX_HIERARCHY_DEPTH: 10,
  // Warning threshold (80% of max)
  WARNING_THRESHOLD: 0.8,
};

/**
 * Truncate text output to stay within context limits
 * Following Block's best practice for context window management
 */
function truncateOutput(text: string, maxChars: number = OUTPUT_LIMITS.MAX_TEXT_CHARS): string {
  if (text.length <= maxChars) {
    return text;
  }

  const truncationMessage = `\n\n---\n**Output truncated.** Showing first ${maxChars.toLocaleString()} characters of ${text.length.toLocaleString()} total. Use pagination or more specific queries to retrieve remaining data.\n`;

  return text.substring(0, maxChars - truncationMessage.length) + truncationMessage;
}

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if output is approaching context limits and add warning
 */
function addContextWarningIfNeeded(text: string): string {
  const estimatedTokens = estimateTokenCount(text);
  const warningThreshold = OUTPUT_LIMITS.MAX_TEXT_CHARS * OUTPUT_LIMITS.WARNING_THRESHOLD;

  if (text.length > warningThreshold) {
    const warning = `\n\n> **Note:** This response contains approximately ${estimatedTokens.toLocaleString()} tokens. Consider using more specific queries if you need to preserve context for follow-up questions.\n`;
    return text + warning;
  }

  return text;
}

/**
 * Prepare text output with context-aware truncation and warnings
 * Following Block's best practice for context window management
 */
function prepareTextOutput(text: string): string {
  const truncated = truncateOutput(text);
  return addContextWarningIfNeeded(truncated);
}

/**
 * Prepare JSON resource output with size limits
 */
function prepareJsonResource(data: any, uri: string): { uri: string; mimeType: string; text: string } {
  let jsonText = JSON.stringify(data, null, 2);

  // Truncate JSON if too large
  if (jsonText.length > OUTPUT_LIMITS.MAX_TEXT_CHARS) {
    console.error(`[OUTPUT] JSON resource truncated: ${jsonText.length} -> ${OUTPUT_LIMITS.MAX_TEXT_CHARS} chars`);
    jsonText = jsonText.substring(0, OUTPUT_LIMITS.MAX_TEXT_CHARS);
  }

  return {
    uri,
    mimeType: 'application/json',
    text: jsonText,
  };
}

// Define available tools
const TOOLS: Tool[] = [
  {
    name: 'search_processes',
    description:
      `Search for processes in Process Manager. Searches across process titles, activities, tasks, objectives, and more. Returns a list of matching processes with their metadata, URLs, and highlighted matching content.

Examples:
- "onboarding" - finds employee onboarding processes
- "risk management" - finds processes related to risk management
- "customer service" - finds customer-facing processes
- "compliance audit" - finds audit and compliance processes

Returns both formatted text and structured JSON for programmatic access.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query (e.g., "onboarding", "risk management")',
        },
        searchFields: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'all',
              'title',
              'activity',
              'task',
              'notes',
              'objectives',
              'background',
              'keywords',
            ],
          },
          description:
            'Which fields to search in. Default is all fields. Multiple fields can be specified.',
          default: ['all'],
        },
        matchType: {
          type: 'string',
          enum: ['any', 'all', 'exact'],
          description:
            'Match type: "any" (match any word), "all" (match all words), or "exact" (exact phrase)',
          default: 'any',
        },
        pageNumber: {
          type: 'number',
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_documents',
    description:
      `Search for documents in Process Manager. Returns a list of matching documents with their metadata and process associations.

Examples:
- "policy" - finds policy documents
- "template" - finds document templates
- "form" - finds forms and worksheets
- "checklist" - finds checklist documents

Returns both formatted text and structured JSON for programmatic access.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query (e.g., "policy", "template")',
        },
        matchType: {
          type: 'string',
          enum: ['any', 'all', 'exact'],
          description:
            'Match type: "any" (match any word), "all" (match all words), or "exact" (exact phrase)',
          default: 'any',
        },
        pageNumber: {
          type: 'number',
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_all',
    description:
      `Search for all types of content in Process Manager (processes, documents, policies, groups). Returns a comprehensive list of matches across all entity types.

Examples:
- "compliance" - finds processes, documents, and policies related to compliance
- "HR" - finds all HR-related content across the organization
- "security" - finds security-related processes, policies, and documents
- "finance department" - finds content in the finance area

Returns both formatted text and structured JSON for programmatic access.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        matchType: {
          type: 'string',
          enum: ['any', 'all', 'exact'],
          description:
            'Match type: "any" (match any word), "all" (match all words), or "exact" (exact phrase)',
          default: 'any',
        },
        pageNumber: {
          type: 'number',
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_process',
    description:
      `Get detailed information about a specific process by its unique ID. Returns the complete process structure including activities, tasks, objectives, owner, expert, and all process metadata.

Examples:
- Get process "00b2107e-e3f5-4921-990a-508b1347cba6" - retrieves full details
- Use after searching to get complete information about a found process
- Retrieve process structure to understand activities and task flow
- Check who owns or is expert for a specific process

Returns both formatted markdown and structured JSON for programmatic access.`,
    inputSchema: {
      type: 'object',
      properties: {
        processId: {
          type: 'string',
          description:
            'The unique ID of the process (UUID format, e.g., "00b2107e-e3f5-4921-990a-508b1347cba6")',
        },
      },
      required: ['processId'],
    },
  },
  {
    name: 'lookup_user',
    description:
      `Look up a user by their email address using the SCIM API. Returns user information including name, ID, active status, and metadata. Requires SCIM API key to be configured.

Examples:
- "john.doe@example.com" - finds user John Doe
- "jane.smith@company.com" - retrieves Jane Smith's information
- Look up process owners or experts by email
- Verify user account status and details

Returns both formatted text and structured JSON for programmatic access.`,
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'The email address of the user to look up',
        },
      },
      required: ['email'],
    },
  },
  {
    name: 'get_group_hierarchy',
    description:
      `Get the complete organizational structure of process groups. Recursively builds a tree showing all groups, subgroups, and the processes within them. Useful for understanding how processes are organized and discovering what processes exist in different departments or areas.

Examples:
- Get full hierarchy to understand organization structure
- Use maxDepth=1 to see only top-level groups
- Use maxDepth=2 to see top-level and their immediate children
- Set includeProcesses=false to see only group structure without processes
- Discover what departments or areas exist in the organization

Returns both formatted tree view and structured JSON for programmatic access.`,
    inputSchema: {
      type: 'object',
      properties: {
        maxDepth: {
          type: 'number',
          description: 'Maximum depth to traverse (default: unlimited). Use 1 for top-level only, 2 for top-level + direct children, etc.',
          default: null,
        },
        includeProcesses: {
          type: 'boolean',
          description: 'Whether to include process listings in the hierarchy (default: true)',
          default: true,
        },
      },
    },
  },
  {
    name: 'list_processes',
    description:
      `Get a paginated list of all processes in the Process Manager instance. Returns process metadata including name, state, owner, expert, and group association. Useful for discovering available processes, getting process counts, or finding processes by state.

Examples:
- List all processes (default 20 per page)
- Use pageSize=100 to get maximum processes per page
- Use page=2 to get the next page of results
- Get overview of all processes in the organization
- Find out total process count

Returns both formatted list and structured JSON for programmatic access.`,
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          description: 'Page number to retrieve (default: 1)',
          default: 1,
        },
        pageSize: {
          type: 'number',
          description: 'Number of processes per page (default: 20, max: 100)',
          default: 20,
        },
      },
    },
  },
  {
    name: 'get_process_diagram',
    description:
      `Get an interactive process diagram (process map) for a specific process. Returns an embedded iframe displaying the visual process map from Minimode. The diagram shows the complete process flow with activities, decision points, and connections in an interactive format.

Examples:
- Get diagram for process "d93f4301-83a3-4970-996e-223c2e08b168" - displays interactive map
- Use after getting process details to visualize the process flow
- View the process map to understand the complete workflow visually
- Share interactive process diagrams with stakeholders

Returns an embedded iframe with the process diagram and structured JSON for programmatic access.`,
    inputSchema: {
      type: 'object',
      properties: {
        processId: {
          type: 'string',
          description:
            'The unique ID of the process (UUID format, e.g., "d93f4301-83a3-4970-996e-223c2e08b168")',
        },
      },
      required: ['processId'],
    },
  },
  {
    name: 'review_process_for_automation',
    description:
      `Analyze a process to identify automation opportunities. Reviews each activity and task to suggest where automation could be applied, including API integrations, RPA bots, dedicated AI agents, or workflow automation.

This tool examines process steps for patterns indicating automation potential:
- Data entry and transfer tasks
- System lookups and validations
- Document processing and generation
- Approval workflows and notifications
- Repetitive manual operations
- Integration points between systems

Returns a structured analysis with:
- Step-by-step automation opportunities with confidence levels
- Recommended automation types (API, RPA, Agent, Workflow)
- Complexity estimates for implementation
- Suggestions for dedicated agents that could handle parts of the process
- Integration points and recommendations

Use this tool to assess process improvement opportunities and plan automation initiatives.`,
    inputSchema: {
      type: 'object',
      properties: {
        processId: {
          type: 'string',
          description:
            'The unique ID of the process to analyze (UUID format)',
        },
        includeAgentDesign: {
          type: 'boolean',
          description:
            'Whether to include suggestions for dedicated AI agents (default: true)',
          default: true,
        },
      },
      required: ['processId'],
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'process-manager-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_processes':
        return await handleSearchProcesses(args);

      case 'search_documents':
        return await handleSearchDocuments(args);

      case 'search_all':
        return await handleSearchAll(args);

      case 'get_process':
        return await handleGetProcess(args);

      case 'lookup_user':
        return await handleLookupUser(args);

      case 'get_group_hierarchy':
        return await handleGetGroupHierarchy(args);

      case 'list_processes':
        return await handleListProcesses(args);

      case 'get_process_diagram':
        return await handleGetProcessDiagram(args);

      case 'review_process_for_automation':
        return await handleReviewProcessForAutomation(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Handle search_processes tool
 */
async function handleSearchProcesses(args: any) {
  const query = args.query as string;
  const searchFields = (args.searchFields as string[]) || ['all'];
  const matchType = (args.matchType as string) || 'any';
  const pageNumber = (args.pageNumber as number) || 1;

  // Convert search field names to enum values
  const fieldMapping: Record<string, ProcessSearchField> = {
    all: ProcessSearchField.All,
    title: ProcessSearchField.Title,
    activity: ProcessSearchField.Activity,
    task: ProcessSearchField.Task,
    notes: ProcessSearchField.Notes,
    objectives: ProcessSearchField.Objectives,
    background: ProcessSearchField.Background,
    keywords: ProcessSearchField.SearchKeywords,
  };

  const processSearchFields = searchFields.map(
    (field) => fieldMapping[field.toLowerCase()] ?? ProcessSearchField.All
  );

  // Convert match type
  const matchTypeMapping: Record<string, SearchMatchType> = {
    any: SearchMatchType.Any,
    all: SearchMatchType.All,
    exact: SearchMatchType.Exact,
  };

  const searchMatchType =
    matchTypeMapping[matchType.toLowerCase()] ?? SearchMatchType.Any;

  // Build query string
  const params = new URLSearchParams({
    SearchCriteria: query,
    IncludedTypes: EntityType.ProcessesOnly.toString(),
    SearchMatchType: searchMatchType.toString(),
    pageNumber: pageNumber.toString(),
  });

  // Add process search fields if not "all"
  if (!processSearchFields.includes(ProcessSearchField.All)) {
    processSearchFields.forEach((field) => {
      params.append('ProcessSearchFields', field.toString());
    });
  }

  const results = (await authManager.searchRequest(
    params.toString()
  )) as SearchResponse;

  const formattedText = prepareTextOutput(formatSearchResults(results, 'processes'));

  return {
    content: [
      {
        type: 'text',
        text: formattedText,
      },
      {
        type: 'resource',
        resource: prepareJsonResource(results, 'data:application/json,search-processes'),
      },
    ],
  };
}

/**
 * Handle search_documents tool
 */
async function handleSearchDocuments(args: any) {
  const query = args.query as string;
  const matchType = (args.matchType as string) || 'any';
  const pageNumber = (args.pageNumber as number) || 1;

  const matchTypeMapping: Record<string, SearchMatchType> = {
    any: SearchMatchType.Any,
    all: SearchMatchType.All,
    exact: SearchMatchType.Exact,
  };

  const searchMatchType =
    matchTypeMapping[matchType.toLowerCase()] ?? SearchMatchType.Any;

  const params = new URLSearchParams({
    SearchCriteria: query,
    IncludedTypes: EntityType.DocumentsOnly.toString(),
    SearchMatchType: searchMatchType.toString(),
    pageNumber: pageNumber.toString(),
  });

  const results = (await authManager.searchRequest(
    params.toString()
  )) as SearchResponse;

  const formattedText = prepareTextOutput(formatSearchResults(results, 'documents'));

  return {
    content: [
      {
        type: 'text',
        text: formattedText,
      },
      {
        type: 'resource',
        resource: prepareJsonResource(results, 'data:application/json,search-documents'),
      },
    ],
  };
}

/**
 * Handle search_all tool
 */
async function handleSearchAll(args: any) {
  const query = args.query as string;
  const matchType = (args.matchType as string) || 'any';
  const pageNumber = (args.pageNumber as number) || 1;

  const matchTypeMapping: Record<string, SearchMatchType> = {
    any: SearchMatchType.Any,
    all: SearchMatchType.All,
    exact: SearchMatchType.Exact,
  };

  const searchMatchType =
    matchTypeMapping[matchType.toLowerCase()] ?? SearchMatchType.Any;

  const params = new URLSearchParams({
    SearchCriteria: query,
    IncludedTypes: EntityType.All.toString(),
    SearchMatchType: searchMatchType.toString(),
    pageNumber: pageNumber.toString(),
  });

  const results = (await authManager.searchRequest(
    params.toString()
  )) as SearchResponse;

  const formattedText = prepareTextOutput(formatSearchResults(results, 'all content'));

  return {
    content: [
      {
        type: 'text',
        text: formattedText,
      },
      {
        type: 'resource',
        resource: prepareJsonResource(results, 'data:application/json,search-all'),
      },
    ],
  };
}

/**
 * Handle get_process tool
 */
async function handleGetProcess(args: any) {
  const processId = args.processId as string;

  const result = (await authManager.apiRequest(
    `/Api/v1/Processes/${processId}`
  )) as ProcessResponse;

  // Fetch process summary to get review date information
  let summary: ProcessSummaryResponse | null = null;
  try {
    summary = (await authManager.apiRequest(
      `/bff/process/api/v1/processes/${processId}/summary?latestRevisionEdit=true`
    )) as ProcessSummaryResponse;
  } catch (error) {
    // If summary endpoint fails, continue without review date info
    console.error('[API] Failed to fetch process summary:', error);
  }

  // Get site URL for generating risk control links
  const siteUrl = authManager.getSiteUrl();

  const formattedText = prepareTextOutput(formatProcessDetails(result, summary, siteUrl));

  return {
    content: [
      {
        type: 'text',
        text: formattedText,
      },
      {
        type: 'resource',
        resource: prepareJsonResource(result, `promapp://process/${processId}`),
      },
    ],
  };
}

/**
 * Handle lookup_user tool
 */
async function handleLookupUser(args: any) {
  const email = args.email as string;

  const encodedEmail = encodeURIComponent(`userName eq "${email}"`);
  const result = (await authManager.scimRequest(
    `/users?filter=${encodedEmail}`
  )) as ScimUserResponse;

  return {
    content: [
      {
        type: 'text',
        text: formatUserLookup(result, email),
      },
      {
        type: 'resource',
        resource: prepareJsonResource(result, `data:application/json,user-lookup`),
      },
    ],
  };
}

/**
 * Handle get_group_hierarchy tool
 */
async function handleGetGroupHierarchy(args: any) {
  // Apply max depth limit to prevent runaway recursion
  const requestedDepth = args.maxDepth ?? null;
  const maxDepth = requestedDepth !== null
    ? Math.min(requestedDepth, OUTPUT_LIMITS.MAX_HIERARCHY_DEPTH)
    : OUTPUT_LIMITS.MAX_HIERARCHY_DEPTH;
  const includeProcesses = args.includeProcesses ?? true;

  // Recursively build the hierarchy
  const hierarchy = await buildGroupTree(null, 0, maxDepth, includeProcesses);

  const formattedText = prepareTextOutput(formatGroupHierarchy(hierarchy));

  return {
    content: [
      {
        type: 'text',
        text: formattedText,
      },
      {
        type: 'resource',
        resource: prepareJsonResource(hierarchy, 'data:application/json,group-hierarchy'),
      },
    ],
  };
}

/**
 * Recursively build the group tree
 */
async function buildGroupTree(
  groupUniqueId: string | null,
  currentDepth: number,
  maxDepth: number | null,
  includeProcesses: boolean
): Promise<TreeItem[]> {
  // Check depth limit
  if (maxDepth !== null && currentDepth >= maxDepth) {
    return [];
  }

  const response = (await authManager.getGroupTreeItems(
    groupUniqueId ?? undefined
  )) as TreeItemsResponse;

  const items = response.treeItems;

  // Process each item
  const processedItems: TreeItem[] = [];

  for (const item of items) {
    const processedItem: TreeItem = { ...item };

    // If this is a group with children, recurse
    if (item.itemType === 'group' && item.hasChild) {
      processedItem.children = await buildGroupTree(
        item.uniqueId,
        currentDepth + 1,
        maxDepth,
        includeProcesses
      );
    }

    // Filter out processes if not requested
    if (!includeProcesses &&
        (item.itemType === 'process' || item.itemType === 'inprogress-process')) {
      continue;
    }

    processedItems.push(processedItem);
  }

  return processedItems;
}

/**
 * Handle list_processes tool
 */
async function handleListProcesses(args: any) {
  const page = args.page ?? 1;
  // Cap page size for context window management
  const pageSize = Math.min(args.pageSize ?? 20, OUTPUT_LIMITS.MAX_LIST_ITEMS);

  const result = (await authManager.getProcessList(
    page,
    pageSize
  )) as ProcessListResponse;

  const formattedText = prepareTextOutput(formatProcessList(result, page, pageSize));

  return {
    content: [
      {
        type: 'text',
        text: formattedText,
      },
      {
        type: 'resource',
        resource: prepareJsonResource(result, 'data:application/json,process-list'),
      },
    ],
  };
}

/**
 * Handle get_process_diagram tool
 */
async function handleGetProcessDiagram(args: any) {
  const processId = args.processId as string;

  // Step 1: Get the process details to extract ProcessRevisionEditId
  console.error(`[DIAGRAM] Fetching process details for: ${processId}`);
  const processDetails = (await authManager.apiRequest(
    `/Api/v1/Processes/${processId}`
  )) as ProcessResponse;

  const processRevisionEditId = processDetails.processJson.ProcessRevisionEditId;
  const processName = processDetails.processJson.Name;

  if (!processRevisionEditId) {
    throw new Error(`Process ${processId} does not have a ProcessRevisionEditId`);
  }

  console.error(`[DIAGRAM] Found ProcessRevisionEditId: ${processRevisionEditId}`);

  // Step 2: Generate the Minimode permalink
  console.error(`[DIAGRAM] Generating Minimode permalink...`);
  const minimodeRequest: MinimodeGenerateRequest = {
    processUniqueId: processId,
    processRevisionEditId: processRevisionEditId,
    variationId: '',
  };

  const minimodeResponse = (await authManager.apiRequest(
    '/Api/v1/Minimode/Process/Generate',
    {
      method: 'POST',
      body: minimodeRequest,
    }
  )) as MinimodeGenerateResponse;

  const permalinkUrl = minimodeResponse.permalinkUrl;
  console.error(`[DIAGRAM] Generated permalink: ${permalinkUrl}`);

  // Step 3: Construct the regular process page URL
  const siteUrl = REGIONAL_ENDPOINTS[config.region].siteUrl;
  const processPageUrl = `${siteUrl}/${config.siteName}/Process/View/${processId}`;

  // Step 4: Create the iframe HTML (using Minimode URL)
  const iframeHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 10px;
      font-family: system-ui, -apple-system, sans-serif;
      background-color: #f5f5f5;
    }
    h2 {
      margin-top: 0;
      color: #333;
      font-size: 18px;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    iframe {
      width: 100%;
      height: 600px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background-color: white;
    }
    .metadata {
      font-size: 12px;
      color: #666;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>Process Diagram: ${processName}</h2>
    <div class="metadata">Process ID: ${processId}</div>
    <iframe
      src="${permalinkUrl}"
      title="Process Diagram for ${processName}"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      frameborder="0">
    </iframe>
  </div>
</body>
</html>`;

  return {
    content: [
      {
        type: 'text',
        text: `# Process Diagram: ${processName}\n\n**Process ID:** ${processId}\n**View Process:** ${processPageUrl}\n\nAn interactive process diagram is available. If your client supports embedded content, the diagram will be displayed below showing the complete process flow with activities, decision points, and connections.`,
      },
      {
        type: 'resource',
        resource: {
          uri: `ui://process-diagram/${processId}`,
          mimeType: 'text/html',
          text: iframeHtml,
        },
      },
    ],
  };
}

/**
 * Handle review_process_for_automation tool
 */
async function handleReviewProcessForAutomation(args: any) {
  const processId = args.processId as string;
  const includeAgentDesign = args.includeAgentDesign ?? true;

  console.error(`[AUTOMATION] Analyzing process for automation: ${processId}`);

  // Fetch process details
  const result = (await authManager.apiRequest(
    `/Api/v1/Processes/${processId}`
  )) as ProcessResponse;

  const process = result.processJson;

  // Analyze the process for automation opportunities
  const analysis = analyzeProcessForAutomation(
    process,
    processId,
    includeAgentDesign
  );

  const formattedText = prepareTextOutput(formatAutomationAnalysis(analysis));

  return {
    content: [
      {
        type: 'text',
        text: formattedText,
      },
      {
        type: 'resource',
        resource: prepareJsonResource(analysis, `promapp://process/${processId}/automation-analysis`),
      },
    ],
  };
}

/**
 * Automation indicator patterns - keywords and phrases that suggest automation potential
 */
const AUTOMATION_INDICATORS = {
  dataEntry: [
    'enter', 'input', 'record', 'log', 'fill', 'complete form', 'update record',
    'add to', 'capture', 'type', 'key in', 'populate',
  ],
  systemLookup: [
    'check', 'verify', 'look up', 'lookup', 'search', 'find', 'retrieve',
    'access', 'query', 'get from', 'pull from', 'fetch',
  ],
  dataTransfer: [
    'copy', 'transfer', 'move', 'export', 'import', 'sync', 'migrate',
    'send to', 'upload', 'download', 'extract',
  ],
  documentProcessing: [
    'document', 'report', 'generate', 'create report', 'prepare', 'compile',
    'draft', 'format', 'template', 'pdf', 'spreadsheet', 'invoice',
  ],
  approval: [
    'approve', 'review', 'sign off', 'authorize', 'confirm', 'validate',
    'escalate', 'reject', 'decision', 'manager approval',
  ],
  notification: [
    'notify', 'email', 'send', 'alert', 'inform', 'communicate', 'message',
    'reminder', 'follow up', 'update stakeholder',
  ],
  validation: [
    'validate', 'check for errors', 'ensure', 'confirm accuracy', 'verify',
    'reconcile', 'match', 'compare', 'audit', 'quality check',
  ],
  scheduling: [
    'schedule', 'book', 'calendar', 'appointment', 'meeting', 'arrange',
    'coordinate', 'plan date', 'set time',
  ],
  calculation: [
    'calculate', 'compute', 'sum', 'total', 'determine', 'assess',
    'evaluate', 'formula', 'percentage', 'rate',
  ],
  systemAction: [
    'system', 'software', 'application', 'database', 'crm', 'erp', 'api',
    'integration', 'portal', 'platform', 'tool',
  ],
};

/**
 * Analyze a single step (activity or task) for automation opportunities
 */
function analyzeStep(
  stepNumber: string,
  stepText: string,
  stepType: 'activity' | 'task'
): StepAutomationOpportunity | null {
  const lowerText = stepText.toLowerCase();
  const foundIndicators: string[] = [];
  const automationTypes: Set<AutomationType> = new Set();

  // Check for data entry patterns
  if (AUTOMATION_INDICATORS.dataEntry.some(i => lowerText.includes(i))) {
    foundIndicators.push('Data entry/input operations detected');
    automationTypes.add(AutomationType.DATA_ENTRY);
    automationTypes.add(AutomationType.RPA_BOT);
  }

  // Check for system lookup patterns
  if (AUTOMATION_INDICATORS.systemLookup.some(i => lowerText.includes(i))) {
    foundIndicators.push('System lookup/query operations detected');
    automationTypes.add(AutomationType.API_INTEGRATION);
    automationTypes.add(AutomationType.DEDICATED_AGENT);
  }

  // Check for data transfer patterns
  if (AUTOMATION_INDICATORS.dataTransfer.some(i => lowerText.includes(i))) {
    foundIndicators.push('Data transfer between systems detected');
    automationTypes.add(AutomationType.API_INTEGRATION);
    automationTypes.add(AutomationType.WORKFLOW_AUTOMATION);
  }

  // Check for document processing patterns
  if (AUTOMATION_INDICATORS.documentProcessing.some(i => lowerText.includes(i))) {
    foundIndicators.push('Document processing/generation detected');
    automationTypes.add(AutomationType.DOCUMENT_PROCESSING);
    automationTypes.add(AutomationType.DEDICATED_AGENT);
  }

  // Check for approval patterns
  if (AUTOMATION_INDICATORS.approval.some(i => lowerText.includes(i))) {
    foundIndicators.push('Approval/review workflow detected');
    automationTypes.add(AutomationType.APPROVAL_WORKFLOW);
    automationTypes.add(AutomationType.WORKFLOW_AUTOMATION);
  }

  // Check for notification patterns
  if (AUTOMATION_INDICATORS.notification.some(i => lowerText.includes(i))) {
    foundIndicators.push('Notification/communication task detected');
    automationTypes.add(AutomationType.NOTIFICATION);
    automationTypes.add(AutomationType.WORKFLOW_AUTOMATION);
  }

  // Check for validation patterns
  if (AUTOMATION_INDICATORS.validation.some(i => lowerText.includes(i))) {
    foundIndicators.push('Validation/verification operations detected');
    automationTypes.add(AutomationType.RPA_BOT);
    automationTypes.add(AutomationType.DEDICATED_AGENT);
  }

  // Check for scheduling patterns
  if (AUTOMATION_INDICATORS.scheduling.some(i => lowerText.includes(i))) {
    foundIndicators.push('Scheduling/calendar operations detected');
    automationTypes.add(AutomationType.API_INTEGRATION);
    automationTypes.add(AutomationType.WORKFLOW_AUTOMATION);
  }

  // Check for calculation patterns
  if (AUTOMATION_INDICATORS.calculation.some(i => lowerText.includes(i))) {
    foundIndicators.push('Calculation/computation operations detected');
    automationTypes.add(AutomationType.API_INTEGRATION);
    automationTypes.add(AutomationType.RPA_BOT);
  }

  // Check for system action patterns
  if (AUTOMATION_INDICATORS.systemAction.some(i => lowerText.includes(i))) {
    foundIndicators.push('System/software interaction detected');
    automationTypes.add(AutomationType.API_INTEGRATION);
    automationTypes.add(AutomationType.RPA_BOT);
  }

  // If no automation opportunities found, return null
  if (automationTypes.size === 0) {
    return null;
  }

  // Determine confidence based on number of indicators
  let confidence: AutomationConfidence;
  if (foundIndicators.length >= 3) {
    confidence = AutomationConfidence.HIGH;
  } else if (foundIndicators.length >= 2) {
    confidence = AutomationConfidence.MEDIUM;
  } else {
    confidence = AutomationConfidence.LOW;
  }

  // Estimate complexity based on automation types
  let estimatedComplexity: 'low' | 'medium' | 'high';
  if (automationTypes.has(AutomationType.DEDICATED_AGENT) ||
      automationTypes.size >= 3) {
    estimatedComplexity = 'high';
  } else if (automationTypes.has(AutomationType.API_INTEGRATION) ||
             automationTypes.has(AutomationType.WORKFLOW_AUTOMATION)) {
    estimatedComplexity = 'medium';
  } else {
    estimatedComplexity = 'low';
  }

  // Generate rationale
  const rationale = generateStepRationale(Array.from(automationTypes), foundIndicators);

  return {
    stepNumber,
    stepText,
    stepType,
    automationTypes: Array.from(automationTypes),
    confidence,
    rationale,
    indicators: foundIndicators,
    estimatedComplexity,
  };
}

/**
 * Generate a human-readable rationale for automation opportunity
 */
function generateStepRationale(
  automationTypes: AutomationType[],
  indicators: string[]
): string {
  const parts: string[] = [];

  if (automationTypes.includes(AutomationType.API_INTEGRATION)) {
    parts.push('could be automated via API integration with existing systems');
  }
  if (automationTypes.includes(AutomationType.RPA_BOT)) {
    parts.push('suitable for RPA bot handling repetitive UI-based tasks');
  }
  if (automationTypes.includes(AutomationType.DEDICATED_AGENT)) {
    parts.push('could benefit from a dedicated AI agent for intelligent processing');
  }
  if (automationTypes.includes(AutomationType.WORKFLOW_AUTOMATION)) {
    parts.push('can be streamlined with workflow automation tools');
  }
  if (automationTypes.includes(AutomationType.DOCUMENT_PROCESSING)) {
    parts.push('document processing can be automated with templates or AI');
  }
  if (automationTypes.includes(AutomationType.DATA_ENTRY)) {
    parts.push('data entry can be automated to reduce manual effort');
  }
  if (automationTypes.includes(AutomationType.NOTIFICATION)) {
    parts.push('notifications can be automated based on triggers');
  }
  if (automationTypes.includes(AutomationType.APPROVAL_WORKFLOW)) {
    parts.push('approval workflow can be digitized with automated routing');
  }

  return `This step ${parts.join('; ')}.`;
}

/**
 * Analyze process for automation opportunities
 */
function analyzeProcessForAutomation(
  process: ProcessResponse['processJson'],
  processId: string,
  includeAgentDesign: boolean
): ProcessAutomationAnalysis {
  const opportunities: StepAutomationOpportunity[] = [];
  let totalSteps = 0;

  // Analyze each activity and its tasks
  if (process.ProcessProcedures?.Activity) {
    for (const activity of process.ProcessProcedures.Activity) {
      totalSteps++;

      // Analyze the activity itself
      const activityOpportunity = analyzeStep(
        activity.Number,
        activity.Text,
        'activity'
      );
      if (activityOpportunity) {
        opportunities.push(activityOpportunity);
      }

      // Analyze tasks within the activity
      if (activity.ChildProcessProcedures?.Task) {
        for (const task of activity.ChildProcessProcedures.Task) {
          totalSteps++;
          const taskOpportunity = analyzeStep(
            task.Number,
            task.Text,
            'task'
          );
          if (taskOpportunity) {
            opportunities.push(taskOpportunity);
          }
        }
      }
    }
  }

  // Calculate summary statistics
  const highConfidenceOpportunities = opportunities.filter(
    o => o.confidence === AutomationConfidence.HIGH
  ).length;

  // Collect all automation types found
  const allAutomationTypes = new Set<AutomationType>();
  opportunities.forEach(o => o.automationTypes.forEach(t => allAutomationTypes.add(t)));

  // Determine overall automation potential
  let overallPotential: 'low' | 'medium' | 'high';
  const automationRatio = opportunities.length / Math.max(totalSteps, 1);
  if (automationRatio >= 0.5 || highConfidenceOpportunities >= 3) {
    overallPotential = 'high';
  } else if (automationRatio >= 0.25 || highConfidenceOpportunities >= 1) {
    overallPotential = 'medium';
  } else {
    overallPotential = 'low';
  }

  // Generate recommendations
  const recommendations = generateRecommendations(opportunities, allAutomationTypes);

  // Generate agent design suggestions if requested
  const agentDesignSuggestions = includeAgentDesign
    ? generateAgentDesignSuggestions(opportunities, process.Name)
    : { suggestedAgents: [], integrationPoints: [] };

  return {
    processId,
    processName: process.Name,
    analysisTimestamp: new Date().toISOString(),
    summary: {
      totalSteps,
      automationCandidates: opportunities.length,
      highConfidenceOpportunities,
      primaryAutomationTypes: Array.from(allAutomationTypes),
      overallAutomationPotential: overallPotential,
    },
    opportunities,
    recommendations,
    agentDesignSuggestions,
  };
}

/**
 * Generate recommendations based on automation opportunities
 */
function generateRecommendations(
  opportunities: StepAutomationOpportunity[],
  automationTypes: Set<AutomationType>
): string[] {
  const recommendations: string[] = [];

  if (opportunities.length === 0) {
    recommendations.push(
      'This process appears to require significant human judgment and may not be suitable for automation at this time.'
    );
    return recommendations;
  }

  // High-level recommendations based on automation types found
  if (automationTypes.has(AutomationType.API_INTEGRATION)) {
    recommendations.push(
      'Consider implementing API integrations to connect systems and automate data flow between applications.'
    );
  }

  if (automationTypes.has(AutomationType.RPA_BOT)) {
    recommendations.push(
      'RPA bots could handle repetitive, rule-based tasks that involve UI interactions across legacy systems.'
    );
  }

  if (automationTypes.has(AutomationType.DEDICATED_AGENT)) {
    recommendations.push(
      'An AI agent could be developed to handle complex decision-making steps that require contextual understanding.'
    );
  }

  if (automationTypes.has(AutomationType.WORKFLOW_AUTOMATION)) {
    recommendations.push(
      'Workflow automation tools (e.g., Power Automate, Zapier) could orchestrate the process flow and hand-offs.'
    );
  }

  if (automationTypes.has(AutomationType.DOCUMENT_PROCESSING)) {
    recommendations.push(
      'Document processing automation (e.g., templates, OCR, AI extraction) could reduce manual document handling.'
    );
  }

  if (automationTypes.has(AutomationType.APPROVAL_WORKFLOW)) {
    recommendations.push(
      'Digital approval workflows with automated routing and notifications could streamline sign-off processes.'
    );
  }

  // Add priority recommendation
  const highConfidenceSteps = opportunities.filter(o => o.confidence === AutomationConfidence.HIGH);
  if (highConfidenceSteps.length > 0) {
    recommendations.push(
      `Start with high-confidence automation opportunities: ${highConfidenceSteps.map(s => s.stepNumber).join(', ')}.`
    );
  }

  return recommendations;
}

/**
 * Generate suggestions for dedicated AI agents
 */
function generateAgentDesignSuggestions(
  opportunities: StepAutomationOpportunity[],
  processName: string
): ProcessAutomationAnalysis['agentDesignSuggestions'] {
  const suggestedAgents: Array<{
    name: string;
    purpose: string;
    coveredSteps: string[];
    capabilities: string[];
  }> = [];

  const integrationPoints: string[] = [];

  // Group opportunities by automation type to suggest specialized agents
  const agentCandidates = opportunities.filter(
    o => o.automationTypes.includes(AutomationType.DEDICATED_AGENT)
  );

  const documentSteps = opportunities.filter(
    o => o.automationTypes.includes(AutomationType.DOCUMENT_PROCESSING)
  );

  const dataSteps = opportunities.filter(
    o => o.automationTypes.includes(AutomationType.DATA_ENTRY) ||
         o.automationTypes.includes(AutomationType.API_INTEGRATION)
  );

  const validationSteps = opportunities.filter(
    o => o.indicators.some(i => i.toLowerCase().includes('validation'))
  );

  // Suggest document processing agent if applicable
  if (documentSteps.length >= 2) {
    suggestedAgents.push({
      name: `${processName} Document Agent`,
      purpose: 'Handle document generation, processing, and extraction tasks',
      coveredSteps: documentSteps.map(s => s.stepNumber),
      capabilities: [
        'Generate documents from templates',
        'Extract data from incoming documents',
        'Convert between document formats',
        'Populate forms automatically',
      ],
    });
    integrationPoints.push('Document storage/management system integration required');
  }

  // Suggest data processing agent if applicable
  if (dataSteps.length >= 3) {
    suggestedAgents.push({
      name: `${processName} Data Agent`,
      purpose: 'Handle data entry, validation, and system integration tasks',
      coveredSteps: dataSteps.map(s => s.stepNumber),
      capabilities: [
        'Retrieve data from source systems',
        'Validate and transform data',
        'Update target systems',
        'Handle data reconciliation',
      ],
    });
    integrationPoints.push('API access to source and target systems required');
  }

  // Suggest validation agent if applicable
  if (validationSteps.length >= 2) {
    suggestedAgents.push({
      name: `${processName} Validation Agent`,
      purpose: 'Perform automated validation and quality checks',
      coveredSteps: validationSteps.map(s => s.stepNumber),
      capabilities: [
        'Validate data against business rules',
        'Check for completeness and accuracy',
        'Flag exceptions for human review',
        'Generate validation reports',
      ],
    });
    integrationPoints.push('Access to validation rules and reference data required');
  }

  // If there are agent candidates but no specialized agent suggested, suggest a general process agent
  if (agentCandidates.length >= 2 && suggestedAgents.length === 0) {
    suggestedAgents.push({
      name: `${processName} Assistant Agent`,
      purpose: 'Provide AI-assisted support for complex process steps',
      coveredSteps: agentCandidates.map(s => s.stepNumber),
      capabilities: [
        'Answer questions about the process',
        'Assist with decision-making',
        'Provide recommendations based on context',
        'Handle exceptions and edge cases',
      ],
    });
    integrationPoints.push('Access to process knowledge base and historical data required');
  }

  return { suggestedAgents, integrationPoints };
}

/**
 * Format automation analysis for display
 */
function formatAutomationAnalysis(analysis: ProcessAutomationAnalysis): string {
  let output = `# Automation Analysis: ${analysis.processName}\n\n`;
  output += `**Process ID:** ${analysis.processId}\n`;
  output += `**Analysis Date:** ${new Date(analysis.analysisTimestamp).toLocaleDateString()}\n\n`;

  // Summary section
  output += `## Summary\n\n`;
  output += `| Metric | Value |\n`;
  output += `|--------|-------|\n`;
  output += `| Total Steps Analyzed | ${analysis.summary.totalSteps} |\n`;
  output += `| Automation Candidates | ${analysis.summary.automationCandidates} |\n`;
  output += `| High Confidence Opportunities | ${analysis.summary.highConfidenceOpportunities} |\n`;
  output += `| Overall Automation Potential | **${analysis.summary.overallAutomationPotential.toUpperCase()}** |\n\n`;

  if (analysis.summary.primaryAutomationTypes.length > 0) {
    output += `**Primary Automation Types:** ${analysis.summary.primaryAutomationTypes.join(', ')}\n\n`;
  }

  // Opportunities section
  if (analysis.opportunities.length > 0) {
    output += `## Automation Opportunities\n\n`;

    for (const opp of analysis.opportunities) {
      const confidenceIcon =
        opp.confidence === AutomationConfidence.HIGH ? '🟢' :
        opp.confidence === AutomationConfidence.MEDIUM ? '🟡' : '🔴';

      output += `### ${opp.stepNumber} ${opp.stepText}\n\n`;
      output += `- **Type:** ${opp.stepType}\n`;
      output += `- **Confidence:** ${confidenceIcon} ${opp.confidence}\n`;
      output += `- **Complexity:** ${opp.estimatedComplexity}\n`;
      output += `- **Automation Types:** ${opp.automationTypes.join(', ')}\n`;
      output += `- **Rationale:** ${opp.rationale}\n`;
      output += `- **Indicators:** ${opp.indicators.join('; ')}\n\n`;
    }
  } else {
    output += `## Automation Opportunities\n\n`;
    output += `No strong automation candidates identified. This process may require significant human judgment.\n\n`;
  }

  // Recommendations section
  output += `## Recommendations\n\n`;
  analysis.recommendations.forEach((rec, index) => {
    output += `${index + 1}. ${rec}\n`;
  });
  output += '\n';

  // Agent design suggestions
  if (analysis.agentDesignSuggestions.suggestedAgents.length > 0) {
    output += `## Suggested AI Agents\n\n`;

    for (const agent of analysis.agentDesignSuggestions.suggestedAgents) {
      output += `### ${agent.name}\n\n`;
      output += `**Purpose:** ${agent.purpose}\n\n`;
      output += `**Covered Steps:** ${agent.coveredSteps.join(', ')}\n\n`;
      output += `**Capabilities:**\n`;
      agent.capabilities.forEach(cap => {
        output += `- ${cap}\n`;
      });
      output += '\n';
    }

    if (analysis.agentDesignSuggestions.integrationPoints.length > 0) {
      output += `### Integration Requirements\n\n`;
      analysis.agentDesignSuggestions.integrationPoints.forEach(point => {
        output += `- ${point}\n`;
      });
      output += '\n';
    }
  }

  return output;
}

/**
 * Format search results for display
 */
function formatSearchResults(results: SearchResponse, searchType: string): string {
  const { response, paging } = results;

  if (response.length === 0) {
    return `No ${searchType} found matching your search criteria.`;
  }

  let output = `Found ${paging.TotalItemCount} ${searchType} (showing ${response.length} on page ${paging.PageNumber}):\n\n`;

  response.forEach((item, index) => {
    output += `${index + 1}. **${item.Name}**\n`;
    output += `   Type: ${item.EntityType}\n`;
    output += `   URL: ${item.ItemUrl}\n`;

    if (item.ProcessUniqueId) {
      output += `   Process ID: ${item.ProcessUniqueId}\n`;
    }

    if (item.BreadCrumbGroupNames && item.BreadCrumbGroupNames.length > 0) {
      output += `   Location: ${item.BreadCrumbGroupNames.join(' > ')}\n`;
    }

    // Show highlights
    if (item.HighLights && Object.keys(item.HighLights).length > 0) {
      output += `   Matches found in:\n`;
      for (const [field, matches] of Object.entries(item.HighLights)) {
        if (matches.length > 0) {
          output += `     - ${field}: ${matches.slice(0, 2).join('; ')}${matches.length > 2 ? '...' : ''}\n`;
        }
      }
    }

    output += '\n';
  });

  if (!paging.IsLastPage) {
    output += `\nMore results available. Use pageNumber parameter to view page ${paging.PageNumber + 1}.`;
  }

  return output;
}

/**
 * Check if a process is out of date based on its review date
 */
function isProcessOutOfDate(nextReviewDate: string | null): boolean {
  if (!nextReviewDate) {
    return false;
  }

  const reviewDate = new Date(nextReviewDate);
  const currentDate = new Date();

  return currentDate > reviewDate;
}

/**
 * Format review date information for display
 */
function formatReviewDateInfo(summary: ProcessSummaryResponse | null): string {
  if (!summary || !summary.nextReviewDate) {
    return '';
  }

  const reviewDate = new Date(summary.nextReviewDate);
  const isOutOfDate = isProcessOutOfDate(summary.nextReviewDate);

  let output = `**Next Review Date:** ${reviewDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}`;

  if (isOutOfDate) {
    output += ' ⚠️ **OUT OF DATE**';
  }

  return output + '\n';
}

/**
 * Determine process state based on version number
 * - Version < 1.0: Draft (never been published)
 * - Version X.0: Published
 * - Version X.Y (where Y > 0): In Progress
 */
function getProcessState(version: string): string {
  if (!version) {
    return 'Unknown';
  }

  const versionParts = version.split('.');
  const majorVersion = parseFloat(versionParts[0]);
  const minorVersion = versionParts.length > 1 ? parseFloat(versionParts[1]) : 0;

  if (majorVersion < 1) {
    return 'Draft';
  } else if (minorVersion === 0) {
    return 'Published';
  } else {
    return 'In Progress';
  }
}

/**
 * Format process details for display
 */
function formatProcessDetails(
  result: ProcessResponse,
  summary: ProcessSummaryResponse | null = null,
  siteUrl: string = ''
): string {
  const process = result.processJson;

  let output = `# ${process.Name}\n\n`;
  output += `**Process ID:** ${process.UniqueId}\n`;
  output += `**State:** ${process.State}\n`;

  // Add version and process state information
  if (process.Version) {
    const processState = getProcessState(process.Version);
    output += `**Version:** ${process.Version} (${processState})\n`;
  }

  output += `**Owner:** ${process.Owner}\n`;
  output += `**Expert:** ${process.Expert}\n`;
  output += `**Group:** ${process.Group}\n`;

  // Add review date information if available
  const reviewDateInfo = formatReviewDateInfo(summary);
  if (reviewDateInfo) {
    output += reviewDateInfo;
  }

  output += '\n';

  if (process.Objective) {
    output += `**Objective:**\n${process.Objective}\n\n`;
  }

  if (process.Background) {
    output += `**Background:**\n${process.Background}\n\n`;
  }

  // Show activities and tasks
  if (process.ProcessProcedures?.Activity) {
    output += `## Activities\n\n`;

    process.ProcessProcedures.Activity.forEach((activity) => {
      output += `### ${activity.Number} ${activity.Text}\n`;

      // Show role ownership
      if (activity.Ownerships?.Role && activity.Ownerships.Role.length > 0) {
        const roles = activity.Ownerships.Role.map((role: any) => role.Name).join(', ');
        output += `**Assigned to:** ${roles}\n`;
      }

      // Show tags if present
      if (activity.Ownerships?.Tag && activity.Ownerships.Tag.length > 0) {
        const tags = activity.Ownerships.Tag.map((tag: any) => tag.Name).join(', ');
        output += `**Tags:** ${tags}\n`;
      }

      // Show tasks
      if (activity.ChildProcessProcedures?.Task) {
        output += '\n**Tasks:**\n';
        activity.ChildProcessProcedures.Task.forEach((task) => {
          output += `- ${task.Number} ${task.Text}\n`;
        });
      }

      // Show risk controls if present
      if (activity.RiskControls?.RiskControl && activity.RiskControls.RiskControl.length > 0) {
        output += '\n**Risk Controls:**\n';
        activity.RiskControls.RiskControl.forEach((risk: any) => {
          // Show risk reference and title
          output += `- **${risk.Ref}**: ${risk.Title}\n`;

          // Show portfolio information
          if (risk.Portfolios?.Portfolio && risk.Portfolios.Portfolio.length > 0) {
            const portfolios = risk.Portfolios.Portfolio.map((p: any) => p.Name).join(', ');
            output += `  - Portfolio: ${portfolios}\n`;
          }

          // Show objective if present
          if (risk.Objective) {
            output += `  - Objective: ${risk.Objective}\n`;
          }

          // Generate and show link to risk register if we have a site URL and ref
          if (siteUrl && risk.Ref) {
            const riskUrl = `${siteUrl}/Risk/Register?TreatmentKey=${risk.Ref}`;
            output += `  - View in Risk Register: ${riskUrl}\n`;
          }
        });
      }

      output += '\n';
    });
  }

  return output;
}

/**
 * Format user lookup results
 */
function formatUserLookup(result: ScimUserResponse, email: string): string {
  if (result.totalResults === 0) {
    return `No user found with email: ${email}`;
  }

  const user = result.Resources[0];

  let output = `# User Information\n\n`;
  output += `**Name:** ${user.name.givenName} ${user.name.familyName}\n`;
  output += `**Email:** ${user.userName}\n`;
  output += `**User ID:** ${user.id}\n`;
  output += `**Status:** ${user.active ? 'Active' : 'Inactive'}\n`;
  output += `**Created:** ${user.meta.created}\n`;

  if (user.emails && user.emails.length > 0) {
    output += `**Emails:**\n`;
    user.emails.forEach((email) => {
      output += `  - ${email.value} ${email.primary ? '(primary)' : ''}\n`;
    });
  }

  return output;
}

/**
 * Format group hierarchy for display
 */
function formatGroupHierarchy(hierarchy: TreeItem[]): string {
  let output = `# Process Group Hierarchy\n\n`;

  if (hierarchy.length === 0) {
    return output + 'No groups found.\n';
  }

  // Count totals
  const counts = countHierarchyItems(hierarchy);
  output += `**Total Groups:** ${counts.groups}\n`;
  output += `**Total Processes:** ${counts.processes}\n`;
  output += `**In-Progress Processes:** ${counts.inProgressProcesses}\n`;
  output += `**Document Groups:** ${counts.documentGroups}\n\n`;
  output += '---\n\n';

  // Format the tree
  output += formatTreeLevel(hierarchy, 0);

  return output;
}

/**
 * Count items in hierarchy
 */
function countHierarchyItems(items: TreeItem[]): {
  groups: number;
  processes: number;
  inProgressProcesses: number;
  documentGroups: number;
} {
  let counts = {
    groups: 0,
    processes: 0,
    inProgressProcesses: 0,
    documentGroups: 0,
  };

  for (const item of items) {
    if (item.itemType === 'group') {
      counts.groups++;
      if (item.children) {
        const childCounts = countHierarchyItems(item.children);
        counts.groups += childCounts.groups;
        counts.processes += childCounts.processes;
        counts.inProgressProcesses += childCounts.inProgressProcesses;
        counts.documentGroups += childCounts.documentGroups;
      }
    } else if (item.itemType === 'process') {
      counts.processes++;
    } else if (item.itemType === 'inprogress-process') {
      counts.inProgressProcesses++;
    } else if (item.itemType === 'documentgroup') {
      counts.documentGroups++;
    }
  }

  return counts;
}

/**
 * Format a level of the tree
 */
function formatTreeLevel(items: TreeItem[], depth: number): string {
  let output = '';
  const indent = '  '.repeat(depth);

  for (const item of items) {
    // Choose icon based on type
    let icon = '';
    if (item.itemType === 'group') {
      icon = '📁';
    } else if (item.itemType === 'process') {
      icon = '📄';
    } else if (item.itemType === 'inprogress-process') {
      icon = '🔄';
    } else if (item.itemType === 'documentgroup') {
      icon = '📚';
    }

    output += `${indent}${icon} **${item.title}**`;

    // Add metadata
    if (item.itemType === 'group' && item.totalSubgroups !== null && item.totalSubgroups > 0) {
      output += ` (${item.totalSubgroups} subgroup${item.totalSubgroups > 1 ? 's' : ''})`;
    }

    output += `\n${indent}   ID: ${item.uniqueId}\n`;

    // Recurse into children
    if (item.children && item.children.length > 0) {
      output += formatTreeLevel(item.children, depth + 1);
    }

    output += '\n';
  }

  return output;
}

/**
 * Format process list for display
 */
function formatProcessList(
  result: ProcessListResponse,
  page: number,
  pageSize: number
): string {
  let output = `# Process List\n\n`;

  if (result.items.length === 0) {
    return output + 'No processes found.\n';
  }

  // Show pagination info
  const totalPages = Math.ceil(result.totalItemCount / pageSize);
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, result.totalItemCount);

  output += `**Total Processes:** ${result.totalItemCount}\n`;
  output += `**Showing:** ${startIndex}-${endIndex} (Page ${page} of ${totalPages})\n\n`;
  output += '---\n\n';

  // List processes
  result.items.forEach((process: ProcessListItem, index: number) => {
    const displayNumber = startIndex + index;

    output += `## ${displayNumber}. ${process.processName}\n\n`;
    output += `**Process ID:** ${process.processUniqueId}\n`;
    output += `**State:** ${process.processState}`;

    if (process.processRevisionState) {
      output += ` (${process.processRevisionState})`;
    }
    output += `\n`;

    output += `**Group:** ${process.groupName}\n`;
    output += `**Owner:** ${process.processOwner}\n`;
    output += `**Expert:** ${process.processExpert}\n`;

    if (process.isFavourite) {
      output += `⭐ **Favorite**\n`;
    }

    output += `\n`;
  });

  // Show pagination hint
  if (page < totalPages) {
    output += `\n---\n\n`;
    output += `More processes available. Use page ${page + 1} to view the next page.\n`;
  }

  return output;
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Process Manager MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
