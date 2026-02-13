/**
 * Performance instrumentation utilities para endpoints Next.js
 * Mide y reporta métricas de rendimiento por fases
 */

/**
 * Obtiene timestamp en milisegundos usando performance.now() (alta resolución)
 */
export function now(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

/**
 * Calcula diferencia en milisegundos entre dos timestamps
 */
export function diffMs(start: number, end: number): number {
  return Math.round((end - start) * 100) / 100; // Redondear a 2 decimales
}

export interface PerfMetrics {
  parse: number;
  db: number;
  compute: number;
  json: number;
  total: number;
  payloadBytes?: number;
}

export interface PerfContext {
  startTotal: number;
  startParse: number;
  endParse: number;
  dbStart: number;
  dbEnd: number;
  computeStart: number;
  computeEnd: number;
  jsonStart: number;
  jsonEnd: number;
  payloadBytes?: number;
}

/**
 * Inicializa contexto de performance
 */
export function startPerf(): PerfContext {
  const startTotal = now();
  return {
    startTotal,
    startParse: startTotal,
    endParse: 0,
    dbStart: 0,
    dbEnd: 0,
    computeStart: 0,
    computeEnd: 0,
    jsonStart: 0,
    jsonEnd: 0,
  };
}

/**
 * Marca el fin de la fase de parse (URL params, body parsing)
 */
export function endParse(ctx: PerfContext): void {
  ctx.endParse = now();
  ctx.dbStart = ctx.endParse;
}

/**
 * Marca el inicio de queries DB
 */
export function startDb(ctx: PerfContext): void {
  ctx.dbStart = now();
}

/**
 * Marca el fin de queries DB
 */
export function endDb(ctx: PerfContext): void {
  ctx.dbEnd = now();
  ctx.computeStart = ctx.dbEnd;
}

/**
 * Marca el inicio de computación (transformaciones, loops, cálculos)
 */
export function startCompute(ctx: PerfContext): void {
  ctx.computeStart = now();
}

/**
 * Marca el fin de computación
 */
export function endCompute(ctx: PerfContext): void {
  ctx.computeEnd = now();
  ctx.jsonStart = ctx.computeEnd;
}

/**
 * Marca el inicio de serialización JSON
 */
export function startJson(ctx: PerfContext): void {
  ctx.jsonStart = now();
}

/**
 * Marca el fin de serialización JSON y calcula métricas finales
 */
export function endJson(ctx: PerfContext, payload?: any): PerfMetrics {
  ctx.jsonEnd = now();
  
  // Calcular tamaño del payload si se proporciona
  if (payload !== undefined) {
    try {
      const jsonString = JSON.stringify(payload);
      ctx.payloadBytes = new Blob([jsonString]).size;
    } catch (e) {
      // Si falla la serialización, omitir
    }
  }
  
  const parseMs = diffMs(ctx.startParse, ctx.endParse || ctx.startParse);
  const dbMs = diffMs(ctx.dbStart || ctx.endParse, ctx.dbEnd || ctx.dbStart || ctx.endParse);
  const computeMs = diffMs(ctx.computeStart || ctx.dbEnd, ctx.computeEnd || ctx.computeStart || ctx.dbEnd);
  const jsonMs = diffMs(ctx.jsonStart || ctx.computeEnd, ctx.jsonEnd);
  const totalMs = diffMs(ctx.startTotal, ctx.jsonEnd);
  
  return {
    parse: parseMs,
    db: dbMs,
    compute: computeMs,
    json: jsonMs,
    total: totalMs,
    payloadBytes: ctx.payloadBytes,
  };
}

/**
 * Agrega headers X-Perf-* a la respuesta si debug=1 en query params
 * @param response - NextResponse o Response object
 * @param metrics - Métricas calculadas
 * @param searchParams - URLSearchParams para verificar debug flag
 */
export function withPerfHeaders(
  response: Response | any,
  metrics: PerfMetrics,
  searchParams: URLSearchParams
): Response | any {
  const debug = searchParams.get('debug') === '1';
  
  if (!debug) {
    return response;
  }
  
  // Para NextResponse de Next.js, usar método headers.set directamente
  if (response && typeof response.headers === 'object' && 'set' in response.headers) {
    response.headers.set('X-Perf-Total', metrics.total.toString());
    response.headers.set('X-Perf-Parse', metrics.parse.toString());
    response.headers.set('X-Perf-DB', metrics.db.toString());
    response.headers.set('X-Perf-Compute', metrics.compute.toString());
    response.headers.set('X-Perf-JSON', metrics.json.toString());
    if (metrics.payloadBytes !== undefined) {
      response.headers.set('X-Perf-PayloadBytes', metrics.payloadBytes.toString());
    }
    return response;
  }
  
  // Para Response estándar, crear nuevo objeto con headers
  const headers = new Headers(response.headers || {});
  headers.set('X-Perf-Total', metrics.total.toString());
  headers.set('X-Perf-Parse', metrics.parse.toString());
  headers.set('X-Perf-DB', metrics.db.toString());
  headers.set('X-Perf-Compute', metrics.compute.toString());
  headers.set('X-Perf-JSON', metrics.json.toString());
  
  if (metrics.payloadBytes !== undefined) {
    headers.set('X-Perf-PayloadBytes', metrics.payloadBytes.toString());
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Helper para verificar si se debe desactivar cache (noCache=1)
 */
export function shouldDisableCache(searchParams: URLSearchParams): boolean {
  return searchParams.get('noCache') === '1';
}

