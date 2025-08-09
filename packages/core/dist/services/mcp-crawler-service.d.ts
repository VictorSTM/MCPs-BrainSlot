/**
 * Servicio que gestiona el MCP de Crawling (Python) como un servicio especializado
 * Mantiene todas las características del MCP original desarrollado por el equipo
 */
import type { ServerContext } from '../types.js';
export interface CrawlerMCPConfig {
    command: string;
    args: string[];
    cwd: string;
    env?: Record<string, string>;
    port?: number;
    stdio?: boolean;
}
export interface CrawlerCapabilities {
    tools: string[];
    version: string;
    features: string[];
}
export interface MCPRequest {
    jsonrpc: string;
    id: number | string;
    method: string;
    params?: any;
}
export interface MCPResponse {
    jsonrpc: string;
    id: number | string;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}
export declare class CrawlerMCPService {
    private config;
    private ctx;
    private process;
    private readline;
    private requestId;
    private pendingRequests;
    private initialized;
    private capabilities;
    constructor(config: CrawlerMCPConfig, ctx: ServerContext);
    start(): Promise<CrawlerCapabilities>;
    private initialize;
    crawlUrl(url: string, options?: any): Promise<any>;
    private extractTitle;
    convertCurrency(amount: number): Promise<number>;
    callTool(name: string, arguments_: any): Promise<any>;
    private sendRequest;
    private handleResponse;
    private cleanup;
    stop(): Promise<void>;
    isRunning(): boolean;
    getCapabilities(): CrawlerCapabilities | null;
}
