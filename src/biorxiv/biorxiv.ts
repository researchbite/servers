import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ToolSchema,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import axios from "axios";

// Base URL for bioRxiv API
const BIORXIV_API_BASE_URL = "https://api.biorxiv.org";

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

// Define search schema
const SearchPapersSchema = z.object({
  query: z.string().describe("Search query string (e.g., 'CRISPR', 'machine learning')"),
  from_date: z
    .string()
    .optional()
    .describe("Start date in YYYY-MM-DD format (e.g., '2023-01-01')"),
  to_date: z
    .string()
    .optional()
    .describe("End date in YYYY-MM-DD format (e.g., '2023-12-31')"),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(25)
    .describe("Maximum number of results to return (1-100)"),
  cursor: z
    .string()
    .optional()
    .describe("Cursor for pagination from previous search results"),
});

// Define get paper details schema
const GetPaperDetailsSchema = z.object({
  doi: z
    .string()
    .describe("DOI of the paper (e.g., '10.1101/2023.01.01.12345')"),
});

// Define a schema for getting category information
const GetCategoriesSchema = z.object({});

// Enum for tool names
enum ToolName {
  SEARCH_PAPERS = "search_papers",
  GET_PAPER_DETAILS = "get_paper_details",
  GET_CATEGORIES = "get_categories",
}

// Define bioRxiv categories and their descriptions
const BIORXIV_CATEGORIES = [
  { name: "animal_behavior_and_cognition", description: "Animal Behavior and Cognition" },
  { name: "biochemistry", description: "Biochemistry" },
  { name: "bioengineering", description: "Bioengineering" },
  { name: "bioinformatics", description: "Bioinformatics" },
  { name: "biophysics", description: "Biophysics" },
  { name: "cancer_biology", description: "Cancer Biology" },
  { name: "cell_biology", description: "Cell Biology" },
  { name: "clinical_trials", description: "Clinical Trials" },
  { name: "developmental_biology", description: "Developmental Biology" },
  { name: "ecology", description: "Ecology" },
  { name: "epidemiology", description: "Epidemiology" },
  { name: "evolutionary_biology", description: "Evolutionary Biology" },
  { name: "genetics", description: "Genetics" },
  { name: "genomics", description: "Genomics" },
  { name: "immunology", description: "Immunology" },
  { name: "microbiology", description: "Microbiology" },
  { name: "molecular_biology", description: "Molecular Biology" },
  { name: "neuroscience", description: "Neuroscience" },
  { name: "paleontology", description: "Paleontology" },
  { name: "pathology", description: "Pathology" },
  { name: "pharmacology_and_toxicology", description: "Pharmacology and Toxicology" },
  { name: "physiology", description: "Physiology" },
  { name: "plant_biology", description: "Plant Biology" },
  { name: "scientific_communication_and_education", description: "Scientific Communication and Education" },
  { name: "synthetic_biology", description: "Synthetic Biology" },
  { name: "systems_biology", description: "Systems Biology" },
  { name: "zoology", description: "Zoology" }
];

// BioRxiv API client class
class BioRxivApiClient {
  private retryDelay = 1000; // Initial retry delay in ms
  private maxRetries = 3;
  
  /**
   * Make an API request with retry logic
   */
  private async makeApiRequest(url: string, params?: Record<string, string | number>): Promise<any> {
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < this.maxRetries) {
      try {
        const response = await axios.get(url, { params });
        
        // Check for error messages in the response
        if (response.data && response.data.messages && response.data.messages[0]?.status === "error") {
          throw new Error(response.data.messages[0].text || "API returned an error");
        }
        
        return response.data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (axios.isAxiosError(error)) {
          // If we get rate limited (429) or server error (5xx), retry
          if (error.response && (error.response.status === 429 || error.response.status >= 500)) {
            console.error(`API request failed with status ${error.response.status}, retrying in ${this.retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            retries++;
            this.retryDelay *= 2; // Exponential backoff
            continue;
          }
        }
        
        // For any other error, throw immediately
        throw lastError;
      }
    }
    
    // If we've exhausted retries, throw the last error
    throw lastError || new Error("Max retries exceeded");
  }

  // Helper function to get current date in YYYY-MM-DD format
  private getCurrentDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  }
  
  // Helper function to get date from 5 years ago in YYYY-MM-DD format
  private getDateFiveYearsAgo(): string {
    const today = new Date();
    const fiveYearsAgo = new Date(today);
    fiveYearsAgo.setFullYear(today.getFullYear() - 5);
    return fiveYearsAgo.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  }

  // Search papers in bioRxiv
  async searchPapers(
    query: string,
    fromDate?: string,
    toDate?: string,
    limit: number = 25,
    cursor?: string
  ): Promise<any> {
    try {
      // Validate parameters
      if (!query.trim()) {
        throw new Error("Search query cannot be empty");
      }
      
      // Validate date format
      if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
        throw new Error("Invalid from_date format. Use YYYY-MM-DD");
      }
      
      if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
        throw new Error("Invalid to_date format. Use YYYY-MM-DD");
      }

      // If dates aren't provided, use reasonable defaults (last 5 years)
      const defaultFromDate = fromDate || this.getDateFiveYearsAgo();
      const defaultToDate = toDate || this.getCurrentDate();
      
      // For keyword search, we need to use the details endpoint with a date range
      const cursorValue = cursor || "0";
      
      // Check if query is a specific bioRxiv/medRxiv category
      // First, normalize to lowercase and check
      const queryLower = query.toLowerCase();
      const matchedCategory = BIORXIV_CATEGORIES.find(cat => 
        cat.description.toLowerCase() === queryLower || 
        cat.name.toLowerCase() === queryLower ||
        queryLower.includes(cat.description.toLowerCase())
      );
      
      // Format the request URL and parameters based on the search type
      let endpoint = '';
      let params: Record<string, string | number> = {};
      
      // Add cursor parameter if provided (should be separate from category)
      if (cursor) {
        params.cursor = cursor;
      }
      
      if (matchedCategory) {
        // For category searches, use the format: /details/biorxiv/from_date/to_date/0?category=category_name
        console.error(`Query "${query}" matches category "${matchedCategory.description}". Using category parameter.`);
        endpoint = `/details/biorxiv/${defaultFromDate}/${defaultToDate}/0`;
        params.category = matchedCategory.name.replace(/ /g, '_'); // Format category with underscores
      } else if (queryLower.includes('cardio') || 
                queryLower.includes('heart') || 
                queryLower.includes('medical') || 
                queryLower.includes('medicine')) {
        // For medical searches, check medRxiv which has more medical papers
        // Try medRxiv with category for medical/cardiovascular content
        if (queryLower.includes('cardiovascular') || queryLower.includes('cardio')) {
          console.error(`Medical topic detected. Searching in medRxiv with cardiovascular medicine category`);
          endpoint = `/details/medrxiv/${defaultFromDate}/${defaultToDate}/0`;
          params.category = 'cardiovascular_medicine';
        } else {
          // Search in medRxiv for general medical topics, use query as category
          console.error(`Medical topic detected. Searching in medRxiv with query as category`);
          endpoint = `/details/medrxiv/${defaultFromDate}/${defaultToDate}/0`;
          params.category = query.replace(/ /g, '_');
        }
      } else {
        // For general keyword searches, use the query directly as the category
        console.error(`Using query "${query}" as category parameter`);
        endpoint = `/details/biorxiv/${defaultFromDate}/${defaultToDate}/0`;
        params.category = query.replace(/ /g, '_');
      }
      
      // Add limit parameter if provided
      if (limit) params.limit = limit;
      
      // Make the API request to get papers within the date range
      const response = await this.makeApiRequest(`${BIORXIV_API_BASE_URL}${endpoint}`, params);
      
      // Special case: If query looks like a DOI, try to get that specific paper
      if (query.includes("10.1101/")) {
        const doi = query.trim();
        // Try to get the specific paper by DOI
        try {
          console.error(`Query appears to be a DOI. Trying direct lookup for: ${doi}`);
          const doiResponse = await this.getPaperDetails(doi);
          if (doiResponse && doiResponse.collection && doiResponse.collection.length > 0) {
            return doiResponse;
          }
        } catch (error) {
          // If DOI lookup fails, fall back to standard search
          console.error(`Failed DOI lookup, falling back to standard search: ${error}`);
        }
      }
      
      // Note: There is no direct search endpoint in the bioRxiv API
      // We'll rely on fetching by date range and filtering the results
        
      // Filter the results from the details endpoint to match the search term (case-insensitive)
      if (response && response.collection && Array.isArray(response.collection)) {
        console.error(`Got ${response.collection.length} papers from API, filtering for "${query}"...`);
        
        // Break query into words for more flexible matching
        const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        console.error(`Query broken into words: ${queryWords.join(', ')}`);
        
        // Score-based filtering approach
        const scoredPapers = response.collection.map((paper: any) => {
          let score = 0;
          const title = (paper.title || "").toLowerCase();
          const abstract = (paper.abstract || "").toLowerCase();
          const authors = (paper.authors || "").toLowerCase();
          const category = (paper.category || "").toLowerCase();
          const doi = (paper.doi || "").toLowerCase();
          const authorCorresponding = (paper.author_corresponding || "").toLowerCase();
          const institution = (paper.author_corresponding_institution || "").toLowerCase();
          
          // Exact phrase match (highest priority)
          const queryLower = query.toLowerCase();
          if (title.includes(queryLower)) score += 100;
          if (abstract.includes(queryLower)) score += 50;
          if (authors.includes(queryLower)) score += 30;
          if (category.includes(queryLower)) score += 40;
          if (doi.includes(queryLower)) score += 25;
          if (authorCorresponding.includes(queryLower)) score += 20;
          if (institution.includes(queryLower)) score += 15;
          
          // Individual word matches (lower priority but more flexible)
          for (const word of queryWords) {
            if (title.includes(word)) score += 10;
            if (abstract.includes(word)) score += 5;
            if (authors.includes(word)) score += 3;
            if (category.includes(word)) score += 4;
            if (authorCorresponding.includes(word)) score += 2;
            if (institution.includes(word)) score += 1.5;
          }
          
          return { paper, score };
        });
        
        // Sort by score and filter out non-matching papers
        const sortedPapers = scoredPapers
          .filter((item: { paper: any; score: number }) => item.score > 0)
          .sort((a: { score: number }, b: { score: number }) => b.score - a.score);
          
        console.error(`Found ${sortedPapers.length} matching papers after filtering`);
        
        // Extract just the papers from the scored results
        const filteredCollection = sortedPapers.map((item: { paper: any }) => item.paper);
        
        // Check if we have any results
        if (filteredCollection.length === 0) {
          console.error("No results found in initial search. Trying broader search strategies...");
          
          // Try bioRxiv with full date range
          console.error("Strategy 1: Checking bioRxiv with full date range from 2013");
          const broadParams = { ...params, category: query.replace(/ /g, '_') };
          const bioRxivBroadResponse = await this.makeApiRequest(
            `${BIORXIV_API_BASE_URL}/details/biorxiv/2013-01-01/${this.getCurrentDate()}/0`, 
            broadParams
          );
          
          // Try medRxiv in case it's a medical term
          console.error("Strategy 2: Checking medRxiv for medical papers");
          const medRxivResponse = await this.makeApiRequest(
            `${BIORXIV_API_BASE_URL}/details/medrxiv/${this.getDateFiveYearsAgo()}/${this.getCurrentDate()}/0`, 
            { category: query.replace(/ /g, '_') }
          );
          
          // Combine results from both sources
          const combinedResponse = {
            ...bioRxivBroadResponse,
            collection: [
              ...(bioRxivBroadResponse.collection || []),
              ...(medRxivResponse.collection || [])
            ]
          };
          
          if (combinedResponse.collection && combinedResponse.collection.length > 0) {
            console.error(`Searching through ${combinedResponse.collection.length} papers from combined sources`);
            
            // Use the same scoring system as above for consistency
            const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
            
            const scoredPapers = combinedResponse.collection.map((paper: any) => {
              let score = 0;
              const title = (paper.title || "").toLowerCase();
              const abstract = (paper.abstract || "").toLowerCase();
              const authors = (paper.authors || "").toLowerCase();
              const category = (paper.category || "").toLowerCase();
              const doi = (paper.doi || "").toLowerCase();
              const authorCorresponding = (paper.author_corresponding || "").toLowerCase();
              const institution = (paper.author_corresponding_institution || "").toLowerCase();
              
              // Exact phrase match (highest priority)
              const queryLower = query.toLowerCase();
              if (title.includes(queryLower)) score += 100;
              if (abstract.includes(queryLower)) score += 50;
              if (authors.includes(queryLower)) score += 30;
              if (category.includes(queryLower)) score += 40;
              if (doi.includes(queryLower)) score += 25;
              if (authorCorresponding.includes(queryLower)) score += 20;
              if (institution.includes(queryLower)) score += 15;
              
              // Individual word matches (lower priority but more flexible)
              for (const word of queryWords) {
                if (title.includes(word)) score += 10;
                if (abstract.includes(word)) score += 5;
                if (authors.includes(word)) score += 3;
                if (category.includes(word)) score += 4;
                if (authorCorresponding.includes(word)) score += 2;
                if (institution.includes(word)) score += 1.5;
              }
              
              return { paper, score };
            });
            
            // Sort by score and filter out non-matching papers
            const sortedPapers = scoredPapers
              .filter((item: { paper: any; score: number }) => item.score > 0)
              .sort((a: { score: number }, b: { score: number }) => b.score - a.score);
            
            const broadFilteredCollection = sortedPapers.map((item: { paper: any }) => item.paper);
            
            console.error(`Found ${broadFilteredCollection.length} papers in broader search strategy`);
            
            if (broadFilteredCollection.length > 0) {
              return {
                ...bioRxivBroadResponse,
                collection: broadFilteredCollection,
                messages: [
                  {
                    status: "ok",
                    total: broadFilteredCollection.length,
                    cursor: cursorValue
                  }
                ]
              };
            }
          }
        }
        
        // Return the filtered results
        return {
          ...response,
          collection: filteredCollection,
          messages: [
            {
              ...response.messages[0],
              total: filteredCollection.length,
              cursor: cursorValue
            }
          ]
        };
      }
      
      return response;
    } catch (error) {
      console.error("Error searching bioRxiv papers:", error);
      throw new Error(`Error searching bioRxiv papers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Get details of a specific paper by DOI
  async getPaperDetails(doi: string): Promise<any> {
    try {
      // Validate DOI format
      if (!doi.trim() || !doi.includes("/")) {
        throw new Error("Invalid DOI format. Expected format: 10.1101/XXXXXXX");
      }
      
      // Make the API request using the correct format from the docs
      // /details/[server]/[DOI]/na/[format]
      return await this.makeApiRequest(`${BIORXIV_API_BASE_URL}/details/biorxiv/${encodeURIComponent(doi)}/na/json`);
    } catch (error) {
      console.error("Error fetching paper details:", error);
      throw new Error(`Error fetching paper details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const createServer = () => {
  const server = new Server(
    {
      name: "mcp-biorxiv",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const bioRxivClient = new BioRxivApiClient();

  // Handler for listing available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: ToolName.SEARCH_PAPERS,
        description: "Search for papers on bioRxiv by keywords, date range, and other criteria",
        inputSchema: zodToJsonSchema(SearchPapersSchema) as ToolInput,
      },
      {
        name: ToolName.GET_PAPER_DETAILS,
        description: "Get detailed information about a specific paper by DOI",
        inputSchema: zodToJsonSchema(GetPaperDetailsSchema) as ToolInput,
      },
      {
        name: ToolName.GET_CATEGORIES,
        description: "List all available categories on bioRxiv for more targeted searches",
        inputSchema: zodToJsonSchema(GetCategoriesSchema) as ToolInput,
      },
    ];

    return { tools };
  });

  // Handler for tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === ToolName.GET_CATEGORIES) {
      try {
        GetCategoriesSchema.parse(args);
        
        let resultText = "# bioRxiv Categories\n\n";
        resultText += "Use these categories in your search queries for more targeted results.\n\n";
        
        // Group categories alphabetically for better readability
        BIORXIV_CATEGORIES.sort((a, b) => a.description.localeCompare(b.description));
        
        resultText += "## Available Categories\n\n";
        
        BIORXIV_CATEGORIES.forEach(category => {
          resultText += `- **${category.description}** (${category.name})\n`;
        });
        
        resultText += "\n## Usage Examples\n\n";
        resultText += "You can use these categories in your searches with the `search_papers` tool by including them in your query string.\n\n";
        resultText += "Examples:\n";
        resultText += "- `CRISPR neuroscience` - Search for CRISPR papers in neuroscience\n";
        resultText += "- `machine learning bioinformatics` - Search for machine learning papers in bioinformatics\n";
        resultText += "- `COVID-19 immunology` - Search for COVID-19 papers in immunology\n";
        
        return {
          content: [{ type: "text", text: resultText }],
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error retrieving categories: ${error instanceof Error ? error.message : String(error)}` 
          }],
        };
      }
    }
    
    if (name === ToolName.SEARCH_PAPERS) {
      const validatedArgs = SearchPapersSchema.parse(args);
      const { query, from_date, to_date, limit, cursor } = validatedArgs;

      try {
        const data = await bioRxivClient.searchPapers(
          query,
          from_date,
          to_date,
          limit,
          cursor
        );

        // Format the response
        let resultText = "";
        
        if (data.collection && data.collection.length > 0) {
          const totalResults = data.messages[0].total || data.collection.length;
          resultText = `# Search Results for "${query}"\n\n`;
          resultText += `Found ${totalResults} results.\n\n`;
          
          // Add pagination info if available
          if (data.messages && data.messages.length > 0) {
            const nextCursor = data.messages[0].cursor;
            const currentStart = parseInt(nextCursor) - data.collection.length + 1;
            const currentEnd = nextCursor;
            
            if (nextCursor && parseInt(nextCursor) < totalResults) {
              resultText += `Showing results ${currentStart} to ${currentEnd} of ${totalResults}.\n`;
              resultText += `For more results, use cursor: "${nextCursor}"\n\n`;
            }
          }
          
          // Format each paper
          data.collection.forEach((paper: any, index: number) => {
            const number = index + 1;
            const cleanedTitle = paper.title.replace(/^\s*"|"\s*$/g, '').trim(); // Remove surrounding quotes
            
            resultText += `## ${number}. ${cleanedTitle}\n\n`;
            resultText += `**Authors:** ${paper.authors}\n\n`;
            resultText += `**DOI:** ${paper.doi}\n`;
            resultText += `**URL:** https://doi.org/${paper.doi}\n`;
            resultText += `**Posted:** ${paper.date}\n`;
            
            if (paper.category) {
              resultText += `**Category:** ${paper.category}\n`;
            }
            
            if (paper.type) {
              resultText += `**Type:** ${paper.type}\n`;
            }
            
            if (paper.abstract && paper.abstract.length > 0) {
              const shortAbstract = paper.abstract.substring(0, 200);
              resultText += `\n**Abstract Preview:** ${shortAbstract}${paper.abstract.length > 200 ? '...' : ''}\n`;
            }
            
            resultText += `\nTo view full details, use \`get_paper_details\` with DOI: ${paper.doi}\n\n`;
            
            // Add separator between papers
            if (index < data.collection.length - 1) {
              resultText += `---\n\n`;
            }
          });
        } else {
          resultText = `No results found for "${query}".\n\n`;
          resultText += `Suggestions:\n`;
          resultText += `- Try using more general keywords\n`;
          resultText += `- Check the spelling of your search terms\n`;
          resultText += `- Try removing filters like date ranges\n`;
        }

        return {
          content: [{ type: "text", text: resultText }],
        };
      } catch (error) {
        let errorMessage = "Error searching bioRxiv papers";
        if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
        }
        
        return {
          content: [{ type: "text", text: errorMessage }],
        };
      }
    }

    if (name === ToolName.GET_PAPER_DETAILS) {
      const validatedArgs = GetPaperDetailsSchema.parse(args);
      const { doi } = validatedArgs;

      try {
        const data = await bioRxivClient.getPaperDetails(doi);

        // Format the response
        let resultText = "";
        
        if (data.collection && data.collection.length > 0) {
          const paper = data.collection[0];
          const cleanedTitle = paper.title.replace(/^\s*"|"\s*$/g, '').trim(); // Remove surrounding quotes
          
          // Main title
          resultText = `# ${cleanedTitle}\n\n`;
          
          // Authors section
          resultText += `## Authors\n${paper.authors}\n\n`;
          
          // Abstract section
          resultText += `## Abstract\n${paper.abstract}\n\n`;
          
          // Paper details section
          resultText += `## Paper Details\n\n`;
          resultText += `**DOI:** ${paper.doi}\n`;
          resultText += `**URL:** https://doi.org/${paper.doi}\n`;
          resultText += `**Posted Date:** ${paper.date}\n`;
          
          if (paper.version) {
            resultText += `**Version:** ${paper.version}\n`;
          }
          
          if (paper.category) {
            resultText += `**Category:** ${paper.category}\n`;
          }
          
          if (paper.type) {
            resultText += `**Type:** ${paper.type}\n`;
          }
          
          // Publication status
          resultText += `\n## Publication Status\n\n`;
          if (paper.published) {
            resultText += `This preprint has been published in: ${paper.published}\n`;
          } else {
            resultText += `This preprint has not yet been published in a peer-reviewed journal.\n`;
          }
          
          // License information
          if (paper.license) {
            resultText += `\n## License\n\n${paper.license}\n`;
          }
          
          // Citation section
          resultText += `\n## Citation\n\n`;
          resultText += `${paper.authors}. "${cleanedTitle}". `;
          resultText += `bioRxiv ${paper.date.substring(0, 4)}. DOI: ${paper.doi}\n\n`;
          
          // Additional links
          resultText += `## Links\n\n`;
          resultText += `- [View on bioRxiv](https://doi.org/${paper.doi})\n`;
          resultText += `- [PDF](https://www.biorxiv.org/content/${paper.doi.replace('10.1101/', '')}.full.pdf)\n`;
        } else {
          resultText = `No paper found with DOI "${doi}".\n\n`;
          resultText += `Please check that the DOI is correct and try again. DOIs for bioRxiv papers typically start with "10.1101/".`;
        }

        return {
          content: [{ type: "text", text: resultText }],
        };
      } catch (error) {
        let errorMessage = "Error fetching paper details";
        if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
        }
        
        return {
          content: [{ type: "text", text: errorMessage }],
        };
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  const cleanup = async () => {
    // Nothing to clean up for now
  };

  return { server, cleanup };
};