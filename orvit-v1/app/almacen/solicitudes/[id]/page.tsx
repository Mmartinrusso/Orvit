import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SolicitudDetailPage({ params }: Props) {
  const { id } = await params;
  redirect(`/almacen?tab=solicitudes&modal=solicitud&id=${id}&mode=view`);
}
