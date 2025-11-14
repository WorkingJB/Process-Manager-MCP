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
   */
  private getSiteBaseUrl(): string {
    const endpoints = REGIONAL_ENDPOINTS[this.config.region];
    return `${endpoints.siteUrl}/${this.config.siteName}`;
  }

  /**
   * Get the search base URL for the configured region
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
      return this.siteToken;
    }

    const url = `${this.getSiteBaseUrl()}/oauth2/token`;
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
      throw new Error(
        `Site authentication failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as SiteAuthResponse;
    this.siteToken = data.access_token;
    // Set expiry to 90% of actual expiry to avoid edge cases
    this.siteTokenExpiry = Date.now() + data.expires_in * 1000 * 0.9;

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
      return this.searchToken;
    }

    // Ensure we have a valid site token first
    const siteToken = await this.getSiteToken();

    const url = `${this.getSiteBaseUrl()}/search/GetSearchServiceToken`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${siteToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Search authentication failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as SearchAuthResponse;

    if (data.Status !== 'Success') {
      throw new Error(`Search authentication failed: ${data.Status}`);
    }

    this.searchToken = data.Message; // JWT token in Message field
    // Search tokens typically expire in ~10 minutes, cache for 8 minutes
    this.searchTokenExpiry = Date.now() + 8 * 60 * 1000;

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
    const siteToken = await this.getSiteToken();
    const url = `${this.getSiteBaseUrl()}${endpoint}`;

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
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Make a search API request
   */
  async searchRequest(queryString: string): Promise<any> {
    const searchToken = await this.getSearchToken();
    const url = `${this.getSearchBaseUrl()}/fullsearch?${queryString}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${searchToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Search request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

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
