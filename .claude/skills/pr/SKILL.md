---
name: pr
description: Crear un Pull Request en GitHub con el formato estándar del proyecto Mawir usando gh CLI.
disable-model-invocation: true
argument-hint: "[rama-base opcional, default: main]"
---

# Pull Request — Mawir

Crear un PR hacia la rama base (default: `main`).

## Pasos

1. **Analizar el estado del branch** (en paralelo):
   ```bash
   git status
   git log main...HEAD --oneline
   git diff main...HEAD --stat
   ```

2. **Determinar si hay que hacer push**:
   ```bash
   git remote -v
   # Si no hay tracking o hay commits locales sin push:
   git push -u origin HEAD
   ```

3. **Redactar PR**:
   - Título: corto (< 70 chars), imperativo, en español
   - Summary: 2-4 bullet points de qué cambia
   - Test plan: checklist de qué verificar manualmente
   - Rama base: `$ARGUMENTS` si se especificó, sino `main`

4. **Crear PR**:
   ```bash
   gh pr create \
     --base ${ARGUMENTS:-main} \
     --title "título del PR" \
     --body "$(cat <<'EOF'
   ## Resumen
   - Bullet 1
   - Bullet 2

   ## Plan de testing
   - [ ] Verificar que X funciona
   - [ ] Probar caso Y
   - [ ] Revisar Z en mobile

   🤖 Generado con [Claude Code](https://claude.ai/claude-code)

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

5. **Devolver URL del PR** al usuario.

## Reglas

- Título en **español**
- **No hacer push a main** directamente
- Si el branch es `main` o `master`, avisar y preguntar antes
- Incluir siempre el **Co-Authored-By** en el body
- El test plan debe ser específico (no genérico)
