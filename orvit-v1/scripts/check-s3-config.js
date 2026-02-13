const path = require('path');
const fs = require('fs');

// Buscar el archivo .env en diferentes ubicaciones
const possiblePaths = [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../../.env'),
  '.env'
];

let envLoaded = false;
for (const envPath of possiblePaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log(`✅ Archivo .env encontrado en: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.log('⚠️ No se encontró archivo .env, usando variables de entorno del sistema');
}
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

console.log('🔍 Verificando configuración de AWS S3...\n');

// Verificar variables de entorno
const requiredEnvVars = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID', 
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET'
];

console.log('📋 Variables de entorno requeridas:');
let allVarsPresent = true;

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  const isPresent = !!value;
  const displayValue = isPresent ? '✅ Presente' : '❌ Faltante';
  
  console.log(`  ${varName}: ${displayValue}`);
  
  if (!isPresent) {
    allVarsPresent = false;
  }
});

console.log('\n');

if (!allVarsPresent) {
  console.log('❌ Faltan variables de entorno para S3');
  console.log('\n📝 Para configurar S3, crea un archivo .env en la raíz del proyecto con:');
  console.log(`
AWS_REGION=tu_region
AWS_ACCESS_KEY_ID=tu_access_key_id
AWS_SECRET_ACCESS_KEY=tu_secret_access_key
AWS_S3_BUCKET=tu_bucket_name
  `);
  console.log('\n🔗 Obtén estas credenciales desde: https://console.aws.amazon.com/iam/');
  process.exit(1);
}

// Intentar conectar a S3
console.log('🔗 Probando conexión a S3...');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function testS3Connection() {
  try {
    const command = new ListBucketsCommand({});
    const response = await s3.send(command);
    
    console.log('✅ Conexión a S3 exitosa');
    console.log(`📦 Buckets disponibles: ${response.Buckets?.length || 0}`);
    
    if (response.Buckets) {
      response.Buckets.forEach(bucket => {
        console.log(`  - ${bucket.Name} (creado: ${bucket.CreationDate})`);
      });
    }
    
    // Verificar si el bucket especificado existe
    const targetBucket = process.env.AWS_S3_BUCKET;
    const bucketExists = response.Buckets?.some(bucket => bucket.Name === targetBucket);
    
    if (bucketExists) {
      console.log(`\n✅ El bucket "${targetBucket}" existe`);
    } else {
      console.log(`\n⚠️ El bucket "${targetBucket}" no existe`);
      console.log('📝 Crea el bucket en: https://console.aws.amazon.com/s3/');
    }
    
  } catch (error) {
    console.log('❌ Error conectando a S3:', error.message);
    console.log('\n🔧 Posibles soluciones:');
    console.log('1. Verifica que las credenciales sean correctas');
    console.log('2. Asegúrate de que el usuario tenga permisos de S3');
    console.log('3. Verifica que la región sea correcta');
    process.exit(1);
  }
}

testS3Connection(); 