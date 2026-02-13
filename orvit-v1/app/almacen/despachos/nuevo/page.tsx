import { redirect } from 'next/navigation';

export default function NuevoDespachoPage() {
  redirect('/almacen?tab=despachos&modal=despacho&mode=new');
}
