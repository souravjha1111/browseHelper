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
    
    // We won't clear caches anymore - this was preventing reuse
    // await clearWebLLMCaches();
    
    // Set up progress callback
    const initProgressCallback = (progress) => {
      // Handle different progress report formats
      let progressText = '';
      let percent = 0;
      
      if (typeof progress === 'object') {
        // Format depends on the stage of loading
        if (progress.progress && progress.total) {
          // Regular download progress
          percent = Math.round((progress.progress / progress.total) * 100);
          progressText = `Loading progress: ${progress.progress}/${progress.total} (${percent}%)`;
        } else if (progress.text) {
          // Text status update
          progressText = progress.text;
          // Extract percentage if available in the text
          const percentMatch = progress.text.match(/(\d+)%/);
          if (percentMatch) {
            percent = parseInt(percentMatch[1]);
          }
        } else if (progress.type === 'init') {
          // Initialization stage
          progressText = `Initializing: ${progress.text || 'Setting up model'}`;
          percent = progress.progress || 0;
        } else if (progress.type === 'download') {
          // Download stage
          progressText = `Downloading: ${progress.text || ''} - ${Math.round(progress.progress * 100)}%`;
          percent = Math.round(progress.progress * 100);
        } else {
          // Unknown object format - create a meaningful message
          progressText = `Processing: ${JSON.stringify(progress)}`;
          percent = 10; // Default to show some progress
        }
      } else if (typeof progress === 'number' && typeof arguments[1] === 'number') {
        // Classic format with two numeric arguments (progress, total)
        const total = arguments[1];
        percent = total > 0 ? Math.round((progress / total) * 100) : 0;
        progressText = `Loading progress: ${progress}/${total} (${percent}%)`;
      } else {
        // Simple number format
        percent = Math.round(progress * 100);
        progressText = `Loading: ${percent}%`;
      }
      
      // Update UI
      progressFill.style.width = `${percent}%`;
      initStatus.textContent = progressText;
      log(progressText);
    };
    
    // Create MLCEngine instance with caching enabled
    log('Creating MLCEngine instance (using cache if available)...');
    engine = new MLCEngine({
      initProgressCallback: initProgressCallback,
      // Use consistent session ID and don't force fresh downloads
      wasmConfig: {
        // Use the same session ID every time to enable caching
        sessionId: 'mlc-session-fixed',
        // Allow using cached files
        freshDownload: false
      }
    });
    
    // Choose the Qwen2 model
    const modelName = "Qwen2.5-1.5B-Instruct-q4f32_1-MLC";
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
    
    // Display the prompt details to the user
    log('-------------- PROMPT DETAILS --------------');
    log(`System prompt: "${messages[0].content}"`);
    log(`User prompt: "${messages[1].content.substring(0, 50)}${messages[1].content.length > 50 ? '...' : ''}"`);
    log(`Temperature: 0.7, Top-p: 0.9, Max tokens: 2048`);
    log('-------------------------------------------');
    
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
    log('Resetting application...');
    // Don't clear caches, just reload
    setTimeout(() => window.location.reload(), 500);
  };
  
  // Add a separate button for clearing cache if needed
  const clearCacheButton = document.createElement('button');
  clearCacheButton.textContent = 'Clear Cache & Reset';
  clearCacheButton.className = 'btn btn-danger';
  clearCacheButton.style.marginTop = '10px';
  clearCacheButton.style.marginLeft = '10px';
  clearCacheButton.onclick = function() {
    log('Clearing caches and resetting application...');
    clearWebLLMCaches().then(() => {
      log('Reset complete. Reloading page...');
      setTimeout(() => window.location.reload(), 1000);
    });
  };
  
  resetButtonContainer.appendChild(resetButton);
  resetButtonContainer.appendChild(clearCacheButton);
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
  log('Using real WebLLM library with Qwen2 model');
}); 