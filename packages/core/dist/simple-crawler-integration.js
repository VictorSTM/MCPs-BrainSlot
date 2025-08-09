/**
 * Integración simplificada del MCP Crawler sin herencias complejas
 */
import { SimpleBrainSlotServer } from './server-simple.js';
import { CrawlerMCPService } from './services/mcp-crawler-service.js';
import { nanoid } from 'nanoid';
export class SimpleCrawlerIntegration {
    running = new Map();
    async spawn(opts) {
        const id = nanoid(8);
        const ctx = { entityId: opts.entityId, dataRoot: opts.dataRoot };
        console.log(`🚀 [SimpleCrawlerIntegration] Iniciando servidor para ${ctx.entityId || 'general'}`);
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
                console.log(`🕷️ [SimpleCrawlerIntegration] Crawler service iniciado para ${ctx.entityId || 'general'}`);
            }
            catch (error) {
                console.error(`❌ [SimpleCrawlerIntegration] Failed to start crawler service:`, error);
                console.log(`⚠️ [SimpleCrawlerIntegration] Continuando sin crawler`);
                crawlerService = undefined;
            }
        }
        // Crear servidor BrainSlot simple
        const server = new SimpleBrainSlotServer(ctx);
        // Si hay crawler disponible, registrar herramientas mejoradas
        if (crawlerService) {
            this.addCrawlerTools(server, crawlerService);
        }
        // Iniciar servidor
        await server.start({ stdio: true });
        const result = {
            id,
            server,
            crawlerService,
            crawlerCapabilities,
            stop: async () => {
                if (crawlerService) {
                    await crawlerService.stop();
                }
                await server.stop();
                this.running.delete(id);
            }
        };
        this.running.set(id, result);
        return result;
    }
    addCrawlerTools(server, crawlerService) {
        console.log('🔧 [SimpleCrawlerIntegration] Añadiendo herramientas mejoradas con crawler');
        // Acceder al sdkServer del SimpleBrainSlotServer
        const sdkServer = server.sdkServer;
        // Sobrescribir bs.ingest_url con versión mejorada
        sdkServer.tool('bs.ingest_url', 'Ingesta una URL usando el MCP de crawling especializado (crawl4ai)', async (args) => {
            const { url, rules } = args || {};
            console.log(`🚀 [bs.ingest_url] Usando MCP Crawler especializado`);
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
        sdkServer.tool('bs.advanced_crawl', 'Crawling avanzado con crawl4ai - extracción de markdown, procesamiento asíncrono', async (args) => {
            const { url, extractMarkdown = true, wordThreshold = 100 } = args || {};
            console.log(`🕷️ [bs.advanced_crawl] Crawling avanzado: ${url}`);
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
                                timestamp: result.timestamp,
                                crawlerCapabilities: crawlerService.getCapabilities()
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
        // Añadir herramienta de conversión de monedas (demo)
        sdkServer.tool('bs.convert_currency', 'Convierte USD a EUR usando el MCP especializado (demo)', async (args) => {
            const { amount } = args || {};
            console.log(`💱 [bs.convert_currency] Convirtiendo ${amount} USD a EUR`);
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
        console.log('✅ [SimpleCrawlerIntegration] Herramientas mejoradas registradas');
    }
    list() {
        return Array.from(this.running.values()).map(({ id }) => ({ id }));
    }
    async stop(id) {
        const r = this.running.get(id);
        if (!r)
            return;
        await r.stop();
    }
    async stopAll() {
        for (const result of this.running.values()) {
            await result.stop();
        }
        this.running.clear();
    }
}
