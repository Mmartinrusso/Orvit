/**
 * Navegación entre campos de formulario.
 * Se usa desde Input (Enter) y Select (auto-avance al seleccionar).
 *
 * Busca el contenedor más cercano en este orden:
 * 1. <form>
 * 2. [role="dialog"] (Dialog / Sheet de Radix)
 * 3. [data-form-navigation] (opt-in manual)
 */

const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled]):not([data-no-advance])',
  'textarea:not([disabled]):not([data-no-advance])',
  'button[role="combobox"]:not([disabled]):not([data-no-advance])',
].join(', ');

function findContainer(el: HTMLElement): HTMLElement | null {
  return (
    el.closest<HTMLElement>('form') ??
    el.closest<HTMLElement>('[role="dialog"]') ??
    el.closest<HTMLElement>('[data-form-navigation]')
  );
}

/**
 * Focaliza el siguiente campo del formulario/diálogo.
 * @returns true si avanzó, false si no había siguiente campo.
 */
export function focusNextFormField(current: HTMLElement): boolean {
  const container = findContainer(current);
  if (!container) return false;

  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );

  const idx = focusable.indexOf(current);
  if (idx === -1) return false;

  for (let i = idx + 1; i < focusable.length; i++) {
    const el = focusable[i];
    // No avanzar al botón de submit — dejar que Enter envíe el form
    if (el.matches('button[type="submit"]')) continue;
    el.focus();
    if (el instanceof HTMLInputElement) el.select();
    return true;
  }

  return false;
}
