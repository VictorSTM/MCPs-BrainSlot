/**
 * Simplified BrainSlot MCP Server - Basic implementation for Fase 0
 */
import { McpServer as SDKServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import type { ServerContext } from "./types";

export class SimpleBrainSlotServer {
  private sdkServer: SDKServer;
  private running = false;

  constructor(private readonly ctx: ServerContext) {
    this.sdkServer = new SDKServer({
      name: `brainslot-mcp${ctx.entityId ? `-${ctx.entityId}` : ''}`,
      version: "0.1.0"
    }, {
      capabilities: {
        tools: {},
        logging: {}
      }
    });

    this.setupTools();
  }

  private setupTools() {
    // bs.create_dataset tool
    this.sdkServer.tool(
      'bs.create_dataset',
      'Crea un dataset a partir de fuentes existentes',
      async (args) => {
        const { name = 'unnamed-dataset', sourceIds = [] } = args as any;
        const datasetId = `ds_${Date.now()}`;
        
        console.log(`[${this.ctx.entityId || 'general'}] Creating dataset: ${name} with sources: ${sourceIds.join(', ')}`);
        
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              datasetId,
              name,
              sourceIds,
              entityId: this.ctx.entityId,
              created: new Date().toISOString()
            }, null, 2)
          }]
        };
      }
    );

    // bs.ingest_url tool
    this.sdkServer.tool(
      'bs.ingest_url',
      'Ingesta una URL y crea fuentes para datasets',
      async (args) => {
        const { url = 'https://example.com', rules = {} } = args as any;
        const jobId = `job_${Date.now()}`;
        
        console.log(`[${this.ctx.entityId || 'general'}] Ingesting URL: ${url}`);
        
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              jobId,
              url,
              rules,
              status: "queued",
              entityId: this.ctx.entityId,
              created: new Date().toISOString()
            }, null, 2)
          }]
        };
      }
    );

    // bs.query_entity tool
    this.sdkServer.tool(
      'bs.query_entity',
      'Consulta a una Entidad usando su contexto entrenado',
      async (args) => {
        const { entityId = 'default-entity', query = 'test query', topK = 5 } = args as any;
        
        console.log(`[${this.ctx.entityId || 'general'}] Querying entity ${entityId}: ${query}`);
        
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              entityId,
              query,
              answer: `(Placeholder answer for: "${query}")`,
              references: [],
              topK,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      }
    );

    // bs.train_entity tool
    this.sdkServer.tool(
      'bs.train_entity',
      'Entrena una Entidad con un dataset',
      async (args) => {
        const { entityId = 'default-entity', datasetId = 'default-dataset', strategy = 'rag' } = args as any;
        const runId = `run_${Date.now()}`;
        
        console.log(`[${this.ctx.entityId || 'general'}] Training entity ${entityId} with dataset ${datasetId} using ${strategy} strategy`);
        
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              runId,
              entityId,
              datasetId,
              strategy,
              status: "queued",
              estimatedDuration: "5-10 minutes",
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      }
    );
  }

  async start(opts?: { stdio?: boolean; http?: { port: number; host?: string; token?: string } }): Promise<void> {
    if (opts?.stdio) {
      await this.startStdio();
    } else if (opts?.http) {
      // Para simplicidad, usar stdio por ahora
      await this.startStdio();
    } else {
      await this.startStdio();
    }
  }

  async startStdio() {
    if (this.running) return;
    this.running = true;
    
    const transport = new StdioServerTransport();
    await this.sdkServer.connect(transport);
    
    console.error(JSON.stringify({
      type: "brainslot.server.ready",
      transport: "stdio",
      entityId: this.ctx.entityId,
      name: `brainslot-mcp${this.ctx.entityId ? `-${this.ctx.entityId}` : ''}`,
      version: "0.1.0",
      capabilities: ["tools"]
    }, null, 2));
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    await this.sdkServer.close();
  }
}
