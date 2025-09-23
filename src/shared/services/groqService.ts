import { writable, get } from 'svelte/store';
import { apiKeyStore } from '../stores/apiKeyStore';
import OpenAI from 'openai';

// Interface for the OpenAI service (still using Groq backend)
export interface GroqService {
  client: OpenAI;
  isReady: () => boolean;
  initialize: () => void;
}

// Create a singleton service using OpenAI SDK but with Groq backend
function createGroqService(): GroqService {
  // Create the OpenAI client configured to use Groq's API
  const client = new OpenAI({
    apiKey: '',
    baseURL: 'https://api.groq.com/openai/v1',
    dangerouslyAllowBrowser: true
  });

  // Store to track initialization state
  const initialized = writable(false);
  
  // Subscribe to the apiKeyStore to update the client's API key
  const unsubscribe = apiKeyStore.subscribe(state => {
    if (state.key) {
      client.apiKey = state.key;
      initialized.set(true);
    } else {
      initialized.set(false);
    }
  });

  // Make sure we don't leave dangling subscriptions when the app exits
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      unsubscribe();
    });
  }

  return {
    client,
    isReady: () => get(initialized),
    initialize: () => {
      // No initialization needed - store works in memory only
    }
  };
}

// Export the singleton instance
export const groqService = createGroqService(); 