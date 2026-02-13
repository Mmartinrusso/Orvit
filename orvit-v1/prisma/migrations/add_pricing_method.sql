-- Agregar configuración de método de pricing a SalesConfig
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS pricing_method VARCHAR(20) DEFAULT 'LIST';
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS show_costs_in_quotes BOOLEAN DEFAULT FALSE;
ALTER TABLE sales_config ADD COLUMN IF NOT EXISTS show_margins_in_quotes BOOLEAN DEFAULT FALSE;

-- Valores posibles para pricing_method: 'LIST' (Lista de Precios), 'MARGIN' (Margen sobre Costo), 'DISCOUNT' (Descuento)

COMMENT ON COLUMN sales_config.pricing_method IS 'Método de pricing: LIST (Lista de Precios), MARGIN (Margen sobre Costo), DISCOUNT (Descuento)';
COMMENT ON COLUMN sales_config.show_costs_in_quotes IS 'Si se muestran los costos en el formulario de cotizaciones';
COMMENT ON COLUMN sales_config.show_margins_in_quotes IS 'Si se muestran los márgenes en el formulario de cotizaciones';
