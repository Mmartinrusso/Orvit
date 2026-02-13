# Guía de Estándares UI - ORVIT

Esta guía define los estándares de diseño para mantener consistencia visual en todo el sistema.

## Componentes Estandarizados

### 1. StandardDialog

Para modales/diálogos centrados en pantalla.

```tsx
import { StandardDialog } from '@/components/ui/standard-dialog';
import { Button } from '@/components/ui/button';

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <StandardDialog
      open={open}
      onOpenChange={setOpen}
      title="Título del Dialog"
      description="Descripción opcional"
      size="md" // sm | md | lg | xl | full
      footer={
        <>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Guardar
          </Button>
        </>
      }
    >
      {/* Contenido aquí */}
    </StandardDialog>
  );
}
```

#### Tamaños de Dialog

| Tamaño | Ancho | Uso |
|--------|-------|-----|
| `sm` | max-w-md (~448px) | Confirmaciones, formularios simples |
| `md` | max-w-2xl (~672px) | Formularios medianos, selectores |
| `lg` | max-w-4xl (~896px) | Formularios complejos, tablas pequeñas |
| `xl` | max-w-6xl (~1152px) | Dashboards, tablas grandes |
| `full` | max-w-[95vw] | Gestión compleja, pantalla casi completa |

### 2. StandardSheet

Para paneles laterales que se deslizan desde un lado.

```tsx
import { StandardSheet } from '@/components/ui/standard-sheet';
import { Button } from '@/components/ui/button';

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <StandardSheet
      open={open}
      onOpenChange={setOpen}
      title="Título del Sheet"
      description="Descripción opcional"
      size="md" // sm | md | lg | xl
      side="right" // left | right | top | bottom
      footer={
        <>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Guardar
          </Button>
        </>
      }
    >
      {/* Contenido aquí */}
    </StandardSheet>
  );
}
```

#### Tamaños de Sheet

| Tamaño | Ancho | Uso |
|--------|-------|-----|
| `sm` | 400px | Detalles rápidos, info mínima |
| `md` | 600px | Formularios estándar |
| `lg` | 800px | Formularios complejos |
| `xl` | 1000px | Gestión completa |

---

## Design Tokens

Importar desde `@/lib/design-tokens` para valores consistentes:

```tsx
import {
  DIALOG_SIZES,
  SHEET_SIZES,
  BUTTON_SIZES,
  TAB_SIZES,
  STATUS_COLORS,
  PRIORITY_COLORS,
  getDialogClasses,
  getButtonClasses,
  getStatusClasses,
  getPriorityClasses,
} from '@/lib/design-tokens';
```

### Tamaños de Botones

```tsx
// Usar con className
<Button className={BUTTON_SIZES.sm}>Botón pequeño</Button>
<Button className={BUTTON_SIZES.default}>Botón normal</Button>
<Button className={BUTTON_SIZES.lg}>Botón grande</Button>

// O usar el size prop del componente Button (preferido)
<Button size="sm">Botón pequeño</Button>
<Button size="default">Botón normal</Button>
<Button size="lg">Botón grande</Button>
```

| Tamaño | Clases | Uso |
|--------|--------|-----|
| `xs` | h-6 px-2 text-xs | Íconos inline, badges |
| `sm` | h-8 px-3 text-sm | Acciones secundarias |
| `default` | h-9 px-4 text-sm | Acciones principales |
| `lg` | h-10 px-6 text-base | CTAs importantes |

### Tamaños de Tabs

```tsx
<TabsTrigger className={TAB_SIZES.sm}>Tab</TabsTrigger>  // Muchas opciones
<TabsTrigger className={TAB_SIZES.default}>Tab</TabsTrigger>  // Uso general
<TabsTrigger className={TAB_SIZES.lg}>Tab</TabsTrigger>  // Navegación principal
```

### Colores de Estado

```tsx
import { getStatusClasses } from '@/lib/design-tokens';

const statusClasses = getStatusClasses('pending'); // o 'in_progress', 'completed', etc.
// Returns: { bg: '...', text: '...', border: '...' }

<Badge className={cn(statusClasses.bg, statusClasses.text)}>
  Pendiente
</Badge>
```

### Colores de Prioridad

```tsx
import { getPriorityClasses } from '@/lib/design-tokens';

const priorityClasses = getPriorityClasses('HIGH');
// Returns: { bg: '...', text: '...' }

<Badge className={cn(priorityClasses.bg, priorityClasses.text)}>
  Alta
</Badge>
```

---

## Reglas Generales

### 1. Estructura de Dialog/Sheet

Todos los dialogs y sheets deben seguir esta estructura:

```
┌─────────────────────────────────┐
│ Header (título + descripción)   │ ← Fijo, con borde inferior
├─────────────────────────────────┤
│                                 │
│ Contenido principal             │ ← Scrolleable
│                                 │
├─────────────────────────────────┤
│ Footer (botones de acción)      │ ← Fijo, con borde superior
└─────────────────────────────────┘
```

### 2. Orden de Botones en Footer

- **Cancelar/Cerrar**: A la izquierda (variant="outline")
- **Acción principal**: A la derecha (variant="default")

```tsx
<DialogFooter>
  <Button variant="outline" onClick={onCancel}>Cancelar</Button>
  <Button onClick={onSave}>Guardar</Button>
</DialogFooter>
```

### 3. Espaciado Consistente

- **Padding de contenedor**: `p-4` (normal) o `p-6` (amplio)
- **Gap entre elementos**: `gap-2` (pequeño), `gap-4` (normal), `gap-6` (amplio)
- **Margen entre secciones**: `space-y-4` o `space-y-6`

### 4. Formularios

- Usar `space-y-4` entre campos de formulario
- Labels siempre arriba del input
- Mensajes de error en rojo debajo del campo
- Campos requeridos marcados con asterisco

```tsx
<div className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="name">Nombre *</Label>
    <Input id="name" {...register('name')} />
    {errors.name && (
      <p className="text-sm text-red-500">{errors.name.message}</p>
    )}
  </div>
  {/* Más campos... */}
</div>
```

### 5. Tablas

- Usar `TABLE_CELL_PADDING.default` para celdas
- Headers con `TABLE_HEADER_CLASSES`
- Filas alternadas con hover

### 6. Responsive

- Mobile first: diseñar para mobile, luego adaptar a desktop
- Usar breakpoints de Tailwind: `sm:`, `md:`, `lg:`, `xl:`
- En mobile, sheets de tamaño `full` si es necesario

---

## Migración de Componentes Existentes

Para migrar un componente existente al estándar:

1. Importar `StandardDialog` o `StandardSheet`
2. Reemplazar `Dialog`/`DialogContent` con `StandardDialog`
3. Mover el título a la prop `title`
4. Mover descripción a la prop `description`
5. Elegir el `size` apropiado
6. Mover botones del footer a la prop `footer`

### Antes:

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
    <DialogHeader>
      <DialogTitle>Mi Título</DialogTitle>
      <DialogDescription>Mi descripción</DialogDescription>
    </DialogHeader>
    <div className="flex-1 overflow-y-auto py-4">
      {/* contenido */}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
      <Button onClick={handleSave}>Guardar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Después:

```tsx
<StandardDialog
  open={open}
  onOpenChange={setOpen}
  title="Mi Título"
  description="Mi descripción"
  size="md"
  footer={
    <>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
      <Button onClick={handleSave}>Guardar</Button>
    </>
  }
>
  {/* contenido */}
</StandardDialog>
```

---

## Checklist de Consistencia

Antes de crear un nuevo componente, verificar:

- [ ] ¿Estoy usando `StandardDialog` o `StandardSheet`?
- [ ] ¿El tamaño es apropiado para el contenido?
- [ ] ¿Los botones siguen el orden estándar?
- [ ] ¿El espaciado usa los tokens definidos?
- [ ] ¿Los colores de estado/prioridad usan los helpers?
- [ ] ¿El componente es responsive?
