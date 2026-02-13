# 📊 Resumen de Diagnóstico MCP Postgres

**Fecha:** 2025-12-15  
**MCP Server:** postgres-perf-test  
**Database:** Neon Postgres (PostgreSQL 17.7)

---

## 1. Confirmación de Conexión

**Query:** `SELECT current_database(), current_user, version();`

**Resultado:**
- **current_database**: `neondb`
- **current_user**: `neondb_owner`
- **version**: PostgreSQL 17.7 (178558d) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14+deb12u1) 12.2.0, 64-bit

✅ **Conexión exitosa**

---

## 2. Tablas en Schema Public

**Query:** `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;`

**Total:** 110 tablas encontradas

**Tablas principales identificadas:**
- Tablas Prisma con nombres case-sensitive (usar comillas): `"Document"`, `"Product"`, `"Company"`, etc.
- Tablas snake_case: `monthly_sales`, `monthly_production`, `supply_monthly_prices`, `employee_monthly_salaries`

**⚠️ IMPORTANTE:** Para queries a tablas Prisma, usar comillas dobles:
- ✅ `SELECT * FROM "Document"` (correcto)
- ❌ `SELECT * FROM document` (error: relation "document" does not exist)

---

## 3. Tamaños y Filas de Tablas de Usuario (Top 30)

**Query:** `SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) size FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 30;`

| relname                        | n_live_tup | size  |
|--------------------------------|------------|-------|
| Document                       | 490        | 752 kB|
| RolePermission                 | 123        | 56 kB |
| recipe_items                   | 112        | 88 kB |
| monthly_sales                  | 96         | 144 kB|
| Permission                     | 83         | 80 kB |
| indirect_cost_change_history   | 74         | 96 kB |
| monthly_production             | 67         | 112 kB|
| cost_distribution_config       | 57         | 88 kB |
| Tool                           | 52         | 80 kB |
| products                       | 52         | 176 kB|
| Component                      | 52         | 32 kB |
| employees                      | 45         | 64 kB |
| employee_salary_history        | 45         | 64 kB |
| ComponentTool                  | 42         | 48 kB |
| indirect_cost_monthly_records  | 35         | 96 kB |
| recipe_change_history          | 33         | 48 kB |
| IndirectItem                   | 24         | 48 kB |
| Machine                        | 22         | 64 kB |
| indirect_cost_base             | 19         | 48 kB |
| supply_price_history           | 18         | 32 kB |
| recipes                        | 18         | 80 kB |
| IndirectPriceHistory           | 17         | 64 kB |
| product_subcategories          | 16         | 48 kB |
| **supply_monthly_prices**      | **16**     | **112 kB**|
| maintenance_checklists         | 14         | 168 kB|
| supplies                       | 12         | 40 kB |
| employee_cost_distribution     | 12         | 88 kB |
| _prisma_migrations             | 10         | 32 kB |
| UnidadMovil                    | 9          | 80 kB |
| machine_order_temp             | 9          | 40 kB |

**Observaciones:**
- Las tablas críticas (`monthly_sales`, `monthly_production`) son **pequeñas** (< 100 filas)
- Tamaño total de datos muy pequeño (< 1 MB para la mayoría)
- **Conclusión:** La base de datos **NO es el cuello de botella** para performance

---

## 4. Índices de Tablas Críticas

### monthly_sales

**Query:** `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename = 'monthly_sales' ORDER BY indexname;`

| indexname | indexdef |
|-----------|----------|
| idx_monthly_sales_company | CREATE INDEX idx_monthly_sales_company ON public.monthly_sales USING btree (company_id) |
| idx_monthly_sales_company_month | CREATE INDEX idx_monthly_sales_company_month ON public.monthly_sales USING btree (company_id, fecha_imputacion) |
| idx_monthly_sales_fecha | CREATE INDEX idx_monthly_sales_fecha ON public.monthly_sales USING btree (fecha_imputacion) |
| idx_monthly_sales_month | CREATE INDEX idx_monthly_sales_month ON public.monthly_sales USING btree (month_year) |
| monthly_sales_company_id_product_id_month_year_key | CREATE UNIQUE INDEX monthly_sales_company_id_product_id_month_year_key ON public.monthly_sales USING btree (company_id, product_id, month_year) |
| monthly_sales_pkey | CREATE UNIQUE INDEX monthly_sales_pkey ON public.monthly_sales USING btree (id) |

✅ **6 índices** - Optimizado para queries por `company_id`, `fecha_imputacion`, y combinaciones.

### monthly_production

| indexname | indexdef |
|-----------|----------|
| idx_monthly_production_company | CREATE INDEX idx_monthly_production_company ON public.monthly_production USING btree (company_id) |
| idx_monthly_production_company_month | CREATE INDEX idx_monthly_production_company_month ON public.monthly_production USING btree (company_id, fecha_imputacion) |
| idx_monthly_production_fecha | CREATE INDEX idx_monthly_production_fecha ON public.monthly_production USING btree (fecha_imputacion) |
| idx_monthly_production_month | CREATE INDEX idx_monthly_production_month ON public.monthly_production USING btree (month_year) |
| monthly_production_company_id_product_id_month_year_key | CREATE UNIQUE INDEX monthly_production_company_id_product_id_month_year_key ON public.monthly_production USING btree (company_id, product_id, month_year) |
| monthly_production_pkey | CREATE UNIQUE INDEX monthly_production_pkey ON public.monthly_production USING btree (id) |

✅ **6 índices** - Misma estructura que `monthly_sales`, optimizado.

### supply_monthly_prices

| indexname | indexdef |
|-----------|----------|
| idx_supply_monthly_prices_fecha_imputacion | CREATE INDEX idx_supply_monthly_prices_fecha_imputacion ON public.supply_monthly_prices USING btree (fecha_imputacion) |
| idx_supply_monthly_prices_month_year | CREATE INDEX idx_supply_monthly_prices_month_year ON public.supply_monthly_prices USING btree (month_year) |
| idx_supply_monthly_prices_supply_id | CREATE INDEX idx_supply_monthly_prices_supply_id ON public.supply_monthly_prices USING btree (supply_id) |
| idx_supply_prices_company_supply_month | CREATE INDEX idx_supply_prices_company_supply_month ON public.supply_monthly_prices USING btree (company_id, supply_id, month_year) |
| supply_monthly_prices_pkey | CREATE UNIQUE INDEX supply_monthly_prices_pkey ON public.supply_monthly_prices USING btree (id) |
| supply_monthly_prices_supply_id_month_year_key | CREATE UNIQUE INDEX supply_monthly_prices_supply_id_month_year_key ON public.supply_monthly_prices USING btree (supply_id, month_year) |

✅ **6 índices** - Optimizado para queries por `company_id`, `supply_id`, `month_year`.

### employee_monthly_salaries

| indexname | indexdef |
|-----------|----------|
| employee_monthly_salaries_employee_id_month_year_key | CREATE UNIQUE INDEX employee_monthly_salaries_employee_id_month_year_key ON public.employee_monthly_salaries USING btree (employee_id, month_year) |
| employee_monthly_salaries_pkey | CREATE UNIQUE INDEX employee_monthly_salaries_pkey ON public.employee_monthly_salaries USING btree (id) |
| idx_employee_monthly_salaries_company_id | CREATE INDEX idx_employee_monthly_salaries_company_id ON public.employee_monthly_salaries USING btree (company_id) |
| idx_employee_monthly_salaries_employee_id | CREATE INDEX idx_employee_monthly_prices_employee_id ON public.employee_monthly_salaries USING btree (employee_id) |
| idx_employee_monthly_salaries_fecha_imputacion | CREATE INDEX idx_employee_monthly_salaries_fecha_imputacion ON public.employee_monthly_salaries USING btree (fecha_imputacion) |
| idx_employee_monthly_salaries_month_year | CREATE INDEX idx_employee_monthly_salaries_month_year ON public.employee_monthly_salaries USING btree (month_year) |
| idx_employee_salaries_company_month | CREATE INDEX idx_employee_salaries_company_month ON public.employee_monthly_salaries USING btree (company_id, fecha_imputacion) |

✅ **7 índices** - Optimizado para queries por `company_id`, `employee_id`, `fecha_imputacion`.

---

## 5. Verificación de Tablas Case-Sensitive

**Query:** `SELECT to_regclass('"Document"') as document_quoted, to_regclass('document') as document_unquoted, to_regclass('"Product"') as product_quoted, to_regclass('product') as product_unquoted;`

**Resultado:**
- `document_quoted`: `"Document"` ✅ (existe)
- `document_unquoted`: `null` ❌ (no existe sin comillas)
- `product_quoted`: `"Product"` ✅ (existe)
- `product_unquoted`: `null` ❌ (no existe sin comillas)

**⚠️ REGLA IMPORTANTE:**
- Tablas Prisma con nombres PascalCase: usar **comillas dobles** en queries SQL
- Tablas snake_case: usar sin comillas

**Ejemplos correctos:**
```sql
SELECT * FROM "Document" WHERE "id" = 1;
SELECT * FROM "Product" WHERE "name" = 'Test';
SELECT * FROM monthly_sales WHERE company_id = 3;
```

---

## 6. EXPLAIN de Queries Críticas

**Query de prueba:** `EXPLAIN SELECT product_id, quantity_sold FROM monthly_sales WHERE company_id = 3 AND fecha_imputacion = '2025-08';`

**Resultado:**
```
Seq Scan on monthly_sales  (cost=0.00..3.44 rows=50 width=7)
  Filter: ((company_id = 3) AND ((fecha_imputacion)::text = '2025-08'::text))
```

**Análisis:**
- Usa Sequential Scan (esperado para tablas pequeñas < 100 filas)
- PostgreSQL optimiza automáticamente: para tablas pequeñas, un seq scan es más rápido que usar índice
- Con más datos, PostgreSQL usaría automáticamente `idx_monthly_sales_company_month`

✅ **Índices correctos y disponibles** para cuando crezcan los datos.

---

## 7. Conclusión del Diagnóstico

### ✅ Aspectos Positivos:
1. **Base de datos conectada** correctamente vía MCP
2. **Índices optimizados** en todas las tablas críticas
3. **Tamaños pequeños** (< 1 MB) - queries rápidos
4. **Índices compuestos** para queries comunes (company_id + fecha_imputacion)

### 📊 Métricas:
- Tabla más grande: `Document` (490 filas, 752 kB)
- Tablas críticas: `monthly_sales` (96 filas), `monthly_production` (67 filas)
- Índices por tabla crítica: 6-7 índices optimizados

### 🎯 Conclusión Final:
**La base de datos NO es el cuello de botella para los problemas de performance actuales.**

Los problemas de performance son más probablemente causados por:
1. **Requests duplicados** en el frontend (React Query no configurado correctamente)
2. **Cálculos pesados** en el backend (instrumentar con X-Perf-* headers)
3. **Serialización JSON** de respuestas grandes (~200 KB para calculadora-costos-final)

### 🔧 Próximos Pasos Recomendados:
1. ✅ Eliminar requests duplicados en frontend (migrar fetch directo a React Query)
2. ✅ Instrumentar endpoints con headers X-Perf-* para identificar cuello exacto
3. ⏭️ Si X-Perf-DB > 500ms en producción, ejecutar EXPLAIN ANALYZE en queries específicas
4. ⏭️ Considerar paginación si payloads > 500 KB

---

**Generado por:** MCP Postgres Diagnostic Tool  
**MCP Server:** postgres-perf-test  
**Fecha:** 2025-12-15
