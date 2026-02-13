import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const cspLogger = logger.child({ domain: 'csp' });

// URIs de extensiones de navegador que generan ruido en los reportes
const BROWSER_EXTENSION_PATTERNS = [
  'moz-extension://',
  'chrome-extension://',
  'safari-extension://',
  'ms-browser-extension://',
];

/**
 * Determina si un reporte CSP proviene de una extensión del navegador
 */
function isExtensionReport(report: Record<string, unknown>): boolean {
  const fieldsToCheck = [
    report['blocked-uri'],
    report['source-file'],
    report['document-uri'],
  ];
  return fieldsToCheck.some(
    (field) =>
      typeof field === 'string' &&
      BROWSER_EXTENSION_PATTERNS.some((pattern) => field.startsWith(pattern))
  );
}

/**
 * Endpoint para recibir reportes de violaciones CSP.
 * Soporta dos formatos:
 * - report-uri (legacy): Content-Type: application/csp-report → body: { "csp-report": {...} }
 * - report-to (Reporting API): Content-Type: application/reports+json → body: [{ type, body: {...} }]
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const body = await request.json();

    // Normalizar: soportar formato report-to (array de reportes)
    const reports: Record<string, unknown>[] = [];

    if (contentType.includes('application/reports+json') && Array.isArray(body)) {
      // Formato Reporting API (report-to): array de objetos con { type, body }
      for (const entry of body) {
        if (entry.type === 'csp-violation' && entry.body) {
          reports.push(entry.body as Record<string, unknown>);
        }
      }
    } else {
      // Formato legacy (report-uri): { "csp-report": {...} } o reporte directo
      const report = body['csp-report'] || body;
      reports.push(report as Record<string, unknown>);
    }

    for (const report of reports) {
      // Filtrar reportes de extensiones del navegador
      if (isExtensionReport(report)) {
        continue;
      }

      cspLogger.warn(
        {
          blockedUri: report['blocked-uri'],
          violatedDirective: report['violated-directive'],
          effectiveDirective: report['effective-directive'],
          originalPolicy: report['original-policy'] ? '[omitted]' : undefined,
          documentUri: report['document-uri'],
          sourceFile: report['source-file'],
          lineNumber: report['line-number'],
          columnNumber: report['column-number'],
          statusCode: report['status-code'],
        },
        `CSP violation: ${report['violated-directive']} blocked ${report['blocked-uri']}`
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}
