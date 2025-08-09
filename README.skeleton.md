# BrainSlot MCP Skeleton

Este esqueleto define dos niveles:

1. **MCP General** (sin `entityId`): herramientas comunes de ingesta, datasets, entrenamiento y consulta.
2. **MCP por Entidad**: servidores independientes que exponen las mismas primitives pero operan sobre el contexto (datasets/manifest) de la Entidad.

> **Integración MCP real**: el runtime actual es *agnóstico* y imprime `capabilities` para poder integrar desde la UI sin bloquearse. Cuando se integre `@modelcontextprotocol/sdk`, el wiring se hará en `server.ts` y `transports/*`.

## Comandos

```bash
pnpm i
pnpm -w build

# General MCP (HTTP)
BS_TRANSPORT=http BS_PORT=7334 pnpm -C packages/core dev

# Per-Entity MCP (HTTP, puerto aleatorio)
BS_ENTITY_ID=entity_demo BS_ENTITY_TRANSPORT=http pnpm -C packages/entity dev
```

## Descubrimiento desde UI
- Leer lo que imprime cada proceso en stdout (`brainslot.capabilities` y `brainslot.entity.ready`).
- Guardar `address` y `token` cuando corresponda.
- Registrar en tu marketplace interno MCP (AIO/BrainSlot).

## Siguientes pasos (TODO)
- [ ] Sustituir transports por los de `@modelcontextprotocol/sdk` (stdio + http/SSE).
- [ ] Implementar `resources/read` con acceso real a ficheros/datasets.
- [ ] Añadir `notifications` (jobs de ingesta/entreno) y `tools/list_changed`.
- [ ] Autenticación Bearer en HTTP.
- [ ] Tests E2E con cliente MCP CLI/Inspector.
