import { redirect } from 'next/navigation';

export default function MovimientosPage() {
  redirect('/almacen?tab=kardex');
}
