/**
 * Parser Seguro de Fórmulas para Cálculo de Nóminas
 *
 * NO usa eval() - implementa un parser propio con whitelist de operaciones
 */

import { FormulaContext, RoundingMode, ROUNDING_MODE } from './config';

// =============================================================================
// TIPOS
// =============================================================================

type TokenType =
  | 'NUMBER'
  | 'VARIABLE'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'TERNARY_IF'
  | 'TERNARY_ELSE'
  | 'COMPARISON'
  | 'LOGICAL';

interface Token {
  type: TokenType;
  value: string | number;
}

// =============================================================================
// TOKENIZER
// =============================================================================

const OPERATORS = ['+', '-', '*', '/', '%'];
const COMPARISONS = ['>=', '<=', '>', '<', '==', '!='];
const LOGICAL = ['&&', '||'];

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const char = formula[i];

    // Espacios
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Números (incluyendo decimales)
    if (/\d/.test(char) || (char === '.' && /\d/.test(formula[i + 1]))) {
      let num = '';
      while (i < formula.length && (/\d/.test(formula[i]) || formula[i] === '.')) {
        num += formula[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(num) });
      continue;
    }

    // Variables (letras y _)
    if (/[a-zA-Z_]/.test(char)) {
      let variable = '';
      while (i < formula.length && /[a-zA-Z0-9_]/.test(formula[i])) {
        variable += formula[i];
        i++;
      }
      tokens.push({ type: 'VARIABLE', value: variable });
      continue;
    }

    // Comparaciones de dos caracteres
    const twoChar = formula.slice(i, i + 2);
    if (COMPARISONS.includes(twoChar)) {
      tokens.push({ type: 'COMPARISON', value: twoChar });
      i += 2;
      continue;
    }

    // Operadores lógicos
    if (LOGICAL.includes(twoChar)) {
      tokens.push({ type: 'LOGICAL', value: twoChar });
      i += 2;
      continue;
    }

    // Comparaciones de un caracter
    if (['>', '<'].includes(char)) {
      tokens.push({ type: 'COMPARISON', value: char });
      i++;
      continue;
    }

    // Operadores
    if (OPERATORS.includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char });
      i++;
      continue;
    }

    // Paréntesis
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Ternario
    if (char === '?') {
      tokens.push({ type: 'TERNARY_IF', value: '?' });
      i++;
      continue;
    }
    if (char === ':') {
      tokens.push({ type: 'TERNARY_ELSE', value: ':' });
      i++;
      continue;
    }

    throw new Error(`Carácter no reconocido en fórmula: ${char} (posición ${i})`);
  }

  return tokens;
}

// =============================================================================
// PARSER (Recursive Descent)
// =============================================================================

class FormulaParser {
  private tokens: Token[];
  private pos: number;
  private context: FormulaContext;

  constructor(tokens: Token[], context: FormulaContext) {
    this.tokens = tokens;
    this.pos = 0;
    this.context = context;
  }

  parse(): number {
    const result = this.parseTernary();
    if (this.pos < this.tokens.length) {
      throw new Error(`Tokens no procesados en la fórmula`);
    }
    return result;
  }

  private current(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private advance(): Token | null {
    return this.tokens[this.pos++] || null;
  }

  // Ternario: condition ? valueIfTrue : valueIfFalse
  private parseTernary(): number {
    const condition = this.parseLogical();

    if (this.current()?.type === 'TERNARY_IF') {
      this.advance(); // consume ?
      const trueValue = this.parseLogical();

      if (this.current()?.type !== 'TERNARY_ELSE') {
        throw new Error('Se esperaba ":" en expresión ternaria');
      }
      this.advance(); // consume :

      const falseValue = this.parseTernary();
      return condition ? trueValue : falseValue;
    }

    return condition;
  }

  // Operadores lógicos: && ||
  private parseLogical(): number {
    let left = this.parseComparison();

    while (this.current()?.type === 'LOGICAL') {
      const op = this.advance()!.value as string;
      const right = this.parseComparison();

      if (op === '&&') {
        left = left && right ? 1 : 0;
      } else if (op === '||') {
        left = left || right ? 1 : 0;
      }
    }

    return left;
  }

  // Comparaciones: > < >= <= == !=
  private parseComparison(): number {
    let left = this.parseAddSub();

    while (this.current()?.type === 'COMPARISON') {
      const op = this.advance()!.value as string;
      const right = this.parseAddSub();

      switch (op) {
        case '>':
          left = left > right ? 1 : 0;
          break;
        case '<':
          left = left < right ? 1 : 0;
          break;
        case '>=':
          left = left >= right ? 1 : 0;
          break;
        case '<=':
          left = left <= right ? 1 : 0;
          break;
        case '==':
          left = left === right ? 1 : 0;
          break;
        case '!=':
          left = left !== right ? 1 : 0;
          break;
      }
    }

    return left;
  }

  // Suma y resta
  private parseAddSub(): number {
    let left = this.parseMulDiv();

    while (
      this.current()?.type === 'OPERATOR' &&
      (this.current()?.value === '+' || this.current()?.value === '-')
    ) {
      const op = this.advance()!.value;
      const right = this.parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }

    return left;
  }

  // Multiplicación, división y módulo
  private parseMulDiv(): number {
    let left = this.parseUnary();

    while (
      this.current()?.type === 'OPERATOR' &&
      (this.current()?.value === '*' ||
        this.current()?.value === '/' ||
        this.current()?.value === '%')
    ) {
      const op = this.advance()!.value;
      const right = this.parseUnary();

      if (op === '*') {
        left = left * right;
      } else if (op === '/') {
        if (right === 0) {
          throw new Error('División por cero');
        }
        left = left / right;
      } else if (op === '%') {
        left = left % right;
      }
    }

    return left;
  }

  // Operador unario negativo
  private parseUnary(): number {
    if (this.current()?.type === 'OPERATOR' && this.current()?.value === '-') {
      this.advance();
      return -this.parsePrimary();
    }
    return this.parsePrimary();
  }

  // Valores primarios: números, variables, paréntesis
  private parsePrimary(): number {
    const token = this.current();

    if (!token) {
      throw new Error('Expresión incompleta');
    }

    // Número
    if (token.type === 'NUMBER') {
      this.advance();
      return token.value as number;
    }

    // Variable
    if (token.type === 'VARIABLE') {
      this.advance();
      const varName = token.value as string;

      // Funciones built-in
      if (varName === 'min' || varName === 'max' || varName === 'abs' || varName === 'round') {
        return this.parseFunction(varName);
      }

      // Variable del contexto
      const value = this.context[varName];
      if (value === undefined || value === null) {
        return 0; // Variables no definidas = 0
      }
      if (value instanceof Date) {
        return 0; // Las fechas no se pueden usar directamente en cálculos
      }
      return Number(value) || 0;
    }

    // Paréntesis
    if (token.type === 'LPAREN') {
      this.advance();
      const result = this.parseTernary();
      if (this.current()?.type !== 'RPAREN') {
        throw new Error('Falta paréntesis de cierre');
      }
      this.advance();
      return result;
    }

    throw new Error(`Token inesperado: ${token.type}`);
  }

  // Funciones built-in
  private parseFunction(name: string): number {
    if (this.current()?.type !== 'LPAREN') {
      throw new Error(`Se esperaba "(" después de ${name}`);
    }
    this.advance();

    const args: number[] = [];
    while (this.current()?.type !== 'RPAREN') {
      args.push(this.parseTernary());
      // Si hay coma, podría ser separador de args (no implementado por simplicidad)
    }
    this.advance(); // consume )

    switch (name) {
      case 'min':
        return Math.min(...args);
      case 'max':
        return Math.max(...args);
      case 'abs':
        return Math.abs(args[0] || 0);
      case 'round':
        return Math.round(args[0] || 0);
      default:
        throw new Error(`Función no reconocida: ${name}`);
    }
  }
}

// =============================================================================
// API PÚBLICA
// =============================================================================

/**
 * Evalúa una fórmula de forma segura (sin eval)
 */
export function evaluateFormula(formula: string, context: FormulaContext): number {
  if (!formula || formula.trim() === '') {
    return 0;
  }

  try {
    const tokens = tokenize(formula);
    const parser = new FormulaParser(tokens, context);
    return parser.parse();
  } catch (error) {
    console.error(`Error evaluando fórmula "${formula}":`, error);
    throw error;
  }
}

/**
 * Valida que una fórmula sea sintácticamente correcta
 */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || formula.trim() === '') {
    return { valid: true };
  }

  // Crear contexto de prueba con todas las variables en 1
  const testContext: FormulaContext = {
    base: 1,
    gross: 1,
    years: 1,
    months: 1,
    hire_date: new Date(),
    days_in_period: 30,
    days_worked: 30,
    absence_days: 0,
    overtime_hours: 0,
    vacation_days: 0,
    bonus: 0,
    commission: 0,
  };

  try {
    const tokens = tokenize(formula);
    const parser = new FormulaParser(tokens, testContext);
    parser.parse();
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Aplica redondeo según el modo especificado
 */
export function applyRounding(
  value: number,
  mode: RoundingMode,
  decimals: number = 2
): number {
  const multiplier = Math.pow(10, decimals);

  switch (mode) {
    case ROUNDING_MODE.HALF_UP:
      return Math.round(value * multiplier) / multiplier;
    case ROUNDING_MODE.DOWN:
      return Math.floor(value * multiplier) / multiplier;
    case ROUNDING_MODE.UP:
      return Math.ceil(value * multiplier) / multiplier;
    case ROUNDING_MODE.NONE:
      return value;
    default:
      return Math.round(value * multiplier) / multiplier;
  }
}

/**
 * Aplica límites mín/máx a un valor
 */
export function applyCaps(
  value: number,
  capMin?: number | null,
  capMax?: number | null
): number {
  let result = value;

  if (capMin !== undefined && capMin !== null && result < capMin) {
    result = capMin;
  }

  if (capMax !== undefined && capMax !== null && result > capMax) {
    result = capMax;
  }

  return result;
}

/**
 * Extrae las variables usadas en una fórmula
 */
export function extractVariables(formula: string): string[] {
  if (!formula) return [];

  const tokens = tokenize(formula);
  const variables = new Set<string>();
  const builtinFunctions = ['min', 'max', 'abs', 'round'];

  for (const token of tokens) {
    if (token.type === 'VARIABLE' && !builtinFunctions.includes(token.value as string)) {
      variables.add(token.value as string);
    }
  }

  return Array.from(variables);
}
