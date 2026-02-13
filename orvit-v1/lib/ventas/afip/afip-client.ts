/**
 * AFIP Web Services Client
 *
 * Cliente para interactuar con Web Services de AFIP:
 * - WSAA: Autenticación y autorización
 * - WSFEv1: Facturación electrónica
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import type {
  AFIPAuth,
  AFIPConfig,
  AFIPComprobante,
  AFIPCAEResponse,
  AFIPUltimoComprobanteResponse,
  AFIPAmbiente,
} from './afip-types';

// ═══════════════════════════════════════════════════════════════════════════════
// URLs de Web Services AFIP
// ═══════════════════════════════════════════════════════════════════════════════

const AFIP_URLS = {
  WSAA: {
    PRODUCCION: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    HOMOLOGACION: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
  },
  WSFE: {
    PRODUCCION: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
    HOMOLOGACION: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// AFIP Client Class
// ═══════════════════════════════════════════════════════════════════════════════

export class AFIPClient {
  private config: AFIPConfig;
  private auth: AFIPAuth | null = null;
  private xmlParser: XMLParser;
  private xmlBuilder: XMLBuilder;

  constructor(config: AFIPConfig) {
    this.config = config;
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    this.xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WSAA - Autenticación
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene token y sign de AFIP
   */
  async authenticate(): Promise<AFIPAuth> {
    // Si ya tenemos auth válido, retornar
    if (this.auth && new Date() < this.auth.expirationTime) {
      return this.auth;
    }

    // 1. Generar TRA (Ticket de Requerimiento de Acceso)
    const tra = this.generateTRA();

    // 2. Firmar TRA con certificado
    const cms = this.signTRA(tra);

    // 3. Enviar a WSAA
    const loginTicket = await this.callWSAA(cms);

    // 4. Parsear respuesta
    this.auth = {
      token: loginTicket.token,
      sign: loginTicket.sign,
      expirationTime: new Date(loginTicket.expirationTime),
    };

    return this.auth;
  }

  /**
   * Genera TRA (Ticket de Requerimiento de Acceso) en XML
   */
  private generateTRA(): string {
    const now = new Date();
    const expirationTime = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 horas

    const tra = {
      loginTicketRequest: {
        '@_version': '1.0',
        header: {
          uniqueId: Math.floor(now.getTime() / 1000),
          generationTime: now.toISOString(),
          expirationTime: expirationTime.toISOString(),
        },
        service: 'wsfe', // Servicio de facturación electrónica
      },
    };

    return this.xmlBuilder.build(tra);
  }

  /**
   * Firma TRA con certificado digital
   */
  private signTRA(tra: string): string {
    try {
      // Leer certificado y clave privada
      const cert = fs.readFileSync(this.config.certPath, 'utf8');
      const key = fs.readFileSync(this.config.keyPath, 'utf8');

      // Crear firma PKCS#7
      const sign = crypto.createSign('SHA256');
      sign.update(tra);
      sign.end();

      const signature = sign.sign(key, 'base64');

      // Construir CMS (Cryptographic Message Syntax)
      const cms = `-----BEGIN PKCS7-----\n${signature}\n-----END PKCS7-----`;

      return cms;
    } catch (error) {
      throw new Error(`Error al firmar TRA: ${error}`);
    }
  }

  /**
   * Llama al servicio WSAA
   */
  private async callWSAA(cms: string): Promise<any> {
    const url = AFIP_URLS.WSAA[this.config.ambiente];

    const soapEnvelope = `
      <?xml version="1.0" encoding="UTF-8"?>
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
        <soapenv:Header/>
        <soapenv:Body>
          <wsaa:loginCms>
            <wsaa:in0>${cms}</wsaa:in0>
          </wsaa:loginCms>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    try {
      const response = await axios.post(url, soapEnvelope, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: '',
        },
      });

      const parsed = this.xmlParser.parse(response.data);
      const loginCmsReturn =
        parsed['soapenv:Envelope']['soapenv:Body']['loginCmsReturn'];

      return {
        token: loginCmsReturn.token,
        sign: loginCmsReturn.sign,
        expirationTime: loginCmsReturn.header.expirationTime,
      };
    } catch (error: any) {
      throw new Error(`Error en WSAA: ${error.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WSFEv1 - Facturación Electrónica
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Solicita autorización de comprobante (CAE)
   */
  async solicitarCAE(comprobante: AFIPComprobante): Promise<AFIPCAEResponse> {
    // Autenticar primero
    const auth = await this.authenticate();

    // Construir SOAP request
    const soapRequest = this.buildCAERequest(auth, comprobante);

    // Enviar a AFIP
    const url = AFIP_URLS.WSFE[this.config.ambiente];

    try {
      const response = await axios.post(url, soapRequest, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'http://ar.gov.afip.dif.FEV1/FECAESolicitar',
        },
      });

      return this.parseCAEResponse(response.data);
    } catch (error: any) {
      throw new Error(`Error al solicitar CAE: ${error.message}`);
    }
  }

  /**
   * Construye request SOAP para solicitar CAE
   */
  private buildCAERequest(auth: AFIPAuth, comprobante: AFIPComprobante): string {
    return `
      <?xml version="1.0" encoding="UTF-8"?>
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
        <soap:Header/>
        <soap:Body>
          <ar:FECAESolicitar>
            <ar:Auth>
              <ar:Token>${auth.token}</ar:Token>
              <ar:Sign>${auth.sign}</ar:Sign>
              <ar:Cuit>${this.config.cuit}</ar:Cuit>
            </ar:Auth>
            <ar:FeCAEReq>
              <ar:FeCabReq>
                <ar:CantReg>1</ar:CantReg>
                <ar:PtoVta>${comprobante.PtoVta}</ar:PtoVta>
                <ar:CbteTipo>${comprobante.CbteTipo}</ar:CbteTipo>
              </ar:FeCabReq>
              <ar:FeDetReq>
                <ar:FECAEDetRequest>
                  <ar:Concepto>${comprobante.Concepto}</ar:Concepto>
                  <ar:DocTipo>${comprobante.DocTipo}</ar:DocTipo>
                  <ar:DocNro>${comprobante.DocNro}</ar:DocNro>
                  <ar:CbteDesde>${comprobante.CbteDesde}</ar:CbteDesde>
                  <ar:CbteHasta>${comprobante.CbteHasta}</ar:CbteHasta>
                  <ar:CbteFch>${comprobante.CbteFch}</ar:CbteFch>
                  <ar:ImpTotal>${comprobante.ImpTotal.toFixed(2)}</ar:ImpTotal>
                  <ar:ImpTotConc>${comprobante.ImpTotConc.toFixed(2)}</ar:ImpTotConc>
                  <ar:ImpNeto>${comprobante.ImpNeto.toFixed(2)}</ar:ImpNeto>
                  <ar:ImpOpEx>${comprobante.ImpOpEx.toFixed(2)}</ar:ImpOpEx>
                  <ar:ImpIVA>${comprobante.ImpIVA.toFixed(2)}</ar:ImpIVA>
                  <ar:ImpTrib>${comprobante.ImpTrib.toFixed(2)}</ar:ImpTrib>
                  <ar:MonId>${comprobante.MonId}</ar:MonId>
                  <ar:MonCotiz>${comprobante.MonCotiz.toFixed(2)}</ar:MonCotiz>
                  ${this.buildIvaXML(comprobante.Iva || [])}
                  ${this.buildTributosXML(comprobante.Tributos || [])}
                  ${this.buildCbtesAsocXML(comprobante.CbtesAsoc || [])}
                </ar:FECAEDetRequest>
              </ar:FeDetReq>
            </ar:FeCAEReq>
          </ar:FECAESolicitar>
        </soap:Body>
      </soap:Envelope>
    `;
  }

  private buildIvaXML(iva: any[]): string {
    if (!iva.length) return '';

    return `
      <ar:Iva>
        ${iva
          .map(
            (item) => `
          <ar:AlicIva>
            <ar:Id>${item.Id}</ar:Id>
            <ar:BaseImp>${item.BaseImp.toFixed(2)}</ar:BaseImp>
            <ar:Importe>${item.Importe.toFixed(2)}</ar:Importe>
          </ar:AlicIva>
        `
          )
          .join('')}
      </ar:Iva>
    `;
  }

  private buildTributosXML(tributos: any[]): string {
    if (!tributos.length) return '';

    return `
      <ar:Tributos>
        ${tributos
          .map(
            (item) => `
          <ar:Tributo>
            <ar:Id>${item.Id}</ar:Id>
            <ar:Desc>${item.Desc}</ar:Desc>
            <ar:BaseImp>${item.BaseImp.toFixed(2)}</ar:BaseImp>
            <ar:Alic>${item.Alic.toFixed(2)}</ar:Alic>
            <ar:Importe>${item.Importe.toFixed(2)}</ar:Importe>
          </ar:Tributo>
        `
          )
          .join('')}
      </ar:Tributos>
    `;
  }

  private buildCbtesAsocXML(cbtes: any[]): string {
    if (!cbtes.length) return '';

    return `
      <ar:CbtesAsoc>
        ${cbtes
          .map(
            (item) => `
          <ar:CbteAsoc>
            <ar:Tipo>${item.Tipo}</ar:Tipo>
            <ar:PtoVta>${item.PtoVta}</ar:PtoVta>
            <ar:Nro>${item.Nro}</ar:Nro>
          </ar:CbteAsoc>
        `
          )
          .join('')}
      </ar:CbtesAsoc>
    `;
  }

  /**
   * Parsea respuesta de solicitud de CAE
   */
  private parseCAEResponse(xml: string): AFIPCAEResponse {
    const parsed = this.xmlParser.parse(xml);
    const body = parsed['soap:Envelope']['soap:Body'];
    const response = body['FECAESolicitarResponse']['FECAESolicitarResult'];

    const detResponse = response.FeDetResp?.FECAEDetResponse;

    if (!detResponse) {
      throw new Error('Respuesta inválida de AFIP');
    }

    return {
      CAE: detResponse.CAE || '',
      CAEFchVto: detResponse.CAEFchVto || '',
      CbteFch: detResponse.CbteFch || '',
      Resultado: detResponse.Resultado || 'R',
      Observaciones: detResponse.Observaciones?.Obs
        ? Array.isArray(detResponse.Observaciones.Obs)
          ? detResponse.Observaciones.Obs
          : [detResponse.Observaciones.Obs]
        : [],
      Errors: response.Errors?.Err
        ? Array.isArray(response.Errors.Err)
          ? response.Errors.Err
          : [response.Errors.Err]
        : [],
    };
  }

  /**
   * Consulta último comprobante autorizado
   */
  async consultarUltimoComprobante(
    puntoVenta: number,
    tipoComprobante: number
  ): Promise<number> {
    const auth = await this.authenticate();

    const soapRequest = `
      <?xml version="1.0" encoding="UTF-8"?>
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
        <soap:Header/>
        <soap:Body>
          <ar:FECompUltimoAutorizado>
            <ar:Auth>
              <ar:Token>${auth.token}</ar:Token>
              <ar:Sign>${auth.sign}</ar:Sign>
              <ar:Cuit>${this.config.cuit}</ar:Cuit>
            </ar:Auth>
            <ar:PtoVta>${puntoVenta}</ar:PtoVta>
            <ar:CbteTipo>${tipoComprobante}</ar:CbteTipo>
          </ar:FECompUltimoAutorizado>
        </soap:Body>
      </soap:Envelope>
    `;

    const url = AFIP_URLS.WSFE[this.config.ambiente];

    try {
      const response = await axios.post(url, soapRequest, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado',
        },
      });

      const parsed = this.xmlParser.parse(response.data);
      const body = parsed['soap:Envelope']['soap:Body'];
      const result = body['FECompUltimoAutorizadoResponse']['FECompUltimoAutorizadoResult'];

      return parseInt(result.CbteNro || '0', 10);
    } catch (error: any) {
      throw new Error(`Error al consultar último comprobante: ${error.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crea instancia de cliente AFIP desde configuración de empresa
 */
export async function createAFIPClient(companyId: number): Promise<AFIPClient> {
  // En producción, estos datos vendrían de IntegrationConfig
  const config: AFIPConfig = {
    cuit: process.env.AFIP_CUIT || '',
    certPath: process.env.AFIP_CERT_PATH || '',
    keyPath: process.env.AFIP_KEY_PATH || '',
    ambiente: (process.env.AFIP_AMBIENTE as AFIPAmbiente) || 'HOMOLOGACION',
    puntoVenta: parseInt(process.env.AFIP_PUNTO_VENTA || '1', 10),
  };

  return new AFIPClient(config);
}
