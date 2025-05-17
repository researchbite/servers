#!/usr/bin/env node

// This is a simple example client that demonstrates using the bioRxiv MCP server
// It connects to a locally running server and performs a sample search

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Start the server process
const serverProcess = spawn('node', ['./dist/index.js'], { 
  stdio: ['pipe', 'pipe', 'inherit'] 
});

// Create readline interface for the server's stdout
const rl = createInterface({
  input: serverProcess.stdout,
  terminal: false
});

// Parse JSON-RPC messages
rl.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    console.log(`Received from server: ${JSON.stringify(message, null, 2)}`);

    // If we get the list of tools, then send a tool call request
    if (message.result?.tools && message.id === 1) {
      sendToolCallRequest();
    }
  } catch (error) {
    console.error('Error parsing JSON:', error);
  }
});

// Send a request to list available tools
function sendToolListRequest() {
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  serverProcess.stdin.write(JSON.stringify(request) + '\n');
}

// Send a sample tool call request to search for papers
function sendToolCallRequest() {
  const request = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'search_papers',
      arguments: {
        query: 'CRISPR',
        limit: 5
      }
    }
  };

  serverProcess.stdin.write(JSON.stringify(request) + '\n');
}

// Main function to run the example client
async function main() {
  console.log('Starting bioRxiv MCP server example client...');
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Send initial tools list request
  sendToolListRequest();
  
  // Gracefully exit after a few seconds
  setTimeout(() => {
    console.log('Example completed, shutting down...');
    serverProcess.kill();
    process.exit(0);
  }, 10000);
}

// Handle errors
serverProcess.on('error', (error) => {
  console.error('Server process error:', error);
  process.exit(1);
});

// Run the example
main().catch(error => {
  console.error('Error running example:', error);
  process.exit(1);
});