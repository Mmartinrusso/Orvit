import { PortalAuthProvider } from '@/contexts/PortalAuthContext';

export const metadata = {
  title: 'Portal de Clientes',
  description: 'Portal de acceso para clientes',
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalAuthProvider>
      {children}
    </PortalAuthProvider>
  );
}
