import { redirect } from 'next/navigation';

// Redirect a la nueva URL de incidentes con vista duplicados
export default function DuplicadosRedirect() {
  redirect('/mantenimiento/incidentes?view=duplicados');
}
