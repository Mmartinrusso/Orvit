#!/usr/bin/env node

/**
 * Script de escaneo de performance para endpoints top
 * 
 * Uso:
 *   node scripts/perf-scan.mjs [--token TOKEN] [--base-url URL]
 * 
 * Ejemplos:
 *   node scripts/perf-scan.mjs
 *   node scripts/perf-scan.mjs --token "eyJhbGc..." --base-url "http://localhost:3000"
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const DEFAULT_COMPANY_ID = '1';
const DEFAULT_MONTH = new Date().toISOString().slice(0, 7); // YYYY-MM

// Parse args
const args = process.argv.slice(2);
let token = null;
let baseUrl = BASE_URL;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--token' && args[i + 1]) {
    token = args[i + 1];
    i++;
  } else if (args[i] === '--base-url' && args[i + 1]) {
    baseUrl = args[i + 1];
    i++;
  }
}

// Lista de endpoints top a medir
const TOP_ENDPOINTS = [
  {
    path: '/api/core/bootstrap',
    params: {},
    label: 'Core Bootstrap',
    requiresAuth: true,
  },
  {
    path: '/api/dashboard/metrics',
    params: { companyId: DEFAULT_COMPANY_ID, month: DEFAULT_MONTH },
    label: 'Dashboard Metrics',
    requiresAuth: true,
  },
  {
    path: '/api/dashboard/top-products',
    params: { companyId: DEFAULT_COMPANY_ID, month: DEFAULT_MONTH, limit: '50' },
    label: 'Dashboard Top Products',
    requiresAuth: true,
  },
  {
    path: '/api/maintenance/dashboard',
    params: { companyId: DEFAULT_COMPANY_ID, pageSize: '50' },
    label: 'Maintenance Dashboard',
    requiresAuth: true,
  },
  {
    path: '/api/tasks',
    params: { companyId: DEFAULT_COMPANY_ID },
    label: 'Tasks',
    requiresAuth: true,
  },
  {
    path: '/api/tool-requests',
    params: { companyId: DEFAULT_COMPANY_ID },
    label: 'Tool Requests',
    requiresAuth: true,
  },
  {
    path: '/api/tax-base',
    params: { companyId: DEFAULT_COMPANY_ID },
    label: 'Tax Base',
    requiresAuth: true,
  },
  {
    path: '/api/tax-record',
    params: { companyId: DEFAULT_COMPANY_ID, month: DEFAULT_MONTH },
    label: 'Tax Record',
    requiresAuth: true,
  },
  {
    path: '/api/costos/categorias',
    params: { companyId: DEFAULT_COMPANY_ID },
    label: 'Costos Categorias',
    requiresAuth: true,
  },
  {
    path: '/api/costos/historial',
    params: { companyId: DEFAULT_COMPANY_ID },
    label: 'Costos Historial',
    requiresAuth: true,
  },
  {
    path: '/api/calculadora-costos-final',
    params: { companyId: DEFAULT_COMPANY_ID, productionMonth: DEFAULT_MONTH, distributionMethod: 'production' },
    label: 'Calculadora Costos Final',
    requiresAuth: true,
  },
  {
    path: '/api/admin/catalogs',
    params: { companyId: DEFAULT_COMPANY_ID },
    label: 'Admin Catalogs',
    requiresAuth: true,
  },
];

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function buildUrl(endpoint) {
  const url = new URL(endpoint.path, baseUrl);
  
  // Agregar params
  Object.entries(endpoint.params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  
  // Agregar debug y noCache
  url.searchParams.set('debug', '1');
  url.searchParams.set('noCache', '1');
  
  return url.toString();
}

async function measureRequest(url, runNumber) {
  const startTime = Date.now();
  
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Cookie'] = `token=${token}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const perfHeaders = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('x-perf-')) {
        perfHeaders[key.toLowerCase()] = value;
      }
    });
    
    let body = null;
    try {
      body = await response.json();
    } catch (e) {
      // Ignorar errores de parse JSON
    }
    
    const payloadBytes = body ? JSON.stringify(body).length : 0;
    
    return {
      run: runNumber,
      status: response.status,
      duration,
      total: parseFloat(perfHeaders['x-perf-total'] || duration),
      parse: parseFloat(perfHeaders['x-perf-parse'] || 0),
      db: parseFloat(perfHeaders['x-perf-db'] || 0),
      compute: parseFloat(perfHeaders['x-perf-compute'] || 0),
      json: parseFloat(perfHeaders['x-perf-json'] || 0),
      payloadBytes: parseInt(perfHeaders['x-perf-payloadbytes'] || payloadBytes),
      success: response.ok,
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      run: runNumber,
      status: 0,
      duration: endTime - startTime,
      error: error.message,
      success: false,
    };
  }
}

async function scanEndpoint(endpoint, runs = 5) {
  const url = buildUrl(endpoint);
  const results = [];
  
  process.stdout.write(`  ${endpoint.label}... `);
  
  for (let i = 1; i <= runs; i++) {
    const result = await measureRequest(url, i);
    results.push(result);
    
    if (!result.success && i === 1) {
      // Si el primer run falla, no continuar
      process.stdout.write(`❌ (${result.error || `Status ${result.status}`})\n`);
      return null;
    }
    
    // Pequeña pausa entre requests
    if (i < runs) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  const successfulRuns = results.filter(r => r.success);
  if (successfulRuns.length === 0) {
    process.stdout.write(`❌ (no successful runs)\n`);
    return null;
  }
  
  // Calcular estadísticas
  const totals = successfulRuns.map(r => r.total).filter(v => !isNaN(v));
  const dbs = successfulRuns.map(r => r.db).filter(v => !isNaN(v) && v > 0);
  const computes = successfulRuns.map(r => r.compute).filter(v => !isNaN(v) && v > 0);
  const jsons = successfulRuns.map(r => r.json).filter(v => !isNaN(v) && v > 0);
  const payloads = successfulRuns.map(r => r.payloadBytes).filter(v => !isNaN(v) && v > 0);
  
  const stats = {
    runs: successfulRuns.length,
    median: {
      total: median(totals),
      parse: median(successfulRuns.map(r => r.parse).filter(v => !isNaN(v))),
      db: dbs.length > 0 ? median(dbs) : 0,
      compute: computes.length > 0 ? median(computes) : 0,
      json: jsons.length > 0 ? median(jsons) : 0,
      payloadBytes: payloads.length > 0 ? median(payloads) : 0,
    },
    p95: {
      total: totals.length > 0 ? percentile(totals, 95) : 0,
      db: dbs.length > 0 ? percentile(dbs, 95) : 0,
      compute: computes.length > 0 ? percentile(computes, 95) : 0,
    },
    p99: {
      total: totals.length > 0 ? percentile(totals, 99) : 0,
      db: dbs.length > 0 ? percentile(dbs, 99) : 0,
      compute: computes.length > 0 ? percentile(computes, 99) : 0,
    },
  };
  
  process.stdout.write(`✅ (${stats.median.total.toFixed(0)}ms)\n`);
  
  return {
    path: endpoint.path,
    params: endpoint.params,
    label: endpoint.label,
    ...stats,
  };
}

async function main() {
  console.log('🚀 Performance Scan - Top Endpoints\n');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Runs per endpoint: 5`);
  console.log(`Mode: debug=1&noCache=1\n`);
  
  if (!token) {
    console.log('⚠️  No token provided. Some endpoints may fail.\n');
    console.log('   Tip: Use --token "YOUR_TOKEN" or set cookie in browser and copy it.\n');
  }
  
  console.log('📊 Scanning endpoints...\n');
  
  const results = [];
  
  for (const endpoint of TOP_ENDPOINTS) {
    const result = await scanEndpoint(endpoint, 5);
    if (result) {
      results.push(result);
    }
  }
  
  if (results.length === 0) {
    console.log('\n❌ No endpoints were successfully scanned.');
    process.exit(1);
  }
  
  // Ordenar por total time
  const sortedByTotal = [...results].sort((a, b) => b.median.total - a.median.total);
  const sortedByCompute = [...results].sort((a, b) => b.median.compute - a.median.compute);
  const sortedByPayload = [...results].sort((a, b) => b.median.payloadBytes - a.median.payloadBytes);
  
  // Imprimir rankings
  console.log('\n' + '='.repeat(80));
  console.log('📈 Top 10 Endpoints by Total Time (X-Perf-Total)');
  console.log('='.repeat(80));
  sortedByTotal.slice(0, 10).forEach((r, i) => {
    const db = r.median.db > 0 ? `DB: ${r.median.db.toFixed(0)}ms` : '';
    const compute = r.median.compute > 0 ? `Compute: ${r.median.compute.toFixed(0)}ms` : '';
    const payload = (r.median.payloadBytes / 1024).toFixed(1);
    console.log(`${(i + 1).toString().padStart(2)}. ${r.label.padEnd(35)} ${r.median.total.toFixed(0).padStart(6)}ms  ${db}  ${compute}  ${payload}KB`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('⚙️  Top 10 Endpoints by Compute Time (X-Perf-Compute)');
  console.log('='.repeat(80));
  sortedByCompute.filter(r => r.median.compute > 0).slice(0, 10).forEach((r, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${r.label.padEnd(35)} ${r.median.compute.toFixed(0).padStart(6)}ms`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('📦 Top 10 Endpoints by Payload Size (X-Perf-PayloadBytes)');
  console.log('='.repeat(80));
  sortedByPayload.filter(r => r.median.payloadBytes > 0).slice(0, 10).forEach((r, i) => {
    const kb = (r.median.payloadBytes / 1024).toFixed(1);
    console.log(`${(i + 1).toString().padStart(2)}. ${r.label.padEnd(35)} ${kb.padStart(8)}KB`);
  });
  
  // Guardar baseline
  const baseline = {
    timestamp: new Date().toISOString(),
    baseUrl,
    endpoints: results,
  };
  
  const outputPath = join(__dirname, '..', 'docs', 'audit', 'PERF_BASELINE.json');
  writeFileSync(outputPath, JSON.stringify(baseline, null, 2));
  
  console.log('\n' + '='.repeat(80));
  console.log(`✅ Results saved to: ${outputPath}`);
  console.log('='.repeat(80) + '\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

