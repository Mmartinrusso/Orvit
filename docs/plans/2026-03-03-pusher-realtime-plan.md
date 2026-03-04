# Plan: Pusher Realtime para todo ORVIT

**Fecha**: 2026-03-03
**Estado**: Propuesta

---

## Problema Actual

Hoy ORVIT usa **polling cada 5 minutos** en la mayoría de módulos. Si un usuario cambia algo, los demás no lo ven hasta que su próximo poll se ejecuta. Esto genera:

- Usuario A cierra una OT → Usuario B la sigue viendo abierta por 5 min
- Se reporta una falla crítica → no aparece en el dashboard hasta el próximo refresh
- Alguien completa una tarea → el kanban de los demás no se actualiza

**Con Pusher**: todo se actualiza en **<100ms** para todos los usuarios conectados.

---

## Cómo funciona (simple)

```
Usuario A cambia algo → Backend guarda en DB → Backend manda evento a Pusher →
Pusher lo envía a todos los conectados → Sus pantallas se actualizan solas
```

No hay que cambiar cómo funcionan las pantallas. Solo se agrega: "cuando llegue un evento, refrescá los datos".

---

## Prioridad de implementación

### Fase 1 — Más impacto, menos esfuerzo

| Módulo | Por qué | Eventos |
|--------|---------|---------|
| **Agenda/Tareas** | Todos usan el kanban. Hoy polls cada 30s-1min | task:created, task:updated, task:deleted, task:status-changed |
| **Fallas/Incidentes** | Crítico para seguridad. Hoy polls cada 5min | failure:created, failure:updated, failure:assigned |
| **Órdenes de Trabajo** | Técnicos necesitan ver asignaciones al instante | work-order:created, work-order:status-changed, work-order:assigned |

### Fase 2 — Dashboards y KPIs

| Módulo | Por qué | Eventos |
|--------|---------|---------|
| **Dashboard principal** | KPIs siempre frescos sin refrescar | dashboard:refresh (evento genérico) |
| **Alertas** | Hoy polls cada 5min, deberían ser instantáneas | alert:new |
| **Notificaciones** | Ya usa SSE, migrar a Pusher (más confiable) | notification:new |

### Fase 3 — Operaciones

| Módulo | Por qué | Eventos |
|--------|---------|---------|
| **Stock/Inventario** | Saber stock real al instante | stock:updated |
| **Compras** | Ver cuando llega un comprobante | purchase:created, purchase:approved |
| **Ventas** | Pedidos nuevos, cambios de estado | sale:created, sale:status-changed |
| **Costos** | Recálculos completados | costs:recalculated |

### Fase 4 — Presencia y colaboración

| Feature | Descripción |
|---------|-------------|
| **Online presence** | Ver quién está conectado (punto verde) |
| **Quién está viendo qué** | "Juan está editando esta OT" |
| **Typing indicators** | En el chat |

---

## Arquitectura propuesta

### Canales Pusher

```
private-company-{companyId}-tasks          → Cambios en tareas
private-company-{companyId}-failures       → Cambios en fallas
private-company-{companyId}-work-orders    → Cambios en OTs
private-company-{companyId}-dashboard      → Refresh de KPIs
private-company-{companyId}-notifications  → Alertas y notificaciones
private-company-{companyId}-stock          → Cambios de inventario

private-chat-{conversationId}              → Mensajes (ya existe)
private-inbox-{userId}                     → Inbox chat (ya existe)

presence-company-{companyId}               → Quién está online (Fase 4)
```

Cada empresa tiene sus propios canales → **aislamiento multi-tenant garantizado**.

### Cómo se integra con lo que ya existe

Hoy el flow es:
```
Mutación → API → DB → invalidateQueries (solo el que hizo el cambio)
```

Con Pusher:
```
Mutación → API → DB → Pusher.trigger() → TODOS los usuarios → invalidateQueries
```

No se reescribe nada. Solo se agrega un hook `usePusherInvalidation()` que escucha eventos y hace `invalidateQueries` automáticamente.

### Hook central (concepto)

```tsx
// lib/pusher/usePusherSync.ts
function usePusherSync(companyId: number) {
  useEffect(() => {
    const channel = pusher.subscribe(`private-company-${companyId}-tasks`);

    channel.bind('task:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-stats'] });
    });

    channel.bind('task:created', () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-tasks'] });
    });

    return () => pusher.unsubscribe(`private-company-${companyId}-tasks`);
  }, [companyId]);
}
```

Se monta UNA VEZ en el layout principal. Después todas las pantallas se actualizan solas.

---

## Costos estimados

| Escenario | Conexiones simultáneas | Mensajes/día estimados | Plan | Costo |
|-----------|----------------------|----------------------|------|-------|
| **1 empresa, <20 usuarios** | ~20 | ~5,000 | Sandbox (Free) | $0 |
| **3 empresas, ~50 usuarios** | ~50 | ~20,000 | Sandbox (Free) | $0 |
| **10 empresas, ~200 usuarios** | ~100-150 | ~100,000 | Starter | $49/mes |
| **50 empresas, ~1000 usuarios** | ~300-500 | ~500,000 | Pro | $99/mes |

**El plan gratuito alcanza hasta ~100 usuarios simultáneos.**

Cada "evento" de Pusher = 1 mensaje. Un cambio de tarea genera ~1-3 mensajes (canal task + canal dashboard). Con 50 usuarios haciendo 20 cambios/día = ~3,000 msgs/día. Muy lejos del límite de 200K.

---

## Qué se puede eliminar con Pusher

- **Polling de 5 minutos** en todos los dashboards → Se elimina, ahorrando requests al server
- **SSE de notificaciones** → Se migra a Pusher (una sola conexión en vez de dos)
- **refetchInterval** en todos los hooks → Se elimina o se sube a 30min (fallback)

Resultado: **menos carga en el servidor** y **datos siempre frescos**.

---

## Qué NO cambia

- La forma de guardar datos (Prisma, DB)
- La forma de mostrar datos (TanStack Query, componentes)
- Los permisos y auth
- El chat (ya usa Pusher)

Solo se agrega: después de cada mutación en el backend, un `pusher.trigger()` de una línea.

---

## Resumen

| Sin Pusher | Con Pusher |
|------------|-----------|
| Datos se actualizan cada 5 min | Datos se actualizan al instante |
| Cada usuario hace polling constante | El server avisa cuando hay cambios |
| Más carga en el servidor | Menos requests, más eficiente |
| Se siente "lento" | Se siente "vivo" |
| Fallas tardan 5 min en aparecer | Fallas aparecen al instante |

---

## Estado de implementación

### Completado (84 archivos, 218 triggers)

| Módulo | Archivos | Canal Pusher |
|--------|----------|-------------|
| Agenda/Tareas | 8 | private-company-{id}-tasks |
| Tareas Fijas | 5 | private-company-{id}-tasks |
| Fallas/Incidentes | 6 | private-company-{id}-failures |
| Órdenes de Trabajo | 13 | private-company-{id}-work-orders |
| Mantenimiento Preventivo | 7 | private-company-{id}-maintenance |
| Máquinas/Estaciones | 7 | private-company-{id}-machines |
| Producción | 16 | private-company-{id}-production |
| Herramientas/Pañol | 22 | private-company-{id}-tools |

### Pendiente (para más adelante — NO tocar ahora)

| Módulo | Endpoints estimados | Canal propuesto |
|--------|-------------------|-----------------|
| Ventas | ~15 | private-company-{id}-sales |
| Compras | ~15 | private-company-{id}-purchases |
| Costos | ~10 | private-company-{id}-costs |
| Nóminas/RRHH | ~15 | private-company-{id}-payroll |
| Almacén/Insumos | ~10 | private-company-{id}-stock |
| Contabilidad | ~10 | private-company-{id}-accounting |
| Usuarios/Roles | ~5 | private-company-{id}-users |
| Dashboard principal | ~3 | private-company-{id}-dashboard |
| Notificaciones (migrar SSE) | ~2 | private-company-{id}-notifications |
| Presencia online | N/A | presence-company-{id} |
