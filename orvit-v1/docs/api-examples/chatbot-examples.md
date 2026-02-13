# Chatbot API - Ejemplos de Uso

## Enviar Mensaje

```typescript
// POST /api/chat
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '¿Cuál es el estado de mi orden OV-00123?',
    sessionId: 'session-123', // Opcional
    language: 'es',
  }),
});

const data = await response.json();
console.log(data.message); // Respuesta del chatbot
console.log(data.requiresHuman); // true si necesita escalamiento
console.log(data.sentiment); // 'positive' | 'neutral' | 'negative'
```

## Obtener Historial

```typescript
// GET /api/chat?sessionId=session-123
const response = await fetch('/api/chat?sessionId=session-123');
const data = await response.json();

console.log(data.messages); // Array de mensajes
/*
[
  { role: 'user', content: 'Hola', createdAt: '...' },
  { role: 'assistant', content: '¡Hola! ¿En qué puedo ayudarte?', createdAt: '...' }
]
*/
```

## Uso en React Component

```tsx
'use client';

import { useState } from 'react';

export function ChatExample() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');

  const sendMessage = async () => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();
    setResponse(data.message);
  };

  return (
    <div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escribe tu mensaje..."
      />
      <button onClick={sendMessage}>Enviar</button>
      {response && <p>Respuesta: {response}</p>}
    </div>
  );
}
```

## Consultas Ejemplo

```typescript
// Consultar orden
await chat('¿Cuál es el estado de mi orden OV-00123?');

// Verificar saldo
await chat('¿Cuánto saldo tengo disponible?');

// Buscar productos
await chat('Busco productos de acero inoxidable');

// Detalles de factura
await chat('Necesito el CAE de la factura FC-A-00456');
```
