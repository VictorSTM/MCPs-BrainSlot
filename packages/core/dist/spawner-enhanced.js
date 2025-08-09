/**
 * Spawner extendido que soporta servicios especializados como el MCP Crawler
 */
import { Spawner } from './spawner.js';
import { CrawlerMCPService } from './services/mcp-crawler-service.js';
import { SimpleBrainSlotServer } from './server-simple.js';
import { nanoid } from 'nanoid';
export class EnhancedSpawner extends Spawner {
    crawlerServices = new Map();
    enhancedRunning = new Map();
    async spawn(opts) {
        const id = nanoid(8);
        const ctx = { entityId: opts.entityId, dataRoot: opts.dataRoot };
        let crawlerService;
        let crawlerCapabilities;
        // Inicializar servicio de crawler si está habilitado
        if (opts.enableCrawler) {
            const crawlerConfig = {
                command: 'uv',
                args: ['run', 'main.py'],
                cwd: './external-mcps/crawler-mcp',
                stdio: true,
                ...opts.crawlerConfig
            };
            crawlerService = new CrawlerMCPService(crawlerConfig, ctx);
            try {
                crawlerCapabilities = await crawlerService.start();
                this.crawlerServices.set(ctx.entityId || 'general', crawlerService);
                console.log(`🕷️ [EnhancedSpawner] Crawler service attached to ${ctx.entityId || 'general'}`);
            }
            catch (error) {
                console.error(`❌ [EnhancedSpawner] Failed to start crawler service:`, error);
                console.log(`⚠️ [EnhancedSpawner] Continuing without crawler for ${ctx.entityId || 'general'}`);
                crawlerService = undefined;
            }
        }
        // Crear servidor BrainSlot simple (evita problemas con SDK)
        const server = new SimpleBrainSlotServer(ctx);
        // Si hay crawler disponible, registrar herramientas mejoradas
        if (crawlerService) {
            this.registerCrawlerTools(server, crawlerService);
        }
        // Iniciar transports
        if (opts.stdio) {
            await server.start({ stdio: true });
        }
        else if (opts.http) {
            const port = opts.http.port ?? 0;
            const token = opts.http.token ?? nanoid(16);
            await server.start({ http: { port, host: opts.http.host, token } });
        }
        else {
            await server.start();
        }
        const enhancedResult = {
            id,
            server,
            address: opts.http ? `http://${opts.http.host ?? "127.0.0.1"}:${opts.http.port ?? "<auto>"}` : undefined,
            token: opts.http?.token,
            crawlerService,
            crawlerCapabilities,
            stop: async () => {
                if (crawlerService) {
                    await crawlerService.stop();
                    this.crawlerServices.delete(ctx.entityId || 'general');
                }
                await server.stop();
                this.enhancedRunning.delete(id);
            }
        };
        this.enhancedRunning.set(id, enhancedResult);
        return enhancedResult;
    }
    getCrawlerService(entityId) {
        return this.crawlerServices.get(entityId || 'general');
    }
    list() {
        return Array.from(this.enhancedRunning.values()).map(({ id, address }) => ({ id, address }));
    }
    async stop(id) {
        const r = this.enhancedRunning.get(id);
        if (!r)
            return;
        await r.stop();
    }
    async stopAll() {
        // Parar todos los servicios de crawler
        for (const crawlerService of this.crawlerServices.values()) {
            await crawlerService.stop();
        }
        this.crawlerServices.clear();
        // Parar todos los servidores MCP
        for (const result of this.enhancedRunning.values()) {
            await result.stop();
        }
        this.enhancedRunning.clear();
    }
    registerCrawlerTools(server, crawlerService) {
        console.log('🔧 [EnhancedSpawner] Registrando herramientas mejoradas con crawler');
        // Sobrescribir bs.ingest_url con versión mejorada
        server.sdkServer.tool('bs.ingest_url', 'Ingesta una URL usando el MCP de crawling especializado desarrollado por el equipo (crawl4ai)', async (args) => {
            const { url, rules } = args || {};
            console.log(`🚀 [bs.ingest_url] Usando MCP Crawler especializado (Python/crawl4ai)`);
            console.log(`   URL: ${url}`);
            try {
                const crawlResult = await crawlerService.crawlUrl(url, rules || {});
                const jobId = `job_${Date.now()}`;
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                jobId,
                                accepted: true,
                                source: "specialized-crawler-mcp-python",
                                url: crawlResult.url || url,
                                title: crawlResult.title || 'Untitled',
                                contentSize: crawlResult.totalContentSize || 0,
                                contentPreview: crawlResult.content?.substring(0, 200) + '...' || '',
                                featuresUsed: crawlResult.featuresUsed || ['crawl4ai'],
                                timestamp: crawlResult.timestamp || new Date().toISOString(),
                                status: crawlResult.success ? "completed" : "failed",
                                crawlerVersion: crawlerService.getCapabilities()?.version
                            }, null, 2)
                        }]
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                jobId: `job_error_${Date.now()}`,
                                accepted: false,
                                error: error instanceof Error ? error.message : String(error),
                                source: "specialized-crawler-mcp-python",
                                url,
                                timestamp: new Date().toISOString(),
                                status: "failed"
                            }, null, 2)
                        }]
                };
            }
        });
        // Añadir herramienta de crawling avanzado
        server.sdkServer.tool('bs.advanced_crawl', 'Crawling avanzado con crawl4ai - extracción de markdown, procesamiento asíncrono', async (args) => {
            const { url, extractMarkdown = true, wordThreshold = 100 } = args || {};
            try {
                const result = await crawlerService.crawlUrl(url, {
                    extractMarkdown,
                    wordThreshold
                });
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                url: result.url,
                                title: result.title,
                                content: result.content,
                                contentSize: result.totalContentSize,
                                featuresUsed: result.featuresUsed,
                                timestamp: result.timestamp
                            }, null, 2)
                        }]
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                url,
                                error: error instanceof Error ? error.message : String(error),
                                timestamp: new Date().toISOString()
                            }, null, 2)
                        }]
                };
            }
        });
        // Añadir herramienta de conversión de monedas
        server.sdkServer.tool('bs.convert_currency', 'Convierte USD a EUR usando el MCP especializado (herramienta de demo)', async (args) => {
            const { amount } = args || {};
            try {
                const convertedAmount = await crawlerService.convertCurrency(amount);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                originalAmount: amount,
                                originalCurrency: "USD",
                                convertedAmount,
                                convertedCurrency: "EUR",
                                exchangeRate: 0.85,
                                timestamp: new Date().toISOString()
                            }, null, 2)
                        }]
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                amount,
                                error: error instanceof Error ? error.message : String(error),
                                timestamp: new Date().toISOString()
                            }, null, 2)
                        }]
                };
            }
        });
    }
}
