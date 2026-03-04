import { redirect } from 'next/navigation';

// Redirect a la nueva URL de incidentes
export default function FallasRedirect() {
  redirect('/mantenimiento/incidentes');
}
