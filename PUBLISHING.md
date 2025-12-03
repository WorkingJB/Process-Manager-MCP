# Publishing Guide

This document explains how to publish the Process Manager MCP server to npm and other distribution channels.

## Prerequisites

Before publishing, ensure:

1. **You have an npm account**: Create one at [npmjs.com](https://www.npmjs.com/)
2. **You're logged in to npm**: Run `npm login`
3. **All tests pass**: Run `npm run build` successfully
4. **Version is updated**: Update version in `package.json` following [semantic versioning](https://semver.org/)

## Publishing to npm

### 1. Update Version

Update the version in `package.json`:

```json
{
  "version": "0.1.1"  // Increment based on changes
}
```

Version guidelines:
- **Patch** (0.1.1): Bug fixes, small improvements
- **Minor** (0.2.0): New features, backwards compatible
- **Major** (1.0.0): Breaking changes

### 2. Test the Package

```bash
# Build the project
npm run build

# Preview what will be published
npm pack --dry-run

# Install and test locally
npm pack
npm install -g ./process-manager-mcp-0.1.0.tgz
```

### 3. Publish to npm

```bash
# For first-time publish (public package)
npm publish --access public

# For updates
npm publish
```

### 4. Verify Publication

Visit your package page:
```
https://www.npmjs.com/package/process-manager-mcp
```

## Publishing to GitHub Releases

### 1. Tag the Release

```bash
# Create and push a tag
git tag v0.1.0
git push origin v0.1.0
```

### 2. Create GitHub Release

1. Go to your repository on GitHub
2. Click "Releases" → "Create a new release"
3. Select your tag (v0.1.0)
4. Add release notes (see template below)
5. Attach the tarball from `npm pack` if desired
6. Click "Publish release"

### Release Notes Template

```markdown
## What's New in v0.1.0

### Features
- ✨ All tools now return structured JSON alongside formatted text
- 📝 Improved tool descriptions with concrete examples
- 🔍 Better agent understanding and programmatic access

### Improvements
- Enhanced search_processes with example queries
- Enhanced search_documents with example queries
- Enhanced search_all with example queries
- Enhanced get_process with structured data
- Enhanced lookup_user with structured data

### Documentation
- Added comprehensive examples to all tool descriptions
- Updated README with latest features

### Package
- Ready for npm distribution
- Added .npmignore for clean packages
- Added LICENSE file (MIT)
- Enhanced package.json metadata

## Installation

\`\`\`bash
npm install -g process-manager-mcp
\`\`\`

## Full Changelog
See [CHANGELOG.md](CHANGELOG.md) for complete details.
```

## Submitting to MCP Servers Repository

To get listed in the official MCP servers directory:

### 1. Prepare Your Submission

Ensure you have:
- ✅ High-quality README with clear examples
- ✅ Proper error handling
- ✅ Environment variable configuration
- ✅ MIT or similar permissive license
- ✅ Published to npm

### 2. Fork and Submit PR

1. Fork [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
2. Add your server to the appropriate category in `README.md`
3. Create a pull request with:
   - Server name and description
   - Link to npm package
   - Link to GitHub repository
   - Brief feature list

### Example Entry

```markdown
### [Process Manager MCP](https://github.com/WorkingJB/Process-Manager-MCP)

MCP server for Nintex Process Manager - enables AI applications to search processes, retrieve process details, and access organizational process data.

- Search across processes, documents, and all content types
- Retrieve detailed process information with activities and tasks
- Get organizational hierarchy and group structure
- User lookup via SCIM API
- Multi-region support (US, CA, EU, AU, AE, Demo)

`npm install -g process-manager-mcp`
```

## Docker Hub (Optional)

If you create a Docker image:

### 1. Create Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

### 2. Build and Push

```bash
docker build -t yourusername/process-manager-mcp:0.1.0 .
docker push yourusername/process-manager-mcp:0.1.0
docker tag yourusername/process-manager-mcp:0.1.0 yourusername/process-manager-mcp:latest
docker push yourusername/process-manager-mcp:latest
```

## Post-Publication Checklist

After publishing:

- [ ] Update README with npm installation instructions
- [ ] Create GitHub release with notes
- [ ] Announce on relevant channels (if applicable)
- [ ] Monitor issues and respond to feedback
- [ ] Plan next version based on user needs

## Versioning Strategy

Follow this versioning approach:

- **0.x.x**: Pre-1.0 development (current)
- **1.0.0**: First stable release with all Phase 1 features complete
- **1.x.x**: Minor updates, new tools, improvements
- **2.0.0**: Breaking changes (if needed)

## Troubleshooting

### "You do not have permission to publish"

- Make sure you're logged in: `npm whoami`
- Package name might be taken: try a different name in package.json

### "Package name too similar to existing package"

- Choose a more specific name, e.g., `@yourorg/process-manager-mcp`

### Build failures

- Run `npm run build` locally first
- Check TypeScript errors
- Ensure all dependencies are in package.json

## Support

For questions about publishing:
- npm: https://docs.npmjs.com/
- GitHub Releases: https://docs.github.com/en/repositories/releasing-projects-on-github
- MCP Servers: https://github.com/modelcontextprotocol/servers
