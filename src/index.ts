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
  ScimUserResponse,
  TreeItem,
  TreeItemsResponse,
  ProcessListItem,
  ProcessListResponse,
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

  return {
    content: [
      {
        type: 'text',
        text: formatSearchResults(results, 'processes'),
      },
      {
        type: 'resource',
        resource: {
          uri: 'data:application/json,' + encodeURIComponent(JSON.stringify(results, null, 2)),
          mimeType: 'application/json',
          text: JSON.stringify(results, null, 2),
        },
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

  return {
    content: [
      {
        type: 'text',
        text: formatSearchResults(results, 'documents'),
      },
      {
        type: 'resource',
        resource: {
          uri: 'data:application/json,' + encodeURIComponent(JSON.stringify(results, null, 2)),
          mimeType: 'application/json',
          text: JSON.stringify(results, null, 2),
        },
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

  return {
    content: [
      {
        type: 'text',
        text: formatSearchResults(results, 'all content'),
      },
      {
        type: 'resource',
        resource: {
          uri: 'data:application/json,' + encodeURIComponent(JSON.stringify(results, null, 2)),
          mimeType: 'application/json',
          text: JSON.stringify(results, null, 2),
        },
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

  return {
    content: [
      {
        type: 'text',
        text: formatProcessDetails(result),
      },
      {
        type: 'resource',
        resource: {
          uri: `promapp://process/${processId}`,
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2),
        },
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
        resource: {
          uri: `data:application/json,` + encodeURIComponent(JSON.stringify(result, null, 2)),
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2),
        },
      },
    ],
  };
}

/**
 * Handle get_group_hierarchy tool
 */
async function handleGetGroupHierarchy(args: any) {
  const maxDepth = args.maxDepth ?? null;
  const includeProcesses = args.includeProcesses ?? true;

  // Recursively build the hierarchy
  const hierarchy = await buildGroupTree(null, 0, maxDepth, includeProcesses);

  return {
    content: [
      {
        type: 'text',
        text: formatGroupHierarchy(hierarchy),
      },
      {
        type: 'resource',
        resource: {
          uri: 'data:application/json,' + encodeURIComponent(JSON.stringify(hierarchy, null, 2)),
          mimeType: 'application/json',
          text: JSON.stringify(hierarchy, null, 2),
        },
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
  const pageSize = Math.min(args.pageSize ?? 20, 100); // Cap at 100

  const result = (await authManager.getProcessList(
    page,
    pageSize
  )) as ProcessListResponse;

  return {
    content: [
      {
        type: 'text',
        text: formatProcessList(result, page, pageSize),
      },
      {
        type: 'resource',
        resource: {
          uri: 'data:application/json,' + encodeURIComponent(JSON.stringify(result, null, 2)),
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2),
        },
      },
    ],
  };
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
 * Format process details for display
 */
function formatProcessDetails(result: ProcessResponse): string {
  const process = result.processJson;

  let output = `# ${process.Name}\n\n`;
  output += `**Process ID:** ${process.UniqueId}\n`;
  output += `**State:** ${process.State}\n`;
  output += `**Owner:** ${process.Owner}\n`;
  output += `**Expert:** ${process.Expert}\n`;
  output += `**Group:** ${process.Group}\n\n`;

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
          output += `- ${risk.Title}\n`;
          if (risk.Portfolios?.Portfolio && risk.Portfolios.Portfolio.length > 0) {
            const portfolios = risk.Portfolios.Portfolio.map((p: any) => p.Name).join(', ');
            output += `  Portfolio: ${portfolios}\n`;
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
