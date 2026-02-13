#!/usr/bin/env npx tsx
/**
 * Prisma Model Viewer CLI
 *
 * Consulta el schema de Prisma por modelos específicos.
 *
 * Uso:
 *   npx tsx scripts/prisma-model-viewer.ts WorkOrder
 *   npx tsx scripts/prisma-model-viewer.ts WorkOrder --relations
 *   npx tsx scripts/prisma-model-viewer.ts --list
 *   npx tsx scripts/prisma-model-viewer.ts --search "cost"
 *   npx tsx scripts/prisma-model-viewer.ts --enum WorkOrderStatus
 */

import * as fs from 'fs';
import * as path from 'path';

const SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');

// ─── Parser ─────────────────────────────────────────────────────────────────

interface PrismaField {
  name: string;
  type: string;
  isOptional: boolean;
  isList: boolean;
  isId: boolean;
  isUnique: boolean;
  defaultValue: string | null;
  relation: { name: string; fields: string[]; references: string[] } | null;
  rawAttributes: string;
  isRelation: boolean;
}

interface PrismaModel {
  name: string;
  mappedName: string | null;
  fields: PrismaField[];
  indexes: string[];
  uniqueConstraints: string[];
  rawBlock: string;
  startLine: number;
  endLine: number;
}

interface PrismaEnum {
  name: string;
  values: string[];
  rawBlock: string;
}

function parseSchema(schemaContent: string): { models: PrismaModel[]; enums: PrismaEnum[] } {
  const lines = schemaContent.split('\n');
  const models: PrismaModel[] = [];
  const enums: PrismaEnum[] = [];

  // First pass: collect enum names
  const enumNames = new Set<string>();
  for (const l of lines) {
    const trimmed = l.trim();
    if (trimmed.startsWith('enum ')) {
      enumNames.add(trimmed.replace('enum ', '').replace('{', '').trim());
    }
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith('model ')) {
      const modelName = line.replace('model ', '').replace('{', '').trim();
      const startLine = i + 1;
      const blockLines: string[] = [];
      let braceCount = 1;
      i++;

      while (i < lines.length && braceCount > 0) {
        if (lines[i].includes('{')) braceCount++;
        if (lines[i].includes('}')) braceCount--;
        if (braceCount > 0) blockLines.push(lines[i]);
        i++;
      }

      const endLine = i;
      const model = parseModelBlock(modelName, blockLines, startLine, endLine, enumNames);
      models.push(model);
      continue;
    }

    if (line.startsWith('enum ')) {
      const enumName = line.replace('enum ', '').replace('{', '').trim();
      const blockLines: string[] = [];
      let braceCount = 1;
      i++;

      while (i < lines.length && braceCount > 0) {
        if (lines[i].includes('{')) braceCount++;
        if (lines[i].includes('}')) braceCount--;
        if (braceCount > 0) blockLines.push(lines[i]);
        i++;
      }

      enums.push({
        name: enumName,
        values: blockLines.map(l => l.trim()).filter(l => l && !l.startsWith('//')),
        rawBlock: `enum ${enumName} {\n${blockLines.join('\n')}\n}`,
      });
      continue;
    }

    i++;
  }

  return { models, enums };
}

function parseModelBlock(name: string, blockLines: string[], startLine: number, endLine: number, enumNames: Set<string>): PrismaModel {
  const fields: PrismaField[] = [];
  const indexes: string[] = [];
  const uniqueConstraints: string[] = [];
  let mappedName: string | null = null;

  for (const line of blockLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    if (trimmed.startsWith('@@map(')) {
      mappedName = trimmed.match(/@@map\("(.+?)"\)/)?.[1] || null;
      continue;
    }
    if (trimmed.startsWith('@@index(')) {
      indexes.push(trimmed);
      continue;
    }
    if (trimmed.startsWith('@@unique(')) {
      uniqueConstraints.push(trimmed);
      continue;
    }
    if (trimmed.startsWith('@@')) continue;

    const field = parseField(trimmed, enumNames);
    if (field) fields.push(field);
  }

  return {
    name,
    mappedName,
    fields,
    indexes,
    uniqueConstraints,
    rawBlock: `model ${name} {\n${blockLines.join('\n')}\n}`,
    startLine,
    endLine,
  };
}

function parseField(line: string, enumNames: Set<string>): PrismaField | null {
  // Match: fieldName Type? @attributes...
  const match = line.match(/^(\w+)\s+(\w+)(\[\])?\??/);
  if (!match) return null;

  const [, fieldName, baseType, isList] = match;
  const isOptional = line.includes('?');
  const isId = line.includes('@id');
  const isUnique = line.includes('@unique');

  let defaultValue: string | null = null;
  const defaultIdx = line.indexOf('@default(');
  if (defaultIdx !== -1) {
    let depth = 0;
    let start = defaultIdx + '@default('.length;
    let end = start;
    for (let j = start; j < line.length; j++) {
      if (line[j] === '(') depth++;
      if (line[j] === ')') {
        if (depth === 0) { end = j; break; }
        depth--;
      }
    }
    defaultValue = line.substring(start, end);
  }

  let relation: PrismaField['relation'] = null;
  const relationMatch = line.match(/@relation\((.+?)\)/);
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

  // A field is a relation if its type is not a primitive and not an enum
  const primitiveTypes = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'BigInt', 'Decimal', 'Bytes'];
  const isRelation = !primitiveTypes.includes(baseType) && !enumNames.has(baseType);

  // Extract everything after the type for raw attributes
  const afterType = line.substring(line.indexOf(baseType) + baseType.length + (isList ? 2 : 0) + (isOptional ? 1 : 0)).trim();

  return {
    name: fieldName,
    type: baseType + (isList ? '[]' : '') + (isOptional ? '?' : ''),
    isOptional,
    isList: !!isList,
    isId,
    isUnique,
    defaultValue,
    relation,
    rawAttributes: afterType,
    isRelation,
  };
}

// ─── Display Helpers ────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function c(color: keyof typeof COLORS, text: string): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function displayModel(model: PrismaModel, allModels: PrismaModel[], showRelations: boolean) {
  console.log('');
  console.log(c('bold', c('cyan', `━━━ model ${model.name} ━━━`)));
  if (model.mappedName) {
    console.log(c('gray', `  Mapped to table: "${model.mappedName}"`));
  }
  console.log(c('gray', `  Schema lines: ${model.startLine}-${model.endLine}`));
  console.log('');

  // Scalar fields
  const scalarFields = model.fields.filter(f => !f.isRelation);
  const relationFields = model.fields.filter(f => f.isRelation);

  if (scalarFields.length > 0) {
    console.log(c('bold', '  📋 Fields:'));
    const maxNameLen = Math.max(...scalarFields.map(f => f.name.length));
    const maxTypeLen = Math.max(...scalarFields.map(f => f.type.length));

    for (const field of scalarFields) {
      const name = field.name.padEnd(maxNameLen);
      const type = field.type.padEnd(maxTypeLen);
      const attrs: string[] = [];

      if (field.isId) attrs.push(c('yellow', '@id'));
      if (field.isUnique) attrs.push(c('magenta', '@unique'));
      if (field.defaultValue) attrs.push(c('gray', `@default(${field.defaultValue})`));

      console.log(`    ${c('white', name)}  ${c('green', type)}  ${attrs.join(' ')}`);
    }
  }

  // Relations
  if (relationFields.length > 0) {
    console.log('');
    console.log(c('bold', '  🔗 Relations:'));

    for (const field of relationFields) {
      const direction = field.isList ? '→ has many' : '→ belongs to';
      const relInfo = field.relation
        ? c('gray', ` (${field.relation.fields.join(', ')} → ${field.relation.references.join(', ')})`)
        : '';
      const relName = field.relation?.name ? c('gray', ` [${field.relation.name}]`) : '';

      console.log(`    ${c('blue', field.name.padEnd(30))} ${c('dim', direction)} ${c('cyan', field.type.replace('[]', '').replace('?', ''))}${relInfo}${relName}`);
    }
  }

  // Indexes
  if (model.indexes.length > 0) {
    console.log('');
    console.log(c('bold', '  📇 Indexes:'));
    for (const idx of model.indexes) {
      console.log(`    ${c('yellow', idx)}`);
    }
  }

  // Unique constraints
  if (model.uniqueConstraints.length > 0) {
    console.log('');
    console.log(c('bold', '  🔒 Unique Constraints:'));
    for (const uc of model.uniqueConstraints) {
      console.log(`    ${c('magenta', uc)}`);
    }
  }

  // Show related models (models that reference this one)
  if (showRelations) {
    console.log('');
    console.log(c('bold', '  🌐 Referenced by:'));
    const referencedBy = allModels.filter(m =>
      m.name !== model.name &&
      m.fields.some(f => {
        const baseType = f.type.replace('[]', '').replace('?', '');
        return baseType === model.name;
      })
    );

    if (referencedBy.length === 0) {
      console.log(c('gray', '    (none)'));
    } else {
      for (const ref of referencedBy) {
        const refFields = ref.fields.filter(f => f.type.replace('[]', '').replace('?', '') === model.name);
        const fieldNames = refFields.map(f => f.name).join(', ');
        console.log(`    ${c('cyan', ref.name)} → ${c('gray', fieldNames)}`);
      }
    }
  }

  console.log('');
}

function displayEnum(enumDef: PrismaEnum) {
  console.log('');
  console.log(c('bold', c('magenta', `━━━ enum ${enumDef.name} ━━━`)));
  console.log('');
  for (const value of enumDef.values) {
    console.log(`    ${c('yellow', value)}`);
  }
  console.log('');
}

function displayList(models: PrismaModel[], enums: PrismaEnum[]) {
  // Categorize models
  const categories: Record<string, string[]> = {};

  for (const model of models) {
    const cat = categorizeModel(model.name);
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(model.name);
  }

  console.log('');
  console.log(c('bold', `📊 Schema: ${models.length} models, ${enums.length} enums`));
  console.log('');

  const sortedCats = Object.keys(categories).sort();
  for (const cat of sortedCats) {
    const modelNames = categories[cat].sort();
    console.log(c('bold', c('cyan', `  ${cat} (${modelNames.length}):`)));
    for (const name of modelNames) {
      const model = models.find(m => m.name === name)!;
      const fieldCount = model.fields.filter(f => !f.isRelation).length;
      const relCount = model.fields.filter(f => f.isRelation).length;
      console.log(`    ${c('white', name.padEnd(40))} ${c('gray', `${fieldCount} fields, ${relCount} relations`)}`);
    }
    console.log('');
  }
}

function categorizeModel(name: string): string {
  const n = name.toLowerCase();
  if (/^(company|user|role|area|sector|permission|session|notification|useronccompany)/.test(n) ||
      ['company', 'user', 'role', 'area', 'sector', 'usercompany', 'useroncompany', 'userpermission',
       'rolepermission', 'companymodule', 'companysettings', 'companyviewconfig'].includes(n)) {
    return '🏢 Core / Auth';
  }
  if (/cost|recipe|input|indirect|production|standard/.test(n) && !/purchase/.test(n)) return '💰 Costs';
  if (/machine|workstation|component|subcomponent|tool|failure|symptom|corrective|checklist|downtime|workorder|maintenance|loto|permit|fmea|quality|sparepartreservation/.test(n)) return '🔧 Maintenance / CMMS';
  if (/task|fixedtask/.test(n)) return '📋 Tasks';
  if (/sale|quote|client|invoice|delivery|remito|acopio|price|discount|load|collection/.test(n)) return '🛒 Sales';
  if (/purchase|supplier|goods|warehouse|credit|match|sod|stock/.test(n)) return '📦 Purchases / Inventory';
  if (/payroll|salary|agreement|union|worksector|workposition|holiday/.test(n)) return '💼 Payroll / HR';
  if (/bank|cash|cheque|treasury|payment|idempotency/.test(n)) return '🏦 Treasury';
  if (/truck|load|zone|transport|kilometraje|unidadmovil/.test(n)) return '🚛 Logistics';
  if (/assistant|embedding|\bai\b|^ai/.test(n)) return '🤖 AI / Assistant';
  if (/automation/.test(n)) return '⚙️ Automation';
  if (/subscription|billing|template|plan/.test(n)) return '💳 Billing / SaaS';
  if (/portal|contact|clientportal/.test(n)) return '🌐 Client Portal';
  if (/dashboard|widget|config/.test(n)) return '📊 Configuration';
  if (/discord/.test(n)) return '💬 Integrations';
  if (/document|attachment|image/.test(n)) return '📎 Documents';
  if (/worker|employee|skill|certification/.test(n)) return '👷 Workers / Skills';
  if (/idea/.test(n)) return '💡 Ideas';
  if (/notification|reminder|outbox/.test(n)) return '🔔 Notifications';
  if (/tax|control/.test(n)) return '📑 Tax / Controls';
  return '📁 Other';
}

function displaySearch(models: PrismaModel[], enums: PrismaEnum[], term: string) {
  const termLower = term.toLowerCase();

  const matchedModels = models.filter(m =>
    m.name.toLowerCase().includes(termLower) ||
    m.fields.some(f => f.name.toLowerCase().includes(termLower))
  );

  const matchedEnums = enums.filter(e =>
    e.name.toLowerCase().includes(termLower) ||
    e.values.some(v => v.toLowerCase().includes(termLower))
  );

  console.log('');
  console.log(c('bold', `🔍 Search results for "${term}":`));

  if (matchedModels.length > 0) {
    console.log('');
    console.log(c('bold', `  Models (${matchedModels.length}):`));
    for (const m of matchedModels) {
      const nameMatch = m.name.toLowerCase().includes(termLower);
      const matchingFields = m.fields.filter(f => f.name.toLowerCase().includes(termLower));

      if (nameMatch) {
        console.log(`    ${c('cyan', m.name)}`);
      }
      for (const f of matchingFields) {
        console.log(`    ${c('gray', m.name + '.')}${c('yellow', f.name)} ${c('dim', f.type)}`);
      }
    }
  }

  if (matchedEnums.length > 0) {
    console.log('');
    console.log(c('bold', `  Enums (${matchedEnums.length}):`));
    for (const e of matchedEnums) {
      console.log(`    ${c('magenta', e.name)}`);
    }
  }

  if (matchedModels.length === 0 && matchedEnums.length === 0) {
    console.log(c('red', '  No results found.'));
  }

  console.log('');
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
${c('bold', 'Prisma Model Viewer')} - Explore the schema interactively

${c('bold', 'Usage:')}
  npx tsx scripts/prisma-model-viewer.ts <ModelName>          Show model details
  npx tsx scripts/prisma-model-viewer.ts <ModelName> --relations  Show model + who references it
  npx tsx scripts/prisma-model-viewer.ts --list                   List all models by category
  npx tsx scripts/prisma-model-viewer.ts --search <term>          Search models and fields
  npx tsx scripts/prisma-model-viewer.ts --enum <EnumName>        Show enum values
  npx tsx scripts/prisma-model-viewer.ts --stats                  Show schema statistics
`);
    return;
  }

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(c('red', `Schema not found at ${SCHEMA_PATH}`));
    process.exit(1);
  }

  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const { models, enums } = parseSchema(schemaContent);

  // --list
  if (args[0] === '--list') {
    displayList(models, enums);
    return;
  }

  // --search
  if (args[0] === '--search' && args[1]) {
    displaySearch(models, enums, args[1]);
    return;
  }

  // --enum
  if (args[0] === '--enum' && args[1]) {
    const enumDef = enums.find(e => e.name.toLowerCase() === args[1].toLowerCase());
    if (!enumDef) {
      console.error(c('red', `Enum "${args[1]}" not found.`));
      const suggestions = enums.filter(e => e.name.toLowerCase().includes(args[1].toLowerCase()));
      if (suggestions.length > 0) {
        console.log(c('yellow', 'Did you mean:'));
        suggestions.forEach(s => console.log(`  ${s.name}`));
      }
      return;
    }
    displayEnum(enumDef);
    return;
  }

  // --stats
  if (args[0] === '--stats') {
    const totalFields = models.reduce((acc, m) => acc + m.fields.filter(f => !f.isRelation).length, 0);
    const totalRelations = models.reduce((acc, m) => acc + m.fields.filter(f => f.isRelation).length, 0);
    const totalIndexes = models.reduce((acc, m) => acc + m.indexes.length, 0);
    const modelsWithoutIndexes = models.filter(m => m.indexes.length === 0 && m.fields.some(f => f.relation?.fields?.length));

    console.log('');
    console.log(c('bold', '📊 Schema Statistics'));
    console.log(`  Models:           ${c('cyan', String(models.length))}`);
    console.log(`  Enums:            ${c('magenta', String(enums.length))}`);
    console.log(`  Total fields:     ${c('green', String(totalFields))}`);
    console.log(`  Total relations:  ${c('blue', String(totalRelations))}`);
    console.log(`  Total indexes:    ${c('yellow', String(totalIndexes))}`);
    console.log(`  Models w/o index: ${c('red', String(modelsWithoutIndexes.length))}`);
    console.log('');
    return;
  }

  // Model lookup
  const modelName = args[0];
  const showRelations = args.includes('--relations');
  const model = models.find(m => m.name.toLowerCase() === modelName.toLowerCase());

  if (!model) {
    console.error(c('red', `Model "${modelName}" not found.`));
    const suggestions = models.filter(m => m.name.toLowerCase().includes(modelName.toLowerCase()));
    if (suggestions.length > 0) {
      console.log(c('yellow', 'Did you mean:'));
      suggestions.forEach(s => console.log(`  ${s.name}`));
    }
    return;
  }

  displayModel(model, models, showRelations);
}

main();
