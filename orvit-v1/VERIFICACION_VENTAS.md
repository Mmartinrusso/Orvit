# ✅ Verificación Completa - Módulo de Ventas

## 🔧 Cambios Realizados

### 1. Migración SQL (✅ Completada)
- ✅ `pricing_method` agregado a `sales_config`
- ✅ `show_costs_in_quotes` agregado a `sales_config`
- ✅ `show_margins_in_quotes` agregado a `sales_config`

### 2. Permisos Corregidos
- ✅ Dashboard usa permisos correctos: `ventas.cotizaciones.create`, etc.
- ✅ Configuración accesible con `ventas.dashboard.view`

### 3. Modales Actualizados
- ✅ QuoteQuickModal integrado en dashboard
- ✅ QuoteQuickModal integrado en página de cotizaciones
- ✅ Modal simplificado con flujo de teclado

---

## 🚨 Error Actual: 500 en API de Clientes

**Error:**
```
GET /api/ventas/clientes?page=1&limit=20&...&includeCredit=true 500
```

**Causa Probable:**
El servidor necesita reiniciarse para que Prisma Client reconozca los nuevos tipos.

---

## 📋 Checklist de Verificación

### Paso 1: Reiniciar Servidor
```bash
# Detener el servidor (Ctrl+C)
npm run dev
```

### Paso 2: Verificar Base de Datos
Ejecutar en Supabase SQL Editor o psql:

```sql
-- Verificar columnas agregadas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sales_config'
  AND column_name IN ('pricing_method', 'show_costs_in_quotes', 'show_margins_in_quotes');

-- Debería retornar 3 filas

-- Verificar datos
SELECT company_id, pricing_method, show_costs_in_quotes, show_margins_in_quotes
FROM sales_config;

-- Si no hay registros, crear uno default:
INSERT INTO sales_config (company_id, pricing_method, show_costs_in_quotes, show_margins_in_quotes)
VALUES (1, 'LIST', false, false)
ON CONFLICT (company_id) DO NOTHING;
```

### Paso 3: Probar Clientes

#### 3.1 Listar Clientes
```
GET /api/ventas/clientes?page=1&limit=20
```
- ✅ Debe retornar 200 OK
- ✅ Debe mostrar listado de clientes

#### 3.2 Crear Cliente (Modal)
1. Ir a **Ventas → Dashboard**
2. Click en **"Nuevo Cliente"**
3. Llenar formulario:
   - Razón Social: "Test Cliente S.A."
   - Email: "test@ejemplo.com"
   - Código Postal: "1234"
   - Condición IVA: Responsable Inscripto
4. Guardar
- ✅ Debe crear sin errores
- ✅ Debe aparecer en el listado

#### 3.3 Editar Cliente
1. Click en un cliente del listado
2. Modificar algún dato
3. Guardar
- ✅ Debe actualizar correctamente

### Paso 4: Probar Cotizaciones

#### 4.1 Ir a Configuración
1. **Ventas → Configuración → Cotizaciones**
- ✅ Debe cargar sin redirigir a áreas
- ✅ Debe mostrar 3 métodos de pricing
- ✅ Debe poder seleccionar y guardar

#### 4.2 Nueva Cotización (Botón debe aparecer)
1. **Ventas → Dashboard**
2. Verificar que aparece **"Nueva Cotización"** en Acciones Rápidas
- ✅ El botón DEBE estar visible
- ✅ Al hacer click abre el QuoteQuickModal (simple, no el complejo)

#### 4.3 Flujo de Cotización Rápida
1. Click en **"Nueva Cotización"**
2. Seleccionar cliente
3. En "Producto (Código o Nombre)":
   - Escribir código o nombre
   - Debe aparecer autocomplete
   - Seleccionar producto
   - Focus automático en cantidad
4. Ingresar cantidad → Enter
5. Producto se agrega a la lista
6. Agregar más productos
7. Click en **"Crear Cotización"**
- ✅ Debe crear exitosamente
- ✅ Debe aparecer en listado de cotizaciones

### Paso 5: Probar Productos

1. **Ventas → Productos**
- ✅ Listado debe cargar
2. Click **"Nuevo Producto"**
- ✅ Modal debe abrir
- ✅ Debe poder crear producto

---

## 🐛 Si Persisten Errores

### Error 500 en cualquier API
```bash
# Limpiar cache de Next.js
npm run clean
# O manualmente:
rm -rf .next

# Regenerar Prisma Client
npx prisma generate

# Reiniciar servidor
npm run dev
```

### Modal no abre / Botón no aparece
**Causa:** Permisos no asignados al rol del usuario

**Solución:**
```sql
-- Ver permisos del usuario actual
SELECT u.email, r.name as role, p.name as permission
FROM users u
JOIN user_role_assignments ura ON u.id = ura.user_id
JOIN roles r ON ura.role_id = r.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE u.id = <TU_USER_ID>;

-- Asignar todos los permisos de ventas al rol (temporal para testing)
-- Reemplazar <ROLE_ID> con tu rol
INSERT INTO role_permissions (role_id, permission_id)
SELECT <ROLE_ID>, id
FROM permissions
WHERE name LIKE 'ventas.%'
ON CONFLICT DO NOTHING;
```

### Configuración redirige a Áreas
- ✅ Ya corregido: usa `ventas.dashboard.view` en lugar de `ventas.config.view`
- Si persiste, verificar que el usuario tenga el permiso `ventas.dashboard.view`

---

## ✨ Características del Nuevo Sistema

### QuoteQuickModal (Nuevo)
- 🎯 Flujo optimizado para teclado
- 🎯 Autocomplete de productos (código/nombre)
- 🎯 Focus automático entre campos
- 🎯 Enter para agregar items
- 🎯 Precios automáticos desde producto
- ❌ Sin campos de margen/costo innecesarios

### Configuración de Pricing
- **Lista de Precios**: Precios fijos, oculta costos (ideal para Pretensados Córdoba)
- **Margen sobre Costo**: Calcula precio = costo × (1 + margen)
- **Descuento sobre Precio**: Descuentos negociables
- Control de visibilidad de costos y márgenes

### Permisos Granulares
Todos los modales usan permisos específicos:
- `ventas.clientes.create` - Crear cliente
- `ventas.cotizaciones.create` - Crear cotización
- `ventas.productos.create` - Crear producto
- `ventas.ventas.create` - Crear venta

---

## 📞 Reportar Resultados

Después de verificar, reportar:
1. ✅ ¿Se solucionó el error 500 de clientes?
2. ✅ ¿Aparece el botón "Nueva Cotización"?
3. ✅ ¿El modal de cotización es el nuevo (simple)?
4. ✅ ¿Funciona el autocomplete de productos?
5. ✅ ¿Se puede acceder a Configuración → Cotizaciones?
6. ✅ ¿Se puede cambiar y guardar el método de pricing?
