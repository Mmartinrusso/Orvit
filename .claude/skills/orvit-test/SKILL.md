---
name: orvit-test
description: Patrones de testing con Vitest en Orvit. Usar al crear tests, archivos vitest.*.config.mts, o modificar tests existentes en tests/ o orvit-v1/tests/.
---

# Testing — Orvit con Vitest

## Estructura de tests

```
tests/                          # Tests AGX (raíz Mawir)
├── __mocks__/                  # Mocks globales
├── discord-task-routing.test.ts
├── tasks-kanban-view.test.ts
├── unified-agenda-page.test.ts
├── xss-sanitization.test.ts
└── ...

orvit-v1/tests/                 # Tests de integración orvit
├── api/
│   ├── auth/login.test.ts
│   └── work-orders/crud.test.ts
└── api/maintenance/
```

---

## Config Vitest — pattern del proyecto

Cada feature tiene su propio config file (permite correr tests aislados):

```ts
// vitest.[feature].config.mts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'feature-name',
    include: ['tests/feature-name.test.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './orvit-v1'),
    },
  },
});
```

**Configs existentes** (no duplicar, referenciar si aplica):
```
vitest.discord-tasks.config.mts     → tests/discord-task-routing.test.ts
vitest.maintenance.config.mts       → tests/api/maintenance/
vitest.xss.config.mts              → tests/xss-sanitization.test.ts
vitest.zod.config.mts              → tests/zod-validations.test.ts
vitest.transactions.config.mts     → tests/prisma-transactions.test.ts
vitest.soft-delete.config.mts      → tests/soft-delete.test.ts
vitest.metrics.config.mts          → tests/business-metrics.test.ts
```

---

## Patrón de test — Lectura de source

El patrón dominante en este proyecto: **leer el source code real** en lugar de mocks para verificar implementación.

```ts
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Feature Name', () => {
  // ═══════════════════════════════════════════════
  // GRUPO 1: Verificación de estructura
  // ═══════════════════════════════════════════════

  describe('Estructura del módulo', () => {
    it('debe existir el archivo', () => {
      const filePath = path.join(process.cwd(), 'orvit-v1/lib/feature/index.ts');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('debe exportar las funciones requeridas', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'orvit-v1/lib/feature/index.ts'),
        'utf-8'
      );
      expect(content).toContain('export function doSomething');
      expect(content).toContain('export function doOtherThing');
    });
  });

  // ═══════════════════════════════════════════════
  // GRUPO 2: Verificación de patrones de seguridad
  // ═══════════════════════════════════════════════

  describe('Seguridad', () => {
    it('debe validar con Zod antes de usar datos', () => {
      const routeContent = fs.readFileSync(
        path.join(process.cwd(), 'orvit-v1/app/api/feature/route.ts'),
        'utf-8'
      );
      expect(routeContent).toContain('safeParse');
      expect(routeContent).toContain('companyId');
    });
  });

  // ═══════════════════════════════════════════════
  // GRUPO 3: Pruebas unitarias reales
  // ═══════════════════════════════════════════════

  describe('Lógica de negocio', () => {
    it('debe calcular X correctamente', () => {
      const result = calculateX(input);
      expect(result).toBe(expectedValue);
    });
  });
});
```

---

## Mocks comunes

```ts
// tests/__mocks__/prisma.ts
vi.mock('@/lib/prisma', () => ({
  prisma: {
    maintenance: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

// Mock de fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: [] }),
});

// Mock de next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
```

---

## Agregar script en package.json

```json
{
  "scripts": {
    "test:feature": "vitest run --config vitest.feature.config.mts",
    "test:all": "vitest run",
    "test:watch": "vitest --config vitest.feature.config.mts"
  }
}
```

---

## Reglas de testing en Orvit

1. Cada feature importante tiene su propio `vitest.[nombre].config.mts`
2. Los tests en `tests/` usan path absoluto via `process.cwd()`
3. Alias `@` → `orvit-v1/`
4. Usar `describe` con separadores visuales `═══` para organizar grupos
5. Tests de API routes: testear que usan `companyId`, `safeParse`, `requireAuth`
6. Tests de UI: testear que existen los patrones (cn(), toast, etc.)
7. No mockear si se puede leer el source directamente
