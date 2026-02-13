import { redirect } from 'next/navigation';

export default function InventarioPage() {
  redirect('/almacen?tab=inventario');
}
