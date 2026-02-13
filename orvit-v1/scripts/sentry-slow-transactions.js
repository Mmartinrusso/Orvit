#!/usr/bin/env node

/**
 * Script para consultar la API de Sentry y obtener las transacciones http.server más lentas
 * 
 * Uso:
 *   npm run sentry:slow
 * 
 * Requiere variables de entorno:
 *   - SENTRY_AUTH_TOKEN: Token de autenticación de Sentry
 *   - SENTRY_ORG_SLUG: Slug de la organización en Sentry
 */

// Cargar variables de entorno desde .env.local o .env
try {
  require('dotenv').config({ path: '.env.local' });
  require('dotenv').config(); // Fallback a .env si .env.local no existe
} catch (error) {
  // dotenv es opcional - las variables pueden estar ya en el entorno
  // (por ejemplo, cuando Next.js ya las carga)
}

// Verificar variables de entorno requeridas
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG_SLUG = process.env.SENTRY_ORG_SLUG;

if (!SENTRY_AUTH_TOKEN) {
  console.error('❌ Error: SENTRY_AUTH_TOKEN no está definida');
  console.error('   Por favor, agrega SENTRY_AUTH_TOKEN a tu archivo .env.local o .env');
  process.exit(1);
}

if (!SENTRY_ORG_SLUG) {
  console.error('❌ Error: SENTRY_ORG_SLUG no está definida');
  console.error('   Por favor, agrega SENTRY_ORG_SLUG a tu archivo .env.local o .env');
  process.exit(1);
}

// Construir URL de la API de Sentry
const baseUrl = 'https://sentry.io/api/0/organizations';
const url = new URL(`${baseUrl}/${SENTRY_ORG_SLUG}/events/`);

// Agregar parámetros de consulta
url.searchParams.set('statsPeriod', '24h');
url.searchParams.append('field', 'transaction');
url.searchParams.append('field', 'avg(transaction.duration)');
url.searchParams.append('field', 'p95(transaction.duration)');
url.searchParams.append('field', 'count()');
url.searchParams.set('query', 'transaction.op:http.server');
url.searchParams.set('sort', '-p95(transaction.duration)');
url.searchParams.set('per_page', '50');

// Función para hacer la petición a la API
async function fetchSlowTransactions() {
  try {
    console.log('📡 Consultando API de Sentry...\n');
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error al consultar Sentry API: ${response.status} ${response.statusText}`);
      console.error(`   Respuesta: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();

    // Procesar los datos
    const rows = data.data.map((row) => {
      const avgDuration = row['avg(transaction.duration)'] || 0;
      const p95Duration = row['p95(transaction.duration)'] || 0;
      const count = row['count()'] || 0;

      return {
        transaction: row.transaction || 'N/A',
        avg_ms: Math.round(avgDuration * 1000), // Convertir de segundos a milisegundos
        p95_ms: Math.round(p95Duration * 1000), // Convertir de segundos a milisegundos
        count: count,
      };
    });

    // Mostrar tabla en consola
    console.log('📊 Top 50 transacciones http.server más lentas (últimas 24h):\n');
    console.table(rows);

    // Mostrar JSON para copiar y pegar
    console.log('\n📋 JSON para pegar en Claude/ChatGPT:\n');
    console.log(JSON.stringify(rows, null, 2));

  } catch (error) {
    console.error('❌ Error inesperado:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar el script
fetchSlowTransactions();

