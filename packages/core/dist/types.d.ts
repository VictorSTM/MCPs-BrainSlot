/**
 * Framework-agnostic types that mirror MCP primitives.
 * They let us implement and test without binding to a specific SDK right away.
 * Later we can adapt these to @modelcontextprotocol/sdk in one place.
 */
import type { JSONSchema7 } from "./util/jsonschema";
export type ToolInput = Record<string, unknown>;
export type ToolOutput = unknown;
export type ToolHandler<C = unknown> = (args: ToolInput, ctx: C) => Promise<ToolOutput>;
export interface ToolDef<C = unknown> {
    name: string;
    description?: string;
    inputSchema?: JSONSchema7;
    handler: ToolHandler<C>;
    requiresApproval?: boolean;
}
export interface ResourceDescriptor {
    uri: string;
    mimeType?: string;
    title?: string;
    description?: string;
}
export interface ResourceTemplate {
    uriTemplate: string;
    parameters?: Array<{
        name: string;
        description?: string;
        required?: boolean;
    }>;
}
export interface PromptArg {
    name: string;
    description?: string;
    required?: boolean;
}
export interface PromptTemplate {
    name: string;
    description?: string;
    arguments?: PromptArg[];
    render: (args: Record<string, unknown>) => string;
}
export interface ServerCapabilities {
    protocolVersion: string;
    tools?: ToolDef<unknown>[];
    resources?: ResourceDescriptor[];
    resourceTemplates?: ResourceTemplate[];
    prompts?: PromptTemplate[];
}
export interface ServerContext {
    entityId?: string;
    dataRoot: string;
}
export interface McpServer<C = ServerContext> {
    capabilities(): ServerCapabilities;
    addTool(tool: ToolDef<C>): void;
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
    stop(): Promise<void>;
}
