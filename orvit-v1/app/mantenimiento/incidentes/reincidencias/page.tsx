import { redirect } from 'next/navigation';

// Redirect a la vista unificada de incidentes con vista reincidencias
export default function ReincidenciasRedirect() {
  redirect('/mantenimiento/incidentes?view=reincidencias');
}
