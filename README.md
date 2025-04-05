# WebLLM Text Summarizer

A browser-based application that uses WebLLM to summarize text locally in your browser. This application leverages the TinyLlama model for fast, private text summarization without sending your data to external servers.

## Features

- 🔒 **Privacy-focused**: All processing happens locally in your browser
- ⚡ **Fast processing**: Uses the lightweight TinyLlama model optimized for browsers
- 🌐 **No server required**: Works completely client-side
- 💻 **Cross-browser compatible**: Works in modern browsers with polyfills for cache issues
- 🔄 **Self-contained**: Includes cache management to prevent common issues

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the application:
```bash
npm run build
```

3. Start the development server:
```bash
npm start
```

4. Open your browser and navigate to http://localhost:8080

## Development

For continuous development with automatic rebuilding:
```bash
npm run watch
```

## Usage

1. Click the "Initialize Model" button to download and initialize the WebLLM model
2. Wait for the model to finish loading (progress will be shown in the UI)
3. Enter or paste text in the text area
4. Click "Summarize Text" to generate a summary

## How it Works

This application uses the [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) library to run language models directly in your browser using WebAssembly. The application:

1. Loads the WebLLM engine using ES modules
2. Downloads the TinyLlama-1.1B-Chat-v0.4 model (quantized for browser performance)
3. Processes text inputs through the model to generate summaries
4. Provides real-time progress feedback for model loading and inference

The first time you initialize the model, it will be downloaded to your browser's cache (~450MB). Subsequent uses will load the model from cache, making initialization faster.

## Troubleshooting

If you encounter any issues:

1. **Cache problems**: Use the "Reset Application" button to clear WebLLM caches
2. **Incognito mode**: The application works reliably in incognito/private browsing windows
3. **Browser compatibility**: Make sure your browser supports WebGL2 and WebAssembly
4. **Memory issues**: Close other tabs/applications if you encounter out-of-memory errors
5. **Debug logs**: Check the console output area in the UI for detailed progress and error information

## Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari (WebGPU support in newer versions)
- ❓ Mobile browsers (limited support due to memory constraints)

## License

MIT 