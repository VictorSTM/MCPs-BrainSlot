import type { McpServer } from "./types";
export interface SpawnOptions {
    entityId?: string;
    dataRoot: string;
    http?: {
        port?: number;
        host?: string;
        token?: string;
    };
    stdio?: boolean;
}
export interface SpawnResult {
    id: string;
    server: McpServer;
    address?: string;
    token?: string;
    stop: () => Promise<void>;
}
export declare class Spawner {
    private running;
    spawn(opts: SpawnOptions): Promise<SpawnResult>;
    list(): {
        id: string;
        address: string | undefined;
    }[];
    stop(id: string): Promise<void>;
}
