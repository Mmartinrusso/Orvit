#!/usr/bin/env node

/**
 * Script de escaneo de performance para endpoints de mantenimiento
 * 
 * Uso:
 *   node scripts/perf-scan-maintenance.mjs [--token TOKEN] [--base-url URL] [--company-id ID]
 * 
 * Ejemplos:
 *   node scripts/perf-scan-maintenance.mjs
 *   node scripts/perf-scan-maintenance.mjs --token "eyJhbGc..." --base-url "http://localhost:3000" --company-id 1
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const DEFAULT_COMPANY_ID = '1';

// Parse args
const args = process.argv.slice(2);
let token = null;
let baseUrl = BASE_URL;
let companyId = DEFAULT_COMPANY_ID;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--token' && args[i + 1]) {
    token = args[i + 1];
    i++;
  } else if (args[i] === '--base-url' && args[i + 1]) {
    baseUrl = args[i + 1];
    i++;
  } else if (args[i] === '--company-id' && args[i + 1]) {
    companyId = args[i + 1];
    i++;
  }
}

// Lista de endpoints de mantenimiento a medir
const MAINTENANCE_ENDPOINTS = [
  {
    path: '/api/maintenance/dashboard',
    params: { companyId, pageSize: '50' },
    label: 'Maintenance Dashboard',
    requiresAuth: true,
  },
  {
    path: '/api/maintenance/pending',
    params: { companyId },
    label: 'Maintenance Pending',
    requiresAuth: true,
  },
  {
    path: '/api/maintenance/completed',
    params: { companyId, page: '0', pageSize: '50' },
    label: 'Maintenance Completed',
    requiresAuth: true,
  },
  {
    path: '/api/maintenance/history',
    params: { companyId, page: '0', pageSize: '50' },
    label: 'Maintenance History',
    requiresAuth: true,
  },
  {
    path: '/api/maintenance/checklists',
    params: { companyId, skip: '0', take: '10' },
    label: 'Maintenance Checklists',
    requiresAuth: true,
  },
  {
    path: '/api/machines/detail',
    params: { machineId: '1' }, // Ajustar según datos reales
    label: 'Machine Detail',
    requiresAuth: true,
  },
  {
    path: '/api/machines/initial',
    params: { companyId },
    label: 'Machines Initial',
    requiresAuth: true,
  },
  {
    path: '/api/work-orders',
    params: { companyId },
    label: 'Work Orders',
    requiresAuth: true,
  },
  {
    path: '/api/documents',
    params: { entityType: 'machine', entityId: '1' }, // Ajustar según datos reales
    label: 'Documents',
    requiresAuth: true,
  },
  {
    path: '/api/notifications',
    params: { limit: '50', offset: '0' },
    label: 'Notifications',
    requiresAuth: true,
  },
  {
    path: '/api/failures',
    params: { companyId, machineId: '1' }, // Ajustar según datos reales
    label: 'Failures',
    requiresAuth: true,
  },
];

const RUNS = 5; // Número de ejecuciones para calcular mediana

/**
 * Obtener cookie de token desde archivo .env.local o usar el token proporcionado
 */
function getAuthToken() {
  if (token) return token;
  
  try {
    const envPath = join(__dirname, '..', '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    const match = envContent.match(/JWT_SECRET=(.+)/);
    if (match) {
      // En producción, el token vendría de las cookies
      // Por ahora, retornamos null y el script usará cookies si están disponibles
      return null;
    }
  } catch (e) {
    // .env.local no existe, continuar
  }
  
  return null;
}

/**
 * Hacer request a un endpoint
 */
async function measureEndpoint(endpoint) {
  const { path, params, requiresAuth } = endpoint;
  
  const url = new URL(path, baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  
  // Agregar parámetros de debug
  url.searchParams.append('debug', '1');
  url.searchParams.append('noCache', '1');
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (requiresAuth) {
    const authToken = getAuthToken();
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    // Si no hay token, asumimos que las cookies funcionarán (para desarrollo local)
  }
  
  const times = [];
  const payloadSizes = [];
  const perfHeaders = [];
  
  for (let i = 0; i < RUNS; i++) {
    try {
      const startTime = Date.now();
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        credentials: 'include', // Incluir cookies
      });
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      const body = await response.text();
      const payloadSize = new Blob([body]).size;
      
      // Extraer headers de performance
      const perfData = {
        total: response.headers.get('X-Perf-Total') || null,
        db: response.headers.get('X-Perf-DB') || null,
        compute: response.headers.get('X-Perf-Compute') || null,
        json: response.headers.get('X-Perf-JSON') || null,
        payloadBytes: response.headers.get('X-Perf-PayloadBytes') || payloadSize.toString(),
      };
      
      times.push(totalTime);
      payloadSizes.push(payloadSize);
      perfHeaders.push(perfData);
      
      // Pequeña pausa entre requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ Error en ${endpoint.label}:`, error.message);
      return null;
    }
  }
  
  // Calcular mediana
  const sortedTimes = [...times].sort((a, b) => a - b);
  const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
  
  const sortedPayloads = [...payloadSizes].sort((a, b) => a - b);
  const medianPayload = sortedPayloads[Math.floor(sortedPayloads.length / 2)];
  
  // Usar la última medición de perf headers (deberían ser similares)
  const lastPerf = perfHeaders[perfHeaders.length - 1];
  
  return {
    label: endpoint.label,
    path: endpoint.path,
    medianTime,
    medianPayload,
    times,
    payloadSizes,
    perfHeaders: lastPerf,
    success: true,
  };
}

/**
 * Ejecutar escaneo completo
 */
async function runScan() {
  console.log('🔍 Iniciando escaneo de performance de mantenimiento...\n');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Company ID: ${companyId}`);
  console.log(`Endpoints a medir: ${MAINTENANCE_ENDPOINTS.length}`);
  console.log(`Runs por endpoint: ${RUNS}\n`);
  
  const results = [];
  
  for (const endpoint of MAINTENANCE_ENDPOINTS) {
    console.log(`📊 Midiendo: ${endpoint.label}...`);
    const result = await measureEndpoint(endpoint);
    if (result) {
      results.push(result);
      console.log(`   ✅ ${result.medianTime}ms | ${(result.medianPayload / 1024).toFixed(2)}KB`);
      if (result.perfHeaders.total) {
        console.log(`   📈 Perf: Total=${result.perfHeaders.total}ms, DB=${result.perfHeaders.db}ms, Compute=${result.perfHeaders.compute}ms, JSON=${result.perfHeaders.json}ms`);
      }
    } else {
      console.log(`   ❌ Error`);
    }
  }
  
  // Ordenar por tiempo total (mediana)
  results.sort((a, b) => {
    const aTime = parseInt(a.perfHeaders.total) || a.medianTime;
    const bTime = parseInt(b.perfHeaders.total) || b.medianTime;
    return bTime - aTime; // Descendente
  });
  
  // Guardar resultados
  const outputPath = join(__dirname, '..', 'docs', 'audit', 'maintenance', 'PERF_BASELINE.json');
  const output = {
    timestamp: new Date().toISOString(),
    baseUrl,
    companyId,
    runs: RUNS,
    results,
  };
  
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  // Imprimir ranking
  console.log('\n📊 RANKING - Top 10 endpoints más lentos (por X-Perf-Total o tiempo mediano):\n');
  results.slice(0, 10).forEach((result, index) => {
    const totalTime = parseInt(result.perfHeaders.total) || result.medianTime;
    const dbTime = parseInt(result.perfHeaders.db) || 'N/A';
    const computeTime = parseInt(result.perfHeaders.compute) || 'N/A';
    const payloadKB = (result.medianPayload / 1024).toFixed(2);
    
    console.log(`${index + 1}. ${result.label}`);
    console.log(`   Total: ${totalTime}ms | DB: ${dbTime}ms | Compute: ${computeTime}ms | Payload: ${payloadKB}KB`);
    console.log(`   Path: ${result.path}\n`);
  });
  
  console.log(`\n✅ Resultados guardados en: ${outputPath}`);
}

// Ejecutar
runScan().catch(console.error);

