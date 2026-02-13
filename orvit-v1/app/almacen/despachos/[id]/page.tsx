import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DespachoDetailPage({ params }: Props) {
  const { id } = await params;
  redirect(`/almacen?tab=despachos&modal=despacho&id=${id}&mode=view`);
}
