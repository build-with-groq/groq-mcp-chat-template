<script lang="ts">
  import { createEventDispatcher, onMount, afterUpdate } from "svelte";
  import Button from "@shared/components/ui/button/button.svelte";
  import { 
    Send, 
    Square, 
    ChevronDown, 
    ChevronRight, 
    CreditCard, 
    Loader2, 
    CheckCircle, 
    XCircle, 
    X, 
    MessageCircle, 
    User, 
    Bot, 
    Settings, 
    Server,
    Trash2
  } from "@lucide/svelte";
  import GroqLabsLogo from "../../../assets/groqlabs_logo-white-orange.png";
  import MCPServerManager from "@shared/components/MCPServerManager.svelte";
  
  // Props
  export let status: string = "Idle";
  export let isProcessing: boolean = false;
  export let error: string = "";
  export let toolCalls: any[] = [];
  export let conversationHistory: any[] = [];
  export let selectedModel: string = "";
  export let systemPrompt: string = "";
  
  // Use systemPrompt to avoid unused property warning
  $: systemPromptDisplay = systemPrompt;

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Local state for UI
  let messageInput = "";
  let showMCPManager = false;
  let expandedToolCalls = new Set<string>();
  let chatContainer: HTMLElement;
  
  // Determine if conversation is active (processing)
  $: isConversationActive = isProcessing || status === "Processing" || status === "responding" || status === "responding_with_mcp" || status === "mcp_processing";
  
  // Show tool calls if there are any
  $: hasToolCalls = toolCalls && toolCalls.length > 0;
  
  // Show conversation if there's history
  $: hasConversationHistory = conversationHistory && conversationHistory.length > 0;
  
  // Debug conversation history
  $: console.log("ChatUI conversationHistory:", conversationHistory, "hasConversationHistory:", hasConversationHistory);
  
  // Auto-scroll to bottom when conversation updates
  afterUpdate(() => {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  });
  
  // Toggle tool call expansion
  function toggleToolCall(toolCallId: string) {
    if (expandedToolCalls.has(toolCallId)) {
      expandedToolCalls.delete(toolCallId);
    } else {
      expandedToolCalls.add(toolCallId);
    }
    expandedToolCalls = new Set(expandedToolCalls);
  }

  // Handle message send
  function handleSendMessage() {
    if (!messageInput.trim() || isConversationActive) return;
    
    const message = messageInput.trim();
    messageInput = "";
    
    dispatch('send-message', { message });
  }

  // Handle enter key in textarea
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  // Handle stop processing
  function handleStop() {
    dispatch('stop-processing');
  }

  // Clear conversation
  function clearConversation() {
    if (confirm('Are you sure you want to clear the conversation history?')) {
      dispatch('clear-conversation');
    }
  }

  // Get status display text
  function getStatusText(status: string) {
    switch (status) {
      case "Idle":
        return "Ready to chat";
      case "Processing":
        return "Processing your message...";
      case "responding":
        return "AI is responding...";
      case "responding_with_mcp":
        return "AI is responding with tools...";
      case "mcp_processing":
        return "Processing with MCP tools...";
      default:
        return status;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "Idle":
        return "text-gray-500";
      case "Processing":
        return "text-orange-600";
      case "responding":
      case "responding_with_mcp":
      case "mcp_processing":
        return "text-orange-700";
      default:
        return "text-gray-500";
    }
  }
</script>

<div class="h-screen bg-gradient-to-br from-orange-50 to-white flex flex-col relative overflow-hidden m-0 p-0">
  <!-- Header -->
  <div class="bg-gray-900 border-b border-gray-700">
    <div class="w-full px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-6">
          <div class="h-12">
            <img src={GroqLabsLogo} alt="GroqLabs Logo" class="h-full object-contain" />
          </div>
          <div>
            <h1 class="text-xl font-semibold text-white">MCP Chat Assistant</h1>
            <p class="text-sm text-gray-300">Powered by Groq | Fast AI Inference</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Chat Area -->
  <div class="flex-1 flex flex-col overflow-hidden">
    
    <!-- Chat Messages Container -->
    <div bind:this={chatContainer} class="flex-1 overflow-y-auto px-6 py-4 pb-6 min-h-0">
      <div class="max-w-4xl mx-auto space-y-4 pb-4">
        
        <!-- Welcome Message -->
        {#if !hasConversationHistory}
          <div class="text-center py-12">
            <div class="bg-white rounded-lg shadow-sm p-8 border border-orange-100">
              <Bot class="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <h2 class="text-xl font-semibold text-gray-800 mb-2">Welcome to MCP Chat Assistant</h2>
              <p class="text-gray-600 mb-4">I'm powered by Groq's fast AI inference and can help you with various tasks using MCP tools when available.</p>
              <p class="text-sm text-gray-500">Model: <span class="font-medium">{selectedModel}</span></p>
            </div>
          </div>
        {/if}

        <!-- Conversation Messages -->
        {#each conversationHistory as message, i}
          <div class="flex items-start space-x-4 {message.role === 'user' ? 'justify-end' : ''}">
            {#if message.role === 'assistant'}
              <div class="flex-shrink-0">
                <div class="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <Bot class="w-5 h-5 text-white" />
                </div>
              </div>
            {/if}
            
            <div class="max-w-3xl {message.role === 'user' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200'} rounded-lg shadow-sm overflow-hidden">
              <!-- Main Message Content -->
              <div class="px-4 py-3">
                <div class="prose prose-sm max-w-none {message.role === 'user' ? 'prose-invert' : ''}">
                  {#if message.content}
                    <p class="whitespace-pre-wrap break-words">{message.content}</p>
                  {/if}
                </div>
              </div>
              
              <!-- Tool Calls for Assistant Messages (show after the last assistant message) -->
              {#if message.role === 'assistant' && i === conversationHistory.length - 1 && hasToolCalls}
                <div class="border-t border-gray-200 bg-gray-50">
                  <div class="px-4 py-3 space-y-2">
                    <div class="flex items-center space-x-2 mb-2">
                      <CreditCard class="w-4 h-4 text-orange-600" />
                      <span class="text-sm font-medium text-gray-800">Tool Usage ({toolCalls.length} calls)</span>
                    </div>
                    {#each toolCalls as toolCall, j}
                      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          on:click={() => toggleToolCall(toolCall.id)}
                          class="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div class="flex items-center space-x-2">
                            {#if toolCall.status === 'completed'}
                              <CheckCircle class="w-4 h-4 text-green-500" />
                            {:else if toolCall.status === 'error'}
                              <XCircle class="w-4 h-4 text-red-500" />
                            {:else}
                              <Loader2 class="w-4 h-4 text-orange-500 animate-spin" />
                            {/if}
                            <span class="text-sm font-medium text-gray-800">{toolCall.name}</span>
                          </div>
                          <svelte:component this={expandedToolCalls.has(toolCall.id) ? ChevronDown : ChevronRight} class="w-4 h-4 text-gray-400" />
                        </button>
                        
                        {#if expandedToolCalls.has(toolCall.id)}
                          <div class="px-3 pb-3 space-y-2 bg-gray-50 border-t border-gray-200">
                            {#if toolCall.parameters && Object.keys(toolCall.parameters).length > 0}
                              <div>
                                <h4 class="text-xs font-medium text-gray-700 mb-1">Parameters:</h4>
                                <pre class="text-xs text-gray-600 bg-white p-2 rounded border overflow-x-auto">{JSON.stringify(toolCall.parameters, null, 2)}</pre>
                              </div>
                            {/if}
                            
                            {#if toolCall.response}
                              <div>
                                <h4 class="text-xs font-medium text-gray-700 mb-1">Response:</h4>
                                <pre class="text-xs text-gray-600 bg-white p-2 rounded border overflow-x-auto">{JSON.stringify(toolCall.response, null, 2)}</pre>
                              </div>
                            {/if}
                            
                            {#if toolCall.error}
                              <div>
                                <h4 class="text-xs font-medium text-red-700 mb-1">Error:</h4>
                                <pre class="text-xs text-red-600 bg-red-50 p-2 rounded border overflow-x-auto">{JSON.stringify(toolCall.error, null, 2)}</pre>
                              </div>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
            
            {#if message.role === 'user'}
              <div class="flex-shrink-0">
                <div class="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                  <User class="w-5 h-5 text-white" />
                </div>
              </div>
            {/if}
          </div>
        {/each}
        
        <!-- Processing Indicator -->
        {#if isConversationActive}
          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <Bot class="w-5 h-5 text-white" />
              </div>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <!-- Processing Status -->
              <div class="px-4 py-3">
                <div class="flex items-center space-x-2">
                  <Loader2 class="w-4 h-4 animate-spin text-orange-500" />
                  <span class="text-sm {getStatusColor(status)}">{getStatusText(status)}</span>
                </div>
              </div>
              
              <!-- Tool Calls During Processing -->
              {#if hasToolCalls}
                <div class="border-t border-gray-200 bg-gray-50">
                  <div class="px-4 py-3 space-y-2">
                    <div class="flex items-center space-x-2 mb-2">
                      <CreditCard class="w-4 h-4 text-orange-600" />
                      <span class="text-sm font-medium text-gray-800">Tool Usage ({toolCalls.length} calls)</span>
                    </div>
                    {#each toolCalls as toolCall, j}
                      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          on:click={() => toggleToolCall(toolCall.id)}
                          class="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div class="flex items-center space-x-2">
                            {#if toolCall.status === 'completed'}
                              <CheckCircle class="w-4 h-4 text-green-500" />
                            {:else if toolCall.status === 'error'}
                              <XCircle class="w-4 h-4 text-red-500" />
                            {:else}
                              <Loader2 class="w-4 h-4 text-orange-500 animate-spin" />
                            {/if}
                            <span class="text-sm font-medium text-gray-800">{toolCall.name}</span>
                          </div>
                          <svelte:component this={expandedToolCalls.has(toolCall.id) ? ChevronDown : ChevronRight} class="w-4 h-4 text-gray-400" />
                        </button>
                        
                        {#if expandedToolCalls.has(toolCall.id)}
                          <div class="px-3 pb-3 space-y-2 bg-gray-50 border-t border-gray-200">
                            {#if toolCall.parameters && Object.keys(toolCall.parameters).length > 0}
                              <div>
                                <h4 class="text-xs font-medium text-gray-700 mb-1">Parameters:</h4>
                                <pre class="text-xs text-gray-600 bg-white p-2 rounded border overflow-x-auto">{JSON.stringify(toolCall.parameters, null, 2)}</pre>
                              </div>
                            {/if}
                            
                            {#if toolCall.response}
                              <div>
                                <h4 class="text-xs font-medium text-gray-700 mb-1">Response:</h4>
                                <pre class="text-xs text-gray-600 bg-white p-2 rounded border overflow-x-auto">{JSON.stringify(toolCall.response, null, 2)}</pre>
                              </div>
                            {/if}
                            
                            {#if toolCall.error}
                              <div>
                                <h4 class="text-xs font-medium text-red-700 mb-1">Error:</h4>
                                <pre class="text-xs text-red-600 bg-red-50 p-2 rounded border overflow-x-auto">{JSON.stringify(toolCall.error, null, 2)}</pre>
                              </div>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Input Area -->
    <div class="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4">
      <div class="max-w-4xl mx-auto">
        {#if error}
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p class="text-red-700 text-sm">{error}</p>
          </div>
        {/if}
        
        <div class="flex items-center space-x-4">
          <div class="flex-1">
            <textarea
              bind:value={messageInput}
              on:keydown={handleKeydown}
              placeholder="Type your message... (Shift+Enter for new line)"
              class="w-full resize-none border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows="1"
              style="min-height: 44px; max-height: 120px;"
              disabled={isConversationActive}
            ></textarea>
          </div>
          
          <div class="flex items-center space-x-2">
            <!-- MCP Settings Button -->
            <Button 
              variant="outline"
              size="sm"
              onclick={() => showMCPManager = !showMCPManager}
              class="border-orange-200 text-orange-600 hover:bg-orange-50"
            >
              <Server class="w-4 h-4" />
            </Button>
            
            <!-- Clear Conversation Button -->
            {#if hasConversationHistory && !isConversationActive}
              <Button 
                variant="outline"
                size="sm"
                onclick={clearConversation}
                class="border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 class="w-4 h-4" />
              </Button>
            {/if}
            
            <!-- Send/Stop Button -->
            {#if isConversationActive}
              <Button 
                variant="outline"
                onclick={handleStop}
                class="border-red-200 text-red-600 hover:bg-red-50"
              >
                <Square class="w-4 h-4 mr-2" />
                Stop
              </Button>
            {:else}
              <Button 
                onclick={handleSendMessage}
                disabled={!messageInput.trim()}
                class="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Send class="w-4 h-4 mr-2" />
                Send
              </Button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- MCP Server Manager Modal -->
  {#if showMCPManager}
    <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">MCP Server Configuration</h2>
          <button
            on:click={() => showMCPManager = false}
            class="text-gray-400 hover:text-gray-600"
          >
            <X class="w-6 h-6" />
          </button>
        </div>
        <div class="overflow-y-auto max-h-[calc(80vh-4rem)]">
          <MCPServerManager />
        </div>
      </div>
    </div>
  {/if}

</div>
