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
let currentModel = "TinyLlama-1.1B-Chat-v0.4-q4f32_1-MLC"; // Default model

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant that provides detailed and accurate responses.";

// Helper function to update the UI status
function updateStatus(message) {
  const statusElement = document.getElementById('modelStatus');
  if (statusElement) {
    statusElement.textContent = message;
  }
  
  // Update initialization status
  const initStatus = document.getElementById('initStatus');
  if (initStatus) {
    initStatus.textContent = message;
  }
  
  // Update status indicator
  updateStatusIndicator(isModelInitialized);
}

// Update the status indicator based on model state
function updateStatusIndicator(active) {
  const indicator = document.getElementById('statusIndicator');
  if (indicator) {
    if (active) {
      indicator.classList.add('active');
    } else {
      indicator.classList.remove('active');
    }
  }
  
  // Update model version display
  const versionDisplay = document.getElementById('modelVersionDisplay');
  if (versionDisplay) {
    versionDisplay.textContent = active ? currentModel : 'No model loaded';
  }
}

// Helper function to show an error in the response area
function showError(message) {
  const response = document.getElementById('response');
  if (response) {
    response.textContent = `Error: ${message}`;
    response.style.color = 'red';
  }
  
  updateStatus(`Error: ${message}`);
  console.error(message);
}

// Clear WebLLM caches to prevent issues with browser windows
async function clearWebLLMCaches() {
  updateStatus('Clearing WebLLM caches...');
  
  try {
    // Try to clear specific WebLLM-related caches
    if (typeof caches !== 'undefined') {
      const cacheNames = ['mlc-web-llm', 'mlc-web-llm-modelzoo', 'mlc-web-llm-weights'];
      for (const cacheName of cacheNames) {
        try {
          const hasCache = await caches.has(cacheName);
          if (hasCache) {
            await caches.delete(cacheName);
            console.log(`✓ Cleared cache: ${cacheName}`);
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
            console.log(`✓ Cleared cache: ${cacheName}`);
          } catch (e) {
            console.error(`Error clearing cache ${cacheName}:`, e);
          }
        }
      }
    }
    
    updateStatus('Cache clearing complete');
    return true;
  } catch (error) {
    console.error('Error while clearing caches:', error);
    updateStatus(`Error clearing caches: ${error.message}`);
    return false;
  }
}

// Initialize the WebLLM model
async function initializeModel() {
  const initButton = document.getElementById('initButton');
  const progressFill = document.getElementById('progressFill');
  const generateButton = document.getElementById('generateButton');
  const modelSelector = document.getElementById('modelSelector');
  
  if (isModelInitialized) {
    updateStatus('Model already initialized.');
    return;
  }
  
  // Get the selected model
  if (modelSelector) {
    currentModel = modelSelector.value;
  }
  
  try {
    if (initButton) initButton.disabled = true;
    if (modelSelector) modelSelector.disabled = true;
    updateStatus('Initializing model...');
    
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
      if (progressFill) progressFill.style.width = `${percent}%`;
      updateStatus(progressText);
    };
    
    // Create MLCEngine instance with caching enabled
    updateStatus(`Creating engine for ${currentModel}...`);
    engine = new MLCEngine({
      initProgressCallback: initProgressCallback,
      // Use consistent session ID and don't force fresh downloads
      wasmConfig: {
        // Use a session ID based on the model name for better caching
        sessionId: `mlc-session-${currentModel}`,
        // Allow using cached files
        freshDownload: false
      }
    });
    
    updateStatus(`Loading model: ${currentModel}`);
    
    // Load the model (this is an asynchronous operation and can take time)
    await engine.reload(currentModel);
    
    isModelInitialized = true;
    updateStatus(`${currentModel} - Ready`);
    updateStatusIndicator(true);
    
    // Enable generate button
    if (generateButton) generateButton.disabled = false;
    
  } catch (error) {
    showError(`Error initializing model: ${error.message}`);
    
    // Try to provide more helpful error information
    if (error.message.includes('caches')) {
      updateStatus('This appears to be a cache-related issue. Try using an incognito window or clearing your browser cache.');
    } else if (error.message.includes('network')) {
      updateStatus('This appears to be a network-related issue. Check your internet connection and try again.');
    } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
      updateStatus('This appears to be a memory-related issue. Try closing other tabs or applications and try again.');
    }
  } finally {
    if (initButton) initButton.disabled = false;
    if (modelSelector) modelSelector.disabled = false;
  }
}

// Get generation parameters from UI
function getGenerationParams(messages) {
  // Get values from sliders
  const temperature = parseFloat(document.getElementById('temperature')?.value || 0.7);
  const maxTokens = parseInt(document.getElementById('maxTokens')?.value || 500);
  const topP = parseFloat(document.getElementById('topP')?.value || 0.9);
  const streamingEnabled = document.getElementById('streamingEnabled')?.checked ?? true;
  
  return {
    messages: messages,
    temperature: temperature,
    top_p: topP,
    max_tokens: maxTokens,
    stream: streamingEnabled,
    stop: ["</answer>", "Human:", "User:"] // Add stop tokens to prevent over-generation
  };
}

// Generate response from the prompt
async function generateResponse() {
  const generateButton = document.getElementById('generateButton');
  const response = document.getElementById('response');
  const systemPrompt = document.getElementById('systemPrompt');
  const userPrompt = document.getElementById('userPrompt');
  
  // Check if model is initialized
  if (!isModelInitialized || !engine) {
    showError('Model not initialized. Please initialize the model first.');
    return;
  }
  
  // Check if we have input
  if (!userPrompt || userPrompt.value.trim() === '') {
    showError('Please enter a message to process.');
    return;
  }
  
  const systemPromptText = systemPrompt ? systemPrompt.value.trim() : DEFAULT_SYSTEM_PROMPT;
  const userPromptText = userPrompt.value.trim();
  
  try {
    if (generateButton) generateButton.disabled = true;
    if (response) {
      response.textContent = 'Generating...';
      response.style.color = '';
    }
    
    updateStatus('Processing request...');
    
    // Prepare messages for the chat completion
    const messages = [
      { role: "system", content: systemPromptText },
      { role: "user", content: userPromptText }
    ];
    
    console.log('Sending request to model with prompt:', messages);
    
    // Get generation parameters from UI
    const generationParams = getGenerationParams(messages);
    
    // Use streaming to show results as they're generated
    if (response && generationParams.stream) {
      response.textContent = '';
      let responseText = '';
      
      // Create a loading indicator for the streaming response
      const loadingIndicator = document.createElement('div');
      loadingIndicator.style.marginBottom = '10px';
      loadingIndicator.innerHTML = 'Generating<span class="dots">...</span>';
      response.appendChild(loadingIndicator);
      
      // Animate the dots
      let dotsCount = 3;
      const dotsInterval = setInterval(() => {
        const dotsElement = loadingIndicator.querySelector('.dots');
        if (dotsElement) {
          dotsCount = (dotsCount % 3) + 1;
          dotsElement.textContent = '.'.repeat(dotsCount);
        }
      }, 500);
      
      // Start the streaming response
      try {
        // Log generation parameters for debugging
        console.log('Generation parameters:', generationParams);
        
        const stream = await engine.chat.completions.create(generationParams);
        
        // Track the generation speed
        const startTime = Date.now();
        let tokenCount = 0;
        
        // Process each chunk as it arrives
        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices[0]?.delta?.content) {
            const newContent = chunk.choices[0].delta.content;
            responseText += newContent;
            tokenCount++;
            
            // Remove loading indicator once we start getting content
            if (loadingIndicator.parentNode === response) {
              response.removeChild(loadingIndicator);
              clearInterval(dotsInterval);
            }
            
            // Update the response with the current text
            response.textContent = responseText;
          }
        }
        
        // Calculate and log tokens per second
        const elapsedTime = (Date.now() - startTime) / 1000;
        const tokensPerSecond = tokenCount / elapsedTime;
        console.log(`Generation speed: ${tokensPerSecond.toFixed(2)} tokens/second`);
        
        // Ensure loading indicator is removed when complete
        if (loadingIndicator.parentNode === response) {
          response.removeChild(loadingIndicator);
          clearInterval(dotsInterval);
        }
        
        updateStatus(`${currentModel} - Ready`);
      } catch (error) {
        // Clean up on error
        clearInterval(dotsInterval);
        throw error;
      }
    } else {
      // Fallback to non-streaming if streaming is disabled or response element doesn't exist
      const nonStreamingParams = {...generationParams, stream: false};
      
      // Log generation parameters for debugging
      console.log('Non-streaming generation parameters:', nonStreamingParams);
      
      const startTime = Date.now();
      const reply = await engine.chat.completions.create(nonStreamingParams);
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      const generatedResponse = reply.choices[0].message.content;
      if (response) {
        response.textContent = generatedResponse;
      }
      
      // Log generation time
      const tokenCount = reply.usage?.completion_tokens || 0;
      const tokensPerSecond = tokenCount / elapsedTime;
      console.log(`Generation time: ${elapsedTime.toFixed(2)}s for ${tokenCount} tokens (${tokensPerSecond.toFixed(2)} tokens/second)`);
      
      updateStatus(`${currentModel} - Ready`);
    }
    
  } catch (error) {
    showError(`Error generating response: ${error.message}`);
    console.error('Error generating response:', error);
  } finally {
    if (generateButton) generateButton.disabled = false;
  }
}

// Clear the user prompt
function clearUserPrompt() {
  const userPrompt = document.getElementById('userPrompt');
  if (userPrompt) {
    userPrompt.value = '';
    userPrompt.focus();
  }
}

// Reset the system prompt to default
function resetSystemPrompt() {
  const systemPrompt = document.getElementById('systemPrompt');
  if (systemPrompt) {
    systemPrompt.value = DEFAULT_SYSTEM_PROMPT;
  }
}

// Add UI buttons and event handlers
function setupUI() {
  // Reset button
  const resetButton = document.getElementById('resetButton');
  if (resetButton) {
    resetButton.addEventListener('click', function() {
      window.location.reload();
    });
  }
  
  // Reset system prompt link
  const resetPromptLink = document.getElementById('resetPrompt');
  if (resetPromptLink) {
    resetPromptLink.addEventListener('click', resetSystemPrompt);
  }
  
  // Clear user prompt link
  const clearPromptLink = document.getElementById('clearPrompt');
  if (clearPromptLink) {
    clearPromptLink.addEventListener('click', clearUserPrompt);
  }
  
  // Clear cache button
  const clearCacheButton = document.getElementById('clearCacheButton');
  if (clearCacheButton) {
    clearCacheButton.onclick = function() {
      updateStatus('Clearing caches and resetting application...');
      clearWebLLMCaches().then(() => {
        updateStatus('Reset complete. Reloading page...');
        setTimeout(() => window.location.reload(), 1000);
      });
    };
  }
  
  // Model selector
  const modelSelector = document.getElementById('modelSelector');
  if (modelSelector) {
    // Set the initial value to the default model
    modelSelector.value = currentModel;
    
    // When model is changed, reset the status
    modelSelector.addEventListener('change', function() {
      if (isModelInitialized) {
        updateStatus('Model changed. Please initialize the new model.');
        isModelInitialized = false;
        
        const generateButton = document.getElementById('generateButton');
        if (generateButton) generateButton.disabled = true;
        
        updateStatusIndicator(false);
      }
    });
  }
  
  // Setup advanced settings sliders
  setupAdvancedSettings();
}

// Set up advanced settings sliders
function setupAdvancedSettings() {
  // Temperature slider
  const temperatureSlider = document.getElementById('temperature');
  const temperatureValue = document.getElementById('temperatureValue');
  if (temperatureSlider && temperatureValue) {
    temperatureSlider.addEventListener('input', function() {
      temperatureValue.textContent = this.value;
    });
  }
  
  // Max tokens slider
  const maxTokensSlider = document.getElementById('maxTokens');
  const maxTokensValue = document.getElementById('maxTokensValue');
  if (maxTokensSlider && maxTokensValue) {
    maxTokensSlider.addEventListener('input', function() {
      maxTokensValue.textContent = this.value;
    });
  }
  
  // Top P slider
  const topPSlider = document.getElementById('topP');
  const topPValue = document.getElementById('topPValue');
  if (topPSlider && topPValue) {
    topPSlider.addEventListener('input', function() {
      topPValue.textContent = this.value;
    });
  }
}

// Set up event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Set up UI first
  setupUI();
  
  // Initialize button
  const initButton = document.getElementById('initButton');
  if (initButton) {
    initButton.addEventListener('click', initializeModel);
  }
  
  // Generate button
  const generateButton = document.getElementById('generateButton');
  if (generateButton) {
    generateButton.addEventListener('click', generateResponse);
  }
  
  // Add keyboard shortcut for generating (Ctrl+Enter)
  const userPrompt = document.getElementById('userPrompt');
  if (userPrompt) {
    userPrompt.addEventListener('keydown', function(e) {
      // Check if Ctrl+Enter or Cmd+Enter was pressed
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!generateButton.disabled) {
          generateResponse();
        }
      }
    });
  }
  
  // Auto-initialize the model
  updateStatus('Auto-initializing model...');
  updateStatusIndicator(false);
  
  // Delay slightly to allow UI to render
  setTimeout(() => {
    initializeModel().catch(error => {
      showError(`Auto-initialization failed: ${error.message}`);
    });
  }, 500);
}); 