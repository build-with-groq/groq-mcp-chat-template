<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { TTSAudioBuffer } from "@shared/utils/tts-audio-buffer";
  import { groqService } from "@shared/services/groqService";
  import VoiceAgentFlowDiagram from "@features/blueprints/svelteFlow/VoiceAgentFlowDiagram.svelte";
  import DemoLayout from "@app/layouts/DemoLayout.svelte";
  import { apiKeyStore } from "@shared/stores/apiKeyStore";
  import { microphoneStore } from "@shared/stores/microphoneStore";
  import { mcpStore } from "@shared/stores/mcpStore";
  import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
  } from "@shared/components/ui/select";
  import type { MicrophoneDevice } from "@shared/stores/microphoneStore";
  import ApiKeyModal from "@shared/components/ApiKeyModal.svelte";
  import Button from "@shared/components/ui/button/button.svelte";
  import MCPVoiceUI from "./MCPVoiceUI.svelte";
  import { Eye, Settings2 } from "@lucide/svelte";

  // State for API key
  let apiKey = "";
  let currentApiKey = "";

  // Use the shared Groq client
  const groq = groqService.client;

  // System prompt for the agent
  export let systemPrompt =
    "You are a helpful MCP AI assistant powered by Groq. You can help with general questions and can use MCP tools when needed. For general conversations, respond naturally and helpfully. Always be clear, concise, and friendly. DO NOT READ BACK LONG IDs OR URLS ";

  // State
  let isRecording = false;
  let transcription = "";
  let agentResponse = "";
  let error = "";
  let audioDownloadUrl = "";
  let toolCalls: any[] = [];
  let status = "Idle";
  
  // Auto-start flag
  let hasAutoStarted = false;

  // UI View state
  let currentView: 'main' | 'technical' = 'main';

  // Add conversation history to maintain context
  let conversationHistory: Array<{ role: string; content: string }> = [];

  // Animation refs
  let flowDiagramComponent: VoiceAgentFlowDiagram;
  let animationMounted = false;

  // Audio recording
  let audioStream: MediaStream | null = null;

  // Audio playback
  let audioPlayer: HTMLAudioElement | null = null;

  // TTS Audio Buffer for streaming audio
  let ttsAudioBuffer: TTSAudioBuffer | null = null;

  // TTS request controller for aborting requests
  let ttsRequestController: AbortController | null = null;

  // VAD instance
  type VADInstance = {
    start: () => Promise<void>;
    stop: () => Promise<void>;
  };

  let vadInstance: VADInstance | null = null;
  let isMicTesting = false;

  // Ensure VAD dependencies are loaded
  let vadScriptsLoaded = false;

  // Add a complete shutdown flag to prevent automatic restart
  let isShutDown = false;

  // Add this with other state variables after line 40
  let stateMap: Record<
    string,
    { active: string; processing: string; completed: string[] }
  > = {};

  // Subscribe to the API key store
  const unsubscribe = apiKeyStore.subscribe((state) => {
    apiKey = state.key;
    currentApiKey = state.key;
  });

  // Microphone selection state
  let microphones: MicrophoneDevice[] = [];
  let selectedMicId: string = "";
  const unsubscribeMic = microphoneStore.subscribe((state) => {
    microphones = state.devices;
    selectedMicId =
      state.selectedDeviceId || (state.devices[0]?.deviceId ?? "");
  });

  // TTS voice selection state
  const ttsVoices = [
    "Arista-PlayAI",
    "Atlas-PlayAI",
    "Basil-PlayAI",
    "Briggs-PlayAI",
    "Calum-PlayAI",
    "Celeste-PlayAI",
    "Cheyenne-PlayAI",
    "Chip-PlayAI",
    "Cillian-PlayAI",
    "Deedee-PlayAI",
    "Fritz-PlayAI",
    "Gail-PlayAI",
    "Indigo-PlayAI",
    "Mamaw-PlayAI",
    "Mason-PlayAI",
    "Mikail-PlayAI",
    "Mitch-PlayAI",
    "Quinn-PlayAI",
    "Thunder-PlayAI",
  ];
  let selectedTTSVoice: string = "Basil-PlayAI";

  // Add AI model selection state
  const aiModels = [
   "openai/gpt-oss-20b",
   "openai/gpt-oss-120b"
  ];
  let selectedAIModel: string = "openai/gpt-oss-20b";
  let editableSystemPrompt: string = systemPrompt;

  // Enumerate microphones and update store
  // View toggle functions
  function switchView(view: 'main' | 'technical') {
    currentView = view;
  }



  async function updateMicrophoneList() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone (${d.deviceId.slice(-4)})`,
        }));
      microphoneStore.setDevices(mics);
    } catch (e) {
      console.error("Failed to enumerate microphones:", e);
      microphoneStore.setDevices([]);
    }
  }

  // On mount, update mic list and listen for device changes
  onMount(() => {
    updateMicrophoneList();
    navigator.mediaDevices.addEventListener(
      "devicechange",
      updateMicrophoneList,
    );
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        updateMicrophoneList,
      );
      unsubscribeMic();
    };
  });

  // Handle node clicks from the diagram
  function handleDiagramNodeClick(event: CustomEvent) {
    const nodeId = event.detail.nodeId;
    // Only take action if we're in Idle state
    if (status === "Idle" && nodeId === "start") {
      handleStartChat();
    }
  }

  // Handle diagram start event (play button)
  async function handleDiagramStart() {
    // Wait a moment for stores to initialize
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Check for API key before starting
    if (!apiKeyStore.hasApiKey()) {
      openApiKeyModal();
      return;
    }
          if (status === "Idle") {
        // Reset shutdown flag when starting explicitly
        isShutDown = false;

        // Start the conversation
        handleStartChat();
      }
  }

  // Handle diagram stop event
  function handleDiagramStop(event: CustomEvent) {
    const resetConversation = event?.detail?.resetConversation || false;
    
    // First update UI components to give immediate feedback
    status = "Idle";
    isRecording = false;
    isMicTesting = false;
    isShutDown = true; // Force shutdown flag

    // Reset the diagram explicitly
    if (
      flowDiagramComponent &&
      typeof flowDiagramComponent.forceReset === "function"
    ) {
      flowDiagramComponent.forceReset();
    }

    // Cancel any API calls or audio processing
    if (ttsRequestController) {
      try {
        ttsRequestController.abort();
        ttsRequestController = null;
      } catch (e) {
        console.error("Error aborting TTS request:", e);
      }
    }

    // Stop all audio streams
    if (audioStream) {
      audioStream.getTracks().forEach((track) => {
        track.stop();
      });
      audioStream = null;
    }

    // Reset audio players
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      audioPlayer.src = "";
    }

    // Reset TTS audio buffer
    if (ttsAudioBuffer) {
      ttsAudioBuffer.reset();
    }

    // Stop VAD instance if it exists
    if (vadInstance) {
      try {
        if (typeof vadInstance.stop === "function") {
          vadInstance.stop();
        }
      } catch (e) {
        console.error("Error stopping VAD from diagram stop:", e);
      } finally {
        vadInstance = null;
      }
    }

    // Only reset conversation history if explicitly requested (e.g., new conversation)
    if (resetConversation) {
      console.log("RESETTING conversation history from handleDiagramStop (explicit reset)");
      conversationHistory = [];
      toolCalls = [];
    }

    // Use our helper function to ensure complete cleanup (don't reset conversation by default)
    stopConversation(resetConversation);

    // Additional safety - call stopVAD explicitly for thorough cleanup
    stopVAD();
  }

  // Initialize on component mount

  onMount(async () => {
    try {
      
      // Initialize API key store to fetch stored API key
      // API key store no longer needs initialization

      // Initialize the shared Groq service
      groqService.initialize();

      // Initialize audio player (keeping this for compatibility)
      audioPlayer = new Audio();

      // Initialize TTS Audio Buffer
      ttsAudioBuffer = new TTSAudioBuffer({
        onAudioEnded: () => {
          // Only update to idle if we were responding
          if (status === "responding" || status === "responding_with_mcp") {
            // Change to listening state instead of idle, to show the VAD is active again
            status = "Listening";
          }
        },
      });

      // Connect the audio context after user interaction (will be done when starting conversation)

      // Load VAD scripts
      await loadVADScripts();

      // Mark animation as mounted after a short delay to ensure it's fully initialized
      setTimeout(() => {
        animationMounted = true;
        
        // Auto-start agent
        if (!hasAutoStarted) {
          hasAutoStarted = true;
          setTimeout(async () => {
            await autoStartAgent();
          }, 1000); // Additional 1 second delay after animation is ready
        }
      }, 500);
    } catch (e: unknown) {
      console.error("Error initializing voice agent:", e);
      error = e instanceof Error ? e.message : "Unknown error occurred";
    }
  });

  // Load VAD scripts
  async function loadVADScripts() {
    // Check if already loaded
    if (vadScriptsLoaded || typeof window.vad !== "undefined") {
      vadScriptsLoaded = true;
      return;
    }

    try {
      // First, set a global config for ONNX to use
      window.ortConfig = {
        wasm: {
          wasmPaths: {
            "ort-wasm.wasm":
              "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.0/dist/ort-wasm.wasm",
            "ort-wasm-simd.wasm":
              "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.0/dist/ort-wasm-simd.wasm",
            "ort-wasm-threaded.wasm":
              "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.0/dist/ort-wasm-threaded.wasm",
          },
        },
      };

      // Load ONNX Runtime
      const onnxScript = document.createElement("script");
      onnxScript.src =
        "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.0/dist/ort.min.js";
      document.head.appendChild(onnxScript);

      // Wait for ONNX to load
      await new Promise<void>((resolve) => {
        onnxScript.onload = () => resolve();
      });

      // Load VAD
      const vadScript = document.createElement("script");
      vadScript.src =
        "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.12/dist/bundle.min.js";
      document.head.appendChild(vadScript);

      // Wait for VAD to load
      await new Promise<void>((resolve) => {
        vadScript.onload = () => resolve();
      });

      vadScriptsLoaded = true;
    } catch (e) {
      console.error("Error loading VAD scripts:", e);
      error = "Failed to load VAD scripts";
      throw e;
    }
  }

  // Clean up on component destruction
  onDestroy(() => {
    stopVAD();

    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      audioStream = null;
    }

    // Clean up audio buffer
    if (ttsAudioBuffer) {
      ttsAudioBuffer.reset();
    }

    // Abort any TTS requests
    if (ttsRequestController) {
      ttsRequestController.abort();
      ttsRequestController = null;
    }

    // Clean up any download URLs
    if (audioDownloadUrl) {
      URL.revokeObjectURL(audioDownloadUrl);
    }

    // Unsubscribe from the API key store
    unsubscribe();
  });

  // Start recording audio with VAD
  async function startRecordingWithVAD() {
    // If system is shutdown, don't allow recording until explicit start
    if (isShutDown) {
      return;
    }

    // Prevent starting if already recording or in mic testing state
    if (isRecording || isMicTesting) {
      return;
    }

    // Make sure no previous VAD session is active by explicitly stopping
    if (vadInstance) {
      await stopVAD();
    }

    // Make sure VAD is loaded
    if (!vadScriptsLoaded) {
      await loadVADScripts();
    }

    if (typeof window.vad === "undefined") {
      throw new Error("VAD library not loaded correctly");
    }

    // Reset state before starting new session
    await stopVAD();

    // Initialize flags for new session
    isMicTesting = true;
    transcription = "";
    status = "Listening";

    // Connect audio context for playback after user interaction
    if (ttsAudioBuffer) {
      await ttsAudioBuffer.connectAudioContext();
    }

    // IMPORTANT: Always request a new microphone stream to avoid reusing invalid streams
    // We'll discard any existing stream first to ensure a clean state
    if (audioStream) {
      audioStream.getTracks().forEach((track) => {
        track.stop();
      });
      audioStream = null;
      // Don't reset micPermissionGranted, as we'll be requesting permission again
    }

    // Always get a fresh microphone permission
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      console.error("Failed to get microphone permission:", err);
      throw new Error(
        "Microphone permission denied. Please allow microphone access to use this feature.",
      );
    }

    // Create and configure VAD with the extracted configuration
    vadInstance = await createVADInstance();

    if (!vadInstance) {
      throw new Error("Failed to initialize VAD");
    }

    // Start VAD processing
    await vadInstance.start();
  }

  // Convert Float32Array audio data to WAV format
  async function float32ArrayToWav(audio: Float32Array): Promise<Blob> {
    // Sample rate from the VAD is always 16000
    const sampleRate = 16000;

    // Create a buffer
    const buffer = new ArrayBuffer(44 + audio.length * 2);
    const view = new DataView(buffer);

    // Write WAV headers
    // "RIFF" chunk descriptor
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + audio.length * 2, true);
    writeString(view, 8, "WAVE");

    // "fmt " sub-chunk
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // subchunk1size (16 for PCM)
    view.setUint16(20, 1, true); // audio format (1 for PCM)
    view.setUint16(22, 1, true); // num channels (1 for mono)
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample

    // "data" sub-chunk
    writeString(view, 36, "data");
    view.setUint32(40, audio.length * 2, true);

    // Write audio data
    const audioData = new Int16Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      // Convert float32 [-1.0, 1.0] to int16 [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, audio[i]));
      audioData[i] = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(44 + i * 2, audioData[i], true);
    }

    // Create and return blob
    return new Blob([buffer], { type: "audio/wav" });
  }

  // Helper function to write strings to DataView
  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // Stop VAD recording
  async function stopVAD() {
    // Set states to inactive first
    isMicTesting = false;
    isRecording = false;

    // Abort any TTS requests
    if (ttsRequestController) {
      try {
        ttsRequestController.abort();
      } catch (e) {
        console.error("Error aborting TTS request:", e);
      } finally {
        ttsRequestController = null;
      }
    }

    // Stop the VAD instance safely
    if (vadInstance) {
      try {
        // Check if stop is a function before calling it
        if (typeof vadInstance.stop === "function") {
          try {
            await vadInstance.stop();
          } catch (e) {
            console.error("Error stopping VAD:", e);
          }
        } else {
        }
      } catch (error) {
        console.error("Error when stopping VAD:", error);
      } finally {
        // Always make sure we clear the reference
        vadInstance = null;
      }
    }

    // IMPORTANT: Always clean up the audioStream to ensure we don't reuse an invalid stream
    if (audioStream) {
      audioStream.getTracks().forEach((track) => {
        track.stop();
      });
      audioStream = null;
      // Keep micPermissionGranted true since the user has at least once granted permission
    }

    // Reset any active audio player
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      audioPlayer.src = ""; // Clear the source
    }

    // Reset TTS audio buffer
    if (ttsAudioBuffer) {
      await ttsAudioBuffer.reset();
    }

    // Reset all processing flags and states
    transcription = "";
    agentResponse = "";
    status = "Idle";

    // Reset the flow diagram explicitly to ensure it shows the Start button
    if (flowDiagramComponent) {
      // First update the state to idle explicitly
      if (typeof flowDiagramComponent.forceReset === "function") {
        flowDiagramComponent.forceReset();
      }
    }

    // Add a small delay to ensure cleanup is complete before allowing restart
    return new Promise((resolve) => setTimeout(resolve, 300));
  }
  // Start the conversation - helper function
  function startConversation() {
    // Reset shutdown flag when explicitly starting
    isShutDown = false;

    // Do a light cleanup first to ensure any previous audio/VAD state is cleaned up
    // but don't reset the conversation history unless it's a new conversation
    handleStopChat(new CustomEvent("stopChat", { detail: { resetConversation: false } })).then(() => {
      // Ensure status is properly set before starting recording
      status = "Listening";
      startRecordingWithVAD();
    });
  }

  // Stop the conversation - helper function
  async function stopConversation(resetConversation = false) {
    // Set shutdown flag
    isShutDown = true;

    // Reset all UI components
    status = "Idle";

    // Reset the flow diagram if available - call multiple ways to ensure it works
    if (flowDiagramComponent) {
      if (typeof flowDiagramComponent.forceReset === "function") {
        flowDiagramComponent.forceReset();
      }
    }

    // Use the existing stop functionality with force flag
    await handleStopChat(
      new CustomEvent("stopChat", { detail: { force: true, resetConversation } }),
    );

    // Additional cleanup for VAD
    if (vadInstance) {
      try {
        await stopVAD();
      } catch (e) {
        console.error("Error stopping VAD:", e);
      }
    }
  }

  // Handle start chat event from animation
  async function handleStartChat() {
    // Wait a moment for stores to initialize
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Check for API key before starting
    if (!apiKeyStore.hasApiKey()) {
      openApiKeyModal();
      return;
    }
    
    // Make sure we're in idle state before starting
    if (status !== "Idle") {
      // If not idle, force a reset first
      resetToDefaultState().then(() => {
        // After reset, start the conversation
        startConversation();
      });
    } else {
      // Already idle, just start
      startConversation();
    }
  }

  // Handle stop chat event from animation
  async function handleStopChat(event: CustomEvent) {
    const forceStop = event && event.detail && event.detail.force;
    const resetDiagram = event && event.detail && event.detail.resetDiagram;
    const resetConversation = event && event.detail && event.detail.resetConversation;
    const reason = event?.detail?.reason || "unknown";

    // Set shutdown flag when force stopping
    if (forceStop) {
      isShutDown = true;
    }

    // Immediately update UI to give feedback
    status = "Idle";
    isMicTesting = false;
    isRecording = false;

    // Always reset the flow diagram explicitly when resetDiagram is true or from animation cancel
    const shouldResetDiagram =
      resetDiagram || reason === "cancel_button" || forceStop;

    if (shouldResetDiagram && flowDiagramComponent) {
      if (typeof flowDiagramComponent.forceReset === "function") {
        flowDiagramComponent.forceReset();
      }
    }

    // Cancel any active API requests
    if (ttsRequestController) {
      try {
        ttsRequestController.abort();
      } catch (e) {
        console.error("Error aborting TTS request:", e);
      } finally {
        ttsRequestController = null;
      }
    }

    // Force immediate cleanup of any existing VAD session
    if (vadInstance) {
      try {
        if (typeof vadInstance.stop === "function") {
          await vadInstance.stop().catch((e) => {
            console.error("Error stopping VAD in handleStopChat:", e);
          });
        }
        // Explicitly nullify the instance
        vadInstance = null;
      } catch (e) {
        console.error("Error stopping VAD instance:", e);
        // Ensure it's nullified even on error
        vadInstance = null;
      }
    }

    // Stop all audio tracks immediately
    if (audioStream) {
      audioStream.getTracks().forEach((track) => {
        track.stop();
      });
      audioStream = null;
    }

    // Stop TTS audio playback
    if (ttsAudioBuffer) {
      try {
        await ttsAudioBuffer.reset();
      } catch (e) {
        console.error("Error resetting TTS audio buffer:", e);
      }
    }

    // Reset audio player if it exists
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      audioPlayer.src = ""; // Clear the source
    }

    // Now do a full cleanup with the normal stopVAD function
    await stopVAD();

    // Reset all state variables to ensure clean restart
    transcription = "";
    agentResponse = "";

    // Reset conversation history only when explicitly requested
    if (resetConversation || forceStop) {
      console.log("RESETTING conversation history from handleStopChat (resetConversation or forceStop)");
      conversationHistory = [];
      toolCalls = [];

      // Explicitly set diagram state to idle
      if (flowDiagramComponent) {
        // Try multiple ways of ensuring the diagram is reset
        if (typeof flowDiagramComponent.forceReset === "function") {
          flowDiagramComponent.forceReset();
        }
      }
    }

    // Force a small delay before allowing restart to ensure cleanup is complete
    if (forceStop) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  // Send the audio to the backend for transcription
  async function sendAudioForTranscription(audioBlob: Blob) {
    try {
      // Check if we have an API key
      if (!apiKey) {
        throw new Error("No API key available. Please check your activation.");
      }

      // Prepare audio file for transcription

      // Use OpenAI client for transcription
      const response = await groq.audio.transcriptions.create({
        file: new File([audioBlob], 'audio.wav', { type: 'audio/wav' }),
        model: 'whisper-large-v3',
      });

      transcription = response.text;

      // Now get a response from the AI
      await getAgentResponse(transcription);
    } catch (e: unknown) {
      console.error("Error transcribing audio:", e);
      error = e instanceof Error ? e.message : "Failed to transcribe audio";

      // Reset to idle on error
      status = "Idle";
    }
  }



  // Get a response from the AI
  async function getAgentResponse(text: string) {
    if (!text) return;

    try {
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

      // Convert messages to input format for Responses API
      let input: string | any[] = "";
      if (messages.length > 1) {
        // If we have conversation history, use the latest user message as input
        const lastMessage = messages[messages.length - 1];
        input = lastMessage.content;
      }

      let response;
      
      // Use the Responses API for MCP tool support if MCP servers are available
      if (mcpTools.length > 0) {
        try {
          console.log("🔧 MCP Tools being sent to API:", JSON.stringify(mcpTools, null, 2));
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

        // Convert MCP calls to our internal tool call format
        const newToolCalls = mcpToolCalls
          .filter((item: any) => item.type === 'mcp_call')
          .map((mcpCall: any) => ({
            id: mcpCall.id,
            name: mcpCall.name,
            parameters: mcpCall.arguments ? JSON.parse(mcpCall.arguments) : {},
            status: mcpCall.error ? 'error' : 'completed',
            response: mcpCall.output ? JSON.parse(mcpCall.output) : null,
            error: mcpCall.error || null
          }));

        // Set tool calls from this request (already reset at start of function)
        toolCalls = newToolCalls;

        // Set appropriate status
        status = "tts_processing_with_mcp";
        console.log("🎵 Starting TTS processing (with MCP) - tools completed");

        // Add only the assistant response to conversation history (user message already added above)
        conversationHistory.push({ role: 'assistant', content: agentResponse });
      } else {
        // No MCP tools used - agentResponse already set from response.output_text
        
        // Set direct TTS processing status (no MCP)
        status = "tts_processing";
        
        // Add only the assistant response to conversation history (user message already added above)
        conversationHistory.push({ role: 'assistant', content: agentResponse });
      }

      // Trigger Svelte reactivity for conversation history
      conversationHistory = [...conversationHistory];
      console.log("Added assistant message to conversation history:", conversationHistory);

      // Change status to responding (with or without MCP based on tool usage)
      const usedTools = mcpToolCalls && mcpToolCalls.length > 0;
      status = usedTools ? "responding_with_mcp" : "responding";
      console.log(`🎤 Starting response - Used tools: ${usedTools}, Status: ${status}`);
      // Play the response as audio (only the latest response)
      await playResponseAudio(agentResponse);
    } catch (e: unknown) {
      console.error("Error getting AI response:", e);
      error = e instanceof Error ? e.message : "Failed to get AI response";
    }
  }

  // Play the response as audio using the TTSAudioBuffer
  async function playResponseAudio(text: string) {
    if (!text) return;

    try {
      // Check if we have an API key
      if (!apiKey) {
        throw new Error("No API key available.");
      }

      // Preserve the current status instead of overriding it
      // (Could be "responding" or "responding_with_mcp" based on tool usage)
      // Make sure audio buffer is initialized
      if (!ttsAudioBuffer) {
        ttsAudioBuffer = new TTSAudioBuffer({
          onAudioEnded: () => {
            // Only change status if we are currently in a responding mode
            if (status === "responding" || status === "responding_with_mcp") {
              status = "Listening";
            }
          },
          onAudioData: (audioData) => {
            // Only update if in responding mode
            if (status === "responding" || status === "responding_with_mcp") {
              // Process audio data to create smooth pulsing with speech
              const enhancedAudio = new Float32Array(audioData.length);

              // Apply smoothing and enhancement
              // Use a more direct approach focused on speech patterns
              for (let i = 0; i < audioData.length; i++) {
                // Directly enhance dB values for better visualization
                // Focus on speech range (-60 to -10 dB typical for speech)
                const normalizedValue = Math.min(
                  Math.max((audioData[i] + 70) / 60, 0),
                  1,
                );

                // Apply non-linear enhancement to make speech patterns more visible
                const enhancedValue = Math.pow(normalizedValue, 0.5) * 0.8;

                // Convert back to dB scale but with better range for visualization
                enhancedAudio[i] = -70 + enhancedValue * 50;
              }
            }
          },
        });
        await ttsAudioBuffer.connectAudioContext();
      } else {
        // Make sure the onAudioData callback is updated using the public method
        ttsAudioBuffer.updateAudioDataCallback((audioData) => {
          // Only update if in responding mode
          if (status === "responding" || status === "responding_with_mcp") {
            // Process audio data to create smooth pulsing with speech
            const enhancedAudio = new Float32Array(audioData.length);

            // Apply smoothing and enhancement
            // Use a more direct approach focused on speech patterns
            for (let i = 0; i < audioData.length; i++) {
              // Directly enhance dB values for better visualization
              // Focus on speech range (-60 to -10 dB typical for speech)
              const normalizedValue = Math.min(
                Math.max((audioData[i] + 70) / 60, 0),
                1,
              );

              // Apply non-linear enhancement to make speech patterns more visible
              const enhancedValue = Math.pow(normalizedValue, 0.5) * 0.8;

              // Convert back to dB scale but with better range for visualization
              enhancedAudio[i] = -70 + enhancedValue * 50;
            }
          }
        });
      }

      // Ensure we have an audio player for the animation component
      if (!audioPlayer) {
        audioPlayer = new Audio();
      }

      // Create a new abort controller for this request
      if (ttsRequestController) {
        ttsRequestController.abort();
      }
      ttsRequestController = new AbortController();

      // Set a timeout to detect slow network
      const firstByteTimeout = setTimeout(() => {
        console.warn("Poor network connection. Expect audio degradation.");
        error = "Poor network connection. Expect audio degradation.";
      }, 3000); 
      // 3 second threshold

      // Use OpenAI client for TTS
      const response = await groq.audio.speech.create({
        model: "playai-tts",
        voice: selectedTTSVoice,
        input: text,
        response_format: "wav",
        speed: 1.0,
      });

      // OpenAI client will throw an error if request fails
      clearTimeout(firstByteTimeout); // Clear the timeout since we got a response

      // Get the response as an arrayBuffer for audio processing
      const audioArrayBuffer = await response.arrayBuffer();
      if (!audioArrayBuffer) {
        throw new Error("No audio data received");
      }

      // Convert to Uint8Array for audio buffer processing
      const audioData = new Uint8Array(audioArrayBuffer);

      // Add the complete audio data to the buffer
      try {
        ttsAudioBuffer.addChunk(audioData);
        // Flush the buffer to start playback
        ttsAudioBuffer.flushBufferedData();
        console.log(`🎵 Added ${audioData.length} bytes of audio data to buffer`);
      } catch (e) {
        console.error("Error processing audio data:", e);
        throw e;
      }
    } catch (e: unknown) {
      console.error("Error playing response audio:", e);
      error = e instanceof Error ? e.message : "Failed to play response audio";

      // Reset status on error
      status = "Idle";
    }
  }

  // Clear error message
  function clearError() {
    error = "";
  }

  // Function to download the audio for inspection
  function downloadAudio() {
    if (!audioDownloadUrl) return;

    // Create a download link
    const a = document.createElement("a");
    a.href = audioDownloadUrl;
    a.download = "tts-audio.wav"; // Ensure .wav extension
    a.setAttribute("type", "audio/wav"); // Set MIME type
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Modify createVADInstance to use the existing audioStream
  async function createVADInstance() {
    if (
      !audioStream ||
      audioStream.getTracks().length === 0 ||
      audioStream.getTracks()[0].readyState !== "live"
    ) {
      console.error(
        "Invalid audio stream for VAD initialization:",
        audioStream,
      );
      throw new Error("Invalid audio stream for VAD initialization");
    }

    // Use the existing audioStream that already has permission
    const myvadOptions = {
      stream: audioStream, // Use the stream we already have permission for
      onSpeechStart: () => {
        // IMPORTANT: If system is shut down, ignore speech detection
        if (isShutDown) {
          return;
        }

        // Cancel any active TTS playback
        if (ttsAudioBuffer) {
          ttsAudioBuffer.reset();
        }

        // Reset all state flags
        isRecording = true;

        // Force the status change regardless of current state
        status = "Recording";
      },
      onSpeechEnd: async (audio: Float32Array) => {
        // IMPORTANT: If system is shut down, ignore speech end
        if (isShutDown) {
          return;
        }

        // Update state flags
        isRecording = false;

        // Only transition to Processing if we were in Recording mode
        // This prevents out-of-order callbacks from affecting state
        if (status === "Recording") {
          status = "Processing";

          // Process the audio data
          if (audio && audio.length > 0) {
            // Convert Float32Array to WAV format
            const wavBlob = await float32ArrayToWav(audio);
            await sendAudioForTranscription(wavBlob);
          } else {
            console.warn("Empty audio received from VAD");
            // Reset status if still listening
            if (isMicTesting) {
              status = "Listening";
            }
          }
        }
      },
      // Optional configuration
      positiveSpeechThreshold: 0.8, // Higher value (0.5-0.9) means more confident speech detection
      negativeSpeechThreshold: 0.5, // Lower this from 0.8 to 0.5 for faster silence detection
      minSpeechFrames: 5, // Lower this from 10 to 5 for faster speech detection
      preSpeechPadFrames: 5, // Frames to include before speech detection
      redemptionFrames: 10, // Lower this from 15 to 10 for even faster silence detection
      frequencyBandTo: 400, // Highest frequency band to use in the model's 512 frequency bands
      // Use the CDN urls for model and worklet files
      modelUrl:
        "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.12/dist/silero_vad.onnx",
      workletUrl:
        "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.12/dist/vad.worklet.bundle.min.js",
    };

    // Let the VAD create its own stream if we don't have a valid one
    if (!audioStream || audioStream.getTracks().length === 0) {
      return await window.vad.MicVAD.new(myvadOptions);
    } else {
      // Use our existing stream
      return await window.vad.MicVAD.new(myvadOptions);
    }
  }

  // Auto-start agent with welcome message
  async function autoStartAgent() {
    try {
      // Wait for stores to initialize
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Check if we have API key (should be auto-loaded now)
      if (!apiKeyStore.hasApiKey()) {
        console.log('No API key available for auto-start');
        return;
      }

      console.log('Agent auto-starting...');
      
      // Try to play welcome audio first, but don't block on it
      try {
        const audio = new Audio('/tts.wav');
        audio.preload = 'auto';
        
        // Set status to responding while attempting to play welcome (no tools for welcome)
        status = "responding";
        
        await new Promise<void>((resolve, reject) => {
          audio.onloadeddata = () => resolve();
          audio.onerror = reject;
          audio.load();
        });
        
        // Attempt to play - this might fail due to autoplay policy
        const playPromise = audio.play();
        
        audio.onended = () => {
          status = "Listening";
          startRecordingWithVAD();
        };
        
        // Handle the play promise properly
        await playPromise;
        
      } catch (audioError) {
        console.log('Could not play welcome audio (browser autoplay policy), starting listening mode:', audioError);
        // Immediately start listening mode if audio fails
        status = "Listening";
        startRecordingWithVAD();
      }
      
    } catch (error) {
      console.error('Error in auto-start:', error);
      // Fall back to idle state on error
      status = "Idle";
    }
  }


  // Reset everything to default state (orange nodes)
  async function resetToDefaultState() {
    // Set shutdown flag
    isShutDown = true;

    // Force stop with complete cleanup and reset conversation history
    await handleStopChat(
      new CustomEvent("stopChat", { detail: { force: true, resetConversation: true } }),
    );

    // Update UI status
    status = "Idle";

    // Explicitly reset the flow diagram if available
    if (
      flowDiagramComponent &&
      typeof flowDiagramComponent.forceReset === "function"
    ) {
      flowDiagramComponent.forceReset();
    }

    // Reset all state variables to ensure clean restart
    console.log("RESETTING conversation history from resetToDefaultState");
    transcription = "";
    agentResponse = "";
    conversationHistory = [];
    toolCalls = [];
  }

  // Update the stateMap for the new flow
  $: {
    if (!stateMap || Object.keys(stateMap).length === 0) {
      stateMap = {
        idle: { active: "", processing: "", completed: [] },
        listening: { active: "start", processing: "mic-on", completed: [] },
        recording: {
          active: "",
          processing: "vad",
          completed: ["start", "mic-on"],
        },
        processing: {
          active: "",
          processing: "stt",
          completed: ["start", "mic-on", "vad"],
        },
        responding: {
          active: "",
          processing: "audio-response",
          completed: ["start", "mic-on", "vad", "stt", "llm", "tts"],
        },
      };
    }
  }

  let isApiKeyModalOpen = false;
  function openApiKeyModal() {
    currentApiKey = apiKey;
    isApiKeyModalOpen = true;
  }
  function closeApiKeyModal() {
    isApiKeyModalOpen = false;
  }

  // MCP credentials modal functions will be added here in the future
</script>

<!-- View Toggle Controls -->
<div class="fixed top-4 right-4 z-50">
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
  <MCPVoiceUI
    {status}
    {isRecording}
    {transcription}
    {agentResponse}
    {error}
    {toolCalls}
    {conversationHistory}
    microphoneDevices={microphones}
    selectedMicrophoneDevice={microphones.find(m => m.deviceId === selectedMicId)}
    selectedModel={selectedAIModel}
    selectedVoice={selectedTTSVoice}
    {systemPrompt}
    on:toggle-microphone={handleDiagramStart}
    on:stop-recording={handleDiagramStop}
  />
{:else}
  <DemoLayout title="Voice Agent with Voice Activity Detection">
    <div slot="diagram" class="rounded-lg overflow-hidden">
      <VoiceAgentFlowDiagram
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
          <p class="font-medium text-sm">Microphone</p>
          <Select
            type="single"
            value={selectedMicId}
            onValueChange={(e) => microphoneStore.setSelectedDeviceId(e)}
          >
            <SelectTrigger
              >{microphones.find((m) => m.deviceId === selectedMicId)?.label ||
                "Select Microphone"}</SelectTrigger
            >
            <SelectContent>
              {#each microphones as mic}
                <SelectItem value={mic.deviceId}>{mic.label}</SelectItem>
              {/each}
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-2 max-w-xs">
          <p class="font-medium text-sm">Voice</p>
          <Select
            type="single"
            value={selectedTTSVoice}
            onValueChange={(e) => (selectedTTSVoice = e)}
          >
            <SelectTrigger>{selectedTTSVoice}</SelectTrigger>
            <SelectContent>
              {#each ttsVoices as voice}
                <SelectItem value={voice}>{voice}</SelectItem>
              {/each}
            </SelectContent>
          </Select>
        </div>
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
        <!-- MCP Credentials will be added here in the future -->
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
          {#if audioDownloadUrl}
            <button
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              onclick={downloadAudio}
            >
              Download Audio for Inspection
            </button>
          {/if}
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

<!-- MCP Credentials Modal will be added here in the future -->
