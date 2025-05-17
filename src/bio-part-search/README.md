# Bio Part Search MCP Server

A Model Context Protocol (MCP) server that indexes a local library of bio part SVGs and provides simple tools to search and retrieve raw SVG assets by ID. This service can be used to power downstream bio-gram composition in LLM-driven applications.

## Tools

1. **search_bio_parts**
   - Description: List or search available bio part SVGs by ID.
   - Input:
     - `query` (string, optional): Substring to filter part IDs.
   - Returns: JSON array of objects:
     ```jsonc
     [
       { "id": "promoter", "name": "promoter" },
       { "id": "terminator", "name": "terminator" }
     ]
     ```

2. **get_bio_part_svg**
   - Description: Retrieve the raw SVG content for a bio part by ID.
   - Input:
     - `id` (string, required): The ID of the bio part to retrieve.
   - Returns: Raw SVG text (with `Content-Type: image/svg+xml`).

3. **list_all_bio_parts**
   - Description: List all available bio part SVG IDs without filtering.
   - Input: none
   - Returns: JSON array of objects:
     ```jsonc
     [
       { "id": "promoter", "name": "promoter" },
       { "id": "terminator", "name": "terminator" },
       { "id": "blookcell", "name": "blookcell" }
     ]
     ```

## Configuration

By default, the server loads SVG assets from the `assets/svg` directory. You can override this location via the `BIO_SVG_PATH` environment variable.

## Usage with Claude Desktop

To configure this MCP server in your `claude_desktop_config.json`, add an entry under `mcpServers`.

### Docker

```json
{
  "mcpServers": {
    "bio-part-search": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "/absolute/path/to/assets/svg:/app/assets/svg",
        "mcp/bio-part-search"
      ]
    }
  }
}
```

Mount your local SVG folder at `/app/assets/svg` inside the container.

### NPX

```json
{
  "mcpServers": {
    "bio-part-search": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-bio-part-search"
      ],
      "env": {
        "BIO_SVG_PATH": "/absolute/path/to/assets/svg"
      }
    }
  }
}
```

## Usage with VS Code

Add a `.vscode/mcp.json` to your workspace folder:

```json
{
  "mcp": {
    "servers": {
      "bio-part-search": {
        "command": "npx",
        "args": [
          "-y",
          "@modelcontextprotocol/server-bio-part-search"
        ],
        "env": {
          "BIO_SVG_PATH": "${workspaceFolder}/src/bio-part-search/assets/svg"
        }
      }
    }
  }
}
```

Or with Docker:

```json
{
  "mcp": {
    "servers": {
      "bio-part-search": {
        "command": "docker",
        "args": [
          "run",
          "-i",
          "--rm",
          "-v",
          "${workspaceFolder}/src/bio-part-search/assets/svg:/app/assets/svg",
          "mcp/bio-part-search"
        ]
      }
    }
  }
}
```

## Development & Local Testing

```bash
cd src/bio-part-search
npm install
npm run build
mcp-server-bio-part-search
```

Place your `.svg` files in `src/bio-part-search/assets/svg`. They must be named `<id>.svg` (for example `promoter.svg`).

## License

MIT 