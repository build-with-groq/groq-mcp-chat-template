import { writable } from 'svelte/store';

// Interface for the store value
interface PasswordState {
  isAuthenticated: boolean;
  error?: string;
}

// Create writable store with default unauthenticated state
const createPasswordStore = () => {
  // Initial state - always authenticated (password gate disabled)
  const initialState: PasswordState = {
    isAuthenticated: true
  };

  const { subscribe, set, update } = writable<PasswordState>(initialState);

  // Auto-load password from environment on initialization
  const loadPasswordFromEnv = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        if (config.appPassword) {
          // Store the correct password for comparison
          correctPassword = config.appPassword;
        }
      }
    } catch (error) {
      console.log('Worker API not available, using development fallback');
      // Fallback for development mode
      correctPassword = 'mcp2025!';
    }
  };

  let correctPassword = '';

  // Initialize with environment values
  if (typeof window !== 'undefined') {
    // Use a small delay to ensure DOM is ready
    setTimeout(() => {
      loadPasswordFromEnv();
    }, 50);
  }

  return {
    subscribe,

    // Check password and authenticate
    authenticate: (password: string) => {
      if (password === correctPassword) {
        set({ isAuthenticated: true });
        return { success: true };
      } else {
        set({ 
          isAuthenticated: false, 
          error: 'Incorrect password' 
        });
        return { 
          success: false, 
          error: 'Incorrect password' 
        };
      }
    },

    // Get current authentication state
    isAuthenticated: () => {
      let currentState: PasswordState | undefined;
      const unsubscribe = subscribe(state => {
        currentState = state;
      });
      unsubscribe();
      return currentState?.isAuthenticated || false;
    },

    // Reset authentication state
    reset: () => {
      set(initialState);
    }
  };
};

// Export the store instance
export const passwordStore = createPasswordStore();
