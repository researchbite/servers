#!/usr/bin/env node

import { createServer } from './biorxiv.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const { server, cleanup } = createServer();

// Handle graceful shutdown
const handleShutdown = async () => {
  await cleanup();
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("bioRxiv MCP Server running on stdio");
}

runServer().catch((err) => {
  console.error('Error running server:', err);
  process.exit(1);
});