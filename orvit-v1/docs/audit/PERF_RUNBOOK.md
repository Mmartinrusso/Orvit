# Performance Runbook - Guía de Medición

**Fecha:** 2025-01-27  
**Versión:** 1.0

## Resumen

Este documento explica cómo medir performance del sistema ORVIT usando DevTools, headers X-Perf-*, y scripts automatizados.

---

## 1. Medición en DevTools (Network + Performance)

### 1.1 Network Tab - Requests HTTP

**Pasos:**
1. Abrir DevTools (F12)
2. Ir a pestaña **Network**
3. Filtrar por **XHR/Fetch**
4. Recargar página o ejecutar acción
5. Analizar cada request:

**Métricas a observar:**
- **Time (Total)**: Tiempo total del request
- **Waiting (TTFB)**: Time to First Byte (latencia del servidor)
- **Content Download**: Tiempo de descarga del payload
- **Size**: Tamaño del payload (Response)
- **Status**: Código HTTP

**Ejemplo:**
```
Request: GET /api/dashboard/metrics?companyId=1&month=2025-01
Time: 1.2s
Waiting: 800ms  ← TTFB (tiempo del servidor)
Content Download: 400ms
Size: 45KB
```

### 1.2 Performance Tab - Rendering

**Pasos:**
1. Abrir DevTools (F12)
2. Ir a pestaña **Performance**
3. Click en **Record** (círculo rojo)
4. Ejecutar acción (cargar página, cambiar tab, etc.)
5. Click en **Stop**
6. Analizar timeline:

**Métricas a observar:**
- **FCP (First Contentful Paint)**: Primer render
- **LCP (Largest Contentful Paint)**: Elemento más grande
- **Frames**: FPS (objetivo: 60fps)
- **Scripting**: Tiempo de JavaScript
- **Rendering**: Tiempo de renderizado
- **Painting**: Tiempo de pintado

**Ejemplo:**
```
FCP: 1.2s
LCP: 2.5s
FPS: 58fps (objetivo: 60fps)
Scripting: 800ms
Rendering: 200ms
```

### 1.3 React Query DevTools (Opcional)

**Pasos:**
1. Instalar React Query DevTools (si está habilitado)
2. Abrir panel de React Query
3. Verificar:
   - **Queries activas**: Cantidad de queries en ejecución
   - **Cache hits**: Queries servidas desde cache
   - **Stale queries**: Queries que necesitan refetch
   - **Duplicados**: Misma queryKey ejecutándose múltiples veces

---

## 2. Medición con Headers X-Perf-*

### 2.1 Endpoints Instrumentados

Los endpoints con `lib/perf.ts` exponen headers de performance cuando se agrega `?debug=1`:

**Headers disponibles:**
- `X-Perf-Total`: Tiempo total (ms)
- `X-Perf-Parse`: Tiempo de parse (URL params, body) (ms)
- `X-Perf-DB`: Tiempo de queries DB (ms)
- `X-Perf-Compute`: Tiempo de computación (loops, cálculos) (ms)
- `X-Perf-JSON`: Tiempo de serialización JSON (ms)
- `X-Perf-PayloadBytes`: Tamaño del payload (bytes)

### 2.2 Cómo Probar con curl

```bash
# Ejemplo: Medir /api/core/bootstrap
curl -H "Cookie: token=TU_TOKEN" \
     "http://localhost:3000/api/core/bootstrap?debug=1" \
     -v 2>&1 | grep -i "x-perf"

# Output esperado:
# < X-Perf-Total: 245.32
# < X-Perf-Parse: 2.15
# < X-Perf-DB: 180.50
# < X-Perf-Compute: 15.20
# < X-Perf-JSON: 47.47
# < X-Perf-PayloadBytes: 31245
```

### 2.3 Cómo Probar en Browser

**Opción 1: DevTools Network**
1. Abrir DevTools → Network
2. Hacer request con `?debug=1`
3. Click en el request
4. Ir a pestaña **Headers**
5. Buscar en **Response Headers** los `X-Perf-*`

**Opción 2: Console JavaScript**
```javascript
fetch('/api/core/bootstrap?debug=1', {
  credentials: 'include'
})
.then(r => {
  console.log('Total:', r.headers.get('X-Perf-Total'), 'ms');
  console.log('DB:', r.headers.get('X-Perf-DB'), 'ms');
  console.log('Compute:', r.headers.get('X-Perf-Compute'), 'ms');
  console.log('Payload:', r.headers.get('X-Perf-PayloadBytes'), 'bytes');
  return r.json();
});
```

### 2.4 Interpretación de Métricas

#### X-Perf-Total
- **< 200ms**: Excelente
- **200-500ms**: Bueno
- **500ms-1s**: Aceptable
- **> 1s**: Requiere optimización

#### X-Perf-DB
- **< 100ms**: Excelente
- **100-300ms**: Bueno
- **300ms-1s**: Aceptable
- **> 1s**: Requiere optimización (índices, queries)

#### X-Perf-Compute
- **< 50ms**: Excelente
- **50-200ms**: Bueno
- **200ms-500ms**: Aceptable
- **> 500ms**: Requiere optimización (algoritmos, loops)

#### X-Perf-JSON
- **< 50ms**: Excelente
- **50-200ms**: Bueno (payload grande)
- **> 200ms**: Requiere optimización (reducir payload)

#### X-Perf-PayloadBytes
- **< 10KB**: Pequeño
- **10-50KB**: Mediano
- **50-200KB**: Grande
- **> 200KB**: Muy grande (considerar paginación/compresión)

---

## 3. Parámetro noCache=1

### 3.1 Uso

Agregar `?noCache=1` a cualquier endpoint instrumentado desactiva el cache HTTP (si está implementado).

**Ejemplo:**
```bash
curl "http://localhost:3000/api/dashboard/metrics?companyId=1&noCache=1&debug=1"
```

**Cuándo usar:**
- Medir performance sin cache (worst case)
- Forzar recálculo en desarrollo
- Debugging de datos stale

---

## 4. Script Automatizado: perf-scan.mjs

### 4.1 Ejecución

```bash
cd project
node scripts/perf-scan.mjs
```

### 4.2 Qué Hace

1. Recorre lista de endpoints "top"
2. Ejecuta 5 runs con `?debug=1&noCache=1`
3. Calcula mediana de cada métrica
4. Guarda resultados en `docs/audit/PERF_BASELINE.json`
5. Imprime ranking por:
   - `X-Perf-Total` (más lento primero)
   - `X-Perf-Compute` (más compute primero)
   - `X-Perf-PayloadBytes` (más grande primero)

### 4.3 Output Esperado

```
=== Performance Scan Results ===

Top 10 Endpoints by Total Time:
1. /api/calculadora-costos-final: 8234ms (DB: 5123ms, Compute: 2891ms, Payload: 456KB)
2. /api/maintenance/dashboard: 2156ms (DB: 1234ms, Compute: 567ms, Payload: 145KB)
3. /api/dashboard/metrics: 1234ms (DB: 789ms, Compute: 234ms, Payload: 45KB)
...

Top 10 Endpoints by Compute Time:
1. /api/calculadora-costos-final: 2891ms
2. /api/maintenance/dashboard: 567ms
...

Top 10 Endpoints by Payload Size:
1. /api/calculadora-costos-final: 456KB
2. /api/maintenance/dashboard: 145KB
...

Results saved to: docs/audit/PERF_BASELINE.json
```

### 4.4 Formato de PERF_BASELINE.json

```json
{
  "timestamp": "2025-01-27T10:30:00Z",
  "endpoints": [
    {
      "path": "/api/calculadora-costos-final",
      "params": { "companyId": "1", "productionMonth": "2025-01" },
      "runs": 5,
      "median": {
        "total": 8234,
        "parse": 12,
        "db": 5123,
        "compute": 2891,
        "json": 208,
        "payloadBytes": 467456
      },
      "p95": { "total": 9123, "db": 5678, "compute": 3123 },
      "p99": { "total": 10234, "db": 6234, "compute": 3456 }
    }
  ]
}
```

---

## 5. Checklist de Medición

### 5.1 Antes de Optimizar
- [ ] Ejecutar `perf-scan.mjs` para baseline
- [ ] Revisar DevTools Network para requests duplicados
- [ ] Revisar React Query DevTools para cache hits
- [ ] Medir LCP/FCP en Performance tab
- [ ] Documentar métricas en `PERF_BASELINE.json`

### 5.2 Después de Optimizar
- [ ] Ejecutar `perf-scan.mjs` nuevamente
- [ ] Comparar métricas antes/después
- [ ] Verificar que no hay regresiones
- [ ] Documentar mejoras en `RESULTS.md`
- [ ] Verificar que funcionalidad sigue igual

---

## 6. Troubleshooting

### 6.1 Headers X-Perf-* No Aparecen

**Causas posibles:**
- Endpoint no está instrumentado con `lib/perf.ts`
- Falta `?debug=1` en la URL
- Error en el endpoint (no llega a `withPerfHeaders`)

**Solución:**
- Verificar que endpoint usa `startPerf()`, `endJson()`, `withPerfHeaders()`
- Agregar `?debug=1` a la URL
- Revisar logs del servidor para errores

### 6.2 Métricas Inconsistentes

**Causas posibles:**
- Cache HTTP activo (usar `?noCache=1`)
- Variabilidad en DB (diferentes datos)
- Carga del servidor

**Solución:**
- Usar `?noCache=1` para mediciones consistentes
- Ejecutar múltiples runs y usar mediana
- Medir en ambiente estable (no durante picos)

### 6.3 Script perf-scan.mjs Falla

**Causas posibles:**
- Servidor no está corriendo
- Token de autenticación inválido
- Endpoint no existe o cambió

**Solución:**
- Verificar que servidor está en `http://localhost:3000`
- Verificar token en `.env` o config del script
- Revisar lista de endpoints en el script

---

## 7. Referencias

- [Chrome DevTools Network](https://developer.chrome.com/docs/devtools/network/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [React Query DevTools](https://tanstack.com/query/latest/docs/react/devtools)
- [Web Vitals](https://web.dev/vitals/)

