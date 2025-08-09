/**
 * Entity MCP Spawner: spin up per-Entity servers with isolated context roots.
 * Designed so the BrainSlot UI can 'Create MCP' per Entidad and manage lifecycle.
 */
import { BrainSlotServer } from "./server";
import { buildCoreTools } from "./tools";
import { baseResourceTemplates, seedResources } from "./resources";
import { defaultPrompts } from "./prompts";
import type { McpServer, ServerContext } from "./types";
import { nanoid } from "nanoid";

export interface SpawnOptions {
  entityId?: string; // undefined => General server
  dataRoot: string; // e.g., /var/brainslot/data or ./.data
  http?: { port?: number; host?: string; token?: string };
  stdio?: boolean;
}

export interface SpawnResult {
  id: string;
  server: McpServer;
  address?: string; // http address if any
  token?: string;   // bearer token if any
  stop: () => Promise<void>;
}

export class Spawner {
  private running = new Map<string, SpawnResult>();

  async spawn(opts: SpawnOptions): Promise<SpawnResult> {
    const id = nanoid(8);
    const ctx: ServerContext = { entityId: opts.entityId, dataRoot: opts.dataRoot };
    const server = new BrainSlotServer(ctx);

    // Register primitives
    for (const t of buildCoreTools()) server.addTool(t);
    for (const r of seedResources(ctx)) server.addResource(r);
    for (const rt of baseResourceTemplates()) server.addResourceTemplate(rt);
    for (const p of defaultPrompts()) server.addPrompt(p);

    // Start transports
    if (opts.stdio) {
      await server.start({ stdio: true });
    } else if (opts.http) {
      const port = opts.http.port ?? 0; // 0 => random port if supported later
      const token = opts.http.token ?? nanoid(16);
      await server.start({ http: { port, host: opts.http.host, token } });
    } else {
      await server.start();
    }

    const result: SpawnResult = {
      id,
      server,
      address: opts.http ? `http://${opts.http.host ?? "127.0.0.1"}:${opts.http.port ?? "<auto>"}` : undefined,
      token: opts.http?.token,
      stop: async () => { await server.stop(); this.running.delete(id); }
    };

    this.running.set(id, result);
    return result;
  }

  list() { return Array.from(this.running.values()).map(({ id, address }) => ({ id, address })); }

  async stop(id: string) {
    const r = this.running.get(id);
    if (!r) return;
    await r.stop();
  }
}
