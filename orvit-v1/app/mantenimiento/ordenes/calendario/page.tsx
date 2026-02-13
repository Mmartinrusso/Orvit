import { redirect } from 'next/navigation';

// V2: Redirect a la vista unificada de órdenes con vista calendario
export default function CalendarioRedirect() {
  redirect('/mantenimiento/ordenes?view=calendario');
}
