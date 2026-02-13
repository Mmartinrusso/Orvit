-- Verificar y corregir las tablas Quote

-- Primero verificar si hay datos
DO $$
DECLARE
    quote_count INTEGER;
    quote_item_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO quote_count FROM "Quote";
    SELECT COUNT(*) INTO quote_item_count FROM "QuoteItem";
    RAISE NOTICE 'Registros en Quote: %', quote_count;
    RAISE NOTICE 'Registros en QuoteItem: %', quote_item_count;
END $$;
