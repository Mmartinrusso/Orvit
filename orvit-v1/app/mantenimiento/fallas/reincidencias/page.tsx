import { redirect } from 'next/navigation';

// Redirect a la nueva URL de incidentes con vista reincidencias
export default function ReincidenciasRedirect() {
  redirect('/mantenimiento/incidentes?view=reincidencias');
}
