/**
 * Script para programar verificaciones automáticas de impuestos
 * Este script puede ser ejecutado por un cron job o scheduler externo
 * 
 * Ejemplo de uso con cron:
 * 0 9 * * * node scripts/tax-control-scheduler.js
 * (Ejecuta todos los días a las 9:00 AM)
 */

const https = require('https');
const http = require('http');

// Configuración
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const ENDPOINT = '/api/tax-control/daily-check';

/**
 * Ejecuta la verificación diaria de impuestos
 */
async function runDailyCheck() {
  const url = `${API_BASE_URL}${ENDPOINT}`;
  
  console.log(`🕐 [${new Date().toISOString()}] Iniciando verificación diaria de impuestos...`);
  console.log(`📡 Llamando a: ${url}`);

  try {
    const response = await makeRequest(url, 'POST');
    
    if (response.success) {
      console.log('✅ Verificación completada exitosamente');
      console.log(`📊 Resumen:`);
      console.log(`   - Empresas verificadas: ${response.summary.companiesChecked}`);
      console.log(`   - Impuestos verificados: ${response.summary.totalTaxControlsChecked}`);
      console.log(`   - Notificaciones enviadas: ${response.summary.totalNotificationsSent}`);
      console.log(`   - Errores: ${response.summary.totalErrors}`);
      
      if (response.details && response.details.length > 0) {
        console.log('\n📋 Detalles por empresa:');
        response.details.forEach(detail => {
          console.log(`   ${detail.companyName}: ${detail.taxControlsChecked} impuestos, ${detail.notificationsSent} notificaciones`);
        });
      }
    } else {
      console.error('❌ Error en la verificación:', response.error);
      if (response.details) {
        console.error('Detalles del error:', response.details);
      }
    }
  } catch (error) {
    console.error('❌ Error ejecutando verificación diaria:', error.message);
    process.exit(1);
  }
}

/**
 * Realiza una petición HTTP/HTTPS
 */
function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TaxControlScheduler/1.0'
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = client.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (error) {
          reject(new Error(`Error parsing response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Verifica que el endpoint esté disponible
 */
async function checkEndpointHealth() {
  const url = `${API_BASE_URL}${ENDPOINT}`;
  
  try {
    console.log('🔍 Verificando disponibilidad del endpoint...');
    const response = await makeRequest(url, 'GET');
    
    if (response.message) {
      console.log('✅ Endpoint disponible:', response.message);
      return true;
    } else {
      console.error('❌ Respuesta inesperada del endpoint');
      return false;
    }
  } catch (error) {
    console.error('❌ Endpoint no disponible:', error.message);
    return false;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 Tax Control Scheduler iniciado');
  console.log(`📅 Fecha: ${new Date().toLocaleString()}`);
  console.log(`🌐 API Base URL: ${API_BASE_URL}`);
  
  // Verificar que el endpoint esté disponible
  const isHealthy = await checkEndpointHealth();
  
  if (!isHealthy) {
    console.error('❌ No se puede continuar: endpoint no disponible');
    process.exit(1);
  }
  
  // Ejecutar verificación diaria
  await runDailyCheck();
  
  console.log('🏁 Tax Control Scheduler completado');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = {
  runDailyCheck,
  checkEndpointHealth,
  makeRequest
};
