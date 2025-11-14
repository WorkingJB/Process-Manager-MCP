#!/usr/bin/env node
/**
 * Simple MCP client test
 * Connects to the MCP server via stdio and tests tool listing
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const serverPath = join(__dirname, '..', 'dist', 'index.js');
const env = {
  ...process.env,
  PM_REGION: process.env.PM_REGION || 'au',
  PM_SITE_NAME: process.env.PM_SITE_NAME || 'test',
  PM_USERNAME: process.env.PM_USERNAME || 'test@test.com',
  PM_PASSWORD: process.env.PM_PASSWORD || 'test',
};

console.log('Starting MCP Server test...\n');

// Start the server
const server = spawn('node', [serverPath], {
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let responseData = '';
let initReceived = false;

server.stdout.on('data', (data) => {
  responseData += data.toString();

  // Look for JSON responses
  const lines = responseData.split('\n');
  lines.forEach(line => {
    if (line.trim().startsWith('{')) {
      try {
        const response = JSON.parse(line);
        if (response.result && response.result.serverInfo) {
          console.log('✓ Server initialized');
          console.log(`  Name: ${response.result.serverInfo.name}`);
          console.log(`  Version: ${response.result.serverInfo.version}\n`);
          initReceived = true;

          // Request tools list
          setTimeout(() => {
            console.log('Requesting tools list...');
            server.stdin.write(JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/list',
              params: {}
            }) + '\n');
          }, 100);
        } else if (response.result && response.result.tools) {
          console.log('✓ Tools list received\n');
          console.log(`Found ${response.result.tools.length} tools:\n`);
          response.result.tools.forEach((tool, index) => {
            console.log(`${index + 1}. ${tool.name}`);
            console.log(`   ${tool.description}\n`);
          });

          console.log('✓ All tests passed!\n');
          console.log('Server is ready to use with real credentials.');
          server.kill();
          process.exit(0);
        }
      } catch (e) {
        // Not JSON, ignore
      }
    }
  });
});

server.stderr.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('running on stdio')) {
    console.log('✓ Server started\n');

    // Send initialize request
    console.log('Sending initialize request...');
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    }) + '\n');
  }
});

server.on('error', (error) => {
  console.error('✗ Server error:', error.message);
  process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('✗ Test timeout');
  server.kill();
  process.exit(1);
}, 10000);
