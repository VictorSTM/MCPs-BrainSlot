/**
 * Integración simplificada del MCP Crawler sin herencias complejas
 */
import { SimpleBrainSlotServer } from './server-simple.js';
import { CrawlerMCPService, CrawlerMCPConfig } from './services/mcp-crawler-service.js';
export interface SimpleCrawlerOptions {
    entityId?: string;
    dataRoot: string;
    enableCrawler?: boolean;
    crawlerConfig?: Partial<CrawlerMCPConfig>;
}
export interface SimpleCrawlerResult {
    id: string;
    server: SimpleBrainSlotServer;
    crawlerService?: CrawlerMCPService;
    crawlerCapabilities?: any;
    stop: () => Promise<void>;
}
export declare class SimpleCrawlerIntegration {
    private running;
    spawn(opts: SimpleCrawlerOptions): Promise<SimpleCrawlerResult>;
    private addCrawlerTools;
    list(): {
        id: string;
    }[];
    stop(id: string): Promise<void>;
    stopAll(): Promise<void>;
}
