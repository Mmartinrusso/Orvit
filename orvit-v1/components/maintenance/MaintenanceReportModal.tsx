'use client';

import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, LayoutList, LayoutGrid, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
 MaintenanceReportModalProps,
 MaintenanceReportItem,
 MaintenanceGroup,
 MachineSection,
 SummaryCard,
 BadgeTone,
 getBadgeBgClass,
 getSummaryCardClass,
 getSummaryLabelClass,
 getSummaryValueClass,
 getMaintenanceBorderClass,
} from '@/types/maintenance-report';

// ============================================
// SVG ICONS AS STRINGS (for print compatibility)
// ============================================

const SVG_ICONS = {
 wrench: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
 calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>`,
 clock: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
 check: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>`,
 cog: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
 box: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>`,
 list: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"></line><line x1="8" x2="21" y1="12" y2="12"></line><line x1="8" x2="21" y1="18" y2="18"></line><line x1="3" x2="3.01" y1="6" y2="6"></line><line x1="3" x2="3.01" y1="12" y2="12"></line><line x1="3" x2="3.01" y1="18" y2="18"></line></svg>`,
};

// ============================================
// BADGE COLORS MAP
// ============================================

const BADGE_COLORS: Record<BadgeTone, { bg: string; text: string; border: string }> = {
 green: { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
 yellow: { bg: '#fef9c3', text: '#a16207', border: '#fef08a' },
 orange: { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' },
 red: { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' },
 blue: { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
 purple: { bg: '#f3e8ff', text: '#7e22ce', border: '#e9d5ff' },
 gray: { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
 amber: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
};

const BORDER_LEFT_COLORS: Record<BadgeTone, string> = {
 green: '#22c55e',
 yellow: '#eab308',
 orange: '#f97316',
 red: '#ef4444',
 blue: '#3b82f6',
 purple: '#a855f7',
 gray: '#6b7280',
 amber: '#f59e0b',
};

// ============================================
// GENERATE PRINTABLE HTML
// ============================================

function generatePrintHTML(report: MaintenanceReportModalProps['report']): string {
 const totalMachines = report.machines.length;
 const totalItems = report.machines.reduce((acc, m) => acc + m.totalCount, 0);
 const totalDuration = report.machines.reduce((acc, machine) => {
 return acc + machine.groups.reduce((gAcc, group) => {
 return gAcc + group.items.reduce((iAcc, item) => {
 const match = item.durationLabel.match(/(\d+)/);
 return iAcc + (match ? parseInt(match[1]) : 0);
 }, 0);
 }, 0);
 }, 0);

 const durationDisplay = totalDuration > 0 
 ? totalDuration >= 60 
 ? `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m` 
 : `${totalDuration} min`
 : '—';

 // Collect all maintenance types
 const allTypes = new Set<string>();
 report.machines.forEach(m => m.groups.forEach(g => allTypes.add(g.title.replace(/\s*\(\d+\)/, ''))));

 const machinesHTML = report.machines.map((machine, mIdx) => {
 const groupsHTML = machine.groups.map(group => {
 const itemsHTML = group.items.map(item => {
 const tagsHTML = item.tags.map(tag => {
 const colors = BADGE_COLORS[tag.tone];
 return `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:${colors.bg};color:${colors.text};border:1px solid ${colors.border};margin-right:4px;">${tag.label}</span>`;
 }).join('');

 return `
 <div style="background:#fff;border:1px solid #e5e7eb;border-left:4px solid ${BORDER_LEFT_COLORS[group.tone]};border-radius:6px;padding:12px;margin-bottom:8px;break-inside:avoid;page-break-inside:avoid;">
 <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
 <div style="flex:1;min-width:0;">
 <div style="font-weight:600;color:#111827;font-size:12px;margin-bottom:4px;">${item.name}</div>
 <div style="color:#6b7280;font-size:10px;margin-bottom:6px;white-space:pre-line;line-height:1.4;">${item.description}</div>
 <div style="display:flex;flex-wrap:wrap;gap:12px;color:#6b7280;font-size:10px;">
 <span style="display:inline-flex;align-items:center;gap:3px;">
 ${SVG_ICONS.calendar}
 ${item.frequencyLabel}
 </span>
 ${item.durationLabel ? `<span style="display:inline-flex;align-items:center;gap:3px;">${SVG_ICONS.clock} ${item.durationLabel}</span>` : ''}
 ${item.nextDateLabel ? `<span style="display:inline-flex;align-items:center;gap:3px;">${SVG_ICONS.calendar} Próx: ${item.nextDateLabel}</span>` : ''}
 </div>
 </div>
 <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
 ${tagsHTML}
 </div>
 </div>
 </div>
 `;
 }).join('');

 return `
 <div style="margin-bottom:16px;">
 <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
 <span style="color:${BORDER_LEFT_COLORS[group.tone]};">${SVG_ICONS.wrench}</span>
 <span style="font-weight:600;color:#374151;font-size:12px;">${group.title} (${group.count})</span>
 </div>
 ${itemsHTML}
 </div>
 `;
 }).join('');

 return `
 <div style="margin-bottom:24px;break-inside:avoid-page;page-break-inside:avoid;">
 <!-- Machine Header -->
 <div style="background:linear-gradient(to right,#eff6ff,#eef2ff);border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:12px;">
 <div style="display:flex;justify-content:space-between;align-items:center;">
 <div style="display:flex;align-items:center;gap:10px;">
 <div style="width:36px;height:36px;background:#3b82f6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;">
 ${SVG_ICONS.cog}
 </div>
 <div>
 <div style="font-weight:700;color:#111827;font-size:14px;">${machine.name}</div>
 <div style="color:#6b7280;font-size:11px;">${machine.totalCount} mantenimientos</div>
 </div>
 </div>
 <div style="text-align:right;">
 ${machine.metaRightTop ? `<div style="font-size:10px;color:#6b7280;">${machine.metaRightTop}</div>` : ''}
 ${machine.metaRightBottom ? `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:9999px;font-size:9px;font-weight:500;background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;">${machine.metaRightBottom}</span>` : ''}
 </div>
 </div>
 </div>
 <!-- Groups -->
 ${groupsHTML}
 </div>
 `;
 }).join('');

 const filtersHTML = report.appliedFilters.length > 0 
 ? report.appliedFilters.map(f => 
 `<span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:9999px;font-size:10px;background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;margin:2px;">${f.label}: ${f.value}</span>`
 ).join('')
 : '';

 return `
 <!DOCTYPE html>
 <html>
 <head>
 <meta charset="utf-8">
 <title>Listado de Mantenimientos - ${report.companyName}</title>
 <style>
 @page {
 size: A4 portrait;
 margin: 15mm 12mm 20mm 12mm;
 }
 
 @media print {
 .page-header { position: running(header); }
 .page-footer { position: running(footer); }
 @page { @top-center { content: element(header); } }
 @page { @bottom-center { content: element(footer); } }
 }
 
 * {
 box-sizing: border-box;
 -webkit-print-color-adjust: exact !important;
 print-color-adjust: exact !important;
 }
 
 body {
 font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
 margin: 0;
 padding: 0;
 background: white;
 color: #111827;
 font-size: 11px;
 line-height: 1.4;
 }
 
 .container {
 max-width: 100%;
 padding: 0;
 }
 
 .header {
 border-bottom: 2px solid #e5e7eb;
 padding-bottom: 12px;
 margin-bottom: 16px;
 }
 
 .header-top {
 display: flex;
 justify-content: space-between;
 align-items: flex-start;
 margin-bottom: 8px;
 }
 
 .company-name {
 font-size: 18px;
 font-weight: 700;
 color: #111827;
 }
 
 .report-title {
 font-size: 13px;
 color: #6b7280;
 margin-top: 2px;
 }
 
 .date-info {
 text-align: right;
 font-size: 10px;
 color: #9ca3af;
 }
 
 .kpi-grid {
 display: grid;
 grid-template-columns: repeat(4, 1fr);
 gap: 10px;
 margin-bottom: 16px;
 }
 
 .kpi-card {
 border: 1px solid #e5e7eb;
 border-radius: 8px;
 padding: 10px;
 text-align: center;
 }
 
 .kpi-label {
 font-size: 9px;
 font-weight: 500;
 text-transform: uppercase;
 letter-spacing: 0.5px;
 margin-bottom: 4px;
 }
 
 .kpi-value {
 font-size: 16px;
 font-weight: 700;
 }
 
 .filters-section {
 background: #f9fafb;
 border-radius: 6px;
 padding: 10px;
 margin-bottom: 16px;
 }
 
 .filters-title {
 font-size: 10px;
 font-weight: 600;
 color: #374151;
 margin-bottom: 6px;
 }
 
 .filters-list {
 display: flex;
 flex-wrap: wrap;
 gap: 4px;
 }
 
 .footer {
 margin-top: 20px;
 padding-top: 10px;
 border-top: 1px solid #e5e7eb;
 display: flex;
 justify-content: space-between;
 font-size: 9px;
 color: #9ca3af;
 }
 </style>
 </head>
 <body>
 <div class="container">
 <!-- Header -->
 <div class="header">
 <div class="header-top">
 <div>
 <div class="company-name">${report.companyName}</div>
 <div class="report-title">${report.title}</div>
 </div>
 <div class="date-info">
 <div>Generado: ${report.generatedAt}</div>
 <div style="margin-top:2px;">Documento de inventario</div>
 </div>
 </div>
 </div>
 
 <!-- KPIs -->
 <div class="kpi-grid">
 <div class="kpi-card" style="background:#eff6ff;border-color:#bfdbfe;">
 <div class="kpi-label" style="color:#2563eb;">Máquinas</div>
 <div class="kpi-value" style="color:#1e40af;">${totalMachines}</div>
 </div>
 <div class="kpi-card" style="background:#f0fdf4;border-color:#bbf7d0;">
 <div class="kpi-label" style="color:#16a34a;">Total Ítems</div>
 <div class="kpi-value" style="color:#166534;">${totalItems}</div>
 </div>
 <div class="kpi-card" style="background:#faf5ff;border-color:#e9d5ff;">
 <div class="kpi-label" style="color:#9333ea;">Tipos</div>
 <div class="kpi-value" style="color:#7e22ce;font-size:11px;">${Array.from(allTypes).slice(0, 2).map(t => t.replace('Mantenimientos ', '').replace('Mantenimiento ', '')).join(', ')}</div>
 </div>
 <div class="kpi-card" style="background:#fff7ed;border-color:#fed7aa;">
 <div class="kpi-label" style="color:#ea580c;">Tiempo Est.</div>
 <div class="kpi-value" style="color:#9a3412;">${durationDisplay}</div>
 </div>
 </div>
 
 <!-- Filters -->
 ${filtersHTML ? `
 <div class="filters-section">
 <div class="filters-title">Filtros aplicados:</div>
 <div class="filters-list">${filtersHTML}</div>
 </div>
 ` : ''}
 
 <!-- Machines -->
 ${machinesHTML}
 
 <!-- Footer -->
 <div class="footer">
 <span>Listado generado automáticamente • Sistema de Mantenimiento</span>
 <span>${report.generatedAt}</span>
 </div>
 </div>
 </body>
 </html>
 `;
}

// ============================================
// BADGE COMPONENT (for screen)
// ============================================

interface BadgeProps {
 label: string;
 tone: BadgeTone;
 size?: 'sm' | 'md';
}

function Badge({ label, tone, size = 'md' }: BadgeProps) {
 return (
 <span
 className={cn(
 'inline-flex items-center rounded-full border font-semibold whitespace-nowrap',
 size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-0.5',
 getBadgeBgClass(tone)
 )}
 >
 {label}
 </span>
 );
}

// ============================================
// KPI CARD COMPONENT
// ============================================

interface KPICardProps {
 label: string;
 value: string | number;
 tone: BadgeTone;
}

function KPICard({ label, value, tone }: KPICardProps) {
 return (
 <div className={cn('rounded-lg border p-3 text-center', getSummaryCardClass(tone))}>
 <div className={cn('text-xs font-medium uppercase tracking-wide mb-1', getSummaryLabelClass(tone))}>
 {label}
 </div>
 <div className={cn('text-lg font-bold', getSummaryValueClass(tone))}>
 {value}
 </div>
 </div>
 );
}

// ============================================
// MACHINE BLOCK COMPONENT
// ============================================

interface MachineBlockProps {
 machine: MachineSection;
 compact: boolean;
}

function MachineBlock({ machine, compact }: MachineBlockProps) {
 return (
 <div className="mb-6 last:mb-0">
 {/* Machine Header */}
 <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-info-muted rounded-lg p-3 mb-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-info-muted0 rounded-lg flex items-center justify-center text-white">
 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
 <circle cx="12" cy="12" r="3"></circle>
 </svg>
 </div>
 <div>
 <h3 className="font-bold text-foreground text-base">{machine.name}</h3>
 <p className="text-xs text-foreground">{machine.totalCount} mantenimientos</p>
 </div>
 </div>
 <div className="text-right flex flex-col items-end gap-1">
 {machine.metaRightTop && (
 <span className="text-xs text-muted-foreground">{machine.metaRightTop}</span>
 )}
 {machine.metaRightBottom && (
 <Badge label={machine.metaRightBottom} tone="green" size="sm" />
 )}
 </div>
 </div>
 </div>

 {/* Groups */}
 {machine.groups.map((group, gIdx) => (
 <div key={gIdx} className="mb-4 last:mb-0">
 <div className="flex items-center gap-2 mb-2">
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn('text-muted-foreground', group.tone === 'green' && 'text-success', group.tone === 'red' && 'text-destructive', group.tone === 'amber' && 'text-warning-muted-foreground')}>
 <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
 </svg>
 <span className="font-semibold text-foreground text-sm">{group.title} ({group.count})</span>
 </div>

 {/* Items */}
 <div className={cn('space-y-2', compact && 'space-y-1')}>
 {group.items.map((item) => (
 <div
 key={item.id}
 className={cn(
 'bg-background border rounded-lg border-l-4',
 getMaintenanceBorderClass(group.tone),
 compact ? 'p-2' : 'p-3'
 )}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1 min-w-0">
 <div className={cn('font-semibold text-foreground', compact ? 'text-xs' : 'text-sm')}>
 {item.name}
 </div>
 {!compact && item.description && (
 <p className="text-xs text-foreground mt-1 whitespace-pre-line line-clamp-2">
 {item.description}
 </p>
 )}
 <div className={cn('flex items-center gap-3 text-muted-foreground flex-wrap', compact ? 'mt-1 text-xs' : 'mt-2 text-xs')}>
 <span className="flex items-center gap-1">
 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path>
 </svg>
 {item.frequencyLabel}
 </span>
 {item.durationLabel && (
 <span className="flex items-center gap-1">
 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
 </svg>
 {item.durationLabel}
 </span>
 )}
 </div>
 </div>
 <div className={cn('flex gap-1 flex-shrink-0', compact ? 'flex-row flex-wrap justify-end' : 'flex-col')}>
 {item.tags.map((tag, tIdx) => (
 <Badge key={tIdx} label={tag.label} tone={tag.tone} size="sm" />
 ))}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 );
}

// ============================================
// MAIN MODAL COMPONENT
// ============================================

export function MaintenanceReportModal({
 open,
 onOpenChange,
 report,
}: MaintenanceReportModalProps) {
 const [mounted, setMounted] = useState(false);
 const [compact, setCompact] = useState(false);
 const [searchTerm, setSearchTerm] = useState('');
 const [showAllFilters, setShowAllFilters] = useState(false);

 useEffect(() => {
 setMounted(true);
 }, []);

 // Calculate totals
 const totalMachines = report.machines.length;
 const totalItems = report.machines.reduce((acc, m) => acc + m.totalCount, 0);
 const totalDuration = report.machines.reduce((acc, machine) => {
 return acc + machine.groups.reduce((gAcc, group) => {
 return gAcc + group.items.reduce((iAcc, item) => {
 const match = item.durationLabel.match(/(\d+)/);
 return iAcc + (match ? parseInt(match[1]) : 0);
 }, 0);
 }, 0);
 }, 0);

 const durationDisplay = totalDuration > 0 
 ? totalDuration >= 60 
 ? `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m` 
 : `${totalDuration} min`
 : '—';

 // Collect all maintenance types
 const allTypes = new Set<string>();
 report.machines.forEach(m => m.groups.forEach(g => allTypes.add(g.title.replace(/\s*\(\d+\)/, '').replace('Mantenimientos ', '').replace('Mantenimiento ', ''))));

 // Filter machines by search
 const filteredMachines = searchTerm
 ? report.machines.filter(m => 
 m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 m.groups.some(g => g.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())))
 )
 : report.machines;

 // Handle print
 const handlePrint = useCallback(() => {
 const printWindow = window.open('', '_blank');
 if (!printWindow) {
 toast.warning('Por favor permite las ventanas emergentes para imprimir');
 return;
 }

 const html = generatePrintHTML(report);
 printWindow.document.write(html);
 printWindow.document.close();

 setTimeout(() => {
 printWindow.focus();
 printWindow.print();
 printWindow.onafterprint = () => printWindow.close();
 }, 300);
 }, [report]);

 // Close on ESC
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === 'Escape' && open) {
 onOpenChange(false);
 }
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [open, onOpenChange]);

 if (!open || !mounted) return null;

 const visibleFilters = showAllFilters ? report.appliedFilters : report.appliedFilters.slice(0, 3);
 const hasMoreFilters = report.appliedFilters.length > 3;

 return createPortal(
 <>
 {/* Overlay */}
 <div 
 className="fixed inset-0 bg-black/60 z-[99998] backdrop-blur-sm"
 onClick={() => onOpenChange(false)}
 />
 
 {/* Modal */}
 <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
 <div 
 className="bg-background rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden pointer-events-auto flex flex-col"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header */}
 <div className="px-6 py-4 border-b bg-muted/80 flex-shrink-0">
 <div className="flex items-start justify-between">
 <div>
 <h2 className="text-xl font-bold text-foreground">{report.companyName}</h2>
 <p className="text-sm text-foreground mt-0.5">{report.title}</p>
 <p className="text-xs text-muted-foreground mt-1">Generado el {report.generatedAt}</p>
 </div>
 <div className="flex items-center gap-2">
 {/* Search */}
 <div className="relative">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Buscar..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-8 h-9 w-40 text-sm"
 />
 </div>
 {/* View toggle */}
 <Button
 variant="outline"
 size="sm"
 onClick={() => setCompact(!compact)}
 className="h-9"
 >
 {compact ? <LayoutGrid className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
 </Button>
 {/* Print */}
 <Button
 variant="outline"
 size="sm"
 onClick={handlePrint}
 className="h-9 gap-2"
 >
 <Printer className="h-4 w-4" />
 Imprimir
 </Button>
 {/* Close */}
 <Button 
 variant="ghost" 
 size="sm"
 onClick={() => onOpenChange(false)}
 className="h-9 w-9 p-0"
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 </div>
 </div>

 {/* Body */}
 <div className="flex-1 overflow-y-auto p-6">
 {/* KPIs */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
 <KPICard label="Máquinas" value={totalMachines} tone="blue" />
 <KPICard label="Total Ítems" value={totalItems} tone="green" />
 <KPICard label="Tipos" value={Array.from(allTypes).slice(0, 2).join(', ')} tone="purple" />
 <KPICard label="Tiempo Est." value={durationDisplay} tone="orange" />
 </div>

 {/* Filters */}
 {report.appliedFilters.length > 0 && (
 <div className="bg-muted rounded-lg p-3 mb-5">
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs font-semibold text-foreground">Filtros aplicados</span>
 {hasMoreFilters && (
 <button 
 onClick={() => setShowAllFilters(!showAllFilters)}
 className="text-xs text-info-muted-foreground hover:text-info-muted-foreground flex items-center gap-1"
 >
 {showAllFilters ? 'Ver menos' : `+${report.appliedFilters.length - 3} más`}
 {showAllFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
 </button>
 )}
 </div>
 <div className="flex flex-wrap gap-2">
 {visibleFilters.map((filter, idx) => (
 <span
 key={idx}
 className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-background border text-foreground"
 >
 <span className="font-medium text-muted-foreground mr-1">{filter.label}:</span>
 {filter.value}
 </span>
 ))}
 </div>
 </div>
 )}

 {/* Machines */}
 {filteredMachines.length > 0 ? (
 filteredMachines.map((machine) => (
 <MachineBlock key={machine.id} machine={machine} compact={compact} />
 ))
 ) : (
 <div className="text-center py-12 text-muted-foreground">
 <p>No se encontraron máquinas con "{searchTerm}"</p>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="px-6 py-3 border-t bg-muted/80 flex items-center justify-between text-xs text-muted-foreground flex-shrink-0">
 <span>Listado generado automáticamente • Sistema de Mantenimiento</span>
 <span>{filteredMachines.length} de {totalMachines} máquinas</span>
 </div>
 </div>
 </div>
 </>,
 document.body
 );
}

// Export alias
export const MaintenanceReportModalWrapper = MaintenanceReportModal;

export default MaintenanceReportModal;
