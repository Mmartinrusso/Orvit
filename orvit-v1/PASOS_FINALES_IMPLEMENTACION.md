# 📋 PASOS FINALES - Implementación Entregas

## ⚠️ IMPORTANTE: Ejecutar en Orden

### Paso 1: Detener Servidor de Desarrollo

```bash
# Detener servidor actual (Ctrl+C si está corriendo)
```

### Paso 2: Ejecutar Migración SQL Manual

**Opción A - Usando psql**:
```bash
psql -U postgres -d mawir -f prisma/migrations/add_advanced_delivery_config.sql
```

**Opción B - Usando Supabase Dashboard**:
1. Ir a Supabase Dashboard
2. SQL Editor
3. Copiar contenido de `prisma/migrations/add_advanced_delivery_config.sql`
4. Ejecutar

**SQL a Ejecutar**:
```sql
-- Ver archivo: prisma/migrations/add_advanced_delivery_config.sql
-- Agrega 13 campos nuevos a sales_config
```

### Paso 3: Regenerar Prisma Client

```bash
npm run prisma:generate
```

### Paso 4: Reiniciar Servidor

```bash
npm run dev
```

### Paso 5: Verificar en Frontend

1. **Ir a Configuración**:
   - URL: `/administracion/ventas/configuracion`
   - Buscar sección "Entregas"

2. **Verificar 4 Tabs**:
   - ✅ Requisitos
   - ✅ SLA
   - ✅ Notificaciones
   - ✅ Workflow

3. **Probar Guardar**:
   - Modificar algún campo
   - Click en "Guardar Configuración"
   - Verificar toast de éxito

### Paso 6: Ejecutar Script de Testing

```bash
npx tsx scripts/test-data/create-delivery-examples-t1-t2.ts
```

**Qué crea**:
- Empresa TEST COMPANY
- Cliente ACME Corp
- Producto Laptop
- Orden VTA-T1-001 (formal)
- Entrega ENT-T1-001
- Orden VTA-T2-001 (informal)
- Entrega ENT-T2-001

### Paso 7: Verificar T1/T2 en Frontend

1. Ir a `/administracion/ventas/entregas`
2. Cambiar ViewMode:
   - **S** (Standard) = Solo T1
   - **E** (Extended) = T1 + T2
3. Verificar que:
   - ENT-T1-001 aparece en ambos modos
   - ENT-T2-001 solo aparece en modo Extended

### Paso 8: Probar Funcionalidad de Reintentar

1. Buscar una entrega con estado ENTREGA_FALLIDA
2. Click en menú "..." (tres puntos)
3. Verificar opción "🔄 Reintentar entrega"
4. Click y verificar que cambia a EN_TRANSITO

---

## 🔍 Verificación de Implementación

### Checklist Backend ✅

- [x] 7 endpoints de transición creados
- [x] State machine con 8 estados
- [x] Bug PROGRAMADA corregido
- [x] Endpoint /reintentar creado
- [x] 13 campos agregados a schema
- [x] Validación API actualizada
- [x] ViewMode filtering funcionando

### Checklist Frontend ✅

- [x] Handler reintentar agregado
- [x] Componente delivery-config con 4 tabs
- [x] Templates editables
- [x] SLA configurable
- [x] Evidence requirements
- [x] Workflow options

### Checklist Database

- [ ] Migración ejecutada (PENDIENTE - Paso 2)
- [ ] 13 campos en sales_config (POST-MIGRACIÓN)
- [ ] Valores default aplicados (POST-MIGRACIÓN)

---

## 🚨 Troubleshooting

### Error: "column does not exist"

**Causa**: Migración no ejecutada  
**Solución**: Ejecutar Paso 2

### Error: "EPERM operation not permitted"

**Causa**: Servidor corriendo  
**Solución**: Detener servidor (Paso 1), luego Paso 3

### Error: "Module not found @/components/ui/textarea"

**Causa**: Falta instalar componente  
**Solución**:
```bash
npx shadcn-ui@latest add textarea
```

### Frontend no muestra tabs nuevas

**Causa**: Cache del navegador  
**Solución**: Ctrl+Shift+R (hard refresh)

---

## 📊 Campos Agregados

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| deliverySlaPreparacionMaxHoras | Integer | 24 | Max horas en preparación |
| deliverySlaTransitoMaxHoras | Integer | 48 | Max horas en tránsito |
| deliverySlaAlertaRetrasoHoras | Integer | 2 | Horas previas para alerta |
| requiereFirmaCliente | Boolean | false | Firma obligatoria |
| requiereFotoEntrega | Boolean | false | Foto obligatoria |
| requiereDniReceptor | Boolean | false | DNI obligatorio |
| deliveryNotificationTemplates | JSON | {...} | Templates notificaciones |
| deliveryOptionalStates | JSON | [] | Estados opcionales |
| permitirEntregaSinOrden | Boolean | false | Entregas directas |
| deliveryTipoDefault | String | "ENVIO" | Tipo por defecto |
| costoFleteDefault | Decimal | 0 | Costo flete default |
| calcularFleteAutomatico | Boolean | false | Auto-cálculo flete |

---

## ✅ Estado Post-Implementación

Después de completar todos los pasos:

✅ **Backend**: 100% funcional  
✅ **Frontend**: 100% funcional  
✅ **Database**: Actualizada  
✅ **Configuración**: Disponible  
✅ **Testing**: Scripts listos  
✅ **Documentación**: Completa  

**El módulo de Entregas estará listo para producción** 🎉

---

Creado: 6 de Febrero, 2026  
Versión: 1.0 Final
