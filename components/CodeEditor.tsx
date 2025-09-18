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
  BarChart3,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { ComicText } from "./ui/comic-text";
import { AnimatedShinyText } from "./ui/animated-shiny-text";
import { AuroraText } from "./ui/aurora-text";
import { AnimatedGradientText } from "./ui/animated-gradient-text";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

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

export default function CodeEditor() {
  const { theme, setTheme } = useTheme();
  const [pyodide, setPyodide] = useState<any | null>(null);
  const [loadingPyodide, setLoadingPyodide] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);

  // Language state
  const [selectedLanguage] = useState<string>("python");
  
  // Persist settings in localStorage
  const [pythonCode, setPythonCode] = useLocalStorage<string>("python-code", DEFAULT_PYTHON_CODE);
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
  const [complexityDialogOpen, setComplexityDialogOpen] = useState(false);
  const editorRef = useRef<any>(null);

  // Get current code - simplified since only Python is supported
  const getCurrentCode = () => pythonCode;
  const setCurrentCode = (code: string) => {
    setPythonCode(code);
  };

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // On mobile, always show the right panel
      if (mobile) {
        setRightPanelVisible(true);
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
  }, [pyodide, getCurrentCode, stdin, setExecutionHistory]);

  // Complexity analysis function
  const analyzeComplexity = useCallback((code: string) => {
    try {
      let complexity = "O(1)";
      let description = "Constant time - basic operations";
      let details: string[] = [];

      // Analyze nested loops
      const nestedLoops = analyzeNestedLoops(code);
      const recursion = analyzeRecursion(code);
      const dataStructures = analyzeDataStructures(code);

      if (recursion.hasRecursion) {
        if (recursion.type === "fibonacci" || recursion.type === "exponential") {
          complexity = "O(2^n)";
          description = "Exponential time - exponential growth with input";
          details.push("Recursive function with multiple calls per recursion");
          details.push("Consider using dynamic programming for optimization");
        } else if (recursion.type === "linear") {
          complexity = "O(n)";
          description = "Linear time - single recursive call";
          details.push("Linear recursion detected");
        } else if (recursion.type === "factorial") {
          complexity = "O(n!)";
          description = "Factorial time - extremely slow for large inputs";
          details.push("Factorial algorithm detected");
        }
      } else if (nestedLoops.count >= 3) {
        complexity = "O(n³)";
        description = "Cubic time - three nested loops";
        details.push(`${nestedLoops.count} levels of nested loops detected`);
      } else if (nestedLoops.count === 2) {
        complexity = "O(n²)";
        description = "Quadratic time - two nested loops";
        details.push("Nested loops detected - quadratic growth");
      } else if (nestedLoops.count === 1) {
        complexity = "O(n)";
        description = "Linear time - single loop";
        details.push("Single loop detected - linear growth");
      }

      // Check for sorting algorithms
      if (code.includes("sort(") || code.includes(".sort")) {
        complexity = "O(n log n)";
        description = "Linearithmic time - efficient sorting";
        details.push("Built-in sorting algorithm detected");
      }

      // Check for search operations
      if (code.includes("in ") && code.includes("list")) {
        if (complexity === "O(1)") {
          complexity = "O(n)";
          description = "Linear time - list search";
          details.push("Linear search in list detected");
        }
      }

      // Data structure considerations
      if (dataStructures.length > 0) {
        details.push(`Data structures used: ${dataStructures.join(", ")}`);
      }

      return {
        complexity,
        description,
        details,
        worstCase: complexity,
        bestCase: nestedLoops.count > 0 ? "O(1)" : "O(1)",
        averageCase: complexity,
      };
    } catch (error) {
      return {
        complexity: "O(?)",
        description: "Unable to analyze complexity",
        details: ["Code analysis failed"],
        worstCase: "O(?)",
        bestCase: "O(?)",
        averageCase: "O(?)",
      };
    }
  }, []);

  // Helper function to analyze nested loops
  const analyzeNestedLoops = (code: string) => {
    const lines = code.split('\n');
    let maxNesting = 0;
    let currentNesting = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('for ') || trimmed.startsWith('while ')) {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (trimmed === '' || (!trimmed.startsWith(' ') && currentNesting > 0)) {
        // Reset nesting when we exit scope (simplified)
        currentNesting = Math.max(0, currentNesting - 1);
      }
    }
    
    return { count: maxNesting };
  };

  // Helper function to analyze recursion
  const analyzeRecursion = (code: string) => {
    const functionMatches = code.match(/def\s+(\w+)\s*\(/g);
    if (!functionMatches) return { hasRecursion: false, type: "none" };

    const functionNames = functionMatches.map(match => 
      match.replace(/def\s+(\w+)\s*\(/, '$1')
    );

    for (const funcName of functionNames) {
      const funcPattern = new RegExp(`def\\s+${funcName}\\s*\\([^)]*\\):[\\s\\S]*?(?=\\ndef|\\nclass|$)`, 'g');
      const funcMatch = code.match(funcPattern);
      
      if (funcMatch && funcMatch[0].includes(funcName + '(')) {
        // Check for different recursion patterns
        if (funcName.includes('fibonacci') || 
            funcMatch[0].includes(`${funcName}(n-1)`) && funcMatch[0].includes(`${funcName}(n-2)`)) {
          return { hasRecursion: true, type: "fibonacci" };
        }
        if (funcMatch[0].includes('factorial') || 
            funcMatch[0].includes(`${funcName}(n-1)`) && funcMatch[0].includes('n *')) {
          return { hasRecursion: true, type: "factorial" };
        }
        if (funcMatch[0].includes(`${funcName}(`)) {
          return { hasRecursion: true, type: "linear" };
        }
      }
    }

    return { hasRecursion: false, type: "none" };
  };

  // Helper function to analyze data structures
  const analyzeDataStructures = (code: string) => {
    const structures: string[] = [];
    
    if (code.includes('list(') || code.includes('[]')) structures.push("List");
    if (code.includes('dict(') || code.includes('{}')) structures.push("Dictionary");
    if (code.includes('set(')) structures.push("Set");
    if (code.includes('tuple(') || code.includes('(')) structures.push("Tuple");
    
    return structures;
  };

  // Generate data points for complexity graph
  const generateComplexityData = (complexity: string) => {
    const data: { x: number; y: number }[] = [];
    for (let n = 1; n <= 10; n++) {
      let y: number;
      switch (complexity) {
        case "O(1)":
          y = 1;
          break;
        case "O(log n)":
          y = Math.log2(n);
          break;
        case "O(n)":
          y = n;
          break;
        case "O(n log n)":
          y = n * Math.log2(n);
          break;
        case "O(n²)":
          y = n * n;
          break;
        case "O(n³)":
          y = n * n * n;
          break;
        case "O(2^n)":
          y = Math.pow(2, Math.min(n, 6)); // Limit to prevent overflow
          break;
        case "O(n!)":
          y = factorial(Math.min(n, 6)); // Limit to prevent overflow
          break;
        default:
          y = n;
      }
      data.push({ x: n, y: Math.min(y, 1000) }); // Cap at 1000 for display
    }
    return data;
  };

  const factorial = (n: number): number => {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
  };

  // Simple SVG graph component
  const ComplexityGraph = ({ complexity }: { complexity: string }) => {
    const data = generateComplexityData(complexity);
    const maxY = Math.max(...data.map(d => d.y));
    const width = 300;
    const height = 200;
    const padding = 40;

    const getX = (x: number) => padding + (x - 1) * ((width - 2 * padding) / 9);
    const getY = (y: number) => height - padding - (y / maxY) * (height - 2 * padding);

    const pathData = data
      .map((point, index) => 
        `${index === 0 ? 'M' : 'L'} ${getX(point.x)} ${getY(point.y)}`
      )
      .join(' ');

    return (
      <div className="p-4 bg-muted/20 rounded-lg">
        <h4 className="text-sm font-medium mb-2 text-center">Growth Visualization</h4>
        <svg width={width} height={height} className="border rounded">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <line
              key={ratio}
              x1={padding}
              y1={height - padding - ratio * (height - 2 * padding)}
              x2={width - padding}
              y2={height - padding - ratio * (height - 2 * padding)}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}
          
          {/* Axes */}
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} 
                stroke="#374151" strokeWidth="2" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} 
                stroke="#374151" strokeWidth="2" />
          
          {/* Complexity curve */}
          <path
            d={pathData}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Data points */}
          {data.map((point, index) => (
            <circle
              key={index}
              cx={getX(point.x)}
              cy={getY(point.y)}
              r="4"
              fill="#3b82f6"
            />
          ))}
          
          {/* Labels */}
          <text x={width / 2} y={height - 10} textAnchor="middle" className="text-xs fill-gray-600">
            Input Size (n)
          </text>
          <text x={15} y={height / 2} textAnchor="middle" className="text-xs fill-gray-600" 
                transform={`rotate(-90, 15, ${height / 2})`}>
            Operations
          </text>
        </svg>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Time complexity: <span className="font-mono font-bold text-blue-600">{complexity}</span>
        </p>
      </div>
    );
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
                🐍 Python Compiler
              </h1>
            </div>
            <Separator orientation="vertical" className="h-6 hidden md:block" />
            <p onClick={()=>{window.open('https://anshsx.me')}} className="text-xs cursor-pointer md:text-sm underline underline-offset-2 text-muted-foreground hidden md:block">
              By <AnimatedGradientText>Ansh Sharma</AnimatedGradientText>
            </p>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
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
          // Mobile Layout - Stack panels vertically with always visible terminal
          <div className="h-full flex flex-col">
            {/* Editor Panel */}
            <div className="flex-1 flex flex-col">
              {/* Language indicator */}
              <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-muted-foreground">
                  Python
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  main.py
                </span>
              </div>

              {/* Editor */}
              <div className="flex-1 flex flex-col">
                <div className="h-[45vh] rounded-t-xl overflow-hidden border-x border-t">
                  <MonacoEditor
                    height="100%"
                    defaultLanguage="python"
                    language="python"
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
                      scrollBeyondLastLine: false,
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
                      padding: { top: 10, bottom: 10 },
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Terminal Panel - Always visible on mobile */}
            <div className="h-[45vh] border-t">
              <div className="h-full p-2 flex flex-col bg-muted/20">
                {/* Action Buttons */}
                <div className="flex gap-2 mb-3">
                  <Button
                    onClick={runCode}
                    disabled={loadingPyodide || running}
                    className="flex-1"
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

                  <Dialog open={complexityDialogOpen} onOpenChange={setComplexityDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>🔍 Complexity Analysis</DialogTitle>
                        <DialogDescription>
                          Time complexity analysis of your Python code
                        </DialogDescription>
                      </DialogHeader>
                      
                      {(() => {
                        const analysis = analyzeComplexity(getCurrentCode());
                        return (
                          <div className="space-y-4">
                            <div className="text-center">
                              <div className="text-3xl font-bold text-blue-600 mb-2">
                                {analysis.complexity}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {analysis.description}
                              </p>
                            </div>

                            <ComplexityGraph complexity={analysis.complexity} />

                            <div className="grid grid-cols-1 gap-2 text-center">
                              <div className="p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                                <div className="font-semibold text-green-700 dark:text-green-400 text-xs">Best Case</div>
                                <div className="font-mono text-sm">{analysis.bestCase}</div>
                              </div>
                              <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                                <div className="font-semibold text-yellow-700 dark:text-yellow-400 text-xs">Average Case</div>
                                <div className="font-mono text-sm">{analysis.averageCase}</div>
                              </div>
                              <div className="p-2 bg-red-50 dark:bg-red-950 rounded-lg">
                                <div className="font-semibold text-red-700 dark:text-red-400 text-xs">Worst Case</div>
                                <div className="font-mono text-sm">{analysis.worstCase}</div>
                              </div>
                            </div>

                            {analysis.details.length > 0 && (
                              <div className="p-3 bg-muted/50 rounded-lg">
                                <h4 className="font-semibold mb-2 text-sm">Analysis Details:</h4>
                                <ul className="space-y-1">
                                  {analysis.details.map((detail, index) => (
                                    <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                                      <span className="text-blue-500 mt-0.5">•</span>
                                      {detail}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Input and Output combined for mobile */}
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex gap-2 h-20">
                    <div className="flex-1 p-2 bg-background rounded border">
                      <label className="text-xs font-medium mb-1 block text-muted-foreground">Input</label>
                      <textarea
                        className="w-full h-12 p-1 rounded bg-background border text-xs resize-none"
                        value={stdin}
                        onChange={(e) => setStdin(e.target.value)}
                        placeholder="Input..."
                      />
                    </div>
                  </div>
                  <div className="flex-1 p-2 bg-background rounded border">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-muted-foreground">Output</label>
                      <Badge
                        className="cursor-pointer bg-red-600 hover:bg-red-600 text-white text-xs px-2 py-0"
                        onClick={() => setOutput("")}
                      >
                        Clear
                      </Badge>
                    </div>
                    <div className="w-full h-full bg-black rounded p-2 text-green-400 text-xs overflow-auto font-mono">
                      {output || (
                        <span className="text-gray-500">
                          Output will appear here...
                          {"\n"}💡 Tip: Use Ctrl + Enter to run quickly
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Desktop Layout - Resizable panels
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Editor Panel */}
            <ResizablePanel defaultSize={rightPanelVisible ? 60 : 100} minSize={50}>
              <div className="h-full flex flex-col">
                {/* Language indicator */}
                <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Python
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    main.py
                  </span>
                </div>

                {/* Editor */}
                <div className="flex-1 p-2">
                  <div className="h-full rounded-xl overflow-hidden border">
                    <MonacoEditor
                      height="100%"
                      defaultLanguage="python"
                      language="python"
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

                            <Dialog open={complexityDialogOpen} onOpenChange={setComplexityDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline">
                                  <BarChart3 className="h-4 w-4 mr-2" />
                                  Analyze
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>🔍 Complexity Analysis</DialogTitle>
                                  <DialogDescription>
                                    Time complexity analysis of your Python code
                                  </DialogDescription>
                                </DialogHeader>
                                
                                {(() => {
                                  const analysis = analyzeComplexity(getCurrentCode());
                                  return (
                                    <div className="space-y-6">
                                      <div className="text-center">
                                        <div className="text-4xl font-bold text-blue-600 mb-2">
                                          {analysis.complexity}
                                        </div>
                                        <p className="text-lg text-muted-foreground">
                                          {analysis.description}
                                        </p>
                                      </div>

                                      <ComplexityGraph complexity={analysis.complexity} />

                                      <div className="grid grid-cols-3 gap-4 text-center">
                                        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                                          <div className="font-semibold text-green-700 dark:text-green-400">Best Case</div>
                                          <div className="font-mono">{analysis.bestCase}</div>
                                        </div>
                                        <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                                          <div className="font-semibold text-yellow-700 dark:text-yellow-400">Average Case</div>
                                          <div className="font-mono">{analysis.averageCase}</div>
                                        </div>
                                        <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                                          <div className="font-semibold text-red-700 dark:text-red-400">Worst Case</div>
                                          <div className="font-mono">{analysis.worstCase}</div>
                                        </div>
                                      </div>

                                      {analysis.details.length > 0 && (
                                        <div className="p-4 bg-muted/50 rounded-lg">
                                          <h4 className="font-semibold mb-2">Analysis Details:</h4>
                                          <ul className="space-y-1">
                                            {analysis.details.map((detail, index) => (
                                              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                                <span className="text-blue-500 mt-0.5">•</span>
                                                {detail}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </DialogContent>
                            </Dialog>

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
                                    type: "text/x-python",
                                  });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = "script.py";
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

                                if (pythonExamples[example]) {
                                  setCurrentCode(pythonExamples[example]);
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
            Pyodide: {loadingPyodide ? "Loading..." : "Ready"}
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
