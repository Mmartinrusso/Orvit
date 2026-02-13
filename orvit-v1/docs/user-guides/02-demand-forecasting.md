# Guía de Uso - Demand Forecasting (Predicción de Demanda)

## ¿Qué es Demand Forecasting?

El sistema de predicción de demanda usa Machine Learning para estimar cuántas unidades de un producto se venderán en el futuro (7-90 días adelante).

## Beneficios

- 📉 **Reduce inventario** en 30% (capital liberado)
- 📈 **Reduce quiebres de stock** en 50%
- 🎯 **Precisión** del 70-90%
- ⚡ **Alertas automáticas** de productos con riesgo
- 💰 **ROI** de $60,000 USD/año (empresa mediana)

## Cómo Usarlo

### 1. Generar Forecast para un Producto

1. Ir a `/ai/demand-forecast`
2. Ingresar ID del producto (ejemplo: 1, 2, 3...)
3. Click "Generar Forecast"
4. Esperar 5-10 segundos
5. Ver gráfico con predicción

### 2. Interpretar Resultados

El sistema muestra:

**Stock Actual**: Tu inventario hoy
**Demanda Promedio**: Unidades vendidas por día en promedio
**Punto de Reorden**: Cuando llegues a este stock, debes ordenar más
**Riesgo de Quiebre**: LOW/MEDIUM/HIGH

#### Riesgo Bajo (Verde)
- Stock suficiente para más de 2 semanas
- No requiere acción inmediata
- Monitorear semanalmente

#### Riesgo Medio (Amarillo)
- Stock para 7-14 días
- Planificar pedido en 2-3 días
- Revisar forecast nuevamente

#### Riesgo Alto (Rojo)
- Stock para menos de 7 días
- **ACCIÓN INMEDIATA REQUERIDA**
- Generar orden de compra YA

### 3. Gráficos

**Línea Azul**: Demanda estimada día a día
**Área Verde**: Stock proyectado
**Línea Naranja**: Punto de reorden recomendado

Si el área verde toca cero = QUIEBRE DE STOCK proyectado

### 4. Recomendaciones

El sistema te sugiere:

1. **Cuándo ordenar**: Punto de reorden
2. **Cuánto ordenar**: Cantidad económica (EOQ)
3. **Urgencia**: Días hasta quiebre

## Auto-Reorden

### ¿Qué es?

El sistema analiza TODOS tus productos y te dice cuáles necesitan reposición urgente.

### Cómo Usarlo

1. Ir a `/ai/demand-forecast`
2. Tab "Auto-Reorden"
3. Click "Generar Sugerencias"
4. Ver lista de productos críticos

### Niveles de Urgencia

🔴 **CRÍTICO**: Quiebre en ≤3 días - ORDENAR HOY
🟠 **ALTO**: Quiebre en 4-7 días - ORDENAR ESTA SEMANA
🟡 **MEDIO**: Stock bajo pero no crítico - PLANIFICAR
🔵 **BAJO**: Monitorear

## Patrones Estacionales

Si el sistema detecta que un producto se vende más ciertos días, verás:

📊 **Patrón semanal detectado**
**Días pico**: Viernes, Sábado

Esto significa: aumentar stock antes de esos días.

## Nivel de Confianza

Cada predicción tiene un nivel de confianza (0-100%):

- **80-100%**: Alta confianza, datos consistentes
- **60-80%**: Confianza media, revisar manualmente
- **<60%**: Baja confianza, esperar más datos históricos

## Frecuencia Recomendada

**Productos de alta rotación**: Generar forecast cada 3 días
**Productos de rotación media**: Generar forecast semanal
**Productos de baja rotación**: Generar forecast mensual

## Troubleshooting

### "No hay datos históricos suficientes"

**Causa**: Producto muy nuevo o sin ventas recientes
**Solución**:
- Esperar al menos 2 semanas de ventas
- Usar promedio de productos similares
- Pedido manual

### Predicción parece incorrecta

**Posibles causas**:
- Promoción reciente que distorsiona el promedio
- Cambio de mercado
- Estacionalidad no detectada

**Solución**: Revisar manualmente y ajustar cantidad

### Confianza muy baja

**Causa**: Ventas muy irregulares
**Solución**:
- Aumentar días de historial
- Agrupar productos similares
- Usar stock de seguridad mayor

## Mejores Prácticas

✅ **Generar forecast regularmente** (no esperar a tener stock bajo)
✅ **Revisar alertas diarias** de auto-reorden
✅ **Validar predicciones** especialmente al inicio
✅ **Ajustar parámetros** según tu experiencia
✅ **Combinar con conocimiento** del mercado

❌ **NO ignorar** alertas de riesgo alto
❌ **NO confiar 100%** en forecasts con confianza <60%
❌ **NO usar** para productos nuevos sin historial

## Soporte

Si tienes dudas sobre los forecasts, contacta a tu gerente de operaciones o soporte técnico.
