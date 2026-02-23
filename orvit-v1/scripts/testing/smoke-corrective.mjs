/**
 * SMOKE TESTS - Sistema de Mantenimiento Correctivo
 *
 * Valida flujos críticos:
 * 1. Quick-report con causedDowntime=true → crea downtime abierto + flags
 * 2. Close sin confirm-return → debe bloquear (400)
 * 3. Confirm-return → cierra downtime + marca flags → Close ahora pasa
 * 4. Waiting sin ETA/ETA pasada → debe bloquear
 * 5. Link-duplicate → marca duplicado, cancela OTs, NO aparece en listados
 *
 * Ejecutar: node scripts/smoke-corrective.mjs
 * O con credenciales: node scripts/smoke-corrective.mjs email@test.com password123
 */

import { setTimeout as sleep } from 'timers/promises';
import { readFileSync } from 'fs';
import { join } from 'path';

// ========== LEER .env.test SI EXISTE ==========
try {
  const envPath = join(process.cwd(), '.env.test');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (error) {
  // .env.test no existe, no es crítico
}

// ========== CONFIGURACIÓN ==========
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Permitir pasar credenciales como argumentos CLI
const cliEmail = process.argv[2];
const cliPassword = process.argv[3];

const TEST_USER = {
  email: cliEmail || process.env.TEST_EMAIL || 'admin@test.com',
  password: cliPassword || process.env.TEST_PASSWORD || 'admin123'
};

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// ========== HELPERS ==========
let authCookie = '';
let companyId = null;

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

async function request(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authCookie && { Cookie: authCookie })
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const url = `${BASE_URL}${path}`;
  log('📡', `${method} ${path}`, colors.gray);

  // DEBUG: Mostrar headers enviados
  if (authCookie && path !== '/api/auth/login') {
    log('🔍', `Enviando Cookie: ${authCookie.substring(0, 30)}...`, colors.gray);
  }

  const response = await fetch(url, options);

  // Guardar cookie de autenticación (mejorado para manejar múltiples cookies)
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    // Puede venir como string con múltiples cookies separadas por coma
    const cookies = setCookieHeader.split(',').map(c => c.trim());
    const tokenCookie = cookies.find(c => c.includes('token='));
    if (tokenCookie) {
      // Extraer solo token=value (sin path, httponly, etc.)
      authCookie = tokenCookie.split(';')[0].trim();
    }
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { status: response.status, data, response };
}

function assert(condition, message) {
  if (!condition) {
    log('❌', `FAIL: ${message}`, colors.red);
    throw new Error(`Assertion failed: ${message}`);
  }
  log('✅', `PASS: ${message}`, colors.green);
}

function assertStatus(actual, expected, context) {
  assert(
    actual === expected,
    `${context} - Expected status ${expected}, got ${actual}`
  );
}

// ========== SETUP ==========
async function setup() {
  logSection('🔧 SETUP - Autenticación y Datos Base');

  // 1. Login
  log('🔑', 'Autenticando usuario...', colors.blue);
  const { status, data } = await request('POST', '/api/auth/login', TEST_USER);
  assertStatus(status, 200, 'Login');
  assert(data.user, 'User data returned');

  // Debug: mostrar cookie guardada
  if (!authCookie) {
    console.error('⚠️  Cookie no se guardó. Intentando extraer de data...');
  } else {
    log('🍪', `Cookie guardada: ${authCookie.substring(0, 50)}...`, colors.gray);
  }

  assert(authCookie, 'Auth cookie set');

  companyId = data.user.companyId || data.user.companies?.[0]?.companyId;
  assert(companyId, `Company ID obtained: ${companyId}`);

  log('✅', `Autenticado como: ${data.user.name} (${data.user.email})`, colors.green);

  // 2. Verificar CorrectiveSettings existen
  log('⚙️', 'Verificando CorrectiveSettings...', colors.blue);
  const settingsRes = await request('GET', '/api/corrective-settings');
  assertStatus(settingsRes.status, 200, 'Get CorrectiveSettings');
  assert(settingsRes.data.id, 'CorrectiveSettings exist');
  log('✅', `Settings ID: ${settingsRes.data.id} (duplicateWindowHours: ${settingsRes.data.duplicateWindowHours})`, colors.green);

  // 3. Obtener una máquina existente (asumimos que hay al menos 1)
  log('🏭', 'Obteniendo máquina de prueba...', colors.blue);
  const machinesRes = await request('GET', '/api/machines?limit=1');
  assertStatus(machinesRes.status, 200, 'Get Machines');

  if (!machinesRes.data.machines || machinesRes.data.machines.length === 0) {
    throw new Error('❌ No hay máquinas en la base de datos. Crear al menos 1 máquina primero.');
  }

  const machine = machinesRes.data.machines[0];
  log('✅', `Máquina: ${machine.name} (ID: ${machine.id})`, colors.green);

  // 4. Crear síntomas de prueba (si symptom_library existe)
  log('🏷️', 'Preparando datos de prueba...', colors.blue);

  return {
    userId: data.user.id,
    machineId: machine.id,
    componentId: machine.components?.[0]?.id || null
  };
}

// ========== TEST 1: Quick-report con downtime ==========
async function test1_quickReportWithDowntime(testData) {
  logSection('TEST 1: Quick-report con causedDowntime=true');

  log('📝', 'Creando quick-report con downtime...', colors.blue);

  const quickReportPayload = {
    machineId: testData.machineId,
    symptomIds: [1], // Asumimos que existe al menos 1 symptom
    causedDowntime: true,
    title: 'TEST SMOKE: Motor no arranca',
    description: 'Falla de prueba para smoke test',
    isIntermittent: false,
    isObservation: false
  };

  const { status, data } = await request('POST', '/api/failure-occurrences/quick-report', quickReportPayload);

  // Puede retornar 200 con duplicates, o 201 si creó
  assert(
    status === 200 || status === 201,
    `Quick-report returned ${status} (200 = duplicates found, 201 = created)`
  );

  let occurrence;
  if (status === 200 && data.hasDuplicates) {
    log('⚠️', 'Duplicados detectados, creando falla nueva forzada...', colors.yellow);
    // Crear falla normal para evitar duplicados
    const createRes = await request('POST', '/api/failure-occurrences', quickReportPayload);
    assertStatus(createRes.status, 201, 'Create failure occurrence');
    occurrence = createRes.data.occurrence;
  } else {
    occurrence = data.occurrence;
  }

  assert(occurrence.id, `Occurrence created with ID: ${occurrence.id}`);
  assert(occurrence.causedDowntime === true, 'causedDowntime flag is true');
  assert(occurrence.status === 'REPORTED', `Status is REPORTED (got: ${occurrence.status})`);

  // Verificar que se creó DowntimeLog
  log('🔍', 'Verificando DowntimeLog creado...', colors.blue);
  const downtimeRes = await request('GET', `/api/downtime?failureOccurrenceId=${occurrence.id}`);
  assertStatus(downtimeRes.status, 200, 'Get Downtime Logs');

  const downtimeLogs = downtimeRes.data.data;
  assert(downtimeLogs.length > 0, `DowntimeLog created (count: ${downtimeLogs.length})`);

  const downtime = downtimeLogs[0];
  assert(downtime.endedAt === null, 'DowntimeLog is OPEN (endedAt=null)');
  assert(downtime.category === 'UNPLANNED', `Category is UNPLANNED (got: ${downtime.category})`);

  log('✅', `DowntimeLog ID: ${downtime.id} - OPEN`, colors.green);

  // Crear WorkOrder para continuar tests
  log('📋', 'Creando WorkOrder...', colors.blue);
  const woPayload = {
    companyId: companyId,
    type: 'CORRECTIVE',
    origin: 'FAILURE',
    status: 'pending',
    title: `TEST: ${occurrence.title}`,
    machineId: testData.machineId,
    priority: occurrence.priority,
    reportedById: testData.userId,
    failureOccurrenceIds: [occurrence.id]
  };

  const woRes = await request('POST', '/api/work-orders', woPayload);
  assertStatus(woRes.status, 201, 'Create WorkOrder');

  const workOrder = woRes.data;
  assert(workOrder.id, `WorkOrder created with ID: ${workOrder.id}`);

  // Verificar que WorkOrder tiene requiresReturnToProduction=true
  const woDetailRes = await request('GET', `/api/work-orders/${workOrder.id}`);
  assertStatus(woDetailRes.status, 200, 'Get WorkOrder detail');

  assert(
    woDetailRes.data.requiresReturnToProduction === true,
    'WorkOrder.requiresReturnToProduction is TRUE'
  );

  log('✅', 'TEST 1 PASSED: Downtime creado, flags correctos', colors.green);

  return {
    occurrenceId: occurrence.id,
    workOrderId: workOrder.id,
    downtimeId: downtime.id
  };
}

// ========== TEST 2: Close sin confirm-return ==========
async function test2_closeWithoutConfirmReturn(testData) {
  logSection('TEST 2: Close sin confirm-return → DEBE BLOQUEAR (400)');

  log('🚫', 'Intentando cerrar sin confirmar retorno...', colors.blue);

  const closePayload = {
    diagnosis: 'TEST: Motor sobrecalentado',
    solution: 'TEST: Cambió filtro de aceite',
    outcome: 'FUNCIONÓ',
    performedById: testData.userId,
    actualMinutes: 30
  };

  const { status, data } = await request('POST', `/api/work-orders/${testData.workOrderId}/close`, closePayload);

  // DEBE FALLAR con 400
  assertStatus(status, 400, 'Close without confirm-return');
  assert(
    data.error && data.error.includes('Retorno a Producción'),
    `Error message mentions 'Retorno a Producción': ${data.error}`
  );

  log('✅', 'TEST 2 PASSED: Close bloqueado correctamente (400)', colors.green);
}

// ========== TEST 3: Confirm-return → Close debe pasar ==========
async function test3_confirmReturnThenClose(testData) {
  logSection('TEST 3: Confirm-return → Close debe PASAR');

  // 3.1 - Confirmar retorno a producción
  log('✅', 'Confirmando retorno a producción...', colors.blue);

  const confirmPayload = {
    workOrderId: testData.workOrderId,
    notes: 'TEST: Máquina vuelta a producción',
    productionImpact: 'TEST: 2 horas de parada'
  };

  const confirmRes = await request('POST', `/api/downtime/${testData.downtimeId}/confirm-return`, confirmPayload);
  assertStatus(confirmRes.status, 200, 'Confirm return to production');

  const confirmData = confirmRes.data.data;
  assert(confirmData.downtimeLogId === testData.downtimeId, 'DowntimeLog ID matches');
  assert(confirmData.totalMinutes > 0, `Total downtime minutes calculated: ${confirmData.totalMinutes}`);

  // Verificar que DowntimeLog está cerrado
  log('🔍', 'Verificando DowntimeLog cerrado...', colors.blue);
  const downtimeRes = await request('GET', `/api/downtime/${testData.downtimeId}`);
  assertStatus(downtimeRes.status, 200, 'Get DowntimeLog detail');

  assert(downtimeRes.data.endedAt !== null, 'DowntimeLog is CLOSED (endedAt set)');
  assert(downtimeRes.data.totalMinutes > 0, `Total minutes: ${downtimeRes.data.totalMinutes}`);

  // Verificar que WorkOrder tiene returnToProductionConfirmed=true
  log('🔍', 'Verificando WorkOrder flags...', colors.blue);
  const woRes = await request('GET', `/api/work-orders/${testData.workOrderId}`);
  assertStatus(woRes.status, 200, 'Get WorkOrder detail');

  assert(
    woRes.data.returnToProductionConfirmed === true,
    'WorkOrder.returnToProductionConfirmed is TRUE'
  );

  log('✅', 'Retorno confirmado correctamente', colors.green);

  // 3.2 - Ahora SÍ debe poder cerrar
  log('✅', 'Intentando cerrar WorkOrder AHORA...', colors.blue);

  const closePayload = {
    diagnosis: 'TEST: Motor sobrecalentado',
    solution: 'TEST: Cambió filtro de aceite',
    outcome: 'FUNCIONÓ',
    performedById: testData.userId,
    actualMinutes: 30,
    effectiveness: 5
  };

  const closeRes = await request('POST', `/api/work-orders/${testData.workOrderId}/close`, closePayload);
  assertStatus(closeRes.status, 200, 'Close WorkOrder');

  assert(closeRes.data.success === true, 'Close was successful');
  assert(closeRes.data.solutionApplied.id, `SolutionApplied created: ID ${closeRes.data.solutionApplied.id}`);
  assert(
    closeRes.data.workOrder.status === 'completed',
    `WorkOrder status is 'completed' (got: ${closeRes.data.workOrder.status})`
  );

  log('✅', 'TEST 3 PASSED: Confirm-return permitió cerrar correctamente', colors.green);

  return {
    solutionAppliedId: closeRes.data.solutionApplied.id
  };
}

// ========== TEST 4: Waiting validations ==========
async function test4_waitingValidations(testData) {
  logSection('TEST 4: Waiting sin ETA o ETA pasada → DEBE BLOQUEAR');

  // Crear nueva WorkOrder para este test
  log('📋', 'Creando WorkOrder para test de waiting...', colors.blue);

  const occurrencePayload = {
    machineId: testData.machineId,
    symptomIds: [1],
    causedDowntime: false,
    title: 'TEST: Waiting validation',
    description: 'Test para validar waiting'
  };

  const occRes = await request('POST', '/api/failure-occurrences', occurrencePayload);
  const newOccurrence = occRes.status === 201 ? occRes.data.occurrence : occRes.data.occurrence;

  const woPayload = {
    companyId: companyId,
    type: 'CORRECTIVE',
    origin: 'FAILURE',
    status: 'in_progress',
    title: 'TEST: Waiting validation',
    machineId: testData.machineId,
    priority: 'P3',
    reportedById: testData.userId,
    failureOccurrenceIds: [newOccurrence.id]
  };

  const woRes = await request('POST', '/api/work-orders', woPayload);
  const newWorkOrder = woRes.data;

  // 4.1 - Waiting sin ETA
  log('🚫', 'TEST 4.1: Waiting SIN ETA...', colors.blue);

  const invalidPayload1 = {
    waitingReason: 'SPARE_PART',
    waitingDescription: 'Esperando repuesto'
    // waitingETA falta
  };

  const res1 = await request('POST', `/api/work-orders/${newWorkOrder.id}/waiting`, invalidPayload1);
  assertStatus(res1.status, 400, 'Waiting without ETA');
  assert(
    res1.data.error && res1.data.error.includes('waitingETA'),
    `Error mentions 'waitingETA': ${res1.data.error}`
  );

  log('✅', 'TEST 4.1 PASSED: Sin ETA bloqueado', colors.green);

  // 4.2 - Waiting con ETA pasada
  log('🚫', 'TEST 4.2: Waiting con ETA PASADA...', colors.blue);

  const pastDate = new Date('2020-01-01T10:00:00Z').toISOString();
  const invalidPayload2 = {
    waitingReason: 'SPARE_PART',
    waitingDescription: 'Esperando repuesto',
    waitingETA: pastDate
  };

  const res2 = await request('POST', `/api/work-orders/${newWorkOrder.id}/waiting`, invalidPayload2);
  assertStatus(res2.status, 400, 'Waiting with past ETA');
  assert(
    res2.data.error && res2.data.error.includes('futura'),
    `Error mentions 'futura': ${res2.data.error}`
  );

  log('✅', 'TEST 4.2 PASSED: ETA pasada bloqueada', colors.green);

  // 4.3 - Waiting VÁLIDO
  log('✅', 'TEST 4.3: Waiting VÁLIDO...', colors.blue);

  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // +1 día
  const validPayload = {
    waitingReason: 'SPARE_PART',
    waitingDescription: 'Esperando rodamiento SKF 6205',
    waitingETA: futureDate
  };

  const res3 = await request('POST', `/api/work-orders/${newWorkOrder.id}/waiting`, validPayload);
  assertStatus(res3.status, 200, 'Waiting with valid ETA');
  assert(res3.data.success === true, 'Waiting successful');
  assert(
    res3.data.data.status === 'waiting',
    `WorkOrder status is 'waiting' (got: ${res3.data.data.status})`
  );

  log('✅', 'TEST 4 PASSED: Validaciones de waiting correctas', colors.green);

  // Cleanup: Resume para dejar limpio
  await request('POST', `/api/work-orders/${newWorkOrder.id}/resume`, {});
}

// ========== TEST 5: Link-duplicate ==========
async function test5_linkDuplicate(testData) {
  logSection('TEST 5: Link-duplicate → NO aparece en listados');

  // 5.1 - Crear falla principal
  log('📝', 'Creando falla PRINCIPAL...', colors.blue);

  const mainPayload = {
    machineId: testData.machineId,
    symptomIds: [1],
    causedDowntime: false,
    title: 'TEST MAIN: Bomba hidráulica falla',
    description: 'Falla principal para test de duplicados'
  };

  const mainRes = await request('POST', '/api/failure-occurrences', mainPayload);
  const mainOccurrence = mainRes.status === 201 ? mainRes.data.occurrence : mainRes.data.occurrence;

  assert(mainOccurrence.id, `Main occurrence created: ID ${mainOccurrence.id}`);
  assert(mainOccurrence.isLinkedDuplicate === false, 'Main occurrence is NOT a duplicate');

  // 5.2 - Crear falla duplicada
  log('📝', 'Creando falla DUPLICADA...', colors.blue);

  const dupPayload = {
    machineId: testData.machineId,
    symptomIds: [1],
    causedDowntime: false,
    title: 'TEST DUP: Bomba hidráulica falla (reporte duplicado)',
    description: 'Falla duplicada para test'
  };

  const dupRes = await request('POST', '/api/failure-occurrences', dupPayload);
  const dupOccurrence = dupRes.status === 201 ? dupRes.data.occurrence : dupRes.data.occurrence;

  assert(dupOccurrence.id, `Duplicate occurrence created: ID ${dupOccurrence.id}`);

  // 5.3 - Vincular duplicado
  log('🔗', 'Vinculando duplicado al principal...', colors.blue);

  const linkPayload = {
    mainOccurrenceId: mainOccurrence.id,
    linkedReason: 'TEST: Misma falla reportada dos veces',
    notes: 'Test de vinculación de duplicados'
  };

  const linkRes = await request('POST', `/api/failure-occurrences/${dupOccurrence.id}/link-duplicate`, linkPayload);
  assertStatus(linkRes.status, 200, 'Link duplicate');

  assert(linkRes.data.success === true, 'Link was successful');
  assert(
    linkRes.data.data.linkedOccurrence.isLinkedDuplicate === true,
    'Linked occurrence has isLinkedDuplicate=true'
  );
  assert(
    linkRes.data.data.linkedOccurrence.linkedToOccurrenceId === mainOccurrence.id,
    `Linked to main occurrence ID: ${mainOccurrence.id}`
  );

  log('✅', 'Duplicado vinculado correctamente', colors.green);

  // 5.4 - Verificar que NO aparece en listados
  log('🔍', 'Verificando que duplicado NO aparece en listados...', colors.blue);

  const listRes = await request('GET', '/api/failure-occurrences?limit=100');
  assertStatus(listRes.status, 200, 'Get failure occurrences list');

  const occurrences = listRes.data.data;
  const foundMain = occurrences.find(o => o.id === mainOccurrence.id);
  const foundDup = occurrences.find(o => o.id === dupOccurrence.id);

  assert(foundMain, 'Main occurrence APPEARS in list');
  assert(!foundDup, 'Duplicate occurrence DOES NOT appear in list (isLinkedDuplicate filter works)');

  log('✅', 'TEST 5 PASSED: Link-duplicate funciona, duplicado no aparece en listados', colors.green);
}

// ========== MAIN ==========
async function main() {
  const startTime = Date.now();

  console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🧪 SMOKE TESTS - Sistema Mantenimiento Correctivo       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
  `);

  try {
    // Setup
    const testData = await setup();

    // Test 1: Quick-report con downtime
    const test1Results = await test1_quickReportWithDowntime(testData);
    Object.assign(testData, test1Results);

    // Test 2: Close sin confirm-return
    await test2_closeWithoutConfirmReturn(testData);

    // Test 3: Confirm-return → Close pasa
    const test3Results = await test3_confirmReturnThenClose(testData);
    Object.assign(testData, test3Results);

    // Test 4: Waiting validations
    await test4_waitingValidations(testData);

    // Test 5: Link-duplicate
    await test5_linkDuplicate(testData);

    // Success
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`
${colors.green}╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ✅ ALL TESTS PASSED! (${duration}s)                              ║
║                                                            ║
║   Sistema de Mantenimiento Correctivo funcionando OK      ║
║   Listo para arrancar con Frontend                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
    `);

    process.exit(0);

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`
${colors.red}╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ❌ TESTS FAILED! (${duration}s)                                 ║
║                                                            ║
║   ${error.message.slice(0, 50).padEnd(50)}     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
    `);

    console.error(error);
    process.exit(1);
  }
}

// Run
main();
