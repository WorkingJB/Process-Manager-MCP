# API Examples

This directory contains example API requests and responses from Nintex Process Manager's internal APIs. These examples were used during development to understand the API structure and design the MCP server implementation.

## Files

### Authentication Examples

- **ExampleSiteAuthRequest** - OAuth2 password grant request for site authentication
- **ExampleSiteAuthResponse** - JWT bearer token response from site authentication
- **ExampleSearchAuthRequest** - Request to obtain search service token
- **ExampleSearchAuthResponse** - Search service JWT token response
- **ExampleSSOAuth.har** - HAR file capturing SSO authentication flow

### Search Examples

- **SearchRequestTypeInstructions** - Documentation of search parameters and entity types
- **ExampleSearchRequest** - Sample search API request with regional endpoint mapping
- **ExampleSearchResponse** - Sample search results showing process matches with highlights

### Process Examples

- **ExampleGetProcessRequest** - Request to retrieve process details by ID
- **ExampleGetProcessResponse** - Complete process structure including activities and tasks

### User Examples

- **ExampleGetUserRequest** - SCIM API request to look up user by email
- **ExampleGetUserResponse** - SCIM user resource response

## Usage

These examples are for reference only and are not required for using the MCP server. They document the actual API formats used by Process Manager's internal APIs.

**Note:** The example files contain sanitized/demo data and credentials that are not valid for production use.
