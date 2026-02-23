# scripts/

Scripts de utilidad y mantenimiento para ORVIT. Organizados por función.

## Estructura

| Directorio | Contenido |
|------------|-----------|
| `database/` | Archivos SQL y scripts que agregan/alteran columnas, campos o índices directamente en la BD |
| `permissions/` | Crear, asignar, verificar y listar permisos y roles (`assign-*`, `create-*-permission`, `verify-*`, `check-*-permission`) |
| `migration/` | Scripts de migración de datos de un esquema a otro (one-time operations) |
| `seed/` | Seeds ad-hoc para desarrollo y testing local (los canónicos están en `prisma/`) |
| `setup/` | Setup de entorno, scripts de fix, restauración y cleanup de estructuras |
| `testing/` | Test runners, smoke tests, scans de performance, diagnósticos y checks puntuales |
| `prisma/` | Utilidades de Prisma: visor de modelos, generador de docs, validador, generador de tipos |

## Scripts referenciados por package.json

> Estos scripts están mapeados a comandos npm. Actualizar las rutas aquí y en `package.json` simultáneamente si se mueven.

| Comando npm | Archivo |
|-------------|---------|
| `npm run migrate:checklists` | `scripts/migrate-checklists-to-table.js` — ⚠️ **FALTANTE** — no ejecutar |
| `npm run migrate:failures` | `scripts/migration/migrate-failures-to-occurrences.ts` |
| `npm run sentry:slow` | `scripts/testing/sentry-slow-transactions.js` |
| `npm run smoke:corrective` | `scripts/testing/smoke-corrective.mjs` |
| `npm run audit:routes` | `scripts/testing/audit-routes.ts` |
| `npm run prisma:model` | `scripts/prisma/prisma-model-viewer.ts` |
| `npm run prisma:docs` | `scripts/prisma/generate-schema-docs.ts` |
| `npm run prisma:validate-schema` | `scripts/prisma/prisma-schema-validator.ts` |
| `npm run prisma:types` | `scripts/prisma/prisma-types-generator.ts` |

## Notas

- Los seeds canónicos están en `prisma/seeds/` y `prisma/seed-*.ts` — no en `scripts/seed/`
- `prisma/manual_scripts/` contiene SQL de migraciones manuales — no tocar sin revisión
- `prisma/migrations/` es crítico para producción — nunca editar manualmente
- Los scripts de `permissions/` son mayormente one-time setup; verificar que se hayan ejecutado antes de archivarlos
