'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useCompanySettingsPermission } from '@/hooks/use-company-settings-permission';
import {
  User,
  Bell,
  Shield,
  Save,
  Upload,
  Check,
  Lock,
  Moon,
  Sun,
  Globe,
  Building2,
  Send,
  LinkIcon,
  Unlink,
  Loader2,
  Keyboard,
  Eye,
  EyeOff,
  MessageSquare,
  AlertCircle,
  Users,
  ChevronDown,
  ChevronRight,
  Wrench,
  ClipboardList,
  RefreshCw,
  Search,
  FileText,
  ExternalLink,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Slider } from '@/components/ui/slider';
import { useFontSize } from '@/hooks/use-font-size';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useApiMutation, createFetchMutation } from '@/hooks/use-api-mutation';

// Icono de Discord
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

// Interfaces para Discord Access Management
interface ChannelPermissions {
  canViewFallas: boolean;
  canViewPreventivos: boolean;
  canViewOT: boolean;
  canViewGeneral: boolean;
}

interface SectorAccess {
  id: number;
  sectorId: number;
  grantedAt: string;
  canViewFallas: boolean;
  canViewPreventivos: boolean;
  canViewOT: boolean;
  canViewGeneral: boolean;
  sector: {
    id: number;
    name: string;
  };
}

interface DiscordUser {
  id: number;
  name: string;
  email: string;
  discordUserId: string | null;
  isActive: boolean;
  discordSectorAccess: SectorAccess[];
}

interface DiscordSector {
  id: number;
  name: string;
  discordCategoryId: string | null;
  discordFallasChannelId: string | null;
  discordPreventivosChannelId: string | null;
  discordOTChannelId: string | null;
  discordGeneralChannelId: string | null;
}

const CHANNEL_TYPES = [
  { key: 'fallas', label: 'Fallas', icon: AlertCircle, color: 'text-destructive' },
  { key: 'preventivos', label: 'Preventivos', icon: Wrench, color: 'text-info-muted-foreground' },
  { key: 'ot', label: 'OT', icon: ClipboardList, color: 'text-warning-muted-foreground' },
  { key: 'general', label: 'General', icon: MessageSquare, color: 'text-success' },
] as const;

export default function ConfiguracionPage() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const { currentCompany, updateCurrentCompany } = useCompany();
  const { toast } = useToast();
  const { canConfigureCompany, isLoading: permissionLoading } = useCompanySettingsPermission();
  const { theme, setTheme } = useTheme();
  const { fontSize, setFontSize, resetFontSize, overrides, setOverride, resetAll, hasOverrides } = useFontSize();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { mode, canToggle } = useViewMode();

  const normalizeTab = (raw: string | null) => {
    const v = (raw || '').toLowerCase();
    if (v === 'perfil' || v === 'profile') return 'profile';
    if (v === 'empresa' || v === 'company') return 'company';
    if (v === 'notificaciones' || v === 'notifications') return 'notifications';
    if (v === 'seguridad' || v === 'security') return 'security';
    return 'profile';
  };

  const [activeTab, setActiveTab] = useState<string>(() => normalizeTab(searchParams?.get('tab')));

  // Profile state
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    avatar: '',
  });
  const [isUploading, setIsUploading] = useState(false);

  // Company state
  const [companyData, setCompanyData] = useState({
    name: '',
    cuit: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    logo: '',
    logoDark: '',
    logoLight: '',
  });
  const [isLogoLightUploading, setIsLogoLightUploading] = useState(false);
  const [isLogoDarkUploading, setIsLogoDarkUploading] = useState(false);

  // Notifications state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [taskNotifications, setTaskNotifications] = useState(true);
  const [reminderNotifications, setReminderNotifications] = useState(true);

  // Discord state
  const [discordStatus, setDiscordStatus] = useState<{ linked: boolean; discordUserId: string | null }>({ linked: false, discordUserId: null });
  const [discordLoading, setDiscordLoading] = useState(true);
  const [discordInput, setDiscordInput] = useState('');
  const [discordTestLoading, setDiscordTestLoading] = useState(false);

  // T2 config state (solo visible en modo E)
  const [t2Config, setT2Config] = useState({
    hotkey: 'ctrl+shift+t',
    pinEnabled: false,
    pin: '',
    sessionTimeout: 30,
  });
  const [showT2Pin, setShowT2Pin] = useState(false);

  // Purchase config state
  const [purchaseConfig, setPurchaseConfig] = useState({
    claveEdicionItems: '',
    permitirEdicionItems: true,
    requiereMotivoEdicion: true,
  });
  const [showPurchasePassword, setShowPurchasePassword] = useState(false);

  // Discord Access Management state
  const [discordUsers, setDiscordUsers] = useState<DiscordUser[]>([]);
  const [discordSectors, setDiscordSectors] = useState<DiscordSector[]>([]);
  const [discordAccessLoading, setDiscordAccessLoading] = useState(false);
  const [discordSearchTerm, setDiscordSearchTerm] = useState('');
  const [selectedDiscordUser, setSelectedDiscordUser] = useState<DiscordUser | null>(null);
  const [discordEditDialogOpen, setDiscordEditDialogOpen] = useState(false);
  const [discordExpandedSectors, setDiscordExpandedSectors] = useState<number[]>([]);
  const [discordPendingChanges, setDiscordPendingChanges] = useState<{
    add: { sectorId: number; perms: ChannelPermissions }[];
    remove: number[];
    update: { sectorId: number; perms: Partial<ChannelPermissions> }[];
  }>({ add: [], remove: [], update: [] });

  // ===== MUTATIONS (useApiMutation) =====

  // Save user profile
  const saveProfileMutation = useApiMutation<any, { name: string; avatar: string }>({
    mutationFn: async (vars) => {
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: vars.name, avatar: vars.avatar }),
      });
      if (!response.ok) throw new Error('Error al guardar el perfil');
      return response.json();
    },
    successMessage: 'Perfil actualizado correctamente',
    errorMessage: 'Error al guardar el perfil',
    onSuccess: () => {
      window.location.reload();
    },
  });

  // Save company details
  const saveCompanyMutation = useApiMutation<any, Record<string, string>>({
    mutationFn: async (vars) => {
      const response = await fetch(`/api/companies/${currentCompany?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      if (!response.ok) throw new Error('Error al guardar la empresa');
      return response.json();
    },
    successMessage: 'Empresa actualizada correctamente',
    errorMessage: 'Error al guardar la empresa',
    onSuccess: (data) => {
      updateCurrentCompany(data);
    },
  });

  // Link Discord user
  const linkDiscordMutation = useApiMutation<any, { discordUserId: string }>({
    mutationFn: createFetchMutation({
      url: '/api/discord/users/link',
      method: 'POST',
    }),
    successMessage: 'Tu cuenta de Discord fue vinculada exitosamente',
    errorMessage: 'No se pudo vincular Discord',
    onSuccess: (_data, vars) => {
      setDiscordStatus({ linked: true, discordUserId: vars.discordUserId });
      setDiscordInput('');
    },
  });

  // Unlink Discord user
  const unlinkDiscordMutation = useApiMutation({
    mutationFn: async () => {
      const response = await fetch('/api/discord/users/link', { method: 'DELETE' });
      if (!response.ok) throw new Error('No se pudo desvincular Discord');
      return response.json();
    },
    successMessage: 'Ya no recibirás notificaciones por Discord',
    errorMessage: 'No se pudo desvincular Discord',
    onSuccess: () => {
      setDiscordStatus({ linked: false, discordUserId: null });
    },
  });

  // Save T2 / ViewMode config
  const saveT2ConfigMutation = useApiMutation<any, { enabled: boolean; hotkey: string; pinEnabled: boolean; pin?: string; sessionTimeout: number }>({
    mutationFn: async (vars) => {
      const res = await fetch(`/api/company/${currentCompany?.id}/view-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error('No se pudo guardar la configuración');
      return res.json();
    },
    successMessage: 'Configuración de ViewMode actualizada',
    errorMessage: 'No se pudo guardar la configuración',
    onSuccess: () => {
      setT2Config(prev => ({ ...prev, pin: '' }));
    },
  });

  // Save purchase config
  const savePurchaseConfigMutation = useApiMutation<any, Record<string, unknown>>({
    mutationFn: async (vars) => {
      const res = await fetch('/api/compras/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo guardar la configuración');
      }
      return res.json();
    },
    successMessage: 'Configuración de Compras actualizada',
    errorMessage: 'Error al guardar configuración de compras',
    onSuccess: () => {
      setPurchaseConfig(prev => ({ ...prev, claveEdicionItems: '' }));
    },
  });

  // Sync from Discord
  const syncFromDiscordMutation = useApiMutation<any, { userId: number }>({
    mutationFn: async (vars) => {
      const res = await fetch('/api/discord/sync-from-discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar');
      return data;
    },
    successMessage: null,
    errorMessage: 'Error al sincronizar desde Discord',
    onSuccess: async (data) => {
      toast({
        title: 'Sincronizado',
        description: data.message || `${data.created} nuevos, ${data.updated} actualizados`,
      });
      // Reload the selected user data
      if (selectedDiscordUser) {
        const userRes = await fetch(`/api/discord/user-access?userId=${selectedDiscordUser.id}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user) {
            setSelectedDiscordUser(userData.user);
            setDiscordPendingChanges({ add: [], remove: [], update: [] });
          }
        }
      }
      fetchDiscordAccessData();
    },
  });

  // Make all Discord categories private
  const makeAllCategoriesPrivateMutation = useApiMutation({
    mutationFn: async () => {
      const res = await fetch('/api/discord/bot/make-all-private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al hacer privadas las categorías');
      return data;
    },
    successMessage: null,
    errorMessage: 'Error al hacer privadas las categorías',
    onSuccess: (data: any) => {
      toast({ title: 'Categorías actualizadas', description: data.message });
    },
  });

  // Resync all Discord access
  const resyncAllAccessMutation = useApiMutation({
    mutationFn: async () => {
      const res = await fetch('/api/discord/bot/resync-all-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al re-sincronizar');
      return data;
    },
    successMessage: null,
    errorMessage: 'Error al re-sincronizar accesos',
    onSuccess: (data: any) => {
      toast({ title: 'Accesos sincronizados', description: data.message });
      fetchDiscordAccessData();
    },
  });

  // Save Discord access changes (complex multi-step)
  const saveDiscordAccessMutation = useApiMutation<void, {
    user: DiscordUser;
    changes: typeof discordPendingChanges;
  }>({
    mutationFn: async ({ user: dUser, changes }) => {
      // 1. Add new accesses
      if (changes.add.length > 0) {
        for (const access of changes.add) {
          const res = await fetch('/api/discord/user-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: dUser.id,
              sectorIds: [access.sectorId],
              channelPermissions: {
                fallas: access.perms.canViewFallas,
                preventivos: access.perms.canViewPreventivos,
                ot: access.perms.canViewOT,
                general: access.perms.canViewGeneral,
              },
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
          }
        }
      }

      // 2. Remove accesses
      if (changes.remove.length > 0) {
        const res = await fetch(
          `/api/discord/user-access?userId=${dUser.id}&sectorIds=${changes.remove.join(',')}`,
          { method: 'DELETE' }
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
      }

      // 3. Update permissions
      if (changes.update.length > 0) {
        for (const update of changes.update) {
          const res = await fetch('/api/discord/user-access', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: dUser.id,
              sectorId: update.sectorId,
              channelPermissions: {
                fallas: update.perms.canViewFallas,
                preventivos: update.perms.canViewPreventivos,
                ot: update.perms.canViewOT,
                general: update.perms.canViewGeneral,
              },
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
          }
        }
      }
    },
    successMessage: 'Cambios de acceso guardados correctamente',
    errorMessage: 'Error al guardar cambios de acceso',
    onSuccess: (_data, { changes }) => {
      fetchDiscordAccessData();
      setDiscordEditDialogOpen(false);
    },
  });

  // Load user data
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        avatar: user.avatar || '',
      });
    }
  }, [user]);

  // Load company data
  useEffect(() => {
    if (currentCompany) {
      const company = currentCompany as any;
      setCompanyData({
        name: company.name || '',
        cuit: company.cuit || '',
        address: company.address || '',
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
        logo: company.logo || '',
        logoDark: company.logoDark || '',
        logoLight: company.logoLight || '',
      });
    }
  }, [currentCompany]);

  // Load Discord status
  useEffect(() => {
    const fetchDiscordStatus = async () => {
      if (!user?.id) return;
      try {
        const response = await fetch('/api/discord/users/link');
        if (response.ok) {
          const data = await response.json();
          setDiscordStatus({
            linked: data.linked,
            discordUserId: data.discordUserId
          });
        }
      } catch (error) {
        console.error('Error fetching Discord status:', error);
      } finally {
        setDiscordLoading(false);
      }
    };
    fetchDiscordStatus();
  }, [user?.id]);

  // Load T2 config (solo cuando estamos en modo E)
  useEffect(() => {
    if (mode !== 'E' || !currentCompany?.id || !canConfigureCompany) return;

    const loadT2Config = async () => {
      try {
        const res = await fetch(`/api/company/${currentCompany.id}/view-config`);
        if (res.ok) {
          const data = await res.json();
          setT2Config({
            hotkey: data.hotkey || 'ctrl+shift+t',
            pinEnabled: !!data.pinHash,
            pin: '',
            sessionTimeout: data.sessionTimeout || 30,
          });
        }
      } catch (error) {
        console.error('Error loading T2 config:', error);
      }
    };
    loadT2Config();
  }, [mode, currentCompany?.id, canConfigureCompany]);

  // Load Purchase config
  useEffect(() => {
    if (!canConfigureCompany) return;

    const loadPurchaseConfig = async () => {
      try {
        const res = await fetch('/api/compras/config');
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setPurchaseConfig({
              claveEdicionItems: '', // Don't show current password
              permitirEdicionItems: data.config.permitirEdicionItems ?? true,
              requiereMotivoEdicion: data.config.requiereMotivoEdicion ?? true,
            });
          }
        }
      } catch (error) {
        console.error('Error loading purchase config:', error);
      }
    };
    loadPurchaseConfig();
  }, [canConfigureCompany]);

  // Load Discord Access data
  const fetchDiscordAccessData = useCallback(async () => {
    if (!canConfigureCompany) return;

    setDiscordAccessLoading(true);
    try {
      const res = await fetch('/api/discord/user-access');
      if (res.ok) {
        const data = await res.json();
        setDiscordUsers(data.users || []);
        setDiscordSectors(data.sectors || []);
      }
    } catch (error) {
      console.error('Error loading Discord access data:', error);
    } finally {
      setDiscordAccessLoading(false);
    }
  }, [canConfigureCompany]);

  useEffect(() => {
    fetchDiscordAccessData();
  }, [fetchDiscordAccessData]);

  // Handle tab from URL
  useEffect(() => {
    const desired = normalizeTab(searchParams?.get('tab'));
    if (desired === 'company' && !canConfigureCompany) {
      setActiveTab('profile');
      return;
    }
    setActiveTab(desired);
  }, [searchParams, canConfigureCompany]);

  // Handlers
  const handleSaveProfile = () => {
    if (!profileData.name.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" });
      return;
    }
    saveProfileMutation.mutate({ name: profileData.name, avatar: profileData.avatar });
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Error", description: "Por favor selecciona una imagen válida", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "La imagen debe ser menor a 5MB", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'user');
      formData.append('entityId', user?.id?.toString() || 'temp');
      formData.append('fileType', 'avatar');

      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Error al subir la imagen');

      const data = await response.json();
      setProfileData(prev => ({ ...prev, avatar: data.url }));

      await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: data.url }),
      });

      toast({ title: "Guardado", description: "Foto de perfil actualizada" });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast({ title: "Error", description: "Error al subir la imagen", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveCompany = () => {
    if (!companyData.name.trim()) {
      toast({ title: "Error", description: "El nombre de la empresa es requerido", variant: "destructive" });
      return;
    }
    saveCompanyMutation.mutate({
      name: companyData.name.trim(),
      cuit: companyData.cuit.trim(),
      address: companyData.address.trim(),
      phone: companyData.phone.trim(),
      email: companyData.email.trim(),
      website: companyData.website.trim(),
    });
  };

  const handleCompanyLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>, mode: 'light' | 'dark') => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Error", description: "Por favor selecciona una imagen válida", variant: "destructive" });
      return;
    }

    const setUploading = mode === 'light' ? setIsLogoLightUploading : setIsLogoDarkUploading;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'company');
      formData.append('entityId', currentCompany?.id?.toString() || 'temp');
      formData.append('fileType', `logo-${mode}`);

      const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadResponse.ok) throw new Error('Error al subir la imagen');

      const uploadData = await uploadResponse.json();
      const logoUrl = uploadData.url;

      const updateData: any = {};
      if (mode === 'light') {
        updateData.logoLight = logoUrl;
        if (!companyData.logo) updateData.logo = logoUrl;
      } else {
        updateData.logoDark = logoUrl;
        if (!companyData.logo) updateData.logo = logoUrl;
      }

      const updateResponse = await fetch(`/api/companies/${currentCompany?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!updateResponse.ok) throw new Error('Error al actualizar la empresa');
      const updatedCompany = await updateResponse.json();

      setCompanyData(prev => ({
        ...prev,
        [mode === 'light' ? 'logoLight' : 'logoDark']: logoUrl,
      }));
      updateCurrentCompany(updatedCompany);
      toast({ title: "Guardado", description: `Logo ${mode === 'light' ? 'claro' : 'oscuro'} actualizado` });
    } catch (error) {
      toast({ title: "Error", description: "Error al subir el logo", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Discord handlers
  const handleLinkDiscord = () => {
    if (!discordInput.trim()) {
      toast({ title: 'Error', description: 'Ingresa tu ID de Discord', variant: 'destructive' });
      return;
    }

    // Validar que sea un ID numérico válido (snowflake de Discord)
    if (!/^\d{17,20}$/.test(discordInput.trim())) {
      toast({ title: 'Error', description: 'El ID de Discord debe ser un número de 17-20 dígitos', variant: 'destructive' });
      return;
    }

    linkDiscordMutation.mutate({ discordUserId: discordInput.trim() });
  };

  const handleUnlinkDiscord = () => {
    unlinkDiscordMutation.mutate();
  };

  const handleTestDiscordDM = async () => {
    setDiscordTestLoading(true);
    try {
      const response = await fetch('/api/discord/users/test-dm', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        toast({ title: 'Mensaje enviado', description: 'Revisa tus mensajes directos en Discord' });
      } else {
        throw new Error(data.error || 'Error al enviar mensaje');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo enviar el mensaje de prueba', variant: 'destructive' });
    } finally {
      setDiscordTestLoading(false);
    }
  };

  // T2 Config save handler
  const handleSaveT2Config = () => {
    if (!currentCompany?.id) return;
    saveT2ConfigMutation.mutate({
      enabled: true,
      hotkey: t2Config.hotkey,
      pinEnabled: t2Config.pinEnabled,
      pin: t2Config.pin || undefined,
      sessionTimeout: t2Config.sessionTimeout,
    });
  };

  // Purchase Config save handler
  const handleSavePurchaseConfig = () => {
    savePurchaseConfigMutation.mutate({
      ...(purchaseConfig.claveEdicionItems && { claveEdicionItems: purchaseConfig.claveEdicionItems }),
      permitirEdicionItems: purchaseConfig.permitirEdicionItems,
      requiereMotivoEdicion: purchaseConfig.requiereMotivoEdicion,
    });
  };

  // ===== DISCORD ACCESS MANAGEMENT HANDLERS =====

  // Filtrar usuarios de Discord
  const filteredDiscordUsers = discordUsers.filter(user =>
    user.name.toLowerCase().includes(discordSearchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(discordSearchTerm.toLowerCase())
  );

  // Abrir diálogo para editar accesos
  const openDiscordEditDialog = (user: DiscordUser) => {
    setSelectedDiscordUser(user);
    setDiscordPendingChanges({ add: [], remove: [], update: [] });
    setDiscordExpandedSectors([]);
    setDiscordEditDialogOpen(true);
  };

  // Verificar si el usuario tiene acceso a un sector
  const hasAccessToSector = (sectorId: number): boolean => {
    if (!selectedDiscordUser) return false;
    const hasExisting = selectedDiscordUser.discordSectorAccess.some(a => a.sectorId === sectorId);
    const isPendingAdd = discordPendingChanges.add.some(a => a.sectorId === sectorId);
    const isPendingRemove = discordPendingChanges.remove.includes(sectorId);

    if (hasExisting && !isPendingRemove) return true;
    if (!hasExisting && isPendingAdd) return true;
    return false;
  };

  // Obtener permisos actuales (incluyendo cambios pendientes)
  const getChannelPermissions = (sectorId: number): ChannelPermissions => {
    if (!selectedDiscordUser) {
      return { canViewFallas: true, canViewPreventivos: true, canViewOT: true, canViewGeneral: true };
    }

    const pendingAdd = discordPendingChanges.add.find(a => a.sectorId === sectorId);
    if (pendingAdd) return pendingAdd.perms;

    const existing = selectedDiscordUser.discordSectorAccess.find(a => a.sectorId === sectorId);
    if (existing) {
      const update = discordPendingChanges.update.find(u => u.sectorId === sectorId);
      if (update) {
        return {
          canViewFallas: update.perms.canViewFallas ?? existing.canViewFallas,
          canViewPreventivos: update.perms.canViewPreventivos ?? existing.canViewPreventivos,
          canViewOT: update.perms.canViewOT ?? existing.canViewOT,
          canViewGeneral: update.perms.canViewGeneral ?? existing.canViewGeneral,
        };
      }
      return {
        canViewFallas: existing.canViewFallas,
        canViewPreventivos: existing.canViewPreventivos,
        canViewOT: existing.canViewOT,
        canViewGeneral: existing.canViewGeneral,
      };
    }

    return { canViewFallas: true, canViewPreventivos: true, canViewOT: true, canViewGeneral: true };
  };

  // Toggle acceso a un sector
  const toggleSectorAccess = (sectorId: number) => {
    if (!selectedDiscordUser) return;

    const hasExisting = selectedDiscordUser.discordSectorAccess.some(a => a.sectorId === sectorId);
    const isPendingAdd = discordPendingChanges.add.some(a => a.sectorId === sectorId);
    const isPendingRemove = discordPendingChanges.remove.includes(sectorId);

    if (hasExisting) {
      if (isPendingRemove) {
        setDiscordPendingChanges(prev => ({
          ...prev,
          remove: prev.remove.filter(id => id !== sectorId)
        }));
      } else {
        setDiscordPendingChanges(prev => ({
          ...prev,
          remove: [...prev.remove, sectorId],
          update: prev.update.filter(u => u.sectorId !== sectorId)
        }));
      }
    } else {
      if (isPendingAdd) {
        setDiscordPendingChanges(prev => ({
          ...prev,
          add: prev.add.filter(a => a.sectorId !== sectorId)
        }));
      } else {
        setDiscordPendingChanges(prev => ({
          ...prev,
          add: [...prev.add, {
            sectorId,
            perms: { canViewFallas: true, canViewPreventivos: true, canViewOT: true, canViewGeneral: true }
          }]
        }));
        setDiscordExpandedSectors(prev => [...prev, sectorId]);
      }
    }
  };

  // Toggle permiso de un canal específico
  const toggleChannelPermission = (sectorId: number, channel: 'fallas' | 'preventivos' | 'ot' | 'general') => {
    if (!selectedDiscordUser) return;

    // Mapeo explícito para manejar correctamente la capitalización de 'OT'
    const permKeyMap: Record<string, keyof ChannelPermissions> = {
      fallas: 'canViewFallas',
      preventivos: 'canViewPreventivos',
      ot: 'canViewOT',
      general: 'canViewGeneral',
    };
    const permKey = permKeyMap[channel];
    const currentPerms = getChannelPermissions(sectorId);
    const newValue = !currentPerms[permKey];

    const addIndex = discordPendingChanges.add.findIndex(a => a.sectorId === sectorId);
    if (addIndex >= 0) {
      setDiscordPendingChanges(prev => {
        const newAdd = [...prev.add];
        newAdd[addIndex] = {
          ...newAdd[addIndex],
          perms: { ...newAdd[addIndex].perms, [permKey]: newValue }
        };
        return { ...prev, add: newAdd };
      });
      return;
    }

    const hasExisting = selectedDiscordUser.discordSectorAccess.some(a => a.sectorId === sectorId);
    if (hasExisting) {
      setDiscordPendingChanges(prev => {
        const existingUpdate = prev.update.find(u => u.sectorId === sectorId);
        if (existingUpdate) {
          return {
            ...prev,
            update: prev.update.map(u =>
              u.sectorId === sectorId
                ? { ...u, perms: { ...u.perms, [permKey]: newValue } }
                : u
            )
          };
        }
        return {
          ...prev,
          update: [...prev.update, { sectorId, perms: { [permKey]: newValue } }]
        };
      });
    }
  };

  // Guardar cambios de Discord
  const saveDiscordChanges = () => {
    if (!selectedDiscordUser) return;

    const hasChanges = discordPendingChanges.add.length > 0 ||
                      discordPendingChanges.remove.length > 0 ||
                      discordPendingChanges.update.length > 0;

    if (!hasChanges) {
      setDiscordEditDialogOpen(false);
      return;
    }

    saveDiscordAccessMutation.mutate({
      user: selectedDiscordUser,
      changes: discordPendingChanges,
    });
  };

  // Sincronizar permisos desde Discord
  const syncFromDiscord = () => {
    if (!selectedDiscordUser) return;
    syncFromDiscordMutation.mutate({ userId: selectedDiscordUser.id });
  };

  // Hacer todas las categorías de Discord privadas
  const makeAllCategoriesPrivate = async () => {
    const ok = await confirm({
      title: 'Hacer categorías privadas',
      description: '¿Hacer privadas todas las categorías de sectores en Discord? Solo usuarios con acceso explícito podrán verlas.',
      confirmText: 'Confirmar',
      variant: 'default',
    });
    if (!ok) return;
    makeAllCategoriesPrivateMutation.mutate();
  };

  // Re-sincronizar todos los accesos de Discord
  const resyncAllAccess = async () => {
    const ok = await confirm({
      title: 'Re-sincronizar accesos',
      description: '¿Re-sincronizar todos los accesos de Discord? Esto aplicará los permisos de ORVIT a Discord.',
      confirmText: 'Confirmar',
      variant: 'default',
    });
    if (!ok) return;
    resyncAllAccessMutation.mutate();
  };

  return (
    <TooltipProvider>
    <div className="w-full p-0">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3">
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Personaliza tu experiencia y gestiona tu cuenta
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
        <div className="px-4 md:px-6 pb-3">
          <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Mi Perfil
          </TabsTrigger>
          {canConfigureCompany && (
            <TabsTrigger value="company">
              <Building2 className="h-4 w-4 mr-2" />
              Empresa
            </TabsTrigger>
          )}
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Seguridad
          </TabsTrigger>
          </TabsList>
        </div>

        {/* ====== TAB: PERFIL ====== */}
        <TabsContent value="profile" className="space-y-6 px-4 md:px-6 pb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Información Personal
              </CardTitle>
              <CardDescription>
                Tu información de perfil y foto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profileData.avatar} alt={profileData.name} />
                  <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                    {profileData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={isUploading} asChild>
                      <label className="cursor-pointer">
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {profileData.avatar ? 'Cambiar' : 'Subir'} Foto
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </label>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">JPG, PNG o GIF. Máximo 5MB.</p>
                </div>
              </div>

              <Separator />

              {/* Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Nombre Completo</Label>
                  <Input
                    value={profileData.name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Tu nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={profileData.email} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">El email no se puede cambiar</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={saveProfileMutation.isPending}>
                  {saveProfileMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar Perfil
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Información de Cuenta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Rol</p>
                  <p className="font-medium">{user?.role}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge variant="default">Activo</Badge>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">2FA</p>
                  <Badge variant="secondary">No configurado</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== TAB: EMPRESA ====== */}
        {canConfigureCompany && (
          <TabsContent value="company" className="space-y-6 px-4 md:px-6 pb-6">
            {/* Sub-tabs dentro de Empresa */}
            <Tabs defaultValue="info" className="space-y-6">
              <TabsList>
                <TabsTrigger value="info">
                  <Building2 className="h-4 w-4 mr-2" />
                  Datos
                </TabsTrigger>
                <TabsTrigger value="compras">
                  <Shield className="h-4 w-4 mr-2" />
                  Compras
                </TabsTrigger>
                <TabsTrigger value="discord">
                  <DiscordIcon className="h-4 w-4 mr-2" />
                  Discord
                </TabsTrigger>
                {mode === 'E' && (
                  <TabsTrigger value="viewmode">
                    <Keyboard className="h-4 w-4 mr-2" />
                    ViewMode
                  </TabsTrigger>
                )}
<TabsTrigger value="cotizaciones">
                  <FileText className="h-4 w-4 mr-2" />
                  Cotizaciones
                </TabsTrigger>
              </TabsList>

              {/* Sub-tab: Datos de Empresa */}
              <TabsContent value="info" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Información de la Empresa
                    </CardTitle>
                    <CardDescription>
                      Datos básicos y logos de tu empresa
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Logos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <Sun className="h-4 w-4 text-warning-muted-foreground" />
                          Logo Modo Claro
                        </Label>
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 bg-background border rounded-lg flex items-center justify-center overflow-hidden">
                            {companyData.logoLight || companyData.logo ? (
                              <img src={companyData.logoLight || companyData.logo} alt="Logo claro" className="h-full w-full object-contain p-2" />
                            ) : (
                              <Building2 className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <Button variant="outline" size="sm" disabled={isLogoLightUploading} asChild>
                            <label className="cursor-pointer">
                              {isLogoLightUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Upload className="h-4 w-4 mr-2" />
                              )}
                              Subir
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleCompanyLogoUpload(e, 'light')}
                                className="hidden"
                              />
                            </label>
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <Moon className="h-4 w-4 text-info-muted-foreground" />
                          Logo Modo Oscuro
                        </Label>
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 bg-foreground border rounded-lg flex items-center justify-center overflow-hidden">
                            {companyData.logoDark || companyData.logo ? (
                              <img src={companyData.logoDark || companyData.logo} alt="Logo oscuro" className="h-full w-full object-contain p-2" />
                            ) : (
                              <Building2 className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <Button variant="outline" size="sm" disabled={isLogoDarkUploading} asChild>
                            <label className="cursor-pointer">
                              {isLogoDarkUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Upload className="h-4 w-4 mr-2" />
                              )}
                              Subir
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleCompanyLogoUpload(e, 'dark')}
                                className="hidden"
                              />
                            </label>
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Nombre de la Empresa</Label>
                        <Input
                          value={companyData.name}
                          onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Nombre de la empresa"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CUIT</Label>
                        <Input
                          value={companyData.cuit}
                          onChange={(e) => setCompanyData(prev => ({ ...prev, cuit: e.target.value }))}
                          placeholder="XX-XXXXXXXX-X"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={companyData.email}
                          onChange={(e) => setCompanyData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="contacto@empresa.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Teléfono</Label>
                        <Input
                          value={companyData.phone}
                          onChange={(e) => setCompanyData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="+54 11 1234-5678"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Dirección</Label>
                        <Input
                          value={companyData.address}
                          onChange={(e) => setCompanyData(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="Dirección completa"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Sitio Web</Label>
                        <Input
                          value={companyData.website}
                          onChange={(e) => setCompanyData(prev => ({ ...prev, website: e.target.value }))}
                          placeholder="https://www.empresa.com"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={handleSaveCompany} disabled={saveCompanyMutation.isPending}>
                        {saveCompanyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Guardar Empresa
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sub-tab: Compras Config */}
              <TabsContent value="compras" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-primary" />
                      Seguridad en Compras
                    </CardTitle>
                    <CardDescription>
                      Configura las opciones de seguridad para el módulo de compras
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Permitir edición de items */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Permitir edición de items</Label>
                        <p className="text-sm text-muted-foreground">
                          Habilitar la edición de items al completar OC con factura
                        </p>
                      </div>
                      <Switch
                        checked={purchaseConfig.permitirEdicionItems}
                        onCheckedChange={(checked) => setPurchaseConfig(prev => ({ ...prev, permitirEdicionItems: checked }))}
                      />
                    </div>

                    <Separator />

                    {/* Clave de edición */}
                    {purchaseConfig.permitirEdicionItems && (
                      <>
                        <div className="space-y-2">
                          <Label>Clave para editar items</Label>
                          <p className="text-sm text-muted-foreground mb-2">
                            Esta clave se solicitará al usuario antes de permitir editar items
                          </p>
                          <div className="relative">
                            <Input
                              type={showPurchasePassword ? 'text' : 'password'}
                              value={purchaseConfig.claveEdicionItems}
                              onChange={(e) => setPurchaseConfig(prev => ({ ...prev, claveEdicionItems: e.target.value }))}
                              placeholder="Dejar vacío para mantener la actual"
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                              onClick={() => setShowPurchasePassword(!showPurchasePassword)}
                            >
                              {showPurchasePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        <Separator />

                        {/* Requerir motivo */}
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Requerir motivo de edición</Label>
                            <p className="text-sm text-muted-foreground">
                              Los cambios se registran con trazabilidad completa
                            </p>
                          </div>
                          <Switch
                            checked={purchaseConfig.requiereMotivoEdicion}
                            onCheckedChange={(checked) => setPurchaseConfig(prev => ({ ...prev, requiereMotivoEdicion: checked }))}
                          />
                        </div>
                      </>
                    )}

                    <div className="flex justify-end pt-4">
                      <Button onClick={handleSavePurchaseConfig} disabled={savePurchaseConfigMutation.isPending}>
                        {savePurchaseConfigMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Guardar Configuración
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sub-tab: Discord Access Management */}
              <TabsContent value="discord" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <DiscordIcon className="h-5 w-5 text-[#5865F2]" />
                          Accesos de Discord
                        </CardTitle>
                        <CardDescription>
                          Gestiona qué usuarios pueden ver cada sector en Discord
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={makeAllCategoriesPrivate}
                              disabled={makeAllCategoriesPrivateMutation.isPending}
                            >
                              {makeAllCategoriesPrivateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <EyeOff className="h-4 w-4 mr-2" />
                              )}
                              Hacer privado
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Hace privadas todas las categorías de sectores en Discord
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={resyncAllAccess}
                              disabled={resyncAllAccessMutation.isPending}
                            >
                              {resyncAllAccessMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                              )}
                              Re-sincronizar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Aplica todos los permisos de ORVIT a Discord
                          </TooltipContent>
                        </Tooltip>
                        <Button variant="outline" size="sm" onClick={fetchDiscordAccessData} disabled={discordAccessLoading}>
                          <RefreshCw className={cn("h-4 w-4 mr-2", discordAccessLoading && "animate-spin")} />
                          Actualizar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {discordAccessLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : discordUsers.length === 0 ? (
                      <div className="text-center py-8">
                        <DiscordIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-1">Sin usuarios con Discord</h3>
                        <p className="text-muted-foreground text-sm">
                          Los usuarios deben vincular su cuenta de Discord primero
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar usuario..."
                            value={discordSearchTerm}
                            onChange={(e) => setDiscordSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 bg-muted rounded-lg text-center">
                            <p className="text-xl font-bold">{discordUsers.length}</p>
                            <p className="text-xs text-muted-foreground">Usuarios</p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg text-center">
                            <p className="text-xl font-bold">{discordSectors.length}</p>
                            <p className="text-xs text-muted-foreground">Sectores</p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg text-center">
                            <p className="text-xl font-bold">
                              {discordUsers.reduce((acc, u) => acc + u.discordSectorAccess.length, 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">Accesos</p>
                          </div>
                        </div>

                        {/* Table */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Usuario</TableHead>
                              <TableHead>Sectores</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredDiscordUsers.map((dUser) => (
                              <TableRow key={dUser.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{dUser.name}</p>
                                    <p className="text-xs text-muted-foreground">{dUser.email}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {dUser.discordSectorAccess.length === 0 ? (
                                    <span className="text-muted-foreground text-sm">Sin accesos</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {dUser.discordSectorAccess.map((access) => (
                                        <Tooltip key={access.id}>
                                          <TooltipTrigger>
                                            <Badge variant="secondary" className="text-xs cursor-help">
                                              {access.sector.name}
                                              {(!access.canViewFallas || !access.canViewPreventivos ||
                                                !access.canViewOT || !access.canViewGeneral) && (
                                                <span className="ml-1 text-warning-muted-foreground">*</span>
                                              )}
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <div className="text-xs space-y-1">
                                              <div className={access.canViewFallas ? 'text-success' : 'text-destructive'}>
                                                {access.canViewFallas ? '✓' : '✗'} Fallas
                                              </div>
                                              <div className={access.canViewPreventivos ? 'text-success' : 'text-destructive'}>
                                                {access.canViewPreventivos ? '✓' : '✗'} Preventivos
                                              </div>
                                              <div className={access.canViewOT ? 'text-success' : 'text-destructive'}>
                                                {access.canViewOT ? '✓' : '✗'} OT
                                              </div>
                                              <div className={access.canViewGeneral ? 'text-success' : 'text-destructive'}>
                                                {access.canViewGeneral ? '✓' : '✗'} General
                                              </div>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      ))}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openDiscordEditDialog(dUser)}
                                  >
                                    <Shield className="h-4 w-4 mr-1" />
                                    Gestionar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sub-tab: ViewMode Config (solo en modo E) */}
              {mode === 'E' && (
                <TabsContent value="viewmode" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5 text-primary" />
                        Configuración de ViewMode
                      </CardTitle>
                      <CardDescription>
                        Configura el atajo de teclado y seguridad para cambiar de modo
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Hotkey */}
                      <div className="space-y-2">
                        <Label>Atajo de Teclado</Label>
                        <Input
                          value={t2Config.hotkey}
                          onChange={(e) => setT2Config(prev => ({ ...prev, hotkey: e.target.value }))}
                          placeholder="ctrl+shift+t"
                        />
                        <p className="text-xs text-muted-foreground">
                          Combinación de teclas para activar/desactivar el modo (ej: ctrl+shift+t)
                        </p>
                      </div>

                      <Separator />

                      {/* PIN */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Requerir PIN</Label>
                            <p className="text-sm text-muted-foreground">
                              Solicitar PIN de seguridad al activar el modo
                            </p>
                          </div>
                          <Switch
                            checked={t2Config.pinEnabled}
                            onCheckedChange={(checked) => setT2Config(prev => ({ ...prev, pinEnabled: checked }))}
                          />
                        </div>

                        {t2Config.pinEnabled && (
                          <div className="space-y-2">
                            <Label>PIN</Label>
                            <div className="relative">
                              <Input
                                type={showT2Pin ? 'text' : 'password'}
                                value={t2Config.pin}
                                onChange={(e) => setT2Config(prev => ({ ...prev, pin: e.target.value }))}
                                placeholder="Dejar vacío para mantener el actual"
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                onClick={() => setShowT2Pin(!showT2Pin)}
                              >
                                {showT2Pin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Session Timeout */}
                      <div className="space-y-2">
                        <Label>Tiempo de Sesión (minutos)</Label>
                        <Input
                          type="number"
                          value={t2Config.sessionTimeout}
                          onChange={(e) => setT2Config(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) || 30 }))}
                          min={5}
                          max={480}
                        />
                        <p className="text-xs text-muted-foreground">
                          El modo se desactiva automáticamente después de este tiempo de inactividad
                        </p>
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button onClick={handleSaveT2Config} disabled={saveT2ConfigMutation.isPending}>
                          {saveT2ConfigMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Guardar Configuración
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

{/* Sub-tab: Cotizaciones */}
              <TabsContent value="cotizaciones" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Templates de Cotización
                    </CardTitle>
                    <CardDescription>
                      Configurá el diseño del presupuesto que ven tus clientes: logo, colores, columnas, firma y condiciones de pago.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => router.push('/administracion/configuracion/cotizaciones')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir editor de templates
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}

        {/* ====== TAB: NOTIFICACIONES ====== */}
        <TabsContent value="notifications" className="space-y-6 px-4 md:px-6 pb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notificaciones del Sistema
              </CardTitle>
              <CardDescription>
                Configura cómo y cuándo recibir notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificaciones por email</Label>
                  <p className="text-sm text-muted-foreground">Recibir notificaciones importantes por email</p>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificaciones push</Label>
                  <p className="text-sm text-muted-foreground">Mostrar notificaciones en el navegador</p>
                </div>
                <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Tareas y vencimientos</Label>
                  <p className="text-sm text-muted-foreground">Avisos sobre tareas asignadas</p>
                </div>
                <Switch checked={taskNotifications} onCheckedChange={setTaskNotifications} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Recordatorios de agenda</Label>
                  <p className="text-sm text-muted-foreground">Recordatorios de eventos y citas</p>
                </div>
                <Switch checked={reminderNotifications} onCheckedChange={setReminderNotifications} />
              </div>
            </CardContent>
          </Card>

          {/* Tema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-primary" />
                Apariencia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label>Tema de la aplicación</Label>
                <div className="flex gap-2">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Claro
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Oscuro
                  </Button>
                </div>
              </div>

              {/* Tamaño de texto */}
              <div className="space-y-3 pt-4 border-t border-border">
                <Label>Tamaño de texto</Label>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">A</span>
                  <Slider
                    value={[fontSize]}
                    onValueChange={([v]) => setFontSize(v, true)}
                    onValueCommit={([v]) => setFontSize(v)}
                    min={14}
                    max={22}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-lg font-medium text-muted-foreground">A</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {fontSize}px {fontSize === 16 && '(predeterminado)'}
                  </p>
                  {fontSize !== 16 && (
                    <Button variant="ghost" size="sm" onClick={resetFontSize}>
                      Restablecer
                    </Button>
                  )}
                </div>
              </div>

              {/* Ajustes individuales — colapsable */}
              <details className="pt-4 border-t border-border group/details">
                <summary className="flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open/details:rotate-90" />
                    <Label className="cursor-pointer">Ajustes por elemento</Label>
                    {hasOverrides && (
                      <Badge variant="secondary" className="text-xs">
                        {Object.values(overrides).filter(v => v > 0).length} ajustado{Object.values(overrides).filter(v => v > 0).length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  {hasOverrides && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 text-muted-foreground" onClick={(e) => { e.preventDefault(); resetAll(); }}>
                      Restablecer
                    </Button>
                  )}
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {([
                    { key: 'tabs' as const, label: 'Pestañas', icon: '⊞', steps: ['0.75rem', '0.875rem', '1rem'] },
                    { key: 'tables' as const, label: 'Tablas', icon: '▤', steps: ['0.875rem', '1rem', '1.125rem'] },
                    { key: 'sidebar' as const, label: 'Barra lateral', icon: '☰', steps: ['0.875rem', '1rem', '1.125rem'] },
                    { key: 'headings' as const, label: 'Títulos', icon: 'H', steps: ['1.5rem', '1.875rem', '2.25rem'] },
                    { key: 'buttons' as const, label: 'Botones', icon: '▢', steps: ['0.875rem', '1rem', '1.125rem'] },
                    { key: 'forms' as const, label: 'Formularios', icon: '⊡', steps: ['0.875rem', '1rem', '1.125rem'] },
                    { key: 'kpis' as const, label: 'KPIs', icon: '#', steps: ['1.5rem', '1.875rem', '2.25rem'] },
                    { key: 'descriptions' as const, label: 'Descripciones', icon: '¶', steps: ['0.875rem', '1rem', '1.125rem'] },
                  ] as const).map(({ key, label, icon, steps: stepValues }) => (
                    <div key={key} className={cn(
                      'rounded-lg border p-2.5 space-y-2 transition-colors',
                      overrides[key] > 0 ? 'border-primary/30 bg-primary/5' : 'border-border'
                    )}>
                      {/* Header + preview text */}
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground font-mono shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Ejemplo: <span style={{ fontSize: stepValues[overrides[key]] }}>Abc</span>
                          </p>
                        </div>
                      </div>
                      {/* Compact selector */}
                      <div className="flex gap-1">
                        {['N', 'G', 'XG'].map((stepLabel, i) => (
                          <button
                            key={i}
                            title={['Normal', 'Grande', 'Muy grande'][i]}
                            className={cn(
                              'flex-1 rounded py-1 text-[10px] font-medium transition-colors',
                              overrides[key] === i
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-muted text-muted-foreground hover:text-foreground'
                            )}
                            onClick={() => setOverride(key, i)}
                          >
                            {stepLabel}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>

          {/* Discord */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-[#5865F2]" />
                Discord
                {discordStatus.linked && <Badge className="bg-[#5865F2]/20 text-[#5865F2]">Vinculado</Badge>}
              </CardTitle>
              <CardDescription>
                Recibir notificaciones por mensaje directo en Discord
              </CardDescription>
            </CardHeader>
            <CardContent>
              {discordLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : discordStatus.linked ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-[#5865F2]/10 rounded-lg">
                    <Check className="h-5 w-5 text-[#5865F2]" />
                    <div>
                      <p className="text-sm font-medium">Discord vinculado</p>
                      <p className="text-xs text-muted-foreground font-mono">{discordStatus.discordUserId}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestDiscordDM}
                      disabled={discordTestLoading}
                    >
                      {discordTestLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Enviar prueba
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnlinkDiscord}
                      disabled={unlinkDiscordMutation.isPending}
                    >
                      {unlinkDiscordMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Unlink className="h-4 w-4 mr-2" />
                      )}
                      Desvincular
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium mb-1">Para obtener tu ID de Discord:</p>
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                          <li>Abre Discord y ve a Configuración</li>
                          <li>Ve a Avanzado y activa &quot;Modo desarrollador&quot;</li>
                          <li>Click derecho en tu usuario y selecciona &quot;Copiar ID de usuario&quot;</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Tu ID de Discord (ej: 123456789012345678)"
                      value={discordInput}
                      onChange={(e) => setDiscordInput(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleLinkDiscord}
                      disabled={linkDiscordMutation.isPending || !discordInput.trim()}
                      className="bg-[#5865F2] hover:bg-[#4752C4]"
                    >
                      {linkDiscordMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <LinkIcon className="h-4 w-4 mr-2" />
                      )}
                      Vincular
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== TAB: SEGURIDAD ====== */}
        <TabsContent value="security" className="space-y-6 px-4 md:px-6 pb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Cambio de Contraseña
              </CardTitle>
              <CardDescription>
                Para cambiar tu contraseña, contacta con el administrador del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Por seguridad, el cambio de contraseña debe ser solicitado al administrador.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Consejos de Seguridad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Usa contraseñas únicas y seguras
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  No compartas tu información de acceso
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Cierra sesión al terminar
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Revisa regularmente tu actividad
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para editar accesos Discord */}
      <Dialog open={discordEditDialogOpen} onOpenChange={setDiscordEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Accesos de {selectedDiscordUser?.name}
            </DialogTitle>
            <DialogDescription>
              Configura qué sectores y canales puede ver este usuario en Discord
            </DialogDescription>
          </DialogHeader>

          {/* Botón sincronizar desde Discord */}
          <div className="flex items-center justify-between py-2 px-1 border-b">
            <p className="text-xs text-muted-foreground">
              Importar permisos actuales desde Discord
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={syncFromDiscord}
              disabled={syncFromDiscordMutation.isPending}
            >
              {syncFromDiscordMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar desde Discord
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-2">
            {discordSectors.map((sector) => {
              const hasAccess = hasAccessToSector(sector.id);
              const isPendingAdd = discordPendingChanges.add.some(a => a.sectorId === sector.id);
              const isPendingRemove = discordPendingChanges.remove.includes(sector.id);
              const hasCategory = !!sector.discordCategoryId;
              const isExpanded = discordExpandedSectors.includes(sector.id);
              const perms = getChannelPermissions(sector.id);

              return (
                <Collapsible
                  key={sector.id}
                  open={isExpanded && hasAccess}
                  onOpenChange={(open) => {
                    if (open) {
                      setDiscordExpandedSectors(prev => [...prev, sector.id]);
                    } else {
                      setDiscordExpandedSectors(prev => prev.filter(id => id !== sector.id));
                    }
                  }}
                >
                  <div
                    className={cn(
                      "rounded-lg border transition-colors",
                      hasAccess ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50",
                      isPendingAdd && "border-success-muted/50 bg-success/5",
                      isPendingRemove && "border-destructive/30/50 bg-destructive/5",
                      !hasCategory && "opacity-50"
                    )}
                  >
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer"
                      onClick={() => hasCategory && toggleSectorAccess(sector.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={hasAccess}
                          disabled={!hasCategory}
                          className="pointer-events-none"
                        />
                        <div>
                          <p className="font-medium text-sm">{sector.name}</p>
                          {!hasCategory && (
                            <p className="text-xs text-muted-foreground">
                              Sin categoría Discord
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPendingAdd && (
                          <Badge variant="outline" className="text-success border-success text-xs">
                            Agregar
                          </Badge>
                        )}
                        {isPendingRemove && (
                          <Badge variant="outline" className="text-destructive border-destructive text-xs">
                            Quitar
                          </Badge>
                        )}
                        {hasAccess && !isPendingRemove && (
                          <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        )}
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-1 border-t">
                        <p className="text-xs text-muted-foreground mb-2">
                          Canales que puede ver:
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {CHANNEL_TYPES.map((channel) => {
                            const Icon = channel.icon;
                            // Mapeo para manejar 'ot' → 'canViewOT' correctamente
                            const permKeyMap: Record<string, keyof ChannelPermissions> = {
                              fallas: 'canViewFallas',
                              preventivos: 'canViewPreventivos',
                              ot: 'canViewOT',
                              general: 'canViewGeneral',
                            };
                            const isEnabled = perms[permKeyMap[channel.key]];

                            return (
                              <div
                                key={channel.key}
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
                                  isEnabled ? "bg-background border-primary/30" : "bg-muted/50 border-transparent"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleChannelPermission(sector.id, channel.key as any);
                                }}
                              >
                                <Switch
                                  checked={isEnabled}
                                  className="pointer-events-none scale-75"
                                />
                                <Icon className={cn("h-4 w-4", channel.color)} />
                                <span className="text-xs">{channel.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setDiscordEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={saveDiscordChanges}
              disabled={saveDiscordAccessMutation.isPending || (
                discordPendingChanges.add.length === 0 &&
                discordPendingChanges.remove.length === 0 &&
                discordPendingChanges.update.length === 0
              )}
            >
              {saveDiscordAccessMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
