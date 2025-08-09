import type { McpServer, ServerCapabilities, ServerContext, ToolDef, ResourceDescriptor, ResourceTemplate, PromptTemplate } from "./types";
export declare class BrainSlotServer<C extends ServerContext = ServerContext> implements McpServer<C> {
    private readonly ctx;
    private readonly protocolVersion;
    private registry;
    private running;
    private sdkServer;
    private httpApp?;
    private httpTransports;
    constructor(ctx: C, protocolVersion?: string);
    capabilities(): ServerCapabilities;
    addTool(def: ToolDef<C>): void;
    addResource(res: ResourceDescriptor): void;
    addResourceTemplate(tpl: ResourceTemplate): void;
    addPrompt(prompt: PromptTemplate): void;
    start(opts?: {
        stdio?: boolean;
        http?: {
            port: number;
            host?: string;
            token?: string;
        };
    }): Promise<void>;
    private startHttpServer;
    stop(): Promise<void>;
}
