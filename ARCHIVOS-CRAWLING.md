# Ubicación de Archivos de Crawling

## ✅ **El sistema está funcionando correctamente**

Los archivos del crawling se generan automáticamente en:

```
.data/crawled/
```

## 📁 **Estructura de archivos generados**

Cada crawling genera **2 archivos**:

### 1. **Archivo de contenido** (`.md`)
- **Formato**: `{dominio}_{fecha}_{hora}_content.md`
- **Ejemplo**: `southimpact_com_2025-08-09_12-33-34_content.md`
- **Contenido**: El texto completo de la página en formato Markdown

### 2. **Archivo de metadatos** (`.json`)
- **Formato**: `{dominio}_{fecha}_{hora}_metadata.json`
- **Ejemplo**: `southimpact_com_2025-08-09_12-33-34_metadata.json`
- **Contenido**: Información estructurada del crawling

## 📊 **Ejemplo de metadatos generados**

```json
{
  "jobId": "ingest_1754742814291",
  "url": "https://southimpact.com/patrocinadores", 
  "title": "Patrocinadores",
  "timestamp": "2025-08-09T12:33:34.291Z",
  "contentSize": 9997,
  "featuresUsed": ["crawl4ai", "markdown-extraction"],
  "files": {
    "content": "southimpact_com_2025-08-09_12-33-34_content.md",
    "metadata": "southimpact_com_2025-08-09_12-33-34_metadata.json"
  },
  "crawlerMetadata": {}
}
```

## 🎯 **Verificación exitosa**

El sistema ha crawleado exitosamente:
- ✅ **https://southimpact.com/patrocinadores** → 9,997 caracteres
- ✅ **https://example.com** → 191 caracteres

## 🔧 **Funcionamiento automático**

1. **Usuario solicita**: "Crawlea https://southimpact.com"
2. **Ollama detecta** la necesidad de crawling
3. **BrainSlot MCP** ejecuta `bs.ingest_url`
4. **Crawler MCP Python** procesa la URL con crawl4ai
5. **Archivos se guardan** automáticamente en `.data/crawled/`
6. **Respuesta incluye** rutas de archivos generados

## 📂 **Archivos actualmente disponibles**

```bash
ls -la .data/crawled/
```

Los archivos se mantienen persistentemente para consulta posterior.