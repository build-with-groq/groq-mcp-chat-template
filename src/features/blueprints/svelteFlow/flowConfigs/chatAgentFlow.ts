import { 
  MessageCircle, 
  Bot, 
  Send,
  CreditCard,
} from '@lucide/svelte';
import GroqIcon from '@shared/components/icons/GroqIcon.svelte';
import { Position, type Node, type Edge } from '@xyflow/svelte';
import { defaultTheme } from '../themes/defaultTheme';

// Function to get the Chat Agent Flow configuration
export function getDefaultChatAgentFlow() {
  const theme = defaultTheme;

  // Helper function for node click events
  const createNodeClickHandler = (id: string) => {
    return () => {
      // Dispatch a custom event on the document that can be captured by listeners
      if (typeof document !== 'undefined') {
        const event = new CustomEvent('flow:nodeClick', {
          bubbles: true,
          composed: true,
          detail: { nodeId: id }
        });
        document.dispatchEvent(event);
      }
    };
  };

  // Define nodes
  const nodes: Node[] = [
    // Input node
    { 
      id: 'input', 
      type: 'turbo', 
      data: { 
        label: 'Message Input',
        icon: MessageCircle,
        subtitle: 'User Types',
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        onClick: createNodeClickHandler('input'),
        isActive: false,
        isProcessing: false,
        isCompleted: false
      }, 
      position: { x: 50, y: 150 },
    },
    
    // Processing node
    { 
      id: 'processing', 
      type: 'turbo', 
      data: { 
        label: 'Processing',
        icon: GroqIcon,
        subtitle: 'Text Analysis',
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        onClick: createNodeClickHandler('processing'),
        isActive: false,
        isProcessing: false,
        isCompleted: false
      }, 
      position: { x: 250, y: 150 },
    },

    // LLM node  
    { 
      id: 'llm', 
      type: 'turbo', 
      data: { 
        label: 'LLM',
        icon: Bot,
        subtitle: 'AI Response',
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        onClick: createNodeClickHandler('llm'),
        isActive: false,
        isProcessing: false,
        isCompleted: false
      }, 
      position: { x: 450, y: 150 },
    },

    // MCP node (optional path)
    { 
      id: 'mcp', 
      type: 'turbo', 
      data: { 
        label: 'MCP Tools',
        icon: CreditCard,
        subtitle: 'Tool Execution',
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        onClick: createNodeClickHandler('mcp'),
        isActive: false,
        isProcessing: false,
        isCompleted: false
      }, 
      position: { x: 450, y: 50 },
    },

    // Response node
    { 
      id: 'response', 
      type: 'turbo', 
      data: { 
        label: 'Response',
        icon: Send,
        subtitle: 'Display Result',
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        onClick: createNodeClickHandler('response'),
        isActive: false,
        isProcessing: false,
        isCompleted: false
      }, 
      position: { x: 650, y: 150 },
    },
  ];

  // Define edges
  const edges: Edge[] = [
    // Main flow path
    { id: 'input-processing', source: 'input', target: 'processing', animated: true },
    { id: 'processing-llm', source: 'processing', target: 'llm', animated: true },
    { id: 'llm-response', source: 'llm', target: 'response', animated: true },
    
    // MCP optional path
    { id: 'llm-mcp', source: 'llm', target: 'mcp', animated: true, style: 'stroke-dasharray: 5,5' },
    { id: 'mcp-response', source: 'mcp', target: 'response', animated: true, style: 'stroke-dasharray: 5,5' },
  ];

  return {
    nodes,
    edges,
    theme,
    title: 'Chat Agent Flow',
    description: 'Text-based chat interaction with MCP tool support'
  };
}
