# ⚡ Babel IDE

A modern, fast, and resilient in-browser Python IDE built with **Next.js 15**, **React 19**, **Monaco Editor**, and **Pyodide** (WebAssembly). 

Babel runs Python entirely on the client side with isolated thread execution, interactive `stdin` support, customizable execution timeouts, and hard process termination to prevent infinite loops from freezing the browser.

---

## ✨ Features

- **Client-Side Python (Pyodide 3.14 / WebAssembly)**: Run real Python code directly inside the browser with zero server latency or backend compute requirements.
- **Isolated Web Worker Execution**: Code executes in a background thread via `pyodide-worker.js` — the main UI and editor remain 100% fluid and responsive at all times.
- **True Process Termination (Infinite Loop Protection)**:
  - Configurable execution timeout (`3s`, `5s`, `10s`, `15s`, `30s`).
  - When code exceeds the timeout or when the user clicks **Stop Process**, the worker thread is terminated (`worker.terminate()`), instantly killing synchronous infinite loops (`while True: pass`) without hanging Pyodide or the browser tab.
  - The runtime automatically resets and readies itself for subsequent executions.
- **Standard Input (`stdin`) Support**: Pass interactive inputs into `input()` calls through the dedicated input console.
- **Monaco Editor Integration**: Full-featured code editor with syntax highlighting, line numbers, customizable font sizes, word wrap, and minimap toggles.
- **Responsive Layout**:
  - **Desktop**: Resizable split panels powered by `react-resizable-panels`.
  - **Mobile**: Touch-optimized interface with tabbed editor and console views.
- **Developer Utilities**:
  - Quick example snippets (Fibonacci, Bubble Sort, Infinite Loop safety demo).
  - Download code as `script.py`.
  - Copy code to clipboard.
  - Status bar tracking line counts, character counts, and real-time runtime state.

---

## 📁 Project Structure

```text
babel/
├── app/                          # Next.js App Router
│   ├── globals.css               # Global Tailwind CSS styles and theme variables
│   ├── layout.tsx                # Root layout definition and metadata
│   └── page.tsx                  # Main IDE controller orchestrating worker & UI
│
├── components/                   # React UI Components
│   ├── desktop.tsx               # Desktop layout with resizable editor and panels
│   ├── mobile.tsx                # Mobile-responsive editor and terminal layout
│   ├── header.tsx                # Top navigation, font size & timeout selectors
│   ├── status.tsx                # Bottom status bar with line stats & runtime status
│   ├── monaco.tsx                # Monaco Editor client wrapper with SSR-safe loading
│   └── ui/                       # Reusable UI primitives (Radix UI + Tailwind)
│       ├── badge.tsx
│       ├── button.tsx
│       ├── resizable.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       └── animated-gradient-text.tsx
│
├── hooks/                        # Custom React Hooks
│   ├── usePyodideWorker.ts       # Web Worker controller, timeout timers & termination
│   └── useLocalStorage.ts        # Persistent state synchronization with localStorage
│
├── public/                       # Static Public Assets
│   ├── pyodide-worker.js         # Dedicated Web Worker script running Pyodide
│   └── pyodide/                  # Local Pyodide WebAssembly runtime & stdlib zip
│       ├── pyodide.js
│       ├── pyodide.mjs
│       ├── pyodide.asm.mjs
│       ├── pyodide.asm.wasm
│       ├── pyodide-lock.json
│       └── python_stdlib.zip
│
├── lib/                          # Utility functions
│   └── utils.ts                  # ClassName merging helpers (`clsx`, `tailwind-merge`)
│
├── next.config.ts                # Next.js configuration (Turbopack root setup)
├── package.json                  # Dependencies and scripts
├── postcss.config.mjs            # PostCSS configuration
├── tsconfig.json                 # TypeScript compiler configuration
└── README.md                     # Project documentation
```

---

## 🛠️ Architecture & How It Works

### 1. Web Worker Isolation
When running Python via WebAssembly in a browser, long-running loops or calculations normally freeze JavaScript's main event loop. Babel prevents this by executing all Python code inside a dedicated Web Worker (`public/pyodide-worker.js`).

### 2. Timeout & Process Cancellation
JavaScript's standard `Promise.race([result, setTimeout])` does not interrupt WebAssembly execution. To solve this, [`usePyodideWorker`](file:///Users/anshsharma/Desktop/Projects/ongoing/babel/hooks/usePyodideWorker.ts) implements an active supervision pattern:
1. When code execution starts, a timeout timer is armed.
2. If the user clicks **Stop** or the timeout expires:
   - `worker.terminate()` is called immediately, destroying the OS/browser thread executing Python.
   - A fresh worker is automatically spawned and pre-warmed in the background.
   - The UI displays an informative termination message without losing user code.

### 3. Dual-Source Pyodide Loading
The worker attempts to load Pyodide from local files located in `/public/pyodide/` for optimal offline performance and zero CDN latency. If local files are unavailable, it seamlessly falls back to the official jsDelivr CDN (`cdn.jsdelivr.net/pyodide/v314.0.7/full/`).

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**, **pnpm**, or **yarn**

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/anshxs/babel.git
   cd babel
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## ⌨️ Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> / <kbd>Cmd</kbd> + <kbd>Enter</kbd> | Run code (or Stop if running) |

---

## 📦 Scripts

- `npm run dev` - Run development server with Turbopack
- `npm run build` - Create an optimized production build
- `npm run start` - Start production server

---

## 👨‍💻 Author

Created by [Ansh Sharma](https://github.com/anshxs).
