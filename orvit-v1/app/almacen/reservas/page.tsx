import { redirect } from 'next/navigation';

export default function ReservasPage() {
  redirect('/almacen?tab=reservas');
}
