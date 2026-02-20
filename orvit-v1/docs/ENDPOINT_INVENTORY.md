# Documentación de API - ORVIT

**Fecha:** 2026-02-13
**Versión:** 1.0

---

## Tabla de Contenidos

1. [Autenticación (Auth)](#1-autenticación-auth)
2. [Empresas (Companies)](#2-empresas-companies)
3. [Tareas (Tasks)](#3-tareas-tasks)
4. [Órdenes de Trabajo (Work Orders)](#4-órdenes-de-trabajo-work-orders)
5. [Inventario Completo de Endpoints](#5-inventario-completo-de-endpoints)
6. [Patrones Comunes](#6-patrones-comunes)

---

## Autenticación

Todos los endpoints protegidos requieren un JWT válido en cookies HTTP-only. El sistema utiliza:

- **Access Token:** JWT con 15 minutos de vida
- **Refresh Token:** Token opaco con 24 horas de vida
- **Legacy Token:** JWT de 24 horas para compatibilidad

### Cookies

```
accessToken  → JWT (15 min)
refreshToken → opaco (24 hrs)
token        → legacy JWT (24 hrs)
```

Configuración de cookies:
```
httpOnly: true
secure: true (producción)
sameSite: 'strict'
path: '/'
```

---

## 1. Autenticación (Auth)

### POST /api/auth/login

Inicia sesión de usuario con email/username y contraseña.

**Autenticación:** No requerida (endpoint público)

**Rate Limiting:**
- Por IP: 5 intentos / 1 minuto → bloqueo 15 min
- Por email: 10 intentos / 5 minutos → bloqueo 15 min

#### Request

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "password": "contraseña123"
}
```

| Campo      | Tipo   | Requerido | Descripción                    |
|------------|--------|-----------|--------------------------------|
| `email`    | string | Sí        | Email o nombre de usuario      |
| `password` | string | Sí        | Contraseña del usuario         |

#### Response (200 OK)

```json
{
  "user": {
    "id": 1,
    "name": "Juan Pérez",
    "email": "juan@empresa.com",
    "role": "ADMIN",
    "sectorId": 5,
    "avatar": "/uploads/avatar.jpg",
    "permissions": ["work_orders.view", "work_orders.create"]
  },
  "hasCompany": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "requires2FA": false,
  "expiresAt": "2026-02-13T15:30:00.000Z"
}
```

Cookies establecidas:
- `accessToken` (15 min)
- `refreshToken` (24 hrs)
- `token` (legacy, 24 hrs)

#### Errores

| Código | Descripción                   |
|--------|-------------------------------|
| 400    | Email o contraseña faltantes  |
| 401    | Credenciales inválidas / usuario inactivo / sin contraseña configurada |
| 429    | Rate limit excedido (incluye `Retry-After` header y `blockedUntil`)   |

#### Flujo interno

1. Verificación de rate limit (IP + email)
2. Búsqueda de usuario (por email O username)
3. Verificación de contraseña (bcrypt)
4. Validación de usuario activo
5. Creación de sesión (con info de dispositivo)
6. Generación de par de tokens (access + refresh)
7. Establecimiento de cookies
8. Log del intento (éxito/fallo)

#### Notas de seguridad

- Máximo 5 sesiones simultáneas por usuario
- Si se excede, se cierra la sesión más antigua
- Device fingerprint registrado (browser, OS, IP)

---

### POST /api/auth/logout

Cierra la sesión del usuario.

**Autenticación:** Requiere access token o refresh token en cookies

#### Request

```http
POST /api/auth/logout
```

Query parameters opcionales:

| Parámetro | Tipo    | Descripción                    |
|-----------|---------|--------------------------------|
| `all`     | boolean | `true` para cerrar TODAS las sesiones |

#### Response (200 OK)

```json
{
  "message": "Sesión cerrada exitosamente"
}
```

Con `?all=true`:
```json
{
  "message": "Todas las sesiones cerradas exitosamente"
}
```

#### Flujo interno

1. Extracción de userId/sessionId desde tokens
2. Tokens agregados a blacklist
3. Revocación de sesión (actual o todas)
4. Invalidación de caché de auth
5. Limpieza de todas las cookies

---

### POST /api/auth/refresh

Renueva el access token usando el refresh token.

**Autenticación:** Requiere refresh token válido en cookies

**Rate Limiting:** 5 requests / 1 minuto por IP

#### Request

```http
POST /api/auth/refresh
```

No requiere body (usa cookies).

#### Response (200 OK)

```json
{
  "success": true,
  "expiresAt": "2026-02-13T15:45:00.000Z"
}
```

Cookies renovadas:
- `accessToken` (nuevo, 15 min)
- `refreshToken` (rotado, 24 hrs)

#### Errores

| Código | Descripción                                          |
|--------|------------------------------------------------------|
| 401    | Sin refresh token / token inválido / sesión revocada / usuario inactivo |
| 429    | Rate limit excedido                                  |

#### Notas de seguridad

- **Rotación de tokens:** El refresh token anterior se invalida y se crea uno nuevo
- **Cadena de tokens:** Se mantiene trazabilidad via campo `replacedBy`
- Verificación de blacklist antes de rotar
- Actualización de actividad de sesión

---

### GET /api/auth/me

Verifica la sesión actual y retorna datos del usuario autenticado.

**Autenticación:** Requiere JWT en cookies (access o legacy)

#### Request

```http
GET /api/auth/me
```

Query parameters opcionales:

| Parámetro | Tipo    | Descripción                           |
|-----------|---------|---------------------------------------|
| `refresh` | boolean | `true` para forzar invalidación de caché |

Header alternativo: `X-Force-Refresh: true`

#### Response (200 OK)

```json
{
  "id": 1,
  "name": "Juan Pérez",
  "email": "juan@empresa.com",
  "role": "ADMIN",
  "sectorId": 5,
  "avatar": "/uploads/avatar.jpg",
  "permissions": ["work_orders.view", "work_orders.create"]
}
```

#### Errores

| Código | Descripción                     |
|--------|---------------------------------|
| 401    | Sin sesión activa o token inválido |
| 404    | Usuario eliminado               |

---

### POST /api/auth/me

Búsqueda de usuario por email (público con rate limit).

**Autenticación:** No requerida

**Rate Limiting:** 5 requests / 1 minuto por IP

#### Request

```http
POST /api/auth/me
Content-Type: application/json

{
  "email": "usuario@empresa.com"
}
```

#### Response (200 OK)

```json
{
  "id": 1,
  "name": "Juan Pérez",
  "email": "juan@empresa.com",
  "role": "ADMIN",
  "avatar": null
}
```

#### Errores

| Código | Descripción           |
|--------|-----------------------|
| 400    | Validación fallida    |
| 404    | Usuario no encontrado |
| 429    | Rate limit excedido   |

---

## 2. Empresas (Companies)

### GET /api/companies

Lista todas las empresas accesibles para el usuario autenticado.

**Autenticación:** Requiere JWT en cookies

#### Request

```http
GET /api/companies
```

#### Response (200 OK)

```json
[
  {
    "id": 1,
    "name": "Acme Corp",
    "cuit": "30-12345678-9",
    "logo": "/uploads/logo.png",
    "address": "Av. Corrientes 1234",
    "phone": "+54 11 1234-5678",
    "email": "info@acme.com",
    "website": "https://acme.com",
    "logoDark": null,
    "logoLight": null,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-06-15T10:30:00.000Z"
  }
]
```

#### Autorización

- **SUPERADMIN:** Ve todas las empresas
- **Otros roles:** Solo empresas donde tiene asociación activa (`UserOnCompany.isActive = true`)

#### Errores

| Código | Descripción     |
|--------|-----------------|
| 401    | No autorizado   |

---

### POST /api/companies

Crea una nueva empresa con configuración inicial completa.

**Autenticación:** Requiere JWT en cookies
**Autorización:** Solo rol `ADMIN_ENTERPRISE`

#### Request

```http
POST /api/companies
Content-Type: application/json

{
  "name": "Nueva Empresa S.A.",
  "cuit": "30-98765432-1",
  "address": "Av. Libertador 5678",
  "phone": "+54 11 9876-5432",
  "email": "info@nueva.com",
  "logo": "/uploads/logo-nueva.png"
}
```

| Campo     | Tipo   | Requerido | Descripción                           |
|-----------|--------|-----------|---------------------------------------|
| `name`    | string | Sí        | Nombre de la empresa                  |
| `cuit`    | string | Sí        | CUIT único                            |
| `address` | string | No        | Dirección (acepta también `direccion`)|
| `phone`   | string | No        | Teléfono (acepta también `telefono`)  |
| `email`   | string | No        | Email (acepta también `gmail`)        |
| `logo`    | string | No        | URL del logo                          |

#### Response (201 Created)

```json
{
  "id": 5,
  "name": "Nueva Empresa S.A.",
  "cuit": "30-98765432-1",
  "address": "Av. Libertador 5678",
  "phone": "+54 11 9876-5432",
  "email": "info@nueva.com",
  "logo": "/uploads/logo-nueva.png",
  "logoDark": null,
  "logoLight": null,
  "website": null,
  "createdAt": "2026-02-13T12:00:00.000Z",
  "updatedAt": "2026-02-13T12:00:00.000Z"
}
```

#### Setup automático al crear

1. **4 roles por defecto:** ADMIN, SUPERVISOR, USER, Administrador
2. **Permisos:** Todos los permisos activos asignados al rol "Administrador"
3. **Asociación:** Usuario creador vinculado como ADMIN de la empresa
4. **3 áreas por defecto:** Administración, Mantenimiento, Producción

#### Errores

| Código | Descripción                            |
|--------|----------------------------------------|
| 400    | Campos requeridos faltantes / CUIT duplicado |
| 401    | No autorizado                          |
| 403    | No tiene rol `ADMIN_ENTERPRISE`        |

---

### GET /api/companies/[id]

Obtiene información detallada de una empresa incluyendo usuarios asociados.

**Autenticación:** Requiere JWT en cookies

#### Request

```http
GET /api/companies/1
```

#### Response (200 OK)

```json
{
  "id": 1,
  "name": "Acme Corp",
  "cuit": "30-12345678-9",
  "logo": "/uploads/logo.png",
  "address": "Av. Corrientes 1234",
  "phone": "+54 11 1234-5678",
  "email": "info@acme.com",
  "website": "https://acme.com",
  "logoDark": null,
  "logoLight": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-06-15T10:30:00.000Z",
  "users": [
    {
      "id": 1,
      "userId": 10,
      "companyId": 1,
      "roleId": 3,
      "isActive": true,
      "user": {
        "id": 10,
        "name": "Juan Pérez",
        "email": "juan@acme.com",
        "role": "ADMIN"
      }
    }
  ]
}
```

#### Errores

| Código | Descripción                |
|--------|----------------------------|
| 400    | ID de empresa inválido     |
| 404    | Empresa no encontrada      |

---

### PUT /api/companies/[id]

Actualiza configuración y propiedades de una empresa.

**Autenticación:** Requiere JWT en cookies
**Autorización:** SUPERADMIN, o usuario con permiso `company.settings`, `company.edit`, o `configuracion_empresa`

#### Request

```http
PUT /api/companies/1
Content-Type: application/json

{
  "name": "Acme Corp Actualizada",
  "phone": "+54 11 5555-5555",
  "logoDark": "/uploads/logo-dark.png"
}
```

Todos los campos son opcionales:

| Campo      | Tipo          | Descripción              |
|------------|---------------|--------------------------|
| `name`     | string        | Nombre                   |
| `cuit`     | string        | CUIT                     |
| `address`  | string        | Dirección                |
| `phone`    | string        | Teléfono                 |
| `email`    | string        | Email                    |
| `website`  | string        | Sitio web                |
| `logo`     | string / null | Logo principal           |
| `logoDark` | string / null | Logo modo oscuro         |
| `logoLight`| string / null | Logo modo claro          |

#### Response (200 OK)

Retorna el objeto empresa actualizado completo.

#### Notas

- Si se reemplaza o elimina un logo, el archivo anterior se elimina de S3
- Cambios registrados via `auditConfigChange()` (audit log)
- Campos `logoDark` y `logoLight` se actualizan via raw SQL

#### Errores

| Código | Descripción                    |
|--------|--------------------------------|
| 400    | ID inválido / sin datos / CUIT duplicado |
| 401    | No autorizado                  |
| 403    | Sin permisos suficientes       |
| 404    | Empresa no encontrada          |

---

### DELETE /api/companies/[id]

Elimina permanentemente una empresa y todos sus datos asociados.

**Autenticación:** Requiere JWT en cookies
**Autorización:** Solo `SUPERADMIN`

#### Request

```http
DELETE /api/companies/1
```

#### Response (200 OK)

```json
{
  "message": "Empresa eliminada correctamente"
}
```

#### Advertencia

**Operación irreversible.** Elimina en cascada:
- Asociaciones `UserOnCompany`
- Roles y permisos de empresa
- Áreas y sectores
- Todas las tareas, órdenes de trabajo, máquinas, etc.
- Logos de S3

#### Errores

| Código | Descripción                            |
|--------|----------------------------------------|
| 400    | ID inválido                            |
| 401    | No autorizado                          |
| 403    | Solo superadministradores pueden eliminar |
| 404    | Empresa no encontrada                  |

---

## 3. Tareas (Tasks)

### GET /api/tasks

Lista tareas paginadas con filtros avanzados.

**Autenticación:** Requiere JWT en cookies
**Multi-tenancy:** Filtra automáticamente por empresa del usuario

#### Request

```http
GET /api/tasks?status=pendiente&priority=alta&page=1&pageSize=20
```

| Parámetro    | Tipo   | Default   | Opciones                                          |
|--------------|--------|-----------|---------------------------------------------------|
| `status`     | string | `all`     | `all`, `pendiente`, `en-curso`, `realizada`, `cancelada` |
| `priority`   | string | `all`     | `all`, `baja`, `media`, `alta`, `urgente`         |
| `assignedTo` | number | `all`     | ID de usuario o `all`                              |
| `dateRange`  | string | `all`     | `all`, `yesterday`, `today`, `week`, `month`, `overdue` |
| `search`     | string | —         | Busca en título y descripción                      |
| `page`       | number | `1`       | Mínimo: 1                                          |
| `pageSize`   | number | `20`      | Máximo: 100                                        |

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": "123",
      "title": "Revisar presupuesto mensual",
      "description": "Verificar gastos del mes de enero",
      "status": "pendiente",
      "priority": "alta",
      "dueDate": "2026-02-28T00:00:00.000Z",
      "assignedTo": {
        "id": 10,
        "name": "Juan Pérez",
        "email": "juan@empresa.com"
      },
      "createdBy": {
        "id": 5,
        "name": "María García",
        "email": "maria@empresa.com"
      },
      "tags": ["presupuesto", "finanzas"],
      "progress": 0,
      "subtasks": [
        {
          "id": "456",
          "title": "Recopilar datos",
          "completed": false
        }
      ],
      "files": [
        {
          "id": "789",
          "name": "presupuesto.xlsx",
          "url": "/uploads/presupuesto.xlsx",
          "size": 45000,
          "type": "application/vnd.ms-excel"
        }
      ],
      "createdAt": "2026-02-01T10:00:00.000Z",
      "updatedAt": "2026-02-10T14:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### Autorización por rol

- **SUPERADMIN:** Retorna lista vacía
- **ADMIN sin empresa:** Retorna lista vacía
- **Otros roles:** Filtra por empresa del usuario

#### Mapeo de estados (frontend → DB)

```
pendiente  → TODO
en-curso   → IN_PROGRESS
realizada  → DONE
cancelada  → CANCELLED
```

#### Mapeo de prioridades (frontend → DB)

```
baja    → LOW
media   → MEDIUM
alta    → HIGH
urgente → URGENT
```

#### Errores

| Código | Descripción                     |
|--------|---------------------------------|
| 401    | Token inválido o faltante       |
| 403    | Usuario sin empresa o permisos  |

---

### POST /api/tasks

Crea una nueva tarea.

**Autenticación:** Requiere JWT en cookies
**Autorización:** Usuario con empresa asociada (no SUPERADMIN)

#### Request

```http
POST /api/tasks
Content-Type: application/json

{
  "title": "Revisar inventario",
  "description": "Contar stock del almacén principal",
  "assignedToId": 10,
  "priority": "alta",
  "dueDate": "2026-03-01T00:00:00.000Z",
  "tags": ["inventario", "almacén"],
  "subtasks": [
    { "title": "Contar sector A" },
    { "title": "Contar sector B" }
  ],
  "attachments": [
    {
      "name": "planilla.xlsx",
      "url": "/uploads/planilla.xlsx",
      "size": 12000,
      "type": "application/vnd.ms-excel"
    }
  ]
}
```

| Campo          | Tipo     | Requerido | Validación                          |
|----------------|----------|-----------|-------------------------------------|
| `title`        | string   | Sí        | 3-200 caracteres, sanitizado        |
| `description`  | string   | No        | Máx 5000 caracteres, sanitizado     |
| `assignedToId` | number   | Sí        | ID de usuario válido existente       |
| `priority`     | string   | No        | `baja`, `media`, `alta`, `urgente` (default: `media`) |
| `dueDate`      | ISO date | No        | Fecha ISO 8601 válida               |
| `tags`         | string[] | No        | Máx 10 tags, cada uno máx 50 chars  |
| `subtasks`     | array    | No        | Máx 50, título máx 200 chars        |
| `attachments`  | array    | No        | Máx 10 archivos                     |

#### Response (201 Created)

```json
{
  "id": "124",
  "title": "Revisar inventario",
  "description": "Contar stock del almacén principal",
  "status": "pendiente",
  "priority": "alta",
  "dueDate": "2026-03-01T00:00:00.000Z",
  "assignedTo": {
    "id": 10,
    "name": "Juan Pérez",
    "email": "juan@empresa.com"
  },
  "createdBy": {
    "id": 5,
    "name": "María García",
    "email": "maria@empresa.com"
  },
  "tags": ["inventario", "almacén"],
  "progress": 0,
  "subtasks": [],
  "files": [],
  "createdAt": "2026-02-13T12:00:00.000Z",
  "updatedAt": "2026-02-13T12:00:00.000Z"
}
```

#### Efectos secundarios

- Subtareas creadas junto con la tarea
- Archivos adjuntos registrados en `TaskAttachment`
- **Notificación instantánea** enviada al asignado (si no es el creador)

#### Errores

| Código | Descripción                          |
|--------|--------------------------------------|
| 400    | Validación fallida (título, usuario inválido, etc.) |
| 401    | Token faltante o inválido            |
| 403    | SUPERADMIN o usuario sin empresa     |

---

### GET /api/tasks/[id]

Obtiene detalle completo de una tarea incluyendo comentarios.

**Autenticación:** Requiere JWT en cookies
**Autorización:** Usuario con acceso a la empresa de la tarea

#### Request

```http
GET /api/tasks/123
```

#### Response (200 OK)

Igual que el objeto de tarea en la lista, con campo adicional:

```json
{
  "comments": [
    {
      "id": "1",
      "content": "Ya empecé con el sector A",
      "userId": "10",
      "userName": "Juan Pérez",
      "userEmail": "juan@empresa.com",
      "createdAt": "2026-02-13T14:00:00.000Z"
    }
  ]
}
```

#### Errores

| Código | Descripción                      |
|--------|----------------------------------|
| 400    | ID inválido                      |
| 401    | Token faltante o inválido        |
| 403    | Sin acceso a la empresa          |
| 404    | Tarea no encontrada              |

---

### PUT /api/tasks/[id]

Actualiza una tarea existente.

**Autenticación:** Requiere JWT en cookies
**Autorización:** Usuario con empresa asociada

#### Request

```http
PUT /api/tasks/123
Content-Type: application/json

{
  "status": "en-curso",
  "progress": 50,
  "subtasks": [
    { "id": "456", "completed": true },
    { "title": "Contar sector C" }
  ]
}
```

Todos los campos son opcionales:

| Campo          | Tipo     | Validación                          |
|----------------|----------|-------------------------------------|
| `title`        | string   | 3-200 caracteres si se proporciona  |
| `description`  | string   | Máx 5000 caracteres                 |
| `status`       | string   | `pendiente`, `en-curso`, `realizada`, `cancelada` |
| `priority`     | string   | `baja`, `media`, `alta`, `urgente`  |
| `dueDate`      | ISO date | Fecha válida o null                 |
| `assignedToId` | number   | ID de usuario válido o null         |
| `tags`         | string[] | Máx 10 tags                         |
| `progress`     | number   | 0-100                               |
| `subtasks`     | array    | Con `id` → actualizar; sin `id` → crear nueva |

#### Response (200 OK)

Retorna el objeto tarea actualizado completo.

#### Notificaciones enviadas

1. **Tarea completada:** Notifica al creador (si status → `realizada`)
2. **Tarea reasignada:** Notifica al nuevo asignado (si cambia `assignedToId`)
3. **Cambios significativos:** Notifica a asignado Y creador (cambios en título, descripción, prioridad o fecha límite)

#### Errores

| Código | Descripción                     |
|--------|---------------------------------|
| 400    | Validación fallida              |
| 401    | Token o usuario sin empresa     |
| 404    | Tarea no encontrada en empresa  |

---

### DELETE /api/tasks/[id]

Elimina una tarea (soft delete).

**Autenticación:** Requiere JWT en cookies
**Autorización:** Solo el creador de la tarea puede eliminarla

#### Request

```http
DELETE /api/tasks/123
```

#### Response (200 OK)

```json
{
  "message": "Tarea eliminada exitosamente"
}
```

#### Comportamiento soft delete

- Se registra `deletedAt` y `deletedBy`
- Registros hijos (comentarios, adjuntos, subtareas) preservados 90 días
- Archivos S3 purgados en limpieza automática posterior

#### Errores

| Código | Descripción                |
|--------|----------------------------|
| 400    | ID inválido                |
| 401    | Token faltante o inválido  |
| 403    | No es el creador de la tarea |
| 404    | Tarea no encontrada        |

---

### GET /api/tasks/[id]/comments

Lista comentarios de una tarea.

**Autenticación:** Requiere JWT en cookies
**Autorización:** Acceso a la empresa de la tarea

#### Response (200 OK)

```json
[
  {
    "id": "1",
    "content": "Ya empecé con el sector A",
    "userId": "10",
    "userName": "Juan Pérez",
    "userEmail": "juan@empresa.com",
    "createdAt": "2026-02-13T14:00:00.000Z"
  }
]
```

---

### POST /api/tasks/[id]/comments

Crea un comentario en una tarea.

**Autenticación:** Requiere JWT en cookies
**Autorización:** Acceso a la empresa de la tarea

#### Request

```http
POST /api/tasks/123/comments
Content-Type: application/json

{
  "content": "Terminé de contar el sector A, todo en orden"
}
```

| Campo     | Tipo   | Requerido | Descripción              |
|-----------|--------|-----------|--------------------------|
| `content` | string | Sí        | Contenido del comentario |

#### Response (200 OK)

```json
{
  "id": "5",
  "content": "Terminé de contar el sector A, todo en orden",
  "userId": "10",
  "userName": "Juan Pérez",
  "userEmail": "juan@empresa.com",
  "createdAt": "2026-02-13T16:00:00.000Z"
}
```

#### Notificaciones

- Se notifica al asignado (si no es el autor del comentario)
- Se notifica al creador (si no es el autor ni fue ya notificado)

---

### PUT /api/tasks/[id]/subtasks/[subtaskId]

Actualiza el estado de completado de una subtarea.

**Autenticación:** Requiere JWT en cookies
**Autorización:** Solo el asignado de la tarea puede actualizar subtareas

#### Request

```http
PUT /api/tasks/123/subtasks/456
Content-Type: application/json

{
  "completed": true
}
```

#### Response (200 OK)

```json
{
  "id": "456",
  "title": "Contar sector A",
  "completed": true
}
```

#### Errores

| Código | Descripción                          |
|--------|--------------------------------------|
| 400    | ID inválido                          |
| 401    | Token faltante o inválido            |
| 403    | No es el asignado de la tarea        |
| 404    | Tarea o subtarea no encontrada       |

---

## 4. Órdenes de Trabajo (Work Orders)

### GET /api/work-orders

Lista órdenes de trabajo paginadas con filtros.

**Autenticación:** Requiere JWT en cookies
**Permisos:** `work_orders.view`
**Rate Limit:** 300 req/min

#### Request

```http
GET /api/work-orders?companyId=1&status=PENDING&priority=HIGH&page=1&pageSize=50
```

| Parámetro      | Tipo   | Default | Descripción                              |
|----------------|--------|---------|------------------------------------------|
| `companyId`    | number | —       | Filtrar por empresa                      |
| `status`       | string | —       | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `priority`     | string | —       | `LOW`, `MEDIUM`, `HIGH`, `URGENT`        |
| `type`         | string | —       | Tipo de mantenimiento (ej: `PREVENTIVE`) |
| `machineId`    | number | —       | Filtrar por máquina                      |
| `assignedToId` | number | —       | Filtrar por usuario asignado             |
| `page`         | number | `1`     | Página (mínimo 1)                        |
| `pageSize`     | number | `100`   | Resultados por página (máx 200)          |

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "title": "Cambiar rodamiento",
      "description": "Rodamiento de bomba principal desgastado",
      "status": "PENDING",
      "priority": "HIGH",
      "type": "PREVENTIVE",
      "machineId": 123,
      "componentId": 456,
      "assignedToId": 789,
      "assignedWorkerId": 101,
      "createdById": 102,
      "sectorId": 12,
      "companyId": 5,
      "scheduledDate": "2026-03-15T10:00:00.000Z",
      "estimatedHours": 4.5,
      "actualHours": null,
      "completedDate": null,
      "cost": 500.00,
      "notes": "Usar rodamiento de alta calidad",
      "createdAt": "2026-02-13T08:30:00.000Z",
      "updatedAt": "2026-02-13T08:30:00.000Z",
      "machine": {
        "id": 123,
        "name": "Bomba Principal",
        "code": "BP-001",
        "sectorId": 12
      },
      "component": { "id": 456, "name": "Conjunto Rodamiento" },
      "assignedTo": {
        "id": 789,
        "name": "Juan Pérez",
        "email": "juan@empresa.com"
      },
      "assignedWorker": {
        "id": 101,
        "name": "Pedro García",
        "phone": "+54 9 11 1234-5678",
        "specialty": "Sistemas Hidráulicos"
      },
      "createdBy": {
        "id": 102,
        "name": "Admin",
        "email": "admin@empresa.com"
      },
      "sector": { "id": 12, "name": "Mantenimiento" },
      "attachments": [],
      "componentNames": ["Rodamiento", "Eje"],
      "failureType": "WEAR",
      "relatedFailureId": 98765
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 100,
    "total": 245,
    "totalPages": 3
  }
}
```

#### Errores

| Código | Descripción                  |
|--------|------------------------------|
| 400    | Parámetros inválidos         |
| 401    | Token faltante o inválido    |
| 403    | Sin permiso `work_orders.view` |
| 429    | Rate limit excedido          |

---

### POST /api/work-orders

Crea una nueva orden de trabajo.

**Autenticación:** Requiere JWT en cookies
**Permisos:** `work_orders.create`
**Rate Limit:** 100 req/min

#### Request

```http
POST /api/work-orders
Content-Type: application/json

{
  "title": "Cambiar rodamiento",
  "description": "Rodamiento de bomba principal desgastado",
  "priority": "HIGH",
  "type": "PREVENTIVE",
  "machineId": 123,
  "componentId": 456,
  "assignedToId": 789,
  "assignedWorkerId": 101,
  "createdById": 102,
  "scheduledDate": "2026-03-15T10:00:00.000Z",
  "estimatedHours": 4.5,
  "cost": 500.00,
  "notes": "Usar rodamiento de alta calidad",
  "companyId": 5,
  "sectorId": 12
}
```

| Campo              | Tipo     | Requerido | Validación                      |
|--------------------|----------|-----------|---------------------------------|
| `title`            | string   | Sí        | 1-300 chars, sanitizado         |
| `description`      | string   | No        | Máx 5000 chars, sanitizado      |
| `priority`         | enum     | No        | `LOW`, `MEDIUM`, `HIGH`, `URGENT` (default: `MEDIUM`) |
| `type`             | string   | Sí        | Máx 50 chars, sanitizado        |
| `machineId`        | number   | No        | Entero positivo                 |
| `componentId`      | number   | No        | Entero positivo                 |
| `assignedToId`     | number   | No        | Entero positivo                 |
| `assignedWorkerId` | number   | No        | Entero positivo                 |
| `createdById`      | number   | Sí        | Entero positivo                 |
| `scheduledDate`    | ISO date | No        | Fecha ISO 8601 válida           |
| `estimatedHours`   | number   | No        | >= 0                            |
| `cost`             | number   | No        | >= 0                            |
| `notes`            | string   | No        | Máx 10000 chars, sanitizado     |
| `companyId`        | number   | Sí        | Entero positivo                 |
| `sectorId`         | number   | No        | Entero positivo                 |
| `status`           | enum     | No        | Default: `PENDING`              |

#### Response (201 Created)

Retorna el objeto OT creado completo con relaciones expandidas.

#### Efectos secundarios

- Si hay `assignedWorkerId`, la info del operario se agrega al campo `notes`
- **Notificación in-app** al asignado
- **Notificación Discord** si hay sector asignado
- **Métricas:** `work_orders_created` con tags (type, priority, status)
- **Automatizaciones:** Dispara `triggerWorkOrderCreated()`

#### Errores

| Código | Descripción                    |
|--------|--------------------------------|
| 400    | Validación fallida             |
| 401    | Token faltante o inválido      |
| 403    | Sin permiso `work_orders.create` |
| 429    | Rate limit excedido            |

---

### GET /api/work-orders/[id]

Obtiene detalle de una orden de trabajo con datos relacionados opcionales.

**Autenticación:** Requiere JWT en cookies
**Permisos:** `work_orders.view`
**Rate Limit:** 300 req/min

#### Request

```http
GET /api/work-orders/456?include=watchers,downtimeLogs,failureOccurrences,counts
```

| Parámetro | Tipo   | Descripción                                                |
|-----------|--------|------------------------------------------------------------|
| `include` | string | Lista separada por comas: `watchers`, `downtimeLogs`, `failureOccurrences`, `counts` |

#### Response (200 OK)

Objeto completo de OT con campos opcionales según `include`:

```json
{
  "id": 456,
  "title": "Cambiar rodamiento",
  "status": "IN_PROGRESS",
  "machine": { "..." },
  "assignedTo": { "..." },

  "watchers": [
    {
      "id": 1,
      "user": { "id": 999, "name": "Monitor", "email": "monitor@empresa.com" }
    }
  ],
  "downtimeLogs": [
    {
      "id": 1,
      "startedAt": "2026-03-15T09:00:00.000Z",
      "endedAt": "2026-03-15T11:30:00.000Z",
      "totalMinutes": 150,
      "category": "MAINTENANCE",
      "reason": "Cambio de rodamiento"
    }
  ],
  "failureOccurrences": [
    {
      "id": 98765,
      "title": "Desgaste de rodamiento",
      "status": "RESOLVED",
      "subcomponents": [
        { "id": 456, "name": "Pista Interna" }
      ]
    }
  ],
  "_count": {
    "workLogs": 3,
    "comments": 5
  }
}
```

#### Errores

| Código | Descripción                  |
|--------|------------------------------|
| 401    | Token faltante o inválido    |
| 403    | Sin permiso `work_orders.view` |
| 404    | OT no encontrada             |
| 429    | Rate limit excedido          |

---

### PUT /api/work-orders/[id]

Actualiza una orden de trabajo existente (actualización parcial).

**Autenticación:** Requiere JWT en cookies
**Permisos:** `work_orders.edit`
**Rate Limit:** 100 req/min

#### Request

```http
PUT /api/work-orders/456
Content-Type: application/json

{
  "status": "IN_PROGRESS",
  "actualHours": 2.5,
  "notes": "En progreso - rodamiento pedido"
}
```

Todos los campos son opcionales (misma estructura que POST, con nullable).

#### Response (200 OK)

Retorna el objeto OT actualizado completo.

#### Timestamps automáticos

- Si status cambia a `IN_PROGRESS` y no se proporciona `startedDate` → se establece `now()`
- Si status cambia a `COMPLETED` y no se proporciona `completedDate` → se establece `now()`

#### Notificaciones y automatizaciones

- **Reasignación:** Notificación in-app al nuevo asignado
- **Cambio de status:** Dispara `triggerWorkOrderStatusChanged()`
- **Cambio de asignado:** Dispara `triggerWorkOrderAssigned()`

#### Errores

| Código | Descripción                  |
|--------|------------------------------|
| 400    | ID inválido o validación fallida |
| 401    | Token faltante o inválido    |
| 403    | Sin permiso `work_orders.edit` |
| 404    | OT no encontrada             |
| 429    | Rate limit excedido          |

---

### DELETE /api/work-orders

Soft delete de una orden de trabajo.

**Autenticación:** Requiere JWT en cookies
**Permisos:** `work_orders.delete`
**Rate Limit:** 100 req/min

#### Request

```http
DELETE /api/work-orders?id=456
```

| Parámetro | Tipo   | Requerido | Descripción   |
|-----------|--------|-----------|---------------|
| `id`      | number | Sí        | ID de la OT   |

#### Response (200 OK)

```json
{
  "message": "Orden de trabajo eliminada exitosamente",
  "deletedOrder": {
    "id": 456,
    "title": "Cambiar rodamiento",
    "machine": "Bomba Principal"
  }
}
```

#### Autorización jerárquica

1. **SUPERADMIN** → puede eliminar cualquier OT
2. **System ADMIN** → si está en la misma empresa
3. **Company Admin/Administrator** → si está en la misma empresa
4. **Creador** → puede eliminar su propia OT
5. **Permiso específico** → `work_orders.delete`

#### Errores

| Código | Descripción                          |
|--------|--------------------------------------|
| 400    | ID faltante o inválido               |
| 401    | Token faltante o inválido            |
| 403    | Sin permisos o no autorizado para esta OT |
| 404    | OT no encontrada                     |
| 429    | Rate limit excedido                  |

---

### DELETE /api/work-orders/[id]

Soft delete de una orden de trabajo por ID en ruta.

**Autenticación:** Requiere JWT en cookies
**Permisos:** `work_orders.delete`
**Rate Limit:** 100 req/min

#### Request

```http
DELETE /api/work-orders/456
```

#### Response (204 No Content)

Sin body.

#### Notas

- Marca con `deletedAt` y `deletedBy`
- Audit log via `auditWorkOrderDelete()`
- Datos preservados en DB (soft delete)

---

## 5. Inventario Completo de Endpoints

### Módulos principales

| Módulo | Ruta Base | Descripción |
|--------|-----------|-------------|
| Auth | `/api/auth/*` | Autenticación y sesiones |
| Companies | `/api/companies/*` | Gestión de empresas |
| Tasks | `/api/tasks/*` | Gestión de tareas |
| Work Orders | `/api/work-orders/*` | Órdenes de trabajo y mantenimiento |
| Maintenance | `/api/maintenance/*` | Mantenimiento preventivo/correctivo |
| Machines | `/api/machines/*` | Gestión de máquinas |
| Components | `/api/components/*` | Componentes de máquinas |
| Work Stations | `/api/work-stations/*` | Estaciones de trabajo |
| Failures | `/api/failures/*`, `/api/failure-occurrences/*` | Catálogo y ocurrencias de fallas |
| Tools | `/api/tools/*` | Herramientas y préstamos |
| Costs | `/api/costs/*`, `/api/costos/*` | Costos y calculadora |
| Purchases | `/api/compras/*` | Compras y proveedores |
| Sales | `/api/ventas/*` | Ventas, cotizaciones, facturación |
| Production | `/api/production/*` | Producción y lotes |
| Payroll | `/api/nominas/*`, `/api/payroll/*` | Nóminas y liquidaciones |
| Treasury | `/api/tesoreria/*` | Tesorería, bancos, cheques |
| Warehouse | `/api/almacen/*`, `/api/panol/*` | Almacén y pañol |
| Users | `/api/users/*` | Gestión de usuarios |
| Employees | `/api/employees/*` | Empleados y salarios |
| Admin | `/api/admin/*` | Administración del sistema |
| Notifications | `/api/notifications/*` | Notificaciones |
| Automations | `/api/automations/*` | Automatizaciones |
| Dashboard | `/api/dashboard/*` | Métricas y dashboards |
| AI/Assistant | `/api/ai/*`, `/api/assistant/*` | IA y asistente virtual |
| Cron | `/api/cron/*` | Tareas programadas |
| Fixed Tasks | `/api/fixed-tasks/*` | Tareas fijas recurrentes |
| Agenda | `/api/agenda/*` | Agenda y asignaciones |

### Detalle por módulo

#### Auth (4 endpoints)
```
POST   /api/auth/login     → Iniciar sesión
POST   /api/auth/logout    → Cerrar sesión
POST   /api/auth/refresh   → Renovar token
GET    /api/auth/me         → Verificar sesión
POST   /api/auth/me         → Buscar usuario por email
```

#### Companies (5 endpoints)
```
GET    /api/companies       → Listar empresas
POST   /api/companies       → Crear empresa
GET    /api/companies/[id]  → Detalle de empresa
PUT    /api/companies/[id]  → Actualizar empresa
DELETE /api/companies/[id]  → Eliminar empresa
```

#### Tasks (10 endpoints)
```
GET    /api/tasks                              → Listar tareas
POST   /api/tasks                              → Crear tarea
GET    /api/tasks/[id]                         → Detalle de tarea
PUT    /api/tasks/[id]                         → Actualizar tarea
DELETE /api/tasks/[id]                         → Eliminar tarea
GET    /api/tasks/[id]/comments                → Listar comentarios
POST   /api/tasks/[id]/comments                → Crear comentario
GET    /api/tasks/[id]/files                   → Listar archivos
POST   /api/tasks/[id]/files                   → Subir archivo (501)
PUT    /api/tasks/[id]/subtasks/[subtaskId]    → Actualizar subtarea
```

#### Work Orders (17+ endpoints)
```
GET    /api/work-orders                        → Listar OTs
POST   /api/work-orders                        → Crear OT
DELETE /api/work-orders                        → Eliminar OT (por query)
GET    /api/work-orders/[id]                   → Detalle de OT
PUT    /api/work-orders/[id]                   → Actualizar OT
DELETE /api/work-orders/[id]                   → Eliminar OT
GET    /api/work-orders/[id]/comments          → Comentarios
POST   /api/work-orders/[id]/comments          → Crear comentario
GET    /api/work-orders/[id]/ai-suggestions    → Sugerencias IA
POST   /api/work-orders/[id]/apply-solution    → Aplicar solución
POST   /api/work-orders/[id]/assign-and-plan   → Asignar y planificar
GET    /api/work-orders/[id]/checklists        → Checklists
POST   /api/work-orders/[id]/checklists        → Crear checklist
POST   /api/work-orders/[id]/close             → Cerrar OT
POST   /api/work-orders/[id]/rca               → Análisis causa raíz
GET    /api/work-orders/[id]/sla               → Info SLA
GET    /api/work-orders/[id]/timeline          → Timeline de eventos
GET    /api/work-orders/[id]/watchers          → Observadores
POST   /api/work-orders/[id]/watchers          → Agregar observador
DELETE /api/work-orders/[id]/watchers          → Quitar observador
GET    /api/work-orders/[id]/work-logs         → Registros de trabajo
POST   /api/work-orders/[id]/work-logs         → Crear registro
GET    /api/work-orders/dashboard              → Dashboard de OTs
GET    /api/work-orders/dispatcher             → Despachador
POST   /api/work-orders/dispatcher             → Despachar OTs
GET    /api/work-orders/stats                  → Estadísticas
```

#### Maintenance (35+ endpoints)
```
GET/PUT/DELETE /api/maintenance/[id]           → CRUD mantenimiento
GET    /api/maintenance/[id]/stats             → Estadísticas
GET/POST /api/maintenance/checklists           → Checklists
GET/PUT/DELETE /api/maintenance/checklists/[id] → CRUD checklist
POST   /api/maintenance/checklists/[id]/execute → Ejecutar checklist
GET    /api/maintenance/checklists/history     → Historial
GET/PUT /api/maintenance/config                → Configuración
GET/POST /api/maintenance/corrective           → Mantenimiento correctivo
POST   /api/maintenance/create                 → Crear mantenimiento
GET/POST /api/maintenance/smart-checklists     → Checklists inteligentes
POST   /api/maintenance/preventive/[id]/complete → Completar preventivo
GET    /api/maintenance/costs                  → Costos
```

#### Machines (10+ endpoints)
```
GET/POST /api/machines                         → CRUD máquinas
GET/PUT/DELETE /api/machines/[id]              → Operaciones por ID
GET/POST /api/machines/[id]/components         → Componentes
GET    /api/machines/[id]/counters             → Contadores
POST   /api/machines/[id]/disassemble          → Desarmar máquina
GET    /api/machines/[id]/disassemble-preview  → Preview desarme
POST   /api/machines/[id]/duplicate            → Duplicar máquina
GET    /api/machines/[id]/health-score         → Score de salud
GET    /api/machines/[id]/history              → Historial
POST   /api/machines/check-duplicate           → Verificar duplicado
```

#### Purchases (60+ endpoints)
```
GET/POST /api/compras/ordenes-compra           → Órdenes de compra
GET/POST /api/compras/pedidos                  → Pedidos
GET/POST /api/compras/solicitudes              → Solicitudes
GET/POST /api/compras/recepciones              → Recepciones
GET/POST /api/compras/comprobantes             → Comprobantes
GET    /api/compras/cuentas-corrientes         → Cuentas corrientes
GET/POST /api/compras/devoluciones             → Devoluciones
GET/POST /api/compras/proveedores              → Proveedores
GET/POST /api/compras/stock/*                  → Stock y movimientos
GET    /api/compras/dashboard                  → Dashboard compras
GET    /api/compras/torre-control              → Torre de control
```

#### Sales (80+ endpoints)
```
GET/POST /api/ventas/ordenes                   → Órdenes de venta
GET/POST /api/ventas/cotizaciones              → Cotizaciones
GET/POST /api/ventas/facturas                  → Facturas
GET/POST /api/ventas/entregas                  → Entregas y despachos
GET/POST /api/ventas/pagos                     → Pagos
GET/POST /api/ventas/clientes                  → Clientes
GET/POST /api/ventas/listas-precios            → Listas de precios
GET/POST /api/ventas/productos                 → Productos de venta
GET/POST /api/ventas/configuracion             → Configuración
GET    /api/ventas/dashboard                   → Dashboards
GET    /api/ventas/cuenta-corriente            → Cuentas corrientes
```

#### Production (25+ endpoints)
```
GET/POST /api/production/orders                → Órdenes de producción
GET/POST /api/production/daily-entries          → Entradas diarias
GET/POST /api/production/daily-reports          → Reportes diarios
GET/POST /api/production/daily-sessions         → Sesiones diarias
GET/POST /api/production/lots                  → Lotes
GET/POST /api/production/downtimes             → Tiempos muertos
GET/POST /api/production/work-centers          → Centros de trabajo
GET/POST /api/production/shifts                → Turnos
GET/POST /api/production/routines              → Rutinas
GET    /api/production/kpis                    → KPIs
```

#### Treasury (20+ endpoints)
```
GET/POST /api/tesoreria/movimientos            → Movimientos
GET/POST /api/tesoreria/bancos                 → Bancos
GET/POST /api/tesoreria/cajas                  → Cajas
GET/POST /api/tesoreria/cheques                → Cheques
GET/POST /api/tesoreria/cierres                → Cierres de caja
GET    /api/tesoreria/conciliacion             → Conciliación bancaria
GET    /api/tesoreria/flujo-caja/proyeccion    → Proyección flujo de caja
GET    /api/tesoreria/posicion                 → Posición financiera
```

---

## 6. Patrones Comunes

### Middleware de autenticación

#### withGuards (endpoints nuevos)

```typescript
export const GET = withGuards(handler, {
  requiredPermissions: ['work_orders.view'],
  permissionMode: 'any'  // 'any' = OR, 'all' = AND
});
```

Rate limits por defecto:
- `GET/HEAD/OPTIONS`: 300 req/min
- `POST/PUT/PATCH/DELETE`: 100 req/min

#### JWT manual (endpoints legacy)

```typescript
const token = cookies().get('token')?.value;
const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
```

### Respuestas de error

#### Error de validación (400)

```json
{
  "error": "Mensaje descriptivo",
  "errors": [
    { "field": "title", "message": "Mínimo 3 caracteres" }
  ]
}
```

#### Error de autenticación (401)

```json
{
  "error": "No autorizado"
}
```

#### Error de permisos (403)

```json
{
  "error": "No tienes permisos para realizar esta acción",
  "requiredPermissions": ["work_orders.delete"]
}
```

#### Rate limit (429)

```json
{
  "error": "Demasiadas solicitudes. Intenta de nuevo más tarde.",
  "retryAfter": 60,
  "blockedUntil": "2026-02-13T15:01:00.000Z"
}
```

Headers: `Retry-After: 60`

### Sanitización de entrada

Todos los campos de texto de usuario se sanitizan con **DOMPurify** para prevenir XSS:
- Títulos
- Descripciones
- Notas
- Comentarios

### Multi-tenancy

Todos los endpoints que acceden a datos de negocio filtran automáticamente por `companyId` del usuario autenticado.

### Soft Delete

Los modelos críticos (tareas, OTs) implementan soft delete:
- `deletedAt`: Timestamp de eliminación
- `deletedBy`: ID del usuario que eliminó
- Retención de 90 días antes de purga automática

### Paginación

Formato estándar:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Notificaciones

Muchos endpoints envían notificaciones de forma asíncrona (fire-and-forget):
- **In-app:** Via `/api/notifications`
- **Discord:** Via helpers de integración
- Los errores de notificación no bloquean la respuesta principal
