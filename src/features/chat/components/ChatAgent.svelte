<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { groqService } from "@shared/services/groqService";
  import ChatFlowDiagram from "@features/blueprints/svelteFlow/ChatFlowDiagram.svelte";
  import DemoLayout from "@app/layouts/DemoLayout.svelte";
  import { apiKeyStore } from "@shared/stores/apiKeyStore";
  import { mcpStore } from "@shared/stores/mcpStore";
  import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
  } from "@shared/components/ui/select";
  import ApiKeyModal from "@shared/components/ApiKeyModal.svelte";
  import Button from "@shared/components/ui/button/button.svelte";
  import ChatUI from "./ChatUI.svelte";
  import { Eye, Settings2 } from "@lucide/svelte";

  // State for API key
  let apiKey = "";
  let currentApiKey = "";

  // Use the shared Groq client
  const groq = groqService.client;

  // System prompt for the agent
  export let systemPrompt =
    "You are a helpful MCP AI assistant powered by Groq. You can help with general questions and can use MCP tools when needed. For general conversations, respond naturally and helpfully. Always be clear, concise, and friendly. DO NOT READ BACK LONG IDS OR URLs ";

  // State
  let error = "";
  let toolCalls: any[] = [];
  let status = "Idle";
  let isProcessing = false;
  

  // UI View state
  let currentView: 'main' | 'technical' = 'main';

  // Add conversation history to maintain context
  let conversationHistory: Array<{ role: string; content: string }> = [];

  // Animation refs
  let flowDiagramComponent: ChatFlowDiagram;

  // Add AI model selection state
  const aiModels = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "moonshotai/kimi-k2-instruct-0905",
    "qwen/qwen3-32b"
  ];
  let selectedAIModel: string = "openai/gpt-oss-120b";
  let editableSystemPrompt: string = systemPrompt;

  // View toggle functions
  function switchView(view: 'main' | 'technical') {
    currentView = view;
  }

  // Subscribe to the API key store
  const unsubscribe = apiKeyStore.subscribe((state) => {
    apiKey = state.key;
    currentApiKey = state.key;
  });


  onMount(async () => {
    try {

      // Initialize the shared Groq service
      groqService.initialize();
    } catch (e: unknown) {
      console.error("Error initializing chat agent:", e);
      error = e instanceof Error ? e.message : "Unknown error occurred";
    }
  });

  // Clean up on component destruction
  onDestroy(() => {
    // Unsubscribe from the API key store
    unsubscribe();
  });

  // Handle message send from ChatUI
  async function handleSendMessage(event: CustomEvent) {
    const { message } = event.detail;
    await getAgentResponse(message);
  }

  // Handle stop processing
  function handleStopProcessing() {
    // Reset processing state
    isProcessing = false;
    status = "Idle";
  }

  // Handle clear conversation
  function handleClearConversation() {
    conversationHistory = [];
    toolCalls = [];
    status = "Idle";
    isProcessing = false;
  }

  // Get a response from the AI
  async function getAgentResponse(text: string) {
    if (!text) return;

    try {
      // Set processing state
      isProcessing = true;
      status = "Processing";
      
      // Reset tool calls for new request
      toolCalls = [];
      
      // Add user message to conversation history
      conversationHistory.push({ role: "user", content: text });
      conversationHistory = [...conversationHistory]; // Trigger Svelte reactivity
      console.log("Added user message to conversation history:", conversationHistory);

      // Prepare messages for the API with full conversation history
      const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
      ];
      
      // Get enabled MCP servers from store
      const enabledMCPServers = mcpStore.getEnabledServers();
      
      // Configure MCP tools for the Responses API (following OpenAI MCP spec)
      const mcpTools = enabledMCPServers.map(server => {
        const tool: any = {
          type: "mcp",
          server_label: server.label,
          server_url: server.serverUrl,
          require_approval: server.requireApproval
        };
        
        // Optional fields - only include if they have values
        if (server.description) {
          tool.server_description = server.description;
        }
        
        if (server.allowedTools && server.allowedTools.length > 0) {
          tool.allowed_tools = server.allowedTools;
        }
        
        if (server.authorization) {
          tool.authorization = server.authorization;
        }
        
        // Headers - not in OpenAI spec but supported by Groq (based on user's Python example)
        if (server.headers && Object.keys(server.headers).length > 0) {
          tool.headers = server.headers;
        }
        
        return tool;
      });
      
      // Validate MCP tools structure before sending
      mcpTools.forEach((tool, index) => {
        // Check required fields per OpenAI MCP spec
        const required = ['type', 'server_label', 'server_url', 'require_approval'];
        const missing = required.filter(field => !tool[field]);
        if (missing.length > 0) {
          console.error(`🚨 Tool ${index} missing required fields:`, missing);
        }
        
        // Check for unknown fields (not in spec)
        const knownFields = ['type', 'server_label', 'server_description', 'server_url', 'require_approval', 'allowed_tools', 'authorization', 'headers'];
        const unknown = Object.keys(tool).filter(field => !knownFields.includes(field));
        if (unknown.length > 0) {
          console.warn(`⚠️  Tool ${index} has unknown fields:`, unknown);
        }
      });

      // Convert messages to input format for Responses API
      let input: string | any[] = "";
      if (messages.length > 1) {
        // If we have conversation history, use the latest user message as input
        const lastMessage = messages[messages.length - 1];
        input = lastMessage.content;
      }

      let response;
      let agentResponse = "";
      
      // Use the Responses API for MCP tool support if MCP servers are available
      if (mcpTools.length > 0) {
        try {
          console.log("🔧 MCP Tools being sent to API (spec-compliant):", JSON.stringify(mcpTools, null, 2));
          
          // Debug each tool's configuration specifically
          mcpTools.forEach((tool, index) => {
            console.log(`🔧 Tool ${index} (${tool.server_label}):`);
            console.log(`   - Type: ${tool.type}`);
            console.log(`   - URL: ${tool.server_url}`);
            console.log(`   - Require Approval: ${tool.require_approval}`);
            console.log(`   - Description: ${tool.server_description || 'not set'}`);
            console.log(`   - Allowed Tools: ${tool.allowed_tools ? JSON.stringify(tool.allowed_tools) : 'ALL TOOLS (not restricted)'}`);
            console.log(`   - Authorization: ${tool.authorization ? '[SET]' : 'not set'}`);
            console.log(`   - Headers: ${tool.headers ? JSON.stringify(tool.headers) : 'not set'}`);
            console.log(`   - Total fields: ${Object.keys(tool).length}`);
          });
          
          response = await groq.responses.create({
            model: selectedAIModel,
            tools: mcpTools,
            input: input,
          });
          
          // Update server statuses to connected
          enabledMCPServers.forEach(server => {
            mcpStore.updateServerStatus(server.id, 'connected');
          });
          
        } catch (mcpError: any) {
          console.warn("MCP request failed, falling back to regular chat completion:", mcpError);
          
          // Update server statuses to error
          enabledMCPServers.forEach(server => {
            mcpStore.updateServerStatus(server.id, 'error', mcpError.message);
          });
          
          // Fall back to regular chat completion
          // Create a modified system prompt that doesn't encourage tool usage
          const fallbackSystemPrompt = systemPrompt.replace(
            "You can help with general questions and can use MCP tools when needed.",
            "You can help with general questions. Please respond directly without using any tools."
          );
          
          response = await groq.chat.completions.create({
            model: selectedAIModel,
            messages: [
              { role: "system", content: fallbackSystemPrompt },
              ...conversationHistory,
            ] as any,
            stream: false,
            max_tokens: 4096
          });
          
          // Convert to responses API format for consistency
          response = {
            output_text: response.choices[0].message.content,
            output: []
          };
        }
      } else {
        // No MCP servers enabled, use regular chat completion
        // Create a modified system prompt that doesn't encourage tool usage
        const noMcpSystemPrompt = systemPrompt.replace(
          "You can help with general questions and can use MCP tools when needed.",
          "You can help with general questions. Please respond directly without using any tools."
        );
        
        const chatResponse = await groq.chat.completions.create({
          model: selectedAIModel,
          messages: [
            { role: "system", content: noMcpSystemPrompt },
            ...conversationHistory,
          ] as any,
          stream: false,
          max_tokens: 4096
        });
        
        // Convert to responses API format for consistency
        response = {
          output_text: chatResponse.choices[0].message.content,
          output: []
        };
      }

      // Process the Responses API output
      agentResponse = response.output_text || "";
      
      // Process MCP tool calls from the output array
      const mcpToolCalls = response.output?.filter((item: any) => 
        item.type === 'mcp_call' || item.type === 'mcp_list_tools'
      ) || [];
      
      console.log("🔧 Full API response:", JSON.stringify(response, null, 2));
      console.log("🔧 MCP tool calls found:", mcpToolCalls);

      // Handle MCP tool calls if any
      if (mcpToolCalls.length > 0) {
        status = "mcp_processing";
        console.log("🔧 Processing MCP tools:", mcpToolCalls.length);

         // Helper function to safely parse JSON
         const safeJsonParse = (jsonString: string) => {
           if (!jsonString) return null;
           try {
             return JSON.parse(jsonString);
           } catch (e) {
             // If it's not valid JSON, return as plain text
             return jsonString;
           }
         };

         // Convert MCP calls to our internal tool call format
         const newToolCalls = mcpToolCalls
           .filter((item: any) => item.type === 'mcp_call')
           .map((mcpCall: any) => ({
             id: mcpCall.id,
             name: mcpCall.name,
             parameters: mcpCall.arguments ? safeJsonParse(mcpCall.arguments) : {},
             status: mcpCall.error ? 'error' : 'completed',
             response: mcpCall.output ? safeJsonParse(mcpCall.output) : null,
             error: mcpCall.error || null
           }));

        // Set tool calls from this request (already reset at start of function)
        toolCalls = newToolCalls;

        // Set appropriate status
        status = "responding_with_mcp";
        console.log("🔧 Processing completed (with MCP) - tools completed");

        // Add only the assistant response to conversation history (user message already added above)
        conversationHistory.push({ role: 'assistant', content: agentResponse });
      } else {
        // No MCP tools used - agentResponse already set from response.output_text
        
        // Set direct response status (no MCP)
        status = "responding";
        
        // Add only the assistant response to conversation history (user message already added above)
        conversationHistory.push({ role: 'assistant', content: agentResponse });
      }

      // Trigger Svelte reactivity for conversation history
      conversationHistory = [...conversationHistory];
      console.log("Added assistant message to conversation history:", conversationHistory);

      // Complete processing
      isProcessing = false;
      status = "Idle";
    } catch (e: unknown) {
      console.error("Error getting AI response:", e);
      error = e instanceof Error ? e.message : "Failed to get AI response";
      isProcessing = false;
      status = "Idle";
    }
  }

  // Clear error message
  function clearError() {
    error = "";
  }


  let isApiKeyModalOpen = false;
  function openApiKeyModal() {
    currentApiKey = apiKey;
    isApiKeyModalOpen = true;
  }
  function closeApiKeyModal() {
    isApiKeyModalOpen = false;
  }

  // Handle node clicks from the diagram
  function handleDiagramNodeClick(event: CustomEvent) {
    // For chat, we might handle different node interactions
    console.log("Node clicked:", event.detail.nodeId);
  }

  // Handle diagram events
  function handleDiagramStart() {
    // For chat, this could reset conversation or trigger some action
    console.log("Chat diagram started");
  }

  function handleDiagramStop(event: CustomEvent) {
    // For chat, this could clear conversation
    handleClearConversation();
  }
</script>

<!-- View Toggle Controls -->
<div class="fixed top-6 right-6 z-50">
  <div class="flex items-center bg-white/90 backdrop-blur-sm rounded-full p-1 shadow-lg border border-gray-200">
    <Button 
      variant="ghost"
      size="sm"
      onclick={() => switchView('main')}
      class={currentView === 'main' ? 'bg-orange-600 hover:bg-orange-700 text-white rounded-full px-4 py-2' : 'hover:bg-gray-100 text-gray-700 rounded-full px-4 py-2'}
    >
      <Eye class="w-4 h-4 mr-2" />
      Main
    </Button>
    
    <Button 
      variant="ghost"
      size="sm"
      onclick={() => switchView('technical')}
      class={currentView === 'technical' ? 'bg-gray-800 hover:bg-gray-900 text-white rounded-full px-4 py-2' : 'hover:bg-gray-100 text-gray-700 rounded-full px-4 py-2'}
    >
      <Settings2 class="w-4 h-4 mr-2" />
      Technical
    </Button>
  </div>
</div>

{#if currentView === 'main'}
  <ChatUI
    {status}
    {isProcessing}
    {error}
    {toolCalls}
    {conversationHistory}
    selectedModel={selectedAIModel}
    {systemPrompt}
    on:send-message={handleSendMessage}
    on:stop-processing={handleStopProcessing}
    on:clear-conversation={handleClearConversation}
  />
{:else}
  <DemoLayout title="Chat Agent with MCP Tool Support">
    <div slot="diagram" class="rounded-lg overflow-hidden">
      <ChatFlowDiagram
        bind:this={flowDiagramComponent}
        height="400px"
        currentState={status}
        on:nodeClick={handleDiagramNodeClick}
        on:start={handleDiagramStart}
        on:stop={handleDiagramStop}
      />
    </div>
    <div class="w-full flex mt-6">
      <div
        class="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow p-6 flex flex-col gap-4 w-full"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2 max-w-md">
            <p class="font-medium text-sm">AI Model</p>
            <Select
              type="single"
              value={selectedAIModel}
              onValueChange={(e) => (selectedAIModel = e)}
            >
              <SelectTrigger>{selectedAIModel}</SelectTrigger>
              <SelectContent>
                {#each aiModels as model}
                  <SelectItem value={model}>{model}</SelectItem>
                {/each}
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-2">
            <p class="font-medium text-sm">System Prompt</p>
            <input
              class="border rounded px-3 py-2 text-sm bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="text"
              bind:value={editableSystemPrompt}
              onchange={() => (systemPrompt = editableSystemPrompt)}
            />
          </div>
        </div>
        <div class="flex gap-2 mt-2">
          <Button size="sm" variant="outline" onclick={openApiKeyModal}>
            {apiKeyStore.hasApiKey() ? "✓ API Key Added" : "Add API Key"}
          </Button>
        </div>
      </div>
    </div>
    <div slot="error">
      {#if error}
        <div class="bg-red-50 text-red-700 p-4 rounded-lg mb-4 mt-4">
          <p class="font-medium">Error:</p>
          <p>{error}</p>
          <div class="flex space-x-2 mt-2">
            <button
              class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              onclick={clearError}
            >
              Dismiss
            </button>
          </div>
        </div>
      {/if}
    </div>
  </DemoLayout>
{/if}

<!-- Modals should be available in both views -->
<ApiKeyModal
  isOpen={isApiKeyModalOpen}
  initialKey={currentApiKey}
  on:close={closeApiKeyModal}
  on:keySet={closeApiKeyModal}
/>
