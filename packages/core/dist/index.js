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
export * from "./services/mcp-crawler-service";
export * from "./simple-crawler-integration";
// App Entrypoint for the General MCP with Crawler Support
import { SimpleCrawlerIntegration } from "./simple-crawler-integration";
async function main() {
    const integration = new SimpleCrawlerIntegration();
    console.log('🚀 [BrainSlot] Iniciando con soporte para MCP Crawler especializado (Python/crawl4ai)');
    // 1) Start the **General** MCP con crawler habilitado
    const generalMCP = await integration.spawn({
        dataRoot: process.env.BS_DATA_ROOT ?? ".data",
        enableCrawler: process.env.BS_ENABLE_CRAWLER !== "false", // Por defecto habilitado
        crawlerConfig: {
            cwd: process.env.BS_CRAWLER_PATH || './external-mcps/crawler-mcp'
        }
    });
    console.log('✅ [BrainSlot] General MCP iniciado');
    if (generalMCP.crawlerService) {
        console.log('🕷️ [BrainSlot] Crawler service activo con características:');
        console.log('   Tools:', generalMCP.crawlerCapabilities?.tools.join(', '));
        console.log('   Features:', generalMCP.crawlerCapabilities?.features.join(', '));
    }
    // 2) Ejemplo de Entity MCP con crawler
    if (process.env.BS_SPAWN_ENTITY === "1") {
        const entityMCP = await integration.spawn({
            entityId: "entity_demo",
            dataRoot: ".data/entities/entity_demo",
            enableCrawler: true // Cada entidad puede tener su propio crawler
        });
        console.log('✅ [BrainSlot] Entity MCP iniciado con crawler dedicado');
    }
    // Manejar cierre graceful
    process.on('SIGINT', async () => {
        console.log('\n🛑 [BrainSlot] Cerrando servicios...');
        await integration.stopAll();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        console.log('\n🛑 [BrainSlot] Cerrando servicios (SIGTERM)...');
        await integration.stopAll();
        process.exit(0);
    });
}
main().catch((err) => {
    console.error('❌ [BrainSlot] Error fatal:', err);
    process.exit(1);
});
