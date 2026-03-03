# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ORVIT is an enterprise management system (ERP) for industrial companies. Built with Next.js 13 App Router, React 18, TypeScript, Prisma, and PostgreSQL. Handles maintenance, work orders, task management, inventory, costs, sales, purchases, HR/payroll, and accounting across multiple tenants.

## Repository Structure

```
.
├── orvit-v1/          # Main Next.js application (all dev commands run here)
├── discord-bot/       # Standalone Discord bot service (deployed on Railway)
├── .claude/           # Claude Code configuration
│   ├── rules/         # Project rules (workflow, frontend, pre-flight checks)
│   ├── skills/        # Invocable skills for specific tasks
│   ├── daily-logs/    # Session logs (YYYY-MM-DD.md)
│   └── memory/        # Persistent memory across sessions
```

**All development commands must be run from `orvit-v1/`.**

## Development Commands

```bash
cd orvit-v1

# Dev & Build
npm run dev                  # Start dev server (localhost:3000)
npm run build                # prisma migrate deploy + generate + next build
npm run lint                 # ESLint

# Testing (Vitest)
npm test                     # Run all tests (vitest run)
npm run test:watch           # Watch mode
npm run test:coverage        # Coverage report
npm run test:integration     # Integration tests with .env.test
npm run test:db:up           # Start Docker test database
npm run test:db:down         # Stop test database

# Database (Prisma)
npm run prisma:generate      # Generate Prisma Client
npm run prisma:migrate       # Create and apply migration (interactive)
npm run prisma:seed           # Seed database
npm run create-superadmin    # Interactive superadmin creation

# Utilities
npm run audit:routes         # Audit API route protection
npm run prisma:model         # View Prisma model relationships
npm run smoke:corrective     # Smoke test corrective maintenance flow
```

### Running a Single Test

```bash
cd orvit-v1
npx vitest run tests/path/to/file.test.ts
npx vitest tests/path/to/file.test.ts    # watch mode for single file
```

Test config: `vitest.config.mts` — tests in `tests/`, single fork, Node environment, `@/` alias resolves to project root.

## Architecture

### Multi-Tenant Design

Every core entity has `companyId`. Users belong to companies via `UserOnCompany` junction table. `CompanyContext` provides `currentCompany`, `currentArea`, `currentSector` with 5-min client-side cache.

**Critical**: All Prisma queries must filter by `companyId`. Missing this filter is a data isolation bug.

### Authentication & Authorization

- **JWT** via `jose` library, stored in HTTP-only cookies (`token`, `accessToken`, `refreshToken`)
- **Auto-refresh**: `lib/api-client.ts` retries on 401 by calling `/api/auth/refresh`
- **System roles**: `SUPERADMIN`, `ADMIN`, `ADMIN_ENTERPRISE`, `USER`
- **Granular permissions**: `{resource}.{action}` format (e.g., `machines.edit`, `tasks.create`)
  - Defined in `lib/permissions.ts`
  - Checked via `lib/permissions-helpers.ts` (Redis-cached, 15min TTL)
  - Frontend: `useAuth().hasPermission('resource.action')`
  - Backend: `withGuards(handler, { requiredPermissions: ['resource.action'] })`

### API Route Pattern

All API routes use `withGuards` middleware from `lib/middleware/withGuards.ts`:

```typescript
export const GET = withGuards(
  async (req, { user }) => {
    const data = await prisma.model.findMany({
      where: { companyId: user.companyId },
    });
    return NextResponse.json(data);
  },
  { requiredPermissions: ['resource.view'] }
);
```

`withGuards` provides: JWT auth, permission checking (AND/OR modes), rate limiting, audit logging, and typed `GuardedUser` context.

### Data Fetching

- **Server side**: Prisma via `lib/prisma.ts` (singleton with auto-reconnect)
- **Client side**: TanStack Query v5 with custom hooks in `hooks/`
- **API client**: `lib/api-client.ts` wraps fetch with auth token refresh

### Frontend Stack

- **UI**: shadcn/ui (Radix primitives + Tailwind)
- **Forms**: react-hook-form + Zod validation + Dialog/Sheet containers
- **Charts**: Recharts and Chart.js (react-chartjs-2)
- **Icons**: Lucide React
- **Toasts**: Sonner
- **Dates**: date-fns with locale 'es'
- **Drag & Drop**: dnd-kit
- **Path alias**: `@/*` maps to `orvit-v1/` root

### Dynamic Color System

Users have configurable color preferences (`chart1`–`chart6`, `kpiPositive`, `kpiNegative`, `kpiNeutral`). Never hardcode chart/KPI colors — use `userColors` from context with hex opacity suffixes (e.g., `${userColors.chart1}15` for 9% opacity backgrounds).

### Key Modules

| Module | Pages | API | Components |
|--------|-------|-----|------------|
| Maintenance | `app/mantenimiento/` | `api/work-orders/`, `api/maintenance/` | `components/work-orders/`, `components/corrective/` |
| Agenda/Tasks | `app/administracion/agenda/` | `api/agenda/` | `components/agendav2/` |
| Costs | `app/administracion/costos/` | `api/costs/`, `api/recetas/` | `components/costos/` |
| Purchases | `app/administracion/compras/` | `api/compras/` | `components/compras/` |
| Sales | `app/administracion/ventas/` | `api/ventas/` | `components/ventas/` |
| Inventory | `app/almacen/`, `app/panol/` | `api/almacen/`, `api/insumos/` | `components/almacen/`, `components/insumos/` |
| Machines | `app/maquinas/` | `api/machines/` | `components/maquinas/` |
| HR/Payroll | `app/administracion/nominas/` | `api/nominas/` | `components/nominas/` |

### Database

Prisma schema at `prisma/schema.prisma` (~16k lines, 150+ models). **Always verify field names in the schema before writing code** — don't assume naming.

Key model groups:
- **Core**: `User`, `Company`, `Area`, `Sector`, `Role`, `Permission`
- **Maintenance**: `WorkStation` (hierarchical), `WorkOrder`, `MaintenanceChecklist`, `FixedTask`, `FailureOccurrence`
- **Costs**: `Recipe`, `CostEmployee`, `CostProduct`, `IndirectItem`, `ProductCostHistory`
- **Purchases**: `PurchaseOrder` → `GoodsReceipt` → `PurchaseReceipt` (3-way matching)
- **Sales**: `Sale`, `Quote`, `SalesInvoice`, `ClientPayment`
- **Accounting**: `CashAccount`, `BankAccount`, `CashMovement`, `BankMovement`, `Cheque`

### Discord Bot

The bot is a **separate Node.js process** in `discord-bot/`. ORVIT communicates with it via HTTP using `lib/discord/bot-service-client.ts`. Never import `discord.js` directly from orvit-v1.

## Context Providers

Wrap order in `app/layout.tsx`:
- `AuthContext` — user, auth state, `hasPermission()`
- `CompanyContext` — active company/area/sector selection
- `NotificationContext` — real-time notifications via SSE
- `NavigationContext` — sidebar/navigation state
- `ViewModeContext` — standard vs extended display mode
- `ModulesContext` — feature flag toggles per company

## Build Configuration

- TypeScript build errors are **ignored** (`ignoreBuildErrors: true`) for deployment speed
- ESLint errors also ignored during build
- `force-dynamic` rendering on most API routes
- S3 remote image patterns configured for optimization

## Skills-First Workflow

Before any non-trivial task, invoke the matching skill (see `.claude/rules/workflow-rules.md` for the full table). Key skills: `orvit-api`, `orvit-frontend`, `orvit-prisma`, `orvit-forms`, `orvit-tables`, `orvit-maintenance`, `orvit-permissions`, `orvit-charts`.

## Session Logging

Every session must maintain a daily log at `.claude/daily-logs/YYYY-MM-DD.md` with executive summary (non-technical, by module) and technical log (files modified, decisions, issues). See `.claude/rules/workflow-rules.md`.
