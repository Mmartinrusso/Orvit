# Plan: Agenda — Spacing, Performance y URLs

## Contexto

El usuario reporta 3 problemas en el modulo AgendaV2:
1. **Botones de accion del card pegados** — los iconos de avanzar estado, ver detalle y menu `...` en hover tienen solo 4px de gap y son de 22px, se ven apretados
2. **Carga lenta** — el hook `useUsers()` hace fetch sin cache, y se monta en 5+ componentes simultaneamente causando 10+ requests a `/api/companies/{id}/users` por page load
3. **Sin URLs por vista** — todo es `/administracion/agenda` sin importar si estas en Board, Inbox, Dashboard, etc. No hay deep-linking ni funciona el boton back

---

## Cambio 1: Spacing de botones en TaskCard

**Archivo**: `orvit-v1/components/agendav2/TaskCard.tsx`

**Cambios**:
- Aumentar `gap` de `4px` a `6px` (linea 167)
- Aumentar `right` offset de `36px` a `40px` (linea 164) para dar mas espacio al menu `...`
- Aumentar tamano de botones de `22px` a `26px` (lineas 180-181 y 219-220)
- Aumentar iconos de `h-3 w-3` a `h-3.5 w-3.5` (lineas 205 y 244)

Esto da mas area clickeable y separa visualmente los botones.

---

## Cambio 2: Migrar `useUsers()` a React Query

**Archivo**: `orvit-v1/hooks/use-users.ts`

**Problema**: `useUsers()` usa `useState` + `useEffect` + `fetch()` sin cache. Cada componente que lo monta dispara un request nuevo. Se usa en:
- `TaskDetailPanel.tsx`
- `InboxView.tsx`
- `CreateTaskModal.tsx`
- `FixedTaskFormSheet.tsx`
- `CreateGroupModal.tsx`

**Solucion**: Reescribir usando `useQuery` de TanStack Query:

```ts
export function useUsers() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['company-users', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/users`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener usuarios');
      const data = await res.json();
      return data.success ? data.users : [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 min — los usuarios no cambian frecuentemente
  });

  return { users: data ?? [], loading: isLoading, error: error?.message ?? null, refetch };
}
```

**Resultado**: De 10+ requests a **1 request** (React Query deduplica queries con el mismo queryKey). Cache de 5 minutos.

**Interfaz se mantiene igual** (`users`, `loading`, `error`, `refetch`) — no hay que cambiar ningun componente consumidor.

---

## Cambio 3: URLs por vista con searchParams

**Archivos**:
- `orvit-v1/app/administracion/agenda/page.tsx` — leer `?view=` param
- `orvit-v1/components/agendav2/AgendaV2Page.tsx` — sincronizar state con URL

**Patron**: Usar `useSearchParams` (igual que el modulo `almacen/`). Esto es un cambio minimo y no requiere mover archivos.

**URLs resultantes**:
```
/administracion/agenda              → board (default)
/administracion/agenda?view=board   → Mis Tareas (Kanban)
/administracion/agenda?view=inbox   → Bandeja
/administracion/agenda?view=dashboard → Dashboard
/administracion/agenda?view=reporting → Reportes
/administracion/agenda?view=portfolio → Portfolio
/administracion/agenda?view=fixed-tasks → Tareas Fijas
```

**Implementacion en `AgendaV2Page.tsx`**:

1. Importar `useSearchParams` y `useRouter` de `next/navigation`
2. Leer param `view` del URL para inicializar el state:
   ```ts
   const searchParams = useSearchParams();
   const router = useRouter();
   const urlView = searchParams.get('view') as ViewMode | null;
   const [view, setView] = useState<ViewMode>(urlView && VIEW_LABEL[urlView] ? urlView : 'board');
   ```
3. Al cambiar de vista, actualizar la URL sin full navigation:
   ```ts
   function changeView(newView: ViewMode) {
     setView(newView);
     setSelectedGroupId(null);
     setViewAnimKey(k => k + 1);
     const params = new URLSearchParams(searchParams.toString());
     if (newView === 'board') params.delete('view');
     else params.set('view', newView);
     router.replace(`/administracion/agenda${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
   }
   ```
4. Actualizar `onViewChange` en el sidebar context (linea 319) para usar `changeView` en vez de `setView` directo
5. En `page.tsx`: Envolver en `<Suspense>` porque `useSearchParams` lo requiere en App Router

**Beneficios**:
- Deep-linking: compartir URL de una vista especifica
- Browser back/forward funciona
- Refresh mantiene la vista actual
- Cambio minimo, no rompe nada existente

---

## Orden de ejecucion

1. **useUsers → React Query** (mayor impacto en performance, 1 archivo)
2. **TaskCard spacing** (fix visual rapido, 1 archivo)
3. **URLs con searchParams** (2 archivos, requiere testing de navegacion)

## Verificacion

1. Abrir Chrome DevTools → Network: confirmar que `/api/companies/{id}/users` se llama **1 sola vez** al cargar agenda (no 10+)
2. Hover sobre task card en Kanban → confirmar que los botones tienen mas espacio
3. Navegar entre vistas y verificar que la URL cambia
4. Hacer refresh en `/administracion/agenda?view=reporting` → debe abrir Reportes directamente
5. Usar boton Back del browser → debe volver a la vista anterior
