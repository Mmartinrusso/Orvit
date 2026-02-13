'use client';

import React, { useEffect } from 'react';

export default function ChecklistPrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Ocultar MobileBottomBar y otros elementos globales al cargar esta página
    const hideElements = () => {
      // Ocultar MobileBottomBar
      const bottomBars = document.querySelectorAll('[class*="MobileBottomBar"], [class*="bottom-bar"], [class*="fixed"][class*="bottom"], nav, footer');
      bottomBars.forEach((el: any) => {
        if (el) {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
        }
      });

      // Ocultar headers con ORVIT
      const headers = document.querySelectorAll('header, [class*="header"]:not(.print-header)');
      headers.forEach((el: any) => {
        const text = (el.textContent || '').trim();
        if (text.includes('ORVIT') || text === 'ORVIT') {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
        }
      });
      
      // Buscar y ocultar cualquier elemento que solo contenga "ORVIT"
      const allElements = document.querySelectorAll('body > *:not(.print-layout):not([class*="print"])');
      allElements.forEach((el: any) => {
        const text = (el.textContent || '').trim();
        if (text === 'ORVIT' || (text.includes('ORVIT') && text.length < 15)) {
          if (!el.closest('.print-header') && !el.classList.contains('print-header')) {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
          }
        }
      });
      
      // Asegurar fondo blanco
      document.body.style.background = 'white';
      document.body.style.backgroundColor = 'white';
      document.documentElement.style.background = 'white';
    };

    // Ejecutar inmediatamente y después de un pequeño delay
    hideElements();
    setTimeout(hideElements, 100);
    setTimeout(hideElements, 500);
    
    // También ocultar antes de imprimir
    const handleBeforePrint = () => {
      hideElements();
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, []);

  return (
    <div className="print-layout" style={{ minHeight: '100vh' }}>
      {children}
    </div>
  );
}

