'use client';

/**
 * Chatbot Test Page
 *
 * Test page to verify chatbot functionality
 */

import { ChatbotWidget } from '@/components/portal/chatbot-widget';

export default function TestChatbotPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🤖 AI Chatbot - Prueba de Funcionalidad
          </h1>
          <p className="text-gray-600 mb-6">
            Chatbot inteligente con OpenAI GPT-4 que proporciona soporte 24/7
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Features */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">✨ Funcionalidades</h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span><strong>Consulta de órdenes:</strong> Estado y seguimiento en tiempo real</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span><strong>Saldo de cuenta:</strong> Verificación de crédito disponible</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span><strong>Detalles de facturas:</strong> Información completa con CAE</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span><strong>Entregas pendientes:</strong> Tracking de envíos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span><strong>Búsqueda de productos:</strong> Catálogo en tiempo real</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span><strong>Tickets de soporte:</strong> Escalamiento automático</span>
                </li>
              </ul>
            </div>

            {/* Example Queries */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">💬 Consultas de Ejemplo</h2>
              <div className="space-y-2 text-sm">
                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                  <p className="font-medium text-blue-900">Cliente:</p>
                  <p className="text-gray-700 italic">"¿Cuál es el estado de mi orden OV-00123?"</p>
                </div>
                <div className="bg-green-50 p-3 rounded-md border border-green-200">
                  <p className="font-medium text-green-900">Cliente:</p>
                  <p className="text-gray-700 italic">"¿Cuánto saldo tengo disponible?"</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-md border border-purple-200">
                  <p className="font-medium text-purple-900">Cliente:</p>
                  <p className="text-gray-700 italic">"Busco productos relacionados con acero"</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-md border border-orange-200">
                  <p className="font-medium text-orange-900">Cliente:</p>
                  <p className="text-gray-700 italic">"¿Cuándo llega mi entrega?"</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">⚙️ Detalles Técnicos</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Modelo de IA</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• GPT-4 Turbo</li>
                <li>• Function calling</li>
                <li>• Temperature: 0.7</li>
                <li>• Max tokens: 800</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Características</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• Análisis de sentimiento</li>
                <li>• Escalamiento automático</li>
                <li>• Multi-idioma (ES/EN)</li>
                <li>• Persistencia de sesión</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Integraciones</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• Base de datos en tiempo real</li>
                <li>• Sistema de tickets</li>
                <li>• Portal del cliente</li>
                <li>• API REST</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Nota:</strong> Este chatbot requiere una API key de OpenAI configurada
              en <code className="bg-yellow-100 px-1 rounded">OPENAI_API_KEY</code> en las
              variables de entorno.
            </p>
          </div>

          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
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
