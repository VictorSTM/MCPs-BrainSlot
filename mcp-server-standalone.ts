#!/usr/bin/env node

/**
 * Servidor MCP BrainSlot Standalone
 * 
 * Este servidor MCP funciona de forma independiente y puede ser usado por cualquier cliente MCP
 * (Claude Desktop, Cline, etc.) siguiendo el estándar MCP.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CrawlerMCPService, CrawlerMCPConfig } from './packages/core/src/services/mcp-crawler-service.js';
import type { ServerContext } from './packages/core/src/types.js';

class BrainSlotMCPServer {
  private server: Server;
  private crawlerService: CrawlerMCPService | null = null;
  private ctx: ServerContext;

  constructor() {
    this.ctx = {
      entityId: 'general',
      dataRoot: process.env.BS_DATA_ROOT || '.data'
    };

    this.server = new Server(
      {
        name: 'brainslot-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers() {
    // Handler para listar herramientas
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        {
          name: 'bs.ingest_url',
          description: 'Ingesta una URL usando el MCP de crawling especializado desarrollado por el equipo (crawl4ai)',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL a ingestar y crawlear'
              },
              rules: {
                type: 'object',
                description: 'Reglas de crawling (opcional)',
                properties: {
                  extractMarkdown: { type: 'boolean', default: true },
                  wordThreshold: { type: 'number', default: 50 },
                  respectRobots: { type: 'boolean', default: true }
                }
              }
            },
            required: ['url']
          }
        },
        {
          name: 'bs.advanced_crawl',
          description: 'Crawling avanzado con crawl4ai - extracción de markdown, procesamiento asíncrono',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL a crawlear' },
              extractMarkdown: { type: 'boolean', default: true },
              wordThreshold: { type: 'number', default: 100 },
              includeScreenshot: { type: 'boolean', default: false },
              bypassCache: { type: 'boolean', default: true }
            },
            required: ['url']
          }
        },
        {
          name: 'bs.convert_currency',
          description: 'Convierte USD a EUR usando el MCP especializado (herramienta de demo)',
          inputSchema: {
            type: 'object',
            properties: {
              amount: { type: 'number', description: 'Cantidad en USD a convertir' }
            },
            required: ['amount']
          }
        }
      ];

      return { tools };
    });

    // Handler para ejecutar herramientas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Inicializar crawler service si no está disponible
        if (!this.crawlerService && (name.startsWith('bs.ingest_url') || name.startsWith('bs.advanced_crawl') || name.startsWith('bs.convert_currency'))) {
          await this.initializeCrawlerService();
        }

        switch (name) {
          case 'bs.ingest_url':
            return await this.handleIngestUrl(args);
          
          case 'bs.advanced_crawl':
            return await this.handleAdvancedCrawl(args);
          
          case 'bs.convert_currency':
            return await this.handleConvertCurrency(args);
          
          default:
            throw new Error(`Herramienta desconocida: ${name}`);
        }
      } catch (error) {
        console.error(`❌ Error ejecutando ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error.message,
                tool: name,
                status: 'failed',
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }
    });
  }

  private async initializeCrawlerService(): Promise<void> {
    if (this.crawlerService) return;

    console.log('🕷️ [BrainSlot MCP] Inicializando servicio de crawler...');
    
    const crawlerConfig: CrawlerMCPConfig = {
      command: 'uv',
      args: ['run', 'main.py'],
      cwd: './external-mcps/crawler-mcp',
      stdio: true,
      env: {
        PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
        DEBUG: 'crawler:*'
      }
    };

    this.crawlerService = new CrawlerMCPService(crawlerConfig, this.ctx);
    
    try {
      const capabilities = await this.crawlerService.start();
      console.log('✅ [BrainSlot MCP] Crawler service inicializado:', capabilities);
    } catch (error) {
      console.error('❌ [BrainSlot MCP] Error inicializando crawler:', error);
      this.crawlerService = null;
      throw error;
    }
  }

  private async handleIngestUrl(args: any) {
    const { url, rules = {} } = args;
    
    if (!this.crawlerService) {
      throw new Error('Servicio de crawler no disponible');
    }

    console.log(`🔧 [BrainSlot MCP] Ingesta URL: ${url}`);
    
    const result = await this.crawlerService.crawlUrl(url, {
      extractMarkdown: rules.extractMarkdown ?? true,
      wordThreshold: rules.wordThreshold ?? 50,
      respectRobots: rules.respectRobots ?? true,
      ...rules
    });

    // Generar información del job
    const jobId = `ingest_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const content = result.markdown || result.content || '';
    const title = result.title || 'Página web crawleada';
    
    // Crear nombre de archivo basado en URL y timestamp
    const urlDomain = new URL(url).hostname.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    
    // Guardar contenido en archivos
    const outputDir = `${this.ctx.dataRoot}/crawled`;
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      // Crear directorio si no existe
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Guardar contenido principal
      const contentFileName = `${urlDomain}_${dateStr}_${timeStr}_content.md`;
      const contentFilePath = path.join(outputDir, contentFileName);
      fs.writeFileSync(contentFilePath, content, 'utf8');
      
      // Guardar metadatos
      const metadataFileName = `${urlDomain}_${dateStr}_${timeStr}_metadata.json`;
      const metadataFilePath = path.join(outputDir, metadataFileName);
      const metadata = {
        jobId,
        url,
        title,
        timestamp,
        contentSize: content.length,
        featuresUsed: ['crawl4ai', 'markdown-extraction'],
        files: {
          content: contentFileName,
          metadata: metadataFileName
        },
        crawlerMetadata: result.metadata || {}
      };
      fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2), 'utf8');
      
      console.log(`📁 [BrainSlot MCP] Archivos guardados:`);
      console.log(`   📄 Contenido: ${contentFilePath}`);
      console.log(`   📋 Metadatos: ${metadataFilePath}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              jobId,
              status: 'completed',
              source: 'brainslot-mcp',
              url: url,
              title,
              contentSize: content.length,
              featuresUsed: ['crawl4ai', 'markdown-extraction'],
              timestamp,
              contentPreview: content.substring(0, 500) + '...',
              fullContent: content,
              metadata: result.metadata || {},
              files: {
                contentFile: contentFilePath,
                metadataFile: metadataFilePath,
                outputDirectory: outputDir
              },
              message: `Contenido crawleado guardado en ${contentFilePath}`
            }, null, 2)
          }
        ]
      };
      
    } catch (error) {
      console.error(`❌ [BrainSlot MCP] Error guardando archivos: ${error}`);
      
      // Devolver resultado sin archivos si falla el guardado
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              jobId,
              status: 'completed_with_warning',
              source: 'brainslot-mcp',
              url: url,
              title,
              contentSize: content.length,
              featuresUsed: ['crawl4ai', 'markdown-extraction'],
              timestamp,
              contentPreview: content.substring(0, 500) + '...',
              fullContent: content,
              metadata: result.metadata || {},
              warning: `Error guardando archivos: ${error}`,
              message: 'Contenido crawleado disponible solo en respuesta (no guardado en archivo)'
            }, null, 2)
          }
        ]
      };
    }
  }

  private async handleAdvancedCrawl(args: any) {
    const { url, extractMarkdown = true, wordThreshold = 100, includeScreenshot = false, bypassCache = true } = args;
    
    if (!this.crawlerService) {
      throw new Error('Servicio de crawler no disponible');
    }

    console.log(`🕷️ [BrainSlot MCP] Crawling avanzado: ${url}`);
    
    const result = await this.crawlerService.crawlUrl(url, {
      extractMarkdown,
      wordThreshold,
      includeScreenshot,
      bypassCache
    });

    // Generar información del job
    const jobId = `advanced_crawl_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const content = result.markdown || result.content || '';
    const title = result.title || 'Crawling avanzado completado';
    
    // Crear nombre de archivo basado en URL y timestamp
    const urlDomain = new URL(url).hostname.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    
    // Guardar contenido en archivos
    const outputDir = `${this.ctx.dataRoot}/crawled/advanced`;
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      // Crear directorio si no existe
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Guardar contenido principal
      const contentFileName = `${urlDomain}_${dateStr}_${timeStr}_advanced.${extractMarkdown ? 'md' : 'html'}`;
      const contentFilePath = path.join(outputDir, contentFileName);
      fs.writeFileSync(contentFilePath, content, 'utf8');
      
      // Guardar metadatos con opciones de crawling
      const metadataFileName = `${urlDomain}_${dateStr}_${timeStr}_advanced_metadata.json`;
      const metadataFilePath = path.join(outputDir, metadataFileName);
      const metadata = {
        jobId,
        url,
        title,
        timestamp,
        contentSize: content.length,
        featuresUsed: ['crawl4ai', 'advanced-extraction', extractMarkdown ? 'markdown' : 'html'],
        crawlingOptions: { extractMarkdown, wordThreshold, includeScreenshot, bypassCache },
        files: {
          content: contentFileName,
          metadata: metadataFileName
        },
        crawlerMetadata: result.metadata || {}
      };
      fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2), 'utf8');
      
      console.log(`📁 [BrainSlot MCP] Archivos de crawling avanzado guardados:`);
      console.log(`   📄 Contenido: ${contentFilePath}`);
      console.log(`   📋 Metadatos: ${metadataFilePath}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              jobId,
              status: 'completed',
              source: 'crawl4ai-advanced',
              url: url,
              title,
              contentSize: content.length,
              featuresUsed: ['crawl4ai', 'advanced-extraction', extractMarkdown ? 'markdown' : 'html'],
              timestamp,
              extractedContent: content,
              metadata: result.metadata || {},
              options: { extractMarkdown, wordThreshold, includeScreenshot, bypassCache },
              files: {
                contentFile: contentFilePath,
                metadataFile: metadataFilePath,
                outputDirectory: outputDir
              },
              message: `Contenido de crawling avanzado guardado en ${contentFilePath}`
            }, null, 2)
          }
        ]
      };
      
    } catch (error) {
      console.error(`❌ [BrainSlot MCP] Error guardando archivos de crawling avanzado: ${error}`);
      
      // Devolver resultado sin archivos si falla el guardado
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              jobId,
              status: 'completed_with_warning',
              source: 'crawl4ai-advanced',
              url: url,
              title,
              contentSize: content.length,
              featuresUsed: ['crawl4ai', 'advanced-extraction', extractMarkdown ? 'markdown' : 'html'],
              timestamp,
              extractedContent: content,
              metadata: result.metadata || {},
              options: { extractMarkdown, wordThreshold, includeScreenshot, bypassCache },
              warning: `Error guardando archivos: ${error}`,
              message: 'Contenido crawleado disponible solo en respuesta (no guardado en archivo)'
            }, null, 2)
          }
        ]
      };
    }
  }

  private async handleConvertCurrency(args: any) {
    const { amount } = args;
    
    if (!this.crawlerService) {
      throw new Error('Servicio de crawler no disponible');
    }

    console.log(`💱 [BrainSlot MCP] Conversión de moneda: ${amount} USD`);
    
    const result = await this.crawlerService.convertCurrency(amount);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            amount_usd: amount,
            amount_eur: result,
            exchange_rate: result / amount,
            timestamp: new Date().toISOString(),
            source: 'mcp-crawler-demo'
          }, null, 2)
        }
      ]
    };
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('❌ [BrainSlot MCP] Server error:', error);
    };

    process.on('SIGINT', async () => {
      console.log('\n🛑 [BrainSlot MCP] Cerrando servidor...');
      if (this.crawlerService) {
        await this.crawlerService.stop();
      }
      process.exit(0);
    });
  }

  async run() {
    console.log('🚀 [BrainSlot MCP] Iniciando servidor MCP standalone...');
    console.log('📋 Herramientas disponibles:');
    console.log('   • bs.ingest_url - Ingesta URLs con crawl4ai');
    console.log('   • bs.advanced_crawl - Crawling avanzado');
    console.log('   • bs.convert_currency - Conversión USD→EUR (demo)');
    console.log('');

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log('✅ [BrainSlot MCP] Servidor listo y esperando conexiones');
  }
}

// Ejecutar servidor si es llamado directamente
if (require.main === module) {
  const server = new BrainSlotMCPServer();
  server.run().catch(console.error);
}

export { BrainSlotMCPServer };
