# ⚡ QUICK SETUP CHECKLIST - Mantenimiento Correctivo

Antes de probar el sistema, ejecutá estos comandos para asegurar que todas las dependencias están instaladas:

## 1. Verificar/Instalar shadcn/ui Components

```bash
# Skeleton (para loaders)
npx shadcn-ui@latest add skeleton

# Collapsible (para "+ Detalles")
npx shadcn-ui@latest add collapsible

# Alert (para warnings/info boxes)
npx shadcn-ui@latest add alert

# Verificar que ya tengas estos (deberían estar):
# - dialog
# - sheet
# - form
# - input
# - textarea
# - button
# - badge
# - tabs
# - select
# - switch
```

## 2. Verificar sonner (Toast Notifications)

```bash
# Verificar si está instalado
npm list sonner

# Si NO está instalado:
npm install sonner
```

## 3. Agregar Toaster al Layout (si no está)

Abrir `app/layout.tsx` y agregar:

```tsx
import { Toaster } from 'sonner';

// En el return, dentro del <body>:
<Toaster position="top-right" />
```

## 4. Verificar Prisma Schema

Asegurate que el schema tenga estos modelos (deberían estar del backend):

```prisma
model FailureOccurrence {
  // ... campos existentes ...
  isLinkedDuplicate    Boolean   @default(false)
  causedDowntime       Boolean   @default(false)
  // ...
}

model WorkOrder {
  // ... campos existentes ...
  requiresReturnToProduction Boolean @default(false)
  returnToProductionConfirmed Boolean @default(false)
  // ...
}

model SolutionApplied {
  // ... todos los campos del plan ...
}

model DowntimeLog {
  // ... todos los campos del plan ...
}
```

Si falta algo:
```bash
npm run prisma:migrate
npm run prisma:generate
```

## 5. Verificar que el servidor esté corriendo

```bash
npm run dev
```

## 6. Navegar y probar

```
http://localhost:3000/mantenimiento/incidentes
```

---

## ❌ Si hay errores de compilación

### Error: "Module not found: Can't resolve '@/components/ui/skeleton'"

```bash
npx shadcn-ui@latest add skeleton
```

### Error: "Module not found: Can't resolve 'sonner'"

```bash
npm install sonner
```

### Error: "Property 'xxx' does not exist on type 'yyy'"

Significa que falta una migración de Prisma. Ejecutar:

```bash
npm run prisma:migrate dev
npm run prisma:generate
```

Luego reiniciar el servidor.

### Error: 401 en endpoints de API

Ver `docs/CORRECTIVE-FRONTEND-READY.md` sección "Issue 6: JWT Secret mismatch"

---

## ✅ Todo OK?

Si el servidor compila sin errores y la página carga, estás listo! 🎉

Ver `docs/CORRECTIVE-FRONTEND-READY.md` para el flujo de testing completo.
