---
name: orvit-forms
description: Formularios CRUD en Orvit — Dialog/Sheet con react-hook-form + Zod + shadcn/ui. Usar al crear formularios de creación/edición, diálogos de confirmación, o cualquier input controlado.
---

# Forms — Orvit Patterns

## Filosofía
- **Dialog** para formularios simples (≤ 5 campos)
- **Sheet** (panel lateral) para formularios complejos o con muchos campos
- **react-hook-form** siempre — nunca estado manual para forms
- **Zod** para validación — schema compartido entre frontend y API
- Un componente por operación: `RecursoCreateDialog`, `RecursoEditSheet`

---

## Schema Zod compartido

```ts
// lib/validations/recurso.ts  ← compartir entre form y API
import { z } from 'zod';

export const CreateRecursoSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(255),
  description: z.string().optional(),
  value: z.coerce.number().positive('Debe ser mayor a 0'),
  categoryId: z.coerce.number().positive('Seleccioná una categoría'),
  isActive: z.boolean().default(true),
});

export type CreateRecursoInput = z.infer<typeof CreateRecursoSchema>;

// Para edición — todos los campos opcionales excepto id
export const UpdateRecursoSchema = CreateRecursoSchema.partial().extend({
  id: z.number().positive(),
});
```

---

## Dialog de creación (formulario simple)

```tsx
// components/[feature]/RecursoCreateDialog.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CreateRecursoSchema, type CreateRecursoInput } from '@/lib/validations/recurso';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecursoCreateDialog({ open, onClose, onSuccess }: Props) {
  const form = useForm<CreateRecursoInput>({
    resolver: zodResolver(CreateRecursoSchema),
    defaultValues: {
      name: '',
      description: '',
      isActive: true,
    },
  });

  const onSubmit = async (data: CreateRecursoInput) => {
    try {
      toast.loading('Creando...', { id: 'create-recurso' });
      const res = await fetch('/api/recurso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success('Creado correctamente', { id: 'create-recurso' });
      form.reset();
      onSuccess();
      onClose();
    } catch {
      toast.error('Error al crear', { id: 'create-recurso' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nuevo Recurso</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del recurso" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* IMPORTANTE: nunca usar value="" en SelectItem — usar un valor real */}
                      <SelectItem value="1">Categoría A</SelectItem>
                      <SelectItem value="2">Categoría B</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creando...' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Sheet de edición (formulario complejo)

```tsx
// components/[feature]/RecursoEditSheet.tsx
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { UpdateRecursoSchema, type UpdateRecursoInput } from '@/lib/validations/recurso';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: Recurso | null;
}

export function RecursoEditSheet({ open, onClose, onSuccess, item }: Props) {
  const form = useForm<UpdateRecursoInput>({
    resolver: zodResolver(UpdateRecursoSchema),
  });

  // Poblar el form cuando cambia el item
  useEffect(() => {
    if (item) {
      form.reset({
        id: item.id,
        name: item.name,
        description: item.description ?? '',
        isActive: item.isActive,
      });
    }
  }, [item, form]);

  const onSubmit = async (data: UpdateRecursoInput) => {
    try {
      toast.loading('Guardando...', { id: 'update-recurso' });
      const res = await fetch(`/api/recurso/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success('Guardado', { id: 'update-recurso' });
      onSuccess();
      onClose();
    } catch {
      toast.error('Error al guardar', { id: 'update-recurso' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar Recurso</SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl><Textarea rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <FormLabel className="cursor-pointer">Activo</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <SheetFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
```

---

## Reglas críticas de SelectItem

```tsx
// ❌ MAL — value="" causa bug de React con Radix
<SelectItem value="">Seleccionar...</SelectItem>

// ✅ BIEN — usar placeholder en SelectValue
<SelectTrigger>
  <SelectValue placeholder="Seleccionar categoría" />
</SelectTrigger>
<SelectContent>
  <SelectItem value="1">Opción 1</SelectItem>
</SelectContent>

// ✅ BIEN — si necesitás "todos", usar valor semántico
<SelectItem value="all">Todos</SelectItem>
```

---

## Inputs numéricos

```tsx
// Siempre z.coerce.number() en el schema para inputs numéricos
value: z.coerce.number().positive('Debe ser mayor a 0'),

// El input type="number" con step
<Input type="number" min={0} step="0.01" {...field} />
```

---

## Confirmación destructiva

```tsx
// Para eliminar — confirm() nativo es aceptable
const handleDelete = async (id: number) => {
  if (!confirm('¿Eliminar este elemento? Esta acción no se puede deshacer.')) return;
  try {
    toast.loading('Eliminando...', { id: 'delete' });
    await fetch(`/api/recurso/${id}`, { method: 'DELETE' });
    toast.success('Eliminado', { id: 'delete' });
    onSuccess();
  } catch {
    toast.error('Error al eliminar', { id: 'delete' });
  }
};
```

---

## Anti-patterns

- ❌ Estado manual con `useState` para form data — siempre `useForm`
- ❌ `value=""` en `SelectItem` — usar `placeholder` en `SelectValue`
- ❌ Submit sin `form.formState.isSubmitting` para deshabilitar el botón
- ❌ `useEffect` con `setValue` campo por campo — usar `form.reset({ ...item })` completo
- ❌ Schemas Zod duplicados en form y API — definirlos en `lib/validations/` y compartir
