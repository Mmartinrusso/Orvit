'use client';

import { OperatorHero } from './OperatorHero';
import { SupervisorHero } from './SupervisorHero';
import { ManagerHero } from './ManagerHero';

interface DashboardHeroSectionProps {
  userRole: string;
  companyId: number;
  sectorId?: number | null;
  userId: number;
}

export function DashboardHeroSection({
  userRole,
  companyId,
  sectorId,
  userId,
}: DashboardHeroSectionProps) {
  switch (userRole) {
    case 'ADMIN':
    case 'SUPERADMIN':
    case 'ADMIN_ENTERPRISE':
      return <ManagerHero companyId={companyId} sectorId={sectorId} userId={userId} />;
    case 'SUPERVISOR':
      return <SupervisorHero companyId={companyId} sectorId={sectorId} userId={userId} />;
    case 'USER':
    default:
      return <OperatorHero companyId={companyId} sectorId={sectorId} userId={userId} />;
  }
}
