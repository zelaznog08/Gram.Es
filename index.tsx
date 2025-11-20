/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat } from '@google/genai';
import * as marked from 'marked';

// Access the API key from the environment
const API_KEY = process.env.API_KEY;

// System instruction defining the assistant's persona and rules
const SYSTEM_INSTRUCTION = `Eres el Profesor Luis González, un profesor de español experto, paciente y didáctico.

Tu tarea es ayudar al usuario (tu alumno) de dos formas posibles, dependiendo de lo que escriba:

1. **RESPONDER DUDAS**: Si el usuario hace una pregunta sobre gramática, vocabulario o uso del español (ej. "¿Cuáles son los artículos indeterminados?", "¿Cómo se usa el subjuntivo?"):
   - Responde claramente a la pregunta.
   - Da ejemplos prácticos.
   - Usa un tono explicativo, amable y pedagógico.

2. **CORREGIR TEXTOS**: Si el usuario envía un texto en español para revisar:
   - Corrige ortografía, gramática, puntuación y concordancia.
   - Explica brevemente los errores de forma clara.
   - Ofrece siempre dos versiones reescritas:
     * **Versión Formal**
     * **Versión Informal/Natural** (manteniendo la intención original).
   - Ofrece sugerencias de estilo (cohesión, precisión léxica, fluidez) si aplica.

Importante:
- Mantén siempre un tono directo, claro y respetuoso.
- Tu objetivo es que el alumno aprenda y mejore su español.`;

// DOM Elements
const messagesContainer = document.getElementById('messages') as HTMLDivElement;
const form = document.getElementById('chat-form') as HTMLFormElement;
const textarea = document.getElementById('user-input') as HTMLTextAreaElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

let chatSession: Chat | null = null;

/**
 * Initialize the Gemini Chat Session
 */
function initChat() {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7, // Balanced creativity for natural corrections and explanations
    },
  });
}

/**
 * Auto-resize textarea based on content
 */
function handleTextareaResize() {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  sendBtn.disabled = textarea.value.trim().length === 0;
}

/**
 * Create a message DOM element
 */
function createMessageElement(role: 'user' | 'ai', text: string = '') {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;
  
  const roleDiv = document.createElement('div');
  roleDiv.className = 'message-role';
  roleDiv.textContent = role === 'user' ? 'Tú' : 'Profesor Luis';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = marked.parse(text) as string;
  
  msgDiv.appendChild(roleDiv);
  msgDiv.appendChild(contentDiv);
  
  return { msgDiv, contentDiv };
}

/**
 * Handle form submission
 */
async function handleSubmit(e: Event) {
  e.preventDefault();
  const message = textarea.value.trim();
  if (!message || !chatSession) return;

  // Clear input
  textarea.value = '';
  textarea.style.height = 'auto';
  sendBtn.disabled = true;

  // Remove empty state if it exists
  if (messagesContainer.classList.contains('empty-state')) {
    messagesContainer.innerHTML = '';
    messagesContainer.classList.remove('empty-state');
  }

  // Add User Message
  const { msgDiv: userMsg } = createMessageElement('user', message);
  messagesContainer.appendChild(userMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Add AI Placeholder
  const { msgDiv: aiMsg, contentDiv: aiContent } = createMessageElement('ai', '...');
  messagesContainer.appendChild(aiMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const result = await chatSession.sendMessageStream({ message });
    
    let fullText = '';
    for await (const chunk of result) {
      fullText += chunk.text;
      // Re-render markdown for the accumulating text
      aiContent.innerHTML = marked.parse(fullText) as string;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  } catch (error) {
    console.error('Error sending message:', error);
    aiContent.innerHTML = '<p style="color: red;">Lo siento, hubo un error al procesar tu solicitud.</p>';
  }
}

// Event Listeners
textarea.addEventListener('input', handleTextareaResize);
textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.dispatchEvent(new Event('submit'));
  }
});
form.addEventListener('submit', handleSubmit);

// Initialize app
initChat();