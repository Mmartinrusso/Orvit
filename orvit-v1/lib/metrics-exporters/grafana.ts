/**
 * [FASE 2] Exporter opcional a Grafana Cloud.
 *
 * Envía métricas usando Prometheus Remote Write (formato snappy/protobuf simplificado).
 * Requiere configurar GRAFANA_CLOUD_URL y GRAFANA_CLOUD_TOKEN en variables de entorno.
 *
 * Uso:
 *   import { pushToGrafana } from '@/lib/metrics-exporters/grafana';
 *   await pushToGrafana(metrics);
 */

interface MetricPayload {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, unknown>;
  timestamp?: Date;
}

/**
 * Envía métricas a Grafana Cloud via Influx Line Protocol (más simple que Prometheus Remote Write).
 * No-op si GRAFANA_CLOUD_URL o GRAFANA_CLOUD_TOKEN no están configurados.
 */
export async function pushToGrafana(metrics: MetricPayload[]): Promise<void> {
  const url = process.env.GRAFANA_CLOUD_URL;
  const token = process.env.GRAFANA_CLOUD_TOKEN;

  if (!url || !token) {
    console.warn('[grafana-exporter] GRAFANA_CLOUD_URL o GRAFANA_CLOUD_TOKEN no configurados, saltando export');
    return;
  }

  // Convertir a Influx Line Protocol
  const lines = metrics.map(m => {
    const measurement = `orvit_${m.name}`;
    const tags = m.tags
      ? ',' + Object.entries(m.tags).map(([k, v]) => `${k}=${v}`).join(',')
      : '';
    const timestamp = (m.timestamp?.getTime() ?? Date.now()) * 1_000_000; // nanoseconds
    return `${measurement}${tags} value=${m.value} ${timestamp}`;
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        Authorization: `Bearer ${token}`,
      },
      body: lines.join('\n'),
    });

    if (!response.ok) {
      console.error(`[grafana-exporter] Error HTTP ${response.status}:`, await response.text());
    }
  } catch (error) {
    console.error('[grafana-exporter] Error enviando métricas:', error);
  }
}
