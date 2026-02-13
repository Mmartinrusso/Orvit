import MainLayout from '@/components/layout/MainLayout';

interface MantenimientoLayoutProps {
  children: React.ReactNode;
}

export default function MantenimientoLayout({ children }: MantenimientoLayoutProps) {
  return (
    <MainLayout>
      {children}
    </MainLayout>
  );
}