import { redirect } from 'next/navigation';

export default function NuevaSolicitudPage() {
  redirect('/almacen?tab=solicitudes&modal=solicitud&mode=new');
}
