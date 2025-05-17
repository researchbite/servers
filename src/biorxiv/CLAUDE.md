# bioRxiv MCP Server - Development Guidelines

## Build, Test & Run Commands
- Build: `npm run build` - Compiles TypeScript to JavaScript
- Watch mode: `npm run watch` - Watches for changes and rebuilds automatically
- Run server: `npm run start` - Starts the MCP server using stdio transport
- Prepare release: `npm run prepare` - Builds the project for publishing

## bioRxiv API Notes
- Base URL: `https://api.biorxiv.org/`
- API endpoint documentation: https://api.biorxiv.org/
- No API key required
- Main endpoints used:
  - `/details/[doi]` - Get paper details by DOI
  - `/search/[term]/[cursor]` - Search papers by term with optional cursor
  
## Code Style Guidelines
- Use ES modules with `.js` extension in import paths
- Strictly type all functions and variables with TypeScript
- Follow zod schema patterns for tool input validation
- Prefer async/await over callbacks and Promise chains
- Handle API rate limits appropriately with retries and backoff
- Place all imports at top of file, grouped by external then internal
- Handle errors with try/catch blocks and provide clear error messages