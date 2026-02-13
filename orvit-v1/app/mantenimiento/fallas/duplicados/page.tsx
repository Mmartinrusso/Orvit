import { redirect } from 'next/navigation';

// V2: Redirect a la vista unificada de fallas con vista duplicados
export default function DuplicadosRedirect() {
  redirect('/mantenimiento/fallas?view=duplicados');
}
