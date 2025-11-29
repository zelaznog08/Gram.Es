
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
    * **💬 Ejemplo en Contexto:** Una frase de diálogo natural donde se usaría dicha expresión.

Ejemplo de Entrenamiento (Few-Shot):

*Usuario:* Dame una expresión de Chile.

*Asistente:*
* **🗣️ La Expresión:** **"Estar arriba de la pelota"**
* **🌎 País/Región:** Chile 🇨🇱.
* **📖 Significado:** Estar borracho o muy eufórico/hiperactivo.
* **💡 Nivel de Formalidad:** Coloquial / Familiar.
* **💬 Ejemplo en Contexto:** "Juan se tomó tres vinos y ya está arriba de la pelota, no para de bailar."

*Usuario:* ¿Qué significa "Estar hasta las manos" en Argentina?

*Asistente:*
* **🗣️ La Expresión:** **"Estar hasta las manos"**
* **🌎 País/Región:** Argentina 🇦🇷 / Uruguay 🇺🇾.
* **📖 Significado:** Tiene dos significados según el contexto: 1) Estar muy ocupado/agobiado. 2) Estar muy enamorado.
* **💬 Ejemplo en Contexto:** "No puedo ir al cine hoy, estoy hasta las manos de trabajo."

Nota Importante: Si una expresión es vulgar o malsonante, adviértelo en el "Nivel de Formalidad" pero explica su significado académico objetivamente.`;

const SYSTEM_INSTRUCTION_TRAVEL = `Eres un Periodista de Viajes Senior y Antropólogo Cultural. Tu especialidad es crear "Guías de Inmersión Total" para viajeros que buscan entender el alma de un lugar, no solo visitarlo.

Objetivo:
Tu tarea es generar un reportaje cultural completo sobre un lugar específico (ciudad, región o país) solicitado por el usuario. La respuesta debe ser visualmente rica, evocadora y práctica.

Instrucciones de Herramientas (OBLIGATORIO):
1. Imágenes: DEBES USAR tu herramienta de búsqueda (googleSearch) para encontrar imágenes reales.
   * **PRIORIDAD:** Intenta buscar URLs de **Wikimedia Commons** (.jpg, .png) u otras fuentes abiertas que permitan visualización directa.
   * Usa el formato Markdown para incrustarlas: \`![Descripción de la imagen](URL_IMAGEN)\`.
   * Si no encuentras una imagen incrustable, genera un enlace de texto claro: \`[🖼️ Ver imagen de X en Google](URL_Búsqueda)\`.
   * NO inventes URLs.
2. Mapas: DEBES USAR tu herramienta de mapas (googleMaps) para geolocalizar los puntos de interés turístico y los mejores restaurantes mencionados.

Estructura del Reportaje Cultural:

Debes organizar la información en el siguiente formato editorial:

---
# 🌍 [Nombre del Lugar]: Una Inmersión Cultural

### 1. 🎵 Ritmo y Movimiento (Música y Bailes)
* **El Sonido:** Describe los géneros tradicionales.
* **El Baile:** Describe la danza típica.
* **🖼️ Imagen:** [Incrusta una imagen de Wikimedia o enlace de búsqueda].

### 2. 👗 Tejidos e Identidad (Vestimenta Típica)
* **La Ropa:** Describe el traje tradicional, materiales y uso.
* **🖼️ Imagen:** [Incrusta una imagen de alta calidad].

### 3. 🍲 Sabores Auténticos (Gastronomía)
* **Plato Estrella:** Describe ingredientes y sabor.
* **Bebida Típica:** ¿Qué se bebe aquí?
* **🖼️ Imagen:** [Incrusta una foto apetitosa del plato].
* **📍 Dónde probarlo:** Recomienda 1 o 2 restaurantes famosos.
* **🗺️ Mapa:** [Usa la herramienta de mapas].

### 4. 🏰 Huellas de la Historia (Turismo y Patrimonio)
* **Imperdibles:** Selecciona 3 sitios icónicos. Reseña histórica breve.
* **🖼️ Imagen:** [Muestra una foto del sitio].
* **🗺️ Mapa:** [Genera un mapa con los pines].

### 5. 💡 Dato Curioso / "Secretos Locales"
* Un dato breve que solo los locales conocen.

---

Tono y Estilo:
* Usa un lenguaje sensorial.
* Sé entusiasta pero riguroso.`;

const SYSTEM_INSTRUCTION_TRANSLATOR = `Eres un Traductor Profesional Bilingüe (Español <-> Portugués).
Tu única función es traducir fielmente el texto que te envíe el usuario.

Reglas:
1. Si el usuario envía texto en Español, tradúcelo al Portugués (Brasil).
2. Si el usuario envía texto en Portugués, tradúcelo al Español (Neutro).
3. Devuelve SOLO el texto traducido. NO añadidas "Aquí tienes la traducción", ni comillas, ni notas explicativas. Solo el resultado final.
4. Respeta el tono y la formalidad del original.`;


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

// Navigation Tabs
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

let chatSession: Chat | null = null;
let currentMode: AppMode = 'translator'; // Default mode
let transDirection: 'es-pt' | 'pt-es' = 'es-pt';

// Speech Recognition Setup (Global var)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition: any = null;
let isRecording = false;

// Initialize Recognition
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
} else {
  micBtn.style.display = 'none';
  transMicBtn.style.display = 'none';
}

/**
 * Configure Recognition Language
 */
function updateRecognitionLang() {
  if (!recognition) return;
  
  if (currentMode === 'translator') {
    // In translator, source lang depends on direction
    recognition.lang = transDirection === 'es-pt' ? 'es-ES' : 'pt-BR';
  } else {
    // In other modes, always Spanish
    recognition.lang = 'es-ES';
  }
}

/**
 * Initialize the Gemini Chat Session based on current mode
 */
function initChat() {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  let instruction = SYSTEM_INSTRUCTION_CORRECTOR;
  let tools: Tool[] | undefined = undefined;
  
  // No AI needed for contact mode
  if (currentMode === 'contact') return;

  if (currentMode === 'grammar') {
    instruction = SYSTEM_INSTRUCTION_GRAMMAR;
  } else if (currentMode === 'culture') {
    instruction = SYSTEM_INSTRUCTION_CULTURE;
  } else if (currentMode === 'travel') {
    instruction = SYSTEM_INSTRUCTION_TRAVEL;
    tools = [{ googleSearch: {} }, { googleMaps: {} }];
  } else if (currentMode === 'translator') {
    instruction = SYSTEM_INSTRUCTION_TRANSLATOR;
  }

  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: instruction,
      temperature: currentMode === 'translator' ? 0.3 : 0.7, // Lower temp for translation accuracy
      tools: tools,
    },
  });
}

/**
 * Switch App Mode
 */
function switchMode(mode: AppMode) {
  if (currentMode === mode && (mode === 'contact' || chatSession)) return; // Prevent reload if same mode
  currentMode = mode;

  // Update UI Tabs
  [tabCorrector, tabGrammar, tabCulture, tabTravel, tabTranslator, tabContact].forEach(t => t.classList.remove('active'));

  if (mode === 'corrector') tabCorrector.classList.add('active');
  else if (mode === 'grammar') tabGrammar.classList.add('active');
  else if (mode === 'culture') tabCulture.classList.add('active');
  else if (mode === 'travel') tabTravel.classList.add('active');
  else if (mode === 'translator') tabTranslator.classList.add('active');
  else if (mode === 'contact') tabContact.classList.add('active');
  
  // Hide all views first
  chatContainer.classList.add('hidden');
  inputArea.classList.add('hidden');
  translatorView.classList.add('hidden');
  contactView.classList.add('hidden');

  // Show specific view
  if (mode === 'translator') {
    translatorView.classList.remove('hidden');
    transInput.focus();
    initChat();
  } else if (mode === 'contact') {
    contactView.classList.remove('hidden');
    // No chat init needed
  } else {
    chatContainer.classList.remove('hidden');
    inputArea.classList.remove('hidden');
    updatePlaceholder();
    
    // Clear chat logic
    messagesContainer.innerHTML = '';
    messagesContainer.classList.add('empty-state');
    showWelcomeMessage(mode);
    initChat();
  }
  
  updateRecognitionLang();
}

function showWelcomeMessage(mode: AppMode) {
  let welcomeText = '';
  if (mode === 'corrector') {
    welcomeText = "¡Hola! Soy el Profesor Luis González. Pega tu texto aquí y te ayudaré a perfeccionarlo con correcciones y mejores versiones.";
  } else if (mode === 'grammar') {
    welcomeText = "¡Bienvenido a la sección de Gramática! Pregúntame cualquier duda sobre reglas, verbos o vocabulario español.";
  } else if (mode === 'culture') {
    welcomeText = "¡Bienvenido a Modismos y Cultura! Pregúntame por expresiones de un país (ej: México, España) o refranes sobre un tema.";
  } else if (mode === 'travel') {
    welcomeText = "¡Bienvenido a Viajes y Cultura! Dime qué ciudad o país quieres explorar y crearé una Guía de Inmersión completa para ti.";
  }

  const welcomeDiv = document.createElement('div');
  welcomeDiv.className = 'welcome-message';
  
  const p = document.createElement('p');
  p.textContent = welcomeText;
  welcomeDiv.appendChild(p);

  const speakBtn = document.createElement('button');
  speakBtn.className = 'welcome-speak-btn';
  speakBtn.title = 'Escuchar presentación';
  speakBtn.innerHTML = getPlayIcon(24);
  speakBtn.addEventListener('click', () => {
    speakText(welcomeText, speakBtn);
  });
  welcomeDiv.appendChild(speakBtn);

  messagesContainer.appendChild(welcomeDiv);
}

function updatePlaceholder() {
  if (currentMode === 'corrector') {
    textarea.placeholder = "Escribe tu texto aquí para corregirlo...";
  } else if (currentMode === 'grammar') {
    textarea.placeholder = "Escribe tu duda gramatical aquí...";
  } else if (currentMode === 'culture') {
    textarea.placeholder = "Pídeme modismos, refranes o jerga...";
  } else if (currentMode === 'travel') {
    textarea.placeholder = "Dime una ciudad o país para crear su guía...";
  }
}

/**
 * Handle Translator Logic
 */
async function handleTranslation() {
  const text = transInput.value.trim();
  if (!text || !chatSession) return;

  doTranslateBtn.disabled = true;
  doTranslateBtn.textContent = 'Traduciendo...';
  transOutput.textContent = '...';

  try {
    // Explicitly guide the prompt based on direction
    const directionPrompt = transDirection === 'es-pt' 
      ? `Traduce el siguiente texto del Español al Portugués (Brasil): "${text}"`
      : `Traduce el siguiente texto del Portugués al Español: "${text}"`;

    const result = await chatSession.sendMessage({ message: directionPrompt });
    transOutput.textContent = result.text.trim();
  } catch (error) {
    console.error('Translation error:', error);
    transOutput.textContent = 'Error al traducir. Inténtalo de nuevo.';
  } finally {
    doTranslateBtn.disabled = false;
    doTranslateBtn.textContent = 'Traducir';
  }
}

// Swap Language Handler
swapLangBtn.addEventListener('click', () => {
  transDirection = transDirection === 'es-pt' ? 'pt-es' : 'es-pt';
  
  // Animate swap
  swapLangBtn.style.transform = 'rotate(180deg)';
  setTimeout(() => swapLangBtn.style.transform = 'rotate(0deg)', 200);

  // Update Labels
  if (transDirection === 'es-pt') {
    langSourceLabel.textContent = 'Español';
    langTargetLabel.textContent = 'Portugués';
    transInput.placeholder = 'Escribe en español...';
  } else {
    langSourceLabel.textContent = 'Portugués';
    langTargetLabel.textContent = 'Español';
    transInput.placeholder = 'Escreva em português...';
  }

  // Clear inputs or swap content? Let's just update lang settings
  updateRecognitionLang();
});

/**
 * Auto-resize textarea based on content
 */
function handleTextareaResize() {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  sendBtn.disabled = textarea.value.trim().length === 0;
}

// Icons
function getPlayIcon(size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M15.54 8.46C16.4774 9.39764 17.004 10.6692 17.004 11.995C17.004 13.3208 16.4774 14.5924 15.54 15.53" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19.07 4.93C20.9447 6.80527 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function getStopIcon(size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="currentColor"/>
  </svg>`;
}

/**
 * Text-to-Speech Helper with State Management
 */
let currentSpeakingBtn: HTMLButtonElement | null = null;

function stopSpeaking() {
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  if (currentSpeakingBtn) {
    // Determine icon based on button type
    const isWelcome = currentSpeakingBtn.classList.contains('welcome-speak-btn');
    const isTrans = currentSpeakingBtn.id === 'trans-speak-btn';
    
    if (isTrans) {
       currentSpeakingBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 5L6 9H2V15H6L11 19V5Z"/>
                  <path d="M19.07 4.93C20.9447 6.80527 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07"/>
                  <path d="M15.54 8.46C16.4774 9.39764 17.004 10.6692 17.004 11.995C17.004 13.3208 16.4774 14.5924 15.54 15.53"/>
                </svg>`;
    } else {
       currentSpeakingBtn.innerHTML = getPlayIcon(isWelcome ? 24 : 16);
    }
    
    currentSpeakingBtn.classList.remove('playing');
    currentSpeakingBtn = null;
  }
}

function speakText(text: string, btn: HTMLButtonElement, lang?: string) {
  // If clicking same button while speaking -> Stop
  if (currentSpeakingBtn === btn && window.speechSynthesis.speaking) {
    stopSpeaking();
    return;
  }

  // Stop any previous speech
  stopSpeaking();

  currentSpeakingBtn = btn;
  
  // Set icon to Stop
  const isWelcome = btn.classList.contains('welcome-speak-btn');
  btn.innerHTML = getStopIcon(isWelcome ? 24 : 16);
  btn.classList.add('playing');
  
  // Clean text
  const cleanText = text
    .replace(/\*\*/g, '') // bold
    .replace(/\*/g, '')   // italic
    .replace(/#{1,6}\s?/g, '') // headers
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // links
    .replace(/`/g, '') // code
    .replace(/🗣️|🌎|📖|🧐|💡|💬|🎵|👗|🍲|📍|🗺️|🏰/g, ''); // remove emojis

  const utterance = new SpeechSynthesisUtterance(cleanText);
  
  // Determine language based on mode or override
  if (lang) {
    utterance.lang = lang;
  } else if (currentMode === 'translator') {
    // Speak target language
    utterance.lang = transDirection === 'es-pt' ? 'pt-BR' : 'es-ES';
  } else {
    utterance.lang = 'es-ES';
  }
  
  // Try to pick a voice
  const voices = window.speechSynthesis.getVoices();
  const targetLang = utterance.lang;
  const bestVoice = voices.find(v => v.lang.startsWith(targetLang.split('-')[0]) && v.name.includes('Google')) || 
                    voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));
  
  if (bestVoice) utterance.voice = bestVoice;

  utterance.onend = () => {
    // Reset icon when finished
    if (currentSpeakingBtn === btn) {
      // Restore original icon logic
       const isTrans = btn.id === 'trans-speak-btn';
       if (isTrans) {
          btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 5L6 9H2V15H6L11 19V5Z"/>
                  <path d="M19.07 4.93C20.9447 6.80527 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07"/>
                  <path d="M15.54 8.46C16.4774 9.39764 17.004 10.6692 17.004 11.995C17.004 13.3208 16.4774 14.5924 15.54 15.53"/>
                </svg>`;
       } else {
          btn.innerHTML = getPlayIcon(isWelcome ? 24 : 16);
       }
      btn.classList.remove('playing');
      currentSpeakingBtn = null;
    }
  };

  utterance.onerror = () => {
    stopSpeaking();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Create a message DOM element
 */
function createMessageElement(role: 'user' | 'ai', text: string = '', isTyping = false) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;
  
  const roleDiv = document.createElement('div');
  roleDiv.className = 'message-role';
  
  const nameSpan = document.createElement('span');
  if (role === 'user') {
    nameSpan.textContent = 'Tú';
  } else {
    // Dynamic name based on mode
    if (currentMode === 'travel') {
      nameSpan.textContent = 'Guía de Viajes';
    } else if (currentMode === 'culture') {
      nameSpan.textContent = 'Experto Cultural';
    } else {
      nameSpan.textContent = 'Profesor Luis';
    }
  }
  roleDiv.appendChild(nameSpan);

  // Add Speak button for AI
  if (role === 'ai') {
    const speakBtn = document.createElement('button');
    speakBtn.className = 'speak-btn';
    speakBtn.title = 'Escuchar';
    speakBtn.innerHTML = getPlayIcon(16);
    speakBtn.addEventListener('click', () => {
      const currentText = contentDiv.getAttribute('data-raw-text') || '';
      if (currentText) speakText(currentText, speakBtn);
    });
    roleDiv.appendChild(speakBtn);
  }
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  if (isTyping) {
    contentDiv.innerHTML = `
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
  } else {
    contentDiv.setAttribute('data-raw-text', text);
    contentDiv.innerHTML = marked.parse(text) as string;
  }
  
  msgDiv.appendChild(roleDiv);
  msgDiv.appendChild(contentDiv);
  
  return { msgDiv, contentDiv };
}

/**
 * Render Grounding Metadata (Sources)
 */
function renderGrounding(container: HTMLElement, metadata: any) {
  if (!metadata.groundingChunks || metadata.groundingChunks.length === 0) return;

  const sourcesDiv = document.createElement('div');
  sourcesDiv.className = 'grounding-sources';
  
  const title = document.createElement('h5');
  title.textContent = '🔍 Fuentes y Enlaces';
  sourcesDiv.appendChild(title);

  const list = document.createElement('ul');
  
  // Render Web Sources
  metadata.groundingChunks.forEach((chunk: any) => {
    if (chunk.web) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = chunk.web.uri;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = chunk.web.title || 'Fuente Web';
      li.appendChild(a);
      list.appendChild(li);
    }
    // Render Map Sources if available
    if (chunk.maps) {
        const li = document.createElement('li');
        li.className = 'map-source';
        const a = document.createElement('a');
        a.href = chunk.maps.uri || '#';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = `📍 ${chunk.maps.title || 'Ver en Google Maps'}`;
        li.appendChild(a);
        list.appendChild(li);
    }
  });

  if (list.childElementCount > 0) {
    sourcesDiv.appendChild(list);
    container.appendChild(sourcesDiv);
  }
}

/**
 * Handle form submission
 */
async function handleSubmit(e: Event) {
  e.preventDefault();
  const message = textarea.value.trim();
  if (!message || !chatSession) return;

  textarea.value = '';
  textarea.style.height = 'auto';
  sendBtn.disabled = true;

  if (messagesContainer.classList.contains('empty-state')) {
    messagesContainer.innerHTML = '';
    messagesContainer.classList.remove('empty-state');
  }

  const { msgDiv: userMsg } = createMessageElement('user', message);
  messagesContainer.appendChild(userMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  const { msgDiv: aiMsg, contentDiv: aiContent } = createMessageElement('ai', '', true);
  messagesContainer.appendChild(aiMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const result = await chatSession.sendMessageStream({ message });
    
    let fullText = '';
    let firstChunk = true;
    let finalGroundingMetadata: any = null;

    for await (const chunk of result) {
      if (firstChunk) {
        aiContent.innerHTML = '';
        firstChunk = false;
      }
      
      if (chunk.text) {
        fullText += chunk.text;
        aiContent.innerHTML = marked.parse(fullText) as string;
        aiContent.setAttribute('data-raw-text', fullText);
      }

      if (chunk.candidates?.[0]?.groundingMetadata) {
        finalGroundingMetadata = chunk.candidates[0].groundingMetadata;
      }

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    if (finalGroundingMetadata) {
      renderGrounding(aiContent, finalGroundingMetadata);
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

// Handle Shared Recognition Logic
function startRecognition(targetInput: HTMLTextAreaElement, btn: HTMLButtonElement) {
  if (!recognition || isRecording) return;
  
  updateRecognitionLang(); // Ensure correct lang before starting

  recognition.onstart = () => {
    isRecording = true;
    btn.classList.add('recording');
    targetInput.placeholder = "Escuchando...";
  };

  recognition.onend = () => {
    isRecording = false;
    btn.classList.remove('recording');
    if (targetInput === textarea) handleTextareaResize(); 
    // Restore placeholders
    if (currentMode === 'translator') {
      transInput.placeholder = transDirection === 'es-pt' ? 'Escribe en español...' : 'Escreva em português...';
    } else {
      updatePlaceholder();
    }
  };

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    targetInput.value += (targetInput.value.length > 0 ? ' ' : '') + transcript;
    if (targetInput === textarea) {
        handleTextareaResize();
        sendBtn.disabled = false;
    }
  };

  recognition.start();
}

if (micBtn && recognition) {
  micBtn.addEventListener('click', () => startRecognition(textarea, micBtn));
}

// Translator Specific Listeners
transMicBtn.addEventListener('click', () => {
  if (isRecording) {
    recognition.stop();
  } else {
    startRecognition(transInput, transMicBtn);
  }
});

doTranslateBtn.addEventListener('click', handleTranslation);

transSpeakBtn.addEventListener('click', () => {
  const text = transOutput.textContent;
  if (text) speakText(text, transSpeakBtn);
});

transCopyBtn.addEventListener('click', () => {
  const text = transOutput.textContent;
  if (text) {
    navigator.clipboard.writeText(text);
    // Visual feedback
    const originalIcon = transCopyBtn.innerHTML;
    transCopyBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
    setTimeout(() => transCopyBtn.innerHTML = originalIcon, 1500);
  }
});

// Tab Listeners
tabCorrector.addEventListener('click', () => switchMode('corrector'));
tabGrammar.addEventListener('click', () => switchMode('grammar'));
tabCulture.addEventListener('click', () => switchMode('culture'));
tabTravel.addEventListener('click', () => switchMode('travel'));
tabTranslator.addEventListener('click', () => switchMode('translator'));
tabContact.addEventListener('click', () => switchMode('contact'));

// Initialize app with default mode
switchMode('translator');
window.speechSynthesis.getVoices();
window.speechSynthesis.onvoiceschanged = () => {
  window.speechSynthesis.getVoices();
};
