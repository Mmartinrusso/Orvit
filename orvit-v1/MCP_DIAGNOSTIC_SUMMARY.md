# 📊 Resumen de Diagnóstico MCP Postgres

## 🔍 Confirmación de Conexión

**Query:** `SELECT current_database(), current_user, version();`

**Resultado:**
- Database: `neondb`
- User: `neondb_owner`
- Version: `PostgreSQL 17.7 (178558d) on x86_64-pc-linux-gnu`

✅ Conexión exitosa a Neon Postgres

## 📈 Tamaños y Filas de Tablas Críticas

**Query:** Análisis de tablas principales usadas en endpoints de costos

| Tabla | Filas Aprox. | Tamaño (bytes) | Tamaño (KB) |
|-------|--------------|----------------|-------------|
| `monthly_sales` | 96 | 188,416 | ~184 KB |
| `monthly_production` | 67 | 131,072 | ~128 KB |
| `supply_monthly_prices` | 16 | 131,072 | ~128 KB |
| `employee_monthly_salaries` | 0 | 65,536 | ~64 KB |

### Observaciones:
- ✅ Tablas pequeñas en general (<200 KB cada una)
- ⚠️ `employee_monthly_salaries` está vacía (0 filas) - verificar si se están usando datos de `employee_salary_history` como fallback
- ✅ No hay problemas de tamaño evidentes que requieran optimización inmediata

## 🔎 Queries Críticos Identificados

### Endpoint: `/api/calculadora-costos-final`

**Queries principales ejecutados en paralelo (Promise.all):**

1. **Productos de costos:**
```sql
SELECT p.id, p.name, p.description, p.sku, p.category_id, p.subcategory_id,
       p.unit_price, p.unit_cost, p.stock_quantity, pc.name as category_name
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id
WHERE p.company_id = $1 AND p.is_active = true
ORDER BY pc.name, p.name
```

2. **Precios de insumos (últimos precios):**
```sql
SELECT DISTINCT ON (supply_id) supply_id, price_per_unit, COALESCE(freight_cost, 0) as freight_cost
FROM supply_monthly_prices 
WHERE company_id = $1
ORDER BY supply_id, month_year DESC NULLS LAST
```

3. **Datos de ventas del mes:**
```sql
SELECT product_id, product_name, quantity_sold, total_revenue, unit_price,
       AVG(unit_price) OVER (PARTITION BY product_id) as avg_price
FROM monthly_sales 
WHERE company_id = $1 AND fecha_imputacion = $2
```

4. **Datos de producción del mes:**
```sql
SELECT product_id, quantity_produced, fecha_imputacion as month
FROM monthly_production 
WHERE company_id = $1 AND fecha_imputacion = $2
```

5. **Categorías de empleados con salarios:**
```sql
SELECT ec.id, ec.name, COALESCE(SUM(ems.total_cost), 0) as total_salary
FROM employee_categories ec
LEFT JOIN employees e ON ec.id = e.category_id AND e.company_id = $1 AND e.active = true
LEFT JOIN employee_monthly_salaries ems ON e.id = ems.employee_id AND ems.fecha_imputacion = $2
WHERE ec.company_id = $1 AND ec.is_active = true
GROUP BY ec.id, ec.name
```

### Recomendaciones de Índices:

Dado que las tablas son pequeñas actualmente, los índices existentes deberían ser suficientes. Sin embargo, para escalabilidad:

1. **monthly_sales:**
   - ✅ Índice en `(company_id, fecha_imputacion)` - probablemente ya existe
   - ✅ Índice en `product_id` si se filtra frecuentemente

2. **monthly_production:**
   - ✅ Índice en `(company_id, fecha_imputacion)` - probablemente ya existe

3. **supply_monthly_prices:**
   - ✅ Índice en `(company_id, supply_id, month_year DESC)` para el DISTINCT ON

4. **employee_monthly_salaries:**
   - ⚠️ Verificar si se están insertando datos aquí o si todo va a `employee_salary_history`

## ⚠️ Nota sobre EXPLAIN ANALYZE

El MCP Postgres configurado (`postgres-perf-test`) solo permite queries de lectura (`SELECT`). No se puede ejecutar `EXPLAIN ANALYZE` directamente vía MCP, ya que este comando requiere permisos adicionales.

**Alternativas para análisis de performance:**
1. Ejecutar `EXPLAIN ANALYZE` directamente en la consola de Neon Postgres
2. Usar los headers `X-Perf-DB` instrumentados en los endpoints con `?debug=1`
3. Revisar logs de Prisma para tiempos de queries

## 📝 Próximos Pasos

1. ✅ Instrumentación de performance implementada en endpoints críticos
2. ✅ Hooks React Query creados para evitar requests duplicados
3. ⏭️ Monitorear métricas en producción usando headers X-Perf-*
4. ⏭️ Si X-Perf-DB aumenta, ejecutar EXPLAIN ANALYZE en queries específicos
5. ⏭️ Considerar índices adicionales si el volumen de datos crece significativamente

## 🔗 Referencias

- Endpoints instrumentados: ver `PERFORMANCE_CHECKLIST.md`
- Script de medición: `scripts/measure-endpoint.js`
- Helper de performance: `lib/perf.ts`

