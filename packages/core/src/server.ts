/**
 * Lightweight runtime that *resembles* an MCP server.
 *
 * NOTE: Replace the TODO sections with the actual wiring to @modelcontextprotocol/sdk
 * when integrating. For now, this lets us develop the business logic + tests.
 */
import { Registry } from "./registry";
import { validateWithSchema } from "./schema";
import type { McpServer, ServerCapabilities, ServerContext, ToolDef } from "./types";

export class BrainSlotServer<C extends ServerContext = ServerContext> implements McpServer<C> {
  private registry = new Registry<C>();
  private running = false;

  constructor(private readonly ctx: C, private readonly protocolVersion = "2025-06-18") {}

  capabilities(): ServerCapabilities {
    return {
      protocolVersion: this.protocolVersion,
      tools: Array.from(this.registry.tools.values()),
      resources: this.registry.resources,
      resourceTemplates: this.registry.resourceTemplates,
      prompts: Array.from(this.registry.prompts.values()),
    };
  }

  addTool(def: ToolDef<C>) { this.registry.addTool(def); }
  addResource(r) { this.registry.addResource(r); }
  addResourceTemplate(t) { this.registry.addResourceTemplate(t); }
  addPrompt(p) { this.registry.addPrompt(p); }

  async start(opts?: { stdio?: boolean; http?: { port: number; host?: string; token?: string } }) {
    if (this.running) return;
    this.running = true;
    // TODO: bind to @modelcontextprotocol/sdk transports:
    //  - initialize handshake
    //  - tools/list, tools/call
    //  - resources/list|read|templates
    //  - prompts/list|get
    // For now we just log capabilities to stdout to validate wiring.
    // This makes `pnpm dev` useful in early UI integration.
    console.log(JSON.stringify({ type: "brainslot.capabilities", data: this.capabilities() }, null, 2));
  }

  async stop() { this.running = false; }
}
