# Plan: Implementar envío de emails para cotizaciones con Resend

## Análisis del Estado Actual

### Lo que ya existe:
- **`lib/ventas/email-service.ts`**: Skeleton con `sendQuoteEmail()`, `sendQuoteReminderEmail()`, `sendQuoteExpiredEmail()` — todas stubbed (solo logs, no envían emails reales)
- **`app/api/ventas/cotizaciones/[id]/enviar/route.ts`**: Ruta POST completa que ya llama a `sendQuoteEmail()` de forma no-bloqueante (línea 157), pero el servicio no envía nada real
- **`app/api/ventas/cotizaciones/[id]/pdf/route.ts`**: Genera HTML imprimible (no un PDF binario) — retorna `text/html`
- **`app/api/cron/process-followups/route.ts`**: CRON job que ya consume `sendQuoteEmail()` para follow-ups automáticos
- **Auditoría**: `logQuoteSent()` ya se llama en la ruta enviar (línea 136) — ya registra el envío
- **Follow-ups**: `scheduleAutoFollowUps()` ya se llama (línea 174)

### Lo que falta:
1. Instalar la dependencia `resend`
2. Reemplazar la implementación stub de `sendQuoteEmail()` por envío real con Resend
3. Implementar `sendQuoteReminderEmail()` y `sendQuoteExpiredEmail()` con envío real
4. Agregar `RESEND_API_KEY` al `.env`
5. Agregar auditoría específica de "email enviado exitosamente" (distinta del `logQuoteSent` que solo registra cambio de estado)
6. Generar PDF como adjunto (el endpoint actual retorna HTML, no un buffer PDF)

### Decisiones de Diseño:
- **No se necesita crear templates HTML separados** — ya existe `generateQuoteEmailHtml()` en el mismo archivo
- **No se necesita modificar la ruta `/enviar`** — ya llama correctamente a `sendQuoteEmail()` en la línea 157
- **El PDF endpoint retorna HTML, no PDF binario** — para adjuntar PDF necesitaríamos usar una librería de rendering (puppeteer, @react-pdf, etc.) o reutilizar jspdf que ya está instalado. **Decisión**: Adjuntar como enlace al portal en lugar de PDF binario (ya implementado), y opcionalmente generar PDF con un servicio externo en el futuro
- **Resend vs Nodemailer**: Usar Resend como indica el usuario (API REST más simple, no necesita configurar SMTP)

---

## Pasos de Implementación

### Paso 1: Instalar dependencia `resend`

```bash
cd project && npm install resend
```

### Paso 2: Agregar variables de entorno

Agregar a `project/.env`:
```
# Email - Resend
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=ventas@orvit.com
```

Y a `project/.env.example` (si existe) para documentación.

### Paso 3: Reescribir `lib/ventas/email-service.ts`

Cambios principales:
1. Importar y configurar `Resend`
2. Crear instancia singleton del cliente Resend
3. Reemplazar el cuerpo de `sendQuoteEmail()`:
   - Validar que `RESEND_API_KEY` esté configurado
   - Si no está configurado: mantener comportamiento actual (log + return success para dev)
   - Si está configurado: enviar email real con `resend.emails.send()`
   - Incluir HTML template existente (`generateQuoteEmailHtml`)
   - Agregar `mensaje` personalizado si se proporciona
   - No adjuntar PDF binario (requiere rendering server-side) — usar enlace al portal
4. Implementar `sendQuoteReminderEmail()` con template de reminder
5. Implementar `sendQuoteExpiredEmail()` con template de expiración
6. Agregar nueva función `logEmailSent()` interna para auditoría de email específica

**Interfaz actualizada de `QuoteEmailData`**:
```typescript
interface QuoteEmailData {
  quoteNumber: string;
  clientName: string;
  clientEmail: string;
  companyName: string;
  total: number;
  moneda: string;
  validUntil: Date | null;
  portalUrl?: string;
  portalToken?: string;
  mensaje?: string;        // NUEVO: mensaje personalizado del vendedor
}
```

**Estructura del archivo reescrito**:
```typescript
import { Resend } from 'resend';

// Singleton
let resendClient: Resend | null = null;
function getResendClient(): Resend | null { ... }

// Templates
function generateQuoteEmailHtml(data: QuoteEmailData): string { ... }      // existente, mejorado
function generateReminderEmailHtml(data: QuoteEmailData): string { ... }   // nuevo
function generateExpiredEmailHtml(data: QuoteEmailData): string { ... }    // nuevo

// Funciones públicas
export async function sendQuoteEmail(data: QuoteEmailData): Promise<EmailResult> { ... }
export async function sendQuoteReminderEmail(data: QuoteEmailData): Promise<EmailResult> { ... }
export async function sendQuoteExpiredEmail(data: QuoteEmailData): Promise<EmailResult> { ... }
```

### Paso 4: Actualizar ruta `/enviar` para pasar `mensaje`

En `app/api/ventas/cotizaciones/[id]/enviar/route.ts` línea 157, agregar el campo `mensaje` al llamado:

```typescript
sendQuoteEmail({
  quoteNumber: cotizacion.numero,
  clientName: cotizacion.client.legalName || cotizacion.client.name || 'Cliente',
  clientEmail: cotizacion.client.email,
  companyName: 'ORVIT',
  total: Number(cotizacion.total),
  moneda: cotizacion.moneda,
  validUntil: cotizacion.fechaValidez,
  portalUrl,
  portalToken: portalAccess.token,
  mensaje,  // <-- AGREGAR: mensaje personalizado del vendedor
}).catch(error => {
  console.error('[Email] Error sending quote email (non-blocking):', error);
});
```

### Paso 5: Agregar auditoría de email enviado

Agregar nueva función helper en `audit-helper.ts`:

```typescript
export async function logQuoteEmailSent(params: {
  quoteId: number;
  companyId: number;
  userId: number;
  clientEmail: string;
  messageId?: string;
}): Promise<void> { ... }
```

Y llamarla desde `sendQuoteEmail()` cuando el envío sea exitoso. **Problema**: el email-service no tiene acceso a `companyId`/`userId`. Opciones:
- **Opción A**: Agregar `companyId` y `userId` a `QuoteEmailData` — **elegida** (mínimo cambio, los datos están disponibles en la ruta)
- **Opción B**: Registrar auditoría desde la ruta, no desde el servicio

### Paso 6: Resolver el TODO del companyName

En la ruta `/enviar` línea 161, reemplazar `'ORVIT'` por el nombre real de la empresa:
- Incluir `company` en la query de Prisma (línea 30)
- Usar `cotizacion.company.name` o `cotizacion.company.legalName`

---

## Archivos a Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `project/package.json` | modificar | Agregar dependencia `resend` |
| `project/.env` | modificar | Agregar `RESEND_API_KEY` |
| `project/lib/ventas/email-service.ts` | **reescribir** | Implementación real con Resend, 3 templates, 3 funciones de envío |
| `project/app/api/ventas/cotizaciones/[id]/enviar/route.ts` | modificar | Pasar `mensaje` y `company.name` al email, incluir company en query |
| `project/lib/ventas/audit-helper.ts` | modificar | Agregar `logQuoteEmailSent()` |
| `project/lib/ventas/audit-config.ts` | modificar | Agregar acción `EMAIL_SENT` al tipo `SalesAuditAction` |

**No se crean archivos nuevos** — se reutiliza y mejora la estructura existente.

---

## Lo que NO se hace (y por qué)

1. **No se genera PDF binario como adjunto**: El endpoint `/pdf` retorna HTML, no un buffer. Generar PDF server-side requiere Puppeteer (pesado para Vercel) o un servicio externo. El enlace al portal ya cumple la función de dar acceso al documento.
2. **No se crean templates en archivos separados** (`lib/email/templates/`): Las funciones `generateXxxEmailHtml()` dentro del mismo archivo son más mantenibles y siguen el patrón existente del codebase.
3. **No se modifica la lógica de transición de estados**: Ya funciona correctamente (BORRADOR → ENVIADA se hace en la transacción, independiente del email).
4. **No se bloquea el envío si el email falla**: El diseño actual (fire-and-forget con `.catch()`) es correcto — el estado ya cambió a ENVIADA en la transacción.

---

## Orden de Ejecución

1. `npm install resend` en `project/`
2. Agregar `RESEND_API_KEY` a `.env`
3. Agregar `EMAIL_SENT` a `audit-config.ts`
4. Agregar `logQuoteEmailSent()` a `audit-helper.ts`
5. Reescribir `email-service.ts` con Resend
6. Actualizar ruta `/enviar` (query include company, pasar mensaje y companyName real)
7. Verificar que el CRON de follow-ups sigue funcionando con la nueva interfaz
