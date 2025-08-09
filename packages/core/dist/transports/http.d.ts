/**
 * HTTP+SSE transport integration with @modelcontextprotocol/sdk
 */
export { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
export interface HttpOptions {
    port: number;
    host?: string;
    token?: string;
}
