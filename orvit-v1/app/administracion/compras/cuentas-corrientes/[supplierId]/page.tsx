'use client';

import { useParams } from 'next/navigation';
import ProveedorCuentaCorriente from '@/components/compras/proveedor-cuenta-corriente';

export default function CuentaCorrienteDetallePage() {
  const params = useParams();
  const supplierId = params.supplierId as string;

  return (
    <div className="m-3 rounded-2xl surface-card dashboard-surface px-6 md:px-8 py-6">
      <ProveedorCuentaCorriente
        proveedorId={supplierId}
        showHeader={true}
      />
    </div>
  );
}
