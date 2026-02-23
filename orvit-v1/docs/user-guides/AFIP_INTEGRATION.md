# Integración AFIP - Facturación Electrónica Argentina

## 📋 Estado Actual

### ✅ Lo que ya existe

El sistema está **preparado** para integración AFIP con:

- **Campos en Base de Datos**: `cae`, `fechaVtoCae`, `estadoAFIP`, `afipRetries`, `afipError`, `afipResponse`
- **Enum AFIPStatus**: `PENDING_AFIP`, `AUTHORIZED`, `REJECTED`
- **PDF AFIP-Compliant**: QR Code, barcode, formato legal
- **Cron Job Simulado**: `/api/cron/afip-pending` (actualmente simula autorización)
- **Idempotency**: Sistema para prevenir duplicados

### ❌ Lo que FALTA implementar

- **Autenticación con AFIP** (Login CMS)
- **Certificado digital** (.crt) y clave privada (.key)
- **Web Services AFIP** (WSFEv1)
- **Solicitar CAE real**
- **Consultar comprobantes**
- **Manejo de errores AFIP**

---

## 🏗️ Arquitectura Propuesta

```
lib/afip/
├── wsfe-client.ts          # Cliente Web Services AFIP
├── auth.ts                 # Autenticación CMS
├── certificate-manager.ts  # Manejo de certificados
├── types.ts                # Tipos TypeScript
└── error-handler.ts        # Errores AFIP

app/api/afip/
├── auth/route.ts           # Login AFIP
├── solicitar-cae/route.ts  # Solicitar CAE
├── consultar/route.ts      # Consultar comprobante
└── parametros/route.ts     # Parámetros AFIP
```

---

## 📝 Paso a Paso para Implementar

### **PASO 1: Obtener Certificado AFIP**

1. Generar clave privada y CSR:
   ```bash
   openssl genrsa -out afip.key 2048
   openssl req -new -key afip.key -out afip.csr \
     -subj "/C=AR/O=TU_EMPRESA/CN=TU_CUIT/serialNumber=CUIT TU_CUIT"
   ```

2. Ingresar a [AFIP con clave fiscal](https://www.afip.gob.ar)
   - Sistema Registrado > Administrador de Relaciones
   - Adherir servicio "Factura Electrónica - Comprobantes en Línea"
   - Subir CSR y descargar certificado (.crt)

3. Guardar en variables de entorno:
   ```env
   AFIP_CERT_PATH=/path/to/afip.crt
   AFIP_KEY_PATH=/path/to/afip.key
   AFIP_CUIT=20123456789
   AFIP_ENVIRONMENT=homologacion # o "produccion"
   ```

---

### **PASO 2: Instalar Dependencias**

```bash
npm install soap xml2js
npm install -D @types/soap
```

**Alternativa recomendada**: Usar SDK oficial
```bash
npm install @afipsdk/afip.js
```

---

### **PASO 3: Crear Cliente WSFE**

Crear `lib/afip/wsfe-client.ts`:

```typescript
import soap from 'soap';
import fs from 'fs';
import { parseString } from 'xml2js';

const WSAA_URL = process.env.AFIP_ENVIRONMENT === 'produccion'
  ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl'
  : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl';

const WSFE_URL = process.env.AFIP_ENVIRONMENT === 'produccion'
  ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?wsdl'
  : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?wsdl';

export class WSFEClient {
  private token: string | null = null;
  private sign: string | null = null;
  private tokenExpiry: Date | null = null;

  async authenticate(): Promise<void> {
    // 1. Generar TRA (Ticket de Requerimiento de Acceso)
    const tra = this.generateTRA();

    // 2. Firmar TRA con certificado
    const cms = this.signTRA(tra);

    // 3. Solicitar token y sign a WSAA
    const client = await soap.createClientAsync(WSAA_URL);
    const result = await client.loginCmsAsync({ in0: cms });

    // 4. Parsear respuesta XML
    const credentials = await this.parseCredentials(result[0].loginCmsReturn);

    this.token = credentials.token;
    this.sign = credentials.sign;
    this.tokenExpiry = new Date(credentials.expirationTime);
  }

  async solicitarCAE(invoice: InvoiceCAERequest): Promise<CAEResponse> {
    // Verificar token válido
    if (!this.token || !this.tokenExpiry || new Date() > this.tokenExpiry) {
      await this.authenticate();
    }

    const client = await soap.createClientAsync(WSFE_URL);

    const request = {
      Auth: {
        Token: this.token,
        Sign: this.sign,
        Cuit: process.env.AFIP_CUIT,
      },
      FeCAEReq: {
        FeCabReq: {
          CantReg: 1,
          PtoVta: invoice.puntoVenta,
          CbteTipo: invoice.tipoComprobante, // 1=FA, 6=FB, 11=FC
        },
        FeDetReq: {
          FECAEDetRequest: {
            Concepto: 1, // 1=Productos, 2=Servicios, 3=Ambos
            DocTipo: 80, // 80=CUIT
            DocNro: invoice.clientCuit,
            CbteDesde: invoice.numero,
            CbteHasta: invoice.numero,
            CbteFch: this.formatDate(invoice.fecha),
            ImpTotal: invoice.total,
            ImpTotConc: 0, // No gravado
            ImpNeto: invoice.netoGravado,
            ImpOpEx: invoice.exento || 0,
            ImpIVA: invoice.iva21 + invoice.iva105 + invoice.iva27,
            ImpTrib: invoice.percepciones || 0,
            FchServDesde: this.formatDate(invoice.fecha),
            FchServHasta: this.formatDate(invoice.fecha),
            FchVtoPago: this.formatDate(invoice.fechaVencimiento),
            MonId: 'PES',
            MonCotiz: 1,
            Iva: this.buildIvaArray(invoice),
          },
        },
      },
    };

    const result = await client.FECAESolicitarAsync(request);
    return this.parseCAEResponse(result);
  }

  async consultarComprobante(
    puntoVenta: number,
    tipoComprobante: number,
    numero: number
  ): Promise<any> {
    if (!this.token || !this.tokenExpiry || new Date() > this.tokenExpiry) {
      await this.authenticate();
    }

    const client = await soap.createClientAsync(WSFE_URL);

    const request = {
      Auth: {
        Token: this.token,
        Sign: this.sign,
        Cuit: process.env.AFIP_CUIT,
      },
      FeCompConsReq: {
        PtoVta: puntoVenta,
        CbteTipo: tipoComprobante,
        CbteNro: numero,
      },
    };

    const result = await client.FECompConsultarAsync(request);
    return result;
  }

  private generateTRA(): string {
    const now = new Date();
    const expiration = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 horas

    return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Date.now()}</uniqueId>
    <generationTime>${now.toISOString()}</generationTime>
    <expirationTime>${expiration.toISOString()}</expirationTime>
  </header>
  <service>wsfe</service>
</loginTicketRequest>`;
  }

  private signTRA(tra: string): string {
    const { execSync } = require('child_process');
    const certPath = process.env.AFIP_CERT_PATH!;
    const keyPath = process.env.AFIP_KEY_PATH!;

    // Escribir TRA a archivo temporal
    fs.writeFileSync('/tmp/tra.xml', tra);

    // Firmar con OpenSSL
    const cmd = `openssl smime -sign -in /tmp/tra.xml -signer ${certPath} -inkey ${keyPath} -outform DER -out /tmp/tra.cms`;
    execSync(cmd);

    // Leer CMS en base64
    const cms = fs.readFileSync('/tmp/tra.cms', 'base64');

    // Limpiar temporales
    fs.unlinkSync('/tmp/tra.xml');
    fs.unlinkSync('/tmp/tra.cms');

    return cms;
  }

  private async parseCredentials(xml: string): Promise<any> {
    return new Promise((resolve, reject) => {
      parseString(xml, (err, result) => {
        if (err) reject(err);
        else resolve({
          token: result.loginTicketResponse.credentials[0].token[0],
          sign: result.loginTicketResponse.credentials[0].sign[0],
          expirationTime: result.loginTicketResponse.header[0].expirationTime[0],
        });
      });
    });
  }

  private parseCAEResponse(result: any): CAEResponse {
    const feDetResp = result.FECAESolicitarResult.FeDetResp.FECAEDetResponse[0];

    if (feDetResp.Resultado === 'R') {
      // Rechazado
      throw new Error(
        `AFIP rechazó la solicitud: ${feDetResp.Observaciones?.Obs.map((o: any) => o.Msg).join(', ')}`
      );
    }

    return {
      cae: feDetResp.CAE,
      fechaVtoCae: this.parseAFIPDate(feDetResp.CAEFchVto),
      resultado: feDetResp.Resultado,
      observaciones: feDetResp.Observaciones,
    };
  }

  private buildIvaArray(invoice: InvoiceCAERequest): any[] {
    const iva: any[] = [];

    if (invoice.iva21 > 0) {
      iva.push({ AlicIva: { Id: 5, BaseImp: invoice.netoGravado, Importe: invoice.iva21 } });
    }

    if (invoice.iva105 > 0) {
      iva.push({ AlicIva: { Id: 4, BaseImp: invoice.netoGravado, Importe: invoice.iva105 } });
    }

    if (invoice.iva27 > 0) {
      iva.push({ AlicIva: { Id: 6, BaseImp: invoice.netoGravado, Importe: invoice.iva27 } });
    }

    return iva;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  private parseAFIPDate(dateStr: string): Date {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return new Date(`${year}-${month}-${day}`);
  }
}

export interface InvoiceCAERequest {
  puntoVenta: number;
  tipoComprobante: number;
  numero: number;
  fecha: Date;
  fechaVencimiento: Date;
  clientCuit: string;
  netoGravado: number;
  iva21: number;
  iva105: number;
  iva27: number;
  exento?: number;
  percepciones?: number;
  total: number;
}

export interface CAEResponse {
  cae: string;
  fechaVtoCae: Date;
  resultado: string;
  observaciones?: any;
}
```

---

### **PASO 4: Actualizar Cron Job**

Reemplazar simulación en `/app/api/cron/afip-pending/route.ts`:

```typescript
import { WSFEClient } from '@/lib/afip/wsfe-client';

// Reemplazar líneas 60-70 (simulación) con:

const wsfe = new WSFEClient();

try {
  const caeResponse = await wsfe.solicitarCAE({
    puntoVenta: parseInt(invoice.puntoVenta),
    tipoComprobante: invoice.tipoComprobante,
    numero: parseInt(invoice.numero),
    fecha: new Date(invoice.fechaEmision),
    fechaVencimiento: new Date(invoice.fechaVencimiento),
    clientCuit: invoice.client.cuit,
    netoGravado: parseFloat(invoice.netoGravado.toString()),
    iva21: parseFloat((invoice.iva21 || 0).toString()),
    iva105: parseFloat((invoice.iva105 || 0).toString()),
    iva27: parseFloat((invoice.iva27 || 0).toString()),
    total: parseFloat(invoice.total.toString()),
  });

  // Actualizar factura con CAE real
  await prisma.salesInvoice.update({
    where: { id: invoice.id },
    data: {
      cae: caeResponse.cae,
      fechaVtoCae: caeResponse.fechaVtoCae,
      estadoAFIP: 'AUTHORIZED',
      afipResponse: JSON.stringify(caeResponse),
    },
  });
} catch (error) {
  // Manejar error AFIP
  await prisma.salesInvoice.update({
    where: { id: invoice.id },
    data: {
      estadoAFIP: 'REJECTED',
      afipError: error.message,
      afipRetries: invoice.afipRetries + 1,
    },
  });
}
```

---

## 🧪 Testing

### Ambiente de Homologación AFIP

1. **CUIT de prueba**: 20111111112
2. **Certificado**: Solicitar en ambiente de homologación
3. **URLs**: Usar `wsaahomo` y `wswhomo`

### Comprobantes de prueba

```typescript
// Factura A de prueba
const testInvoice = {
  puntoVenta: 1,
  tipoComprobante: 1, // FA
  numero: 1,
  clientCuit: '20222222223',
  netoGravado: 1000,
  iva21: 210,
  total: 1210,
};
```

---

## 📚 Recursos

- [AFIP Web Services Documentación](https://www.afip.gob.ar/ws/)
- [Manual WSFEv1](https://www.afip.gob.ar/fe/documentos/manual_desarrollador_COMPG_v2_10.pdf)
- [Tipos de Comprobante](https://www.afip.gob.ar/fe/documentos/TABLAS%20DE%20REFERENCIA%20TIPOS%20COMPROBANTE%20V1.xlsx)
- [SDK Node.js Recomendado](https://github.com/AfipSDK/afip.js)

---

## ⚠️ Consideraciones de Producción

1. **Seguridad**:
   - Certificados NUNCA en el repositorio
   - Usar AWS Secrets Manager o similar
   - Renovar certificados antes de expiración (6-12 meses)

2. **Performance**:
   - Cachear tokens (12 horas validez)
   - Queue para procesar en lotes
   - Retry con exponential backoff

3. **Monitoreo**:
   - Alertas si CAE falla > 5%
   - Log todas las solicitudes AFIP
   - Dashboard de facturas pendientes

4. **Compliance**:
   - Backup de CAE obtenidos
   - Libro IVA Ventas automatizado
   - Reportes SIRE mensuales

---

## 🚀 Próximos Pasos

1. ✅ Obtener certificado AFIP
2. ✅ Implementar `WSFEClient`
3. ✅ Actualizar cron job
4. ✅ Testing en homologación
5. ✅ Deploy a producción
6. ✅ Monitoreo activo

**Tiempo estimado**: 5-7 días con certificado en mano
