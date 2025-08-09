export * from "./schema";
export * from "./types";
export * from "./server";
export * from "./registry";
export * from "./resources";
export * from "./tools";
export * from "./prompts";
export * from "./transports/stdio";
export * from "./transports/http";
export * from "./spawner";

// App Entrypoint for the General MCP
import { Spawner } from "./spawner";

async function main() {
  const spawner = new Spawner();

  // 1) Start the **General** MCP (no entityId)
  await spawner.spawn({
    dataRoot: process.env.BS_DATA_ROOT ?? ".data",
    stdio: process.env.BS_TRANSPORT === "stdio",
    http: process.env.BS_TRANSPORT === "http" ? { port: Number(process.env.BS_PORT ?? 7334), host: "127.0.0.1" } : undefined
  });

  // 2) (Optional) Example: also start a per-Entity MCP for testing
  if (process.env.BS_SPAWN_ENTITY === "1") {
    await spawner.spawn({ entityId: "entity_demo", dataRoot: ".data/entities/entity_demo", http: { port: 7444, host: "127.0.0.1" } });
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
