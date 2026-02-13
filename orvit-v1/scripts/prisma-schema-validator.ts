#!/usr/bin/env npx tsx
/**
 * Prisma Schema Validator
 *
 * Detecta problemas potenciales en el schema:
 * - Modelos sin índices en foreign keys
 * - Campos que deberían ser únicos pero no lo son
 * - Relaciones faltantes o inconsistentes
 * - Foreign keys sin @relation
 * - Convenciones de naming
 *
 * Uso:
 *   npx tsx scripts/prisma-schema-validator.ts
 *   npx tsx scripts/prisma-schema-validator.ts --fix-suggestions
 *   npx tsx scripts/prisma-schema-validator.ts --model WorkOrder
 */

import * as fs from 'fs';
import * as path from 'path';

const SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');

// ─── Types ──────────────────────────────────────────────────────────────────

interface PrismaField {
  name: string;
  type: string;
  baseType: string;
  isOptional: boolean;
  isList: boolean;
  isId: boolean;
  isUnique: boolean;
  defaultValue: string | null;
  relation: { name: string; fields: string[]; references: string[] } | null;
  isRelation: boolean;
  lineNumber: number;
}

interface PrismaModel {
  name: string;
  fields: PrismaField[];
  indexes: Array<{ fields: string[]; raw: string }>;
  uniqueConstraints: Array<{ fields: string[]; raw: string }>;
  startLine: number;
}

type Severity = 'error' | 'warning' | 'info';

interface Issue {
  severity: Severity;
  model: string;
  field?: string;
  message: string;
  suggestion?: string;
  line?: number;
}

// ─── Parser ─────────────────────────────────────────────────────────────────

function parseSchema(content: string): { models: PrismaModel[]; enumNames: Set<string> } {
  const lines = content.split('\n');
  const models: PrismaModel[] = [];
  const enumNames = new Set<string>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('model ')) {
      const modelName = line.replace('model ', '').replace('{', '').trim();
      const startLine = i + 1;
      const blockLines: Array<{ text: string; lineNum: number }> = [];
      let braceCount = 1;
      i++;
      while (i < lines.length && braceCount > 0) {
        if (lines[i].includes('{')) braceCount++;
        if (lines[i].includes('}')) braceCount--;
        if (braceCount > 0) blockLines.push({ text: lines[i], lineNum: i + 1 });
        i++;
      }
      models.push(parseModelBlock(modelName, blockLines, startLine, enumNames));
      continue;
    }
    if (line.startsWith('enum ')) {
      const enumName = line.replace('enum ', '').replace('{', '').trim();
      enumNames.add(enumName);
      let braceCount = 1;
      i++;
      while (i < lines.length && braceCount > 0) {
        if (lines[i].includes('{')) braceCount++;
        if (lines[i].includes('}')) braceCount--;
        i++;
      }
      continue;
    }
    i++;
  }
  return { models, enumNames };
}

function parseModelBlock(name: string, blockLines: Array<{ text: string; lineNum: number }>, startLine: number, enumNames: Set<string>): PrismaModel {
  const fields: PrismaField[] = [];
  const indexes: Array<{ fields: string[]; raw: string }> = [];
  const uniqueConstraints: Array<{ fields: string[]; raw: string }> = [];

  for (const { text, lineNum } of blockLines) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    if (trimmed.startsWith('@@index(')) {
      const match = trimmed.match(/\[([^\]]+)\]/);
      if (match) {
        indexes.push({
          fields: match[1].split(',').map(f => f.trim()),
          raw: trimmed,
        });
      }
      continue;
    }
    if (trimmed.startsWith('@@unique(')) {
      const match = trimmed.match(/\[([^\]]+)\]/);
      if (match) {
        uniqueConstraints.push({
          fields: match[1].split(',').map(f => f.trim()),
          raw: trimmed,
        });
      }
      continue;
    }
    if (trimmed.startsWith('@@')) continue;

    const field = parseField(trimmed, lineNum, enumNames);
    if (field) fields.push(field);
  }

  return { name, fields, indexes, uniqueConstraints, startLine };
}

function parseField(line: string, lineNumber: number, enumNames: Set<string>): PrismaField | null {
  const cleanLine = line.replace(/\/\/.*$/, '').trim();
  const match = cleanLine.match(/^(\w+)\s+(\w+)(\[\])?\??/);
  if (!match) return null;

  const [, fieldName, baseType, isList] = match;
  const isOptional = cleanLine.includes('?');
  const isId = cleanLine.includes('@id');
  const isUnique = cleanLine.includes('@unique');

  let defaultValue: string | null = null;
  const defaultIdx = cleanLine.indexOf('@default(');
  if (defaultIdx !== -1) {
    let depth = 0;
    let start = defaultIdx + '@default('.length;
    let end = start;
    for (let j = start; j < cleanLine.length; j++) {
      if (cleanLine[j] === '(') depth++;
      if (cleanLine[j] === ')') {
        if (depth === 0) { end = j; break; }
        depth--;
      }
    }
    defaultValue = cleanLine.substring(start, end);
  }

  let relation: PrismaField['relation'] = null;
  const relationMatch = cleanLine.match(/@relation\((.+?)\)$/);
  if (relationMatch) {
    const relContent = relationMatch[1];
    const relName = relContent.match(/^"(.+?)"/)?.[1] || '';
    const fieldsMatch = relContent.match(/fields:\s*\[(.+?)\]/);
    const refsMatch = relContent.match(/references:\s*\[(.+?)\]/);
    relation = {
      name: relName,
      fields: fieldsMatch ? fieldsMatch[1].split(',').map(f => f.trim()) : [],
      references: refsMatch ? refsMatch[1].split(',').map(r => r.trim()) : [],
    };
  }

  const primitiveTypes = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'BigInt', 'Decimal', 'Bytes'];
  const isRelation = !primitiveTypes.includes(baseType) && !enumNames.has(baseType);

  return {
    name: fieldName,
    type: baseType + (isList ? '[]' : '') + (isOptional ? '?' : ''),
    baseType,
    isOptional,
    isList: !!isList,
    isId,
    isUnique,
    defaultValue,
    relation,
    isRelation,
    lineNumber,
  };
}

// ─── Validators ─────────────────────────────────────────────────────────────

function validateMissingFKIndexes(models: PrismaModel[]): Issue[] {
  const issues: Issue[] = [];

  for (const model of models) {
    // Find FK fields (fields referenced in @relation)
    const fkFields = new Set<string>();
    for (const field of model.fields) {
      if (field.relation?.fields) {
        for (const fk of field.relation.fields) {
          fkFields.add(fk);
        }
      }
    }

    // Check which FK fields have indexes
    const indexedFields = new Set<string>();
    for (const idx of model.indexes) {
      // First field of a composite index covers single-field lookups
      if (idx.fields[0]) indexedFields.add(idx.fields[0]);
    }
    // @unique also acts as an index
    for (const uc of model.uniqueConstraints) {
      if (uc.fields[0]) indexedFields.add(uc.fields[0]);
    }
    // @unique on individual fields
    for (const field of model.fields) {
      if (field.isUnique) indexedFields.add(field.name);
      if (field.isId) indexedFields.add(field.name);
    }

    for (const fk of fkFields) {
      if (!indexedFields.has(fk)) {
        const fkField = model.fields.find(f => f.name === fk);
        issues.push({
          severity: 'warning',
          model: model.name,
          field: fk,
          message: `Foreign key \`${fk}\` has no index. JOINs and WHERE clauses on this field will be slow.`,
          suggestion: `@@index([${fk}])`,
          line: fkField?.lineNumber,
        });
      }
    }
  }

  return issues;
}

function validatePotentialUniqueFields(models: PrismaModel[]): Issue[] {
  const issues: Issue[] = [];
  // Fields that commonly should be unique
  const uniqueCandidates = ['email', 'slug', 'code', 'externalId', 'documentNumber'];

  for (const model of models) {
    for (const field of model.fields) {
      if (field.isRelation || field.isId || field.isUnique) continue;

      const nameLower = field.name.toLowerCase();
      if (uniqueCandidates.some(c => nameLower === c.toLowerCase())) {
        // Check if it's part of a @@unique constraint
        const inUniqueConstraint = model.uniqueConstraints.some(uc => uc.fields.includes(field.name));
        if (!inUniqueConstraint) {
          issues.push({
            severity: 'info',
            model: model.name,
            field: field.name,
            message: `Field \`${field.name}\` might need a @unique constraint based on its naming pattern.`,
            suggestion: `Add @unique to \`${field.name}\` or verify it intentionally allows duplicates.`,
            line: field.lineNumber,
          });
        }
      }
    }
  }

  return issues;
}

function validateRelationConsistency(models: PrismaModel[], enumNames: Set<string>): Issue[] {
  const issues: Issue[] = [];
  const modelMap = new Map(models.map(m => [m.name, m]));

  for (const model of models) {
    for (const field of model.fields) {
      if (!field.isRelation) continue;

      // Skip enum types - they're valid Prisma types, not model relations
      if (enumNames.has(field.baseType)) continue;

      const targetModel = modelMap.get(field.baseType);
      if (!targetModel) {
        issues.push({
          severity: 'error',
          model: model.name,
          field: field.name,
          message: `Relation target \`${field.baseType}\` does not exist as a model.`,
          line: field.lineNumber,
        });
        continue;
      }

      // Check for back-relation
      if (!field.isList && field.relation?.fields?.length) {
        const backRelation = targetModel.fields.find(f =>
          f.isRelation && f.baseType === model.name
        );
        if (!backRelation) {
          issues.push({
            severity: 'warning',
            model: model.name,
            field: field.name,
            message: `Relation to \`${field.baseType}\` has no back-relation in the target model.`,
            suggestion: `Add a field in \`${field.baseType}\` that references \`${model.name}\`.`,
            line: field.lineNumber,
          });
        }
      }

      // Check that FK fields exist
      if (field.relation?.fields) {
        for (const fk of field.relation.fields) {
          const fkField = model.fields.find(f => f.name === fk);
          if (!fkField) {
            issues.push({
              severity: 'error',
              model: model.name,
              field: field.name,
              message: `Relation FK field \`${fk}\` referenced in @relation does not exist.`,
              line: field.lineNumber,
            });
          }
        }
      }

      // Check that referenced fields exist in target
      if (field.relation?.references) {
        for (const ref of field.relation.references) {
          const refField = targetModel.fields.find(f => f.name === ref);
          if (!refField) {
            issues.push({
              severity: 'error',
              model: model.name,
              field: field.name,
              message: `Referenced field \`${ref}\` does not exist in \`${field.baseType}\`.`,
              line: field.lineNumber,
            });
          }
        }
      }
    }
  }

  return issues;
}

function validateNamingConventions(models: PrismaModel[]): Issue[] {
  const issues: Issue[] = [];

  for (const model of models) {
    // Model name should be PascalCase
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(model.name)) {
      issues.push({
        severity: 'info',
        model: model.name,
        message: `Model name \`${model.name}\` does not follow PascalCase convention.`,
      });
    }

    for (const field of model.fields) {
      if (field.isRelation) continue;

      // Field names should be camelCase
      if (/^[A-Z]/.test(field.name) && !field.isId) {
        issues.push({
          severity: 'info',
          model: model.name,
          field: field.name,
          message: `Field \`${field.name}\` starts with uppercase, which doesn't follow camelCase convention.`,
          line: field.lineNumber,
        });
      }
    }
  }

  return issues;
}

function validateMissingTimestamps(models: PrismaModel[]): Issue[] {
  const issues: Issue[] = [];
  // Skip junction/config models that might not need timestamps
  const skipPatterns = /^(RolePermission|UserPermission|UserOnCompany)$/;

  for (const model of models) {
    if (skipPatterns.test(model.name)) continue;

    const fieldNames = model.fields.map(f => f.name);
    const hasCreatedAt = fieldNames.includes('createdAt');
    const hasUpdatedAt = fieldNames.includes('updatedAt');

    if (!hasCreatedAt && !hasUpdatedAt && model.fields.length > 3) {
      issues.push({
        severity: 'info',
        model: model.name,
        message: `Model has no \`createdAt\`/\`updatedAt\` timestamps.`,
        suggestion: `Consider adding: createdAt DateTime @default(now()) and updatedAt DateTime @updatedAt`,
      });
    }
  }

  return issues;
}

function validateOnDeleteCascade(models: PrismaModel[]): Issue[] {
  const issues: Issue[] = [];

  for (const model of models) {
    for (const field of model.fields) {
      if (!field.isRelation || !field.relation?.fields?.length) continue;

      // Check if there's an onDelete specified
      // We can't easily parse onDelete from our simple parser, so we check if the field
      // references a "parent" model (like Company) without cascade
      const parentModels = ['Company', 'User'];
      if (parentModels.includes(field.baseType) && !field.isOptional) {
        // This is an info-level check - required relations to core models should consider onDelete
        // We skip this to avoid noise since it's hard to parse onDelete from the simple parser
      }
    }
  }

  return issues;
}

function validateCompanyIdPresence(models: PrismaModel[]): Issue[] {
  const issues: Issue[] = [];
  const excludeModels = new Set([
    'Company', 'User', 'Subscription', 'SubscriptionPlan', 'CompanyTemplate',
  ]);

  for (const model of models) {
    if (excludeModels.has(model.name)) continue;
    if (model.fields.length <= 2) continue; // Junction tables might be small

    const hasCompanyId = model.fields.some(f => f.name === 'companyId');
    const hasCompanyRelation = model.fields.some(f => f.baseType === 'Company' && !f.isList);

    // If model has a company relation but no companyId field indexed
    if (hasCompanyId && !hasCompanyRelation) {
      issues.push({
        severity: 'warning',
        model: model.name,
        message: `Has \`companyId\` field but no explicit Company relation defined.`,
        suggestion: `Add: company Company @relation(fields: [companyId], references: [id])`,
      });
    }
  }

  return issues;
}

// ─── Display ────────────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function c(color: keyof typeof COLORS, text: string): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function displayIssues(issues: Issue[], showSuggestions: boolean) {
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');

  console.log('');
  console.log(c('bold', '━━━ Prisma Schema Validation Report ━━━'));
  console.log('');
  console.log(`  ${c('red', `❌ Errors:   ${errors.length}`)}`);
  console.log(`  ${c('yellow', `⚠️  Warnings: ${warnings.length}`)}`);
  console.log(`  ${c('blue', `ℹ️  Info:     ${infos.length}`)}`);
  console.log('');

  const allIssues = [...errors, ...warnings, ...infos];

  // Group by model
  const byModel = new Map<string, Issue[]>();
  for (const issue of allIssues) {
    if (!byModel.has(issue.model)) byModel.set(issue.model, []);
    byModel.get(issue.model)!.push(issue);
  }

  for (const [model, modelIssues] of byModel) {
    console.log(c('bold', c('cyan', `  ${model}:`)));
    for (const issue of modelIssues) {
      const icon = issue.severity === 'error' ? c('red', '❌')
        : issue.severity === 'warning' ? c('yellow', '⚠️')
        : c('blue', 'ℹ️');

      const lineInfo = issue.line ? c('gray', ` [L${issue.line}]`) : '';
      console.log(`    ${icon} ${issue.message}${lineInfo}`);

      if (showSuggestions && issue.suggestion) {
        console.log(`       ${c('green', '→ ' + issue.suggestion)}`);
      }
    }
    console.log('');
  }

  // Summary
  if (errors.length > 0) {
    console.log(c('red', '  Schema has errors that should be fixed.'));
  } else if (warnings.length > 0) {
    console.log(c('yellow', '  Schema has warnings to review.'));
  } else {
    console.log(c('green', '  ✅ Schema looks good!'));
  }
  console.log('');
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const showSuggestions = args.includes('--fix-suggestions');
  const modelFilter = args.indexOf('--model') !== -1 ? args[args.indexOf('--model') + 1] : null;

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(c('red', `Schema not found at ${SCHEMA_PATH}`));
    process.exit(1);
  }

  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const { models: allModels, enumNames } = parseSchema(schemaContent);
  let models = allModels;

  if (modelFilter) {
    models = models.filter(m => m.name.toLowerCase() === modelFilter.toLowerCase());
    if (models.length === 0) {
      console.error(c('red', `Model "${modelFilter}" not found.`));
      process.exit(1);
    }
  }

  console.log(c('gray', `Validating ${models.length} models (${enumNames.size} enums detected)...`));

  const issues: Issue[] = [
    ...validateMissingFKIndexes(models),
    ...validatePotentialUniqueFields(models),
    ...validateRelationConsistency(models.length < allModels.length ? models : allModels, enumNames),
    ...validateNamingConventions(models),
    ...validateMissingTimestamps(models),
    ...validateCompanyIdPresence(models),
  ];

  // Filter issues if model filter is active
  const filteredIssues = modelFilter
    ? issues.filter(i => i.model.toLowerCase() === modelFilter.toLowerCase())
    : issues;

  displayIssues(filteredIssues, showSuggestions);

  // Exit with error code if there are errors
  const hasErrors = filteredIssues.some(i => i.severity === 'error');
  process.exit(hasErrors ? 1 : 0);
}

main();
