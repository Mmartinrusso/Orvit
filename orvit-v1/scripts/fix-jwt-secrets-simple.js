/**
 * Script simple para arreglar JWT secrets hardcoded
 * NO requiere dependencias externas
 */

const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else if (file === 'route.ts') {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

const apiDir = path.join(__dirname, '..', 'app', 'api');
const files = getAllFiles(apiDir);

console.log(`\n🔍 Encontrados ${files.length} archivos route.ts\n`);

let filesFixed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;

  // Verificar si tiene el problema
  if (content.includes("'tu-clave-secreta-super-segura'") || content.includes('"tu-clave-secreta-super-segura"')) {
    const relativePath = path.relative(process.cwd(), file);
    console.log(`🔧 ${relativePath}`);

    // 1. Agregar import si no existe
    if (!content.includes("import { JWT_SECRET } from '@/lib/auth'")) {
      // Encontrar el último import
      const lines = content.split('\n');
      let lastImportIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          lastImportIndex = i;
        }
      }

      if (lastImportIndex >= 0) {
        lines.splice(lastImportIndex + 1, 0, "import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret");
        content = lines.join('\n');
      }
    }

    // 2. Reemplazar la declaración de JWT_SECRET
    content = content.replace(
      /const JWT_SECRET = new TextEncoder\(\)\.encode\(\s*process\.env\.JWT_SECRET \|\| ['"]tu-clave-secreta-super-segura['"]\s*\);?/g,
      'const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);'
    );

    // 3. Reemplazar todas las referencias en jwtVerify
    content = content.replace(/jwtVerify\(([^,]+),\s*JWT_SECRET\)/g, 'jwtVerify($1, JWT_SECRET_KEY)');

    // Solo escribir si hubo cambios
    if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      filesFixed++;
    }
  }
});

console.log(`\n✅ Archivos arreglados: ${filesFixed}`);
console.log('\n⚠️  IMPORTANTE: Reinicia el servidor para aplicar cambios\n');
