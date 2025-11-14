/**
 * Authentication manager for Process Manager
 * Handles Site Auth, Search Auth, and SCIM API authentication
 */

import fetch from 'node-fetch';
import {
  ProcessManagerConfig,
  REGIONAL_ENDPOINTS,
  SiteAuthResponse,
  SearchAuthResponse,
} from './config.js';

export class AuthManager {
  private config: ProcessManagerConfig;
  private siteToken: string | null = null;
  private siteTokenExpiry: number | null = null;
  private searchToken: string | null = null;
  private searchTokenExpiry: number | null = null;

  constructor(config: ProcessManagerConfig) {
    this.config = config;
  }

  /**
   * Get the site base URL for the configured region and site name
   * Used for OAuth2 authentication, search token, and API calls
   */
  private getSiteBaseUrl(): string {
    const endpoints = REGIONAL_ENDPOINTS[this.config.region];
    return `${endpoints.siteUrl}/${this.config.siteName}`;
  }

  /**
   * Get the search base URL for the configured region
   * Used only for the actual search requests (different domain)
   */
  private getSearchBaseUrl(): string {
    return REGIONAL_ENDPOINTS[this.config.region].searchUrl;
  }

  /**
   * Authenticate with Site Auth (OAuth2 password grant)
   * Returns a JWT bearer token for API access
   */
  async getSiteToken(force = false): Promise<string> {
    // Return cached token if still valid
    if (
      !force &&
      this.siteToken &&
      this.siteTokenExpiry &&
      Date.now() < this.siteTokenExpiry
    ) {
      console.error('[AUTH] Using cached site token');
      return this.siteToken;
    }

    const url = `${this.getSiteBaseUrl()}/oauth2/token`;
    console.error(`[AUTH] Requesting site token from: ${url}`);
    console.error(`[AUTH] Using username: ${this.config.username}`);

    const params = new URLSearchParams({
      grant_type: 'password',
      username: this.config.username,
      password: this.config.password,
      duration: '60000', // Token duration in seconds (16.6 hours)
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AUTH] Site auth failed with status ${response.status}`);
      console.error(`[AUTH] Error response: ${errorText}`);
      throw new Error(
        `Site authentication failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as SiteAuthResponse;
    this.siteToken = data.access_token;
    // Set expiry to 90% of actual expiry to avoid edge cases
    this.siteTokenExpiry = Date.now() + data.expires_in * 1000 * 0.9;

    console.error('[AUTH] Site token obtained successfully');
    return this.siteToken;
  }

  /**
   * Get Search Service Token
   * Uses the Site Auth token to obtain a Search API token
   */
  async getSearchToken(force = false): Promise<string> {
    // Return cached token if still valid
    if (
      !force &&
      this.searchToken &&
      this.searchTokenExpiry &&
      Date.now() < this.searchTokenExpiry
    ) {
      console.error('[AUTH] Using cached search token');
      return this.searchToken;
    }

    // Ensure we have a valid site token first
    console.error('[AUTH] Getting site token for search auth...');
    const siteToken = await this.getSiteToken();

    const url = `${this.getSiteBaseUrl()}/search/GetSearchServiceToken`;
    console.error(`[AUTH] Requesting search token from: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${siteToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AUTH] Search auth failed with status ${response.status}`);
      console.error(`[AUTH] Error response: ${errorText}`);
      throw new Error(
        `Search authentication failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as SearchAuthResponse;

    if (data.Status !== 'Success') {
      console.error(`[AUTH] Search auth returned non-success status: ${data.Status}`);
      throw new Error(`Search authentication failed: ${data.Status}`);
    }

    this.searchToken = data.Message; // JWT token in Message field
    // Search tokens typically expire in ~10 minutes, cache for 8 minutes
    this.searchTokenExpiry = Date.now() + 8 * 60 * 1000;

    console.error('[AUTH] Search token obtained successfully');
    return this.searchToken;
  }

  /**
   * Get SCIM API key (if configured)
   */
  getScimApiKey(): string {
    if (!this.config.scimApiKey) {
      throw new Error(
        'SCIM API key not configured. Please set scimApiKey in configuration.'
      );
    }
    return this.config.scimApiKey;
  }

  /**
   * Make an authenticated API request to Process Manager
   */
  async apiRequest(
    endpoint: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ): Promise<any> {
    console.error('[API] Getting site token...');
    const siteToken = await this.getSiteToken();
    const url = `${this.getSiteBaseUrl()}${endpoint}`;

    console.error(`[API] Making API request to: ${url}`);

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${siteToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] API request failed with status ${response.status}`);
      console.error(`[API] Error response: ${errorText}`);
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    console.error('[API] API request successful');
    return response.json();
  }

  /**
   * Make a search API request
   */
  async searchRequest(queryString: string): Promise<any> {
    console.error('[SEARCH] Getting search token...');
    const searchToken = await this.getSearchToken();
    const url = `${this.getSearchBaseUrl()}/fullsearch?${queryString}`;

    console.error(`[SEARCH] Making search request to: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${searchToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SEARCH] Search request failed with status ${response.status}`);
      console.error(`[SEARCH] Error response: ${errorText}`);
      throw new Error(
        `Search request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    console.error('[SEARCH] Search request successful');
    return response.json();
  }

  /**
   * Make a SCIM API request
   */
  async scimRequest(endpoint: string): Promise<any> {
    const scimKey = this.getScimApiKey();
    const url = `https://api.promapp.com/api/scim${endpoint}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${scimKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SCIM request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }
}
