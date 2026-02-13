import { redirect } from 'next/navigation';

/**
 * Redirect de ruta legacy /mantenimiento/preventivo/planes
 * Ahora usa ?view=planes
 */
export default function PlanesRedirect() {
  redirect('/mantenimiento/preventivo?view=planes');
}
