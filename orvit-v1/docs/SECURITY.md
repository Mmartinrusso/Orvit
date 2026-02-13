# Política de Seguridad - ORVIT

## Índice
1. [Manejo de Secretos](#manejo-de-secretos)
2. [Variables de Entorno](#variables-de-entorno)
3. [AWS y Credenciales Cloud](#aws-y-credenciales-cloud)
4. [Escaneo de Secretos](#escaneo-de-secretos)
5. [Rotación de Credenciales](#rotación-de-credenciales)
6. [IAM y Principio de Menor Privilegio](#iam-y-principio-de-menor-privilegio)
7. [Gestión de Dependencias](#gestión-de-dependencias)
8. [Respuesta a Incidentes](#respuesta-a-incidentes)
9. [Mejores Prácticas para Desarrolladores](#mejores-prácticas-para-desarrolladores)

---

## Manejo de Secretos

### Reglas Fundamentales

1. **NUNCA commitear secretos al repositorio** - Ni en código, comentarios, archivos de configuración, ni logs.
2. **NUNCA usar fallbacks inseguros** - No hacer `process.env.SECRET || 'valor-por-defecto'`. Si un secreto no está definido, la aplicación debe fallar al iniciar.
3. **NUNCA exponer secretos al cliente** - No usar `NEXT_PUBLIC_` para variables sensibles (AWS, JWT, API keys, tokens).
4. **Usar `.env.example` como referencia** - Contiene los nombres de variables con valores placeholder. Está commiteado al repo.

### Dónde almacenar secretos

| Entorno | Método |
|---------|--------|
| Desarrollo local | Archivo `.env` (en `.gitignore`) |
| Staging | Variables de entorno del hosting (Vercel/Railway) |
| Producción | Variables de entorno del hosting + Secrets manager |
| CI/CD | GitHub Actions Secrets |

---

## Variables de Entorno

### Variables Sensibles (server-only)

Estas variables **NUNCA** deben tener el prefijo `NEXT_PUBLIC_`:

| Variable | Descripción | Requisitos |
|----------|-------------|------------|
| `JWT_SECRET` | Secreto para firmar tokens JWT | Mínimo 32 caracteres, generado con `crypto.randomBytes(64).toString('hex')` |
| `DATABASE_URL` | Connection string PostgreSQL | Incluye credenciales, solo server-side |
| `AWS_ACCESS_KEY_ID` | Credencial AWS | IAM user con permisos mínimos |
| `AWS_SECRET_ACCESS_KEY` | Secreto AWS | Rotar cada 90 días |
| `OPENAI_API_KEY` | API key de OpenAI | Prefijo `sk-` |
| `DISCORD_BOT_TOKEN` | Token del bot de Discord | Solo server-side |
| `SENTRY_AUTH_TOKEN` | Token de autenticación Sentry | Solo para CI/CD |

### Variables Públicas (seguras para NEXT_PUBLIC_)

Solo estas variables pueden usar `NEXT_PUBLIC_`:
- `NEXT_PUBLIC_APP_URL` - URL de la aplicación
- `NEXT_PUBLIC_SENTRY_DSN` - DSN de Sentry (es público por diseño)
- `NEXT_PUBLIC_APP_VERSION` - Versión de la app

### Validación en Startup

La aplicación valida secretos críticos al iniciar (`lib/auth.ts`):

```typescript
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET no está definido o es demasiado corto.');
}
```

Si falta un secreto crítico, la app **no arranca**. Esto previene que la app corra en un estado inseguro.

---

## AWS y Credenciales Cloud

### Principio de Menor Privilegio (IAM)

Cada entorno debe usar un IAM user/role diferente con permisos mínimos:

#### IAM Policy recomendada para S3 (producción)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::orvit-bucket-prod",
        "arn:aws:s3:::orvit-bucket-prod/*"
      ]
    }
  ]
}
```

#### IAM Policy para desarrollo

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::orvit-bucket-dev/*"
    }
  ]
}
```

### Reglas para AWS en el código

1. **NUNCA** usar `NEXT_PUBLIC_AWS_*` - Las credenciales AWS son server-only
2. **NUNCA** loggear credenciales AWS - El logger las redacta automáticamente
3. **Usar pre-signed URLs** para que el cliente acceda a S3 sin credenciales
4. **Separar buckets** por entorno (dev, staging, prod)

---

## Escaneo de Secretos

### Pre-commit Hook (local)

Se ejecuta automáticamente antes de cada commit usando Gitleaks:

```bash
# El hook está en .husky/pre-commit
# Escanea solo los cambios staged
gitleaks protect --staged --verbose --config .gitleaks.toml
```

#### Instalación de Gitleaks

```bash
# Windows
winget install Gitleaks.Gitleaks

# macOS
brew install gitleaks

# Linux
# Descargar desde https://github.com/gitleaks/gitleaks/releases
```

### CI/CD (GitHub Actions)

El workflow `.github/workflows/security-scan.yml` se ejecuta en cada push y PR:

1. **Gitleaks scan** - Escanea todo el historial de commits
2. **NEXT_PUBLIC_AWS check** - Verifica que no haya credenciales AWS expuestas al cliente
3. **Sensitive vars check** - Verifica que no haya variables sensibles con NEXT_PUBLIC_
4. **JWT fallback check** - Verifica que no haya fallbacks inseguros de JWT_SECRET

Si algún check falla, **el build se bloquea**.

### Configuración Gitleaks

Las reglas están en `.gitleaks.toml`. Incluye detección de:
- AWS Access Keys y Secret Keys
- JWT Secrets hardcodeados
- OpenAI API Keys
- Discord Bot Tokens
- Sentry Auth Tokens
- Database connection strings
- Private keys
- NEXT_PUBLIC_AWS_* exposures

### Falsos Positivos

Si Gitleaks detecta un falso positivo, agregá el path al allowlist en `.gitleaks.toml`:

```toml
[allowlist]
paths = [
  '''mi-archivo-seguro\.ts$''',
]
```

---

## Rotación de Credenciales

### Calendario de Rotación

| Credencial | Frecuencia | Procedimiento |
|------------|------------|---------------|
| JWT_SECRET | Cada 6 meses o ante sospecha de compromiso | Ver "Rotación de JWT_SECRET" abajo |
| AWS Keys | Cada 90 días | Crear nueva key en IAM, actualizar en hosting, eliminar key vieja |
| OPENAI_API_KEY | Ante sospecha de compromiso | Regenerar en dashboard de OpenAI |
| DISCORD_BOT_TOKEN | Ante sospecha de compromiso | Regenerar en Discord Developer Portal |
| DATABASE_URL password | Cada 6 meses | Cambiar en Neon/proveedor, actualizar en hosting |

### Rotación de JWT_SECRET

1. Generar nuevo secreto: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
2. Actualizar en el hosting (Vercel/Railway)
3. Deployar la aplicación
4. **Nota**: Todos los tokens JWT existentes se invalidan. Los usuarios deben re-loguearse.

### Rotación de AWS Keys

1. Ir a AWS IAM Console
2. Crear nueva Access Key para el IAM user
3. Actualizar `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` en el hosting
4. Verificar que la app funciona con las nuevas keys
5. **Desactivar** la key vieja (no eliminar todavía)
6. Después de 24hs sin problemas, **eliminar** la key vieja

---

## IAM y Principio de Menor Privilegio

### Estructura recomendada de IAM Users

| IAM User | Permisos | Uso |
|----------|----------|-----|
| `orvit-dev` | S3 PutObject/GetObject/DeleteObject en bucket dev | Desarrollo local |
| `orvit-staging` | S3 en bucket staging | Entorno de staging |
| `orvit-prod` | S3 en bucket prod (solo GetObject + PutObject) | Producción |
| `orvit-ci` | Solo lo mínimo para CI (ej: S3 deploy) | GitHub Actions |

### Recomendaciones

1. **Nunca usar el root account** de AWS
2. **Habilitar MFA** en todas las cuentas IAM con acceso a consola
3. **No compartir credenciales** entre entornos
4. **Revisar permisos trimestralmente** y remover los innecesarios
5. **Usar IAM Roles** en lugar de IAM Users cuando sea posible (ej: EC2, Lambda)
6. **Habilitar CloudTrail** para auditar accesos

---

## Gestión de Dependencias

### Política de Actualizaciones

Las dependencias se gestionan con un enfoque proactivo para minimizar la superficie de ataque:

| Severidad | SLA de resolución | Acción |
|-----------|-------------------|--------|
| **Critical** | 48 horas | Fix inmediato, PR urgente |
| **High** | 1 semana | Fix en el próximo sprint |
| **Moderate** | 1 mes | Evaluar en revisión mensual |
| **Low** | Siguiente revisión mensual | Evaluar impacto |

### Herramientas Automatizadas

1. **Dependabot** - PRs automáticos semanales (lunes) para los 3 proyectos npm
2. **npm audit en CI/CD** - Bloquea merge si hay vulnerabilidades high/critical
3. **Revisión mensual automática** - Workflow que genera issue con reporte consolidado

### Major Bumps Excluidos

Las siguientes dependencias NO se actualizan automáticamente a major versions (requieren migración dedicada):
- `next` (framework core)
- `react` / `react-dom` (framework core)
- `typescript` (cambios en type-checking)
- `eslint` (cambios en reglas)

### Dependencias con Vulnerabilidades Conocidas (deuda técnica)

| Dependencia | Severidad | Motivo de exclusión | Mitigación |
|-------------|-----------|---------------------|------------|
| `next` (bundled postcss/zod) | moderate | Requiere major bump de Next.js | No afecta en producción, bundled internamente |
| `xlsx` | high | No tiene fix disponible | Evaluar migración a `exceljs` o `sheetjs-ce` |
| `jspdf` (bundled dompurify) | moderate | Requiere major bump de jspdf | No afecta server-side |
| `discord.js` (bundled undici) | moderate | Requiere major bump | Solo usado server-side con inputs controlados |

> Para la política completa, ver [DEPENDENCY_MANAGEMENT.md](DEPENDENCY_MANAGEMENT.md).

---

## Respuesta a Incidentes

### Si se detecta un secreto expuesto en el repositorio

**ACCIÓN INMEDIATA (primeros 15 minutos):**

1. **Rotar el secreto comprometido** - No esperar, hacerlo inmediatamente
2. **Revocar la credencial vieja** - Desactivarla en el proveedor (AWS, OpenAI, etc.)
3. **Verificar uso no autorizado** - Revisar logs de acceso en el proveedor

**LIMPIEZA (primeras 2 horas):**

4. **Eliminar el secreto del historial de git**:
   ```bash
   # Usar BFG Repo-Cleaner
   bfg --replace-text passwords.txt
   git push --force
   ```
5. **Notificar al equipo** - Informar qué secreto fue comprometido y qué acción se tomó
6. **Verificar que el secreto no se cacheó** en CI/CD, logs, o servicios externos

**POST-MORTEM (48 horas):**

7. **Documentar el incidente** - Qué pasó, cómo se detectó, qué se hizo
8. **Identificar la causa raíz** - ¿Faltó el pre-commit hook? ¿Falló el CI?
9. **Implementar mejoras** - Agregar reglas a Gitleaks, mejorar el allowlist, etc.

### Si se detecta un JWT_SECRET débil o comprometido

1. Generar nuevo JWT_SECRET (64+ caracteres)
2. Actualizar en el hosting inmediatamente
3. Deployar - Esto invalida todas las sesiones activas
4. Monitorear logs por actividad sospechosa en las siguientes 24 horas

---

## Mejores Prácticas para Desarrolladores

### Checklist antes de cada commit

- [ ] No hay credenciales hardcodeadas en el código
- [ ] No hay `process.env.SECRET || 'fallback'` con valores reales
- [ ] No hay `NEXT_PUBLIC_` para variables sensibles
- [ ] El pre-commit hook de Gitleaks está activo
- [ ] Los archivos `.env` están en `.gitignore`

### Qué hacer si necesitás un secreto en desarrollo

1. Copiá `.env.example` como `.env`
2. Pedí las credenciales de desarrollo al tech lead
3. **Nunca** uses credenciales de producción en desarrollo
4. **Nunca** compartas credenciales por chat o email sin encriptar

### Logger y Redacción

El logger (`lib/logger.ts`) redacta automáticamente campos sensibles:
- Passwords, tokens, JWT
- AWS keys
- API keys (OpenAI, Discord, Sentry)
- Database URLs
- Headers de autorización

Si agregás un nuevo secreto al sistema, **agregalo también a REDACT_PATHS** en `lib/logger.ts`.

### Revisión de Código (Code Review)

Al revisar PRs, verificar:
1. No hay nuevos secretos hardcodeados
2. Nuevas variables de entorno están documentadas en `.env.example`
3. Variables sensibles no usan `NEXT_PUBLIC_`
4. Nuevos secretos están incluidos en REDACT_PATHS del logger
