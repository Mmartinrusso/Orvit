---
name: orvit-agx
description: Sistema AGX — pipeline de IA para generación automática de código. Usar al trabajar en agx-v1/, modificar el pipeline, crear skills AGX, o entender cómo AGX genera código en orvit-v1.
---

# AGX — AI Code Generation Pipeline

## Qué es AGX

AGX (`agx-v1/`) es una herramienta interna que automatiza tareas de desarrollo en `orvit-v1/` usando Claude como motor. Recibe una tarea en lenguaje natural y ejecuta un pipeline de agentes que la implementa en el código.

**Puertos:**
- API: `http://localhost:4200`
- Cliente UI: `http://localhost:5173`

---

## Pipeline de stages

```
Prompt usuario
    ↓
[locator]      → Identifica archivos relevantes (Glob + Grep)
    ↓
[planner]      → Genera plan JSON (Read, Glob, Grep — sin escritura)
    ↓
[implementer]  → Implementa los cambios (todos los tools disponibles)
    ↓
[verifier]     → Verifica que el código funciona (Read, Grep)
    ↓
[fixer]        → Si hay errores, los corrige (max 3 intentos)
    ↓
[git]          → Crea commit con Co-Authored-By: Claude
```

**Modos disponibles:**
- `fast` — locator → implementer → git (sin planner/verifier, rápido)
- `full` — pipeline completo
- `auto` — analiza complejidad primero y elige modo

---

## Config AGX

```env
# agx-v1/.env
TARGET_PROJECT=orvit-v1        # Subdirectorio a analizar
AGX_API_PORT=4200
DATABASE_URL=...               # SQLite local para tasks + checkpoints
```

```ts
// config.ts
config.targetProjectPath  // Path absoluto a orvit-v1/ — cwd de Claude
config.projectRoot        // Path a Mawir/ — solo para git operations
```

---

## Skills AGX — Formato

Las skills AGX viven en `agx-v1/skills/` y se inyectan en el contexto de los agentes cuando el prompt hace match con los triggers.

```yaml
---
name: "Nombre de la Skill"
description: "Qué hace y para qué sirve"
triggers:
  - "keyword1"
  - "keyword2"
  - "frase clave"
category: "development|testing|security|performance|ui"
autoActivate: true
---

# Instrucciones en markdown

Cuando [trigger], hacer:

1. **Paso uno**: descripción
2. **Paso dos**: descripción
...
```

**Skills existentes:**
- `fix-bugs.md` — análisis y corrección de bugs
- `optimize-performance.md` — optimización de rendimiento
- `security-review.md` — auditoría de seguridad
- `add-tests.md` — tests unitarios e integración
- `refactor-code.md` — refactoring
- `ui-ux-improvement.md` — mejoras de UI/UX
- `api-development.md` — desarrollo de APIs

---

## Skill Matching

```ts
// src/services/skills.ts
interface Skill {
  id: string;           // nombre del archivo sin .md
  name: string;
  description: string;
  triggers: string[];   // keywords que activan la skill
  category: string;
  autoActivate: boolean;
  content: string;      // cuerpo markdown completo
}

// matchSkills(prompt) busca triggers (case-insensitive) en el prompt
// Las skills matcheadas se inyectan en el contexto del planner e implementer
```

---

## Task Resilience — Checkpoints

```ts
// Las tareas se persisten en SQLite
// Si el pipeline se interrumpe, se puede retomar desde el último stage

// DB tables: tasks, task_checkpoints, task_logs

// Retomar tarea:
POST /api/tasks/{taskId}/retry          // continúa desde checkpoint
POST /api/tasks/{taskId}/retry?fresh=true  // reinicia desde cero
```

---

## Planner — Output format

```json
{
  "plan": [
    {
      "step": 1,
      "file": "orvit-v1/app/api/recurso/route.ts",
      "action": "create|modify|delete",
      "description": "Qué hacer en este archivo"
    }
  ],
  "files_to_modify": ["lista", "de", "archivos"],
  "considerations": ["Notas importantes para el implementer"]
}
```

---

## Estructura de archivos AGX

```
agx-v1/
├── src/
│   ├── agents/
│   │   ├── planner.agent.ts      # Solo Read/Glob/Grep
│   │   ├── implementer.agent.ts  # Todos los tools
│   │   ├── verifier.agent.ts
│   │   └── prompts.ts            # System prompts de cada agente
│   ├── services/
│   │   ├── orchestrator.ts       # Pipeline principal
│   │   ├── claude-runner.ts      # Wrapper de Claude CLI
│   │   ├── skills.ts             # Skill matching
│   │   └── task-persistence.ts   # SQLite
│   └── repositories/
│       └── task-history.repository.ts
├── client/                       # React UI (Vite + Tailwind v4)
│   └── src/pages/TasksPage.tsx
├── skills/                       # AGX skills (ver arriba)
└── scripts/                      # Utilitarios
```

---

## Cómo crear una skill AGX efectiva

1. **Triggers específicos**: palabras que solo aparecen en el contexto de esa skill
2. **Instrucciones concretas**: pasos numerados con acciones específicas
3. **Patrones del proyecto**: referenciar patrones de orvit-v1 (serverCache, TanStack Query, etc.)
4. **No demasiado larga**: el contenido se inyecta en el contexto del agente

```yaml
---
name: "Ejemplo: Crear endpoint"
description: "Guía para crear nuevos API routes en orvit-v1"
triggers:
  - "crear endpoint"
  - "nuevo api"
  - "agregar route"
  - "nueva ruta"
category: "development"
autoActivate: true
---

Al crear un nuevo API route en orvit-v1:

1. Crear en `orvit-v1/app/api/[nombre]/route.ts`
2. Usar `requireAuth(req)` para obtener `companyId`
3. Para GET: usar `serverCache.getOrSet()` con TTL apropiado
4. Para POST/PUT: validar con Zod, invalidar cache después
5. Siempre filtrar Prisma por `companyId` y `deletedAt: null`
```
