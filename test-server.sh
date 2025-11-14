#!/bin/bash

# Test script for Process Manager MCP Server
# This script tests the MCP server by sending MCP protocol messages via stdio

echo "Testing Process Manager MCP Server..."
echo ""

# Set test environment variables (use dummy values for structure testing)
export PM_REGION="${PM_REGION:-au}"
export PM_SITE_NAME="${PM_SITE_NAME:-test}"
export PM_USERNAME="${PM_USERNAME:-test@example.com}"
export PM_PASSWORD="${PM_PASSWORD:-testpass}"

# Test 1: Check if server can list tools (this doesn't require API access)
echo "Test 1: Listing available tools..."
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js 2>&1 &
PID=$!

# Give it a moment to respond
sleep 2

# Kill the process
kill $PID 2>/dev/null

echo ""
echo "If you saw tool definitions above, the server structure is correct!"
echo ""
echo "To test with real Process Manager credentials, set these environment variables:"
echo "  export PM_REGION=au"
echo "  export PM_SITE_NAME=your-site-name"
echo "  export PM_USERNAME=your.email@example.com"
echo "  export PM_PASSWORD=your-password"
echo "  export PM_SCIM_API_KEY=your-scim-key  # Optional"
echo ""
echo "Then run: node dist/index.js"
