/**
 * Tests for Email Cotizaciones Feature
 *
 * Covers:
 * 1. email-service.ts: escapeHtml, templates, sendQuoteEmail (all variants), getDomainFromEnv, lazy client
 * 2. audit-config.ts: EMAIL_SENT action config, buildSalesHumanMessage for EMAIL_SENT
 * 3. audit-helper.ts: logQuoteEmailSent function
 * 4. enviar/route.ts: integration logic (static analysis)
 * 5. package.json & .env verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ─── Mock resend ────────────────────────────────────────────────────────────

const mockSend = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

// ─── Mock prisma ────────────────────────────────────────────────────────────

const mockSalesAuditLogCreate = vi.fn().mockResolvedValue({});
vi.mock('../project/lib/prisma', () => ({
  prisma: {
    salesAuditLog: {
      create: (...args: unknown[]) => mockSalesAuditLogCreate(...args),
    },
  },
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import {
  sendQuoteEmail,
  sendQuoteReminderEmail,
  sendQuoteExpiredEmail,
  type QuoteEmailData,
} from '../project/lib/ventas/email-service';

import {
  SALES_ACCION_CONFIG,
  buildSalesHumanMessage,
  type SalesAuditAction,
} from '../project/lib/ventas/audit-config';

import { logQuoteEmailSent } from '../project/lib/ventas/audit-helper';

// ─── Test Data ──────────────────────────────────────────────────────────────

const baseQuoteData: QuoteEmailData = {
  quoteNumber: 'COT-2024-001',
  clientName: 'Acme Corp',
  clientEmail: 'acme@example.com',
  companyName: 'Mi Empresa SA',
  total: 15000.5,
  moneda: 'ARS',
  validUntil: new Date('2025-06-30'),
  portalUrl: 'https://app.example.com/portal/cotizaciones/COT-2024-001?token=abc123',
  portalToken: 'abc123',
  mensaje: 'Adjuntamos la cotización solicitada.',
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. EMAIL SERVICE - Dev Fallback (no RESEND_API_KEY)
// ═══════════════════════════════════════════════════════════════════════════

describe('email-service.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
  });

  describe('XSS protection (escapeHtml)', () => {
    it('should handle malicious client name without error', async () => {
      const result = await sendQuoteEmail({
        ...baseQuoteData,
        clientName: '<script>alert("xss")</script>',
      });
      expect(result.success).toBe(true);
    });

    it('should handle malicious quote number without error', async () => {
      const result = await sendQuoteEmail({
        ...baseQuoteData,
        quoteNumber: '"><img src=x onerror=alert(1)>',
      });
      expect(result.success).toBe(true);
    });

    it('should handle malicious message with special chars', async () => {
      const result = await sendQuoteEmail({
        ...baseQuoteData,
        mensaje: '<script>document.cookie</script> & "quotes" \'single\'',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('dev fallback when RESEND_API_KEY not set', () => {
    it('sendQuoteEmail returns dev fallback', async () => {
      const result = await sendQuoteEmail(baseQuoteData);
      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-/);
      expect(result.error).toContain('RESEND_API_KEY not configured');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('sendQuoteReminderEmail returns dev fallback', async () => {
      const result = await sendQuoteReminderEmail(baseQuoteData);
      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-reminder-/);
      expect(result.error).toContain('RESEND_API_KEY not configured');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('sendQuoteExpiredEmail returns dev fallback', async () => {
      const result = await sendQuoteExpiredEmail(baseQuoteData);
      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-expired-/);
      expect(result.error).toContain('RESEND_API_KEY not configured');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('EmailResult interface contract', () => {
    it('sendQuoteEmail always returns success boolean', async () => {
      const result = await sendQuoteEmail(baseQuoteData);
      expect(typeof result.success).toBe('boolean');
      expect(result.messageId).toBeDefined();
    });

    it('sendQuoteReminderEmail always returns success boolean', async () => {
      const result = await sendQuoteReminderEmail(baseQuoteData);
      expect(typeof result.success).toBe('boolean');
    });

    it('sendQuoteExpiredEmail always returns success boolean', async () => {
      const result = await sendQuoteExpiredEmail(baseQuoteData);
      expect(typeof result.success).toBe('boolean');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. EMAIL SERVICE - Source code static analysis
//    (templates, escapeHtml, getDomainFromEnv verified via code inspection)
// ═══════════════════════════════════════════════════════════════════════════

describe('email-service.ts - source code analysis', () => {
  const srcPath = path.resolve(__dirname, '../project/lib/ventas/email-service.ts');
  let src: string;

  beforeEach(() => {
    src = fs.readFileSync(srcPath, 'utf-8');
  });

  describe('escapeHtml function', () => {
    it('should escape & < > " \' characters', () => {
      expect(src).toContain(".replace(/&/g, '&amp;')");
      expect(src).toContain(".replace(/</g, '&lt;')");
      expect(src).toContain(".replace(/>/g, '&gt;')");
      expect(src).toContain(".replace(/\"/g, '&quot;')");
      expect(src).toContain(".replace(/'/g, '&#39;')");
    });

    it('should apply escapeHtml to user-controlled fields in templates', () => {
      // Check that escapeHtml is called on client-provided data
      expect(src).toContain('escapeHtml(data.quoteNumber)');
      expect(src).toContain('escapeHtml(data.clientName)');
      expect(src).toContain('escapeHtml(data.companyName)');
      expect(src).toContain('escapeHtml(data.moneda)');
      expect(src).toContain('escapeHtml(data.mensaje)');
    });

    it('should escape portalUrl in href attribute', () => {
      expect(src).toContain('escapeHtml(data.portalUrl)');
    });
  });

  describe('quote email template', () => {
    it('should generate valid HTML with DOCTYPE', () => {
      expect(src).toContain('<!DOCTYPE html>');
      expect(src).toContain('<html lang="es">');
    });

    it('should show "Sin vencimiento" for null validUntil', () => {
      expect(src).toContain("'Sin vencimiento'");
    });

    it('should show default message when mensaje is not provided', () => {
      expect(src).toContain('Nos complace enviarle la cotización solicitada');
    });

    it('should conditionally render portal link', () => {
      expect(src).toContain('data.portalUrl ?');
      expect(src).toContain('Ver Cotización');
    });
  });

  describe('reminder email template', () => {
    it('should show "pronto" for null validUntil in reminder', () => {
      // In generateReminderEmailHtml, null validUntil => "pronto"
      expect(src).toMatch(/validUntil[\s\S]*?'pronto'/);
    });

    it('should include "Recordatorio" in template title', () => {
      expect(src).toContain('Recordatorio de Cotización');
    });
  });

  describe('expired email template', () => {
    it('should indicate conditions are no longer valid', () => {
      expect(src).toContain('ya no están vigentes');
    });

    it('should suggest generating a new quote', () => {
      expect(src).toContain('nueva cotización');
    });
  });

  describe('getDomainFromEnv', () => {
    it('should extract hostname from NEXT_PUBLIC_APP_URL', () => {
      expect(src).toContain("process.env.NEXT_PUBLIC_APP_URL || ''");
      expect(src).toContain('url.hostname');
    });

    it('should fallback to orvit.com on invalid URL', () => {
      expect(src).toContain("return 'orvit.com'");
    });
  });

  describe('Resend integration', () => {
    it('should use lazy initialization for Resend client', () => {
      expect(src).toContain('let resendClient: Resend | null = null');
      expect(src).toContain('function getResendClient()');
    });

    it('should construct from address with company name', () => {
      expect(src).toContain('`${data.companyName} <ventas@${getDomainFromEnv()}>`');
    });

    it('should include email recipients as array', () => {
      expect(src).toContain('to: [data.clientEmail]');
    });

    it('should handle Resend API errors gracefully', () => {
      expect(src).toContain('if (error)');
      expect(src).toContain('success: false');
      expect(src).toContain('error.message');
    });

    it('should catch exceptions and return Unknown error for non-Error types', () => {
      expect(src).toContain("error instanceof Error ? error.message : 'Unknown error'");
    });

    it('should include correct subject for each email type', () => {
      expect(src).toContain('`Cotización ${data.quoteNumber} - ${data.companyName}`');
      expect(src).toContain('`Recordatorio: Cotización ${data.quoteNumber}');
      expect(src).toContain('`Cotización Vencida: ${data.quoteNumber}');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. AUDIT CONFIG - EMAIL_SENT action
// ═══════════════════════════════════════════════════════════════════════════

describe('audit-config.ts - EMAIL_SENT', () => {
  it('should have EMAIL_SENT in SALES_ACCION_CONFIG with correct properties', () => {
    const config = SALES_ACCION_CONFIG['EMAIL_SENT'];
    expect(config).toBeDefined();
    expect(config.label).toBe('Email Enviado');
    expect(config.color).toBe('text-cyan-600');
    expect(config.variant).toBe('default');
  });

  it('should include all SalesAuditAction values in config', () => {
    const validActions: SalesAuditAction[] = [
      'CREATE', 'UPDATE', 'STATUS_CHANGE', 'SEND', 'APPROVE', 'REJECT',
      'CONVERT', 'CANCEL', 'COMPLETE', 'DELETE', 'EMIT', 'VOID',
      'ACCEPT', 'APPLY_PAYMENT', 'REVERSE', 'EMAIL_SENT',
    ];
    for (const action of validActions) {
      expect(SALES_ACCION_CONFIG[action]).toBeDefined();
    }
  });

  describe('buildSalesHumanMessage for EMAIL_SENT', () => {
    it('should return message with client name when provided', () => {
      expect(buildSalesHumanMessage('EMAIL_SENT', { clientName: 'Acme Corp' }))
        .toBe('Email enviado a Acme Corp');
    });

    it('should return generic message when no client name', () => {
      expect(buildSalesHumanMessage('EMAIL_SENT', {})).toBe('Email enviado');
    });

    it('should return generic message when no metadata', () => {
      expect(buildSalesHumanMessage('EMAIL_SENT')).toBe('Email enviado');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. AUDIT HELPER - logQuoteEmailSent
// ═══════════════════════════════════════════════════════════════════════════

describe('audit-helper.ts - logQuoteEmailSent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call salesAuditLog.create with correct entity and action', async () => {
    await logQuoteEmailSent({
      quoteId: 42,
      companyId: 1,
      userId: 5,
      clientEmail: 'test@example.com',
      clientName: 'Test Client',
      documentNumber: 'COT-001',
      messageId: 'msg-abc-123',
    });

    expect(mockSalesAuditLogCreate).toHaveBeenCalledOnce();
    const createArgs = mockSalesAuditLogCreate.mock.calls[0][0];
    expect(createArgs.data.entidad).toBe('quote');
    expect(createArgs.data.entidadId).toBe(42);
    expect(createArgs.data.accion).toBe('EMAIL_SENT');
    expect(createArgs.data.companyId).toBe(1);
    expect(createArgs.data.userId).toBe(5);
  });

  it('should include client metadata in datosNuevos', async () => {
    await logQuoteEmailSent({
      quoteId: 42,
      companyId: 1,
      userId: 5,
      clientEmail: 'test@example.com',
      clientName: 'Test Client',
      documentNumber: 'COT-001',
      messageId: 'msg-abc-123',
    });

    const datosNuevos = mockSalesAuditLogCreate.mock.calls[0][0].data.datosNuevos;
    expect(datosNuevos.clientName).toBe('Test Client');
    expect(datosNuevos.documentNumber).toBe('COT-001');
  });

  it('should work without optional messageId', async () => {
    await logQuoteEmailSent({
      quoteId: 10,
      companyId: 2,
      userId: 3,
      clientEmail: 'no-message-id@test.com',
      clientName: 'No MsgId Client',
      documentNumber: 'COT-002',
    });

    expect(mockSalesAuditLogCreate).toHaveBeenCalledOnce();
    expect(mockSalesAuditLogCreate.mock.calls[0][0].data.accion).toBe('EMAIL_SENT');
  });

  it('should not throw when audit create fails (graceful degradation)', async () => {
    mockSalesAuditLogCreate.mockRejectedValueOnce(new Error('DB connection failed'));

    await expect(
      logQuoteEmailSent({
        quoteId: 99,
        companyId: 1,
        userId: 1,
        clientEmail: 'fail@test.com',
        clientName: 'Fail Client',
        documentNumber: 'COT-FAIL',
      })
    ).resolves.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. ENVIAR ROUTE - Integration Logic (static analysis)
// ═══════════════════════════════════════════════════════════════════════════

describe('enviar/route.ts - integration logic', () => {
  const routePath = path.resolve(
    __dirname,
    '../project/app/api/ventas/cotizaciones/[id]/enviar/route.ts'
  );
  let routeContent: string;

  beforeEach(() => {
    routeContent = fs.readFileSync(routePath, 'utf-8');
  });

  it('imports sendQuoteEmail from email-service', () => {
    expect(routeContent).toContain("import { sendQuoteEmail } from '@/lib/ventas/email-service'");
  });

  it('imports logQuoteEmailSent from audit-helper', () => {
    expect(routeContent).toContain('logQuoteEmailSent');
    expect(routeContent).toContain("from '@/lib/ventas/audit-helper'");
  });

  it('sendQuoteEmail is fire-and-forget (non-blocking) - uses .then, not await', () => {
    expect(routeContent).toContain('sendQuoteEmail(');
    expect(routeContent).toContain('.then(result =>');
    expect(routeContent).not.toMatch(/await\s+sendQuoteEmail/);
  });

  it('only sends email when crearPortalAccess AND client has email', () => {
    expect(routeContent).toContain('crearPortalAccess && cotizacion.client.email');
  });

  it('logs audit after successful email send', () => {
    expect(routeContent).toContain('logQuoteEmailSent');
    expect(routeContent).toContain('result.success');
  });

  it('updates estado to ENVIADA before sending email', () => {
    const stateChangeIdx = routeContent.indexOf("estado: 'ENVIADA'");
    const emailSendIdx = routeContent.indexOf('sendQuoteEmail(');
    expect(stateChangeIdx).toBeGreaterThan(-1);
    expect(emailSendIdx).toBeGreaterThan(-1);
    expect(stateChangeIdx).toBeLessThan(emailSendIdx);
  });

  it('only sends cotizaciones in BORRADOR state', () => {
    expect(routeContent).toContain("cotizacion.estado !== 'BORRADOR'");
  });

  it('includes company name in Prisma query for email', () => {
    expect(routeContent).toContain('company:');
    expect(routeContent).toContain('name: true');
  });

  it('passes mensaje to sendQuoteEmail call', () => {
    const emailCallMatch = routeContent.match(/sendQuoteEmail\(\{[\s\S]*?\}\)/);
    expect(emailCallMatch).toBeTruthy();
    expect(emailCallMatch![0]).toContain('mensaje');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. PACKAGE.JSON - Resend dependency
// ═══════════════════════════════════════════════════════════════════════════

describe('package.json - resend dependency', () => {
  it('should have resend in dependencies with valid semver', () => {
    const pkgPath = path.resolve(__dirname, '../project/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.dependencies.resend).toBeDefined();
    expect(pkg.dependencies.resend).toMatch(/^\^?\d+\.\d+\.\d+/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. ENV - RESEND_API_KEY present
// ═══════════════════════════════════════════════════════════════════════════

describe('.env - RESEND_API_KEY', () => {
  it('should have RESEND_API_KEY entry in .env file', () => {
    const envPath = path.resolve(__dirname, '../project/.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    expect(envContent).toContain('RESEND_API_KEY');
  });
});
