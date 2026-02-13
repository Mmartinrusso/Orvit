/**
 * [FASE 2] Exporter opcional a Datadog.
 *
 * Envía métricas usando la API HTTP de Datadog (DogStatsD).
 * Requiere configurar DATADOG_API_KEY en las variables de entorno.
 *
 * Uso:
 *   import { exportToDatadog } from '@/lib/metrics-exporters/datadog';
 *   await exportToDatadog(metrics);
 */

interface MetricPayload {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, unknown>;
  timestamp?: Date;
}

const DATADOG_API_URL = 'https://api.datadoghq.com/api/v2/series';

/**
 * Exporta un lote de métricas a Datadog via HTTP API.
 * No-op si DATADOG_API_KEY no está configurado.
 */
export async function exportToDatadog(metrics: MetricPayload[]): Promise<void> {
  const apiKey = process.env.DATADOG_API_KEY;
  if (!apiKey) {
    console.warn('[datadog-exporter] DATADOG_API_KEY no configurado, saltando export');
    return;
  }

  const series = metrics.map(m => ({
    metric: `orvit.${m.name}`,
    type: 0, // gauge
    points: [
      {
        timestamp: Math.floor((m.timestamp?.getTime() ?? Date.now()) / 1000),
        value: m.value,
      },
    ],
    tags: m.tags
      ? Object.entries(m.tags).map(([k, v]) => `${k}:${v}`)
      : [],
    unit: m.unit || undefined,
  }));

  try {
    const response = await fetch(DATADOG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': apiKey,
      },
      body: JSON.stringify({ series }),
    });

    if (!response.ok) {
      console.error(`[datadog-exporter] Error HTTP ${response.status}:`, await response.text());
    }
  } catch (error) {
    console.error('[datadog-exporter] Error enviando métricas:', error);
  }
}
