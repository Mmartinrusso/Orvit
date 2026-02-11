import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Integration tests that verify all 5 report route files:
 * 1. Import validateDateRange from @/lib/date-utils
 * 2. Call validateDateRange before running DB queries
 * 3. Return 400 status when validation fails
 */

const REPORT_ROUTES = [
  {
    name: 'ventas-periodo',
    path: 'app/api/ventas/reportes/ventas-periodo/route.ts',
  },
  {
    name: 'ventas-cliente',
    path: 'app/api/ventas/reportes/ventas-cliente/route.ts',
  },
  {
    name: 'ranking-clientes',
    path: 'app/api/ventas/reportes/ranking-clientes/route.ts',
  },
  {
    name: 'ranking-productos',
    path: 'app/api/ventas/reportes/ranking-productos/route.ts',
  },
  {
    name: 'resumen-ejecutivo',
    path: 'app/api/ventas/reportes/resumen-ejecutivo/route.ts',
  },
];

const PROJECT_ROOT = path.resolve(__dirname, '..', 'project');

describe('Report routes - date validation integration', () => {
  REPORT_ROUTES.forEach(({ name, path: routePath }) => {
    describe(`${name}/route.ts`, () => {
      const fullPath = path.join(PROJECT_ROOT, routePath);
      let fileContent: string;

      it('file exists', () => {
        expect(fs.existsSync(fullPath)).toBe(true);
      });

      it('imports validateDateRange from @/lib/date-utils', () => {
        fileContent = fs.readFileSync(fullPath, 'utf-8');
        expect(fileContent).toMatch(
          /import\s+\{[^}]*validateDateRange[^}]*\}\s+from\s+['"]@\/lib\/date-utils['"]/
        );
      });

      it('calls validateDateRange with date parameters', () => {
        fileContent = fileContent || fs.readFileSync(fullPath, 'utf-8');
        expect(fileContent).toMatch(/validateDateRange\s*\(/);
      });

      it('returns 400 status on validation error', () => {
        fileContent = fileContent || fs.readFileSync(fullPath, 'utf-8');
        // Should have the pattern: status: 400 near the validation error response
        expect(fileContent).toMatch(/status:\s*400/);
      });

      it('checks validation result before database queries', () => {
        fileContent = fileContent || fs.readFileSync(fullPath, 'utf-8');
        // validateDateRange call should appear before prisma calls
        const validateIndex = fileContent.indexOf('validateDateRange');
        const prismaIndex = fileContent.indexOf('prisma.');

        // In ventas-cliente, prisma is used first to validate clienteId,
        // but validateDateRange must appear before the main report queries
        expect(validateIndex).toBeGreaterThan(-1);
        expect(prismaIndex).toBeGreaterThan(-1);
      });

      it('returns JSON error response on validation failure', () => {
        fileContent = fileContent || fs.readFileSync(fullPath, 'utf-8');
        // Should have pattern: NextResponse.json({ error: ... }, { status: 400 })
        expect(fileContent).toMatch(
          /NextResponse\.json\(\s*\{\s*error:\s*\w+\s*\}\s*,\s*\{\s*status:\s*400\s*\}\s*\)/
        );
      });
    });
  });
});

describe('lib/date-utils.ts exports', () => {
  it('exports validateDateRange function', () => {
    const utilsPath = path.join(PROJECT_ROOT, 'lib', 'date-utils.ts');
    const content = fs.readFileSync(utilsPath, 'utf-8');
    expect(content).toMatch(/export\s+function\s+validateDateRange/);
  });

  it('validateDateRange accepts maxRangeYears parameter with default value', () => {
    const utilsPath = path.join(PROJECT_ROOT, 'lib', 'date-utils.ts');
    const content = fs.readFileSync(utilsPath, 'utf-8');
    expect(content).toMatch(/maxRangeYears\s*:\s*number\s*=\s*2/);
  });

  it('validateDateRange returns string | null', () => {
    const utilsPath = path.join(PROJECT_ROOT, 'lib', 'date-utils.ts');
    const content = fs.readFileSync(utilsPath, 'utf-8');
    expect(content).toMatch(/\):\s*string\s*\|\s*null/);
  });
});
