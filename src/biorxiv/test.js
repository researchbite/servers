#!/usr/bin/env node

// Test script for the bioRxiv MCP server

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

// Keep track of request IDs and test cases
let currentTest = 1;
const totalTests = 3;
let testIds = {
  1: null, // search papers
  2: null, // get paper details
  3: null  // get categories
};

// Parse JSON-RPC messages
rl.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    
    // Handle initial connection message
    if (message.method === 'session/initialized') {
      console.log('✅ Server initialized');
      runTests();
      return;
    }
    
    // Handle test responses
    if (message.result && Object.values(testIds).includes(message.id)) {
      const testNumber = Object.keys(testIds).find(key => testIds[key] === message.id);
      
      if (testNumber === '1') {
        console.log('✅ Test 1: search_papers - Success');
        if (message.result.content && message.result.content.length > 0) {
          console.log(`Found ${message.result.content[0].text.split('\n')[1]}`);
        }
      } else if (testNumber === '2') {
        console.log('✅ Test 2: get_paper_details - Success');
        if (message.result.content && message.result.content.length > 0) {
          const title = message.result.content[0].text.split('\n')[0];
          console.log(`Paper title: ${title}`);
        }
      } else if (testNumber === '3') {
        console.log('✅ Test 3: get_categories - Success');
        console.log('Retrieved all bioRxiv categories');
      }
      
      // Move to the next test or exit
      currentTest++;
      if (currentTest <= totalTests) {
        runTests();
      } else {
        console.log('\n🎉 All tests passed successfully!');
        setTimeout(() => {
          serverProcess.kill();
          process.exit(0);
        }, 500);
      }
    }
    
    // Handle errors
    if (message.error) {
      console.error(`❌ Test ${currentTest} failed: ${message.error.message}`);
      currentTest++;
      if (currentTest <= totalTests) {
        runTests();
      } else {
        serverProcess.kill();
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Error parsing JSON:', error);
  }
});

// Run the current test
function runTests() {
  switch (currentTest) {
    case 1:
      console.log('\n🔍 Running Test 1: search_papers - Search for CRISPR papers');
      testIds[1] = sendToolCallRequest('search_papers', {
        query: 'CRISPR',
        limit: 3
      });
      break;
    case 2:
      console.log('\n🔍 Running Test 2: get_paper_details - Get details for a paper');
      testIds[2] = sendToolCallRequest('get_paper_details', {
        doi: '10.1101/2020.01.30.927871'
      });
      break;
    case 3:
      console.log('\n🔍 Running Test 3: get_categories - Get bioRxiv categories');
      testIds[3] = sendToolCallRequest('get_categories', {});
      break;
  }
}

// Send a tool call request
function sendToolCallRequest(toolName, args) {
  const requestId = Date.now();
  const request = {
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  };

  serverProcess.stdin.write(JSON.stringify(request) + '\n');
  return requestId;
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Test interrupted');
  serverProcess.kill();
  process.exit(1);
});

// Handle server process errors
serverProcess.on('error', (error) => {
  console.error('Server process error:', error);
  process.exit(1);
});