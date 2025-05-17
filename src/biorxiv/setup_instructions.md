# Setting up the bioRxiv MCP Server

This document provides instructions for setting up and using the bioRxiv MCP server with Claude Desktop.

## Installation

You can install the bioRxiv MCP server using npm:

```bash
npm install -g @modelcontextprotocol/server-biorxiv
```

## Configuration

### Claude Desktop Configuration

To use the bioRxiv MCP server with Claude Desktop, add the following to your `claude_desktop_config.json`:

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

### VS Code Configuration

For VS Code users, add the following to your User Settings (JSON):

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

The bioRxiv MCP server provides the following tools:

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
   - Returns a list of categories that can be used in search queries for more targeted results

## Example Usage

Here are some examples of how to use the bioRxiv MCP server in Claude Desktop:

### Searching for Papers

```
Can you search bioRxiv for recent papers on COVID-19 vaccines published in 2023?
```

### Getting Paper Details

```
Can you give me details on this bioRxiv paper with DOI: 10.1101/2020.01.30.927871?
```

### Searching with Date Range

```
Find me papers on CRISPR gene editing published on bioRxiv between 2022-01-01 and 2022-12-31.
```

### Listing Available Categories

```
What categories are available on bioRxiv?
```

### Searching Within a Specific Category

```
Find me recent neuroscience papers on bioRxiv that discuss brain-computer interfaces.
```

### Advanced Search with Multiple Filters

```
Search bioRxiv for papers about CRISPR in cancer biology published in the last year, limit to 10 results.
```

## Pagination

For large result sets, the server supports pagination. When searching, use the returned cursor to fetch the next page of results:

```
Show me the next page of results for the COVID-19 vaccine papers using the cursor.
```