# Plan Maestro: Estandarización UI - ORVIT

## Objetivo
Crear un sistema de diseño consistente, minimalista y totalmente responsive que funcione perfectamente en PC, notebook, tablet y móvil.

---

## FASE 1: Definición de Estándares (Tokens de Diseño)

### 1.1 Tabs - Estándar Definido

Basado en el estilo que te gusta (EnhancedMaintenancePanel, MachineDetailDialog):

```
TabsList:
- Altura: h-9 (36px)
- Background: bg-muted/40
- Border: border border-border
- Padding: p-1
- Border radius: rounded-md
- Responsive: w-full sm:w-fit
- Overflow: overflow-x-auto (scroll horizontal en móvil)

TabsTrigger:
- Altura: h-7 (28px)
- Padding: px-3 (12px horizontal)
- Text: text-xs (12px)
- Font: font-normal (inactivo), font-semibold (activo)
- Gap icono-texto: gap-1.5
- Icono: h-3.5 w-3.5
- Border radius: rounded-md
- Shrink: shrink-0 (no se comprimen)

Responsive:
- Texto largo: hidden sm:inline (oculto en móvil)
- Texto corto: sm:hidden (visible solo en móvil)

Hover/Estados:
- Inactivo hover: hover:bg-muted/70 hover:text-foreground
- Activo: bg-background shadow-sm text-foreground font-semibold
- Transition: transition-colors duration-150
```

### 1.2 Botones - Estándar Definido

```
Tamaños (minimalistas):
- xs: h-6 px-2 text-xs      → Acciones mínimas, íconos inline
- sm: h-7 px-2.5 text-xs    → Botones secundarios, dentro de cards
- default: h-8 px-3 text-sm → Botones principales
- lg: h-9 px-4 text-sm      → CTAs importantes

Botones de ícono:
- xs: h-6 w-6
- sm: h-7 w-7
- default: h-8 w-8
- lg: h-9 w-9

Icono dentro de botón:
- Con botón xs/sm: h-3 w-3 o h-3.5 w-3.5
- Con botón default: h-4 w-4
- Con botón lg: h-4 w-4

Variantes:
- default: bg-primary hover:bg-primary/90
- secondary: bg-secondary hover:bg-secondary/80
- outline: border hover:bg-accent
- ghost: hover:bg-accent
- destructive: bg-destructive hover:bg-destructive/90
- link: underline-offset-4 hover:underline

Border radius: rounded-md (todos)
Transition: transition-colors (todos)
```

### 1.3 Modales/Dialogs - Estándar Definido

```
Tamaños:
- sm: max-w-md (448px)      → Confirmaciones, alertas
- default: max-w-lg (512px) → Formularios simples
- md: max-w-2xl (672px)     → Formularios medianos
- lg: max-w-4xl (896px)     → Formularios complejos
- xl: max-w-6xl (1152px)    → Tablas, dashboards
- full: max-w-[95vw]        → Gestión completa

Altura máxima: max-h-[85vh]
Padding contenido: p-4 (no p-6, más compacto)
Border radius: rounded-lg

Estructura obligatoria:
┌─────────────────────────────────┐
│ Header: pb-3 border-b          │
│ - Título: text-base font-semibold
│ - Descripción: text-sm text-muted-foreground
├─────────────────────────────────┤
│ Content: py-4 overflow-y-auto  │
│ - flex-1 min-h-0               │
├─────────────────────────────────┤
│ Footer: pt-3 border-t          │
│ - gap-2 justify-end            │
└─────────────────────────────────┘

Responsive:
- Mobile: w-[95vw] (casi pantalla completa)
- Desktop: usa max-w-* definido
```

### 1.4 Sheets (Paneles Laterales) - Estándar Definido

```
Tamaños:
- sm: w-[350px]  → Detalles rápidos
- default: w-[450px] → Formularios simples
- md: w-[550px]  → Formularios medianos
- lg: w-[700px]  → Formularios complejos
- xl: w-[900px]  → Gestión completa

Mobile: w-full (100% del ancho)

Estructura: igual que Dialog
Padding: p-4
```

### 1.5 Inputs - Estándar Definido

```
Tamaños:
- sm: h-7 text-xs px-2      → Filtros compactos, tablas
- default: h-8 text-sm px-3 → Formularios normales
- lg: h-9 text-sm px-3      → Formularios destacados

Label:
- text-sm font-medium
- mb-1.5 (separación del input)

Error:
- Input: border-destructive
- Mensaje: text-xs text-destructive mt-1

Spacing entre campos: space-y-3 o space-y-4
```

### 1.6 Badges - Estándar Definido

```
Tamaños:
- sm: px-1.5 py-0.5 text-[10px] → Contadores, inline
- default: px-2 py-0.5 text-xs  → Estados, etiquetas
- lg: px-2.5 py-1 text-xs       → Destacados

Border radius: rounded-full (siempre)
Font: font-medium (no semibold, más sutil)

Colores de Estado:
- pending: bg-yellow-100 text-yellow-800 border-yellow-200
- in_progress: bg-blue-100 text-blue-800 border-blue-200
- completed: bg-green-100 text-green-800 border-green-200
- cancelled: bg-gray-100 text-gray-600 border-gray-200
- overdue: bg-red-100 text-red-800 border-red-200

Colores de Prioridad:
- low: bg-slate-100 text-slate-600
- medium: bg-yellow-100 text-yellow-700
- high: bg-orange-100 text-orange-700
- critical: bg-red-100 text-red-700

Colores de Tipo:
- preventive: bg-blue-100 text-blue-700
- corrective: bg-orange-100 text-orange-700
- predictive: bg-purple-100 text-purple-700
```

### 1.7 Cards - Estándar Definido

```
Padding:
- Compact: p-3
- Default: p-4
- Spacious: p-5

Header:
- pb-2 (separación del contenido)
- Título: text-sm font-medium
- Descripción: text-xs text-muted-foreground

Border radius: rounded-lg
Border: border (1px)
Shadow: shadow-sm (sutil)

Hover (si es clickeable):
- hover:shadow-md
- hover:border-primary/20
- transition-all duration-200
```

### 1.8 Espaciado General

```
Gap/Space entre elementos:
- Mínimo: gap-1 (4px)   → Entre íconos y texto
- Pequeño: gap-2 (8px)  → Entre elementos relacionados
- Normal: gap-3 (12px)  → Entre campos de formulario
- Medio: gap-4 (16px)   → Entre secciones
- Grande: gap-6 (24px)  → Entre grupos de secciones

Padding de contenedores:
- Compacto: p-3
- Normal: p-4
- Amplio: p-6

Margin entre secciones:
- space-y-4 o space-y-6
```

---

## FASE 2: Actualización de Componentes Base

### 2.1 Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `components/ui/button.tsx` | Ajustar tamaños a versión minimalista |
| `components/ui/tabs.tsx` | Crear variantes estandarizadas |
| `components/ui/input.tsx` | Ajustar altura default a h-8 |
| `components/ui/badge.tsx` | Agregar variantes de estado/prioridad |
| `components/ui/dialog.tsx` | Verificar estructura y padding |
| `components/ui/sheet.tsx` | Ajustar anchos estándar |
| `lib/design-tokens.ts` | Actualizar con valores finales |

### 2.2 Nuevos Componentes a Crear

| Componente | Propósito |
|------------|-----------|
| `components/ui/responsive-tabs.tsx` | Tabs con comportamiento responsive automático |
| `components/ui/status-badge.tsx` | Badge con colores de estado predefinidos |
| `components/ui/priority-badge.tsx` | Badge con colores de prioridad predefinidos |

---

## FASE 3: Página Design System

### 3.1 Secciones de la Página

1. **Tabs** - Mostrar el estilo estándar con todas las variantes
2. **Botones** - Todos los tamaños y variantes
3. **Modales** - Los 6 tamaños con demo interactiva
4. **Sheets** - Los 5 tamaños con demo
5. **Inputs** - Todos los estados y tamaños
6. **Badges** - Estados, prioridades, tipos
7. **Cards** - Variantes y estados
8. **Colores** - Paleta completa
9. **Responsive** - Demo de cómo se ven en diferentes dispositivos

### 3.2 Testing en la Página

- Agregar selector de viewport (mobile/tablet/desktop)
- Mostrar medidas reales en píxeles
- Indicadores de hover funcionales

---

## FASE 4: Migración de Componentes

### 4.1 Orden de Prioridad (por uso e impacto)

**Prioridad 1 - Críticos (más usados):**
1. `EnhancedMaintenancePanel.tsx` - Ya tiene buen estilo, usar como referencia
2. `MachineDetailDialog.tsx` - 31 usos de DialogContent
3. `ChecklistManagementDialog.tsx`
4. `WorkstationUpsertSheet.tsx`

**Prioridad 2 - Alta:**
5. `FailureRegistrationDialog.tsx`
6. `LoadSolutionDialog.tsx`
7. `WorkOrderWizard.tsx`
8. `Recetas.tsx`
9. `Insumos.tsx`
10. `Productos.tsx`

**Prioridad 3 - Media:**
11-30. Resto de dialogs de mantenimiento
31-50. Dialogs de costos
51-70. Dialogs de configuración

**Prioridad 4 - Baja:**
71+. Componentes menos usados

### 4.2 Proceso de Migración por Componente

Para cada componente:
1. [ ] Revisar estructura actual
2. [ ] Ajustar tamaño de dialog/sheet
3. [ ] Estandarizar tabs (si tiene)
4. [ ] Estandarizar botones
5. [ ] Estandarizar inputs
6. [ ] Estandarizar badges
7. [ ] Verificar espaciado
8. [ ] Probar responsive (mobile, tablet, desktop)
9. [ ] Verificar hover states
10. [ ] Verificar focus states (accesibilidad)

---

## FASE 5: Testing Responsive

### 5.1 Breakpoints a Testear

```
Mobile:     320px - 639px   (sm:)
Tablet:     640px - 1023px  (md:)
Desktop:    1024px - 1279px (lg:)
Wide:       1280px+         (xl:)
```

### 5.2 Checklist por Componente

- [ ] Mobile 320px - Todo visible y usable
- [ ] Mobile 375px - Layout correcto
- [ ] Tablet 768px - Transición suave
- [ ] Desktop 1024px - Aprovecha espacio
- [ ] Wide 1440px - No se ve vacío

### 5.3 Elementos Críticos a Verificar

- [ ] Tabs: scroll horizontal en mobile, no se cortan textos
- [ ] Botones: tamaño táctil mínimo 44px en mobile
- [ ] Dialogs: no se salen de pantalla
- [ ] Inputs: fáciles de tocar en mobile
- [ ] Tablas: scroll horizontal si es necesario
- [ ] Menús: accesibles en todos los tamaños

---

## FASE 6: Documentación Final

### 6.1 Entregables

1. `docs/UI-STANDARDS.md` - Guía actualizada con todos los estándares
2. `docs/COMPONENT-CHECKLIST.md` - Checklist para nuevos componentes
3. Página `/design-system` - Referencia visual interactiva
4. `lib/design-tokens.ts` - Tokens exportables

---

## Cronograma Sugerido (sin fechas, por fases)

| Fase | Descripción | Dependencias |
|------|-------------|--------------|
| 1 | Definir tokens finales | Tu aprobación |
| 2 | Actualizar componentes base | Fase 1 completa |
| 3 | Crear página design-system mejorada | Fase 2 completa |
| 4.1 | Migrar componentes Prioridad 1 | Fase 3 completa |
| 4.2 | Migrar componentes Prioridad 2 | Fase 4.1 completa |
| 4.3 | Migrar componentes Prioridad 3-4 | Fase 4.2 completa |
| 5 | Testing responsive completo | Cada sub-fase de 4 |
| 6 | Documentación final | Fase 5 completa |

---

## Próximo Paso Inmediato

**Necesito tu confirmación en:**

1. ¿Los tamaños de Tabs propuestos están bien? (h-9 lista, h-7 trigger, text-xs)
2. ¿Los tamaños de botones minimalistas están bien? (h-6, h-7, h-8, h-9)
3. ¿Los tamaños de modales están bien?
4. ¿Empezamos actualizando la página /design-system con estos estilos para que los veas?

Una vez confirmes, actualizo la página design-system y seguimos con la Fase 2.
