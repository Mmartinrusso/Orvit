'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const FONT_SIZE_KEY = 'fontSize';
const OVERRIDES_KEY = 'fontSizeOverrides';
const DEFAULT_FONT_SIZE = 16;
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 22;

export type OverrideCategory = 'tabs' | 'tables' | 'sidebar' | 'headings' | 'buttons' | 'forms' | 'kpis' | 'descriptions';

export type FontSizeOverrides = Record<OverrideCategory, number>;

const DEFAULT_OVERRIDES: FontSizeOverrides = {
  tabs: 0,
  tables: 0,
  sidebar: 0,
  headings: 0,
  buttons: 0,
  forms: 0,
  kpis: 0,
  descriptions: 0,
};

// rem values for each step: 0=Normal, 1=Grande, 2=Muy grande
const STEPS: Record<OverrideCategory, string[]> = {
  tabs: ['0.75rem', '0.875rem', '1rem'],
  tables: ['0.875rem', '1rem', '1.125rem'],
  sidebar: ['0.875rem', '1rem', '1.125rem'],
  headings: ['1.5rem', '1.875rem', '2.25rem'],
  buttons: ['0.875rem', '1rem', '1.125rem'],
  forms: ['0.875rem', '1rem', '1.125rem'],
  kpis: ['1.5rem', '1.875rem', '2.25rem'],
  descriptions: ['0.875rem', '1rem', '1.125rem'],
};

const SELECTORS: Record<OverrideCategory, string> = {
  tabs: '[role="tab"]',
  tables: 'table',
  sidebar: 'aside[data-sidebar] *',
  headings: '[data-slot="card-title"]',
  buttons: 'button:not([role="tab"]):not([data-sidebar="menu-button"])',
  forms: 'input, textarea, select, label',
  kpis: '[data-slot="kpi-value"]',
  descriptions: '[data-slot="card-description"]',
};

function applyOverrides(overrides: FontSizeOverrides) {
  let css = '';
  for (const key of Object.keys(overrides) as OverrideCategory[]) {
    const step = overrides[key];
    if (step > 0 && STEPS[key]) {
      css += `${SELECTORS[key]} { font-size: ${STEPS[key][step]} !important; }\n`;
    }
  }

  let style = document.getElementById('font-size-overrides') as HTMLStyleElement | null;
  if (css) {
    if (!style) {
      style = document.createElement('style');
      style.id = 'font-size-overrides';
      document.head.appendChild(style);
    }
    style.textContent = css;
  } else if (style) {
    style.remove();
  }
}

// Debounced save to DB — fire-and-forget, no blocking UI
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveToDb(fontSize: number, overrides: FontSizeOverrides) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch('/api/user/font-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fontSize, overrides }),
    }).catch(() => { /* silent — localStorage is the source of truth for instant access */ });
  }, 500);
}

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState(DEFAULT_FONT_SIZE);
  const [overrides, setOverridesState] = useState<FontSizeOverrides>(DEFAULT_OVERRIDES);
  const dbLoaded = useRef(false);

  // 1. Read from localStorage immediately (for instant render)
  // 2. Then fetch from DB and reconcile (DB wins if it has data)
  useEffect(() => {
    // Instant: read localStorage
    const savedFs = localStorage.getItem(FONT_SIZE_KEY);
    if (savedFs) setFontSizeState(Number(savedFs));

    const savedOv = localStorage.getItem(OVERRIDES_KEY);
    if (savedOv) {
      try {
        const parsed = JSON.parse(savedOv) as FontSizeOverrides;
        setOverridesState(parsed);
        applyOverrides(parsed);
      } catch { /* ignore */ }
    }

    // Async: fetch from DB and sync
    fetch('/api/user/font-preferences')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.fontPreferences) return;
        const { fontSize: dbFs, overrides: dbOv } = data.fontPreferences;

        if (typeof dbFs === 'number' && dbFs >= MIN_FONT_SIZE && dbFs <= MAX_FONT_SIZE) {
          setFontSizeState(dbFs);
          localStorage.setItem(FONT_SIZE_KEY, String(dbFs));
          document.documentElement.style.fontSize = dbFs + 'px';
        }

        if (dbOv && typeof dbOv === 'object') {
          const merged = { ...DEFAULT_OVERRIDES, ...dbOv };
          setOverridesState(merged);
          localStorage.setItem(OVERRIDES_KEY, JSON.stringify(merged));
          applyOverrides(merged);
        }

        dbLoaded.current = true;
      })
      .catch(() => { /* offline — use localStorage */ });
  }, []);

  const setFontSize = useCallback((size: number, previewOnly?: boolean) => {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
    setFontSizeState(clamped);
    if (!previewOnly) {
      localStorage.setItem(FONT_SIZE_KEY, String(clamped));
      document.documentElement.style.fontSize = clamped + 'px';
      // Save to DB (debounced)
      const currentOv = JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}');
      saveToDb(clamped, { ...DEFAULT_OVERRIDES, ...currentOv });
    }
  }, []);

  const setOverride = useCallback((category: OverrideCategory, step: number) => {
    setOverridesState(prev => {
      const next = { ...prev, [category]: step };
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next));
      applyOverrides(next);
      // Save to DB (debounced)
      const currentFs = Number(localStorage.getItem(FONT_SIZE_KEY) || DEFAULT_FONT_SIZE);
      saveToDb(currentFs, next);
      return next;
    });
  }, []);

  const resetFontSize = useCallback(() => {
    setFontSizeState(DEFAULT_FONT_SIZE);
    localStorage.removeItem(FONT_SIZE_KEY);
    document.documentElement.style.fontSize = '';
    const currentOv = JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}');
    saveToDb(DEFAULT_FONT_SIZE, { ...DEFAULT_OVERRIDES, ...currentOv });
  }, []);

  const resetAll = useCallback(() => {
    setFontSizeState(DEFAULT_FONT_SIZE);
    localStorage.removeItem(FONT_SIZE_KEY);
    localStorage.removeItem(OVERRIDES_KEY);
    document.documentElement.style.fontSize = '';
    setOverridesState(DEFAULT_OVERRIDES);
    applyOverrides(DEFAULT_OVERRIDES);
    saveToDb(DEFAULT_FONT_SIZE, DEFAULT_OVERRIDES);
  }, []);

  const hasOverrides = Object.values(overrides).some(v => v > 0);

  return { fontSize, setFontSize, resetFontSize, overrides, setOverride, resetAll, hasOverrides };
}
