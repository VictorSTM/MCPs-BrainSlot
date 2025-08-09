# BrainSlot MCP - Sistema de Crawling Inteligente

Sistema integrado de Model Context Protocol (MCP) con capacidades avanzadas de crawling web usando crawl4ai y procesamiento inteligente con Ollama.

## 🚀 Inicialización del Sistema

### Comando único para iniciar todo:

```bash
python brainslot-mcp-system.py
```

Este comando:
- ✅ Inicia el servidor MCP BrainSlot
- ✅ Conecta con el crawler especializado (Python/crawl4ai)  
- ✅ Establece comunicación con Ollama
- ✅ Proporciona interfaz interactiva

## 💬 Uso del Sistema

Una vez iniciado, puedes solicitar crawling de manera natural:

```
👤 Usuario: Crawlea https://ejemplo.com
```

El sistema automáticamente:
1. 🔍 Detecta la solicitud de crawling
2. 🕷️ Ejecuta crawl4ai para extraer contenido
3. 📁 Guarda archivos en `.data/crawled/`
4. 🤖 Analiza el contenido con Ollama

## 📁 Archivos Generados

Los archivos se guardan automáticamente en:

```
.data/crawled/
├── {dominio}_{fecha}_{hora}_content.md     # Contenido completo en Markdown
└── {dominio}_{fecha}_{hora}_metadata.json  # Metadatos estructurados
```

## 🔧 Arquitectura

- **Control Plane**: BrainSlot MCP Server (TypeScript)
- **Data Plane**: Crawler MCP (Python + crawl4ai)  
- **AI Processing**: Ollama (Llama 3.1 8B)
- **Communication**: JSON-RPC over stdio

## ⚡ Características

- 🌐 Crawling avanzado con crawl4ai
- 📝 Extracción automática de Markdown
- 🗃️ Almacenamiento persistente de archivos
- 🤖 Procesamiento inteligente con LLM
- 🔄 Comunicación transparente usuario-sistema

## 🛠️ Requisitos del Sistema

- Node.js + pnpm (para MCP TypeScript)
- Python + uv (para crawler MCP)
- Ollama + Llama 3.1 8B
- Playwright (para crawl4ai)

---

**Desarrollado por el equipo BrainSlot** 🧠⚡
