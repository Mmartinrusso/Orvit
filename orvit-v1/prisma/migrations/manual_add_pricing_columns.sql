-- Migración manual: Agregar columnas de pricing method a sales_config
-- Ejecutar esto manualmente en la base de datos PostgreSQL

-- 1. Agregar columna pricing_method
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS pricing_method VARCHAR(20) DEFAULT 'LIST';

-- 2. Agregar columna show_costs_in_quotes
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS show_costs_in_quotes BOOLEAN DEFAULT FALSE;

-- 3. Agregar columna show_margins_in_quotes
ALTER TABLE sales_config
ADD COLUMN IF NOT EXISTS show_margins_in_quotes BOOLEAN DEFAULT FALSE;

-- Verificar que las columnas se agregaron correctamente
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sales_config'
  AND column_name IN ('pricing_method', 'show_costs_in_quotes', 'show_margins_in_quotes');
