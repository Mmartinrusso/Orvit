# ORVIT — Sistema de Gestión Empresarial (ERP)

Sistema ERP full-stack para empresas industriales. Gestión de mantenimiento, órdenes de trabajo, tareas, pañol, costos, ventas y compras. Arquitectura multi-tenant con soporte para múltiples empresas.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 13.5 (App Router) |
| UI | React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| Base de datos | PostgreSQL via Prisma ORM |
| Auth | JWT (jose) con HTTP-only cookies |
| Cache | Redis (ioredis / Upstash) |
| Storage | AWS S3 |
| Monitoring | Sentry + Pino (logging estructurado) |
| Testing | Vitest |
| IA | OpenAI GPT-4 (chatbot, OCR de facturas, forecasting de demanda) |

## Quick Start

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env
# Completar: DATABASE_URL, JWT_SECRET, credenciales AWS, DSN de Sentry

# 3. Ejecutar migraciones
npm run prisma:migrate

# 4. (Opcional) Seed de datos
npm run prisma:seed

# 5. Servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Comandos Esenciales

```bash
npm run dev                     # Servidor de desarrollo
npm run build                   # Build de producción
npm run lint                    # ESLint
npm test                        # Ejecutar tests (Vitest)
npm run test:watch              # Tests en modo watch
```

## Comandos de Base de Datos

```bash
npm run prisma:generate         # Regenerar Prisma Client
npm run prisma:migrate          # Ejecutar migraciones pendientes (dev)
npm run prisma:seed             # Seed de base de datos
npm run create-superadmin       # Crear superadmin (script interactivo)
```

## Estructura del Proyecto

```
orvit-v1/
│
├── app/                        # Next.js App Router
│   ├── api/                    # API Route Handlers (~180 endpoints)
│   ├── administracion/         # Páginas del área de administración
│   ├── mantenimiento/          # Páginas de mantenimiento
│   ├── panol/                  # Páginas de inventario/pañol
│   └── ...                     # Otros módulos
│
├── components/                 # Componentes React (no mover — cross-imports)
│   ├── ui/                     # Componentes base (shadcn/ui)
│   └── [feature]/              # Componentes por módulo
│
├── lib/                        # Lógica de negocio y utilidades
├── hooks/                      # Custom React hooks
├── contexts/                   # React Context providers
├── types/                      # Definiciones TypeScript
│
├── prisma/
│   ├── schema.prisma           # Esquema de BD (crítico — no editar sin migración)
│   ├── migrations/             # Historial de migraciones (nunca editar manualmente)
│   ├── manual_scripts/         # SQL para fixes manuales
│   └── seed-*.ts               # Seeds canónicos
│
├── scripts/
│   ├── database/               # SQL y scripts de add-column/indexes
│   ├── permissions/            # Setup de permisos y roles
│   ├── migration/              # Migraciones de datos
│   ├── seed/                   # Seeds ad-hoc para desarrollo
│   ├── setup/                  # Setup de entorno, fixes, cleanup
│   ├── testing/                # Test runners, smoke tests, diagnósticos
│   ├── prisma/                 # Utilidades de Prisma
│   └── README.md               # Guía de scripts
│
├── docs/
│   ├── database/               # ERD y documentación de modelos
│   ├── api-examples/           # Ejemplos de uso de API
│   ├── audit/                  # Auditoría y seguridad
│   ├── perf/                   # Análisis de performance
│   ├── user-guides/            # Guías de usuario y onboarding
│   └── changelogs/             # Notas de cambios y releases
│
├── tests/                      # Suite de tests
├── public/                     # Assets estáticos
│
├── CLAUDE.md                   # Guía para Claude Code
└── [config files]              # next.config.js, tsconfig.json, tailwind, vitest, etc.
```

## Arquitectura Multi-Tenant

Cada empresa tiene sus propias áreas, sectores, roles y permisos:
- **Permisos granulares**: formato `{recurso}.{acción}` (ej: `machines.edit`, `tasks.create`)
- **Usuarios**: pueden pertenecer a múltiples empresas via `UserOnCompany`
- **Estado global**: `CompanyContext` con caché de 5 minutos

## Variables de Entorno

```bash
DATABASE_URL="postgresql://user:pass@host:5432/orvit"
JWT_SECRET="your-secret-key"
OPENAI_API_KEY="sk-proj-..."          # Para features de IA
REDIS_URL="redis://localhost:6379"     # O Upstash para producción
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="..."
AWS_S3_BUCKET_NAME="..."
SENTRY_DSN="https://..."
```

## Claude Code

- Guía de desarrollo: `CLAUDE.md`
- Reglas de workflow: `.claude/rules/workflow-rules.md` (directorio padre)
- Logs de sesiones: `.claude/daily-logs/YYYY-MM-DD.md` (directorio padre)
- Skills disponibles: `.claude/skills/` (directorio padre)

## Documentación

| Documento | Ubicación |
|-----------|-----------|
| Setup rápido | `docs/user-guides/QUICK-SETUP-CHECKLIST.md` |
| Guía de deploy | `docs/user-guides/DEPLOYMENT_GUIDE_FINAL.md` |
| Arquitectura IA | `docs/ASISTENTE_IA_ARQUITECTURA.md` |
| Estándares de UI | `docs/UI-STANDARDS.md` |
| Ejemplos de API | `docs/api-examples/` |
| Guía de scripts | `scripts/README.md` |
