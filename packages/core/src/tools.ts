import type { JSONSchema7 } from "./util/jsonschema";
import type { ServerContext, ToolDef } from "./types";
import type { CrawlerMCPService } from './services/mcp-crawler-service.js';

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

/**
 * Construye herramientas mejoradas que utilizan el MCP Crawler especializado (Python)
 */
export function buildCrawlerEnhancedTools(crawlerService: CrawlerMCPService): ToolDef<ServerContext>[] {
  return [
    {
      name: "bs.ingest_url",
      description: "Ingesta una URL usando el MCP de crawling especializado desarrollado por el equipo (crawl4ai)",
      inputSchema: ingestUrlSchema,
      requiresApproval: true,
      handler: async (args, ctx) => {
        const { url, rules } = args as { url: string; rules?: any };
        
        console.log(`🚀 [bs.ingest_url] Usando MCP Crawler especializado (Python/crawl4ai)`);
        console.log(`   URL: ${url}`);
        console.log(`   EntityId: ${ctx.entityId || 'general'}`);
        console.log(`   Rules:`, JSON.stringify(rules, null, 2));

        try {
          // Usar el MCP de crawling desarrollado por el equipo
          const crawlResult = await crawlerService.crawlUrl(url, rules || {});

          const jobId = `job_${ctx.entityId || 'general'}_${Date.now()}`;
          
          console.log(`✅ [bs.ingest_url] Crawling completado con MCP especializado`);
          console.log(`   JobId: ${jobId}`);
          console.log(`   Content size: ${crawlResult.totalContentSize || 0} bytes`);
          console.log(`   Features used: ${crawlResult.featuresUsed?.join(', ') || 'crawl4ai'}`);

          return {
            jobId,
            accepted: true,
            source: "specialized-crawler-mcp-python",
            url: crawlResult.url || url,
            title: crawlResult.title || 'Untitled',
            pagesProcessed: crawlResult.pagesProcessed || 1,
            totalContentSize: crawlResult.totalContentSize || 0,
            contentPreview: crawlResult.content?.substring(0, 200) + '...' || '',
            featuresUsed: crawlResult.featuresUsed || ['crawl4ai', 'markdown-extraction'],
            timestamp: crawlResult.timestamp || new Date().toISOString(),
            status: crawlResult.success ? "completed" : "failed",
            // Datos específicos del crawler especializado
            crawlerVersion: crawlerService.getCapabilities()?.version,
            crawlerFeatures: crawlerService.getCapabilities()?.features,
            namespace: ctx.entityId ? `bs://entities/${ctx.entityId}` : 'bs://global'
          };

        } catch (error) {
          console.error(`❌ [bs.ingest_url] Error con MCP Crawler:`, error);
          
          return {
            jobId: `job_error_${Date.now()}`,
            accepted: false,
            error: error instanceof Error ? error.message : String(error),
            source: "specialized-crawler-mcp-python",
            url,
            timestamp: new Date().toISOString(),
            status: "failed",
            crawlerVersion: crawlerService.getCapabilities()?.version
          };
        }
      }
    },

    // Nueva herramienta específica para crawling avanzado con crawl4ai
    {
      name: "bs.advanced_crawl",
      description: "Crawling avanzado con crawl4ai - extracción de markdown, procesamiento asíncrono",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL a crawlear" },
          extractMarkdown: { type: "boolean", description: "Extraer contenido en formato markdown" },
          wordThreshold: { type: "number", description: "Mínimo de palabras para contenido válido" },
          includeScreenshot: { type: "boolean", description: "Incluir screenshot de la página" },
          bypassCache: { type: "boolean", description: "Omitir caché para contenido fresco" }
        },
        required: ["url"],
        additionalProperties: false
      } as const,
      requiresApproval: true,
      handler: async (args, ctx) => {
        const { url, extractMarkdown = true, wordThreshold = 100, includeScreenshot = false, bypassCache = true } = args as { url: string; extractMarkdown?: boolean; wordThreshold?: number; includeScreenshot?: boolean; bypassCache?: boolean };

        console.log(`🕷️ [bs.advanced_crawl] Crawling avanzado con crawl4ai: ${url}`);
        
        try {
          const result = await crawlerService.crawlUrl(url, {
            extractMarkdown,
            wordThreshold,
            includeScreenshot,
            bypassCache
          });

          return {
            success: true,
            url: result.url,
            title: result.title,
            content: result.content,
            markdown: result.markdown,
            contentSize: result.totalContentSize,
            featuresUsed: result.featuresUsed,
            timestamp: result.timestamp,
            namespace: ctx.entityId ? `bs://entities/${ctx.entityId}` : 'bs://global',
            crawlerCapabilities: crawlerService.getCapabilities()
          };
        } catch (error) {
          return {
            success: false,
            url,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
            namespace: ctx.entityId ? `bs://entities/${ctx.entityId}` : 'bs://global'
          };
        }
      }
    },

    // Herramienta de conversión de monedas (demo del MCP)
    {
      name: "bs.convert_currency",
      description: "Convierte USD a EUR usando el MCP especializado (herramienta de demo)",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Cantidad en USD a convertir" }
        },
        required: ["amount"],
        additionalProperties: false
      } as const,
      handler: async (args, ctx) => {
        const { amount } = args as { amount: number };

        console.log(`💱 [bs.convert_currency] Convirtiendo ${amount} USD a EUR`);
        
        try {
          const convertedAmount = await crawlerService.convertCurrency(amount);

          return {
            success: true,
            originalAmount: amount,
            originalCurrency: "USD",
            convertedAmount,
            convertedCurrency: "EUR",
            exchangeRate: 0.85,
            timestamp: new Date().toISOString(),
            namespace: ctx.entityId ? `bs://entities/${ctx.entityId}` : 'bs://global'
          };
        } catch (error) {
          return {
            success: false,
            amount,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
            namespace: ctx.entityId ? `bs://entities/${ctx.entityId}` : 'bs://global'
          };
        }
      }
    }
  ];
}
