# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ORVIT is a comprehensive management system built with Next.js 13, React, TypeScript, Prisma, and PostgreSQL. The system handles maintenance, work orders, tasks, inventory (pañol), costs, sales, and purchase management for industrial companies.

## Development Commands

### Essential Commands
```bash
npm run dev              # Start development server
npm run build            # Build for production (runs prisma generate first)
npm start                # Start production server
npm run lint             # Run ESLint
npm test                 # Run tests with Vitest
npm run test:watch       # Run tests in watch mode
```

### Prisma/Database Commands
```bash
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run database migrations
npm run prisma:seed      # Seed database
npm run create-superadmin # Create a superadmin user (interactive script)
```

### Utility Commands
```bash
npm run clean                      # Limpiar caché de Next.js (PowerShell)
npm run migrate:checklists         # ⚠️ SCRIPT FALTANTE — no ejecutar
npm run migrate:failures           # Migrar failure records (scripts/migration/)
npm run sentry:slow                # Analizar transacciones lentas (scripts/testing/)
npm run smoke:corrective           # Smoke tests de correctivo (scripts/testing/)
npm run audit:routes               # Auditar rutas API (scripts/testing/)
npm run prisma:model               # Visor de modelos Prisma (scripts/prisma/)
npm run prisma:docs                # Generar docs de schema (scripts/prisma/)
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 13.5.1 (App Router with Route Handlers)
- **UI**: React 18.2.0 with TypeScript 5.2.2
- **Database**: PostgreSQL via Prisma 6.10.1
- **Styling**: Tailwind CSS 3.3.3 with class-variance-authority
- **Components**: Radix UI primitives with custom shadcn/ui components
- **State Management**: React Context API + Zustand for specific use cases
- **Data Fetching**: TanStack Query v5 (React Query)
- **Authentication**: Custom JWT-based auth using `jose` library
- **Forms**: react-hook-form with Zod validation
- **Monitoring**: Sentry for error tracking
- **File Storage**: AWS S3 (using @aws-sdk/client-s3)

### Project Structure

```
app/
├── api/                    # Next.js API Route Handlers (server-side)
│   ├── auth/              # Authentication endpoints
│   ├── costs/             # Cost calculation and management
│   ├── machines/          # Machine/equipment management
│   ├── work-orders/       # Work order management
│   ├── maintenance/       # Maintenance scheduling
│   ├── permissions/       # Granular permission checking
│   └── cron/              # Scheduled tasks (reminders, task resets)
├── administracion/        # Admin area pages
│   ├── costos/           # Cost management UI
│   ├── ventas/           # Sales management UI
│   ├── compras/          # Purchase management UI
│   └── usuarios/         # User management UI
├── mantenimiento/        # Maintenance area pages
├── panol/                # Inventory/tool warehouse pages
└── layout.tsx            # Root layout with providers

components/
├── ui/                   # Reusable shadcn/ui components
├── costs/                # Cost-related components
├── dashboard/            # Dashboard widgets and charts
├── maintenance/          # Maintenance-specific components
├── work-stations/        # Work station components
└── layout/               # Layout components (Navbar, BottomBar, etc.)

contexts/
├── AuthContext.tsx       # User authentication state
├── CompanyContext.tsx    # Multi-company state (areas, sectors)
├── NotificationContext.tsx # Real-time notifications
└── NavigationContext.tsx # Navigation state

hooks/
├── use-*.ts             # Custom React hooks for data fetching
├── mantenimiento/       # Maintenance-specific hooks
└── produccion/          # Production-specific hooks

lib/
├── prisma.ts            # Prisma Client singleton
├── auth.ts              # JWT authentication utilities
├── permissions.ts       # Granular permission types and definitions
├── permissions-helpers.ts # Permission checking logic
├── task-scheduler.ts    # Fixed task auto-scheduling
└── costs/               # Cost calculation logic
```

### Key Architectural Patterns

#### 1. Multi-Company/Multi-Tenant System
The system supports multiple companies, each with their own:
- **Areas**: Organizational divisions (e.g., Production, Maintenance)
- **Sectors**: Sub-divisions within areas
- **Roles**: Company-specific roles with granular permissions
- **Users**: Can belong to multiple companies via `UserOnCompany` junction table

State is managed via `CompanyContext` which maintains:
- `currentCompany`: Active company
- `currentArea`: Selected area
- `currentSector`: Selected sector
- Caching strategy with 5-minute TTL to avoid redundant API calls

#### 2. Authentication & Authorization
- **JWT-based**: Uses `jose` library for token signing/verification
- **Cookie-based**: Tokens stored in HTTP-only cookies
- **Middleware**: [middleware.ts](middleware.ts) handles route protection
- **Granular Permissions**: Defined in [lib/permissions.ts](lib/permissions.ts)
  - Format: `{resource}.{action}` (e.g., `machines.edit`, `tasks.create`)
  - Role-based permissions stored in database (`RolePermission` table)
  - User-specific permission overrides supported
  - Frontend checks via `AuthContext.hasPermission()`
  - Backend verification via `lib/permissions-helpers.ts`

#### 3. Database Architecture (Prisma)
**Core Models**:
- `Company`: Multi-tenant root entity
- `User`: Global users, linked to companies via `UserOnCompany`
- `Role`: Company-specific roles with `RolePermission[]`
- `WorkStation`: Equipment with hierarchical structure (machines, components, subcomponents)
- `WorkOrder`: Maintenance work orders with attachments, comments
- `MaintenanceChecklist`: Preventive maintenance checklists
- `Task` / `FixedTask`: One-time and recurring tasks
- `Tool` / `ToolRequest`: Inventory management (pañol)
- Cost-related models:
  - `CostEmployee`, `CostProduct`, `InputItem`, `IndirectItem`
  - `Recipe`, `MonthlyProduction`, `MonthlyIndirect`
  - Complex cost calculation system with historical tracking

**Important**:
- Prisma schema is very large (32k+ tokens, 1000+ lines)
- Always use offset/limit when reading schema.prisma
- Most models have `companyId` for multi-tenancy

#### 4. Cost Calculation System
Located in [lib/costs/calculator.ts](lib/costs/calculator.ts), this is a complex subsystem that:
- Calculates product costs from recipes, materials, labor, and indirect costs
- Supports volumetric calculations and yield percentages
- Maintains historical cost data (`ProductCostHistory`, `EmployeeSalaryHistory`, etc.)
- Distributes indirect costs across product lines
- Integrates with sales data for P&L analysis

**Key Cost Endpoints**:
- `/api/costs/recalculate` - Trigger full cost recalculation
- `/api/costs/products` - Product cost queries
- `/api/costs/recipes` - Recipe cost breakdowns
- `/api/dashboard/costs-breakdown` - Cost analysis dashboard

#### 5. Task Management
Two types:
1. **Tasks** (`Task` model): One-time or ad-hoc tasks
2. **FixedTasks** (`FixedTask` model): Recurring tasks with schedules
   - Auto-scheduled via [lib/task-auto-scheduler.ts](lib/task-auto-scheduler.ts)
   - Started on server boot in [app/layout.tsx](app/layout.tsx)
   - Cron job at `/api/cron/task-reset-scheduler`

#### 6. Maintenance System
- **Work Stations**: Hierarchical equipment structure
  - Machines → Components → Subcomponents → Tools
- **Work Orders**: Maintenance requests with lifecycle management
  - States: pending, in_progress, completed, cancelled
  - Attachments, comments, assignments
- **Checklists**: Preventive maintenance procedures
  - Stored as JSON with phases and items
  - Execution tracking via `checklist_executions`
  - PDF generation for print-outs

#### 7. Real-time Features
- **Notifications**: Via `NotificationContext` and `/api/notifications`
- **Instant Updates**: Using TanStack Query's invalidation
- **Task Reminders**: Scheduled cron job at `/api/cron/reminder-check`

#### 8. Frontend Patterns
- **Path Aliases**: `@/*` maps to project root (see tsconfig.json)
- **Component Structure**:
  - `components/ui/` for base components (shadcn/ui)
  - Feature-specific components in feature folders
  - Dialogs/Sheets for forms (e.g., `WorkstationUpsertSheet.tsx`)
- **Data Fetching**:
  - Use TanStack Query hooks (e.g., `useQuery`, `useMutation`)
  - Custom hooks in `hooks/` directory
  - Prefer server-side data fetching in API routes
- **State Management**:
  - Context for global state (auth, company, notifications)
  - Zustand for specific feature state (if needed)
  - React Hook Form for form state

## Important Configuration Details

### Environment Variables
Required variables (see .env file):
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT signing
- AWS S3 credentials for file uploads
- Sentry DSN for error monitoring

### Build Configuration
- **TypeScript**: Build errors ignored (`ignoreBuildErrors: true`)
- **ESLint**: Linting errors ignored during build
- **Images**: Optimized, with S3 remote patterns configured
- **Sentry**: Automatic instrumentation enabled

### Timezone Handling
- Client timezone detected and stored in `window.__TIMEZONE__`
- Date utilities in [lib/date-utils.ts](lib/date-utils.ts)
- Uses `date-fns` and `date-fns-tz` for date manipulation

## Common Development Workflows

### Adding a New API Endpoint
1. Create file in `app/api/{feature}/route.ts`
2. Add `export const dynamic = 'force-dynamic'` for dynamic rendering
3. Use `prisma` from `lib/prisma.ts` for database queries
4. Verify authentication with JWT from cookies
5. Check permissions using helpers from `lib/permissions-helpers.ts`

### Creating a New Page
1. Create file in `app/{area}/{feature}/page.tsx`
2. Use `'use client'` directive if client-side interactivity needed
3. Fetch data via TanStack Query hooks
4. Wrap sensitive UI with permission checks

### Adding Permissions
1. Define permission in `lib/permissions.ts` (type `Permission`)
2. Create `RolePermission` entries in database for relevant roles
3. Use `hasPermission()` in frontend (via `AuthContext`)
4. Verify on backend using `lib/permissions-helpers.ts`

### Modifying Prisma Schema
1. Edit `prisma/schema.prisma`
2. Run `npm run prisma:migrate` to generate migration
3. Run `npm run prisma:generate` to update Prisma Client
4. Restart dev server

### Working with Checklists
Checklists are stored as JSON in `MaintenanceChecklist.checklistData`:
```typescript
{
  phases: [
    {
      id: string;
      name: string;
      items: [
        { id: string; description: string; type: 'check' | 'value' | 'text'; ... }
      ]
    }
  ]
}
```
- Use helper functions in `lib/checklist-utils.ts`
- PDF generation in `lib/pdf/maintenance-pdf.ts`

### Dashboard Widgets
- Widget catalog defined in `lib/dashboard/widget-catalog.ts`
- User-configurable dashboards via `UserDashboardConfig` model
- Chart.js integration via `react-chartjs-2`

## Testing
- Test framework: Vitest
- Run tests: `npm test` or `npm run test:watch`
- Test files should be colocated with source files or in `__tests__` directories

## Daily Logs

Los logs de sesión de Claude Code se mantienen en:
```
/Users/martinrusso10/Orvit/Orvit/.claude/daily-logs/YYYY-MM-DD.md
```
Cada log registra qué se hizo, archivos modificados, decisiones tomadas y próximos pasos.
Ver `.claude/rules/workflow-rules.md` para el protocolo de logging.

Para ver el contexto de una sesión anterior:
```bash
ls /Users/martinrusso10/Orvit/Orvit/.claude/daily-logs/
```

## Debugging
- **Sentry**: Tracking principal de errores en producción (`sentry.server.config.ts`, `sentry.edge.config.ts`)
- **Structured Logging**: Logger Pino en `lib/logger.ts` para logs server-side
- **Console logging**: Usado extensamente en desarrollo (buscar `console.log` para limpiar)
- **Performance monitoring**: Custom hooks en `hooks/use-performance-monitor.ts`
- **Nota**: Las rutas `/api/debug-*` fueron eliminadas el 2026-02-20. Usar Sentry y logging estructurado en su lugar.

## Skills y Workflow de Claude Code

**IMPORTANTE**: Antes de cualquier tarea no trivial, invocar el skill correspondiente usando el Skill tool.

| Tarea | Skill |
|-------|-------|
| Componentes UI, páginas, modales, tablas, KPIs | `orvit-frontend` |
| API routes, TanStack Query, Prisma queries | `orvit-api` |
| Schema Prisma, migraciones, modelos | `orvit-prisma` |
| Formularios (react-hook-form + Zod + Dialog) | `orvit-forms` |
| Tablas de datos con filtros, sorting, paginación | `orvit-tables` |
| Mantenimiento, checklists, work orders, health score | `orvit-maintenance` |
| Permisos, roles, guards | `orvit-permissions` |
| Gráficos, dashboards, Chart.js, Recharts | `orvit-charts` |
| Tests con Vitest | `orvit-test` |
| Discord bot, notificaciones | `orvit-discord` |
| Pipeline AGX | `orvit-agx` |
| Diseño visual distintivo, estética, polish | `frontend-design` |
| Integración shadcn/ui, bloques, customización | `shadcn-ui` |
| Mejorar prompts de diseño UI | `enhance-prompt` |
| Git commit | `commit` |
| Pull request | `pr` |

**Skills location**: `/Users/martinrusso10/Orvit/Orvit/.claude/skills/`
**Rules location**: `/Users/martinrusso10/Orvit/Orvit/.claude/rules/`
**Daily logs**: `/Users/martinrusso10/Orvit/Orvit/.claude/daily-logs/YYYY-MM-DD.md`

El log diario se actualiza automáticamente al terminar cada tarea significativa. Ver `workflow-rules.md` para el protocolo.

## Discord Bot — Servicio Standalone

El bot de Discord corre como proceso Node.js independiente (no dentro de Next.js):

```
discord-bot/               # Proyecto standalone (Railway)
├── src/bot/               # Discord.js client + listeners
├── src/handlers/          # Task, voice, failure handlers
├── src/services/          # Notifications, agenda, permissions
├── src/http-server.ts     # Express API (11 endpoints)
└── src/index.ts           # Entry point

orvit-v1/lib/discord/
├── bot-service-client.ts  # HTTP client al bot service (usar esto)
├── notifications.ts       # Funciones de notificación (usan bot-service-client)
├── agenda-notifications.ts
└── index.ts               # Re-exports
```

**Clave**: ORVIT se comunica con el bot vía HTTP API. No importar nada de `discord.js` directamente.
Usar `lib/discord/bot-service-client.ts` para toda comunicación con el bot.

## Important Notes

1. **Type Safety**: TypeScript strict mode is enabled, but build errors are ignored for rapid development
2. **Multi-tenancy**: Always filter queries by `companyId` when working with company-scoped data
3. **Permission Checks**: Never rely solely on frontend permission checks; always verify on backend
4. **Caching**: CompanyContext implements aggressive caching; be aware of stale data
5. **Mobile Support**: Mobile-specific components exist (e.g., `MobileBottomBar`, `MobileMachineNavbar`)
6. **Print Layouts**: Special print layouts for checklists (see `app/mantenimiento/checklist-print/`)
7. **Legacy Code**: The single active permission system is `permissions-helpers.ts`; legacy versions were removed 2026-02-20
8. **Cost Recalculation**: Heavy operation; use with caution in production
9. **Auth role mismatch**: `getUserFromToken()` retorna el nombre del rol de empresa (puede ser custom). `isAdminRole()` solo acepta roles de sistema (SUPERADMIN, ADMIN, ADMIN_ENTERPRISE). Si necesitás verificar admin, consultar `User.role` directamente.
10. **Discord bot**: No usar `discord.js` ni importar `bot.ts` desde orvit-v1. Usar `bot-service-client.ts`.
