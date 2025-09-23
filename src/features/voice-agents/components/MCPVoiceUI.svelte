<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import Button from "@shared/components/ui/button/button.svelte";
  import { Mic, MicOff, Square, ChevronDown, ChevronRight, CreditCard, Loader2, CheckCircle, XCircle, X, MessageCircle, User, Bot, List, HelpCircle, Settings, Server } from "@lucide/svelte";
  import GroqLabsLogo from "../../../assets/groqlabs_logo-white-orange.png";
  import MCPServerManager from "@shared/components/MCPServerManager.svelte";
  
  // Props
  export let status: string = "Idle";
  export let isRecording: boolean = false;
  export const transcription: string = "";
  export const agentResponse: string = "";
  export let error: string = "";
  export let toolCalls: any[] = [];
  export let conversationHistory: any[] = [];
  export const microphoneDevices: any[] = [];
  export const selectedMicrophoneDevice: any = null;
  export const selectedModel: string = "";
  export const selectedVoice: string = "";
  export const systemPrompt: string = "";

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Local state for UI
  let isListening = false;
  let showConversation = false;
  let showToolCalls = false;
  let showAvailableTools = false;
  let showMCPManager = false;
  let expandedToolCalls = new Set<string>();
  
  // Determine if conversation is active (not idle)
  $: isConversationActive = status !== "Idle";
  
  // Show tool calls if there are any
  $: hasToolCalls = toolCalls && toolCalls.length > 0;
  
  // Show conversation if there's history
  $: hasConversationHistory = conversationHistory && conversationHistory.length > 0;
  
  // Get available tools (mock for now - will be replaced with actual MCP service)
  $: availableTools = [];
  
  // Debug conversation history
  $: console.log("MCPVoiceUI conversationHistory:", conversationHistory, "hasConversationHistory:", hasConversationHistory);
  
  // Toggle tool call expansion
  function toggleToolCall(toolCallId: string) {
    if (expandedToolCalls.has(toolCallId)) {
      expandedToolCalls.delete(toolCallId);
    } else {
      expandedToolCalls.add(toolCallId);
    }
    expandedToolCalls = new Set(expandedToolCalls);
  }

  // Handle microphone toggle
  function handleMicrophoneToggle() {
    if (isConversationActive) {
      dispatch('stop-recording', { 
        resetConversation: false, 
        force: true,
        reason: 'ui_microphone_toggle'
      });
    } else {
      dispatch('toggle-microphone');
    }
  }

  // Get status display text
  function getStatusText(status: string) {
    switch (status) {
      case "Idle":
        return "Ready to start";
      case "Listening":
        return "Listening...";
      case "Recording":
        return "Recording your voice...";
      case "Processing":
        return "Processing speech...";
      case "responding":
        return "AI is responding...";
      case "responding_with_mcp":
        return "AI is responding with tools...";
      case "mcp_processing":
        return "Processing with MCP tools...";
      case "tts_processing":
        return "Generating speech...";
      case "tts_processing_with_mcp":
        return "Generating speech (with tools)...";
      default:
        return status;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "Idle":
        return "text-gray-500";
      case "Listening":
        return "text-orange-500";
      case "Processing":
        return "text-orange-600";
      case "Responding":
        return "text-orange-700";
      default:
        return "text-gray-500";
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-orange-50 to-white flex flex-col relative overflow-hidden">
  <!-- Header -->
  <div class="bg-gray-900 border-b border-gray-700">
    <div class="w-full px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-6">
          <div class="h-12">
            <img src={GroqLabsLogo} alt="GroqLabs Logo" class="h-full object-contain" />
          </div>
          <div>
            <h1 class="text-xl font-semibold text-white">MCP Voice Assistant</h1>
            <p class="text-sm text-gray-300">Powered by Groq | Fast AI Inference</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 flex flex-col items-center justify-center px-6 py-12">
    
    <!-- Central Voice Control -->
    <div class="flex flex-col items-center space-y-8">
      
      <!-- Main Microphone Button -->
      <div class="relative">
        <button
          on:click={handleMicrophoneToggle}
          class="w-32 h-32 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-105 {isRecording ? 'animate-pulse bg-red-500 hover:bg-red-600' : ''} {isConversationActive && !isRecording ? 'bg-orange-400 shadow-orange-200' : ''}"
          disabled={status === "Processing"}
        >
          {#if isRecording}
            <Square class="w-12 h-12 text-white" />
          {:else if isConversationActive}
            <MicOff class="w-12 h-12 text-white" />
          {:else}
            <Mic class="w-12 h-12 text-white" />
          {/if}
        </button>
        
        <!-- Status indicator ring -->
        {#if isConversationActive}
          <div class="absolute inset-0 rounded-full border-4 border-orange-300 animate-ping"></div>
        {/if}
      </div>

      <!-- Status Text -->
      <div class="text-center">
        <p class="text-lg font-medium {getStatusColor(status)}">{getStatusText(status)}</p>
        {#if error}
          <p class="text-red-500 text-sm mt-2">{error}</p>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-col items-center space-y-4">
        <div class="flex space-x-4">
          {#if isConversationActive}
            <Button 
              variant="outline" 
              onclick={() => dispatch('stop-recording', { 
                resetConversation: false, 
                force: true,
                reason: 'ui_stop_button'
              })}
              class="border-red-200 text-red-600 hover:bg-red-50"
            >
              <Square class="w-4 h-4 mr-2" />
              Stop Session
            </Button>
          {/if}
        </div>
        
        <!-- MCP Settings Button -->
        <div>
          <Button 
            variant="outline"
            size="sm"
            onclick={() => showMCPManager = !showMCPManager}
            class="border-orange-200 text-orange-600 hover:bg-orange-50"
          >
            <Server class="w-4 h-4 mr-2" />
            MCP Servers
          </Button>
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

  <!-- Bottom Panel - Collapsible Sections -->
  <div class="bg-white/90 backdrop-blur-sm border-t border-orange-100 px-6 py-4">
    <div class="max-w-6xl mx-auto space-y-4">
      
      <!-- Conversation History Toggle -->
      {#if hasConversationHistory}
        <div class="border border-orange-200 rounded-lg overflow-hidden">
          <button
            on:click={() => showConversation = !showConversation}
            class="w-full flex items-center justify-between px-4 py-3 bg-orange-50 hover:bg-orange-100 transition-colors"
          >
            <div class="flex items-center space-x-2">
              <MessageCircle class="w-4 h-4 text-orange-600" />
              <span class="font-medium text-gray-800">Conversation History</span>
              <span class="text-sm text-gray-500">({conversationHistory.length} messages)</span>
            </div>
            <svelte:component this={showConversation ? ChevronDown : ChevronRight} class="w-4 h-4 text-gray-600" />
          </button>
          
          {#if showConversation}
            <div class="max-h-64 overflow-y-auto border-t border-orange-200">
              {#each conversationHistory as message, i}
                <div class="flex items-start space-x-3 px-4 py-3 {i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
                  <div class="flex-shrink-0">
                    <svelte:component this={message.role === 'user' ? User : Bot} class="w-5 h-5 text-gray-500 mt-0.5" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-2">
                      <span class="text-sm font-medium text-gray-900 capitalize">{message.role}</span>
                    </div>
                    <p class="text-sm text-gray-700 mt-1 break-words">{message.content}</p>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Tool Calls Toggle -->
      {#if hasToolCalls}
        <div class="border border-orange-200 rounded-lg overflow-hidden">
          <button
            on:click={() => showToolCalls = !showToolCalls}
            class="w-full flex items-center justify-between px-4 py-3 bg-orange-50 hover:bg-orange-100 transition-colors"
          >
            <div class="flex items-center space-x-2">
              <CreditCard class="w-4 h-4 text-orange-600" />
              <span class="font-medium text-gray-800">Tool Calls</span>
              <span class="text-sm text-gray-500">({toolCalls.length} calls)</span>
            </div>
            <svelte:component this={showToolCalls ? ChevronDown : ChevronRight} class="w-4 h-4 text-gray-600" />
          </button>
          
          {#if showToolCalls}
            <div class="max-h-64 overflow-y-auto border-t border-orange-200">
              {#each toolCalls as toolCall, i}
                <div class="border-b border-orange-100 last:border-b-0">
                  <button
                    on:click={() => toggleToolCall(toolCall.id)}
                    class="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-50 transition-colors text-left"
                  >
                    <div class="flex items-center space-x-2">
                      <div class="flex items-center space-x-2">
                        {#if toolCall.status === 'completed'}
                          <CheckCircle class="w-4 h-4 text-green-500" />
                        {:else if toolCall.status === 'error'}
                          <XCircle class="w-4 h-4 text-red-500" />
                        {:else}
                          <Loader2 class="w-4 h-4 text-orange-500 animate-spin" />
                        {/if}
                        <span class="text-sm font-medium">{toolCall.name}</span>
                      </div>
                    </div>
                    <svelte:component this={expandedToolCalls.has(toolCall.id) ? ChevronDown : ChevronRight} class="w-4 h-4 text-gray-400" />
                  </button>
                  
                  {#if expandedToolCalls.has(toolCall.id)}
                    <div class="px-4 pb-3 space-y-2 bg-gray-50">
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
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
