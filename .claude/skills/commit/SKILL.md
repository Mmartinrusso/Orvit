---
name: commit
description: Crear un commit de git con el formato estándar del proyecto Mawir. Incluye co-authored-by de Claude.
disable-model-invocation: true
argument-hint: "[mensaje opcional]"
---

# Git Commit — Mawir

Crear un commit siguiendo el proceso estándar del proyecto.

## Pasos

1. **Ver estado actual** (en paralelo):
   ```bash
   git status
   git diff --staged
   git log --oneline -5
   ```

2. **Analizar cambios** y determinar:
   - Tipo: `feat` / `fix` / `refactor` / `chore` / `docs` / `test` / `style`
   - Scope: módulo afectado (ej: `tasks`, `maintenance`, `discord`, `api`, `agx`)
   - Descripción: qué cambia y POR QUÉ (no solo qué)

3. **Agregar archivos** (específicos, no `git add .`):
   ```bash
   git add path/to/file1 path/to/file2
   ```
   ⚠️ Nunca agregar: `.env`, `.env.local`, archivos con credenciales

4. **Crear commit** con HEREDOC:
   ```bash
   git commit -m "$(cat <<'EOF'
   tipo(scope): descripción concisa en español

   Descripción opcional de contexto adicional si es necesario.

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

5. **Verificar**:
   ```bash
   git status
   git log --oneline -1
   ```

## Formato de mensaje

```
feat(tasks): agregar vista kanban con drag & drop

fix(api): corregir crash en route de maintenance cuando id es null

refactor(cache): consolidar server cache en singleton

chore(deps): actualizar tanstack query a v5.90
```

## Reglas

- Mensaje en **español**
- Primera línea máximo **70 caracteres**
- Usar **HEREDOC** siempre (nunca `-m "texto"` directo para mensajes largos)
- Si $ARGUMENTS tiene texto, usarlo como base del mensaje de commit
- **No usar** `--no-verify`, `--amend` sin solicitud explícita
- **No hacer push** a menos que se pida explícitamente
