# 🧪 SMOKE TESTS - Sistema de Mantenimiento Correctivo

Validación rápida (1-2 horas) de los endpoints críticos del sistema de mantenimiento correctivo antes de arrancar con el frontend.

## 🚀 Ejecución

```bash
# Opción 1: Con npm script
npm run smoke:corrective

# Opción 2: Directo con node
node scripts/smoke-corrective.mjs

# Con variables de entorno custom
BASE_URL=http://localhost:3000 TEST_EMAIL=admin@test.com TEST_PASSWORD=admin123 npm run smoke:corrective
```

## ✅ Tests Incluidos

### **TEST 1: Quick-report con causedDowntime=true**
**Valida**: Creación automática de downtime cuando se reporta falla con parada de producción

**Pasos**:
1. ✅ Crear falla con `causedDowntime=true` usando `/api/failure-occurrences/quick-report`
2. ✅ Verificar que se creó `FailureOccurrence` con `causedDowntime=true`
3. ✅ Verificar que se creó `DowntimeLog` automáticamente
4. ✅ Verificar que `DowntimeLog.endedAt=null` (abierto)
5. ✅ Verificar que `DowntimeLog.category='UNPLANNED'`
6. ✅ Crear WorkOrder asociada
7. ✅ Verificar que `WorkOrder.requiresReturnToProduction=true`

**Expected**: ✅ Downtime creado automáticamente con flags correctos

---

### **TEST 2: Close sin confirm-return → DEBE BLOQUEAR (400)**
**Valida**: No se puede cerrar WorkOrder si hay downtime sin confirmar retorno a producción

**Pasos**:
1. 🚫 Intentar cerrar WorkOrder con `POST /api/work-orders/[id]/close`
2. ✅ Verificar que retorna `status=400`
3. ✅ Verificar que error menciona "Retorno a Producción"

**Expected**: ❌ Error 400 - "Debe confirmar Retorno a Producción antes de cerrar"

---

### **TEST 3: Confirm-return → Close debe PASAR**
**Valida**: Después de confirmar retorno a producción, el cierre debe funcionar

**Pasos**:
1. ✅ Confirmar retorno con `POST /api/downtime/[id]/confirm-return`
2. ✅ Verificar que `DowntimeLog.endedAt` se estableció (cerrado)
3. ✅ Verificar que `DowntimeLog.totalMinutes > 0`
4. ✅ Verificar que `WorkOrder.returnToProductionConfirmed=true`
5. ✅ Intentar cerrar WorkOrder nuevamente
6. ✅ Verificar que retorna `status=200`
7. ✅ Verificar que se creó `SolutionApplied`
8. ✅ Verificar que `WorkOrder.status='completed'`

**Expected**: ✅ Retorno confirmado, WorkOrder cierra exitosamente

---

### **TEST 4: Waiting sin ETA o ETA pasada → DEBE BLOQUEAR**
**Valida**: Validaciones de PUT en espera (motivo + ETA obligatorios)

**Pasos**:
1. 🚫 Intentar waiting SIN ETA → Debe retornar `status=400`
2. 🚫 Intentar waiting con ETA PASADA → Debe retornar `status=400`
3. ✅ Waiting con ETA VÁLIDA (futura) → Debe retornar `status=200`
4. ✅ Verificar que `WorkOrder.status='waiting'`

**Expected**:
- ❌ Sin ETA → Error 400
- ❌ ETA pasada → Error 400
- ✅ ETA válida → Success 200

---

### **TEST 5: Link-duplicate → NO aparece en listados**
**Valida**: Duplicados vinculados no aparecen en listados principales

**Pasos**:
1. ✅ Crear falla PRINCIPAL
2. ✅ Crear falla DUPLICADA
3. ✅ Vincular duplicado con `POST /api/failure-occurrences/[id]/link-duplicate`
4. ✅ Verificar que `linkedOccurrence.isLinkedDuplicate=true`
5. ✅ Verificar que `linkedOccurrence.linkedToOccurrenceId` apunta a principal
6. ✅ Obtener lista con `GET /api/failure-occurrences`
7. ✅ Verificar que falla PRINCIPAL aparece en lista
8. ✅ Verificar que falla DUPLICADA NO aparece en lista (filtro `isLinkedDuplicate=false` funciona)

**Expected**: ✅ Duplicado vinculado, NO aparece en listados principales

---

## 📊 Output Esperado

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🧪 SMOKE TESTS - Sistema Mantenimiento Correctivo       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

============================================================
🔧 SETUP - Autenticación y Datos Base
============================================================

🔑 Autenticando usuario...
📡 POST /api/auth/login
✅ PASS: Login - Expected status 200, got 200
✅ PASS: User data returned
✅ PASS: Auth cookie set
✅ PASS: Company ID obtained: 1
✅ Autenticado como: Admin User (admin@test.com)

⚙️ Verificando CorrectiveSettings...
📡 GET /api/corrective-settings
✅ PASS: Get CorrectiveSettings - Expected status 200, got 200
✅ PASS: CorrectiveSettings exist
✅ Settings ID: 1 (duplicateWindowHours: 48)

🏭 Obteniendo máquina de prueba...
📡 GET /api/machines?limit=1
✅ PASS: Get Machines - Expected status 200, got 200
✅ Máquina: Cortadora Principal (ID: 1)

============================================================
TEST 1: Quick-report con causedDowntime=true
============================================================

📝 Creando quick-report con downtime...
📡 POST /api/failure-occurrences/quick-report
✅ PASS: Quick-report returned 201 (200 = duplicates found, 201 = created)
✅ PASS: Occurrence created with ID: 123
✅ PASS: causedDowntime flag is true
✅ PASS: Status is REPORTED (got: REPORTED)

🔍 Verificando DowntimeLog creado...
📡 GET /api/downtime?failureOccurrenceId=123
✅ PASS: Get Downtime Logs - Expected status 200, got 200
✅ PASS: DowntimeLog created (count: 1)
✅ PASS: DowntimeLog is OPEN (endedAt=null)
✅ PASS: Category is UNPLANNED (got: UNPLANNED)
✅ DowntimeLog ID: 45 - OPEN

📋 Creando WorkOrder...
📡 POST /api/work-orders
✅ PASS: Create WorkOrder - Expected status 201, got 201
✅ PASS: WorkOrder created with ID: 67
📡 GET /api/work-orders/67
✅ PASS: Get WorkOrder detail - Expected status 200, got 200
✅ PASS: WorkOrder.requiresReturnToProduction is TRUE
✅ TEST 1 PASSED: Downtime creado, flags correctos

============================================================
TEST 2: Close sin confirm-return → DEBE BLOQUEAR (400)
============================================================

🚫 Intentando cerrar sin confirmar retorno...
📡 POST /api/work-orders/67/close
✅ PASS: Close without confirm-return - Expected status 400, got 400
✅ PASS: Error message mentions 'Retorno a Producción': Debe confirmar Retorno a Producción antes de cerrar
✅ TEST 2 PASSED: Close bloqueado correctamente (400)

============================================================
TEST 3: Confirm-return → Close debe PASAR
============================================================

✅ Confirmando retorno a producción...
📡 POST /api/downtime/45/confirm-return
✅ PASS: Confirm return to production - Expected status 200, got 200
✅ PASS: DowntimeLog ID matches
✅ PASS: Total downtime minutes calculated: 15

🔍 Verificando DowntimeLog cerrado...
📡 GET /api/downtime/45
✅ PASS: Get DowntimeLog detail - Expected status 200, got 200
✅ PASS: DowntimeLog is CLOSED (endedAt set)
✅ PASS: Total minutes: 15

🔍 Verificando WorkOrder flags...
📡 GET /api/work-orders/67
✅ PASS: Get WorkOrder detail - Expected status 200, got 200
✅ PASS: WorkOrder.returnToProductionConfirmed is TRUE
✅ Retorno confirmado correctamente

✅ Intentando cerrar WorkOrder AHORA...
📡 POST /api/work-orders/67/close
✅ PASS: Close WorkOrder - Expected status 200, got 200
✅ PASS: Close was successful
✅ PASS: SolutionApplied created: ID 89
✅ PASS: WorkOrder status is 'completed' (got: completed)
✅ TEST 3 PASSED: Confirm-return permitió cerrar correctamente

============================================================
TEST 4: Waiting sin ETA o ETA pasada → DEBE BLOQUEAR
============================================================

📋 Creando WorkOrder para test de waiting...
📡 POST /api/failure-occurrences
📡 POST /api/work-orders

🚫 TEST 4.1: Waiting SIN ETA...
📡 POST /api/work-orders/68/waiting
✅ PASS: Waiting without ETA - Expected status 400, got 400
✅ PASS: Error mentions 'waitingETA': Validación falló: waitingETA: Required
✅ TEST 4.1 PASSED: Sin ETA bloqueado

🚫 TEST 4.2: Waiting con ETA PASADA...
📡 POST /api/work-orders/68/waiting
✅ PASS: Waiting with past ETA - Expected status 400, got 400
✅ PASS: Error mentions 'futura': waitingETA debe ser una fecha futura
✅ TEST 4.2 PASSED: ETA pasada bloqueada

✅ TEST 4.3: Waiting VÁLIDO...
📡 POST /api/work-orders/68/waiting
✅ PASS: Waiting with valid ETA - Expected status 200, got 200
✅ PASS: Waiting successful
✅ PASS: WorkOrder status is 'waiting' (got: waiting)
✅ TEST 4 PASSED: Validaciones de waiting correctas

============================================================
TEST 5: Link-duplicate → NO aparece en listados
============================================================

📝 Creando falla PRINCIPAL...
📡 POST /api/failure-occurrences
✅ PASS: Main occurrence created: ID 125
✅ PASS: Main occurrence is NOT a duplicate

📝 Creando falla DUPLICADA...
📡 POST /api/failure-occurrences
✅ PASS: Duplicate occurrence created: ID 126

🔗 Vinculando duplicado al principal...
📡 POST /api/failure-occurrences/126/link-duplicate
✅ PASS: Link duplicate - Expected status 200, got 200
✅ PASS: Link was successful
✅ PASS: Linked occurrence has isLinkedDuplicate=true
✅ PASS: Linked to main occurrence ID: 125
✅ Duplicado vinculado correctamente

🔍 Verificando que duplicado NO aparece en listados...
📡 GET /api/failure-occurrences?limit=100
✅ PASS: Get failure occurrences list - Expected status 200, got 200
✅ PASS: Main occurrence APPEARS in list
✅ PASS: Duplicate occurrence DOES NOT appear in list (isLinkedDuplicate filter works)
✅ TEST 5 PASSED: Link-duplicate funciona, duplicado no aparece en listados

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ✅ ALL TESTS PASSED! (12.45s)                            ║
║                                                            ║
║   Sistema de Mantenimiento Correctivo funcionando OK      ║
║   Listo para arrancar con Frontend                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

---

## 🔧 Configuración

### Variables de Entorno

```bash
# .env.local o directo en comando
BASE_URL=http://localhost:3000  # URL del servidor
TEST_EMAIL=admin@test.com       # Email de usuario admin
TEST_PASSWORD=admin123          # Password de usuario admin
```

### Requisitos

1. **Servidor corriendo**: `npm run dev` en otra terminal
2. **Base de datos migrada**: `npm run prisma:migrate`
3. **CorrectiveSettings seeded**: `npm run seed:corrective`
4. **Usuario admin creado**: Tener al menos 1 usuario admin
5. **Máquina existente**: Tener al menos 1 máquina en la BD

---

## ❌ Troubleshooting

### Error: "No autenticado (401)"
**Causa**: Credenciales incorrectas o usuario no existe
**Solución**: Verificar TEST_EMAIL y TEST_PASSWORD, o crear usuario con `npm run create-superadmin`

### Error: "No hay máquinas en la base de datos"
**Causa**: No hay máquinas creadas
**Solución**: Crear al menos 1 máquina desde la UI o manualmente en BD

### Error: "CorrectiveSettings no encontrado"
**Causa**: No se ejecutó el seed
**Solución**: `npm run seed:corrective`

### Test falla en "Close without confirm-return"
**Causa**: Validación de `validateCanClose()` no funciona
**Solución**: Revisar [lib/corrective/downtime-manager.ts](../lib/corrective/downtime-manager.ts)

### Test falla en "Link-duplicate → NO aparece en listados"
**Causa**: Filtro `isLinkedDuplicate=false` no se aplica
**Solución**: Revisar [app/api/failure-occurrences/route.ts](../app/api/failure-occurrences/route.ts) línea ~50

---

## 📝 Próximos Pasos

Si **TODOS los tests PASAN** ✅:

1. **Arrancar Frontend** con vertical slice:
   - Fallas page (`app/mantenimiento/fallas/page.tsx`)
   - QuickReportDialog (`components/corrective/failures/QuickReportDialog.tsx`)
   - DuplicateModal + Link (`components/corrective/failures/DuplicateDetectionModal.tsx`)
   - WorkOrder sheet con Waiting/Return/Close tabs

2. **Metrics Dashboard** (opcional, después del frontend core)

Si **algún test FALLA** ❌:

1. Revisar logs de error
2. Verificar endpoint específico
3. Revisar validaciones en helpers
4. Corregir y volver a ejecutar: `npm run smoke:corrective`

---

## 🎯 Cobertura de Tests

| Endpoint | Método | Validado |
|----------|--------|----------|
| `/api/corrective-settings` | GET | ✅ Setup |
| `/api/failure-occurrences/quick-report` | POST | ✅ Test 1 |
| `/api/downtime` | GET | ✅ Test 1 |
| `/api/work-orders` | POST, GET | ✅ Test 1 |
| `/api/work-orders/[id]/close` | POST | ✅ Test 2, 3 |
| `/api/downtime/[id]/confirm-return` | POST | ✅ Test 3 |
| `/api/work-orders/[id]/waiting` | POST | ✅ Test 4 |
| `/api/work-orders/[id]/resume` | POST | ✅ Test 4 (cleanup) |
| `/api/failure-occurrences` | POST, GET | ✅ Test 5 |
| `/api/failure-occurrences/[id]/link-duplicate` | POST | ✅ Test 5 |

**Cobertura**: 10/17 endpoints críticos (59%)
**Validaciones**: 50+ assertions

---

Creado: 2026-01-01
Autor: Claude Sonnet 4.5
Versión: 1.0.0
