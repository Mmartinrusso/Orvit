import { redirect } from 'next/navigation';

/**
 * Redirect de ruta legacy /mantenimiento/preventivo/historial
 * Ahora usa ?view=metricas (historial está dentro de Métricas como sub-tab)
 */
export default function HistorialRedirect() {
  redirect('/mantenimiento/preventivo?view=metricas');
}
