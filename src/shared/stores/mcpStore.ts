import { writable } from 'svelte/store';

// MCP Server Configuration Interface
export interface MCPServer {
  id: string;
  label: string;
  description: string;
  serverUrl: string;
  enabled: boolean;
  requireApproval: 'always' | 'never' | { never: { tool_names: string[] } };
  allowedTools?: string[];
  authorization?: string;
  headers?: Record<string, string>;
  status: 'unknown' | 'connected' | 'error';
  lastError?: string;
}

// MCP Store Interface
interface MCPStoreState {
  servers: MCPServer[];
  enabled: boolean;
}

// Default MCP servers (with placeholders for API keys)
const defaultServers: MCPServer[] = [
  {
    id: 'tavily-search',
    label: 'Tavily',
    description: 'Real-time web search and research capabilities',
    serverUrl: 'https://mcp.tavily.com/mcp/?tavilyApiKey=YOUR_TAVILY_API_KEY',
    enabled: false, // Disabled by default - requires API key configuration
    requireApproval: 'never',
    allowedTools: ['web_search', 'commentary'],
    status: 'unknown'
  },
  {
    id: 'parallel-search',
    label: 'Parallel',
    description: 'Advanced web search with parallel processing',
    serverUrl: 'https://mcp.parallel.ai/v1beta/search_mcp/',
    enabled: false, // Disabled by default - requires API key configuration
    requireApproval: 'never',
    headers: { 'x-api-key': 'YOUR_PARALLEL_API_KEY' },
    status: 'unknown'
  },
  {
    id: 'huggingface-models',
    label: 'hf',
    description: 'Access to Hugging Face model inference and datasets',
    serverUrl: 'https://huggingface.co/mcp',
    enabled: false, // Disabled by default - requires HF token
    requireApproval: 'never', 
    authorization: 'Bearer YOUR_HF_TOKEN',
    status: 'unknown'
  },
  {
    id: 'browseruse',
    label: 'browseruse',
    description: 'Browser automation and web interaction capabilities',
    serverUrl: 'https://api.browser-use.com/mcp/',
    enabled: false, // Disabled by default - requires API key configuration
    requireApproval: 'never',
    headers: { 'X-Browser-Use-API-Key': 'YOUR_BROWSER_USE_API_KEY' },
    status: 'unknown'
  },
  {
    id: 'firecrawl',
    label: 'firecrawl',
    description: 'Web scraping and content extraction capabilities',
    serverUrl: 'https://mcp.firecrawl.dev/YOUR-API-KEY/v2/mcp',
    enabled: true, // Enabled by default - no API key required
    requireApproval: 'never',
    headers: {},
    status: 'unknown'
  }
];

// Create the MCP store
function createMCPStore() {
  const { subscribe, set, update } = writable<MCPStoreState>({
    servers: defaultServers,
    enabled: true
  });

  return {
    subscribe,
    
    // Add a new MCP server
    addServer: (server: Omit<MCPServer, 'id' | 'status'>) => {
      const newServer: MCPServer = {
        ...server,
        id: crypto.randomUUID(),
        status: 'unknown'
      };
      update(state => ({
        ...state,
        servers: [...state.servers, newServer]
      }));
    },
    
    // Update an existing server
    updateServer: (id: string, updates: Partial<MCPServer>) => {
      update(state => ({
        ...state,
        servers: state.servers.map(server => 
          server.id === id ? { ...server, ...updates } : server
        )
      }));
    },
    
    // Remove a server
    removeServer: (id: string) => {
      update(state => ({
        ...state,
        servers: state.servers.filter(server => server.id !== id)
      }));
    },
    
    // Toggle server enabled state
    toggleServer: (id: string) => {
      update(state => ({
        ...state,
        servers: state.servers.map(server => 
          server.id === id ? { ...server, enabled: !server.enabled } : server
        )
      }));
    },
    
    // Update server status
    updateServerStatus: (id: string, status: MCPServer['status'], error?: string) => {
      update(state => ({
        ...state,
        servers: state.servers.map(server => 
          server.id === id ? { ...server, status, lastError: error } : server
        )
      }));
    },
    
    // Get enabled servers only
    getEnabledServers: () => {
      let servers: MCPServer[] = [];
      const unsubscribe = subscribe(state => {
        servers = state.servers.filter(server => server.enabled);
      });
      unsubscribe();
      return servers;
    },
    
    // Toggle MCP feature entirely
    toggleMCP: () => {
      update(state => ({
        ...state,
        enabled: !state.enabled
      }));
    },
    
    // Reset to defaults
    reset: () => {
      set({
        servers: defaultServers,
        enabled: true
      });
    }
  };
}

// Export the singleton instance
export const mcpStore = createMCPStore();
