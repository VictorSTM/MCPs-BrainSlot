/**
 * Spawner extendido que soporta servicios especializados como el MCP Crawler
 */
import { Spawner, SpawnOptions } from './spawner.js';
import { CrawlerMCPService, CrawlerMCPConfig } from './services/mcp-crawler-service.js';
import { SimpleBrainSlotServer } from './server-simple.js';
export interface EnhancedSpawnOptions extends SpawnOptions {
    enableCrawler?: boolean;
    crawlerConfig?: Partial<CrawlerMCPConfig>;
}
export interface EnhancedSpawnResult {
    id: string;
    server: SimpleBrainSlotServer;
    address?: string;
    token?: string;
    crawlerService?: CrawlerMCPService;
    crawlerCapabilities?: any;
    stop: () => Promise<void>;
}
export declare class EnhancedSpawner extends Spawner {
    private crawlerServices;
    private enhancedRunning;
    spawn(opts: EnhancedSpawnOptions): Promise<EnhancedSpawnResult>;
    getCrawlerService(entityId?: string): CrawlerMCPService | undefined;
    list(): {
        id: string;
        address: string | undefined;
    }[];
    stop(id: string): Promise<void>;
    stopAll(): Promise<void>;
    private registerCrawlerTools;
}
