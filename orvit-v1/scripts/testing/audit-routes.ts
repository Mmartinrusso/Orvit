/**
 * audit-routes.ts - Static analysis of API route security
 *
 * Scans all app/api/ route files and detects:
 * - Endpoints without JWT verification
 * - Endpoints without permission checks
 * - Endpoints using withGuards vs manual auth patterns
 *
 * Run: npx tsx scripts/audit-routes.ts
 * Or:  npm run audit:routes
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Configuration ───────────────────────────────────────────────────────────

const API_DIR = path.resolve(__dirname, '..', 'app', 'api');

// Regex patterns for detecting auth/permission usage
const PATTERNS = {
  // Auth patterns (any of these = authenticated)
  withGuards: /withGuards\s*\(/,
  verifyAuth: /verifyAuth\s*\(/,
  verifyToken: /verifyToken\s*\(/,
  getUserAndCompany: /getUserAndCompany\s*\(/,
  getUserFromToken: /getUserFromToken\s*\(/,
  getAuthFromRequest: /getAuthFromRequest\s*\(/,
  jwtVerify: /jwtVerify\s*\(/,
  cookiesGetToken: /cookies\(\)\.get\(['"](?:token|accessToken)['"]\)/,

  // Permission patterns (any of these = has authorization)
  withGuardsPermission: /withGuards\s*\([^,]+,\s*\{[^}]*requiredPermissions/s,
  hasPermission: /hasPermission\s*\(/,
  hasUserPermission: /hasUserPermission\s*\(/,
  roleCheck: /\.role\s*===\s*['"](?:SUPERADMIN|ADMIN|ADMIN_ENTERPRISE)['"]/,
  permissionsCheck: /permissions?\s*\.(?:includes|some|every|has)\s*\(/,

  // HTTP method exports (supports both `export function GET` and `export const GET =`)
  exportGET: /export\s+(?:(?:async\s+)?function|const)\s+GET\b/,
  exportPOST: /export\s+(?:(?:async\s+)?function|const)\s+POST\b/,
  exportPUT: /export\s+(?:(?:async\s+)?function|const)\s+PUT\b/,
  exportDELETE: /export\s+(?:(?:async\s+)?function|const)\s+DELETE\b/,
  exportPATCH: /export\s+(?:(?:async\s+)?function|const)\s+PATCH\b/,
};

// Routes that are intentionally public (no auth required)
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify',
  '/api/health',
  '/api/cron/',
  '/api/webhooks/',
  '/api/debug-',
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface RouteAudit {
  filePath: string;
  relativePath: string;
  apiRoute: string;
  methods: string[];
  hasAuth: boolean;
  hasPermissionCheck: boolean;
  usesWithGuards: boolean;
  authPatterns: string[];
  permissionPatterns: string[];
  isPublicRoute: boolean;
  severity: 'ok' | 'warning' | 'critical';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath));
    } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
      results.push(fullPath);
    }
  }

  return results;
}

function fileToApiRoute(filePath: string): string {
  const rel = path.relative(API_DIR, filePath).replace(/\\/g, '/');
  // Remove /route.ts suffix
  const routePath = rel.replace(/\/route\.ts$/, '').replace(/\/route\.js$/, '');
  return `/api/${routePath}`;
}

function detectMethods(content: string): string[] {
  const methods: string[] = [];
  if (PATTERNS.exportGET.test(content)) methods.push('GET');
  if (PATTERNS.exportPOST.test(content)) methods.push('POST');
  if (PATTERNS.exportPUT.test(content)) methods.push('PUT');
  if (PATTERNS.exportDELETE.test(content)) methods.push('DELETE');
  if (PATTERNS.exportPATCH.test(content)) methods.push('PATCH');
  return methods;
}

function detectAuthPatterns(content: string): string[] {
  const found: string[] = [];
  if (PATTERNS.withGuards.test(content)) found.push('withGuards');
  if (PATTERNS.verifyAuth.test(content)) found.push('verifyAuth');
  if (PATTERNS.verifyToken.test(content)) found.push('verifyToken');
  if (PATTERNS.getUserAndCompany.test(content)) found.push('getUserAndCompany');
  if (PATTERNS.getUserFromToken.test(content)) found.push('getUserFromToken');
  if (PATTERNS.getAuthFromRequest.test(content)) found.push('getAuthFromRequest');
  if (PATTERNS.jwtVerify.test(content)) found.push('jwtVerify');
  if (PATTERNS.cookiesGetToken.test(content)) found.push('cookiesGetToken');
  return found;
}

function detectPermissionPatterns(content: string): string[] {
  const found: string[] = [];
  if (PATTERNS.withGuardsPermission.test(content)) found.push('withGuards(permissions)');
  if (PATTERNS.hasPermission.test(content)) found.push('hasPermission');
  if (PATTERNS.hasUserPermission.test(content)) found.push('hasUserPermission');
  if (PATTERNS.roleCheck.test(content)) found.push('roleCheck');
  if (PATTERNS.permissionsCheck.test(content)) found.push('permissionsCheck');
  return found;
}

function isPublicRoute(apiRoute: string): boolean {
  return PUBLIC_ROUTES.some((pub) => apiRoute.startsWith(pub));
}

function determineSeverity(audit: RouteAudit): 'ok' | 'warning' | 'critical' {
  if (audit.isPublicRoute) return 'ok';
  if (!audit.hasAuth) return 'critical';
  if (!audit.hasPermissionCheck) return 'warning';
  return 'ok';
}

// ─── Main ────────────────────────────────────────────────────────────────────

function auditRoutes(): RouteAudit[] {
  const files = findRouteFiles(API_DIR);
  const audits: RouteAudit[] = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');
    const apiRoute = fileToApiRoute(filePath);
    const methods = detectMethods(content);
    const authPatterns = detectAuthPatterns(content);
    const permissionPatterns = detectPermissionPatterns(content);
    const isPublic = isPublicRoute(apiRoute);

    const audit: RouteAudit = {
      filePath,
      relativePath,
      apiRoute,
      methods,
      hasAuth: authPatterns.length > 0,
      hasPermissionCheck: permissionPatterns.length > 0,
      usesWithGuards: PATTERNS.withGuards.test(content),
      authPatterns,
      permissionPatterns,
      isPublicRoute: isPublic,
      severity: 'ok', // computed below
    };

    audit.severity = determineSeverity(audit);
    audits.push(audit);
  }

  return audits;
}

function printReport(audits: RouteAudit[]) {
  const critical = audits.filter((a) => a.severity === 'critical');
  const warnings = audits.filter((a) => a.severity === 'warning');
  const ok = audits.filter((a) => a.severity === 'ok');
  const withGuardsCount = audits.filter((a) => a.usesWithGuards).length;

  console.log('\n' + '='.repeat(80));
  console.log('  ORVIT API Route Security Audit');
  console.log('='.repeat(80));

  console.log(`\n  Total routes scanned: ${audits.length}`);
  console.log(`  Using withGuards:     ${withGuardsCount}`);
  console.log(`  OK:                   ${ok.length}`);
  console.log(`  Warnings:             ${warnings.length} (auth but no permissions)`);
  console.log(`  Critical:             ${critical.length} (no auth at all)`);

  if (critical.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('  CRITICAL - No authentication detected:');
    console.log('-'.repeat(80));
    for (const a of critical) {
      console.log(`  [${a.methods.join(',')}] ${a.apiRoute}`);
      console.log(`    File: ${a.relativePath}`);
    }
  }

  if (warnings.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('  WARNING - Auth present but no permission checks:');
    console.log('-'.repeat(80));
    for (const a of warnings) {
      console.log(`  [${a.methods.join(',')}] ${a.apiRoute}`);
      console.log(`    Auth: ${a.authPatterns.join(', ')}`);
      console.log(`    File: ${a.relativePath}`);
    }
  }

  if (process.argv.includes('--verbose')) {
    console.log('\n' + '-'.repeat(80));
    console.log('  OK - Properly secured routes:');
    console.log('-'.repeat(80));
    for (const a of ok) {
      const label = a.isPublicRoute ? '(public)' : '';
      console.log(`  [${a.methods.join(',')}] ${a.apiRoute} ${label}`);
      if (a.authPatterns.length) console.log(`    Auth: ${a.authPatterns.join(', ')}`);
      if (a.permissionPatterns.length) console.log(`    Perms: ${a.permissionPatterns.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(80));

  // JSON output option
  if (process.argv.includes('--json')) {
    const outputPath = path.resolve(__dirname, '..', 'audit-routes-report.json');
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          summary: {
            total: audits.length,
            withGuards: withGuardsCount,
            ok: ok.length,
            warnings: warnings.length,
            critical: critical.length,
          },
          routes: audits.map(({ filePath, ...rest }) => rest),
        },
        null,
        2
      )
    );
    console.log(`\n  JSON report saved to: ${outputPath}\n`);
  }

  // Exit with error if critical issues found
  if (critical.length > 0) {
    console.log(`\n  ${critical.length} critical security issue(s) found!\n`);
    process.exit(1);
  }
}

// Run
const audits = auditRoutes();
printReport(audits);
