import type { ReactNode } from 'react';

export function KpiCardFrame({
  title,
  pill,
  children,
}: {
  title: ReactNode;
  pill?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '12px',
      padding: '20px',
      height: '100%',
      boxShadow: '0 1px 4px rgba(0,0,0,.04)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{
          fontSize: '12px', fontWeight: 500, color: '#9CA3AF',
          letterSpacing: '0.01em',
        }}>
          {title}
        </span>
        {pill}
      </div>
      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

export function KpiPill({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: '999px',
      background: '#EDE9FE',
      fontSize: '12px', fontWeight: 500, color: '#7C3AED',
      gap: '4px',
    }}>
      {children}
    </div>
  );
}
