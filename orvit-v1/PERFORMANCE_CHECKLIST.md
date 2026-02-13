# ✅ Checklist de Verificación de Performance

Este documento describe cómo verificar y optimizar el performance de los endpoints instrumentados.

## 🔍 Verificación en DevTools (Network Tab)

### Paso 1: Abrir DevTools
1. Abre Chrome/Firefox DevTools (F12)
2. Ve a la pestaña **Network**
3. Filtra por tipo `Fetch/XHR` o usa el filtro de búsqueda

### Paso 2: Verificar Requests Únicos
Para cada combinación de parámetros, debería haber **solo 1 request** durante la sesión:
- Misma URL = mismo request (React Query cachea)
- Cambio de parámetros = nuevo request (pero cachea el anterior)

**Qué buscar:**
- ✅ Mismo endpoint con mismos params aparece una sola vez
- ❌ Múltiples requests idénticos = problema de duplicación

### Paso 3: Verificar Headers X-Perf-*
1. Haz clic en un request
2. Ve a la pestaña **Headers**
3. Busca headers `Response Headers` con prefijo `X-Perf-*`

Solo aparecen si agregaste `?debug=1` a la URL.

**Headers disponibles:**
- `X-Perf-Total`: Tiempo total del request (ms)
- `X-Perf-Parse`: Tiempo parseando URL params (ms)
- `X-Perf-DB`: Tiempo en queries de base de datos (ms)
- `X-Perf-Compute`: Tiempo en transformaciones/cálculos (ms)
- `X-Perf-JSON`: Tiempo serializando JSON (ms)
- `X-Perf-PayloadBytes`: Tamaño del payload en bytes

## 📊 URLs de Ejemplo con debug=1

Reemplaza `<companyId>` y `<productionMonth>` con valores reales:

### 1. Categorías de Costos
```
http://localhost:3000/api/costos/categorias?companyId=<companyId>&debug=1
```

### 2. Calculadora de Costos Final
```
http://localhost:3000/api/calculadora-costos-final?companyId=<companyId>&productionMonth=<productionMonth>&distributionMethod=production&debug=1
```

### 3. Historial de Costos
```
http://localhost:3000/api/costos/historial?companyId=<companyId>&debug=1
```

### 4. Comparaciones de Precios
```
http://localhost:3000/api/price-comparisons?companyId=<companyId>&debug=1
```

## 🎯 Interpretación de Métricas

### Caso: X-Perf-DB bajo pero X-Perf-Total alto

Si `X-Perf-DB` es bajo (<100ms) pero `X-Perf-Total` es alto (>1000ms), revisa:

1. **X-Perf-Compute** (alto):
   - Problema: Transformaciones/loops pesados
   - Solución: Optimizar algoritmos, usar mapas en lugar de loops anidados, memoizar cálculos repetidos

2. **X-Perf-JSON** (alto):
   - Problema: Serialización de objetos grandes
   - Solución: Reducir tamaño de payload, usar proyecciones en queries, paginación

3. **X-Perf-Parse** (alto):
   - Problema: Parsing complejo de params/body
   - Solución: Simplificar estructura de datos, validar temprano

4. **Frontend/Network** (diferencia entre X-Perf-Total y tiempo en DevTools):
   - Problema: Latencia de red, procesamiento en cliente
   - Solución: Comprimir respuestas (gzip), reducir tamaño de payload, CDN

## 🛠️ Script de Medición

Usa el script `scripts/measure-endpoint.js` para mediciones automatizadas:

```bash
# Categorías
node scripts/measure-endpoint.js /api/costos/categorias 1

# Calculadora (con mes)
node scripts/measure-endpoint.js /api/calculadora-costos-final 1 2025-08

# Historial
node scripts/measure-endpoint.js /api/costos/historial 1

# Comparaciones de precios
node scripts/measure-endpoint.js /api/price-comparisons 1
```

El script ejecuta:
- **Escenario A**: 5 runs con `debug=1&noCache=1` (mediana de resultados)
- **Escenario B**: 2 runs con `debug=1` (para verificar cache)

## 📋 Checklist de Optimización

### Endpoints API
- [ ] Headers X-Perf-* aparecen cuando `?debug=1`
- [ ] Cache-Control se respeta según `?noCache=1`
- [ ] Métricas son razonables (DB < 500ms, Total < 2000ms para endpoints pesados)

### Frontend (React Query)
- [ ] Un solo request por combinación de parámetros (ver Network tab)
- [ ] Query keys normalizan `companyId` a Number
- [ ] `staleTime` configurado apropiadamente (5 min estándar, 1 min para calculadora)
- [ ] `refetchOnWindowFocus: false` activado
- [ ] `networkMode: 'always'` configurado

### Base de Datos
- [ ] Queries usan índices apropiados
- [ ] Sin N+1 queries (usar `include` o joins cuando sea necesario)
- [ ] Tamaño de tablas razonable (verificar con MCP Postgres)

## 🔧 Troubleshooting

### Problema: Requests duplicados
**Causa:** Múltiples componentes llaman el mismo hook con mismo params
**Solución:** React Query debería deduplicar automáticamente. Si no, verificar:
- Query keys son idénticos (mismo orden, mismos valores)
- No hay múltiples QueryClient instances

### Problema: Cache no funciona
**Causa:** `noCache=1` siempre activado o headers incorrectos
**Solución:** Verificar que `shouldDisableCache()` funciona correctamente

### Problema: X-Perf-* no aparecen
**Causa:** Falta `?debug=1` en URL
**Solución:** Agregar `&debug=1` al final de la URL

### Problema: Métricas inconsistentes
**Causa:** Carga variable de servidor/DB
**Solución:** Ejecutar múltiples runs y usar mediana (script lo hace automáticamente)

## 📝 Notas Adicionales

- Los tiempos están en **milisegundos** (ms)
- `X-Perf-Total` debería ser aproximadamente la suma de Parse + DB + Compute + JSON (con overhead mínimo)
- Si hay mucha diferencia, puede haber trabajo no instrumentado en el endpoint
- Para endpoints muy pesados (>5s), considerar:
  - Paginación
  - Background jobs
  - Caché más agresivo
  - Optimización de queries DB

