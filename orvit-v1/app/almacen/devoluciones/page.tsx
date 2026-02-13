import { redirect } from 'next/navigation';

export default function DevolucionesPage() {
  redirect('/almacen?tab=devoluciones');
}
