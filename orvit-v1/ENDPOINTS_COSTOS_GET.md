# Endpoints GET - Costos

## Base URL
```
http://localhost:3000/api
```
(Ajustar según tu entorno)

---

## 1. Calculadora de Costos Final
**Endpoint:** `GET /api/calculadora-costos-final`

**Parámetros:**
- `companyId` (requerido) - ID de la empresa
- `productionMonth` (opcional) - Mes de producción en formato YYYY-MM (default: '2025-08')
- `distributionMethod` (opcional) - Método de distribución: 'sales' o 'production' (default: 'sales')

**Ejemplo:**
```
GET /api/calculadora-costos-final?companyId=3&productionMonth=2025-08&distributionMethod=sales
```

---

## 2. Estadísticas de Costos
**Endpoint:** `GET /api/costos/stats`

**Parámetros:**
- `companyId` (requerido) - ID de la empresa

**Ejemplo:**
```
GET /api/costos/stats?companyId=3
```

**Respuesta incluye:**
- Total empleados
- Total categorías
- Promedio salario
- Total general
- Empleados nuevos
- Distribución por categoría
- Distribución por empleado
- Categoría más costosa
- Empleado más costoso

---

## 3. Historial de Costos
**Endpoint:** `GET /api/costos/historial`

**Parámetros:**
- `companyId` (requerido) - ID de la empresa
- `employeeId` (opcional) - ID del empleado para filtrar

**Ejemplo:**
```
GET /api/costos/historial?companyId=3
GET /api/costos/historial?companyId=3&employeeId=123
```

---

## 4. Empleados
**Endpoint:** `GET /api/costos/empleados`

**Parámetros:**
- `companyId` (requerido) - ID de la empresa

**Ejemplo:**
```
GET /api/costos/empleados?companyId=3
```

**Respuesta incluye:**
- Lista de empleados activos
- Salario bruto y cargas sociales
- Categoría del empleado
- Costo total

---

## 5. Empleado por ID
**Endpoint:** `GET /api/costos/empleados/[id]`

**Parámetros de ruta:**
- `id` (requerido) - ID del empleado

**Query params:**
- `companyId` (requerido) - ID de la empresa

**Ejemplo:**
```
GET /api/costos/empleados/123?companyId=3
```

---

## 6. Historial de Empleado
**Endpoint:** `GET /api/costos/empleados/[id]/historial`

**Parámetros de ruta:**
- `id` (requerido) - ID del empleado

**Query params:**
- `companyId` (requerido) - ID de la empresa

**Ejemplo:**
```
GET /api/costos/empleados/123/historial?companyId=3
```

---

## 7. Categorías de Empleados
**Endpoint:** `GET /api/costos/categorias`

**Parámetros:**
- `companyId` (requerido) - ID de la empresa

**Ejemplo:**
```
GET /api/costos/categorias?companyId=3
```

**Respuesta incluye:**
- Lista de categorías activas
- Conteo de empleados por categoría

---

## 8. Categoría por ID
**Endpoint:** `GET /api/costos/categorias/[id]`

**Parámetros de ruta:**
- `id` (requerido) - ID de la categoría

**Nota:** Este endpoint solo tiene PUT y DELETE, no tiene GET. Usar el endpoint de categorías general.

---

## 9. Costos Indirectos
**Endpoint:** `GET /api/costos-indirectos/costos`

**Parámetros:**
- `companyId` (requerido) - ID de la empresa
- `month` (opcional) - Mes en formato YYYY-MM para filtrar

**Ejemplo:**
```
GET /api/costos-indirectos/costos?companyId=3
GET /api/costos-indirectos/costos?companyId=3&month=2025-08
```

---

## 10. Test de Costos
**Endpoint:** `GET /api/test-costs`

**Parámetros:**
- `companyId` (requerido) - ID de la empresa
- `productionMonth` (requerido) - Mes de producción en formato YYYY-MM

**Ejemplo:**
```
GET /api/test-costs?companyId=3&productionMonth=2025-08
```

**Respuesta incluye:**
- Conteo de costos indirectos
- Total de costos
- Datos de costos

---

## 11. Diagnóstico de Costos
**Endpoint:** `GET /api/diagnostico-costos`

**Parámetros:**
- `companyId` (opcional) - ID de la empresa (default: '1')

**Ejemplo:**
```
GET /api/diagnostico-costos?companyId=3
```

**Respuesta incluye:**
- Muestra de productos, recetas, insumos, precios
- Muestra de items de recetas
- Muestra de costos indirectos
- Muestra de distribución de costos
- Muestra de empleados y salarios
- Conteos totales de cada entidad

---

## 12. Calculadora de Precios
**Endpoint:** `GET /api/calculadora-precios`

**Parámetros:**
- `companyId` (requerido) - ID de la empresa
- `productionMonth` (opcional) - Mes de producción en formato YYYY-MM

**Ejemplo:**
```
GET /api/calculadora-precios?companyId=3&productionMonth=2025-08
```

---

## 13. Calculadora de Costos por Producción
**Endpoint:** `GET /api/calculadora-costos-produccion`

**Parámetros:**
- `companyId` (requerido) - ID de la empresa
- `productionMonth` (opcional) - Mes de producción en formato YYYY-MM (default: '2025-08')

**Ejemplo:**
```
GET /api/calculadora-costos-produccion?companyId=3&productionMonth=2025-08
```

---

## Resumen de Parámetros Comunes

### Parámetros más usados:
- `companyId` - **Requerido en la mayoría** - ID numérico de la empresa
- `productionMonth` - Formato: `YYYY-MM` (ej: `2025-08`)
- `distributionMethod` - Valores: `'sales'` o `'production'`
- `employeeId` - ID del empleado (string o número)
- `month` - Formato: `YYYY-MM`

### Ejemplos de valores:
- `companyId`: `3`
- `productionMonth`: `2025-08`
- `distributionMethod`: `sales` o `production`

---

## Notas Importantes

1. **Todos los endpoints requieren `companyId`** excepto algunos de diagnóstico
2. **Formato de fecha:** Siempre usar `YYYY-MM` para meses
3. **IDs:** Pueden ser números o strings según el endpoint
4. **Cache:** Algunos endpoints tienen cache de 60-120 segundos
5. **Errores:** Todos retornan JSON con formato `{ error: "mensaje" }`

---

## Colección Postman Recomendada

Organiza los endpoints en carpetas:
- **Calculadoras** (calculadora-costos-final, calculadora-precios, calculadora-costos-produccion)
- **Estadísticas** (costos/stats)
- **Empleados** (costos/empleados, costos/empleados/[id])
- **Categorías** (costos/categorias)
- **Costos Indirectos** (costos-indirectos/costos)
- **Diagnóstico** (diagnostico-costos, test-costs)
- **Historial** (costos/historial, costos/empleados/[id]/historial)

