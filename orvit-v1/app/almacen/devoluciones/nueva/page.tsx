import { redirect } from 'next/navigation';

export default function NuevaDevolucionPage() {
  redirect('/almacen?tab=devoluciones&modal=devolucion&mode=new');
}
