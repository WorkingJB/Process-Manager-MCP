/**
 * Configuration and type definitions for Process Manager MCP Server
 */

export interface ProcessManagerConfig {
  region: Region;
  siteName: string;
  username: string;
  password: string;
  scimApiKey?: string;
}

export type Region = 'demo' | 'us' | 'ca' | 'eu' | 'au' | 'ae';

export interface RegionalEndpoints {
  siteUrl: string;
  searchUrl: string;
}

/**
 * Regional endpoint mappings for Process Manager
 */
export const REGIONAL_ENDPOINTS: Record<Region, RegionalEndpoints> = {
  demo: {
    siteUrl: 'https://demo.promapp.com',
    searchUrl: 'https://dmo-wus-sch.promapp.io',
  },
  us: {
    siteUrl: 'https://us.promapp.com',
    searchUrl: 'https://prd-wus-sch.promapp.io',
  },
  ca: {
    siteUrl: 'https://ca.promapp.com',
    searchUrl: 'https://prd-cac-sch.promapp.io',
  },
  eu: {
    siteUrl: 'https://eu.promapp.com',
    searchUrl: 'https://prd-neu-sch.promapp.io',
  },
  au: {
    siteUrl: 'https://au.promapp.com',
    searchUrl: 'https://prd-aus-sch.promapp.io',
  },
  ae: {
    siteUrl: 'https://ae.promapp.com',
    searchUrl: 'https://prd-ane-sch.promapp.io',
  },
};

/**
 * Search entity types
 */
export enum EntityType {
  All = 0,
  ProcessesOnly = 1,
  DocumentsOnly = 2,
  PoliciesOnly = 3,
  ProcedureOnlyProcesses = 4,
  SuggestedProcesses = 5,
  Groups = 6,
}

/**
 * Process search field filters
 */
export enum ProcessSearchField {
  All = 0,
  Title = 1,
  Activity = 2,
  Task = 3,
  Notes = 4,
  Objectives = 5,
  Background = 6,
  SearchKeywords = 7,
}

export enum SearchMatchType {
  Any = 0,
  All = 1,
  Exact = 2,
}

/**
 * Site authentication response
 */
export interface SiteAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Search authentication response
 */
export interface SearchAuthResponse {
  Status: string;
  Message: string; // JWT token
}

/**
 * Search result item
 */
export interface SearchResultItem {
  Name: string;
  EntityType: string;
  ProcessStateMetadata: any[];
  ItemUrl: string;
  BreadCrumbGroupNames: string[];
  ProcessGroupUrl: string;
  LinkedDocument: any;
  AllowEdit: boolean;
  IsFavourite: boolean;
  DocumentUniqueId: string | null;
  ProcessUniqueId: string | null;
  ProcessGroupUniqueId: string | null;
  HighLights: Record<string, string[]>;
}

/**
 * Search response
 */
export interface SearchResponse {
  success: boolean;
  response: SearchResultItem[];
  paging: {
    TotalItemCount: number;
    LastItemOnPage: number;
    IsLastPage: boolean;
    PageNumber: number;
  };
  userFilter: any;
}

/**
 * Process detail response
 */
export interface ProcessResponse {
  processJson: {
    Id: number;
    UniqueId: string;
    Name: string;
    StateId: number;
    Objective: string;
    OwnerId: number;
    ExpertId: number;
    GroupId: number;
    GroupUniqueId: string;
    Background: string;
    Expert: string;
    Owner: string;
    Group: string;
    State: string;
    ProcessRevisionEditId: number;
    ProcessProcedures: {
      Activity: Activity[];
    };
    [key: string]: any;
  };
}

/**
 * Process summary response for review dates
 */
export interface ProcessSummaryResponse {
  owner: string;
  expert: string;
  globalProcessExpert: string | null;
  objective: string;
  background: string;
  nextReviewDate: string | null;
  searchKeywords: string;
  shouldShowExplicitReview: boolean;
  isNeverPublishedProcess: boolean;
  isVariedProcess: boolean;
  processTags: any;
}

export interface Activity {
  Id: number;
  UniqueId: string;
  Number: string;
  Text: string;
  ChildProcessProcedures?: {
    Task?: Task[];
  };
  [key: string]: any;
}

export interface Task {
  Id: number;
  UniqueId: string;
  Number: string;
  Text: string;
  [key: string]: any;
}

/**
 * SCIM User response
 */
export interface ScimUserResponse {
  itemsPerPage: number;
  startIndex: number;
  totalResults: number;
  schemas: string[];
  Resources: ScimUser[];
}

export interface ScimUser {
  schemas: string[];
  userName: string;
  name: {
    formatted: string | null;
    familyName: string;
    givenName: string;
    middleName: string | null;
    honorificPrefix: string | null;
    honorificSuffix: string | null;
  };
  displayName: string | null;
  active: boolean;
  emails: Array<{
    type: string | null;
    primary: boolean;
    value: string;
    display: string | null;
  }>;
  id: string;
  externalId: string | null;
  meta: {
    resourceType: string | null;
    created: string;
    lastModified: string | null;
    location: string | null;
    version: string | null;
  };
}

/**
 * Group hierarchy tree item
 */
export interface TreeItem {
  id: number;
  uniqueId: string;
  title: string;
  itemType: string; // 'group', 'process', 'inprogress-process', 'documentgroup', etc.
  itemOrder: number;
  hasChild: boolean | null;
  totalSubgroups: number | null;
  totalStakeholderUsers: number | null;
  totalPermissionRoles: number | null;
  totalPermissionUsers: number | null;
  variationSetId: string | null;
  children?: TreeItem[]; // Populated by recursive traversal
}

export interface TreeItemsResponse {
  treeItems: TreeItem[];
  parentUniqueId: string;
}

/**
 * Process list item
 */
export interface ProcessListItem {
  canRestore: boolean;
  canDelete: boolean;
  processId: number;
  processName: string;
  processUniqueId: string;
  processState: string;
  processRevisionState: string | null;
  groupId: number;
  groupUniqueId: string;
  groupName: string;
  groupExists: boolean | null;
  processOwner: string;
  processExpert: string;
  isFavourite: boolean;
  ratingValue: number | null;
  acknowledgementRequired: boolean;
}

export interface ProcessListResponse {
  items: ProcessListItem[];
  totalItemCount: number;
  displayAcknowledgement: boolean;
}

/**
 * Minimode generate response
 */
export interface MinimodeGenerateRequest {
  processUniqueId: string;
  processRevisionEditId: number;
  variationId: string;
}

export interface MinimodeGenerateResponse {
  permalinkUrl: string;
}

export const SCIM_API_BASE_URL = 'https://api.promapp.com/api/scim';

/**
 * Automation opportunity types
 */
export enum AutomationType {
  API_INTEGRATION = 'api_integration',
  RPA_BOT = 'rpa_bot',
  DEDICATED_AGENT = 'dedicated_agent',
  WORKFLOW_AUTOMATION = 'workflow_automation',
  DOCUMENT_PROCESSING = 'document_processing',
  DATA_ENTRY = 'data_entry',
  NOTIFICATION = 'notification',
  APPROVAL_WORKFLOW = 'approval_workflow',
}

/**
 * Automation confidence level
 */
export enum AutomationConfidence {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * Automation opportunity for a single step
 */
export interface StepAutomationOpportunity {
  stepNumber: string;
  stepText: string;
  stepType: 'activity' | 'task';
  automationTypes: AutomationType[];
  confidence: AutomationConfidence;
  rationale: string;
  indicators: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

/**
 * Process automation analysis result
 */
export interface ProcessAutomationAnalysis {
  processId: string;
  processName: string;
  analysisTimestamp: string;
  summary: {
    totalSteps: number;
    automationCandidates: number;
    highConfidenceOpportunities: number;
    primaryAutomationTypes: AutomationType[];
    overallAutomationPotential: 'low' | 'medium' | 'high';
  };
  opportunities: StepAutomationOpportunity[];
  recommendations: string[];
  agentDesignSuggestions: {
    suggestedAgents: Array<{
      name: string;
      purpose: string;
      coveredSteps: string[];
      capabilities: string[];
    }>;
    integrationPoints: string[];
  };
}
