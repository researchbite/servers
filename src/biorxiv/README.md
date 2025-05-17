# bioRxiv MCP Server

This MCP server allows searching for papers on bioRxiv using the bioRxiv API. It provides tools to search for papers by keywords, authors, and other criteria, and to retrieve paper details.

## Features

- Search bioRxiv papers by keywords, title, authors, and date ranges
- Retrieve detailed paper information including abstract, DOI, and links
- Support for pagination of search results
- No API key required

## Installation

### From npm
```bash
npm install -g @modelcontextprotocol/server-biorxiv
```

### From source
```bash
cd src/biorxiv
npm install
npm run build
```

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "biorxiv": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-biorxiv"
      ]
    }
  }
}
```

## Usage with VS Code

Add the following to your User Settings (JSON) file in VS Code:

```json
{
  "mcp": {
    "servers": {
      "biorxiv": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-biorxiv"]
      }
    }
  }
}
```

## Available Tools

The server provides the following tools:

1. `search_papers` - Search for papers on bioRxiv by keywords, date range, etc.
   - Parameters:
     - `query`: Search term (e.g., "CRISPR", "machine learning")
     - `from_date`: Optional. Start date in YYYY-MM-DD format
     - `to_date`: Optional. End date in YYYY-MM-DD format
     - `limit`: Optional. Maximum number of results (1-100)
     - `cursor`: Optional. Cursor for pagination from previous search results

2. `get_paper_details` - Get detailed information about a specific paper by DOI
   - Parameters:
     - `doi`: DOI of the paper (e.g., "10.1101/2023.01.01.12345")

3. `get_categories` - List all available subject categories on bioRxiv
   - No parameters required
   - Returns a list of categories that can be used in search queries

## Running from source

```bash
cd src/biorxiv
npm install
npm run build
npm run start
```

## Running as an installed package

```bash
npx @modelcontextprotocol/server-biorxiv
```

## Example Usage

See `setup_instructions.md` and `example_client.js` for detailed examples of how to use the bioRxiv MCP server.