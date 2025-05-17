#!/usr/bin/env node
// @ts-nocheck
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs';
import path from 'path';

// Determine where SVG assets are stored (env or default to ./assets/svg)
const svgPath = process.env.BIO_SVG_PATH || path.resolve(process.cwd(), 'assets', 'svg');

// Ensure the assets directory exists
if (!fs.existsSync(svgPath)) {
  fs.mkdirSync(svgPath, { recursive: true });
  console.error(`SVG assets directory did not exist, created at ${svgPath}. Add your .svg files here.`);
}

// Load all SVG files into an in-memory map
const partsMap = new Map<string, string>();
for (const file of fs.readdirSync(svgPath)) {
  if (file.toLowerCase().endsWith('.svg')) {
    const id = path.basename(file, '.svg');
    try {
      const content = fs.readFileSync(path.join(svgPath, file), 'utf-8');
      partsMap.set(id, content);
    } catch (e) {
      console.error(`Error reading SVG file ${file}:`, e);
    }
  }
}

// Define MCP tools
const LIST_PARTS_TOOL: Tool = {
  name: "search_bio_parts",
  description: "List or search available bio part SVGs by ID.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Substring to filter part IDs (optional)." }
    },
    required: []
  }
};

const GET_PART_TOOL: Tool = {
  name: "get_bio_part_svg",
  description: "Retrieve the raw SVG content for a bio part by ID.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "ID of the bio part to retrieve." }
    },
    required: ["id"]
  }
};

// Add new tool to list all parts
const LIST_ALL_PARTS_TOOL: Tool = {
  name: "list_all_bio_parts",
  description: "List all available bio part SVG IDs.",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  }
};

// Initialize the MCP server
const server = new Server(
  { name: "bio-part-search", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// Advertise the tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [LIST_PARTS_TOOL, GET_PART_TOOL, LIST_ALL_PARTS_TOOL]
}));

// Handle tool invocations
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};
  if (name === LIST_PARTS_TOOL.name) {
    const q = (args.query as string || "").toLowerCase();
    const list = Array.from(partsMap.keys())
      .filter(id => id.toLowerCase().includes(q))
      .map(id => ({ id, name: id }));
    return { content: [{ type: "text", text: JSON.stringify(list) }] };
  } else if (name === LIST_ALL_PARTS_TOOL.name) {
    const list = Array.from(partsMap.keys()).map(id => ({ id, name: id }));
    return { content: [{ type: "text", text: JSON.stringify(list) }] };
  } else if (name === GET_PART_TOOL.name) {
    const id = args.id as string;
    if (!partsMap.has(id)) {
      return { content: [{ type: "text", text: `Error: part \"${id}\" not found.` }], isError: true };
    }
    const svg = partsMap.get(id)!;
    return { content: [{ type: "text", text: svg }] };
  } else {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
});

// Run the server over stdio
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bio-part-search server running on stdio");
}

runServer().catch(error => {
  console.error("Fatal error running bio-part-search server:", error);
  process.exit(1);
}); 