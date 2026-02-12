import { readFileSync, readdirSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('skills');

export interface Skill {
  id: string;           // filename without extension
  name: string;
  description: string;
  triggers: string[];   // keywords/patterns that activate this skill
  category: string;     // e.g., "development", "testing", "security", "performance"
  autoActivate: boolean; // whether to auto-match based on triggers
  content: string;      // the full skill instructions (markdown body)
  filePath: string;
}

interface SkillFrontmatter {
  name: string;
  description: string;
  triggers: string[];
  category: string;
  autoActivate?: boolean;
}

// Parse YAML-like frontmatter from a skill file
function parseFrontmatter(fileContent: string): { frontmatter: SkillFrontmatter; body: string } {
  // Normalize line endings (Windows CRLF → LF)
  const normalized = fileContent.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error('Invalid skill file: missing frontmatter');
  }

  const yamlStr = match[1];
  const body = match[2].trim();

  // Simple YAML parser for our flat structure
  const fm: Record<string, unknown> = {};
  let currentKey = '';
  let inArray = false;
  const arrayValues: string[] = [];

  for (const line of yamlStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (inArray && trimmed.startsWith('- ')) {
      arrayValues.push(trimmed.substring(2).trim().replace(/^["']|["']$/g, ''));
      continue;
    } else if (inArray) {
      fm[currentKey] = [...arrayValues];
      inArray = false;
      arrayValues.length = 0;
    }

    const kvMatch = trimmed.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      if (value === '' || value === undefined) {
        // Could be an array starting next line
        currentKey = key;
        inArray = true;
        arrayValues.length = 0;
      } else {
        // Simple value
        const cleanVal = value.replace(/^["']|["']$/g, '').trim();
        if (cleanVal === 'true') fm[key] = true;
        else if (cleanVal === 'false') fm[key] = false;
        else fm[key] = cleanVal;
      }
    }
  }

  // Flush last array
  if (inArray && arrayValues.length > 0) {
    fm[currentKey] = [...arrayValues];
  }

  return {
    frontmatter: {
      name: (fm.name as string) || 'Unnamed Skill',
      description: (fm.description as string) || '',
      triggers: (fm.triggers as string[]) || [],
      category: (fm.category as string) || 'general',
      autoActivate: fm.autoActivate !== false, // default true
    },
    body,
  };
}

function getSkillsDir(): string {
  // Skills directory is at the AGX root (Stefano-code/skills/)
  const dir = join(process.cwd(), 'skills');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Load all skills from the skills directory
 */
export function loadAllSkills(): Skill[] {
  const skillsDir = getSkillsDir();
  const skills: Skill[] = [];

  try {
    const files = readdirSync(skillsDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      try {
        const filePath = join(skillsDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const { frontmatter, body } = parseFrontmatter(content);

        skills.push({
          id: basename(file, '.md'),
          name: frontmatter.name,
          description: frontmatter.description,
          triggers: frontmatter.triggers,
          category: frontmatter.category,
          autoActivate: frontmatter.autoActivate ?? true,
          content: body,
          filePath,
        });
      } catch (err) {
        logger.warn({ file, error: err }, 'Failed to parse skill file');
      }
    }
  } catch (err) {
    logger.warn({ error: err }, 'Failed to read skills directory');
  }

  logger.debug({ skillCount: skills.length }, 'Loaded skills');
  return skills;
}

/**
 * Match skills to a prompt based on triggers
 */
export function matchSkills(prompt: string, allSkills?: Skill[]): Skill[] {
  const skills = allSkills || loadAllSkills();
  const promptLower = prompt.toLowerCase();
  const matched: Skill[] = [];

  for (const skill of skills) {
    if (!skill.autoActivate) continue;

    const triggerMatch = skill.triggers.some(trigger => {
      const triggerLower = trigger.toLowerCase();
      return promptLower.includes(triggerLower);
    });

    if (triggerMatch) {
      matched.push(skill);
    }
  }

  logger.info({
    promptPreview: prompt.substring(0, 100),
    matchedSkills: matched.map(s => s.id),
    totalSkills: skills.length,
  }, 'Matched skills to prompt');

  return matched;
}

/**
 * Build additional system prompt context from matched skills
 */
export function buildSkillsContext(matchedSkills: Skill[]): string {
  if (matchedSkills.length === 0) return '';

  const parts = matchedSkills.map(skill => {
    return `## Skill: ${skill.name}
${skill.content}`;
  });

  return `
=== SKILLS ACTIVADAS ===
Las siguientes habilidades especializadas se han activado para esta tarea:

${parts.join('\n\n')}
=== FIN SKILLS ===`;
}

/**
 * Get a specific skill by ID
 */
export function getSkillById(id: string): Skill | null {
  const skills = loadAllSkills();
  return skills.find(s => s.id === id) || null;
}

/**
 * Save a skill file
 */
export function saveSkill(id: string, data: {
  name: string;
  description: string;
  triggers: string[];
  category: string;
  autoActivate: boolean;
  content: string;
}): Skill {
  const skillsDir = getSkillsDir();
  const filePath = join(skillsDir, `${id}.md`);

  const triggersYaml = data.triggers.map(t => `  - "${t}"`).join('\n');

  const fileContent = `---
name: "${data.name}"
description: "${data.description}"
triggers:
${triggersYaml}
category: "${data.category}"
autoActivate: ${data.autoActivate}
---
${data.content}`;

  writeFileSync(filePath, fileContent, 'utf-8');
  logger.info({ id, name: data.name }, 'Skill saved');

  return {
    id,
    name: data.name,
    description: data.description,
    triggers: data.triggers,
    category: data.category,
    autoActivate: data.autoActivate,
    content: data.content,
    filePath,
  };
}

/**
 * Delete a skill
 */
export function deleteSkill(id: string): boolean {
  const skillsDir = getSkillsDir();
  const filePath = join(skillsDir, `${id}.md`);

  if (!existsSync(filePath)) return false;

  unlinkSync(filePath);
  logger.info({ id }, 'Skill deleted');
  return true;
}
