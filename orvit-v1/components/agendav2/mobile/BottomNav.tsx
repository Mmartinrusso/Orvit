'use client';

import { Home, ListTodo, Plus, BarChart2, User } from 'lucide-react';

export type MobileTab = 'home' | 'tasks' | 'dashboard' | 'profile';

interface BottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onCreateTask: () => void;
}

const LEFT_TABS = [
  { id: 'home' as MobileTab, icon: Home, label: 'Inicio' },
  { id: 'tasks' as MobileTab, icon: ListTodo, label: 'Tareas' },
];

const RIGHT_TABS = [
  { id: 'dashboard' as MobileTab, icon: BarChart2, label: 'Dashboard' },
  { id: 'profile' as MobileTab, icon: User, label: 'Perfil' },
];

export function BottomNav({ activeTab, onTabChange, onCreateTask }: BottomNavProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        backgroundColor: '#FFFFFF',
        boxShadow: '0 -1px 0 rgba(0,0,0,0.06), 0 -4px 16px rgba(0,0,0,0.04)',
        paddingTop: '8px',
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
        paddingLeft: '8px',
        paddingRight: '8px',
      }}
    >
      {LEFT_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className="flex flex-col items-center gap-0.5 min-w-[56px] py-1"
          style={{ color: activeTab === tab.id ? '#0f172a' : '#94a3b8' }}
        >
          <tab.icon
            className="h-5 w-5"
            strokeWidth={activeTab === tab.id ? 2.5 : 1.75}
          />
          <span style={{ fontSize: '10px', fontWeight: activeTab === tab.id ? 600 : 400 }}>
            {tab.label}
          </span>
        </button>
      ))}

      {/* Central FAB */}
      <button
        onClick={onCreateTask}
        className="flex items-center justify-center -mt-4 rounded-full active:scale-95 transition-transform"
        style={{
          width: '52px',
          height: '52px',
          backgroundColor: '#06b6d4',
          boxShadow: '0 4px 16px rgba(6,182,212,0.4)',
        }}
      >
        <Plus className="h-5 w-5 text-white" strokeWidth={2.5} />
      </button>

      {RIGHT_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className="flex flex-col items-center gap-0.5 min-w-[56px] py-1"
          style={{ color: activeTab === tab.id ? '#0f172a' : '#94a3b8' }}
        >
          <tab.icon
            className="h-5 w-5"
            strokeWidth={activeTab === tab.id ? 2.5 : 1.75}
          />
          <span style={{ fontSize: '10px', fontWeight: activeTab === tab.id ? 600 : 400 }}>
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
}
