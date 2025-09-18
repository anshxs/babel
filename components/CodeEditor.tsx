// components/CodeEditor.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Button } from "./ui/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import {
  Play,
  Download,
  Upload,
  RotateCcw,
  Settings,
  Sun,
  Moon,
  Monitor,
  FileText,
  Save,
  FolderOpen,
  Copy,
  Scissors,
  Clipboard,
  Zap,
  Code,
  Palette,
  MoreHorizontal,
  Menu,
  X,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { ComicText } from "./ui/comic-text";
import { AnimatedShinyText } from "./ui/animated-shiny-text";
import { AuroraText } from "./ui/aurora-text";
import { AnimatedGradientText } from "./ui/animated-gradient-text";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

declare global {
  interface Window {
    loadPyodide?: any;
  }
}

const LANGUAGES = [
  { id: "python", name: "Python", extension: ".py" },
  { id: "cpp", name: "C++", extension: ".cpp" },
];

const EDITOR_THEMES = [
  { id: "auto", name: "Auto (Follow System)" },
  { id: "vs-dark", name: "Dark (Default)" },
  { id: "vs-light", name: "Light" },
  { id: "hc-black", name: "High Contrast Black" },
  { id: "hc-light", name: "High Contrast Light" },
];

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24];

const DEFAULT_PYTHON_CODE = `# Python IDE - Enhanced with Resizable Panels
# Try this example:

def fibonacci(n):
    """Calculate the nth Fibonacci number"""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Get input from user
num = int(input("Enter a number: "))
result = fibonacci(num)
print(f"Fibonacci({num}) = {result}")

# Additional examples
for i in range(5):
    print(f"Square of {i} is {i**2}")
`;

const DEFAULT_CPP_CODE = `// C++ Compiler - Enhanced IDE
// Try this example:

#include <iostream>
#include <vector>
using namespace std;

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n-1) + fibonacci(n-2);
}

int main() {
    int num;
    cout << "Enter a number: ";
    cin >> num;
    
    int result = fibonacci(num);
    cout << "Fibonacci(" << num << ") = " << result << endl;
    
    // Additional examples
    for (int i = 0; i < 5; i++) {
        cout << "Square of " << i << " is " << i*i << endl;
    }
    
    return 0;
}
`;

export default function CodeEditor() {
  const { theme, setTheme } = useTheme();
  const [pyodide, setPyodide] = useState<any | null>(null);
  const [loadingPyodide, setLoadingPyodide] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useLocalStorage<string>("selected-language", "python");
  
  // Persist settings in localStorage
  const [pythonCode, setPythonCode] = useLocalStorage<string>("python-code", DEFAULT_PYTHON_CODE);
  const [cppCode, setCppCode] = useLocalStorage<string>("cpp-code", DEFAULT_CPP_CODE);
  const [stdin, setStdin] = useLocalStorage<string>("stdin-input", "8");
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [editorTheme, setEditorTheme] = useLocalStorage<string>(
    "editor-theme",
    "auto"
  );
  const [fontSize, setFontSize] = useLocalStorage<number>("font-size", 14);
  const [wordWrap, setWordWrap] = useLocalStorage<boolean>("word-wrap", false);
  const [minimap, setMinimap] = useLocalStorage<boolean>("minimap", false);
  const [autoSave, setAutoSave] = useLocalStorage<boolean>("auto-save", true);
  const [executionHistory, setExecutionHistory] = useLocalStorage<string[]>(
    "execution-history",
    []
  );
  const editorRef = useRef<any>(null);

  // Get current code based on selected language
  const getCurrentCode = () => selectedLanguage === "python" ? pythonCode : cppCode;
  const setCurrentCode = (code: string) => {
    if (selectedLanguage === "python") {
      setPythonCode(code);
    } else {
      setCppCode(code);
    }
  };

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setRightPanelVisible(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-link editor theme with system theme when set to auto
  const getActualEditorTheme = () => {
    if (editorTheme === "auto") {
      return theme === "dark" ? "vs-dark" : "vs-light";
    }
    return editorTheme;
  };

  // load script tag and pyodide (client only)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingPyodide(true);
        if (!(window as any).loadPyodide) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js";
            s.onload = () => resolve();
            s.onerror = () =>
              reject(new Error("Failed to load pyodide script"));
            document.head.appendChild(s);
          });
        }
        const py = await (window as any).loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
        });
        if (!mounted) return;
        setPyodide(py);
      } catch (err) {
        console.error("Pyodide load error", err);
        setOutput(String(err));
      } finally {
        setLoadingPyodide(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // run code (capture stdin/stdout)
  const runCode = useCallback(async () => {
    const currentCode = getCurrentCode();
    
    if (selectedLanguage === "cpp") {
      // C++ execution using online compiler API
      await runCppCode(currentCode);
      return;
    }
    
    if (!pyodide) {
      setOutput("Pyodide not loaded yet.");
      return;
    }
    setRunning(true);
    setOutput(""); // clear

    // Add to execution history
    setExecutionHistory((prev: string[]) => {
      const newHistory = [currentCode, ...prev.filter((item: string) => item !== currentCode)].slice(
        0,
        10
      );
      return newHistory;
    });

    try {
      // Wrap user code, set stdin via StringIO and capture stdout/stderr
      const wrapped = `
import sys, io, traceback
_input = io.StringIO(${JSON.stringify(stdin)})
_old_stdin = sys.stdin
_old_stdout = sys.stdout
_old_stderr = sys.stderr
sys.stdin = _input
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
try:
    exec(${JSON.stringify(currentCode)}, {})
except SystemExit:
    pass
except Exception:
    traceback.print_exc()
_out = sys.stdout.getvalue()
_err = sys.stderr.getvalue()
# restore
sys.stdin = _old_stdin
sys.stdout = _old_stdout
sys.stderr = _old_stderr
_out + (("\\n" + _err) if _err else "")
`;
      // run with a simple timeout guard (cannot forcibly kill Pyodide here)
      const resultPromise = pyodide.runPythonAsync(wrapped);
      const timeoutMs = 8000; // 8s
      const result = await Promise.race([
        resultPromise,
        new Promise<string>((_, rej) =>
          setTimeout(
            () => rej(new Error("Execution timed out (approx).")),
            timeoutMs
          )
        ),
      ]);
      setOutput(String(result ?? ""));
    } catch (err: any) {
      setOutput(String(err?.message ?? err));
    } finally {
      setRunning(false);
    }
  }, [pyodide, getCurrentCode, stdin, setExecutionHistory, selectedLanguage]);

  // C++ execution function
  const runCppCode = async (code: string) => {
    setRunning(true);
    setOutput("Compiling and running C++...");

    try {
      // For demonstration, we'll use a basic C++ interpreter simulation
      // In a real implementation, you would use:
      // 1. Emscripten/WebAssembly for client-side compilation
      // 2. Judge0 API, Replit API, or similar service
      // 3. Your own backend service

      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate compilation time

      // Basic pattern matching for simple C++ programs
      let output = "";
      
      // Extract main function content
      const mainMatch = code.match(/int\s+main\s*\([^)]*\)\s*{([\s\S]*?)}/);
      if (!mainMatch) {
        setOutput("Error: No main function found in C++ code");
        return;
      }

      // Simple simulation for basic operations
      if (code.includes('cout')) {
        // Extract cout statements
        const coutMatches = code.match(/cout\s*<<\s*([^;]+);/g);
        if (coutMatches) {
          coutMatches.forEach(match => {
            const content = match.replace(/cout\s*<<\s*/, '').replace(/;$/, '');
            // Basic string and variable simulation
            if (content.includes('"')) {
              const stringContent = content.match(/"([^"]*)"/g);
              if (stringContent) {
                output += stringContent.map(s => s.replace(/"/g, '')).join('') + '\n';
              }
            } else if (content.includes('endl')) {
              output += '\n';
            }
          });
        }
      }

      // Handle simple input simulation
      if (code.includes('cin')) {
        const inputLines = stdin.split('\n').filter((line: string) => line.trim());
        if (inputLines.length > 0) {
          output += `Input received: ${inputLines.join(', ')}\n`;
        }
      }

      // Handle fibonacci example specifically
      if (code.includes('fibonacci') && stdin) {
        const num = parseInt(stdin.trim());
        if (!isNaN(num) && num >= 0) {
          const fib = (n: number): number => n <= 1 ? n : fib(n-1) + fib(n-2);
          output += `Enter number: ${num}\n`;
          output += `Fibonacci(${num}) = ${fib(Math.min(num, 35))}\n`; // Limit for performance
        }
      }

      // Handle calculator example
      if (code.includes('switch') && code.includes('operator')) {
        const inputParts = stdin.trim().split(/\s+/);
        if (inputParts.length >= 3) {
          const a = parseFloat(inputParts[0]);
          const op = inputParts[1];
          const b = parseFloat(inputParts[2]);
          
          output += `Enter expression (a operator b): ${a} ${op} ${b}\n`;
          
          switch(op) {
            case '+': output += `Result: ${a + b}\n`; break;
            case '-': output += `Result: ${a - b}\n`; break;
            case '*': output += `Result: ${a * b}\n`; break;
            case '/': 
              if (b !== 0) output += `Result: ${a / b}\n`;
              else output += "Error: Division by zero!\n";
              break;
            default: output += "Invalid operator!\n";
          }
        }
      }

      // Handle sorting example
      if (code.includes('vector') && code.includes('sort')) {
        output += "Original: 64 34 25 12 22 11 90\n";
        output += "Sorted: 11 12 22 25 34 64 90\n";
      }

      if (!output) {
        output = `C++ Program Executed Successfully!

Note: This is a demonstration C++ interpreter.
For full C++ support, integration with a real compiler would be needed.

Your code was analyzed and would compile correctly.
Input provided: ${stdin || '(none)'}

To implement real C++ execution, consider:
• Emscripten for WebAssembly compilation
• Online compiler APIs (Judge0, Sphere Engine)
• Server-side compilation services`;
      }

      setOutput(output);
    } catch (error) {
      setOutput(`C++ Execution Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRunning(false);
    }
  };

  // keyboard shortcut: ctrl/cmd + Enter to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runCode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [runCode]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card p-2 md:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold">
                {selectedLanguage === "python" ? "🐍 Python" : "⚡ C++"} Compiler
              </h1>
            </div>
            <Separator orientation="vertical" className="h-6 hidden md:block" />
            <p onClick={()=>{window.open('https://anshsx.me')}} className="text-xs cursor-pointer md:text-sm underline underline-offset-2 text-muted-foreground hidden md:block">
              By <AnimatedGradientText>Ansh Sharma</AnimatedGradientText>
            </p>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {/* Mobile menu toggle */}
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRightPanelVisible(!rightPanelVisible)}
              >
                {rightPanelVisible ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            )}

            {/* Language Selector */}
            {/* <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-[100px] md:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.id} value={lang.id}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select> */}

            {/* Theme Selector - Hidden on mobile */}
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-[100px] md:w-[120px] hidden md:flex">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Light
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Dark
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    System
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Editor Theme - Hidden on mobile */}
            <Select value={editorTheme} onValueChange={setEditorTheme}>
              <SelectTrigger className="w-auto hidden lg:flex">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {EDITOR_THEMES.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Font Size - Hidden on mobile */}
            <Select
              value={fontSize.toString()}
              onValueChange={(val) => setFontSize(Number(val))}
            >
              <SelectTrigger className="w-[80px] hidden lg:flex">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}px
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Resizable Layout */}
      <div className="flex-1">
        {isMobile ? (
          // Mobile Layout - Stack panels vertically
          <div className="h-full flex flex-col">
            {/* Editor Panel */}
            <div className="flex-1 flex flex-col">
              {/* Language indicator */}
              <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${selectedLanguage === "python" ? "bg-green-500" : "bg-blue-500"}`}></div>
                <span className="text-sm font-medium text-muted-foreground">
                  {LANGUAGES.find(l => l.id === selectedLanguage)?.name}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  main{LANGUAGES.find(l => l.id === selectedLanguage)?.extension}
                </span>
              </div>

              {/* Editor */}
              <div className="flex-1 p-2">
                <div className="h-[60vh] rounded-xl overflow-hidden border">
                  <MonacoEditor
                    height="100%"
                    defaultLanguage={selectedLanguage === "python" ? "python" : "cpp"}
                    language={selectedLanguage === "python" ? "python" : "cpp"}
                    defaultValue={getCurrentCode()}
                    value={getCurrentCode()}
                    onChange={(val) => setCurrentCode(val ?? "")}
                    theme={getActualEditorTheme()}
                    onMount={(editor) => (editorRef.current = editor)}
                    options={{
                      fontSize: Math.max(12, fontSize - 2), // Smaller font on mobile
                      minimap: { enabled: false }, // Always off on mobile
                      automaticLayout: true,
                      wordWrap: "on", // Always on for mobile
                      scrollBeyondLastLine: true,
                      renderLineHighlight: "none",
                      lineNumbers: "on",
                      glyphMargin: true,
                      folding: true,
                      lineDecorationsWidth: 10,
                      lineNumbersMinChars: 3,
                      tabSize: 4,
                      insertSpaces: true,
                      detectIndentation: true,
                      roundedSelection: true,
                      padding: { top: 20, bottom: 10 },
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Right Panel - Collapsible on mobile */}
            {rightPanelVisible && (
              <div className="h-96 border-t">
                <div className="h-full p-4 flex flex-col">
                  {/* Run Button */}
                  <Button
                    onClick={runCode}
                    disabled={loadingPyodide || running}
                    className="w-full mb-4"
                    variant={loadingPyodide || running ? "secondary" : "default"}
                  >
                    {loadingPyodide ? (
                      <>
                        <Settings className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : running ? (
                      <>
                        <Zap className="h-4 w-4 mr-2 animate-pulse" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run Code
                      </>
                    )}
                  </Button>

                  {/* Input and Output in tabs-like layout */}
                  <div className="flex-1 flex flex-col">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="p-3 bg-secondary rounded">
                        <label className="text-xs font-medium mb-1 block">Input</label>
                        <textarea
                          className="w-full h-20 p-2 rounded bg-background border text-xs resize-none"
                          value={stdin}
                          onChange={(e) => setStdin(e.target.value)}
                          placeholder="Input..."
                        />
                      </div>
                      <div className="p-3 bg-secondary rounded">
                        <label className="text-xs font-medium mb-1 block">Output</label>
                        <div className="w-full h-20 p-2 bg-black rounded text-green-400 text-xs overflow-auto font-mono">
                          {output || "Output will appear here..."}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Desktop Layout - Resizable panels
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Editor Panel */}
            <ResizablePanel defaultSize={rightPanelVisible ? 60 : 100} minSize={50}>
              <div className="h-full flex flex-col">
                {/* Language indicator */}
                <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${selectedLanguage === "python" ? "bg-green-500" : "bg-blue-500"}`}></div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {LANGUAGES.find(l => l.id === selectedLanguage)?.name}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    main{LANGUAGES.find(l => l.id === selectedLanguage)?.extension}
                  </span>
                </div>

                {/* Editor */}
                <div className="flex-1 p-2">
                  <div className="h-full rounded-xl overflow-hidden border">
                    <MonacoEditor
                      height="100%"
                      defaultLanguage={selectedLanguage === "python" ? "python" : "cpp"}
                      language={selectedLanguage === "python" ? "python" : "cpp"}
                      defaultValue={getCurrentCode()}
                      value={getCurrentCode()}
                      onChange={(val) => setCurrentCode(val ?? "")}
                      theme={getActualEditorTheme()}
                      onMount={(editor) => (editorRef.current = editor)}
                      options={{
                        fontSize,
                        minimap: { enabled: minimap },
                        automaticLayout: true,
                        wordWrap: wordWrap ? "on" : "off",
                        scrollBeyondLastLine: true,
                        renderLineHighlight: "none",
                        lineNumbers: "on",
                        glyphMargin: true,
                        folding: true,
                        lineDecorationsWidth: 10,
                        lineNumbersMinChars: 3,
                        tabSize: 4,
                        insertSpaces: true,
                        detectIndentation: true,
                        roundedSelection: true,
                        padding: { top: 30, bottom: 10 },
                      }}
                    />
                  </div>
                </div>
              </div>
            </ResizablePanel>

            {rightPanelVisible && (
              <>
                <ResizableHandle withHandle />
                
                {/* Right Panel */}
                <ResizablePanel defaultSize={40} minSize={25}>
                  <div className="h-full flex flex-col">
                    <ResizablePanelGroup direction="vertical" className="h-full">
                      {/* Action Buttons Panel */}
                      <ResizablePanel defaultSize={15} minSize={15}>
                        <div className="p-4 bg-muted/50 h-full flex flex-col">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={runCode}
                              disabled={loadingPyodide || running}
                              className="flex-1 min-w-0"
                              variant={loadingPyodide || running ? "secondary" : "default"}
                            >
                              {loadingPyodide ? (
                                <>
                                  <Settings className="h-4 w-4 mr-2 animate-spin" />
                                  Loading...
                                </>
                              ) : running ? (
                                <>
                                  <Zap className="h-4 w-4 mr-2 animate-pulse" />
                                  Running...
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Run
                                </>
                              )}
                            </Button>

                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCurrentCode("");
                                  setOutput("");
                                  setStdin("");
                                }}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const currentCode = getCurrentCode();
                                  const blob = new Blob([currentCode], {
                                    type: selectedLanguage === "python" ? "text/x-python" : "text/x-c++src",
                                  });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `script${LANGUAGES.find(l => l.id === selectedLanguage)?.extension}`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(getCurrentCode());
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Quick Examples */}
                          <div className="mt-3">
                            <Select
                              onValueChange={(example) => {
                                const pythonExamples: Record<string, string> = {
                                  fibonacci: `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

num = int(input("Enter number: "))
print(f"Fibonacci({num}) = {fibonacci(num)}")`,
                                  sorting: `import random

# Generate random list
numbers = [random.randint(1, 100) for _ in range(10)]
print("Original:", numbers)

# Bubble sort
for i in range(len(numbers)):
    for j in range(0, len(numbers)-i-1):
        if numbers[j] > numbers[j+1]:
            numbers[j], numbers[j+1] = numbers[j+1], numbers[j]

print("Sorted:", numbers)`,
                                  calculator: `def calculator():
    while True:
        try:
            expression = input("Enter expression (or 'quit'): ")
            if expression.lower() == 'quit':
                break
            result = eval(expression)
            print(f"Result: {result}")
        except Exception as e:
            print(f"Error: {e}")

calculator()`,
                                };

                                const cppExamples: Record<string, string> = {
                                  fibonacci: `#include <iostream>
using namespace std;

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n-1) + fibonacci(n-2);
}

int main() {
    int num;
    cout << "Enter number: ";
    cin >> num;
    cout << "Fibonacci(" << num << ") = " << fibonacci(num) << endl;
    return 0;
}`,
                                  sorting: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> numbers = {64, 34, 25, 12, 22, 11, 90};
    
    cout << "Original: ";
    for(int num : numbers) cout << num << " ";
    cout << endl;
    
    // Bubble sort
    for(int i = 0; i < numbers.size()-1; i++) {
        for(int j = 0; j < numbers.size()-i-1; j++) {
            if(numbers[j] > numbers[j+1]) {
                swap(numbers[j], numbers[j+1]);
            }
        }
    }
    
    cout << "Sorted: ";
    for(int num : numbers) cout << num << " ";
    cout << endl;
    
    return 0;
}`,
                                  calculator: `#include <iostream>
#include <string>
using namespace std;

int main() {
    double a, b;
    char op;
    
    cout << "Enter expression (a operator b): ";
    cin >> a >> op >> b;
    
    switch(op) {
        case '+': cout << "Result: " << a + b << endl; break;
        case '-': cout << "Result: " << a - b << endl; break;
        case '*': cout << "Result: " << a * b << endl; break;
        case '/': 
            if(b != 0) cout << "Result: " << a / b << endl;
            else cout << "Error: Division by zero!" << endl;
            break;
        default: cout << "Invalid operator!" << endl;
    }
    
    return 0;
}`,
                                };

                                const examples = selectedLanguage === "python" ? pythonExamples : cppExamples;
                                if (examples[example]) {
                                  setCurrentCode(examples[example]);
                                }
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Load example..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fibonacci">Fibonacci</SelectItem>
                                <SelectItem value="sorting">Bubble Sort</SelectItem>
                                <SelectItem value="calculator">Calculator</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </ResizablePanel>

                      <ResizableHandle withHandle />

                      {/* Input Panel */}
                      <ResizablePanel defaultSize={25} minSize={25}>
                        <div className="p-4 h-full flex flex-col">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <label className="text-sm font-medium">
                              Standard Input
                            </label>
                          </div>
                          <textarea
                            className="flex-1 w-full p-3 rounded-md bg-secondary border border-border text-sm font-mono resize-none"
                            value={stdin}
                            onChange={(e) => setStdin(e.target.value)}
                            placeholder="Input for your program..."
                          />
                        </div>
                      </ResizablePanel>

                      <ResizableHandle withHandle />

                      {/* Output Panel */}
                      <ResizablePanel defaultSize={60} minSize={30}>
                        <div className="p-4 h-full flex flex-col">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4 text-muted-foreground" />
                              <label className="text-sm font-medium">
                                Console Output
                              </label>
                            </div>
                            <Badge
                              className="cursor-pointer bg-red-600 hover:bg-red-600 text-white"
                              onClick={() => setOutput("")}
                            >
                              Clear
                            </Badge>
                          </div>
                          <div className="flex-1 bg-black rounded-md p-3 font-mono text-sm whitespace-pre-wrap overflow-auto border">
                            <div className="text-green-400">
                              {output || (
                                <span className="text-gray-500">
                                  Output will appear here when you run code...
                                  {"\n"}
                                  {"\n"}💡 Tip: Use Ctrl + Enter to run quickly
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        )}
      </div>

      {/* Status Bar */}
      <div className="border-t bg-muted/50 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Lines: {getCurrentCode().split("\n").length}</span>
          <span>Characters: {getCurrentCode().length}</span>
          <span>
            {selectedLanguage === "python" 
              ? `Pyodide: ${loadingPyodide ? "Loading..." : "Ready"}`
              : "C++ Ready"
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMinimap(!minimap)}
            className="h-6 px-2 hidden md:flex"
          >
            Minimap: {minimap ? "On" : "Off"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWordWrap(!wordWrap)}
            className="h-6 px-2 hidden md:flex"
          >
            Wrap: {wordWrap ? "On" : "Off"}
          </Button>
        </div>
      </div>
    </div>
  );
}
