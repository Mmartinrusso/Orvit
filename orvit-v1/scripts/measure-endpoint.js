#!/usr/bin/env node

/**
 * Script de medición de performance para endpoints
 * 
 * Uso:
 *   node scripts/measure-endpoint.js <endpoint> [companyId] [productionMonth]
 * 
 * Ejemplos:
 *   node scripts/measure-endpoint.js /api/costos/categorias 1
 *   node scripts/measure-endpoint.js /api/calculadora-costos-final 1 2025-08
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
}

function parseHeaders(headers) {
  const parsed = {};
  headers.forEach((value, key) => {
    parsed[key.toLowerCase()] = value;
  });
  return parsed;
}

async function measureRequest(url, runNumber) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const headers = parseHeaders(response.headers);
    const perfHeaders = {
      total: headers['x-perf-total'],
      parse: headers['x-perf-parse'],
      db: headers['x-perf-db'],
      compute: headers['x-perf-compute'],
      json: headers['x-perf-json'],
      payloadBytes: headers['x-perf-payloadbytes'],
      cache: headers['x-cache'] || headers['cache-control'],
    };
    
    const body = await response.json().catch(() => ({}));
    
    return {
      run: runNumber,
      status: response.status,
      duration,
      perfHeaders,
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

async function runScenario(name, url, runs, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${label}: ${name}`);
  console.log(`🔗 URL: ${url}`);
  console.log(`🔄 Runs: ${runs}`);
  console.log(`${'='.repeat(60)}\n`);
  
  const results = [];
  
  for (let i = 1; i <= runs; i++) {
    process.stdout.write(`⏳ Run ${i}/${runs}... `);
    const result = await measureRequest(url, i);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${result.duration}ms`);
      if (result.perfHeaders.total) {
        console.log(`   X-Perf-Total: ${result.perfHeaders.total}ms`);
      }
    } else {
      console.log(`❌ ${result.error || `Status ${result.status}`}`);
    }
    
    // Pequeña pausa entre requests
    if (i < runs) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Calcular estadísticas
  const successfulRuns = results.filter(r => r.success);
  if (successfulRuns.length === 0) {
    console.log('\n⚠️  No se completaron requests exitosos');
    return;
  }
  
  const durations = successfulRuns.map(r => r.duration);
  const totalTimes = successfulRuns
    .map(r => parseFloat(r.perfHeaders.total || r.duration))
    .filter(v => !isNaN(v));
  
  console.log(`\n📈 Estadísticas:`);
  console.log(`   Exitosos: ${successfulRuns.length}/${runs}`);
  console.log(`   Duración total (mediana): ${median(durations)}ms`);
  
  if (totalTimes.length > 0) {
    console.log(`   X-Perf-Total (mediana): ${median(totalTimes)}ms`);
    
    const firstWithPerf = successfulRuns.find(r => r.perfHeaders.total);
    if (firstWithPerf && firstWithPerf.perfHeaders) {
      const ph = firstWithPerf.perfHeaders;
      console.log(`\n   📊 Métricas de Performance (última run):`);
      if (ph.parse) console.log(`      X-Perf-Parse: ${ph.parse}ms`);
      if (ph.db) console.log(`      X-Perf-DB: ${ph.db}ms`);
      if (ph.compute) console.log(`      X-Perf-Compute: ${ph.compute}ms`);
      if (ph.json) console.log(`      X-Perf-JSON: ${ph.json}ms`);
      if (ph.payloadBytes) {
        const kb = (parseInt(ph.payloadBytes) / 1024).toFixed(2);
        console.log(`      X-Perf-PayloadBytes: ${ph.payloadBytes} bytes (${kb} KB)`);
      }
    }
    
    // Cache info
    if (firstWithPerf.perfHeaders.cache) {
      const cacheHeader = firstWithPerf.perfHeaders.cache;
      if (cacheHeader.includes('HIT')) {
        console.log(`   🟢 Cache: HIT`);
      } else if (cacheHeader.includes('MISS')) {
        console.log(`   🔴 Cache: MISS`);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('❌ Uso: node scripts/measure-endpoint.js <endpoint> [companyId] [productionMonth]');
    console.error('\nEjemplos:');
    console.error('  node scripts/measure-endpoint.js /api/costos/categorias 1');
    console.error('  node scripts/measure-endpoint.js /api/calculadora-costos-final 1 2025-08');
    process.exit(1);
  }
  
  const endpoint = args[0].startsWith('/') ? args[0] : `/${args[0]}`;
  const companyId = args[1] || '1';
  const productionMonth = args[2];
  
  // Construir URL base
  let baseUrl = `${BASE_URL}${endpoint}?companyId=${companyId}`;
  if (productionMonth) {
    baseUrl += `&productionMonth=${productionMonth}`;
  }
  
  // Escenario A: debug=1&noCache=1, 5 runs
  const urlA = `${baseUrl}&debug=1&noCache=1`;
  await runScenario(
    'Escenario A',
    urlA,
    5,
    '🔍 DEBUG + NO CACHE'
  );
  
  // Escenario B: 2 runs sin noCache
  const urlB = `${baseUrl}&debug=1`;
  await runScenario(
    'Escenario B',
    urlB,
    2,
    '🔍 DEBUG (con cache si está disponible)'
  );
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Mediciones completadas');
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

