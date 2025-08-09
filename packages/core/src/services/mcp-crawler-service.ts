/**
 * Servicio que gestiona el MCP de Crawling (Python) como un servicio especializado
 * Mantiene todas las características del MCP original desarrollado por el equipo
 */

import { spawn, ChildProcess } from 'child_process';
import { createInterface, Interface } from 'readline';
import type { ServerContext } from '../types.js';

export interface CrawlerMCPConfig {
  command: string;           // 'uv' para Python
  args: string[];           // ['run', 'main.py'] del MCP-example
  cwd: string;              // './external-mcps/crawler-mcp'
  env?: Record<string, string>;
  port?: number;            // Puerto para HTTP si lo soporta
  stdio?: boolean;          // true para stdio, false para HTTP
}

export interface CrawlerCapabilities {
  tools: string[];          // Lista de herramientas disponibles
  version: string;
  features: string[];       // Características específicas del crawler
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

export class CrawlerMCPService {
  private process: ChildProcess | null = null;
  private readline: Interface | null = null;
  private requestId = 1;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private initialized = false;
  private capabilities: CrawlerCapabilities | null = null;

  constructor(
    private config: CrawlerMCPConfig,
    private ctx: ServerContext
  ) {}

  async start(): Promise<CrawlerCapabilities> {
    if (this.process) {
      throw new Error('Crawler MCP already started');
    }

    console.log(`🕷️ [CrawlerMCP] Iniciando servicio especializado de crawling (Python)`);
    console.log(`   Command: ${this.config.command} ${this.config.args.join(' ')}`);
    console.log(`   CWD: ${this.config.cwd}`);
    console.log(`   EntityId: ${this.ctx.entityId || 'general'}`);

    // Configurar variables de entorno específicas para el crawler
    const crawlerEnv = {
      ...process.env,
      ...this.config.env,
      // Pasar contexto de BrainSlot al crawler
      BRAINSLOT_ENTITY_ID: this.ctx.entityId || '',
      BRAINSLOT_DATA_ROOT: this.ctx.dataRoot,
      BRAINSLOT_NAMESPACE: this.ctx.entityId ? `bs://entities/${this.ctx.entityId}` : 'bs://global'
    };

    this.process = spawn(this.config.command, this.config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: crawlerEnv,
      cwd: this.config.cwd
    });

    if (!this.process.stdout || !this.process.stdin) {
      throw new Error('Failed to create crawler MCP process streams');
    }

    // Configurar comunicación JSON-RPC
    this.readline = createInterface({
      input: this.process.stdout
    });

    this.readline.on('line', (line) => {
      try {
        // Filtrar logs de Python y solo procesar JSON-RPC
        if (line.trim().startsWith('{') && line.includes('"jsonrpc"')) {
          const response: MCPResponse = JSON.parse(line);
          this.handleResponse(response);
        } else if (line.trim() && !line.includes('Extrayendo información') && !line.includes('Converting') && !line.includes('[INIT]')) {
          // Log de debug del crawler (filtrar logs de crawl4ai)
          if (!line.includes('WARNING') && !line.includes('warning:')) {
            console.log(`[CrawlerMCP Debug] ${line}`);
          }
        }
      } catch (error) {
        // Ignorar líneas que no son JSON-RPC válido
        if (line.trim() && line.includes('Error')) {
          console.error(`[CrawlerMCP] ${line}`);
        }
      }
    });

    // Manejar errores y logs del crawler
    this.process.stderr?.on('data', (data) => {
      const logLine = data.toString().trim();
      console.error(`[CrawlerMCP] ${logLine}`);
    });

    this.process.on('exit', (code, signal) => {
      console.log(`[CrawlerMCP] Process exited with code ${code}, signal ${signal}`);
      this.cleanup();
    });

    this.process.on('error', (error) => {
      console.error(`[CrawlerMCP] Process error:`, error);
      this.cleanup();
    });

    // Inicializar el MCP y obtener capabilities
    await this.initialize();
    
    console.log(`✅ [CrawlerMCP] Servicio iniciado correctamente`);
    console.log(`   Tools: ${this.capabilities?.tools.join(', ')}`);
    console.log(`   Features: ${this.capabilities?.features.join(', ')}`);
    
    return this.capabilities!;
  }

  private async initialize(): Promise<void> {
    console.log(`📡 [CrawlerMCP] Initializing MCP connection...`);

    // Esperar más tiempo para que el proceso se inicialice completamente
    await new Promise(resolve => setTimeout(resolve, 3000));

    const response = await this.sendRequest('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      clientInfo: {
        name: 'brainslot-mcp',
        version: '0.1.0'
      }
    });

    if (response.error) {
      throw new Error(`MCP initialization failed: ${response.error.message}`);
    }

    console.log(`✅ [CrawlerMCP] MCP initialized successfully`);

    // Esperar un poco más después de la inicialización
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Enviar notificación initialized (requerida por el protocolo MCP)
    console.log(`📡 [CrawlerMCP] Sending initialized notification...`);
    await this.sendNotification('notifications/initialized');
    
    // Esperar un poco más después de la notificación
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Skip tools/list since it's not working with this MCP implementation
    // Instead, use known tools from the MCP Python implementation
    console.log(`⚠️ [CrawlerMCP] Using known tools (tools/list not supported by this MCP)`);
    
    this.capabilities = {
      tools: ['extraer_info_web', 'usd_to_eur'], // Known tools from the MCP Python code
      version: response.result?.serverInfo?.version || '1.0.0',
      features: ['web-crawling', 'crawl4ai', 'markdown-extraction', 'async-processing']
    };

    console.log(`🔧 [CrawlerMCP] Available tools:`, this.capabilities.tools);
    this.initialized = true;
  }

  async crawlUrl(url: string, options: any = {}): Promise<any> {
    if (!this.initialized) {
      throw new Error('Crawler MCP not initialized');
    }

    console.log(`🕷️ [CrawlerMCP] Crawling URL: ${url}`);
    console.log(`   Options:`, JSON.stringify(options, null, 2));

    // Usar la herramienta específica del crawler MCP (Python)
    const result = await this.callTool('extraer_info_web', {
      url
    });

    console.log(`✅ [CrawlerMCP] Crawling completed`);
    
    // Adaptar el resultado para que sea compatible con la interfaz esperada
    return {
      url,
      title: this.extractTitle(result),
      content: result,
      markdown: result,
      totalContentSize: result.length,
      pagesProcessed: 1,
      featuresUsed: ['crawl4ai', 'markdown-extraction'],
      timestamp: new Date().toISOString(),
      success: !result.includes('Error al extraer')
    };
  }

  private extractTitle(content: string): string {
    // Extraer título de markdown
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      return titleMatch[1];
    }
    
    // Buscar en las primeras líneas
    const lines = content.split('\n').slice(0, 5);
    for (const line of lines) {
      if (line.trim() && line.length > 10 && line.length < 100) {
        return line.trim();
      }
    }
    
    return 'Untitled Page';
  }

  async convertCurrency(amount: number): Promise<number> {
    if (!this.initialized) {
      throw new Error('Crawler MCP not initialized');
    }

    console.log(`💱 [CrawlerMCP] Converting ${amount} USD to EUR`);
    
    const result = await this.callTool('usd_to_eur', {
      amount
    });

    return result;
  }

  async callTool(name: string, arguments_: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('Crawler MCP not initialized');
    }

    console.log(`🔧 [CrawlerMCP] Calling tool: ${name}`);
    
    const response = await this.sendRequest('tools/call', {
      name,
      arguments: arguments_
    });

    return response.content?.[0]?.text || response;
  }

  private async sendNotification(method: string, params?: any): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error('Crawler MCP process not running');
    }

    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };

    const notificationStr = JSON.stringify(notification) + '\n';
    this.process.stdin.write(notificationStr);
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.process?.stdin) {
      throw new Error('Crawler MCP process not running');
    }

    const id = this.requestId++;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Crawler MCP request ${method} timed out`));
      }, 60000); // Aumentado a 60 segundos para crawling

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const requestStr = JSON.stringify(request) + '\n';
      this.process!.stdin!.write(requestStr);
    });
  }

  private handleResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id as number);
    if (!pending) {
      console.warn(`[CrawlerMCP] Received response for unknown request ID: ${response.id}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id as number);

    if (response.error) {
      pending.reject(new Error(`Crawler MCP Error: ${response.error.message}`));
    } else {
      pending.resolve(response.result);
    }
  }

  private cleanup(): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Crawler MCP process terminated'));
    }
    this.pendingRequests.clear();

    this.readline?.close();
    this.readline = null;
    this.process = null;
    this.initialized = false;
    this.capabilities = null;
  }

  async stop(): Promise<void> {
    if (this.process) {
      console.log(`🛑 [CrawlerMCP] Stopping crawler service`);
      this.process.kill('SIGTERM');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (this.process && !this.process.killed) {
        console.log(`🔥 [CrawlerMCP] Force killing crawler process`);
        this.process.kill('SIGKILL');
      }
    }
  }

  isRunning(): boolean {
    return this.initialized && this.process !== null;
  }

  getCapabilities(): CrawlerCapabilities | null {
    return this.capabilities;
  }
}
