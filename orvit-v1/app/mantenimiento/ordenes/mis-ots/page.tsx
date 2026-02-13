import { redirect } from 'next/navigation';

// V2: Redirect a la vista unificada de órdenes con preset "mine"
export default function MisOTsRedirect() {
  redirect('/mantenimiento/ordenes?preset=mine');
}
