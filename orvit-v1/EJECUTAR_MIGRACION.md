# INSTRUCCIONES PARA EJECUTAR MIGRACIÓN

## ⚠️ IMPORTANTE: DETENER DEV SERVER PRIMERO

Para ejecutar esta migración sin perder datos:

1. **Detener el dev server** (Ctrl+C en la terminal donde corre `npm run dev`)

2. **Ejecutar migración:**
   ```bash
   cd "c:\Users\maart\OneDrive\Escritorio\Mawir"
   npm run prisma:generate
   ```

3. **Aplicar migración SQL:**
   ```bash
   # Ejecutar el SQL directamente en PostgreSQL
   psql -U [usuario] -d [database] -f prisma/migrations/add_sales_workflow_config.sql
   ```

   O desde Prisma:
   ```bash
   npx prisma db execute --file prisma/migrations/add_sales_workflow_config.sql
   ```

4. **Reiniciar dev server:**
   ```bash
   npm run dev
   ```

## ✅ Verificación

Después de ejecutar, verificar que los nuevos campos existan:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'sales_config'
AND column_name LIKE '%aprobacion%';
```

Deberías ver:
- requiere_aprobacion_pagos
- requiere_aprobacion_pagos_monto_minimo
- aprobacion_pagos_tipos_requieren
- requiere_aprobacion_facturas
- (etc.)
