/**
 * BrainSlot MCP Server - Real implementation using @modelcontextprotocol/sdk
 */
import { McpServer as SDKServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import express from "express";

import { Registry } from "./registry";
import { validateWithSchema } from "./schema";
import type { McpServer, ServerCapabilities, ServerContext, ToolDef, ResourceDescriptor, ResourceTemplate, PromptTemplate } from "./types";

export class BrainSlotServer<C extends ServerContext = ServerContext> implements McpServer<C> {
  private registry = new Registry<C>();
  private running = false;
  private sdkServer: SDKServer;
  private httpApp?: express.Application;
  private httpTransports: Map<string, SSEServerTransport> = new Map();

  constructor(private readonly ctx: C, private readonly protocolVersion = "2025-06-18") {
    // Initialize the real MCP SDK server
    this.sdkServer = new SDKServer({
      name: `brainslot-mcp${ctx.entityId ? `-${ctx.entityId}` : ''}`,
      version: "0.1.0"
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {}
      }
    });
  }

  capabilities(): ServerCapabilities {
    return {
      protocolVersion: this.protocolVersion,
      tools: Array.from(this.registry.tools.values()) as ToolDef<unknown>[],
      resources: this.registry.resources,
      resourceTemplates: this.registry.resourceTemplates,
      prompts: Array.from(this.registry.prompts.values()),
    };
  }

  addTool(def: ToolDef<C>) { 
    this.registry.addTool(def);
    
    // Convert our schema to Zod schema if needed
    const zodSchema: any = {};
    if (def.inputSchema?.properties) {
      for (const [key, prop] of Object.entries(def.inputSchema.properties)) {
        const typedProp = prop as any;
        if (typedProp.type === 'string') {
          zodSchema[key] = z.string();
          if (typedProp.description) {
            zodSchema[key] = zodSchema[key].describe(typedProp.description);
          }
        } else if (typedProp.type === 'number') {
          zodSchema[key] = z.number();
          if (typedProp.description) {
            zodSchema[key] = zodSchema[key].describe(typedProp.description);
          }
        } else if (typedProp.type === 'boolean') {
          zodSchema[key] = z.boolean();
          if (typedProp.description) {
            zodSchema[key] = zodSchema[key].describe(typedProp.description);
          }
        } else if (typedProp.type === 'object') {
          zodSchema[key] = z.object({});
          if (typedProp.description) {
            zodSchema[key] = zodSchema[key].describe(typedProp.description);
          }
        } else if (typedProp.type === 'array') {
          zodSchema[key] = z.array(z.string());
          if (typedProp.description) {
            zodSchema[key] = zodSchema[key].describe(typedProp.description);
          }
        }
      }
    }

    // Register with SDK server using the tool() method
    this.sdkServer.tool(def.name, def.description || '', zodSchema, async (args: any) => {
      try {
        const result = await def.handler(args, this.ctx);
        return {
          content: [
            { type: "text", text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }
          ]
        };
      } catch (error) {
        console.error(`Error executing tool ${def.name}:`, error);
        return {
          content: [
            { type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }
          ],
          isError: true
        };
      }
    });
  }

  addResource(res: ResourceDescriptor) { 
    this.registry.addResource(res);
    
    // Register with SDK server
    this.sdkServer.resource(res.title || res.uri, res.uri, {
      name: res.title || res.uri,
      description: res.description,
      mimeType: res.mimeType
    }, async () => {
      // TODO: Implement actual resource reading based on URI
      // For now, return placeholder content
      return {
        uri: res.uri,
        mimeType: res.mimeType || "application/json",
        text: JSON.stringify({ 
          message: "Resource content placeholder",
          uri: res.uri,
          entityId: this.ctx.entityId 
        }, null, 2)
      };
    });
  }

  addResourceTemplate(tpl: ResourceTemplate) { 
    this.registry.addResourceTemplate(tpl);
    
    // Register template with SDK server
    this.sdkServer.resource(`template-${tpl.uriTemplate}`, {
      uriTemplate: tpl.uriTemplate,
      name: `Template: ${tpl.uriTemplate}`,
      description: `Resource template for ${tpl.uriTemplate}`
    }, async (uri: string) => {
      // TODO: Implement actual template resource reading
      return {
        uri,
        mimeType: "application/json",
        text: JSON.stringify({ 
          message: "Template resource placeholder",
          uri,
          template: tpl.uriTemplate,
          entityId: this.ctx.entityId 
        }, null, 2)
      };
    });
  }

  addPrompt(prompt: PromptTemplate) { 
    this.registry.addPrompt(prompt);
    
    // Convert prompt arguments to Zod schema
    const zodSchema: any = {};
    if (prompt.arguments) {
      for (const arg of prompt.arguments) {
        zodSchema[arg.name] = z.string();
        if (arg.description) {
          zodSchema[arg.name] = zodSchema[arg.name].describe(arg.description);
        }
        if (!arg.required) {
          zodSchema[arg.name] = zodSchema[arg.name].optional();
        }
      }
    }

    // Register with SDK server
    this.sdkServer.prompt(prompt.name, prompt.description || '', zodSchema, async (args: any) => {
      const renderedContent = prompt.render(args || {});
      
      return {
        description: prompt.description,
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: renderedContent
          }
        }]
      };
    });
  }

  async start(opts?: { stdio?: boolean; http?: { port: number; host?: string; token?: string } }) {
    if (this.running) return;
    this.running = true;

    if (opts?.stdio) {
      // Start with stdio transport
      const transport = new StdioServerTransport();
      await this.sdkServer.connect(transport);
      console.log(JSON.stringify({ 
        type: "brainslot.capabilities", 
        transport: "stdio",
        entityId: this.ctx.entityId,
        data: this.capabilities() 
      }, null, 2));
    } else if (opts?.http) {
      // Start with HTTP+SSE transport
      await this.startHttpServer(opts.http);
    } else {
      // Default: just log capabilities for development
      console.log(JSON.stringify({ 
        type: "brainslot.capabilities", 
        transport: "none",
        entityId: this.ctx.entityId,
        data: this.capabilities() 
      }, null, 2));
    }
  }

  private async startHttpServer(opts: { port: number; host?: string; token?: string }) {
    this.httpApp = express();
    this.httpApp.use(express.json());

    // SSE endpoint for establishing the stream
    this.httpApp.get('/mcp', async (req, res) => {
      console.log(`[${this.ctx.entityId || 'general'}] Received SSE connection request`);
      
      try {
        const transport = new SSEServerTransport('/messages', res);
        const sessionId = (transport as any).sessionId;
        this.httpTransports.set(sessionId, transport);

        (transport as any).onclose = () => {
          console.log(`[${this.ctx.entityId || 'general'}] SSE transport closed for session ${sessionId}`);
          this.httpTransports.delete(sessionId);
        };

        await this.sdkServer.connect(transport);
        console.log(`[${this.ctx.entityId || 'general'}] SSE stream established with session: ${sessionId}`);
      } catch (error) {
        console.error(`[${this.ctx.entityId || 'general'}] Error establishing SSE stream:`, error);
        if (!res.headersSent) {
          res.status(500).send('Error establishing SSE stream');
        }
      }
    });

    // Messages endpoint for receiving client JSON-RPC requests
    this.httpApp.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      
      if (!sessionId) {
        res.status(400).send('Missing sessionId parameter');
        return;
      }

      const transport = this.httpTransports.get(sessionId);
      if (!transport) {
        res.status(404).send('Session not found');
        return;
      }

      try {
        await (transport as any).handlePostMessage(req, res, req.body);
      } catch (error) {
        console.error(`[${this.ctx.entityId || 'general'}] Error handling request:`, error);
        if (!res.headersSent) {
          res.status(500).send('Error handling request');
        }
      }
    });

    // Start HTTP server
    return new Promise<void>((resolve, reject) => {
      this.httpApp!.listen(opts.port, opts.host || '127.0.0.1', (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          console.log(JSON.stringify({ 
            type: "brainslot.server.ready",
            transport: "http+sse",
            entityId: this.ctx.entityId,
            address: `http://${opts.host || '127.0.0.1'}:${opts.port}`,
            token: opts.token,
            data: this.capabilities() 
          }, null, 2));
          resolve();
        }
      });
    });
  }

  async stop() { 
    this.running = false;
    
    // Close SDK server connection
    await this.sdkServer.close();
    
    // Close all HTTP transports
    for (const [sessionId, transport] of this.httpTransports) {
      try {
        await (transport as any).close();
      } catch (error) {
        console.error(`Error closing transport ${sessionId}:`, error);
      }
    }
    this.httpTransports.clear();
  }
}
