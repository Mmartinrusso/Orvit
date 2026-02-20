'use client';

/**
 * Chatbot Test Page
 *
 * Test page to verify chatbot functionality
 */

import { ChatbotWidget } from '@/components/portal/chatbot-widget';

export default function TestChatbotPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-info-muted to-primary/10 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            🤖 AI Chatbot - Prueba de Funcionalidad
          </h1>
          <p className="text-muted-foreground mb-6">
            Chatbot inteligente con OpenAI GPT-4 que proporciona soporte 24/7
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Features */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">✨ Funcionalidades</h2>
              <ul className="space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  <span><strong>Consulta de órdenes:</strong> Estado y seguimiento en tiempo real</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  <span><strong>Saldo de cuenta:</strong> Verificación de crédito disponible</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  <span><strong>Detalles de facturas:</strong> Información completa con CAE</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  <span><strong>Entregas pendientes:</strong> Tracking de envíos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  <span><strong>Búsqueda de productos:</strong> Catálogo en tiempo real</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">✓</span>
                  <span><strong>Tickets de soporte:</strong> Escalamiento automático</span>
                </li>
              </ul>
            </div>

            {/* Example Queries */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">💬 Consultas de Ejemplo</h2>
              <div className="space-y-2 text-sm">
                <div className="bg-info-muted p-3 rounded-md border border-info-muted">
                  <p className="font-medium text-info-muted-foreground">Cliente:</p>
                  <p className="text-foreground italic">"¿Cuál es el estado de mi orden OV-00123?"</p>
                </div>
                <div className="bg-success-muted p-3 rounded-md border border-success-muted">
                  <p className="font-medium text-success-muted-foreground">Cliente:</p>
                  <p className="text-foreground italic">"¿Cuánto saldo tengo disponible?"</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-md border border-purple-200">
                  <p className="font-medium text-purple-900">Cliente:</p>
                  <p className="text-foreground italic">"Busco productos relacionados con acero"</p>
                </div>
                <div className="bg-warning-muted p-3 rounded-md border border-warning-muted">
                  <p className="font-medium text-warning-muted-foreground">Cliente:</p>
                  <p className="text-foreground italic">"¿Cuándo llega mi entrega?"</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="bg-card rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">⚙️ Detalles Técnicos</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Modelo de IA</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>• GPT-4 Turbo</li>
                <li>• Function calling</li>
                <li>• Temperature: 0.7</li>
                <li>• Max tokens: 800</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Características</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Análisis de sentimiento</li>
                <li>• Escalamiento automático</li>
                <li>• Multi-idioma (ES/EN)</li>
                <li>• Persistencia de sesión</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Integraciones</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Base de datos en tiempo real</li>
                <li>• Sistema de tickets</li>
                <li>• Portal del cliente</li>
                <li>• API REST</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-warning-muted border border-warning-muted rounded-md">
            <p className="text-sm text-warning-muted-foreground">
              <strong>⚠️ Nota:</strong> Este chatbot requiere una API key de OpenAI configurada
              en <code className="bg-warning-muted px-1 rounded">OPENAI_API_KEY</code> en las
              variables de entorno.
            </p>
          </div>

          <div className="mt-4 p-4 bg-success-muted border border-success-muted rounded-md">
            <p className="text-sm text-success-muted-foreground">
              <strong>💰 ROI Estimado:</strong> Automatización de 500 consultas/mes = 1 empleado
              de soporte ahorrado = <strong>$2,000 USD/mes</strong> ($24,000 USD/año)
            </p>
          </div>
        </div>
      </div>

      {/* Chatbot Widget */}
      <ChatbotWidget language="es" position="bottom-right" />
    </div>
  );
}
