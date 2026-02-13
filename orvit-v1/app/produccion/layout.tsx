import MainLayout from '@/components/layout/MainLayout';

interface ProduccionLayoutProps {
  children: React.ReactNode;
}

export default function ProduccionLayout({ children }: ProduccionLayoutProps) {
  return (
    <MainLayout>
      {children}
    </MainLayout>
  );
}
