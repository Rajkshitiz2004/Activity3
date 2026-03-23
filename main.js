// Configuration - API Keys
const CONFIG = {
  OPENROUTER_API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY || "",
  HF_TOKEN: import.meta.env.VITE_HF_TOKEN || "",
  TEXT_MODEL: "google/gemma-3-27b-it:free",
  IMAGE_MODEL: "stabilityai/stable-diffusion-xl-base-1.0"
};

// UI Elements
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const chatModeBtn = document.getElementById('chat-mode');
const imageModeBtn = document.getElementById('image-mode');
const typingIndicator = document.getElementById('typing-indicator');
const modelSelector = document.getElementById('model-selector');

let currentMode = 'chat'; // 'chat' or 'image'

// Initialize
function init() {
  // Auto-resize textarea
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
  });

  // Handle Enter to send
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener('click', handleSend);

  // Mode Toggles
  chatModeBtn.addEventListener('click', () => {
    currentMode = 'chat';
    chatModeBtn.classList.add('active');
    imageModeBtn.classList.remove('active');
    userInput.placeholder = "Message Nova AI...";
  });

  imageModeBtn.addEventListener('click', () => {
    currentMode = 'image';
    imageModeBtn.classList.add('active');
    chatModeBtn.classList.remove('active');
    userInput.placeholder = "Describe the image you want to generate...";
    modelSelector.disabled = true;
    document.querySelector('.input-wrapper').style.borderColor = 'var(--accent-secondary)';
  });

  // Model Selection
  modelSelector.addEventListener('change', (e) => {
    CONFIG.TEXT_MODEL = e.target.value;
    console.log('Text model changed to:', CONFIG.TEXT_MODEL);
  });
}

// API Functions
async function queryAI(data) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      headers: {
        "Authorization": `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin, // Optional but recommended
        "X-Title": "Nova AI Chatbot" // Optional but recommended
      },
      method: "POST",
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter Error: ${errorData.error?.message || response.statusText || 'Unknown Error'}`);
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return { error: error.message };
  }
}

async function generateImage(prompt) {
  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${CONFIG.IMAGE_MODEL}`,
      {
        headers: {
          "Authorization": `Bearer ${CONFIG.HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: prompt }),
      }
    );
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let msg = errorData.error || response.statusText || 'Unknown Error';
        if (response.status === 503 && errorData.estimated_time) {
          msg = `Model is loading. Please try again in about ${Math.round(errorData.estimated_time)} seconds.`;
        }
        throw new Error(`HuggingFace Error: ${msg}`);
    }
    return await response.blob();
  } catch (error) {
    console.error(error);
    if (error.message.includes('Failed to fetch')) {
        return { error: 'Network error or CORS issue. This often happens if the Hugging Face model is currently offline or loading.' };
    }
    return { error: error.message };
  }
}

// UI Helpers
function appendMessage(role, content, isImage = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'bot' ? 'N' : 'U';
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  
  if (isImage) {
    const img = document.createElement('img');
    img.src = content;
    img.className = 'generated-image';
    bubble.appendChild(img);
  } else {
    bubble.textContent = content;
  }
  
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(bubble);
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function handleSend() {
  const text = userInput.value.trim();
  if (!text) return;

  if (!CONFIG.OPENROUTER_API_KEY || !CONFIG.HF_TOKEN) {
    appendMessage('bot', "⚠️ API keys are missing. Please set `OPENROUTER_API_KEY` and `HF_TOKEN` in `main.js` or provide them via settings.");
    return;
  }

  // Clear input
  userInput.value = '';
  userInput.style.height = 'auto';
  
  // Append User message
  appendMessage('user', text);
  
  // Show typing
  typingIndicator.style.display = 'block';
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    if (currentMode === 'chat') {
      const result = await queryAI({
        model: CONFIG.TEXT_MODEL,
        messages: [{ role: "user", content: text }]
      });
      
      typingIndicator.style.display = 'none';
      
      if (result.error) {
        appendMessage('bot', `Error: ${result.error}`);
      } else {
        const reply = result.choices[0].message.content;
        appendMessage('bot', reply);
      }
    } else {
      const blob = await generateImage(text);
      typingIndicator.style.display = 'none';
      
      if (blob.error) {
        appendMessage('bot', `Error: ${blob.error}`);
      } else {
        const imageUrl = URL.createObjectURL(blob);
        appendMessage('bot', "Here's the image you requested:");
        appendMessage('bot', imageUrl, true);
      }
    }
  } catch (error) {
    typingIndicator.style.display = 'none';
    appendMessage('bot', "Something went wrong. Please try again.");
  }
}

init();
