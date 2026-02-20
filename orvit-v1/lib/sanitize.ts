import DOMPurify from 'dompurify';

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
    'span', 'div', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'sub', 'sup', 'hr', 'mark',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class', 'style', 'src', 'alt',
    'width', 'height', 'colspan', 'rowspan',
  ],
} as const;

/**
 * Sanitiza HTML user-generated para prevenir XSS.
 * Usado con dangerouslySetInnerHTML en contenido de instructivos,
 * descripciones, soluciones, y otros campos de rich-text.
 *
 * En el servidor (SSR), aplica limpieza con regex como fallback.
 * En el cliente, usa DOMPurify completo.
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') {
    // SSR fallback: strip script tags and event handlers
    return dirty
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript\s*:/gi, '');
  }

  return DOMPurify.sanitize(dirty, PURIFY_CONFIG);
}
