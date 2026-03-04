# 🗂️ ESTRUCTURA DEL PROYECTO - Mantenimiento Correctivo

Visualización de todos los archivos creados y su organización.

---

## 📁 Estructura Completa

```
Mawir/
│
├── app/
│   ├── api/
│   │   ├── failure-occurrences/
│   │   │   ├── route.ts                    (Ya existía - GET/POST fallas)
│   │   │   ├── [id]/
│   │   │   │   └── route.ts                (Ya existía - GET/PATCH/DELETE)
│   │   │   ├── quick-report/
│   │   │   │   └── route.ts                (Ya existía - POST quick report)
│   │   │   └── stats/
│   │   │       └── route.ts                ✅ NUEVO - GET stats para KPIs
│   │   │
│   │   ├── work-orders/
│   │   │   ├── route.ts                    (Ya existía - GET/POST work orders)
│   │   │   └── [id]/
│   │   │       ├── route.ts                (Ya existía - GET/PATCH/DELETE)
│   │   │       ├── close/
│   │   │       │   └── route.ts            (Ya existía - POST close)
│   │   │       ├── waiting/
│   │   │       │   └── route.ts            (Ya existía - POST waiting)
│   │   │       └── previous-solutions/
│   │   │           └── route.ts            ✅ NUEVO - GET soluciones previas
│   │   │
│   │   ├── downtime/
│   │   │   └── [id]/
│   │   │       └── confirm-return/
│   │   │           └── route.ts            (Ya existía - POST confirm return)
│   │   │
│   │   └── machines/
│   │       ├── route.ts                    (Ya existía - GET machines)
│   │       └── [id]/
│   │           └── components/
│   │               └── route.ts            (Puede faltar - crear si no existe)
│   │
│   └── mantenimiento/
│       └── fallas/
│           └── page.tsx                    ✅ NUEVO - Página principal
│
├── components/
│   └── corrective/                         ✅ NUEVA CARPETA
│       ├── index.ts                        ✅ NUEVO - Barrel exports
│       │
│       ├── failures/
│       │   ├── index.ts                    ✅ NUEVO - Barrel exports
│       │   ├── FailureKPIs.tsx             ✅ NUEVO - 4 KPIs clickeables
│       │   ├── FailureListTable.tsx        ✅ NUEVO - Tabla de fallas
│       │   ├── FailureQuickReportDialog.tsx ✅ NUEVO - Formulario rápido
│       │   ├── FailureDetailSheet.tsx      ✅ NUEVO - Sheet con 5 tabs
│       │   ├── ComponentTreeSelector.tsx   ✅ NUEVO - Selector cascada
│       │   ├── SymptomChips.tsx            ✅ NUEVO - Chips de síntomas
│       │   └── DuplicateDetectionModal.tsx ✅ NUEVO - Modal duplicados
│       │
│       └── work-orders/
│           ├── index.ts                    ✅ NUEVO - Barrel exports
│           ├── WorkOrderDetailSheet.tsx    ✅ NUEVO - Sheet con 3 tabs
│           ├── WaitingStateDialog.tsx      ✅ NUEVO - Poner en espera
│           ├── ReturnToProductionDialog.tsx ✅ NUEVO - Confirmar retorno
│           └── GuidedCloseDialog.tsx       ✅ NUEVO - Cierre guiado
│
├── docs/
│   ├── CORRECTIVE-FRONTEND-READY.md        ✅ NUEVO - Doc técnica completa
│   ├── QUICK-SETUP-CHECKLIST.md            ✅ NUEVO - Setup rápido
│   └── PROJECT-STRUCTURE-CORRECTIVE.md     ✅ NUEVO - Este archivo
│
├── EMPEZÁ-AQUÍ.md                          ✅ NUEVO - Inicio rápido
└── RESUMEN-CORRECTIVE-FRONTEND.txt         ✅ NUEVO - Resumen ejecutivo
```

---

## 📊 Estadísticas del Proyecto

### Componentes Nuevos
- **Total:** 14 componentes
- **Failures:** 7 componentes
- **Work Orders:** 4 componentes
- **Páginas:** 1 página
- **Barrel Exports:** 3 archivos index.ts

### Endpoints Nuevos
- **Total:** 2 endpoints
- **Stats:** 1 endpoint (KPIs)
- **Previous Solutions:** 1 endpoint (reutilización)

### Documentación
- **Total:** 5 archivos
- **Técnica:** 2 archivos (completa + estructura)
- **Guías:** 2 archivos (setup + inicio rápido)
- **Resumen:** 1 archivo (ejecutivo)

### Líneas de Código (aproximado)
- **TypeScript/TSX:** ~2,500 líneas
- **Markdown:** ~1,200 líneas
- **Total:** ~3,700 líneas

---

## 🔗 Relaciones entre Componentes

### Página Principal → Componentes

```
FallasPage (page.tsx)
├── FailureKPIs                    (Muestra stats en tiempo real)
├── FailureListTable               (Muestra lista de fallas)
│   └── onClick(eye) →
│       └── FailureDetailSheet     (Detalle con tabs)
│
├── onClick(Nueva Falla) →
│   └── FailureQuickReportDialog
│       ├── ComponentTreeSelector  (Selector cascada)
│       ├── SymptomChips           (Síntomas)
│       └── onDuplicatesFound →
│           └── DuplicateDetectionModal
│
└── (Futuro) onClick(Ver OT) →
    └── WorkOrderDetailSheet       (Detalle de Work Order)
        ├── WaitingStateDialog
        ├── ReturnToProductionDialog
        └── GuidedCloseDialog
```

### Flujo de Datos

```
Frontend Component
    ↓ (useQuery / useMutation)
API Endpoint
    ↓ (verifyToken, validate)
Prisma Database
    ↓ (query/mutation)
Response
    ↓ (invalidateQueries)
UI Update
```

---

## 🎨 Convenciones de Nombres

### Componentes
- **Dialogs:** `*Dialog.tsx` (para modales pequeños)
- **Sheets:** `*Sheet.tsx` (para paneles laterales grandes)
- **Selectors:** `*Selector.tsx` (para selects/pickers)
- **Tables:** `*Table.tsx` (para tablas de datos)
- **KPIs:** `*KPIs.tsx` (para métricas/stats)

### Endpoints
- **Stats:** `/stats` (para agregados/métricas)
- **Actions:** `/[action]` (para operaciones: close, waiting, confirm-return)
- **Related Data:** `/[id]/[resource]` (para datos relacionados: previous-solutions)

### Archivos Index
- Todos los folders de componentes tienen `index.ts` para barrel exports
- Permite imports limpios: `import { FailureKPIs } from '@/components/corrective'`

---

## 📦 Dependencias por Componente

### FailureQuickReportDialog
- `@/components/ui/dialog`
- `@/components/ui/form`
- `@/components/ui/input`
- `@/components/ui/textarea`
- `@/components/ui/switch`
- `@/components/ui/collapsible` ⚠️ (instalar)
- `react-hook-form`
- `zod`
- `@tanstack/react-query`
- `sonner` ⚠️ (instalar)

### FailureListTable
- `@/components/ui/table`
- `@/components/ui/badge`
- `@/components/ui/button`
- `@/components/ui/skeleton` ⚠️ (instalar)
- `date-fns`
- `lucide-react`
- `@tanstack/react-query`

### WorkOrderDetailSheet
- `@/components/ui/sheet`
- `@/components/ui/tabs`
- `@/components/ui/badge`
- `@/components/ui/button`
- `@/components/ui/alert` ⚠️ (instalar)
- `@/components/ui/skeleton` ⚠️ (instalar)
- Todos los dialogs de work-orders

### GuidedCloseDialog
- `@/components/ui/dialog`
- `@/components/ui/form`
- `@/components/ui/tabs`
- `@/components/ui/textarea`
- `@/components/ui/input`
- `@/components/ui/select`
- `@/components/ui/alert` ⚠️ (instalar)
- `react-hook-form`
- `zod`
- `@tanstack/react-query`
- `sonner` ⚠️ (instalar)

---

## 🔧 Configuración Requerida

### 1. shadcn/ui Components (⚠️ Verificar/Instalar)

```bash
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add collapsible
npx shadcn-ui@latest add alert
```

### 2. npm Packages (⚠️ Verificar/Instalar)

```bash
npm install sonner
```

### 3. Layout Configuration

En `app/layout.tsx`, agregar:

```tsx
import { Toaster } from 'sonner';

// En el <body>:
<Toaster position="top-right" />
```

---

## 🚀 Orden de Carga

Cuando el usuario navega a `/mantenimiento/incidentes`:

1. **Página carga** (`page.tsx`)
2. **KPIs fetch** (`GET /api/failure-occurrences/stats`)
3. **Tabla fetch** (`GET /api/failure-occurrences`)
4. **Render completo** (KPIs + Tabla)

Cuando el usuario abre un detalle:

1. **Click en ojo** (FailureListTable)
2. **Sheet abre** (FailureDetailSheet)
3. **Fetch data** (`GET /api/failure-occurrences/[id]`)
4. **Render tabs**

Cuando el usuario crea una falla:

1. **Click "Nueva Falla"**
2. **Dialog abre** (FailureQuickReportDialog)
3. **User completa form**
4. **Submit** (`POST /api/failure-occurrences/quick-report`)
5. **Si duplicates** → DuplicateDetectionModal
6. **Si success** → Invalidate queries → UI update

---

## 📝 Notas de Implementación

### Patrón de Queries
Todos los componentes usan TanStack Query (React Query v5):

```tsx
const { data, isLoading } = useQuery({
  queryKey: ['resource', id],
  queryFn: async () => {
    const res = await fetch('/api/resource');
    if (!res.ok) throw new Error('Error');
    return res.json();
  },
  enabled: !!id && open, // Conditional fetching
});
```

### Patrón de Mutations
Todas las mutations usan el mismo patrón:

```tsx
const mutation = useMutation({
  mutationFn: async (data) => {
    const res = await fetch('/api/resource', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error');
    return res.json();
  },
  onSuccess: () => {
    toast.success('Success');
    queryClient.invalidateQueries({ queryKey: ['resource'] });
    onOpenChange(false);
  },
  onError: (error) => {
    toast.error(error.message);
  },
});
```

### Patrón de Validación
Todos los forms usan react-hook-form + Zod:

```tsx
const schema = z.object({
  field: z.string().min(5),
});

const form = useForm({
  resolver: zodResolver(schema),
});
```

---

## ✅ Checklist de Verificación

Antes de probar, verificar que:

- [ ] shadcn/ui components instalados (skeleton, collapsible, alert)
- [ ] sonner instalado
- [ ] Toaster agregado en layout.tsx
- [ ] Servidor corriendo (`npm run dev`)
- [ ] Backend endpoints existentes funcionando
- [ ] Prisma schema actualizado con campos nuevos

---

## 🎯 Próximos Pasos

Después de probar el frontend:

1. **Completar endpoints faltantes**
   - GET /api/work-orders/[id] (full detail)
   - POST /api/work-orders (create from failure)
   - POST /api/work-orders/[id]/resume

2. **Agregar features**
   - Upload de fotos (S3 integration)
   - Biblioteca de síntomas
   - Plantillas de soluciones
   - Sistema de comentarios

3. **Optimizar performance**
   - Lazy loading de componentes
   - Virtual scrolling en tablas
   - Cache más agresivo

4. **Agregar métricas**
   - Dashboard de métricas
   - Gráficos con Chart.js
   - Exportar a PDF

---

**Última actualización:** 2026-01-02
**Mantenido por:** Claude Sonnet 4.5
