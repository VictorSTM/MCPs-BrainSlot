import type { ServerContext } from "./types";
export declare class SimpleBrainSlotServer {
    private readonly ctx;
    private sdkServer;
    private running;
    constructor(ctx: ServerContext);
    private setupTools;
    start(opts?: {
        stdio?: boolean;
        http?: {
            port: number;
            host?: string;
            token?: string;
        };
    }): Promise<void>;
    startStdio(): Promise<void>;
    stop(): Promise<void>;
}
