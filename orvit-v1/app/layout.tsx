import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { CompanyProvider } from '@/contexts/CompanyContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { ViewModeProvider } from '@/contexts/ViewModeContext';
import { ModulesProvider } from '@/contexts/ModulesContext';
import MobileBottomBar from '@/components/layout/MobileBottomBar';
import { ThemeForce } from '@/components/ThemeForce';
import { AssistantWrapper } from '@/components/assistant';
import { VerificationModal, ModeIndicator } from '@/components/view-mode';

// Importar y inicializar el auto-scheduler solo en servidor
if (typeof window === 'undefined') {
  // Solo en servidor
  import("@/lib/task-auto-scheduler").then(({ startTaskAutoScheduler }) => {
    startTaskAutoScheduler();
  }).catch(console.error);
}

export const metadata: Metadata = {
  title: 'ORVIT',
  description: 'Sistema integral de gestión de mantenimiento, tareas, inventario y órdenes de trabajo',
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Obtener nonce del middleware para CSP
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || '';

  return (
    <html lang="es" suppressHydrationWarning className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <title>ORVIT</title>

        {/* Optimizaciones de performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Meta tags adicionales para SEO */}
        <meta name="description" content="Sistema integral de gestión de mantenimiento, tareas fijas, inventario y órdenes de trabajo" />
        <meta name="keywords" content="mantenimiento, gestión, tareas, inventario, órdenes de trabajo" />
        <meta name="author" content="Sistema de Gestión" />

        {/* Meta tags para PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e40af" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ORVIT" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="ORVIT" />
        <meta property="og:description" content="Gestión integral de mantenimiento y tareas" />

        {/* Configuración de zona horaria, service worker y supresión de errores de extensiones */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              // Configurar zona horaria del sistema
              if (typeof window !== 'undefined') {
                window.__TIMEZONE__ = Intl.DateTimeFormat().resolvedOptions().timeZone;
                console.log('🌍 Zona horaria del cliente:', window.__TIMEZONE__);
              }

              // Registrar Service Worker para PWA
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('⚙️ Service Worker registrado:', registration.scope);
                  }).catch(function(error) {
                    console.log('❌ Error registrando Service Worker:', error);
                  });
                });
              }

              // Suprimir errores de MetaMask y otras extensiones del navegador
              if (typeof window !== 'undefined') {
                window.addEventListener('error', (event) => {
                  // Ignorar errores de MetaMask y otras extensiones de Chrome
                  if (
                    event.message?.includes('MetaMask') ||
                    event.message?.includes('Failed to connect to MetaMask') ||
                    event.filename?.includes('chrome-extension://') ||
                    event.filename?.includes('moz-extension://')
                  ) {
                    event.preventDefault();
                    return false;
                  }
                }, true);

                // Capturar errores no manejados de Promise
                window.addEventListener('unhandledrejection', (event) => {
                  if (
                    event.reason?.message?.includes('MetaMask') ||
                    event.reason?.message?.includes('Failed to connect to MetaMask') ||
                    String(event.reason).includes('MetaMask')
                  ) {
                    event.preventDefault();
                    return false;
                  }
                });
              }
            `,
          }}
        />
      </head>
      <body className="font-sans min-h-screen bg-sidebar">
        <QueryProvider>
          <ThemeProvider>
            <ThemeForce>
              <AuthProvider>
                <CompanyProvider>
                  <ModulesProvider>
                    <NotificationProvider>
                      <NavigationProvider>
                        <ViewModeProvider>
                          {children}
                          <MobileBottomBar />
                          <AssistantWrapper />
                          <VerificationModal />
                          <Toaster />
                          <SonnerToaster
                            position="top-right"
                            richColors
                            closeButton
                            toastOptions={{
                              duration: 4000,
                            }}
                          />
                        </ViewModeProvider>
                      </NavigationProvider>
                    </NotificationProvider>
                  </ModulesProvider>
                </CompanyProvider>
              </AuthProvider>
            </ThemeForce>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}