import type { ServerContext, ToolDef } from "./types";
import type { CrawlerMCPService } from './services/mcp-crawler-service.js';
export declare function buildCoreTools(): ToolDef<ServerContext>[];
/**
 * Construye herramientas mejoradas que utilizan el MCP Crawler especializado (Python)
 */
export declare function buildCrawlerEnhancedTools(crawlerService: CrawlerMCPService): ToolDef<ServerContext>[];
