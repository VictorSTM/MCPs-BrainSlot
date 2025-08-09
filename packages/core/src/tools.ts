import type { JSONSchema7 } from "./util/jsonschema";
import type { ServerContext, ToolDef } from "./types";

// === JSON Schemas ===
const ingestUrlSchema: JSONSchema7 = {
  type: "object",
  properties: {
    url: { type: "string", format: "uri" },
    rules: { type: "object" }
  },
  required: ["url"],
  additionalProperties: false
};

const createDatasetSchema: JSONSchema7 = {
  type: "object",
  properties: {
    name: { type: "string" },
    sourceIds: { type: "array", items: { type: "string" } }
  },
  required: ["name"],
  additionalProperties: false
};

const trainEntitySchema: JSONSchema7 = {
  type: "object",
  properties: {
    entityId: { type: "string" },
    datasetId: { type: "string" },
    strategy: { enum: ["rag", "ft", "hybrid"] }
  },
  required: ["entityId", "datasetId", "strategy"],
  additionalProperties: false
};

const queryEntitySchema: JSONSchema7 = {
  type: "object",
  properties: {
    entityId: { type: "string" },
    query: { type: "string" },
    topK: { type: "number" }
  },
  required: ["entityId", "query"],
  additionalProperties: false
};

// === Tool Builders ===
export function buildCoreTools(): ToolDef<ServerContext>[] {
  return [
    {
      name: "bs.ingest_url",
      description: "Ingesta una URL y crea fuentes para datasets",
      inputSchema: ingestUrlSchema,
      requiresApproval: true,
      handler: async (args) => {
        // TODO: enqueue job in your pipeline; return jobId
        return { jobId: "job_" + Date.now(), accepted: true };
      }
    },
    {
      name: "bs.create_dataset",
      description: "Crea un dataset a partir de fuentes existentes",
      inputSchema: createDatasetSchema,
      handler: async (args) => {
        return { datasetId: "ds_" + Date.now() };
      }
    },
    {
      name: "bs.train_entity",
      description: "Entrena una Entidad (antes 'Avatar') con un dataset",
      inputSchema: trainEntitySchema,
      requiresApproval: true,
      handler: async (args) => {
        return { runId: "run_" + Date.now(), status: "queued" };
      }
    },
    {
      name: "bs.query_entity",
      description: "Consulta a una Entidad usando su contexto entrenado",
      inputSchema: queryEntitySchema,
      handler: async (args) => {
        // TODO: call RAG/FT backend; return answer + references
        return { answer: "(placeholder)", references: [] };
      }
    }
  ];
}
