#!/usr/bin/env npx tsx
/**
 * Prisma Schema Documentation Generator
 *
 * Genera documentación en Markdown del schema de Prisma:
 * - Un archivo por modelo con campos, relaciones y validaciones
 * - Diagrama ERD con Mermaid
 * - Índice navegable por categoría
 *
 * Uso:
 *   npx tsx scripts/generate-schema-docs.ts
 *   npx tsx scripts/generate-schema-docs.ts --only WorkOrder,Company
 *   npx tsx scripts/generate-schema-docs.ts --category "Sales"
 */

import * as fs from 'fs';
import * as path from 'path';

const SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const DOCS_DIR = path.join(__dirname, '..', 'docs', 'database');
const MODELS_DIR = path.join(DOCS_DIR, 'models');

// ─── Parser (shared logic) ─────────────────────────────────────────────────

interface PrismaField {
  name: string;
  type: string;
  baseType: string;
  isOptional: boolean;
  isList: boolean;
  isId: boolean;
  isUnique: boolean;
  defaultValue: string | null;
  dbType: string | null;
  relation: { name: string; fields: string[]; references: string[]; onDelete?: string } | null;
  isRelation: boolean;
  comment: string | null;
}

interface PrismaModel {
  name: string;
  mappedName: string | null;
  fields: PrismaField[];
  indexes: string[];
  uniqueConstraints: string[];
  comments: string[];
  startLine: number;
  endLine: number;
}

interface PrismaEnum {
  name: string;
  values: string[];
}

function parseSchema(content: string): { models: PrismaModel[]; enums: PrismaEnum[] } {
  const lines = content.split('\n');
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
      models.push(parseModelBlock(modelName, blockLines, startLine, i, enumNames));
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
  const comments: string[] = [];
  let mappedName: string | null = null;
  let pendingComment: string | null = null;

  for (const line of blockLines) {
    const trimmed = line.trim();
    if (!trimmed) { pendingComment = null; continue; }

    if (trimmed.startsWith('//')) {
      pendingComment = trimmed.replace(/^\/\/\s*/, '');
      comments.push(pendingComment);
      continue;
    }

    if (trimmed.startsWith('@@map(')) {
      mappedName = trimmed.match(/@@map\("(.+?)"\)/)?.[1] || null;
      continue;
    }
    if (trimmed.startsWith('@@index(')) { indexes.push(trimmed); continue; }
    if (trimmed.startsWith('@@unique(')) { uniqueConstraints.push(trimmed); continue; }
    if (trimmed.startsWith('@@')) continue;

    const field = parseField(trimmed, pendingComment, enumNames);
    if (field) fields.push(field);
    pendingComment = null;
  }

  return { name, mappedName, fields, indexes, uniqueConstraints, comments, startLine, endLine };
}

function parseField(line: string, comment: string | null, enumNames: Set<string>): PrismaField | null {
  // Extract inline comment
  const inlineCommentMatch = line.match(/\/\/\s*(.+)$/);
  const inlineComment = inlineCommentMatch ? inlineCommentMatch[1] : null;
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

  let dbType: string | null = null;
  const dbTypeMatch = cleanLine.match(/@db\.(\w+(?:\([^)]+\))?)/);
  if (dbTypeMatch) dbType = dbTypeMatch[1];

  let relation: PrismaField['relation'] = null;
  const relationMatch = cleanLine.match(/@relation\((.+?)\)$/);
  if (relationMatch) {
    const relContent = relationMatch[1];
    const relName = relContent.match(/^"(.+?)"/)?.[1] || '';
    const fieldsMatch = relContent.match(/fields:\s*\[(.+?)\]/);
    const refsMatch = relContent.match(/references:\s*\[(.+?)\]/);
    const onDeleteMatch = relContent.match(/onDelete:\s*(\w+)/);
    relation = {
      name: relName,
      fields: fieldsMatch ? fieldsMatch[1].split(',').map(f => f.trim()) : [],
      references: refsMatch ? refsMatch[1].split(',').map(r => r.trim()) : [],
      onDelete: onDeleteMatch ? onDeleteMatch[1] : undefined,
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
    dbType,
    relation,
    isRelation,
    comment: inlineComment || comment,
  };
}

// ─── Categorization ─────────────────────────────────────────────────────────

type Category = {
  name: string;
  icon: string;
  models: PrismaModel[];
};

function categorizeModel(name: string): string {
  const n = name.toLowerCase();
  if (/^(company$|companysettings|companymodule|companyviewconfig|companysettingscosting|companytemplate)/.test(n)) return 'Core';
  if (/^(user$|useroncompany|userpermission|role$|rolepermission|session)/.test(n)) return 'Auth';
  if (/^(area|sector|zone|plantzone|line)$/.test(n)) return 'Organization';
  if (/cost|recipe|input|indirect|monthlyproduction|monthlyindirect|productstandard|productioncost|productionmethod|costsystem|monthlycostconsolidation/.test(n) && !/purchase|maintenance/.test(n)) return 'Costs';
  if (/machine|workstation|component|subcomponent|failure|symptom|corrective|checklist|downtime|workorder|maintenance|loto|permit|fmea|quality|sparepartreservation|template|solution|rootcause|activity/.test(n)) return 'Maintenance';
  if (/^(task|fixedtask|fixedtaskexecution|taskattachment|taskcomment)/.test(n)) return 'Tasks';
  if (/^(sale|quote|client(?!p)|invoice|delivery|remito|acopio|price|discount|load|collection|salesconfig|salesprice|salesinvoice|salescredit)/.test(n)) return 'Sales';
  if (/^(product|category)/.test(n)) return 'Products';
  if (/purchase|supplier|goods|warehouse|creditdebitnote$|match|sod|stocktransfer|stockadjust/.test(n)) return 'Purchases';
  if (/payroll|salary|agreement|payrollunion|worksector|workposition|holiday|employee/.test(n)) return 'Payroll';
  if (/bank|cash|cheque|treasury|payment|idempotency/.test(n)) return 'Treasury';
  if (/truck|loadorder|zone|transport|kilometraje|unidadmovil/.test(n)) return 'Logistics';
  if (/assistant|embedding|\bai\b|^ai/.test(n)) return 'AI';
  if (/automation/.test(n)) return 'Automation';
  if (/subscription|billing|plan/.test(n)) return 'Billing';
  if (/portal|clientportal|clientcontact/.test(n)) return 'Portal';
  if (/notification|reminder|outbox/.test(n)) return 'Notifications';
  if (/document|attachment|image/.test(n)) return 'Documents';
  if (/worker|skill|certification/.test(n)) return 'Workers';
  if (/tax|control/.test(n)) return 'Tax';
  if (/tool/.test(n)) return 'Tools';
  if (/discord/.test(n)) return 'Integrations';
  if (/dashboard|widget|usercolorpreference|userdashboardconfig/.test(n)) return 'Dashboard';
  if (/idea/.test(n)) return 'Ideas';
  return 'Other';
}

const CATEGORY_ICONS: Record<string, string> = {
  Core: '🏢', Auth: '🔐', Organization: '🏗️', Costs: '💰', Maintenance: '🔧',
  Tasks: '📋', Sales: '🛒', Products: '📦', Purchases: '🛍️', Payroll: '💼',
  Treasury: '🏦', Logistics: '🚛', AI: '🤖', Automation: '⚙️', Billing: '💳',
  Portal: '🌐', Notifications: '🔔', Documents: '📎', Workers: '👷', Tax: '📑',
  Tools: '🔨', Integrations: '💬', Dashboard: '📊', Ideas: '💡', Other: '📁',
};

function buildCategories(models: PrismaModel[]): Category[] {
  const catMap: Record<string, PrismaModel[]> = {};
  for (const model of models) {
    const cat = categorizeModel(model.name);
    if (!catMap[cat]) catMap[cat] = [];
    catMap[cat].push(model);
  }
  return Object.entries(catMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, models]) => ({
      name,
      icon: CATEGORY_ICONS[name] || '📁',
      models: models.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

// ─── Markdown Generators ────────────────────────────────────────────────────

function generateModelDoc(model: PrismaModel, allModels: PrismaModel[], enums: PrismaEnum[]): string {
  const scalarFields = model.fields.filter(f => !f.isRelation);
  const relationFields = model.fields.filter(f => f.isRelation);

  // Find models that reference this one
  const referencedBy = allModels.filter(m =>
    m.name !== model.name &&
    m.fields.some(f => f.baseType === model.name)
  );

  let md = `# ${model.name}\n\n`;

  if (model.mappedName) {
    md += `> Table name: \`${model.mappedName}\`\n\n`;
  }

  md += `**Schema location:** Lines ${model.startLine}-${model.endLine}\n\n`;

  // Fields table
  md += `## Fields\n\n`;
  md += `| Field | Type | Required | Unique | Default | Notes |\n`;
  md += `|-------|------|----------|--------|---------|-------|\n`;

  for (const f of scalarFields) {
    const required = f.isOptional ? '❌' : '✅';
    const unique = f.isId ? '🔑 PK' : f.isUnique ? '✅' : '';
    const def = f.defaultValue || '';
    const dbInfo = f.dbType ? `DB: ${f.dbType}` : '';
    const comment = f.comment || '';
    const notes = [dbInfo, comment].filter(Boolean).join('. ');
    md += `| \`${f.name}\` | \`${f.type}\` | ${required} | ${unique} | \`${def}\` | ${notes} |\n`;
  }

  // Relations
  if (relationFields.length > 0) {
    md += `\n## Relations\n\n`;
    md += `| Field | Type | Cardinality | FK Fields | References | On Delete |\n`;
    md += `|-------|------|-------------|-----------|------------|-----------|\n`;

    for (const f of relationFields) {
      const cardinality = f.isList ? 'One-to-Many' : f.isOptional ? 'Many-to-One (optional)' : 'Many-to-One';
      const fkFields = f.relation?.fields?.join(', ') || '-';
      const refs = f.relation?.references?.join(', ') || '-';
      const onDelete = f.relation?.onDelete || '-';
      const linkedModel = f.baseType;
      md += `| \`${f.name}\` | [${linkedModel}](./models/${linkedModel}.md) | ${cardinality} | ${fkFields} | ${refs} | ${onDelete} |\n`;
    }
  }

  // Referenced by
  if (referencedBy.length > 0) {
    md += `\n## Referenced By\n\n`;
    md += `| Model | Field | Cardinality |\n`;
    md += `|-------|-------|-------------|\n`;
    for (const ref of referencedBy) {
      const refFields = ref.fields.filter(f => f.baseType === model.name);
      for (const f of refFields) {
        const card = f.isList ? 'Has many' : 'Has one';
        md += `| [${ref.name}](./models/${ref.name}.md) | \`${f.name}\` | ${card} |\n`;
      }
    }
  }

  // Indexes
  if (model.indexes.length > 0) {
    md += `\n## Indexes\n\n`;
    for (const idx of model.indexes) {
      const fieldsMatch = idx.match(/\[([^\]]+)\]/);
      const fields = fieldsMatch ? fieldsMatch[1] : idx;
      md += `- \`${fields}\`\n`;
    }
  }

  // Unique constraints
  if (model.uniqueConstraints.length > 0) {
    md += `\n## Unique Constraints\n\n`;
    for (const uc of model.uniqueConstraints) {
      const fieldsMatch = uc.match(/\[([^\]]+)\]/);
      const fields = fieldsMatch ? fieldsMatch[1] : uc;
      md += `- \`${fields}\`\n`;
    }
  }

  // Mermaid diagram (local relations only)
  if (relationFields.length > 0 || referencedBy.length > 0) {
    md += `\n## Entity Diagram\n\n`;
    md += '```mermaid\nerDiagram\n';

    // Current model
    md += `    ${model.name} {\n`;
    for (const f of scalarFields.slice(0, 15)) {
      const prismaType = f.baseType.toLowerCase();
      const mermaidType = prismaType === 'datetime' ? 'datetime' : prismaType;
      md += `        ${mermaidType} ${f.name}${f.isId ? ' PK' : f.isUnique ? ' UK' : ''}\n`;
    }
    if (scalarFields.length > 15) {
      md += `        string _more_fields\n`;
    }
    md += `    }\n`;

    // Related models (simplified)
    const relatedModels = new Set<string>();
    for (const f of relationFields) {
      relatedModels.add(f.baseType);
    }
    for (const ref of referencedBy) {
      relatedModels.add(ref.name);
    }

    for (const relModel of relatedModels) {
      const rm = allModels.find(m => m.name === relModel);
      if (rm) {
        const idField = rm.fields.find(f => f.isId);
        md += `    ${rm.name} {\n`;
        if (idField) md += `        ${idField.baseType.toLowerCase()} ${idField.name} PK\n`;
        md += `    }\n`;
      }
    }

    // Relationships
    for (const f of relationFields) {
      if (f.isList) {
        md += `    ${model.name} ||--o{ ${f.baseType} : "${f.name}"\n`;
      } else if (f.isOptional) {
        md += `    ${model.name} }o--|| ${f.baseType} : "${f.name}"\n`;
      } else {
        md += `    ${model.name} }|--|| ${f.baseType} : "${f.name}"\n`;
      }
    }

    md += '```\n';
  }

  return md;
}

function generateIndex(categories: Category[], enums: PrismaEnum[], models: PrismaModel[]): string {
  let md = `# Database Schema Documentation\n\n`;
  md += `> Auto-generated from \`prisma/schema.prisma\`\n`;
  md += `> Generated: ${new Date().toISOString().split('T')[0]}\n\n`;

  md += `## Overview\n\n`;
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| Models | ${models.length} |\n`;
  md += `| Enums | ${enums.length} |\n`;
  md += `| Total Fields | ${models.reduce((a, m) => a + m.fields.filter(f => !f.isRelation).length, 0)} |\n`;
  md += `| Total Relations | ${models.reduce((a, m) => a + m.fields.filter(f => f.isRelation).length, 0)} |\n`;
  md += `| Total Indexes | ${models.reduce((a, m) => a + m.indexes.length, 0)} |\n\n`;

  md += `## Models by Category\n\n`;

  for (const cat of categories) {
    md += `### ${cat.icon} ${cat.name} (${cat.models.length})\n\n`;
    md += `| Model | Fields | Relations | Indexes |\n`;
    md += `|-------|--------|-----------|--------|\n`;
    for (const m of cat.models) {
      const fieldCount = m.fields.filter(f => !f.isRelation).length;
      const relCount = m.fields.filter(f => f.isRelation).length;
      md += `| [${m.name}](./models/${m.name}.md) | ${fieldCount} | ${relCount} | ${m.indexes.length} |\n`;
    }
    md += '\n';
  }

  // Enums
  md += `## Enums\n\n`;
  for (const e of enums) {
    md += `### ${e.name}\n\n`;
    md += `\`${e.values.join('` | `')}\`\n\n`;
  }

  return md;
}

function generateERDOverview(categories: Category[]): string {
  let md = `# ERD Overview\n\n`;
  md += `> High-level entity relationship diagram by category\n\n`;

  for (const cat of categories) {
    if (cat.models.length > 20) {
      md += `## ${cat.icon} ${cat.name}\n\n`;
      md += `> Too many models (${cat.models.length}) for a single diagram. See individual model pages.\n\n`;
      md += `Models: ${cat.models.map(m => `\`${m.name}\``).join(', ')}\n\n`;
      continue;
    }

    md += `## ${cat.icon} ${cat.name}\n\n`;
    md += '```mermaid\nerDiagram\n';

    // Define entities
    for (const m of cat.models) {
      const idField = m.fields.find(f => f.isId);
      md += `    ${m.name} {\n`;
      if (idField) md += `        ${idField.baseType.toLowerCase()} ${idField.name} PK\n`;
      // Show a few key fields
      const keyFields = m.fields
        .filter(f => !f.isRelation && !f.isId && (f.isUnique || f.name === 'name' || f.name === 'status' || f.name === 'companyId'))
        .slice(0, 4);
      for (const f of keyFields) {
        md += `        ${f.baseType.toLowerCase()} ${f.name}\n`;
      }
      md += `    }\n`;
    }

    // Define intra-category relationships
    const catModelNames = new Set(cat.models.map(m => m.name));
    for (const m of cat.models) {
      for (const f of m.fields.filter(ff => ff.isRelation)) {
        if (catModelNames.has(f.baseType)) {
          if (f.isList) {
            md += `    ${m.name} ||--o{ ${f.baseType} : "${f.name}"\n`;
          } else if (f.isOptional) {
            md += `    ${m.name} }o--|| ${f.baseType} : "${f.name}"\n`;
          } else {
            md += `    ${m.name} }|--|| ${f.baseType} : "${f.name}"\n`;
          }
        }
      }
    }

    md += '```\n\n';
  }

  return md;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`Schema not found at ${SCHEMA_PATH}`);
    process.exit(1);
  }

  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const { models, enums } = parseSchema(schemaContent);

  // Filter by --only or --category if specified
  let filteredModels = models;
  const onlyIdx = args.indexOf('--only');
  if (onlyIdx !== -1 && args[onlyIdx + 1]) {
    const names = args[onlyIdx + 1].split(',').map(n => n.toLowerCase());
    filteredModels = models.filter(m => names.includes(m.name.toLowerCase()));
  }
  const catIdx = args.indexOf('--category');
  if (catIdx !== -1 && args[catIdx + 1]) {
    const catName = args[catIdx + 1].toLowerCase();
    filteredModels = models.filter(m => categorizeModel(m.name).toLowerCase() === catName);
  }

  // Create directories
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  // Generate model docs
  let count = 0;
  for (const model of filteredModels) {
    const doc = generateModelDoc(model, models, enums);
    const filePath = path.join(MODELS_DIR, `${model.name}.md`);
    fs.writeFileSync(filePath, doc);
    count++;
  }

  // Generate index (always uses all models)
  const categories = buildCategories(models);
  const indexDoc = generateIndex(categories, enums, models);
  fs.writeFileSync(path.join(DOCS_DIR, 'README.md'), indexDoc);

  // Generate ERD overview
  const erdDoc = generateERDOverview(categories);
  fs.writeFileSync(path.join(DOCS_DIR, 'ERD.md'), erdDoc);

  console.log(`✅ Documentation generated in ${DOCS_DIR}/`);
  console.log(`   📄 ${count} model docs generated`);
  console.log(`   📋 README.md (index) generated`);
  console.log(`   📊 ERD.md (diagrams) generated`);
}

main();
