# ⚡ INSTRUCCIONES PARA EJECUTAR TODO

## PASO 1: DETENER DEV SERVER

```bash
# En la terminal donde corre npm run dev, presiona:
Ctrl + C
```

## PASO 2: EJECUTAR MIGRACIONES

```bash
cd "c:\Users\maart\OneDrive\Escritorio\Mawir"

# Regenerar Prisma Client
npm run prisma:generate

# Aplicar migración de workflows de ventas
npx prisma db execute --file prisma/migrations/add_sales_workflow_config.sql --schema prisma/schema.prisma

# Aplicar migración de configuraciones completas
npx prisma db execute --file prisma/migrations/add_complete_erp_config.sql --schema prisma/schema.prisma

# Verificar que todo se aplicó
npx prisma db pull
```

## PASO 3: REINICIAR DEV SERVER

```bash
npm run dev
```

## PASO 4: PROBAR CONFIGURACIÓN

### 4.1 Configuración de Ventas
1. Ir a: http://localhost:3000/administracion/ventas/configuracion
2. Probar cada sección:
   - ✅ Workflows (aprobaciónde pagos, enforcement levels)
   - ✅ Módulos (habilitar/deshabilitar)
   - ✅ Entregas (requisitos de conductor/vehículo)
   - ✅ Notificaciones (emails, eventos)
3. Guardar y verificar que persiste

### 4.2 Validar T2
1. Agregar `?viewMode=T2` a cualquier endpoint:
   ```
   http://localhost:3000/api/ventas/vendedores?viewMode=T2
   ```
2. Verificar que filtra correctamente
3. Probar en varios endpoints:
   - `/api/ventas/comprobantes?viewMode=T2`
   - `/api/ventas/turnos?viewMode=T2`
   - `/api/ventas/zonas?viewMode=T2`

### 4.3 Verificar Nuevas Tablas
```sql
-- Conectar a PostgreSQL
psql -U [tu_usuario] -d [tu_database]

-- Verificar tablas nuevas
\dt purchase_config
\dt treasury_config
\dt general_config
\dt integration_config
\dt ai_config

-- Verificar columnas nuevas en sales_config
\d sales_config

-- Deberías ver:
-- - requiere_aprobacion_pagos
-- - requiere_aprobacion_facturas
-- - nivel_enforcement_credito
-- - nivel_enforcement_stock
-- - modulo_*_habilitado (varios)
```

## PASO 5: IMPLEMENTAR FUNCIONALIDADES CRÍTICAS

### 5.1 Facturación Electrónica AFIP (CRÍTICO)

**Archivos a crear**:
```
lib/ventas/afip/
├── afip-client.ts          # Cliente AFIP (WSAA, WSFEv1)
├── afip-auth.ts            # Autenticación (Login CMS)
├── afip-types.ts           # Tipos TypeScript
└── afip-helpers.ts         # Helpers (validación CUIT, etc.)

app/api/ventas/afip/
├── auth/route.ts           # Login AFIP
├── cae/route.ts            # Solicitar CAE
└── consultas/route.ts      # Consultar comprobantes

components/ventas/afip/
├── afip-config-form.tsx    # Configuración AFIP
└── afip-authorization-button.tsx # Botón autorizar factura
```

**Librerías necesarias**:
```bash
npm install @afipsdk/afip.js
# o
npm install axios xml2js
```

**Proceso**:
1. Upload certificado .crt y .key de AFIP
2. Autenticación con WSAA (Login CMS)
3. Solicitar CAE en WSFEv1
4. Actualizar factura con CAE y fecha vencimiento

### 5.2 Invoice OCR (Quick Win)

**Archivos a crear**:
```
lib/ai/
├── ocr-processor.ts        # Procesa PDFs con OCR
├── invoice-parser.ts       # Extrae datos estructurados
└── invoice-matcher.ts      # Hace matching con OC

app/api/compras/facturas/ocr/route.ts  # Upload + proceso OCR

components/compras/
└── invoice-ocr-uploader.tsx # UI para upload
```

**Librerías**:
```bash
npm install openai pdf-parse
```

**Código ejemplo**:
```typescript
// lib/ai/ocr-processor.ts
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';

export async function extractInvoiceData(pdfBuffer: Buffer) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Extraer texto del PDF
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text;

  // Usar GPT-4 para estructurar
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'system',
      content: 'Eres un experto en extraer datos de facturas argentinas. Devuelve JSON con: cuit, fecha, numero, items, total.'
    }, {
      role: 'user',
      content: `Extrae los datos de esta factura:\n\n${text}`
    }],
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}
```

### 5.3 Chatbot Básico

**Archivos a crear**:
```
lib/ai/
├── chatbot.ts              # Lógica del chatbot
└── function-tools.ts       # Tools para GPT-4

app/api/chat/route.ts       # Endpoint de chat

components/portal/
└── chatbot-widget.tsx      # Widget flotante
```

**Código ejemplo**:
```typescript
// lib/ai/chatbot.ts
import OpenAI from 'openai';

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_order_status',
      description: 'Obtiene estado de orden de venta',
      parameters: {
        type: 'object',
        properties: {
          order_number: { type: 'string' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_client_balance',
      description: 'Obtiene saldo de cuenta corriente'
    }
  }
];

export async function chatWithAI(message: string, clientId: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'Eres un asistente de atención al cliente. Responde consultas sobre órdenes, facturas y saldos.'
      },
      { role: 'user', content: message }
    ],
    tools: tools
  });

  // Si AI decidió llamar función:
  if (response.choices[0].message.tool_calls) {
    const toolCall = response.choices[0].message.tool_calls[0];
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    if (functionName === 'get_order_status') {
      const order = await getOrderStatus(args.order_number);
      return `Su pedido ${order.numero} está ${order.estado}`;
    }
  }

  return response.choices[0].message.content;
}
```

## PASO 6: CONFIGURAR IA

### 6.1 Obtener API Key de OpenAI
1. Ir a: https://platform.openai.com/api-keys
2. Crear nueva API key
3. Agregar a `.env`:
   ```
   OPENAI_API_KEY=sk-...
   ```

### 6.2 Habilitar IA en Configuración
1. Crear registro en `ai_config`:
   ```sql
   INSERT INTO ai_config (company_id, ai_provider, ai_api_key, ai_model)
   VALUES (1, 'OPENAI', 'sk-...', 'gpt-4');
   ```
2. Habilitar módulos:
   ```sql
   UPDATE ai_config
   SET ai_invoice_ocr = true,
       ai_chatbot = true,
       ai_fraud_detection = true
   WHERE company_id = 1;
   ```

## PASO 7: TESTING

### 7.1 Test de Configuración
```bash
# Probar endpoint de configuración
curl http://localhost:3000/api/ventas/configuracion \
  -H "Cookie: token=..." \
  | jq

# Debería retornar config con todos los campos nuevos
```

### 7.2 Test de T2
```bash
# Sin ViewMode (default S/T1)
curl http://localhost:3000/api/ventas/vendedores \
  -H "Cookie: token=..."

# Con ViewMode T2
curl "http://localhost:3000/api/ventas/vendedores?viewMode=T2" \
  -H "Cookie: token=..."
```

### 7.3 Test de IA (cuando implementes)
```bash
# Test OCR
curl -X POST http://localhost:3000/api/compras/facturas/ocr \
  -H "Cookie: token=..." \
  -F "file=@factura.pdf"

# Test Chatbot
curl -X POST http://localhost:3000/api/chat \
  -H "Cookie: token=..." \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Cuál es el estado de mi pedido 12345?", "clientId": "123"}'
```

## PASO 8: DEPLOYMENT

### 8.1 Pre-deployment Checklist
- ✅ Todas las migraciones ejecutadas
- ✅ Prisma Client regenerado
- ✅ Tests pasando
- ✅ Variables de entorno configuradas (.env.production)
- ✅ Build exitoso

### 8.2 Build Production
```bash
npm run build

# Verificar que no hay errores
# Debería completar sin warnings críticos
```

### 8.3 Deploy
```bash
# Si usas Vercel
vercel --prod

# Si usas otro hosting
npm run start  # En servidor de producción
```

## PASO 9: MONITOREO POST-DEPLOY

### 9.1 Verificar Salud del Sistema
```bash
# Check endpoints críticos
curl https://tu-dominio.com/api/health
curl https://tu-dominio.com/api/ventas/configuracion
```

### 9.2 Monitorear Logs
```bash
# Si usas PM2
pm2 logs

# Si usas Docker
docker logs -f container_name

# Buscar errores
grep -i "error" logs/app.log
```

### 9.3 Métricas de IA (cuando implementes)
```sql
-- Verificar uso de IA
SELECT
  COUNT(*) as total_requests,
  AVG(processing_time_ms) as avg_time,
  COUNT(*) FILTER (WHERE success = true) as successful
FROM ai_requests
WHERE created_at > NOW() - INTERVAL '24 hours';
```

## PASO 10: CAPACITACIÓN DE USUARIOS

### 10.1 Configuración
1. Mostrar a admin cómo configurar workflows
2. Explicar diferencia entre enforcement levels
3. Habilitar módulos que necesiten

### 10.2 Nuevas Funcionalidades
1. Aprobación de pagos
2. Módulos habilitables
3. Notificaciones configurables

## RESUMEN DE COMANDOS RÁPIDOS

```bash
# MIGRACIÓN COMPLETA
npm run prisma:generate
npx prisma db execute --file prisma/migrations/add_sales_workflow_config.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/add_complete_erp_config.sql --schema prisma/schema.prisma
npm run dev

# VERIFICACIÓN
psql -U user -d db -c "\d sales_config"
psql -U user -d db -c "\dt *config"

# TEST
curl http://localhost:3000/api/ventas/configuracion -H "Cookie: token=..." | jq
```

## TROUBLESHOOTING

### Error: "Column already exists"
```sql
-- Verificar si columna existe
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'sales_config'
AND column_name = 'requiere_aprobacion_pagos';

-- Si existe, skip esa línea del SQL
```

### Error: "Prisma Client out of sync"
```bash
npm run prisma:generate
# Restart dev server
```

### Error: "Type 'XXX' is not assignable"
```bash
# Limpiar y regenerar
rm -rf node_modules/.prisma
npm run prisma:generate
```

## ¿NECESITAS AYUDA?

- 📖 Documentación completa en: `RESUMEN_IMPLEMENTACION_COMPLETA.md`
- 🤖 Ideas de IA en: `IDEAS_IA_ERP.md`
- 📊 Análisis de gaps en: Output del agente (50 funcionalidades)

**¡TODO LISTO PARA EJECUTAR! 🚀**
