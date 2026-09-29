"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { usePyodideWorker } from "@/hooks/usePyodideWorker";
import Mobile from "../components/mobile";
import Desktop from "../components/desktop";
import Header from "../components/header";
import Status from "../components/status";

const DEFAULT_PYTHON_CODE = `# Python IDE - Enhanced with Web Worker & Process Control
# Try this example:

def fibonacci(n):
    """Calculate the nth Fibonacci number"""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Get input from user (using the Standard Input panel)
num = int(input("Enter a number: "))
result = fibonacci(num)
print(f"Fibonacci({num}) = {result}")

# Additional examples
for i in range(5):
    print(f"Square of {i} is {i**2}")
`;

export default function Page() {
  const [isMobile, setIsMobile] = useState(false);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [pythonCode, setPythonCode] = useLocalStorage<string>(
    "python-code",
    DEFAULT_PYTHON_CODE,
  );
  const [fontSize, setFontSize] = useLocalStorage<number>("font-size", 14);
  const [stdin, setStdin] = useLocalStorage<string>("stdin-input", "8\n");
  const [output, setOutput] = useState<string>("");
  const [wordWrap, setWordWrap] = useLocalStorage<boolean>("word-wrap", false);
  const [minimap, setMinimap] = useLocalStorage<boolean>("minimap", false);
  const [executionHistory, setExecutionHistory] = useLocalStorage<string[]>(
    "execution-history",
    [],
  );
  const editorRef = useRef<any>(null);

  // Hook managing the Pyodide Web Worker with true process termination
  const {
    status: pyodideStatus,
    running,
    timeoutMs,
    setTimeoutMs,
    runCode: executeInWorker,
    stopExecution,
  } = usePyodideWorker({
    onOutput: (newOutput) => setOutput(newOutput),
  });

  const getCurrentCode = useCallback(() => pythonCode, [pythonCode]);
  const setCurrentCode = useCallback(
    (code: string) => {
      setPythonCode(code);
    },
    [setPythonCode],
  );

  // Responsive layout check
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setRightPanelVisible(true);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Run code handler
  const runCode = useCallback(() => {
    const currentCode = getCurrentCode();
    setOutput("");
    setExecutionHistory((prev: string[]) => {
      const newHistory = [
        currentCode,
        ...prev.filter((item: string) => item !== currentCode),
      ].slice(0, 10);
      return newHistory;
    });

    executeInWorker(currentCode, stdin);
  }, [getCurrentCode, stdin, setExecutionHistory, executeInWorker]);

  // Keyboard shortcut: Ctrl/Cmd + Enter to run or stop
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (running) {
          stopExecution();
        } else {
          runCode();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [runCode, stopExecution, running]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header
        fontSize={fontSize}
        setFontSize={setFontSize}
        timeoutMs={timeoutMs}
        setTimeoutMs={setTimeoutMs}
      />
      <div className="flex-1 overflow-hidden">
        {isMobile ? (
          <Mobile
            minimap={minimap}
            getCurrentCode={getCurrentCode}
            setCurrentCode={setCurrentCode}
            fontSize={fontSize}
            editorRef={editorRef}
            runCode={runCode}
            stopExecution={stopExecution}
            running={running}
            pyodideStatus={pyodideStatus}
            stdin={stdin}
            setStdin={setStdin}
            output={output}
            setOutput={setOutput}
            wordWrap={wordWrap}
          />
        ) : (
          <Desktop
            getCurrentCode={getCurrentCode}
            setCurrentCode={setCurrentCode}
            fontSize={fontSize}
            editorRef={editorRef}
            runCode={runCode}
            stopExecution={stopExecution}
            running={running}
            pyodideStatus={pyodideStatus}
            stdin={stdin}
            setStdin={setStdin}
            output={output}
            setOutput={setOutput}
            rightPanelVisible={rightPanelVisible}
            minimap={minimap}
            wordWrap={wordWrap}
          />
        )}
      </div>
      <Status
        getCurrentCode={getCurrentCode}
        setMinimap={setMinimap}
        minimap={minimap}
        wordWrap={wordWrap}
        setWordWrap={setWordWrap}
        pyodideStatus={pyodideStatus}
        running={running}
      />
    </div>
  );
}
