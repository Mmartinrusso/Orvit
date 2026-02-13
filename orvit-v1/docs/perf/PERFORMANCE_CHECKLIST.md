# ✅ Checklist de Verificación de Performance

Este checklist te ayuda a verificar que las optimizaciones de performance están funcionando correctamente.

---

## 🔍 PARTE 1: Verificar Requests Duplicados Eliminados

### Paso 1: Abrir DevTools
1. Abre tu aplicación Next.js (`npm run dev` o `npm run start`)
2. Abre Chrome DevTools (F12)
3. Ve a la pestaña **Network**

### Paso 2: Filtrar Endpoints Críticos
En el filtro de Network, escribe:
```
calculadora-costos-final|categorias|historial|price-comparisons
```

### Paso 3: Navegar a la Página de Costos
1. Navega a: `/administracion/costos/calculadora`
2. Observa la pestaña Network

### ✅ Resultado Esperado:
- **1 request** por combinación única de parámetros
- Por ejemplo:
  - `calculadora-costos-final?distributionMethod=sales&productionMonth=2025-08` → **1 request**
  - `calculadora-costos-final?distributionMethod=production&productionMonth=2025-08` → **1 request** (solo si el tab está activo)

### ❌ Si ves duplicados:
- Revisa si hay múltiples componentes renderizando al mismo tiempo
- Verifica que todos los componentes usan React Query hooks (no fetch directo)
- Busca en el código: `grep -r "fetch.*calculadora-costos-final" project/`

---

## 📊 PARTE 2: Verificar Headers de Performance

### Paso 1: Agregar Parámetros de Debug
Añade `?debug=1&noCache=1` a la URL del endpoint:

**Ejemplos:**
```
http://localhost:3000/api/calculadora-costos-final?companyId=3&productionMonth=2025-08&distributionMethod=sales&debug=1&noCache=1
```

```
http://localhost:3000/api/costos/categorias?companyId=3&debug=1&noCache=1
```

### Paso 2: Verificar Response Headers
1. En DevTools → Network, haz clic en el request
2. Ve a la pestaña **Headers**
3. Scroll hasta **Response Headers**

### ✅ Headers Esperados:
```
X-Perf-Total: 1245.67
X-Perf-Parse: 2.34
X-Perf-DB: 892.45
X-Perf-Compute: 287.12
X-Perf-JSON: 63.76
X-Perf-PayloadBytes: 204800
```

### 📈 Interpretación de Métricas:

#### Si `X-Perf-Total` es alto (> 2000ms):
1. **Si `X-Perf-DB` es alto (> 500ms):**
   - Ejecuta EXPLAIN ANALYZE en la query específica usando MCP
   - Verifica índices: `SELECT * FROM pg_indexes WHERE tablename = 'monthly_sales';`
   - Considera agregar índices o optimizar queries

2. **Si `X-Perf-Compute` es alto (> 1000ms):**
   - Revisa loops y transformaciones en el endpoint
   - Considera memoización o caché de cálculos pesados
   - Revisa si hay cálculos redundantes

3. **Si `X-Perf-JSON` es alto (> 200ms):**
   - El payload es muy grande (> 500 KB)
   - Considera paginación o reducir datos retornados
   - Verifica que no estés serializando datos innecesarios

4. **Si `X-Perf-Parse` es alto (> 50ms):**
   - Revisa validación de parámetros URL
   - Optimiza parsing de searchParams

---

## 🧪 PARTE 3: Usar Script de Medición

### Paso 1: Ejecutar Script
```bash
cd project
node scripts/measure-endpoint.js /api/calculadora-costos-final 3 2025-08
```

### Paso 2: Interpretar Resultados

El script ejecuta 2 escenarios:

#### Escenario A: `debug=1&noCache=1` (5 runs)
- Muestra mediana de tiempos
- Headers X-Perf-* completos
- Útil para medir performance real sin cache

#### Escenario B: `debug=1` (2 runs)
- Compara tiempos con cache
- Muestra si hay HIT/MISS de cache
- Útil para validar que el cache funciona

### ✅ Resultado Esperado:
- **Escenario A:** Tiempos consistentes (variación < 20%)
- **Escenario B:** Tiempos menores si hay cache (o similares si es primer request)

---

## 🗄️ PARTE 4: Diagnóstico con MCP Postgres

### Paso 1: Verificar Conexión
Ejecuta en MCP:
```sql
SELECT current_database(), current_user, version();
```

### Paso 2: Verificar Índices
```sql
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE schemaname='public' 
  AND tablename IN ('monthly_sales', 'monthly_production') 
ORDER BY tablename, indexname;
```

### Paso 3: EXPLAIN de Query Específica
Si `X-Perf-DB` es alto, ejecuta:
```sql
EXPLAIN (ANALYZE, BUFFERS) 
SELECT product_id, quantity_sold 
FROM monthly_sales 
WHERE company_id = 3 AND fecha_imputacion = '2025-08';
```

### ✅ Resultado Esperado:
- Índices presentes en tablas críticas
- EXPLAIN muestra uso de índices (Index Scan o Bitmap Index Scan)
- Si muestra Seq Scan, puede ser normal para tablas < 100 filas

---

## 🔧 PARTE 5: Verificar React Query Configuración

### Paso 1: Verificar QueryClientProvider
Buscar en el código:
```bash
grep -r "QueryClientProvider" project/app
```

### ✅ Resultado Esperado:
- **1 solo QueryClientProvider** en `app/layout.tsx`
- No hay múltiples providers anidados

### Paso 2: Verificar QueryKeys Estables
En los hooks de React Query, verifica que:
- `companyId` siempre se normaliza a `Number(companyId)`
- No hay objetos/arrays no estables en queryKey
- QueryKey helpers están exportados

**Ejemplo correcto:**
```typescript
export function calculadoraCostosFinalKey(
  companyId: number | string | undefined,
  productionMonth?: string,
  distributionMethod: 'sales' | 'production' = 'production'
): (string | number)[] {
  const normalizedCompanyId = companyId ? Number(companyId) : 0;
  const normalizedMonth = productionMonth || '';
  return ['calculadora-costos-final', normalizedCompanyId, normalizedMonth, distributionMethod];
}
```

---

## 📝 PARTE 6: Validación Final

### Checklist Completo:
- [ ] ✅ No hay requests duplicados en Network tab
- [ ] ✅ Headers X-Perf-* aparecen con `?debug=1`
- [ ] ✅ Script de medición funciona correctamente
- [ ] ✅ MCP Postgres conecta y ejecuta queries
- [ ] ✅ Solo 1 QueryClientProvider en la app
- [ ] ✅ QueryKeys son estables y normalizados
- [ ] ✅ Cache funciona (segundo request más rápido o similar)

---

## 🆘 Troubleshooting

### Problema: Requests duplicados persisten

**Soluciones:**
1. Buscar fetch directo: `grep -r "fetch.*calculadora-costos-final" project/`
2. Verificar que todos usen React Query hooks
3. Verificar que `enabled` condition es correcta
4. Verificar que no hay múltiples QueryClientProvider

### Problema: Headers X-Perf-* no aparecen

**Soluciones:**
1. Verificar que agregaste `?debug=1` a la URL
2. Verificar que el endpoint está instrumentado con `withPerfHeaders()`
3. Verificar `lib/perf.ts` existe y está correctamente implementado

### Problema: X-Perf-DB es alto

**Soluciones:**
1. Ejecutar EXPLAIN ANALYZE en la query específica
2. Verificar índices con MCP: `SELECT * FROM pg_indexes WHERE tablename = 'monthly_sales';`
3. Considerar agregar índices compuestos si faltan
4. Verificar que las queries usan los índices correctos

### Problema: Cache no funciona

**Soluciones:**
1. Verificar `staleTime` en hooks React Query
2. Verificar que no hay `refetchOnWindowFocus: true`
3. Verificar que `noCache=1` no está siempre presente
4. Verificar `Cache-Control` headers en respuesta

---

**Última actualización:** 2025-12-15

