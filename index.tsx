
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat, Tool } from '@google/genai';
import * as marked from 'marked';

// Access the API key from the environment
const API_KEY = process.env.API_KEY;

type AppMode = 'corrector' | 'grammar' | 'culture' | 'travel' | 'translator' | 'contact';

// Speech Recognition Types
interface IWindow extends Window {
  SpeechRecognition: any;
  webkitSpeechRecognition: any;
}
declare const window: IWindow;

// INSTRUCCIONES ESPECÍFICAS POR MODO

const SYSTEM_INSTRUCTION_CORRECTOR = `Eres el Profesor Luis González. Estás en el MODO CORRECTOR DE TEXTOS.
Tu tarea es EXCLUSIVAMENTE corregir los textos que el usuario te envíe.

Reglas:
1. Corrige ortografía, gramática, puntuación y concordancia.
2. Explica brevemente los errores de forma clara.
3. Ofrece siempre dos versiones reescritas:
   * **Versión Formal**
   * **Versión Informal/Natural** (manteniendo la intención original).
4. Ofrece sugerencias de estilo (cohesión, precisión léxica).

Si el usuario te saluda, responde brevemente y pide el texto para corregir.
Mantén un tono profesional y directivo hacia la corrección.`;

const SYSTEM_INSTRUCTION_GRAMMAR = `Eres el Profesor Luis González. Estás en el MODO DUDAS DE GRAMÁTICA.
Tu tarea es responder preguntas teóricas sobre la lengua española.

Reglas:
1. Responde a preguntas sobre reglas gramaticales, uso de tiempos verbales, vocabulario, diferencias entre palabras, etc.
2. Sé muy didáctico, claro y paciente.
3. Usa siempre EJEMPLOS PRÁCTICOS para ilustrar tus explicaciones.
4. No intentes "corregir" la pregunta del usuario como si fuera una redacción, sino responder al contenido de su duda.

Si el usuario te envía un texto sin pregunta, pregúntale qué duda gramatical tiene sobre ese texto.`;

const SYSTEM_INSTRUCTION_CULTURE = `Eres un Experto en Dialectología Hispánica y Cultura Popular. Tu especialidad son los modismos, refranes, jergas y expresiones coloquiales de todos los países de habla hispana.

Objetivo:
Tu misión es enseñar al usuario la riqueza cultural del español a través de sus expresiones locales, explicando no solo qué significan, sino cómo y cuándo se usan.

Instrucciones de Respuesta:

1. Entrada del Usuario: El usuario puede pedirte expresiones de un país específico (ej: "Dime frases de Colombia"), sobre un tema (ej: "Expresiones sobre dinero") o una frase concreta para que la expliques.

2. Estructura de la Ficha: Para cada expresión, debes generar una "Ficha Cultural" con el siguiente formato:

    * **🗣️ La Expresión:** [Escribe la frase en negrita].
    * **🌎 País/Región:** [Indica dónde se usa].
    * **📖 Significado:** Explica qué quiere decir en español neutro o estándar.
    * **🧐 Traducción Literal / Origen (Opcional):** Si la frase es curiosa literalmente (ej: "Me importa un pimiento"), explica la imagen visual o el origen brevemente.
    * **💡 Nivel de Formalidad:** (Coloquial, Vulgar, Familiar, Formal).
    * **💬 Ejemplo en Contexto:** Una frase de diálogo natural donde se usaría dicha expresión.`;

const SYSTEM_INSTRUCTION_TRAVEL = `Eres un Periodista de Viajes Senior y Antropólogo Cultural. Tu especialidad es crear "Guías de Inmersión Total" para viajeros que buscan entender el alma de un lugar, no solo visitarlo.

Objetivo:
Tu tarea es generar un reportaje cultural completo sobre un lugar específico (ciudad, región o país) solicitado por el usuario. La respuesta debe ser visualmente rica, evocadora y práctica.

Instrucciones de Herramientas (OBLIGATORIO):
1. Imágenes: DEBES USAR tu herramienta de búsqueda (googleSearch) para encontrar imágenes reales.
   * **PRIORIDAD:** Intenta buscar URLs de **Wikimedia Commons** (.jpg, .png) u otras fuentes abiertas que permitan visualización directa.
   * Usa el formato Markdown para incrustarlas: \`![Descripción de la imagen](URL_IMAGEN)\`.
2. Mapas: DEBES USAR tu herramienta de mapas (googleMaps) para geolocalizar los puntos de interés turístico.`;

const SYSTEM_INSTRUCTION_TRANSLATOR = `Eres un Traductor Profesional Bilingüe (Español <-> Portugués).
Tu única función es traducir fielmente el texto que te envíe el usuario.

Reglas:
1. Si el usuario envía texto en Español, tradúcelo al Portugués (Brasil).
2. Si el usuario envía texto en Portugués, tradúcelo al Español (Neutro).
3. Devuelve SOLO el texto traducido. NO añadidas "Aquí tienes la traducción", ni comillas, ni notas explicativas. Solo el resultado final.`;


// DOM Elements
const messagesContainer = document.getElementById('messages') as HTMLDivElement;
const chatContainer = document.getElementById('chat-container') as HTMLDivElement;
const inputArea = document.getElementById('input-area') as HTMLDivElement;
const translatorView = document.getElementById('translator-view') as HTMLDivElement;
const contactView = document.getElementById('contact-view') as HTMLDivElement;
const form = document.getElementById('chat-form') as HTMLFormElement;
const textarea = document.getElementById('user-input') as HTMLTextAreaElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
const micBtn = document.getElementById('mic-btn') as HTMLButtonElement;
const heroSection = document.getElementById('hero-section') as HTMLDivElement;

// Navigation Tabs (The Grid Buttons)
const tabCorrector = document.getElementById('tab-corrector') as HTMLButtonElement;
const tabGrammar = document.getElementById('tab-grammar') as HTMLButtonElement;
const tabCulture = document.getElementById('tab-culture') as HTMLButtonElement;
const tabTravel = document.getElementById('tab-travel') as HTMLButtonElement;
const tabTranslator = document.getElementById('tab-translator') as HTMLButtonElement;
const tabContact = document.getElementById('tab-contact') as HTMLButtonElement;

// Translator Elements
const transInput = document.getElementById('trans-input') as HTMLTextAreaElement;
const transOutput = document.getElementById('trans-output') as HTMLDivElement;
const transMicBtn = document.getElementById('trans-mic-btn') as HTMLButtonElement;
const transSpeakBtn = document.getElementById('trans-speak-btn') as HTMLButtonElement;
const transCopyBtn = document.getElementById('trans-copy-btn') as HTMLButtonElement;
const doTranslateBtn = document.getElementById('do-translate-btn') as HTMLButtonElement;
const swapLangBtn = document.getElementById('swap-lang-btn') as HTMLButtonElement;
const langSourceLabel = document.getElementById('lang-source-label') as HTMLSpanElement;
const langTargetLabel = document.getElementById('lang-target-label') as HTMLSpanElement;

// Contact Elements
const contactBackBtn = document.getElementById('contact-back-btn') as HTMLButtonElement;

let chatSession: Chat | null = null;
let currentMode: AppMode | null = null; // Start null to show Hero
let transDirection: 'es-pt' | 'pt-es' = 'es-pt';

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition: any = null;
let isRecording = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
}

function updateRecognitionLang() {
  if (!recognition) return;
  if (currentMode === 'translator') {
    recognition.lang = transDirection === 'es-pt' ? 'es-ES' : 'pt-BR';
  } else {
    recognition.lang = 'es-ES';
  }
}

function initChat() {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  let instruction = SYSTEM_INSTRUCTION_CORRECTOR;
  let tools: Tool[] | undefined = undefined;
  
  if (currentMode === 'grammar') instruction = SYSTEM_INSTRUCTION_GRAMMAR;
  else if (currentMode === 'culture') instruction = SYSTEM_INSTRUCTION_CULTURE;
  else if (currentMode === 'travel') {
    instruction = SYSTEM_INSTRUCTION_TRAVEL;
    tools = [{ googleSearch: {} }, { googleMaps: {} }];
  } else if (currentMode === 'translator') instruction = SYSTEM_INSTRUCTION_TRANSLATOR;

  // Don't init chat for Contact mode
  if (currentMode === 'contact') return;

  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: instruction,
      temperature: currentMode === 'translator' ? 0.3 : 0.7,
      tools: tools,
    },
  });
}

/**
 * Switch App Mode
 */
function switchMode(mode: AppMode | null) {
  if (currentMode === mode && mode !== null) return;
  currentMode = mode;

  // 1. Manage Hero Section
  if (mode === null) {
    if (heroSection) {
      heroSection.style.opacity = '1';
      heroSection.style.height = 'auto';
      heroSection.style.margin = '1rem 0 2rem 0';
      heroSection.style.overflow = 'visible';
    }
  } else {
    if (heroSection) {
      heroSection.style.opacity = '0';
      heroSection.style.height = '0';
      heroSection.style.margin = '0';
      heroSection.style.overflow = 'hidden';
    }
  }

  // 2. Update Grid Active State
  const allTabs = [tabCorrector, tabGrammar, tabCulture, tabTravel, tabTranslator, tabContact];
  allTabs.forEach(t => {
      if(t) t.classList.remove('active', 'border-blue-500', 'bg-slate-800');
  });

  if (mode !== null) {
    let activeTab;
    if (mode === 'corrector') activeTab = tabCorrector;
    else if (mode === 'grammar') activeTab = tabGrammar;
    else if (mode === 'culture') activeTab = tabCulture;
    else if (mode === 'travel') activeTab = tabTravel;
    else if (mode === 'translator') activeTab = tabTranslator;
    else if (mode === 'contact') activeTab = tabContact;
    
    if (activeTab) activeTab.classList.add('active', 'border-blue-500', 'bg-slate-800');
  }

  // 3. Manage Views
  chatContainer.classList.add('hidden');
  translatorView.classList.add('hidden');
  contactView.classList.add('hidden');
  inputArea.classList.add('hidden'); // Main input hidden for translator & contact & hero

  if (mode === 'contact') {
      contactView.classList.remove('hidden');
  } else if (mode === 'translator') {
    translatorView.classList.remove('hidden');
    transInput.focus();
    initChat();
  } else if (mode !== null) {
    chatContainer.classList.remove('hidden');
    inputArea.classList.remove('hidden');
    
    // Auto-focus main input
    setTimeout(() => textarea.focus(), 100);

    updatePlaceholder();
    
    // Clear chat logic if switching context
    messagesContainer.innerHTML = '';
    
    // Show Welcome
    showWelcomeMessage(mode);
    initChat();
  }
  
  updateRecognitionLang();
}

function showWelcomeMessage(mode: AppMode) {
  let welcomeText = '';
  let roleText = 'Asistente';
  
  if (mode === 'corrector') {
    welcomeText = "¡Hola! Soy el Profesor Luis. Pega tu texto y te ayudaré a perfeccionarlo.";
    roleText = 'Profesor Luis';
  } else if (mode === 'grammar') {
    welcomeText = "¿Qué duda gramatical tienes hoy?";
    roleText = 'Gramática';
  } else if (mode === 'culture') {
    welcomeText = "Pídeme refranes o expresiones de cualquier país hispano.";
    roleText = 'Experto Cultural';
  } else if (mode === 'travel') {
    welcomeText = "¿Qué destino quieres explorar?";
    roleText = 'Guía de Viajes';
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = 'message ai';
  msgDiv.innerHTML = `
    <div class="message-role">
        <span>${roleText}</span>
    </div>
    <div class="message-content">
        <p>${welcomeText}</p>
    </div>
  `;
  messagesContainer.appendChild(msgDiv);
}

function updatePlaceholder() {
  if (currentMode === 'corrector') textarea.placeholder = "Pega tu texto aquí para corregir...";
  else if (currentMode === 'grammar') textarea.placeholder = "Escribe tu duda gramatical...";
  else if (currentMode === 'culture') textarea.placeholder = "Pídeme expresiones de un país...";
  else if (currentMode === 'travel') textarea.placeholder = "Dime una ciudad o país...";
}

// ... TRANSLATOR LOGIC SAME AS BEFORE ...
async function handleTranslation() {
  const text = transInput.value.trim();
  if (!text || !chatSession) return;

  doTranslateBtn.disabled = true;
  doTranslateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traduciendo...';
  transOutput.textContent = '...';

  try {
    const directionPrompt = transDirection === 'es-pt' 
      ? `Traduce del Español al Portugués (Brasil): "${text}"`
      : `Traduce del Portugués al Español: "${text}"`;

    const result = await chatSession.sendMessage({ message: directionPrompt });
    transOutput.textContent = result.text.trim();
  } catch (error) {
    transOutput.textContent = 'Error al traducir.';
  } finally {
    doTranslateBtn.disabled = false;
    doTranslateBtn.textContent = 'Traduzir Agora';
  }
}

// ... CHAT LOGIC ...
async function handleSubmit(e: Event) {
  e.preventDefault();
  const message = textarea.value.trim();
  if (!message || !chatSession) return;

  // Visual Clean up
  textarea.value = '';
  textarea.style.height = 'auto';

  // User Msg
  const { msgDiv: userMsg } = createMessageElement('user', message);
  messagesContainer.appendChild(userMsg);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // AI Loading Msg
  const { msgDiv: aiMsg, contentDiv: aiContent } = createMessageElement('ai', '', true);
  messagesContainer.appendChild(aiMsg);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  try {
    const result = await chatSession.sendMessageStream({ message });
    let fullText = '';
    let firstChunk = true;

    for await (const chunk of result) {
      if (firstChunk) {
        aiContent.innerHTML = ''; // Remove typing dots
        firstChunk = false;
      }
      if (chunk.text) {
        fullText += chunk.text;
        aiContent.innerHTML = marked.parse(fullText) as string;
      }
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  } catch (error) {
    aiContent.innerHTML = 'Error de conexión.';
  }
}

function createMessageElement(role: 'user' | 'ai', text: string, isTyping = false) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;
  
  const roleName = role === 'user' ? 'Você' : 'Agente IA';

  const innerHTML = `
    <div class="message-role">
        <span>${roleName}</span>
    </div>
    <div class="message-content">
        ${isTyping ? `
            <div class="typing-indicator">
                <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
            </div>` 
        : marked.parse(text)}
    </div>
  `;
  
  msgDiv.innerHTML = innerHTML;
  // If needed, grab reference to content div
  const contentDiv = msgDiv.querySelector('.message-content') as HTMLDivElement;
  return { msgDiv, contentDiv };
}

// EVENT LISTENERS

// Tabs
if(tabTranslator) tabTranslator.addEventListener('click', () => switchMode('translator'));
if(tabCorrector) tabCorrector.addEventListener('click', () => switchMode('corrector'));
if(tabGrammar) tabGrammar.addEventListener('click', () => switchMode('grammar'));
if(tabCulture) tabCulture.addEventListener('click', () => switchMode('culture')); // Exp
if(tabTravel) tabTravel.addEventListener('click', () => switchMode('travel')); // Cultura/Viajes
if(tabContact) tabContact.addEventListener('click', () => switchMode('contact'));

// Back Buttons
if(contactBackBtn) contactBackBtn.addEventListener('click', () => switchMode(null));

// Forms
form.addEventListener('submit', handleSubmit);
textarea.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.dispatchEvent(new Event('submit')); }
});

// Translator
doTranslateBtn.addEventListener('click', handleTranslation);
swapLangBtn.addEventListener('click', () => {
    transDirection = transDirection === 'es-pt' ? 'pt-es' : 'es-pt';
    swapLangBtn.classList.add('rotate-180');
    setTimeout(() => swapLangBtn.classList.remove('rotate-180'), 300);
    
    if (transDirection === 'es-pt') {
        langSourceLabel.textContent = 'Español';
        langTargetLabel.textContent = 'Portugués';
        transInput.placeholder = 'Escribe en español...';
    } else {
        langSourceLabel.textContent = 'Portugués';
        langTargetLabel.textContent = 'Español';
        transInput.placeholder = 'Escreva em português...';
    }
    updateRecognitionLang();
});

// Mic Logic
function setupMic(btn: HTMLButtonElement, input: HTMLTextAreaElement) {
    if (!recognition) {
        btn.style.display = 'none';
        return;
    }
    btn.addEventListener('click', () => {
        if (isRecording) {
            recognition.stop();
        } else {
            updateRecognitionLang();
            recognition.onstart = () => { isRecording = true; btn.classList.add('recording'); input.placeholder = "Escuchando..."; };
            recognition.onend = () => { isRecording = false; btn.classList.remove('recording'); };
            recognition.onresult = (e: any) => {
                input.value += (input.value ? ' ' : '') + e.results[0][0].transcript;
            };
            recognition.start();
        }
    });
}

setupMic(micBtn, textarea);
setupMic(transMicBtn, transInput);

// Speech Synthesis
transSpeakBtn.addEventListener('click', () => {
    const text = transOutput.textContent;
    if(!text) return;
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = transDirection === 'es-pt' ? 'pt-BR' : 'es-ES';
    window.speechSynthesis.speak(ut);
});

transCopyBtn.addEventListener('click', () => {
    const text = transOutput.textContent;
    if(text) navigator.clipboard.writeText(text);
});

// Init - Don't auto-switch, let user see Hero, or default to one? 
// The prompt design has a "Start" feel. Let's just wait for click.
// However, the input is visible. If user types in main input without mode, default to Corrector?
textarea.addEventListener('focus', () => {
    if (!currentMode) switchMode('corrector');
});