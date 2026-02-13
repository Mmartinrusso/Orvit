import { redirect } from 'next/navigation';

export default function SolicitudesPage() {
  redirect('/almacen?tab=solicitudes');
}
