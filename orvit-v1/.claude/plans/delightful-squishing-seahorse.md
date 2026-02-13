# Cambios Realizados - Módulo de Producción (Sesión Actual)

## Fecha: 2026-01-19

---

## 1. Corrección de Error SelectItem Empty Value

**Problema:** Error "A <Select.Item /> must have a value prop that is not an empty string" en Radix UI Select components.

**Archivos modificados:**
- `components/production/NewDowntimeForm.tsx` (5 selects)
- `components/production/NewDailyReportForm.tsx` (2 selects)
- `components/production/NewRoutineTemplateForm.tsx` (1 select)
- `components/production/NewRoutineExecutionForm.tsx` (2 selects)

**Solución aplicada:**
```typescript
// Antes
<SelectItem value="">Sin asignar</SelectItem>
value={field.value?.toString() || ''}
onValueChange={(val) => field.onChange(val ? parseInt(val) : null)}

// Después
<SelectItem value="_none">Sin asignar</SelectItem>
value={field.value?.toString() || '_none'}
onValueChange={(val) => field.onChange(val && val !== '_none' ? parseInt(val) : null)}
```

---

## 2. Permisos de Producción para SUPERVISOR

**Archivo:** `lib/permissions.ts`

**Cambio:** Agregados permisos de gestión de rutinas al rol SUPERVISOR:
- `produccion.rutinas.manage`
- `produccion.config.routines`

**Ubicación:** Líneas ~1754-1756

**Resultado:** Los supervisores ahora pueden crear, editar y eliminar plantillas de rutinas.

---

## 3. Verificación de Permisos en Páginas de Producción

**Verificado que todas las páginas tienen controles de permisos correctos:**

| Página | Archivo | Permisos |
|--------|---------|----------|
| Rutinas | `app/produccion/rutinas/page.tsx:136-137` | `canExecute`, `canManage` |
| Órdenes | `app/produccion/ordenes/page.tsx:138-142` | `canCreate`, `canEdit`, `canDelete`, `canStart`, `canComplete` |
| Parte Diario | `app/produccion/parte-diario/page.tsx:131-134` | `canCreate`, `canEdit`, `canConfirm`, `canDelete` |
| Paradas | `app/produccion/paradas/page.tsx:131-134` | `canCreate`, `canEdit`, `canDelete`, `canCreateWO` |
| Calidad | `app/produccion/calidad/page.tsx:169-172` | `canCreate`, `canApprove`, `canBlockLot`, `canReleaseLot` |

---

## 4. Modales Más Grandes con Mejor Espaciado

**Archivo:** `app/produccion/rutinas/page.tsx`

**Cambios:**

### Dialog de Ejecutar Rutina (líneas 722-751):
```typescript
// Antes
<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

// Después
<DialogContent className="!max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
  <DialogHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
  <div className="px-6 py-4">
```

### Dialog de Nueva/Editar Plantilla (líneas 753-784):
```typescript
// Antes
<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">

// Después
<DialogContent className="!max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
  <DialogHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
  <div className="px-6 py-4">
```

**Mejoras:**
- Modal más ancho (`!max-w-4xl` con `w-[95vw]`)
- Header sticky para mejor navegación
- Padding interno (`px-6 py-4`) para más espacio con los bordes
- Separación visual con `border-b`

---

## 5. Nuevo Tipo PHOTO para Items de Rutinas

### 5.1 NewRoutineTemplateForm.tsx

**Cambios:**

1. **Imports agregados:**
```typescript
import { Camera, ImageIcon } from 'lucide-react';
```

2. **Schema actualizado:**
```typescript
const itemSchema = z.object({
  // ...existing fields
  type: z.enum(['CHECK', 'VALUE', 'TEXT', 'PHOTO']),
  allowMultiplePhotos: z.boolean().optional().default(false),
});
```

3. **Nuevo tipo en selector:**
```typescript
<SelectItem value="PHOTO">
  <div className="flex items-center gap-2">
    <Camera className="h-4 w-4" />
    Foto / Imagen
  </div>
</SelectItem>
```

4. **Opciones específicas para PHOTO:**
```typescript
{form.watch(`items.${index}.type`) === 'PHOTO' && (
  <div className="pt-2 border-t">
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <ImageIcon className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium">Captura de imagen</p>
        <p className="text-xs text-muted-foreground">
          El operador deberá tomar o subir una foto
        </p>
      </div>
      <FormField name={`items.${index}.allowMultiplePhotos`}>
        <Checkbox /> Múltiples fotos
      </FormField>
    </div>
  </div>
)}
```

### 5.2 NewRoutineExecutionForm.tsx

**Cambios:**

1. **Imports agregados:**
```typescript
import { Camera, Upload, X, ImageIcon } from 'lucide-react';
```

2. **Interface actualizada:**
```typescript
interface RoutineItem {
  type: 'CHECK' | 'VALUE' | 'TEXT' | 'PHOTO';
  allowMultiplePhotos?: boolean;
}
```

3. **Estado para fotos:**
```typescript
const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
const [responses, setResponses] = useState<Record<string, {
  value: any;
  notes: string;
  photos?: string[]
}>>({});
```

4. **Función de upload:**
```typescript
const handlePhotoUpload = async (itemId: string, file: File) => {
  setUploadingPhoto(itemId);
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'production/routines');
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    // ... handle response
  } finally {
    setUploadingPhoto(null);
  }
};
```

5. **Función para eliminar foto:**
```typescript
const removePhoto = (itemId: string, photoIndex: number) => {
  setResponses(prev => ({
    ...prev,
    [itemId]: {
      ...prev[itemId],
      photos: (prev[itemId]?.photos || []).filter((_, i) => i !== photoIndex),
    },
  }));
};
```

6. **UI para tipo PHOTO:**
- Grid de previews de fotos cargadas
- Botón "Tomar Foto" (con `capture="environment"` para cámara)
- Botón "Subir Imagen" (seleccionar de galería)
- Botón X para eliminar fotos
- Indicador de estado (fotos cargadas / requeridas)
- Soporte para múltiples fotos

7. **Validación de fotos requeridas:**
```typescript
if (item.type === 'PHOTO' && item.required &&
    (!response.photos || response.photos.length === 0)) {
  return true; // hasIssues
}
```

8. **Inclusión de fotos en respuesta:**
```typescript
const responseArray = Object.entries(responses).map(([itemId, data]) => ({
  itemId,
  value: data.value,
  notes: data.notes,
  photos: data.photos || [],
}));
```

---

## Resumen de Funcionalidades Nuevas

### Para Administradores/Supervisores:
- Crear plantillas de rutinas con items tipo FOTO
- Configurar si se permiten múltiples fotos por item
- Marcar fotos como requeridas u opcionales

### Para Operadores:
- Tomar fotos directamente con la cámara del dispositivo
- Subir imágenes desde la galería
- Ver previews de las fotos cargadas
- Eliminar fotos antes de enviar
- Validación automática de fotos requeridas

---

## Archivos Modificados (Resumen)

| Archivo | Cambios |
|---------|---------|
| `lib/permissions.ts` | +2 permisos SUPERVISOR |
| `app/produccion/rutinas/page.tsx` | Modales más grandes |
| `components/production/NewRoutineTemplateForm.tsx` | +Tipo PHOTO |
| `components/production/NewRoutineExecutionForm.tsx` | +Upload fotos |
| `components/production/NewDowntimeForm.tsx` | Fix SelectItem |
| `components/production/NewDailyReportForm.tsx` | Fix SelectItem |

---

## Testing Recomendado

1. **Permisos:**
   - Login como SUPERVISOR y verificar que aparece "Nueva Plantilla"
   - Verificar que USER no puede crear plantillas

2. **Fotos en Rutinas:**
   - Crear plantilla con item tipo FOTO
   - Ejecutar rutina y tomar/subir foto
   - Verificar que se guarda correctamente
   - Probar múltiples fotos si está habilitado

3. **Modales:**
   - Verificar tamaño correcto en desktop y móvil
   - Verificar scroll interno funciona
   - Verificar header sticky al scrollear
