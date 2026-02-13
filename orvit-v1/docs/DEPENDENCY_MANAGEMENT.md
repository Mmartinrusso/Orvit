# Gestión de Dependencias - ORVIT

## Índice
1. [Política de Actualización](#política-de-actualización)
2. [SLAs por Severidad](#slas-por-severidad)
3. [Herramientas Automatizadas](#herramientas-automatizadas)
4. [Proceso de Revisión Mensual](#proceso-de-revisión-mensual)
5. [Agrupación de Dependencias](#agrupación-de-dependencias)
6. [Major Bumps Excluidos](#major-bumps-excluidos)
7. [Deuda Técnica](#deuda-técnica)
8. [Runbook: Resolver Vulnerabilidades](#runbook-resolver-vulnerabilidades)

---

## Política de Actualización

### Principios

1. **Seguridad primero** - Las vulnerabilidades critical/high se resuelven con prioridad máxima.
2. **Estabilidad** - Los major bumps de frameworks core (Next.js, React, TypeScript) requieren planificación dedicada.
3. **Automatización** - Dependabot genera PRs automáticos; el CI valida que no haya vulnerabilidades nuevas.
4. **Revisión humana** - Ninguna actualización automática se mergea sin revisión.

### Proyectos Gestionados

| Proyecto | Directorio | Descripción |
|----------|-----------|-------------|
| orvit-v1 | `/orvit-v1` | Aplicación Next.js principal |
| agx-v1 | `/agx-v1` | Backend de AGX (pipeline automation) |
| agx-v1/client | `/agx-v1/client` | Frontend de AGX (React + Vite) |

Cada proyecto tiene su propio `package-lock.json` y se audita de forma independiente.

---

## SLAs por Severidad

| Severidad | Tiempo máximo de resolución | Acción requerida |
|-----------|---------------------------|------------------|
| **Critical** | 48 horas | Fix inmediato. PR urgente fuera de sprint si es necesario. |
| **High** | 1 semana | Incluir en el sprint actual o el siguiente. |
| **Moderate** | 1 mes | Evaluar en la revisión mensual. Aplicar si el fix es patch/minor. |
| **Low** | Siguiente revisión mensual | Evaluar impacto. Puede posponerse si no hay fix automático. |

### Excepciones

- Si una vulnerabilidad critical/high solo afecta dependencias de desarrollo (`devDependencies`) y no se expone en producción, el SLA se relaja a 1 mes.
- Si el fix requiere un major bump de un framework core, se documenta como deuda técnica y se planifica migración.

---

## Herramientas Automatizadas

### 1. Dependabot (`.github/dependabot.yml`)

**Qué hace:** Genera PRs automáticos para actualizar dependencias cada semana (lunes).

**Configuración:**
- Schedule: Semanal (lunes), timezone Argentina
- PRs agrupados por proveedor (Radix UI, TipTap, AWS SDK, etc.)
- Ignora major bumps de Next.js, React, TypeScript, ESLint
- Labels automáticos: `dependencies`
- También actualiza GitHub Actions

**Cómo revisar PRs de Dependabot:**
1. Verificar que el CI pasa (tests, build, audit)
2. Leer el changelog/release notes del paquete
3. Si es patch/minor y CI pasa, mergear
4. Si es minor con breaking changes, evaluar impacto en el codebase

### 2. npm audit en CI/CD (`.github/workflows/security-scan.yml`)

**Qué hace:** Ejecuta `npm audit --audit-level=high` en cada push y PR para los 3 proyectos.

**Comportamiento:**
- **Falla el build** si hay vulnerabilidades high o critical
- Ejecuta en paralelo (matrix strategy) para los 3 proyectos
- Threshold configurado a `high` para evitar falsos positivos con advisories moderate/low

### 3. Revisión Mensual (`.github/workflows/monthly-dependency-review.yml`)

**Qué hace:** El primer lunes de cada mes genera un issue en GitHub con:
- Resultado de `npm audit` de los 3 proyectos
- Lista de dependencias desactualizadas (`npm outdated`)
- Checklist de revisión
- Tabla de deuda técnica para completar

**Cómo usar el issue mensual:**
1. Revisar vulnerabilidades pendientes y aplicar fixes
2. Evaluar dependencias desactualizadas
3. Mergear PRs pendientes de Dependabot
4. Actualizar tabla de deuda técnica
5. Cerrar el issue cuando se complete la revisión

---

## Proceso de Revisión Mensual

### Checklist

1. [ ] Abrir el issue generado automáticamente
2. [ ] Revisar vulnerabilidades critical/high → aplicar fixes inmediatos
3. [ ] Revisar vulnerabilidades moderate/low → evaluar si aplican
4. [ ] Revisar PRs pendientes de Dependabot → mergear los que tengan CI verde
5. [ ] Ejecutar `npm outdated` local para verificar estado actualizado
6. [ ] Verificar que no hay dependencias deprecated
7. [ ] Ejecutar test suite completo después de actualizaciones
8. [ ] Actualizar tabla de deuda técnica en el issue
9. [ ] Cerrar el issue

### Responsable

La revisión mensual es responsabilidad del tech lead o el desarrollador asignado en el sprint.

---

## Agrupación de Dependencias

Dependabot agrupa PRs para facilitar revisión:

### orvit-v1

| Grupo | Paquetes | Motivo |
|-------|----------|--------|
| radix-ui | `@radix-ui/*` | Componentes UI, suelen actualizarse juntos |
| tiptap | `@tiptap/*` | Editor de texto rico |
| aws-sdk | `@aws-sdk/*` | SDK de AWS, versionado coordinado |
| testing | `vitest`, `@testing-library/*`, `jsdom` | Testing framework |
| tanstack | `@tanstack/*` | React Query y related |
| shadcn-deps | `class-variance-authority`, `clsx`, `tailwind-merge`, `cmdk` | Dependencias de shadcn/ui |
| three-js | `three`, `@react-three/*`, `@types/three` | 3D rendering |

### agx-v1/client

| Grupo | Paquetes | Motivo |
|-------|----------|--------|
| react | `react`, `react-dom`, `@types/react`, `@types/react-dom` | Framework core |

---

## Major Bumps Excluidos

Las siguientes dependencias **NO** se actualizan automáticamente a versiones major:

| Dependencia | Motivo | Acción requerida |
|-------------|--------|-----------------|
| `next` | Framework core, breaking changes significativos | Proyecto de migración dedicado |
| `react` / `react-dom` | Framework core, puede romper componentes | Proyecto de migración dedicado |
| `typescript` | Cambios en type-checking pueden generar errores de compilación | Evaluar en sprint dedicado |
| `eslint` | Cambios en reglas, configs, plugins | Evaluar en sprint dedicado |

Para actualizar estos a major versions:
1. Crear branch de migración dedicado
2. Leer guía de migración oficial del paquete
3. Actualizar y corregir todos los breaking changes
4. Ejecutar test suite completo
5. Hacer deploy a staging antes de producción

---

## Deuda Técnica

### Vulnerabilidades Conocidas Sin Fix Automático

| Dependencia | Severidad | Tipo de vulnerabilidad | Motivo | Mitigación | Fecha detectada |
|-------------|-----------|----------------------|--------|------------|-----------------|
| `next` (bundled postcss) | moderate | PostCSS line return parsing | Requiere major bump | No afecta en producción | 2025-02 |
| `next` (bundled zod) | moderate | DoS en Zod | Requiere major bump | Bundled internamente, no expuesto | 2025-02 |
| `xlsx` | high | Prototype Pollution, ReDoS | No tiene fix disponible | Evaluar migración a `exceljs` | 2025-02 |
| `jspdf` (bundled dompurify) | moderate | XSS en DOMPurify | Requiere major bump de jspdf | Solo genera PDFs server-side | 2025-02 |
| `discord.js` (bundled undici) | moderate | Decompression chain DoS | Requiere major bump | Server-side con inputs controlados | 2025-02 |

### Proceso para Resolver Deuda Técnica

1. Priorizar por severidad y exposición (public-facing > internal)
2. Crear issue dedicado para cada migración major
3. Estimar esfuerzo en story points
4. Incluir en planificación de sprint según prioridad
5. Actualizar esta tabla al resolver

---

## Runbook: Resolver Vulnerabilidades

### Paso 1: Identificar

```bash
# Desde el directorio del proyecto
cd orvit-v1  # o agx-v1, agx-v1/client
npm audit
```

### Paso 2: Clasificar

- **Fix automático disponible (patch/minor):** Proceder al paso 3
- **Requiere major bump:** Documentar en deuda técnica, evaluar impacto
- **No hay fix disponible:** Documentar, buscar alternativas o mitigaciones

### Paso 3: Aplicar Fix

```bash
# Fixes automáticos (patch/minor seguros)
npm audit fix

# Ver qué haría un fix forzado (NO ejecutar sin evaluar)
npm audit fix --dry-run --force
```

### Paso 4: Verificar

```bash
# Verificar que el fix no rompió nada
npm run build
npm test

# Re-auditar
npm audit
```

### Paso 5: Commit y PR

```bash
git checkout -b fix/security-deps-YYYY-MM
git add package.json package-lock.json
git commit -m "fix(deps): actualizar dependencias con vulnerabilidades"
# Crear PR con descripción de qué vulnerabilidades se resolvieron
```

### Si `npm audit fix` No Resuelve

1. Verificar si hay un fork parcheado del paquete
2. Evaluar si se puede reemplazar por una alternativa
3. Si la vulnerabilidad no aplica al uso que le damos, documentar como aceptada
4. Abrir issue en el repo del paquete upstream si no existe

---

## Referencias

- [npm audit documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [GitHub Dependabot documentation](https://docs.github.com/en/code-security/dependabot)
- [SECURITY.md](SECURITY.md) - Política de seguridad general del proyecto
