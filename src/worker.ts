/**
 * Cloudflare Worker to serve the Svelte application
 * This worker serves static assets from the built Svelte app
 */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS for API requests if needed
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // API endpoint to get configuration
    if (url.pathname === '/api/config') {
      const config = {
        groqApiKey: env.GROQ_API_KEY,
        appPassword: env.APP_PASSWORD
        // MCP configuration will be added here in the future
      };
      
      return new Response(JSON.stringify(config), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Try to get the asset from the static assets
    const assetResponse = await env.ASSETS.fetch(request);
    
    // If asset found, return it
    if (assetResponse.status !== 404) {
      // Add CORS headers to asset responses
      const response = new Response(assetResponse.body, assetResponse);
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    // For SPA routing, serve index.html for any non-asset routes
    if (url.pathname !== '/' && !url.pathname.includes('.')) {
      const indexRequest = new Request(new URL('/', request.url), request);
      const indexResponse = await env.ASSETS.fetch(indexRequest);
      
      if (indexResponse.status === 200) {
        const response = new Response(indexResponse.body, indexResponse);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }
    }

    // Return 404 if nothing found
    return new Response('Not Found', { 
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  },
} satisfies ExportedHandler<Env>;

interface Env {
  ASSETS: Fetcher;
  GROQ_API_KEY: string;
  APP_PASSWORD: string;
  // MCP environment variables will be added here in the future
}
