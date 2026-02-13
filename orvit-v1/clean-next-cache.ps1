# Script para limpiar el caché de Next.js
Write-Host "🧹 Limpiando caché de Next.js..." -ForegroundColor Yellow

# Eliminar carpeta .next
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "✅ Carpeta .next eliminada" -ForegroundColor Green
} else {
    Write-Host "ℹ️  La carpeta .next no existe" -ForegroundColor Cyan
}

# Eliminar node_modules/.cache si existe
if (Test-Path "node_modules/.cache") {
    Remove-Item -Recurse -Force "node_modules/.cache"
    Write-Host "✅ Caché de node_modules eliminado" -ForegroundColor Green
}

Write-Host "`n✨ Limpieza completada. Ahora ejecuta: npm run dev" -ForegroundColor Green

