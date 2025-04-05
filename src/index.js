// Add polyfill for Cache API if not available
if (typeof caches === 'undefined') {
  // Simple in-memory cache polyfill
  window.caches = {
    _stores: {},
    open: async function(name) {
      if (!this._stores[name]) {
        this._stores[name] = {
          _cache: new Map(),
          put: async function(request, response) {
            const url = typeof request === 'string' ? request : request.url;
            console.log(`[Cache Polyfill] Storing: ${url}`);
            this._cache.set(url, response);
            return Promise.resolve();
          },
          match: async function(request) {
            const url = typeof request === 'string' ? request : request.url;
            console.log(`[Cache Polyfill] Checking: ${url}`);
            return this._cache.has(url) ? this._cache.get(url) : undefined;
          },
          delete: async function(request) {
            const url = typeof request === 'string' ? request : request.url;
            console.log(`[Cache Polyfill] Deleting: ${url}`);
            return this._cache.delete(url);
          }
        };
      }
      return this._stores[name];
    },
    has: async function(name) {
      return Promise.resolve(name in this._stores);
    },
    delete: async function(name) {
      delete this._stores[name];
      return Promise.resolve(true);
    }
  };
  console.log('[Cache Polyfill] Implemented in-memory cache polyfill for WebLLM');
}

// Import the MLCEngine directly from the WebLLM library
import { MLCEngine } from "@mlc-ai/web-llm";

// Store the model instance
let engine = null;
let isModelInitialized = false;

// Helper function to log messages
function log(message) {
  console.log(message);
  const output = document.getElementById('output');
  if (output) {
    output.textContent += message + '\n';
    output.scrollTop = output.scrollHeight;
  }
}

// Log errors to both console and UI
window.addEventListener('error', function(event) {
  console.error('Error:', event.error);
  log(`ERROR: ${event.error.message}`);
});

// Clear WebLLM caches to prevent issues with normal browser windows
async function clearWebLLMCaches() {
  log('Attempting to clear WebLLM caches...');
  
  try {
    // Try to clear specific WebLLM-related caches
    if (typeof caches !== 'undefined') {
      const cacheNames = ['mlc-web-llm', 'mlc-web-llm-modelzoo', 'mlc-web-llm-weights'];
      for (const cacheName of cacheNames) {
        try {
          const hasCache = await caches.has(cacheName);
          if (hasCache) {
            await caches.delete(cacheName);
            log(`✓ Cleared cache: ${cacheName}`);
          }
        } catch (e) {
          console.error(`Error clearing cache ${cacheName}:`, e);
        }
      }
      
      // Try to clear all caches as a fallback
      const allCacheNames = await caches.keys();
      for (const cacheName of allCacheNames) {
        if (cacheName.includes('mlc') || cacheName.includes('llm') || cacheName.includes('model')) {
          try {
            await caches.delete(cacheName);
            log(`✓ Cleared cache: ${cacheName}`);
          } catch (e) {
            console.error(`Error clearing cache ${cacheName}:`, e);
          }
        }
      }
    }
    
    log('Cache clearing complete.');
    return true;
  } catch (error) {
    console.error('Error while clearing caches:', error);
    log(`Error clearing caches: ${error.message}`);
    return false;
  }
}

// Initialize the WebLLM model
async function initializeModel() {
  const initButton = document.getElementById('initButton');
  const progressFill = document.getElementById('progressFill');
  const initStatus = document.getElementById('initStatus');
  const summarizeButton = document.getElementById('summarizeButton');
  
  if (isModelInitialized) {
    log('Model already initialized.');
    return;
  }
  
  try {
    initButton.disabled = true;
    initStatus.textContent = 'Initializing model...';
    log('Initializing WebLLM model...');
    
    // Clear caches first to prevent issues with normal browser windows
    await clearWebLLMCaches();
    
    // Set up progress callback
    const initProgressCallback = (progress, total) => {
      const percent = total > 0 ? Math.round((progress / total) * 100) : 0;
      progressFill.style.width = `${percent}%`;
      initStatus.textContent = `Loading model: ${percent}%`;
      log(`Loading progress: ${progress}/${total} (${percent}%)`);
    };
    
    // Create MLCEngine instance with caching disabled
    log('Creating MLCEngine instance...');
    engine = new MLCEngine({
      initProgressCallback: initProgressCallback,
      // Add specific configuration to handle cache issues
      wasmConfig: {
        // Use a unique session ID to avoid cache conflicts
        sessionId: `mlc-session-${Date.now()}`,
        // Prefer fresh downloads over cached data
        freshDownload: true
      }
    });
    
    // Choose a smaller model for faster loading
    const modelName = "TinyLlama-1.1B-Chat-v0.4-q4f32_1-MLC";
    log(`Loading model: ${modelName}`);
    
    // Load the model (this is an asynchronous operation and can take time)
    await engine.reload(modelName);
    
    isModelInitialized = true;
    initStatus.textContent = 'Model initialized successfully!';
    log('Model initialized successfully!');
    
    // Enable summarize button
    summarizeButton.disabled = false;
    
  } catch (error) {
    initStatus.textContent = `Error: ${error.message}`;
    log(`Error initializing model: ${error.message}`);
    console.error('Error initializing model:', error);
    
    // Try to provide more helpful error information
    if (error.message.includes('caches')) {
      log('This appears to be a cache-related issue. Try using an incognito window or clearing your browser cache.');
    } else if (error.message.includes('network')) {
      log('This appears to be a network-related issue. Check your internet connection and try again.');
    } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
      log('This appears to be a memory-related issue. Try closing other tabs or applications and try again.');
    }
  } finally {
    initButton.disabled = false;
  }
}

// Summarize the provided text
async function summarizeText() {
  const summarizeButton = document.getElementById('summarizeButton');
  const inputText = document.getElementById('inputText');
  const summary = document.getElementById('summary');
  
  if (!isModelInitialized || !engine) {
    log('Model not initialized. Please initialize the model first.');
    summary.textContent = 'Error: Model not initialized. Please initialize the model first.';
    return;
  }
  
  const text = inputText.value.trim();
  if (!text) {
    log('Please enter text to summarize.');
    summary.textContent = 'Error: Please enter text to summarize.';
    return;
  }
  
  try {
    summarizeButton.disabled = true;
    summary.textContent = 'Generating summary...';
    log('Generating summary...');
    
    // Prepare messages for the chat completion
    const messages = [
      { role: "system", content: "You are a helpful AI assistant that provides concise summaries." },
      { role: "user", content: `Please summarize the following text in 3-4 sentences:\n\n${text}` }
    ];
    
    log('Sending request to model...');
    
    // Use the chat completions API as shown in the documentation
    const reply = await engine.chat.completions.create({
      messages: messages,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 2048
    });
    
    // Extract the generated summary from the response
    const generatedSummary = reply.choices[0].message.content;
    summary.textContent = generatedSummary;
    
    // Log usage statistics
    log(`Summary generated successfully! Tokens used: ${JSON.stringify(reply.usage)}`);
    
  } catch (error) {
    summary.textContent = `Error: ${error.message}`;
    log(`Error generating summary: ${error.message}`);
    console.error('Error generating summary:', error);
  } finally {
    summarizeButton.disabled = false;
  }
}

// Add a button to reset everything (in case of issues)
function addResetButton() {
  const container = document.querySelector('.container');
  if (!container) return;
  
  const resetButtonContainer = document.createElement('div');
  resetButtonContainer.style.marginTop = '20px';
  resetButtonContainer.style.textAlign = 'center';
  
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset Application';
  resetButton.className = 'btn btn-warning';
  resetButton.style.marginTop = '10px';
  resetButton.onclick = function() {
    log('Resetting application and clearing caches...');
    clearWebLLMCaches().then(() => {
      log('Reset complete. Reloading page...');
      setTimeout(() => window.location.reload(), 1000);
    });
  };
  
  resetButtonContainer.appendChild(resetButton);
  container.appendChild(resetButtonContainer);
}

// Set up event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize button
  const initButton = document.getElementById('initButton');
  if (initButton) {
    initButton.addEventListener('click', initializeModel);
  }
  
  // Summarize button
  const summarizeButton = document.getElementById('summarizeButton');
  if (summarizeButton) {
    summarizeButton.addEventListener('click', summarizeText);
  }
  
  // Add reset button to help with browser cache issues
  addResetButton();
  
  log('WebLLM Text Summarizer loaded. Click "Initialize Model" to start.');
  log('Using real WebLLM library with TinyLlama model');
}); 