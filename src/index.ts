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
      'Search for processes in Process Manager. Searches across process titles, activities, tasks, objectives, and more. Returns a list of matching processes with their metadata, URLs, and highlighted matching content.',
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
      'Search for documents in Process Manager. Returns a list of matching documents with their metadata and process associations.',
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
      'Search for all types of content in Process Manager (processes, documents, policies, groups). Returns a comprehensive list of matches across all entity types.',
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
      'Get detailed information about a specific process by its unique ID. Returns the complete process structure including activities, tasks, objectives, owner, expert, and all process metadata.',
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
      'Look up a user by their email address using the SCIM API. Returns user information including name, ID, active status, and metadata. Requires SCIM API key to be configured.',
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
