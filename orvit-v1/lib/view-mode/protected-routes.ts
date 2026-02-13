/**
 * Protected Routes Configuration
 * Routes that ALWAYS use Standard mode regardless of user preference
 * Critical for fiscal compliance (ARCA, Libro IVA, etc.)
 */

// Routes that MUST always use Standard mode (T1 only)
// These are fiscal/regulatory reports that cannot include T2 documents
export const ALWAYS_STANDARD_ROUTES: string[] = [
  // ARCA (ex-AFIP) integration
  '/api/arca',

  // IVA reports
  '/api/compras/reportes/libro-iva',
  '/api/compras/reportes/iva-compras',
  '/api/compras/reportes/iva-ventas',

  // Tax perception reports
  '/api/compras/reportes/percepciones',
  '/api/compras/reportes/retenciones',

  // AFIP exports
  '/api/compras/exportar/afip',
  '/api/compras/exportar/citi',

  // Accounting exports
  '/api/compras/exportar/contable',
  '/api/compras/exportar/asientos',

  // Sales fiscal reports (future)
  '/api/ventas/reportes/libro-iva',
  '/api/ventas/reportes/facturacion',
  '/api/ventas/exportar/afip',
];

/**
 * Check if a route should always use Standard mode
 */
export function isProtectedRoute(pathname: string): boolean {
  // Normalize pathname
  const normalizedPath = pathname.toLowerCase();

  // Check exact matches
  if (ALWAYS_STANDARD_ROUTES.includes(normalizedPath)) {
    return true;
  }

  // Check prefix matches (for nested routes)
  return ALWAYS_STANDARD_ROUTES.some(route =>
    normalizedPath.startsWith(route + '/')
  );
}

/**
 * Check if route is a fiscal/regulatory report
 * More strict check - includes any route with fiscal-related keywords
 */
export function isFiscalRoute(pathname: string): boolean {
  const fiscalKeywords = [
    '/arca',
    '/afip',
    '/libro-iva',
    '/iva-compras',
    '/iva-ventas',
    '/percepciones',
    '/retenciones',
    '/citi',
    '/contable',
    '/asientos',
    '/facturacion',
  ];

  const normalizedPath = pathname.toLowerCase();
  return fiscalKeywords.some(keyword => normalizedPath.includes(keyword));
}
