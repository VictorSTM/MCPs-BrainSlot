/**
 * Placeholder transport hooks. Replace with real MCP HTTP + SSE wiring later.
 */
export interface HttpOptions { port: number; host?: string; token?: string }
export async function attachHttp(_opts: HttpOptions) {
  // TODO: use @modelcontextprotocol/sdk http server here
}
