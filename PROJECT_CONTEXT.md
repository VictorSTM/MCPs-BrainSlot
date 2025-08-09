# BrainSlot MCP - Contexto del Proyecto

## Objetivo Final (Resumido)

Un **MCP General** (de plataforma) + **MCPs por Entidad** (aislados) que se crean/configuran desde la UI.

**Características clave:**
- Transporte HTTP+SSE en producción (stdio para local)
- Auth Bearer con tokens por entidad
- Recursos namespaced (`bs://entities/{id}/…`)
- Jobs (ingesta/entreno) con notificaciones y observabilidad
- Integración cómoda con hosts MCP (VS Code / Claude Desktop)
- Marketplace interno para gestión de MCPs

## Arquitectura Preferida

### Vista Macro (Control Plane vs Data Plane)

#### **Control Plane (Orquestación/UI)**
- **Panel UI (web)**: crear/configurar MCPs de Entidad
- **MCP Manager (API)**: registra Entidades, genera tokens, elige puertos, mantiene catálogo de MCPs activos, sanea procesos, health checks
- **Registry/Marketplace**: índice de MCPs disponibles (General + Entidad) con metadatos, endpoints y scopes
- **Secret Store**: tokens, claves de scraping/APIs externas

#### **Data Plane (Ejecución)**
- **MCP General**: tools "comunes" (ingesta, creación de datasets, entreno orquestado, búsqueda), recursos globales y prompts base
- **MCP por Entidad**: servidor HTTP+SSE aislado por entityId, con su dataRoot y sus recursos/manifest propios
- **Servicios de IA (RAG/FT/Híbrido)**: indexado/embedding, vector store, motor de consulta, pipeline de fine‑tuning
- **Storage**:
  - Object Store (S3-compatible / Azure Blob) para documentos y artefactos de entrenamiento
  - Vector DB (Qdrant/Weaviate/PGVector) por namespace de Entidad
  - SQL (Postgres) para metadatos: datasets, runs, jobs, estados
- **Event Bus** (Redis/NATS/Kafka) para estados de jobs y notificaciones MCP
- **Gateway** (opcional) delante de MCPs HTTP para TLS, rate limit, logs y auth centralizada

### Separación Funcional

#### **General MCP**
- **Tools**: `bs.ingest_url`, `bs.create_dataset`, `bs.train_entity`, `bs.query_entity`, `bs.index_status`
- **Resources templates globales**: `bs://datasets/{id}`, `bs://runs/{id}` …
- **Rol**: entrypoint API desde hosts y desde UI para crear/configurar MCPs de Entidad (vía Manager)

#### **Entidad MCP**
- **Misma interfaz**, pero filtro/espacio de nombres por entityId
- **Resources**: `bs://entities/{entityId}/manifest`, `bs://entities/{entityId}/docs/{docId}`, `bs://entities/{entityId}/index/{shard}`
- **Policy de seguridad**: solo accede a su namespace; token único por Entidad (rotación)

## Seguridad y Multi‑tenant (Mínimos)

- **Auth Bearer** por servidor (token por Entidad; rotación y revocación desde UI)
- **Scopes por tool** (ej. `datasets:read`, `ingest:write`, `train:execute`)
- **Sandbox por proceso**: dataRoot propio, variables de entorno limitadas, sin shell/calls peligrosas
- **Aprobaciones**: marca tools sensibles con `requiresApproval` para que el host pida confirmación

## Observabilidad

- **Logs estructurados** (JSON) con entityId, jobId, tool, latency, status
- **Métricas**: QPS por tool, latencias p50/p95, tamaño índices, coste por consulta/entreno
- **Trazas distribuidas** en jobs (ingesta→preproceso→indexado→entreno)

## Ciclos Clave

### Crear Entidad MCP (desde UI)
1. UI → MCP Manager → lanza proceso `@brainslot/mcp-entity` con entityId, dataRoot, port
2. Registra en Registry y devuelve address + token

### Entrenar
1. Host/UI llama `bs.ingest_url` (General o Entidad), crea dataset, `bs.train_entity`
2. Jobs reportan progreso por Event Bus → notificaciones MCP

### Consultar
1. `bs.query_entity` en el MCP de esa Entidad → RAG/FT según manifest

## Roadmap Detallado (8–12 semanas)

### **Fase 0 — Consolidación base (semana 1)**
**Objetivo**: tener el esqueleto funcionando con el SDK MCP real.
- Integrar `@modelcontextprotocol/sdk` (Node) en server.ts y transports/stdio|http
- Endpoints HTTP+SSE + handshake initialize, tools/list|call, resources/list|read, prompts/list|get
- **Entrega**: General MCP sirviendo over HTTP en local
- **Criterio de aceptación**: desde un cliente MCP (CLI/Inspector) se listan tools y se ejecuta `bs.create_dataset`

### **Fase 1 — Spawner & Manager (semanas 2–3)**
**Objetivo**: levantar MCPs por Entidad desde UI.
- Servicio MCP Manager (API) con endpoints POST /entities/{id}/mcp (spawn), GET /mcps, DELETE /mcps/{id}
- Health checks, reintentos, limpieza de zombies
- Tokens por Entidad (secret store), inventario en Registry
- **Entrega**: desde la UI, botón "Crear MCP de Entidad" devuelve address + token
- **Aceptación**: 2 MCPs de Entidad corriendo a la vez, listados en UI

### **Fase 2 — Storage & Resources reales (semanas 3–4)**
**Objetivo**: recursos leíbles de verdad y datos aislados.
- Implementar resources/read para `bs://entities/{id}/manifest`, `bs://datasets/{id}`
- Montar Object Store y Postgres; modelado de metadatos (datasets, docs, runs)
- **Entrega**: leer manifests/datasets vía resources/read desde un host MCP
- **Aceptación**: READ devuelve JSON real por entidad

### **Fase 3 — Pipelines de ingesta y RAG (semanas 4–6)**
**Objetivo**: ingesta/normalizado/embeddings e índices por Entidad.
- Workers de ingesta (cola): fetch → clean → segment → embed → upsert en Vector DB (namespace por Entidad)
- Configurable por reglas (prepare-scraper-rules)
- `bs.query_entity` que consulta solo su namespace; devuelve referencias
- **Entrega**: demo end‑to‑end con 2 Entidades consultando sus propios corpus
- **Aceptación**: queries cruzadas no filtran data entre Entidades

### **Fase 4 — Entreno FT/Híbrido (semanas 6–8)**
**Objetivo**: entrenos opcionales por Entidad y selección de estrategia.
- `bs.train_entity(strategy)` orquesta: dataset→job FT o solo RAG; guarda artefactos en object store
- Versionado de manifest por Entidad (estrategia, modelo, fecha)
- **Entrega**: cambiar estrategia en UI y re‑entrenar
- **Aceptación**: manifest refleja la estrategia activa y query la usa

### **Fase 5 — Seguridad, cuotas y aprobaciones (semanas 7–9)**
**Objetivo**: hardening multi‑tenant.
- Scopes por tool; rate limit por token/Entidad; límites de tamaño/requests
- `requiresApproval` activo y comunicado a hosts
- **Entrega**: tokens rotables desde UI y prueba de límites
- **Aceptación**: llamadas fuera de scope son 403; aprobación requerida en tools críticas

### **Fase 6 — Observabilidad & DX (semanas 8–10)**
**Objetivo**: operar y depurar con gusto.
- Logs JSON + métrica básica (Prometheus compatible)
- Trazas simples por jobId y entityId
- SDK de pruebas (fixtures) + test E2E con cliente MCP
- **Entrega**: panel mínimo de métricas; tests CI
- **Aceptación**: ver p95 por tool y fallos por entidad

### **Fase 7 — Marketplace & Hosts (semanas 10–12)**
**Objetivo**: distribución y experiencia de uso.
- Catálogo/Marketplace interno con tarjetas de MCP (General/Entidad), copiar address/token, botón "Abrir en VS Code/Claude"
- Plantillas de prompts por caso de uso (ingesta web, PDF, Docs)
- **Entrega**: onboarding en 5 min desde cero a primera query
- **Aceptación**: QA sin asistencia humana abre un MCP de Entidad y consulta su corpus

## Decisiones Técnicas Recomendadas

- **SDK/Runtime**: Node + `@modelcontextprotocol/sdk` (menos fricción con tu stack)
- **Transporte**: stdio (dev) y HTTP+SSE (prod) detrás de API Gateway (TLS, rate limit)
- **Vector DB**: Qdrant/Weaviate o PGVector; namespace = entityId
- **Object Store**: S3‑compatible; ruta `entities/{id}/….`
- **DB metadatos**: Postgres (datasets, docs, jobs, runs, manifests)
- **Jobs**: Redis Queue o NATS JetStream (simple y rápido); notificaciones → MCP notifications
- **Schema/compat**: versionar protocolVersion, semver de tools (`bs.train_entity@1` si hiciera falta)
- **URIs**: mantener `bs://entities/{id}/…` y `bs://datasets/{id}`; plantillas en resources/templates

## Entregables Clave por Hito

- **H0**: General MCP con SDK real y tools listados
- **H1**: Manager capaz de spawn/stop/list; UI con botón "Crear MCP"
- **H2**: resources/read sobre storage real; manifests por entidad
- **H3**: RAG funcional por entidad; query_entity con referencias
- **H4**: FT/Híbrido opcional; versionado de manifest
- **H5**: Auth+scopes+rate limit; aprobaciones activas
- **H6**: Observabilidad y tests E2E
- **H7**: Marketplace interno y guías para hosts

## Riesgos y Mitigaciones

- **Fuga entre Entidades** → tests de aislamiento, namespaces estrictos y revisiones de queries
- **Costes de embeddings/FT** → caché de chunks, dedupe, top‑K ajustable, "cold storage" de índices viejos
- **Complejidad operativa** → Manager con auto‑recover, health checks y límites de procesos por nodo
- **Compatibilidad de hosts** → probar con 2–3 clientes MCP desde el principio (CLI/Inspector/VS Code)

## Estado Actual del Proyecto

**Fase actual**: Fase 0 (Consolidación base)
**Completado**:
- ✅ Skeleton de monorepo con estructura básica
- ✅ Tipos TypeScript para MCP
- ✅ Spawner básico para gestión de servidores
- ✅ Tools placeholder implementadas
- ✅ Sistema de recursos y prompts base

**Siguiente**: Integrar `@modelcontextprotocol/sdk` y implementar transports reales.
