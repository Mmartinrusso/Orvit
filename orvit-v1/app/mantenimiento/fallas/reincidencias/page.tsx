import { redirect } from 'next/navigation';

// V2: Redirect a la vista unificada de fallas con vista reincidencias
export default function ReincidenciasRedirect() {
  redirect('/mantenimiento/fallas?view=reincidencias');
}
