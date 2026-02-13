/**
 * Chatbot Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChatbot } from '@/lib/ai/chatbot';

describe('Chatbot Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create chatbot instance with context', () => {
    const chatbot = createChatbot({
      companyId: 1,
      userId: 123,
      sessionId: 'test-session',
      language: 'es',
    });

    expect(chatbot).toBeDefined();
    expect(chatbot.getConversationHistory()).toHaveLength(1); // System prompt
  });

  it('should analyze sentiment correctly', () => {
    const chatbot = createChatbot({
      companyId: 1,
      sessionId: 'test',
    });

    // @ts-ignore - accessing private method for testing
    expect(chatbot['analyzeSentiment']('gracias excelente')).toBe('positive');
    expect(chatbot['analyzeSentiment']('problema error mal')).toBe('negative');
    expect(chatbot['analyzeSentiment']('hola como estas')).toBe('neutral');
  });
});
