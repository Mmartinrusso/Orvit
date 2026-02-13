import { redirect } from 'next/navigation';

export default function DespachosPage() {
  redirect('/almacen?tab=despachos');
}
