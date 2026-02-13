/**
 * ML-Powered Bank Reconciliation
 *
 * Uses machine learning patterns to automatically match:
 * - Bank movements with payments
 * - Identify potential matches based on amount, date, and reference
 * - Learn from user corrections to improve matching
 */

import { Prisma } from '@prisma/client';

export interface BankMovement {
  id: number;
  fecha: Date;
  concepto: string;
  referencia?: string | null;
  monto: number;
  tipo: 'CREDITO' | 'DEBITO';
  reconciled: boolean;
}

export interface PaymentCandidate {
  id: number;
  numero: string;
  fecha: Date;
  monto: number;
  clientName: string;
  clientId: string;
  tipo: 'CLIENTE' | 'PROVEEDOR';
  referencia?: string | null;
}

export interface ReconciliationMatch {
  bankMovementId: number;
  paymentId: number;
  paymentType: 'CLIENTE' | 'PROVEEDOR';
  matchScore: number; // 0-100
  matchType: 'exact' | 'partial' | 'fuzzy';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string[];
  amountDifference: number;
  dateDifference: number; // days
}

export interface ReconciliationSuggestion {
  bankMovement: BankMovement;
  matches: ReconciliationMatch[];
  autoReconcileable: boolean; // Can be auto-matched without review
}

// Matching thresholds
const THRESHOLDS = {
  AMOUNT_EXACT_TOLERANCE: 0.01, // 1 cent tolerance
  AMOUNT_PARTIAL_TOLERANCE: 0.05, // 5% tolerance for partial matches
  DATE_EXACT_DAYS: 3, // Within 3 days = exact date match
  DATE_PARTIAL_DAYS: 7, // Within 7 days = partial date match
  MIN_SCORE_AUTO_MATCH: 95, // Minimum score for auto-matching
  MIN_SCORE_SUGGESTION: 50, // Minimum score to suggest
};

/**
 * Generate reconciliation suggestions for unmatched bank movements
 */
export function generateReconciliationSuggestions(
  bankMovements: BankMovement[],
  paymentCandidates: PaymentCandidate[],
  learnedPatterns?: Map<string, string> // Previous matches for learning
): ReconciliationSuggestion[] {
  const suggestions: ReconciliationSuggestion[] = [];

  for (const movement of bankMovements) {
    if (movement.reconciled) continue;

    // Filter candidates by type (credits = payments received, debits = payments made)
    const relevantCandidates = paymentCandidates.filter(p =>
      (movement.tipo === 'CREDITO' && p.tipo === 'CLIENTE') ||
      (movement.tipo === 'DEBITO' && p.tipo === 'PROVEEDOR')
    );

    const matches = findMatches(movement, relevantCandidates, learnedPatterns);

    // Sort by match score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Only include if we have at least one suggestion
    if (matches.length > 0) {
      suggestions.push({
        bankMovement: movement,
        matches: matches.slice(0, 5), // Top 5 matches
        autoReconcileable: matches.length === 1 && matches[0].matchScore >= THRESHOLDS.MIN_SCORE_AUTO_MATCH,
      });
    }
  }

  // Sort suggestions: auto-reconcileable first, then by best match score
  return suggestions.sort((a, b) => {
    if (a.autoReconcileable !== b.autoReconcileable) {
      return a.autoReconcileable ? -1 : 1;
    }
    return (b.matches[0]?.matchScore || 0) - (a.matches[0]?.matchScore || 0);
  });
}

/**
 * Find matching payments for a bank movement
 */
function findMatches(
  movement: BankMovement,
  candidates: PaymentCandidate[],
  learnedPatterns?: Map<string, string>
): ReconciliationMatch[] {
  const matches: ReconciliationMatch[] = [];

  for (const candidate of candidates) {
    const match = calculateMatch(movement, candidate, learnedPatterns);
    if (match.matchScore >= THRESHOLDS.MIN_SCORE_SUGGESTION) {
      matches.push(match);
    }
  }

  return matches;
}

/**
 * Calculate match score between a bank movement and a payment candidate
 */
function calculateMatch(
  movement: BankMovement,
  candidate: PaymentCandidate,
  learnedPatterns?: Map<string, string>
): ReconciliationMatch {
  const reasoning: string[] = [];
  let score = 0;
  let matchType: 'exact' | 'partial' | 'fuzzy' = 'fuzzy';

  // 1. Amount matching (max 40 points)
  const amountDiff = Math.abs(movement.monto - candidate.monto);
  const amountPercent = movement.monto > 0 ? amountDiff / movement.monto : 0;

  if (amountDiff <= THRESHOLDS.AMOUNT_EXACT_TOLERANCE) {
    score += 40;
    reasoning.push('Monto exacto');
    matchType = 'exact';
  } else if (amountPercent <= THRESHOLDS.AMOUNT_PARTIAL_TOLERANCE) {
    score += 30;
    reasoning.push(`Monto similar (diferencia: ${(amountPercent * 100).toFixed(1)}%)`);
    matchType = 'partial';
  } else if (amountPercent <= 0.10) {
    score += 15;
    reasoning.push(`Monto aproximado (diferencia: ${(amountPercent * 100).toFixed(1)}%)`);
  }

  // 2. Date matching (max 25 points)
  const dateDiff = Math.abs(
    Math.floor((movement.fecha.getTime() - candidate.fecha.getTime()) / (1000 * 60 * 60 * 24))
  );

  if (dateDiff <= THRESHOLDS.DATE_EXACT_DAYS) {
    score += 25;
    reasoning.push('Fecha coincidente');
    if (matchType === 'exact') matchType = 'exact';
  } else if (dateDiff <= THRESHOLDS.DATE_PARTIAL_DAYS) {
    score += 15;
    reasoning.push(`Fecha cercana (${dateDiff} días diferencia)`);
    if (matchType === 'exact') matchType = 'partial';
  } else if (dateDiff <= 14) {
    score += 5;
    reasoning.push(`Fecha aproximada (${dateDiff} días diferencia)`);
  }

  // 3. Reference matching (max 25 points)
  const referenceScore = calculateReferenceMatch(movement, candidate);
  score += referenceScore.score;
  if (referenceScore.reason) {
    reasoning.push(referenceScore.reason);
  }

  // 4. Learned patterns (max 10 points)
  if (learnedPatterns) {
    const patternKey = normalizeForPattern(movement.concepto);
    const expectedClient = learnedPatterns.get(patternKey);
    if (expectedClient && expectedClient === candidate.clientId) {
      score += 10;
      reasoning.push('Patrón aprendido de conciliaciones anteriores');
    }
  }

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (score >= 85) confidence = 'high';
  else if (score >= 65) confidence = 'medium';

  return {
    bankMovementId: movement.id,
    paymentId: candidate.id,
    paymentType: candidate.tipo,
    matchScore: Math.min(100, score),
    matchType,
    confidence,
    reasoning,
    amountDifference: amountDiff,
    dateDifference: dateDiff,
  };
}

/**
 * Calculate reference/concept matching score
 */
function calculateReferenceMatch(
  movement: BankMovement,
  candidate: PaymentCandidate
): { score: number; reason?: string } {
  const movementText = normalizeText(
    `${movement.concepto || ''} ${movement.referencia || ''}`
  );
  const candidateText = normalizeText(
    `${candidate.numero} ${candidate.referencia || ''} ${candidate.clientName}`
  );

  // Check for exact payment number match
  if (movementText.includes(normalizeText(candidate.numero))) {
    return { score: 25, reason: 'Número de pago encontrado en referencia bancaria' };
  }

  // Check for client name match
  const clientWords = normalizeText(candidate.clientName).split(' ');
  const matchingWords = clientWords.filter(word =>
    word.length > 3 && movementText.includes(word)
  );
  if (matchingWords.length >= 2) {
    return { score: 20, reason: 'Nombre de cliente encontrado en concepto' };
  }
  if (matchingWords.length === 1) {
    return { score: 10, reason: 'Parte del nombre de cliente encontrado' };
  }

  // Check for reference number match
  const numberPattern = /\d{4,}/g;
  const movementNumbers = movementText.match(numberPattern) || [];
  const candidateNumbers = candidateText.match(numberPattern) || [];
  const commonNumbers = movementNumbers.filter(n => candidateNumbers.includes(n));
  if (commonNumbers.length > 0) {
    return { score: 15, reason: 'Números de referencia coincidentes' };
  }

  // Fuzzy string similarity
  const similarity = calculateStringSimilarity(movementText, candidateText);
  if (similarity > 0.5) {
    return { score: Math.floor(similarity * 15), reason: 'Texto similar' };
  }

  return { score: 0 };
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize concept for pattern learning
 */
function normalizeForPattern(concept: string): string {
  return normalizeText(concept)
    .replace(/\d+/g, 'N') // Replace numbers with N
    .replace(/\s+/g, '_');
}

/**
 * Calculate string similarity using Levenshtein distance.
 * Limits input length to prevent DoS with very long strings.
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const MAX_LENGTH = 500;
  const s1 = str1.length > MAX_LENGTH ? str1.substring(0, MAX_LENGTH) : str1;
  const s2 = str2.length > MAX_LENGTH ? str2.substring(0, MAX_LENGTH) : str2;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Learn patterns from confirmed reconciliations
 */
export function learnReconciliationPattern(
  bankConcept: string,
  clientId: string,
  existingPatterns: Map<string, string>
): Map<string, string> {
  const patternKey = normalizeForPattern(bankConcept);
  existingPatterns.set(patternKey, clientId);
  return existingPatterns;
}

/**
 * Get reconciliation summary statistics
 */
export function getReconciliationStats(suggestions: ReconciliationSuggestion[]) {
  return {
    totalUnreconciled: suggestions.length,
    autoReconcileable: suggestions.filter(s => s.autoReconcileable).length,
    highConfidence: suggestions.filter(s => s.matches[0]?.confidence === 'high').length,
    mediumConfidence: suggestions.filter(s => s.matches[0]?.confidence === 'medium').length,
    lowConfidence: suggestions.filter(s => s.matches[0]?.confidence === 'low').length,
    noMatches: suggestions.filter(s => s.matches.length === 0).length,
    avgMatchScore: suggestions.length > 0
      ? suggestions.reduce((sum, s) => sum + (s.matches[0]?.matchScore || 0), 0) / suggestions.length
      : 0,
  };
}
