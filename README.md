# WebLLM Text Summarizer

A simple application that uses WebLLM to summarize text. The application uses the TinyLlama model for fast inference.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to http://localhost:8080

## Usage

1. Click the "Initialize Model" button to download and initialize the WebLLM model
2. Wait for the model to finish loading (progress will be shown)
3. Enter or paste text in the text area
4. Click "Summarize Text" to generate a summary

## How it Works

This application uses the WebLLM library loaded directly from a CDN (https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.78/dist/web-llm.js) to run language models in your browser.

The TinyLlama model is a lightweight model that can run efficiently in browser environments. The first time you initialize the model, it will be downloaded to your browser's cache. Subsequent uses will load the model from cache, making initialization faster.

## Troubleshooting

If you encounter any issues:

1. Check the console output in the browser's developer tools (F12)
2. Make sure your browser supports WebGL and WebAssembly
3. Ensure you have a stable internet connection for the initial model download
4. Try using a different browser if you encounter persistent issues
5. Clear your browser cache if you experience stale data problems 