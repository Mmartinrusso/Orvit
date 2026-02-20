'use client';

/**
 * Verification Modal
 * Generic modal for code verification
 * No text that reveals the purpose
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useViewMode } from '@/contexts/ViewModeContext';
import { cn } from '@/lib/utils';

const MAX_ATTEMPTS = 3;

export function VerificationModal() {
  const {
    showVerification,
    setShowVerification,
    onVerificationSuccess,
    mode,
    config,
  } = useViewMode();

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if PIN is required (config.p is the pinRequired flag)
  const pinRequired = config?.p === true;

  // If no PIN required, toggle directly without showing modal
  useEffect(() => {
    if (showVerification && !pinRequired) {
      // Toggle immediately without confirmation
      const toggleDirectly = async () => {
        const targetMode = mode === 'S' ? 'E' : 'S';
        try {
          const response = await fetch('/api/user/view-preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              c: null,
              m: targetMode,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.ok) {
              onVerificationSuccess(data.m || targetMode);
            }
          }
        } catch {
          // Silently fail
        }
        setShowVerification(false);
      };
      toggleDirectly();
    }
  }, [showVerification, pinRequired, mode, onVerificationSuccess, setShowVerification]);

  // Focus input when modal opens (only if PIN required)
  useEffect(() => {
    if (showVerification && pinRequired) {
      setCode('');
      setError(false);
      setShake(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showVerification, pinRequired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || isLoading) return;

    setIsLoading(true);
    setError(false);

    try {
      // Determine target mode (toggle)
      const targetMode = mode === 'S' ? 'E' : 'S';

      const response = await fetch('/api/user/view-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          c: code,  // 'c' for code (obfuscated)
          m: targetMode,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          onVerificationSuccess(data.m || targetMode);
          setAttempts(0);
        } else {
          handleError();
        }
      } else {
        handleError();
      }
    } catch {
      handleError();
    } finally {
      setIsLoading(false);
    }
  };

  const handleError = () => {
    setError(true);
    setShake(true);
    setCode('');
    setAttempts(prev => prev + 1);

    // Remove shake after animation
    setTimeout(() => setShake(false), 500);

    // Close after max attempts
    if (attempts + 1 >= MAX_ATTEMPTS) {
      setTimeout(() => {
        setShowVerification(false);
        setAttempts(0);
      }, 1000);
    }
  };

  const handleClose = () => {
    setShowVerification(false);
    setCode('');
    setError(false);
    setAttempts(0);
  };

  // If no PIN required, don't show modal (toggle happens directly via useEffect)
  if (!pinRequired) {
    return null;
  }

  // PIN required - show PIN input
  return (
    <Dialog open={showVerification} onOpenChange={handleClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="text-center">
            Verificacion
          </DialogTitle>
        </DialogHeader>

        {/* Form attributes to prevent browser password save prompt */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2" autoComplete="off" data-form-type="other">
          <div
            className={cn(
              'transition-transform',
              shake && 'animate-shake'
            )}
          >
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder=""
              className={cn(
                'text-center text-lg tracking-widest',
                error && 'border-destructive'
              )}
              style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' } as React.CSSProperties}
              disabled={isLoading}
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
              name="verification-pin"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">
              Codigo incorrecto
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !code.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Verificar'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
