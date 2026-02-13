# Script para ejecutar verificación diaria de alertas de impuestos
# Configurar en Windows Task Scheduler para ejecutar diariamente a las 8:00 AM

# Configuración
$API_URL = "http://localhost:3000/api/tax-alerts/daily-check"
$CRON_SECRET = "mawir-tax-alerts-secret-2025"

# Headers para autenticación
$headers = @{
    "Authorization" = "Bearer $CRON_SECRET"
    "Content-Type" = "application/json"
}

try {
    Write-Host "🔔 Iniciando verificación diaria de alertas de impuestos..." -ForegroundColor Cyan
    
    # Ejecutar verificación diaria
    $response = Invoke-RestMethod -Uri $API_URL -Method Post -Headers $headers
    
    if ($response.success) {
        Write-Host "✅ Verificación completada exitosamente" -ForegroundColor Green
        Write-Host "📊 Total de notificaciones enviadas: $($response.totalNotificationsSent)" -ForegroundColor Yellow
        Write-Host "🏢 Empresas procesadas: $($response.companiesProcessed)" -ForegroundColor Yellow
        
        # Mostrar detalles por empresa
        if ($response.results) {
            Write-Host "`n📋 Detalles por empresa:" -ForegroundColor Cyan
            foreach ($result in $response.results) {
                Write-Host "  • $($result.companyName): $($result.notificationsSent) notificaciones" -ForegroundColor White
                Write-Host "    - Vencen mañana: $($result.taxesDueTomorrow)" -ForegroundColor Blue
                Write-Host "    - Alertas recurrentes: $($result.recurringAlerts)" -ForegroundColor Magenta
                Write-Host "    - Vencidos: $($result.overdueTaxes)" -ForegroundColor Red
            }
        }
        
        Write-Host "`n🎉 Proceso completado exitosamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Error en la verificación: $($response.error)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Error al ejecutar verificación de alertas:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    # Intentar con URL de producción si localhost falla
    if ($API_URL -like "*localhost*") {
        Write-Host "`n🔄 Intentando con URL de producción..." -ForegroundColor Yellow
        $PROD_URL = "https://tu-dominio.vercel.app/api/tax-alerts/daily-check"
        try {
            $response = Invoke-RestMethod -Uri $PROD_URL -Method Post -Headers $headers
            Write-Host "✅ Verificación en producción completada" -ForegroundColor Green
        } catch {
            Write-Host "❌ Error también en producción: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Pausa para ver los resultados
Write-Host "`nPresiona cualquier tecla para continuar..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")