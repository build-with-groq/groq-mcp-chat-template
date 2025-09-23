<script lang="ts">
  import { mcpStore, type MCPServer } from "@shared/stores/mcpStore";
  import { createEventDispatcher } from "svelte";
  import Button from "@shared/components/ui/button/button.svelte";
  import { 
    Plus, 
    Settings, 
    Trash2, 
    Power, 
    PowerOff, 
    CheckCircle, 
    XCircle, 
    Clock, 
    Edit3,
    TestTube,
    Save,
    X
  } from "@lucide/svelte";
  
  const dispatch = createEventDispatcher();
  
  let mcpState: { servers: MCPServer[], enabled: boolean } = { servers: [], enabled: true };
  let showAddForm = false;
  let editingServer: string | null = null;
  let testingServer: string | null = null;
  
  // New server form
  let newServer: {
    label: string;
    description: string;
    serverUrl: string;
    enabled: boolean;
    requireApproval: 'always' | 'never';
    allowedTools: string;
    authorization: string;
    headers: string;
  } = {
    label: '',
    description: '',
    serverUrl: '',
    enabled: true,
    requireApproval: 'never',
    allowedTools: '',
    authorization: '',
    headers: ''
  };
  
  // Edit server form
  let editingServerData = { ...newServer };
  
  // Subscribe to MCP store
  const unsubscribe = mcpStore.subscribe(state => {
    mcpState = state;
  });
  
  // Cleanup subscription
  import { onDestroy } from "svelte";
  onDestroy(() => {
    unsubscribe();
  });
  
  // Helper function to parse headers string into object
  function parseHeaders(headersStr: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = headersStr.split('\n').map(line => line.trim()).filter(Boolean);
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        if (key && value) {
          headers[key] = value;
        }
      }
    }
    
    return headers;
  }
  
  // Helper function to serialize headers object to string
  function serializeHeaders(headers: Record<string, string>): string {
    return Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }
  
  function resetNewServerForm() {
    newServer = {
      label: '',
      description: '',
      serverUrl: '',
      enabled: true,
      requireApproval: 'never',
      allowedTools: '',
      authorization: '',
      headers: ''
    };
  }
  
  function handleAddServer() {
    if (!newServer.label.trim() || !newServer.serverUrl.trim()) {
      return;
    }
    
    const serverToAdd = {
      ...newServer,
      label: newServer.label.trim(),
      description: newServer.description.trim(),
      serverUrl: newServer.serverUrl.trim(),
      authorization: newServer.authorization.trim() || undefined,
      allowedTools: newServer.allowedTools.trim() 
        ? newServer.allowedTools.split(',').map(t => t.trim()).filter(Boolean)
        : undefined,
      headers: newServer.headers.trim() 
        ? parseHeaders(newServer.headers.trim())
        : undefined
    };
    
    mcpStore.addServer(serverToAdd);
    resetNewServerForm();
    showAddForm = false;
  }
  
  function handleEditServer(server: MCPServer) {
    editingServer = server.id;
    editingServerData = {
      label: server.label,
      description: server.description,
      serverUrl: server.serverUrl,
      enabled: server.enabled,
      requireApproval: typeof server.requireApproval === 'string' ? server.requireApproval : 'never',
      allowedTools: server.allowedTools?.join(', ') || '',
      authorization: server.authorization || '',
      headers: server.headers ? serializeHeaders(server.headers) : ''
    };
  }
  
  function handleSaveEdit() {
    if (!editingServer) return;
    
    const updates = {
      label: editingServerData.label.trim(),
      description: editingServerData.description.trim(),
      serverUrl: editingServerData.serverUrl.trim(),
      enabled: editingServerData.enabled,
      requireApproval: editingServerData.requireApproval,
      authorization: editingServerData.authorization.trim() || undefined,
      allowedTools: editingServerData.allowedTools.trim() 
        ? editingServerData.allowedTools.split(',').map(t => t.trim()).filter(Boolean)
        : undefined,
      headers: editingServerData.headers.trim() 
        ? parseHeaders(editingServerData.headers.trim())
        : undefined
    };
    
    mcpStore.updateServer(editingServer, updates);
    editingServer = null;
  }
  
  function cancelEdit() {
    editingServer = null;
  }
  
  function handleRemoveServer(id: string) {
    if (confirm('Are you sure you want to remove this MCP server?')) {
      mcpStore.removeServer(id);
    }
  }
  
  function handleToggleServer(id: string) {
    mcpStore.toggleServer(id);
  }
  
  async function testServerConnection(server: MCPServer) {
    testingServer = server.id;
    mcpStore.updateServerStatus(server.id, 'unknown');
    
    try {
      // Simple connectivity test - try to fetch the server
      const response = await fetch(server.serverUrl, {
        method: 'GET',
        mode: 'no-cors', // Avoid CORS issues for testing
        ...(server.authorization && {
          headers: {
            'Authorization': server.authorization
          }
        })
      });
      
      mcpStore.updateServerStatus(server.id, 'connected');
    } catch (error) {
      mcpStore.updateServerStatus(server.id, 'error', error instanceof Error ? error.message : 'Connection failed');
    } finally {
      testingServer = null;
    }
  }
  
  function getStatusIcon(status: MCPServer['status']) {
    switch (status) {
      case 'connected': return CheckCircle;
      case 'error': return XCircle;
      default: return Clock;
    }
  }
  
  function getStatusColor(status: MCPServer['status']) {
    switch (status) {
      case 'connected': return 'text-green-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-400';
    }
  }
</script>

<div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
  <!-- Header -->
  <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold text-gray-900">MCP Server Management</h3>
        <p class="text-sm text-gray-600">Configure Model Context Protocol servers for enhanced capabilities</p>
      </div>
      <div class="flex items-center space-x-3">
        <!-- Global MCP Toggle -->
        <button
          on:click={() => mcpStore.toggleMCP()}
          class="flex items-center space-x-2 px-3 py-2 rounded-md border {mcpState.enabled ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-700'} hover:bg-opacity-80 transition-colors"
        >
          <svelte:component this={mcpState.enabled ? Power : PowerOff} class="w-4 h-4" />
          <span class="text-sm font-medium">{mcpState.enabled ? 'Enabled' : 'Disabled'}</span>
        </button>
        
        <!-- Add Server Button -->
        <Button 
          variant="default" 
          size="sm"
          onclick={() => { showAddForm = true; resetNewServerForm(); }}
          class="flex items-center space-x-2"
        >
          <Plus class="w-4 h-4" />
          <span>Add Server</span>
        </Button>
      </div>
    </div>
  </div>

  <!-- Server List -->
  <div class="divide-y divide-gray-200">
    {#each mcpState.servers as server (server.id)}
      <div class="px-6 py-4 {!server.enabled ? 'bg-gray-50 opacity-60' : ''}">
        {#if editingServer === server.id}
          <!-- Edit Form -->
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Server Label</label>
                <input 
                  type="text" 
                  bind:value={editingServerData.label}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="My MCP Server"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Server URL</label>
                <input 
                  type="url" 
                  bind:value={editingServerData.serverUrl}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="https://example.com/mcp"
                />
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input 
                type="text" 
                bind:value={editingServerData.description}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="What does this server do?"
              />
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Approval Required</label>
                <select 
                  bind:value={editingServerData.requireApproval}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="never">Never</option>
                  <option value="always">Always</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Allowed Tools (comma-separated)</label>
                <input 
                  type="text" 
                  bind:value={editingServerData.allowedTools}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="web_search, commentary"
                />
                <p class="text-xs text-gray-500 mt-1">Leave empty to allow all tools from the server</p>
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Authorization (Optional)</label>
              <input 
                type="password" 
                bind:value={editingServerData.authorization}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Bearer YOUR_TOKEN"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Custom Headers (Optional)</label>
              <textarea 
                bind:value={editingServerData.headers}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="x-api-key: YOUR_API_KEY&#10;Content-Type: application/json"
                rows="3"
              ></textarea>
              <p class="text-xs text-gray-500 mt-1">One header per line, format: Key: Value</p>
            </div>
            
            <div class="flex items-center justify-end space-x-3">
              <Button variant="outline" size="sm" onclick={cancelEdit}>
                <X class="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button variant="default" size="sm" onclick={handleSaveEdit}>
                <Save class="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        {:else}
          <!-- Server Display -->
          <div class="flex items-center justify-between">
            <div class="flex items-start space-x-4">
              <!-- Status Icon -->
              <div class="mt-1">
                <svelte:component 
                  this={getStatusIcon(server.status)} 
                  class="w-5 h-5 {getStatusColor(server.status)}" 
                />
              </div>
              
              <!-- Server Info -->
              <div class="flex-1">
                <div class="flex items-center space-x-3">
                  <h4 class="font-medium text-gray-900">{server.label}</h4>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {server.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                    {server.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p class="text-sm text-gray-600 mt-1">{server.description}</p>
                <p class="text-xs text-gray-500 mt-1">{server.serverUrl}</p>
                {#if server.lastError}
                  <p class="text-xs text-red-600 mt-1">Error: {server.lastError}</p>
                {/if}
                {#if server.allowedTools && server.allowedTools.length > 0}
                  <div class="flex items-center space-x-1 mt-2">
                    <span class="text-xs text-gray-500">Tools:</span>
                    {#each server.allowedTools as tool}
                      <span class="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">{tool}</span>
                    {/each}
                  </div>
                {/if}
                {#if server.headers && Object.keys(server.headers).length > 0}
                  <div class="mt-2">
                    <span class="text-xs text-gray-500">Custom Headers:</span>
                    <div class="mt-1 space-y-1">
                      {#each Object.entries(server.headers) as [key, value]}
                        <div class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono">
                          {key}: {value}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center space-x-2">
              <!-- Test Connection -->
              <button
                on:click={() => testServerConnection(server)}
                disabled={testingServer === server.id}
                class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                title="Test Connection"
              >
                <TestTube class="w-4 h-4 {testingServer === server.id ? 'animate-pulse' : ''}" />
              </button>
              
              <!-- Toggle Enable/Disable -->
              <button
                on:click={() => handleToggleServer(server.id)}
                class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                title={server.enabled ? 'Disable Server' : 'Enable Server'}
              >
                <svelte:component this={server.enabled ? PowerOff : Power} class="w-4 h-4" />
              </button>
              
              <!-- Edit -->
              <button
                on:click={() => handleEditServer(server)}
                class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                title="Edit Server"
              >
                <Edit3 class="w-4 h-4" />
              </button>
              
              <!-- Remove -->
              <button
                on:click={() => handleRemoveServer(server.id)}
                class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Remove Server"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
    
    {#if mcpState.servers.length === 0}
      <div class="px-6 py-12 text-center">
        <Settings class="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500">No MCP servers configured</p>
        <p class="text-sm text-gray-400 mt-1">Add a server to get started with enhanced AI capabilities</p>
      </div>
    {/if}
  </div>

  <!-- Add Server Form -->
  {#if showAddForm}
    <div class="border-t border-gray-200 bg-gray-50 px-6 py-4">
      <div class="space-y-4">
        <h4 class="font-medium text-gray-900">Add New MCP Server</h4>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Server Label *</label>
            <input 
              type="text" 
              bind:value={newServer.label}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="My MCP Server"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Server URL *</label>
            <input 
              type="url" 
              bind:value={newServer.serverUrl}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="https://example.com/mcp"
            />
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input 
            type="text" 
            bind:value={newServer.description}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="What does this server do?"
          />
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Approval Required</label>
            <select 
              bind:value={newServer.requireApproval}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="never">Never</option>
              <option value="always">Always</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Allowed Tools (comma-separated)</label>
            <input 
              type="text" 
              bind:value={newServer.allowedTools}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="web_search, commentary"
            />
            <p class="text-xs text-gray-500 mt-1">Leave empty to allow all tools from the server</p>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Authorization (Optional)</label>
          <input 
            type="password" 
            bind:value={newServer.authorization}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Bearer YOUR_TOKEN"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Custom Headers (Optional)</label>
          <textarea 
            bind:value={newServer.headers}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="x-api-key: YOUR_API_KEY&#10;Content-Type: application/json"
            rows="3"
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">One header per line, format: Key: Value</p>
        </div>
        
        <div class="flex items-center justify-end space-x-3">
          <Button variant="outline" size="sm" onclick={() => showAddForm = false}>
            Cancel
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onclick={handleAddServer}
            disabled={!newServer.label.trim() || !newServer.serverUrl.trim()}
          >
            <Plus class="w-4 h-4 mr-2" />
            Add Server
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>
