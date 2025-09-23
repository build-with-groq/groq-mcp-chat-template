<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { writable } from 'svelte/store';
  import FlowDiagram from './FlowDiagram.svelte';
  import { getDefaultChatAgentFlow } from './flowConfigs/chatAgentFlow';
  
  // Event dispatcher for node clicks and state changes
  const dispatch = createEventDispatcher();
  
  // Input props
  export let currentState = 'idle';  // Current processing state (idle, processing, responding, etc.)
  export let stateMap: Record<string, { active: string, processing: string, completed: string[] }> = {}; // Map state names to diagram node states
  export let height = "400px";
  export let showWatermark = true;
  export let interactive = true;
  
  // Component reference
  let flowDiagramComponent: FlowDiagram;
  
  // Internal state
  let activeNode = '';
  let processingNode = '';
  let completedNodes: string[] = [];
  let isRunning = false;  // Track if the system is running or idle
  
  // Get the chat agent flow configuration
  const flowConfig = getDefaultChatAgentFlow();
  
  // Create writable store for nodes
  const nodesStore = writable(flowConfig.nodes);
  
  // Default state map if none provided
  $: {
    if (!stateMap || Object.keys(stateMap).length === 0) {
      stateMap = {
        'idle': { active: '', processing: '', completed: [] },
        'processing': { active: 'input', processing: 'processing', completed: ['input'] },
        'responding': { active: '', processing: 'llm', completed: ['input', 'processing'] },
        'responding_with_mcp': { 
          active: '', 
          processing: 'mcp', 
          completed: ['input', 'processing', 'llm'] 
        },
        'mcp_processing': { 
          active: '', 
          processing: 'mcp', 
          completed: ['input', 'processing', 'llm'] 
        },
        'completed': { 
          active: '', 
          processing: '', 
          completed: ['input', 'processing', 'llm', 'response'] 
        },
        'completed_with_mcp': { 
          active: '', 
          processing: '', 
          completed: ['input', 'processing', 'llm', 'mcp', 'response'] 
        }
      };
    }
  }
  
  // Map the current state to diagram states and update isRunning
  $: {
    // Force explicit isRunning reset when currentState is reset to idle/Idle
    if (currentState === 'idle' || currentState === 'Idle') {
      isRunning = false;
    }
    
    if (currentState && stateMap[currentState.toLowerCase()]) {
      const mapping = stateMap[currentState.toLowerCase()];
      activeNode = mapping.active;
      processingNode = mapping.processing;
      completedNodes = mapping.completed;
      
      // Debug flow state transitions
      console.log(`🔄 Chat Flow State: ${currentState} -> Processing: ${processingNode}, Completed: [${completedNodes.join(', ')}]`);
      
      // Set isRunning based on the state (true for anything other than idle)
      isRunning = currentState.toLowerCase() !== 'idle';
      
      // Explicitly reset flowDiagram when state is idle
      if (currentState.toLowerCase() === 'idle' && flowDiagramComponent) {
        if (typeof flowDiagramComponent.forceReset === 'function') {
          flowDiagramComponent.forceReset();
        }
      }
    } else {
      // Default to idle if state not found
      activeNode = '';
      processingNode = '';
      completedNodes = [];
      isRunning = false;
    }
  }
  
  // Reset all UI state to idle
  export function forceReset() {
    isRunning = false;
    activeNode = '';
    processingNode = '';
    completedNodes = [];
    
    // Also reset the internal flow diagram
    if (flowDiagramComponent && typeof flowDiagramComponent.forceReset === 'function') {
      flowDiagramComponent.forceReset();
    }
  }
  
  // Start processing (triggered by user input)
  export function startProcessing() {
    if (!isRunning) {
      isRunning = true;
      dispatch('start');
    }
  }
  
  // Stop processing
  export function stopProcessing() {
    if (isRunning) {
      isRunning = false;
      dispatch('stop', { 
        resetConversation: false,
        reason: 'user_stop' 
      });
    }
  }
  
  // Handle node clicks from the flow diagram
  function handleNodeClick(event: CustomEvent) {
    const nodeId = event.detail.nodeId;
    console.log(`Chat diagram node clicked: ${nodeId}`);
    
    // Forward the event up to parent components
    dispatch('nodeClick', { nodeId });
  }
  
  // Handle flow events (start/stop from diagram controls)
  function handleFlowStart(event: CustomEvent) {
    console.log('Chat flow start event received');
    startProcessing();
  }
  
  function handleFlowStop(event: CustomEvent) {
    console.log('Chat flow stop event received');
    stopProcessing();
  }
  
  // Handle flow control events (play/pause buttons on diagram)
  function handleFlowControl(event: CustomEvent) {
    const { action } = event.detail;
    console.log(`Chat flow control: ${action}`);
    
    switch (action) {
      case 'start':
      case 'play':
        startProcessing();
        break;
      case 'stop':
      case 'pause':
        stopProcessing();
        break;
      case 'reset':
        forceReset();
        break;
      default:
        console.warn(`Unknown flow control action: ${action}`);
    }
  }
</script>

<FlowDiagram 
  bind:this={flowDiagramComponent}
  nodes={nodesStore}
  flowConfig={flowConfig}
  {activeNode}
  {processingNode}  
  {completedNodes}
  {isRunning}
  {height}
  {showWatermark}
  {interactive}
  on:nodeClick={handleNodeClick}
  on:start={handleFlowStart}
  on:stop={handleFlowStop}
  on:control={handleFlowControl}
/>
