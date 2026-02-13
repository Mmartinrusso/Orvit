/**
 * Script para arreglar todos los JWT secrets hardcoded en los endpoints de la API
 *
 * Uso: node scripts/fix-jwt-secrets.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patrón para encontrar todos los archivos route.ts en app/api
const pattern = 'app/api/**/route.ts';

// Texto a buscar y reemplazar
const oldPattern = /const JWT_SECRET = new TextEncoder\(\)\.encode\(\s*process\.env\.JWT_SECRET \|\| ['"]tu-clave-secreta-super-segura['"]\s*\);?/g;

const newImport = "import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret";
const newDeclaration = "const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);";

// Contador de archivos modificados
let filesFixed = 0;
let filesSkipped = 0;

console.log('🔍 Buscando archivos route.ts con JWT secret hardcoded...\n');

// Buscar todos los archivos
const files = glob.sync(pattern, { cwd: process.cwd() });

console.log(`📁 Encontrados ${files.length} archivos route.ts\n`);

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Verificar si el archivo tiene el patrón incorrecto
  if (content.includes("'tu-clave-secreta-super-segura'") || content.includes('"tu-clave-secreta-super-segura"')) {
    console.log(`🔧 Arreglando: ${file}`);

    // 1. Agregar import si no existe
    if (!content.includes("import { JWT_SECRET } from '@/lib/auth'")) {
      // Buscar la última línea de imports
      const importLines = content.match(/^import .+$/gm);
      if (importLines) {
        const lastImport = importLines[importLines.length - 1];
        content = content.replace(lastImport, `${lastImport}\n${newImport}`);
      }
    }

    // 2. Reemplazar la declaración de JWT_SECRET
    content = content.replace(oldPattern, newDeclaration);

    // 3. Reemplazar todas las referencias de JWT_SECRET por JWT_SECRET_KEY en jwtVerify
    content = content.replace(/jwtVerify\(([^,]+),\s*JWT_SECRET\)/g, 'jwtVerify($1, JWT_SECRET_KEY)');

    // Guardar el archivo
    fs.writeFileSync(filePath, content, 'utf8');
    filesFixed++;
  } else {
    filesSkipped++;
  }
});

console.log('\n✅ Proceso completado:');
console.log(`   📝 Archivos arreglados: ${filesFixed}`);
console.log(`   ⏭️  Archivos sin cambios: ${filesSkipped}`);
console.log('\n⚠️  IMPORTANTE: Reinicia el servidor (npm run dev) para que los cambios tomen efecto.\n');
