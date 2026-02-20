---
name: orvit-maintenance
description: Módulo de mantenimiento de Orvit. Usar al trabajar con mantenimiento preventivo, correctivo, checklists, health score, KPIs, órdenes de trabajo o dashboard de mantenimiento.
---

# Módulo de Mantenimiento — Orvit

## Estructura del módulo

```
app/api/maintenance/
├── route.ts                   # Lista y crear mantenimientos
├── [id]/route.ts              # CRUD por ID
├── all/route.ts               # Todos (sin paginación, para dashboard)
├── pending/route.ts           # Pendientes
├── completed/route.ts         # Completados
├── corrective/route.ts        # Solo correctivos
├── preventive/
│   ├── route.ts               # Preventivos
│   ├── [id]/route.ts          # CRUD preventivo
│   ├── [id]/complete/route.ts # Completar preventivo
│   ├── [id]/instructives/route.ts
│   └── alerts/route.ts
├── checklists/route.ts        # Checklists
├── checklists/[id]/route.ts
├── checklists/history/route.ts
├── checklists/reset/route.ts
├── smart-checklists/route.ts
├── smart-checklists/execute/route.ts
├── execute/route.ts           # Ejecutar mantenimiento
├── execute-checklist/route.ts
├── checklist-execution/route.ts
├── dashboard/route.ts         # KPIs y resumen
├── kpis/route.ts
├── health-score/route.ts      # Health score por equipo
├── pdf-data/route.ts
├── create/route.ts
├── delete/route.ts
├── duplicate/route.ts
├── manual-completion/route.ts
├── unidad-movil/route.ts
├── unidad-movil/[unidadId]/route.ts
└── export/route.ts

lib/maintenance/
├── health-score-calculator.ts  # Lógica de health score
├── display-utils.ts            # Formateo para UI
└── preventive-template.repository.ts

components/maintenance/
├── EnhancedMaintenancePanel.tsx  # Panel principal
├── ChecklistHistoryDialog.tsx
└── preventive/
    ├── PreventivoHoyView.tsx
    └── PreventivoPlanesView.tsx
```

---

## Health Score

```ts
// lib/maintenance/health-score-calculator.ts
// Score de 0-100 basado en:
// - Mantenimientos completados a tiempo
// - Backlog de pendientes
// - Frecuencia de correctivos vs preventivos
// - Antigüedad del equipo

type HealthScore = {
  score: number;           // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'up' | 'down' | 'stable';
  factors: HealthFactor[];
};

// Colores por grade
const GRADE_COLORS = {
  A: '#10b981',  // verde
  B: '#6366f1',  // azul
  C: '#f59e0b',  // amarillo
  D: '#f97316',  // naranja
  F: '#ef4444',  // rojo
};
```

---

## Server Cache — Claves de mantenimiento

```ts
// Convención de claves:
`maintenance:all:${companyId}`
`maintenance:pending:${companyId}`
`maintenance:dashboard:${companyId}`
`maintenance:kpis:${companyId}`
`maintenance:health:${companyId}:${equipoId}`
`maintenance:preventive:${companyId}`
`maintenance:checklists:${companyId}`

// TTL recomendados
dashboard / kpis: 2 * 60      // 2 min (cambian frecuente)
health-score: 5 * 60          // 5 min
listas: 3 * 60                // 3 min
checklists: 5 * 60            // 5 min
```

---

## Hook principal — `use-maintenance-dashboard.ts`

```ts
// hooks/use-maintenance-dashboard.ts
export function useMaintenanceDashboard(companyId: number) {
  const query = useQuery({
    queryKey: queryKeys.maintenance.dashboard(companyId),
    queryFn: () => fetch(`/api/maintenance/dashboard?companyId=${companyId}`).then(r => r.json()),
    staleTime: STALE_TIMES.DASHBOARD, // 2 min
  });

  return {
    dashboard: query.data?.data,
    kpis: query.data?.kpis,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
```

---

## Tipos principales

```ts
type MaintenanceStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE' | 'EMERGENCY';
type MaintenancePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

interface Maintenance {
  id: number;
  companyId: number;
  type: MaintenanceType;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  title: string;
  description?: string;
  scheduledDate?: Date;
  completedAt?: Date;
  equipoId?: number;
  assignedTo?: number;
  estimatedDuration?: number; // minutos
  actualDuration?: number;
  checklists?: Checklist[];
  deletedAt?: Date;
}

interface Checklist {
  id: number;
  maintenanceId: number;
  title: string;
  items: ChecklistItem[];
  completedAt?: Date;
}

interface ChecklistItem {
  id: number;
  description: string;
  isCompleted: boolean;
  notes?: string;
  completedAt?: Date;
}
```

---

## Colores de estado para UI

```ts
// display-utils.ts — convención de colores
const STATUS_CONFIG = {
  PENDING:    { label: 'Pendiente',    color: '#f59e0b', bg: '#f59e0b15' },
  IN_PROGRESS:{ label: 'En progreso',  color: '#6366f1', bg: '#6366f115' },
  COMPLETED:  { label: 'Completado',   color: '#10b981', bg: '#10b98115' },
  CANCELLED:  { label: 'Cancelado',    color: '#6b7280', bg: '#6b728015' },
  OVERDUE:    { label: 'Vencido',      color: '#ef4444', bg: '#ef444415' },
};

const PRIORITY_CONFIG = {
  LOW:      { label: 'Baja',     color: '#6b7280' },
  NORMAL:   { label: 'Normal',   color: '#6366f1' },
  HIGH:     { label: 'Alta',     color: '#f59e0b' },
  CRITICAL: { label: 'Crítica',  color: '#ef4444' },
};
```

---

## Preventivo vs Correctivo

| Preventivo | Correctivo |
|---|---|
| Programado con fecha | Reactivo a falla |
| Tiene plan/template | Único |
| Checklist obligatorio | Checklist opcional |
| `scheduledDate` definido | `scheduledDate` = fecha falla |
| Puede repetirse (cron) | Un solo ciclo |

---

## Cron jobs de mantenimiento

```ts
// app/api/cron/preventive-scheduler/route.ts
// Corre diario — crea mantenimientos preventivos según frecuencia del plan
// Auth: Bearer token de CRON_SECRET

// app/api/cron/sla-check/route.ts
// Corre cada hora — detecta mantenimientos vencidos y dispara alertas Discord
```

---

## KPIs del dashboard

```ts
interface MaintenanceKPIs {
  totalPending: number;
  totalCompleted: number;
  totalOverdue: number;
  completionRate: number;      // % completados a tiempo
  avgDuration: number;         // minutos promedio
  preventiveVsCorrectiveRatio: number;
  topEquipos: { id: number; name: string; maintenanceCount: number }[];
  healthScore: number;         // 0-100 global
}
```
