'use client';

/**
 * AI Chatbot Widget
 *
 * Floating chatbot widget that provides 24/7 customer support
 */

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatbotWidgetProps {
  className?: string;
  language?: 'es' | 'en';
  position?: 'bottom-right' | 'bottom-left';
}

export function ChatbotWidget({
  className,
  language = 'es',
  position = 'bottom-right',
}: ChatbotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Load session from localStorage
  useEffect(() => {
    const savedSessionId = localStorage.getItem('chatbot_session_id');
    if (savedSessionId) {
      setSessionId(savedSessionId);
      loadChatHistory(savedSessionId);
    }
  }, []);

  const loadChatHistory = async (sid: string) => {
    try {
      const response = await fetch(`/api/chat?sessionId=${sid}`);
      if (response.ok) {
        const data = await response.json();
        const loadedMessages = data.messages
          .filter((msg: any) => msg.role !== 'system')
          .map((msg: any) => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.createdAt),
          }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue,
          sessionId,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al enviar mensaje');
      }

      const data = await response.json();

      // Save session ID
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem('chatbot_session_id', data.sessionId);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(data.timestamp),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Show notification if human intervention required
      if (data.requiresHuman) {
        const notificationMessage: Message = {
          role: 'assistant',
          content: language === 'es'
            ? '📋 Se ha creado un ticket de soporte. Un representante se contactará pronto.'
            : '📋 A support ticket has been created. A representative will contact you soon.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, notificationMessage]);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: language === 'es'
          ? 'Disculpe, hubo un error. Por favor intente nuevamente.'
          : 'Sorry, there was an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem('chatbot_session_id');
  };

  const positionClasses = position === 'bottom-right'
    ? 'right-4 bottom-4'
    : 'left-4 bottom-4';

  return (
    <div className={cn('fixed z-50', positionClasses, className)}>
      {/* Chat Window */}
      {isOpen && (
        <div className={cn(
          'bg-white rounded-lg shadow-2xl mb-4 transition-all duration-300',
          isMinimized ? 'w-80 h-14' : 'w-96 h-[600px]',
          'border border-gray-200'
        )}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <h3 className="font-semibold">
                {language === 'es' ? 'Asistente Virtual' : 'Virtual Assistant'}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-blue-800"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-blue-800"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <ScrollArea className="h-[460px] p-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-3">
                    <MessageCircle className="h-12 w-12 text-gray-300" />
                    <p className="text-sm">
                      {language === 'es'
                        ? '¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?'
                        : 'Hi! I\'m your virtual assistant. How can I help you today?'}
                    </p>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>{language === 'es' ? 'Puedo ayudarte con:' : 'I can help you with:'}</p>
                      <ul className="text-left space-y-0.5 pl-4">
                        <li>• {language === 'es' ? 'Estado de órdenes' : 'Order status'}</li>
                        <li>• {language === 'es' ? 'Facturas y pagos' : 'Invoices and payments'}</li>
                        <li>• {language === 'es' ? 'Entregas pendientes' : 'Pending deliveries'}</li>
                        <li>• {language === 'es' ? 'Búsqueda de productos' : 'Product search'}</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex',
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[80%] rounded-lg px-4 py-2 text-sm',
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          )}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <p className={cn(
                            'text-xs mt-1',
                            msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                          )}>
                            {msg.timestamp.toLocaleTimeString(language === 'es' ? 'es-AR' : 'en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-lg px-4 py-2">
                          <div className="flex space-x-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder={language === 'es' ? 'Escribe tu mensaje...' : 'Type your message...'}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    size="icon"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="text-xs text-gray-500 hover:text-gray-700 mt-2"
                  >
                    {language === 'es' ? 'Limpiar conversación' : 'Clear conversation'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-300"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>
    </div>
  );
}
