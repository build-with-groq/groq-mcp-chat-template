# MCP Chat Agent Template

**A complete template for building AI assistants with Model Context Protocol (MCP) integration and Groq's ultra-fast inference for intelligent chat experiences.**

## Live Demo

**[Live Demo Link](https://groq-chat-mcp-agent.groqcloud.dev)**

## Overview

This application demonstrates how to build intelligent AI agents that leverage MCP servers for enhanced capabilities while maintaining sub-second response times. Built as a complete, end-to-end template that you can fork, customize, and deploy.

**Key Features:**
- **Intelligent Chat Interface**: Real-time conversation with context preservation
- **MCP Integration**: Connect to multiple remote MCP servers for enhanced AI capabilities
- **Flow Visualization**: Interactive diagrams showing agent processing flow
- **Multi-Model Support**: Choose from various Groq models optimized for different use cases
- **Tool Integration**: Visual debugging and monitoring of MCP tool calls
- Sub-second response times, efficient concurrent request handling, and production-grade performance powered by Groq

## Architecture

**Tech Stack:**
- **Frontend:** Svelte 5 with TypeScript
- **UI Components:** Tailwind CSS, Bits UI, Lucide Icons
- **Flow Diagrams:** Svelte Flow for interactive visualizations
- **AI Infrastructure:** Groq API with MCP server integration
- **Deployment:** Cloudflare Workers (Wrangler)

## Quick Start

### Prerequisites
- Node.js 18+ and npm/pnpm
- Groq API key ([Create a free GroqCloud account and generate an API key here](https://console.groq.com/keys))

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/build-with-groq/groq-mcp-chat-template
   cd groq-mcp-chat-template
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Start the development server**
   ```bash
   npm run dev:vite
   # or
   pnpm dev:vite
   ```

4. **Configure your Groq API key**
   - Open the application in your browser
   - Click "Add API Key" in the interface
   - Enter your Groq API key

5. **Set up MCP servers (optional)**
   - Click "MCP Servers" to configure external tool integrations
   - Enable pre-configured servers like [Tavily](https://tavily.com) (web search), [Firecrawl](https://firecrawl.dev) (web scraping), or add custom servers

## Customization

This template is designed to be a foundation for you to get started with. Key areas for customization:

- **Model Selection:** Update Groq model configuration in the AI model dropdown (supports GPT, LLaMA, Qwen, and more)
- **MCP Servers:** Configure custom MCP servers in `src/shared/stores/mcpStore.ts`
- **UI/Styling:** Customize themes and components in `src/shared/components/ui/`
- **System Prompts:** Customize AI behavior through editable system prompts

## Features in Detail

### Chat Interface
- Real-time conversation with AI using Groq's fast inference
- Full conversation history with context preservation
- MCP tool integration for enhanced capabilities
- Technical view with flow diagrams and configuration options
- Tool call visualization and debugging

### MCP Integration
- Pre-configured integrations with popular services (Tavily, Firecrawl, Hugging Face, etc.)
- Support for custom MCP server configurations
- Real-time server status monitoring
- Configurable tool approval workflows

## Next Steps

### For Developers
- **Create your free GroqCloud account:** Access official API docs, the playground for experimentation, and more resources via [Groq Console](https://console.groq.com)
- **Build and customize:** Fork this repo and start customizing to build out your own application
- **Get support:** Connect with other developers building on Groq, chat with our team, and submit feature requests on our [Groq Developer Forum](https://community.groq.com)

### For Founders and Business Leaders
- **See enterprise capabilities:** This template showcases production-ready AI that can handle real-time business workloads
- **Discuss your needs:** [Contact our team](https://groq.com/enterprise-access/) to explore how Groq can accelerate your AI initiatives

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

Created by [Julian Francisco](https://www.linkedin.com/in/julian-francisco/).