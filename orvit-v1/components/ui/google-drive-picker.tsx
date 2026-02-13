'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Tipos de Google Picker
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  url?: string;
  thumbnailUrl?: string;
}

export interface GoogleDrivePickerProps {
  onFilesSelected: (files: GoogleDriveFile[]) => void;
  onImportComplete?: (importedFiles: { url: string; name: string; size: number; type: string }[]) => void;
  multiSelect?: boolean;
  mimeTypes?: string[];
  buttonText?: string;
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  buttonClassName?: string;
  disabled?: boolean;
  // Para importar automáticamente a S3
  autoImport?: boolean;
  importEndpoint?: string;
  entityType?: string;
  entityId?: string | number;
}

// Cargar scripts de Google
const loadGoogleScripts = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Si ya están cargados
    if (window.gapi && window.google?.picker) {
      resolve();
      return;
    }

    // Cargar GAPI
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;

    // Cargar Google Identity Services
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;

    let gapiLoaded = false;
    let gisLoaded = false;

    const checkBothLoaded = () => {
      if (gapiLoaded && gisLoaded) {
        resolve();
      }
    };

    gapiScript.onload = () => {
      window.gapi.load('picker', () => {
        gapiLoaded = true;
        checkBothLoaded();
      });
    };

    gisScript.onload = () => {
      gisLoaded = true;
      checkBothLoaded();
    };

    gapiScript.onerror = () => reject(new Error('Error cargando Google API'));
    gisScript.onerror = () => reject(new Error('Error cargando Google Identity'));

    document.body.appendChild(gapiScript);
    document.body.appendChild(gisScript);
  });
};

// SVG icon de Google Drive
const GoogleDriveIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
  </svg>
);

export function GoogleDrivePicker({
  onFilesSelected,
  onImportComplete,
  multiSelect = false,
  mimeTypes,
  buttonText = 'Google Drive',
  buttonVariant = 'outline',
  buttonSize = 'sm',
  buttonClassName,
  disabled = false,
  autoImport = false,
  importEndpoint = '/api/import-from-drive',
  entityType,
  entityId,
}: GoogleDrivePickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [credentialsLoading, setCredentialsLoading] = useState(true);

  // Obtener credenciales del servidor
  const [credentials, setCredentials] = useState<{
    apiKey: string;
    clientId: string;
  } | null>(null);

  // Función para cargar credenciales con retry
  const loadCredentials = useCallback(async (retries = 3): Promise<{ apiKey: string; clientId: string } | null> => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch('/api/google-drive/credentials', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await res.json();
        if (data.apiKey && data.clientId) {
          setCredentials(data);
          setCredentialsLoading(false);
          return data;
        }
      } catch {
        // Reintentar
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
    setCredentialsLoading(false);
    return null;
  }, []);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  useEffect(() => {
    if (credentials) {
      loadGoogleScripts()
        .then(() => setScriptsLoaded(true))
        .catch(err => console.error('Error loading Google scripts:', err));
    }
  }, [credentials]);

  const handleAuth = useCallback(() => {
    if (!credentials) {
      setShowConfigDialog(true);
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: credentials.clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (response: any) => {
        if (response.access_token) {
          setAccessToken(response.access_token);
          openPicker(response.access_token);
        }
      },
    });

    tokenClient.requestAccessToken();
  }, [credentials]);

  const openPicker = useCallback((token: string) => {
    if (!credentials || !window.google?.picker) return;

    // Detectar móvil
    const isMobile = window.innerWidth < 768;

    // Vista principal de Mi Unidad
    const myDriveView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setParent('root')
      .setMode(window.google.picker.DocsViewMode.LIST);

    if (mimeTypes && mimeTypes.length > 0) {
      myDriveView.setMimeTypes(mimeTypes.join(','));
    }

    // Tamaño: pantalla completa en móvil, responsivo en desktop
    const width = isMobile
      ? window.innerWidth
      : Math.min(window.innerWidth - 40, 1100);
    const height = isMobile
      ? window.innerHeight
      : Math.min(window.innerHeight - 80, 700);

    const picker = new window.google.picker.PickerBuilder()
      .addView(myDriveView)
      .setOAuthToken(token)
      .setDeveloperKey(credentials.apiKey)
      .setSize(width, height)
      .setCallback(async (data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const files: GoogleDriveFile[] = data.docs.map((doc: any) => ({
            id: doc.id,
            name: doc.name,
            mimeType: doc.mimeType,
            size: doc.sizeBytes,
            url: doc.url,
            thumbnailUrl: doc.thumbnails?.[0]?.url,
          }));

          onFilesSelected(files);

          if (autoImport && files.length > 0) {
            await importFiles(files, token);
          }
        }
        // CANCEL se maneja automáticamente por Google
      })
      .setTitle('Seleccionar archivo')
      .setLocale('es');

    if (multiSelect) {
      picker.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED);
    }

    // En móvil, ocultar nav para más espacio
    if (isMobile) {
      picker.enableFeature(window.google.picker.Feature.NAV_HIDDEN);
    }

    const builtPicker = picker.build();
    builtPicker.setVisible(true);

    // Solo aplicar ajustes en móvil para pantalla completa
    if (isMobile) {
      setTimeout(() => {
        const pickerDialog = document.querySelector('.picker-dialog') as HTMLElement;
        if (pickerDialog) {
          pickerDialog.style.position = 'fixed';
          pickerDialog.style.top = '0';
          pickerDialog.style.left = '0';
          pickerDialog.style.width = '100vw';
          pickerDialog.style.height = '100dvh';
          pickerDialog.style.maxWidth = '100vw';
          pickerDialog.style.maxHeight = '100dvh';
          pickerDialog.style.margin = '0';
          pickerDialog.style.borderRadius = '0';
        }

        const pickerContent = document.querySelector('.picker-dialog-content') as HTMLElement;
        if (pickerContent) {
          pickerContent.style.width = '100%';
          pickerContent.style.height = 'calc(100dvh - 50px)';
          pickerContent.style.maxHeight = 'calc(100dvh - 50px)';
        }
      }, 100);
    }
  }, [credentials, mimeTypes, multiSelect, onFilesSelected, autoImport]);

  const importFiles = async (files: GoogleDriveFile[], token: string) => {
    setIsImporting(true);
    const importedFiles: { url: string; name: string; size: number; type: string }[] = [];

    try {
      for (const file of files) {
        toast.loading(`Importando ${file.name}...`, { id: `import-${file.id}` });

        const response = await fetch(importEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: file.id,
            fileName: file.name,
            mimeType: file.mimeType,
            accessToken: token,
            entityType,
            entityId,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error importando archivo');
        }

        const result = await response.json();
        importedFiles.push({
          url: result.url,
          name: file.name,
          size: result.size || file.size || 0,
          type: file.mimeType,
        });

        toast.success(`${file.name} importado`, { id: `import-${file.id}` });
      }

      onImportComplete?.(importedFiles);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error importando archivos');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClick = async () => {
    let currentCredentials = credentials;

    // Si todavía están cargando o no hay credenciales, intentar cargar
    if (credentialsLoading || !currentCredentials) {
      setIsLoading(true);
      currentCredentials = await loadCredentials(3);
      setIsLoading(false);
    }

    if (!currentCredentials) {
      setShowConfigDialog(true);
      return;
    }

    if (!scriptsLoaded) {
      setIsLoading(true);
      loadGoogleScripts()
        .then(() => {
          setScriptsLoaded(true);
          setIsLoading(false);
          handleAuth();
        })
        .catch(() => {
          setIsLoading(false);
          toast.error('Error cargando Google Drive');
        });
      return;
    }

    if (accessToken) {
      openPicker(accessToken);
    } else {
      handleAuth();
    }
  };

  return (
    <>
      <Button
        variant={buttonVariant}
        size={buttonSize}
        className={buttonClassName}
        onClick={handleClick}
        disabled={disabled || isLoading || isImporting}
      >
        {isLoading || isImporting || credentialsLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <GoogleDriveIcon className="h-4 w-4 mr-2" />
        )}
        {isImporting ? 'Importando...' : isLoading ? 'Cargando...' : buttonText}
      </Button>

      {/* Dialog cuando no hay credenciales configuradas */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Google Drive no configurado</DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              <p>
                Para usar Google Drive necesitas configurar las credenciales de Google Cloud.
              </p>
              <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                <p className="font-medium">Pasos para configurar:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Ir a Google Cloud Console</li>
                  <li>Crear proyecto o usar uno existente</li>
                  <li>Habilitar "Google Picker API" y "Google Drive API"</li>
                  <li>Crear credenciales OAuth 2.0 (Client ID)</li>
                  <li>Crear API Key</li>
                  <li>Agregar las variables de entorno:
                    <code className="block mt-1 p-2 bg-background rounded text-xs">
                      GOOGLE_DRIVE_API_KEY=tu_api_key<br/>
                      GOOGLE_DRIVE_CLIENT_ID=tu_client_id
                    </code>
                  </li>
                </ol>
              </div>
              <p className="text-xs text-muted-foreground">
                Las APIs de Google Picker y Drive son gratuitas.
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default GoogleDrivePicker;
