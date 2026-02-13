import { redirect } from 'next/navigation';

// V2: Redirect a la vista unificada de órdenes con vista bandeja y preset correctivos
export default function DispatcherRedirect() {
  redirect('/mantenimiento/ordenes?view=bandeja&preset=correctivos');
}
