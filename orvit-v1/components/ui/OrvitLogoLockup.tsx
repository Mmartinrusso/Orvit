'use client';

import { cn } from '@/lib/utils';
import OrvitLogoMotion from './OrvitLogoMotion';

interface OrvitLogoLockupProps {
  size?: number;
  showText?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
}

export default function OrvitLogoLockup({
  size = 200,
  showText = true,
  theme = 'dark',
  className = ''
}: OrvitLogoLockupProps) {
  const textColor = theme === 'dark' ? 'text-white' : 'text-black';

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <OrvitLogoMotion
        size={size}
        density={100}
        speed={0.5}
        lineDistance={60}
        glow={true}
        theme={theme}
      />
      {showText && (
        <span
          className={cn('font-light tracking-[0.3em] text-lg', textColor)}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          ORVIT
        </span>
      )}
    </div>
  );
}
