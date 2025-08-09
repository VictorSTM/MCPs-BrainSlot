/**
 * Standalone per-Entity MCP launcher (invoked by the BrainSlot UI when a user configures one).
 * This file demonstrates how the UI can spawn isolated MCPs per Entidad.
 */
import { Spawner } from "@brainslot/mcp-core";

const entityId = process.env.BS_ENTITY_ID ?? "entity_unknown";
const dataRoot = process.env.BS_ENTITY_DATA_ROOT ?? `.data/entities/${entityId}`;
const transport = process.env.BS_ENTITY_TRANSPORT ?? "http";

async function main() {
  const spawner = new Spawner();
  const res = await spawner.spawn({
    entityId,
    dataRoot,
    stdio: transport === "stdio",
    http: transport === "http" ? { port: Number(process.env.BS_ENTITY_PORT ?? 0), host: "127.0.0.1" } : undefined
  });

  console.log(JSON.stringify({
    type: "brainslot.entity.ready",
    entityId,
    address: res.address,
    token: res.token
  }, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
