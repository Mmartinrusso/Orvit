import MainLayout from '@/components/layout/MainLayout';

export default function PanolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MainLayout>
      {children}
    </MainLayout>
  );
} 