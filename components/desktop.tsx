import { Copy, Download, FileText, Loader2, Monitor, Play, RotateCcw, Square, Trash } from "lucide-react";
import React from "react";
import { Button } from "./ui/button";
import Monac from "./monaco";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";

interface DesktopProps {
  getCurrentCode: () => string;
  setCurrentCode: (code: string) => void;
  fontSize: number;
  editorRef: any;
  runCode: () => void;
  stopExecution: () => void;
  running: boolean;
  pyodideStatus: string;
  stdin: string;
  setStdin: (val: string) => void;
  output: string;
  setOutput: (val: string) => void;
  rightPanelVisible: boolean;
  minimap: boolean;
  wordWrap: boolean;
}

function Desktop({
  getCurrentCode,
  setCurrentCode,
  fontSize,
  editorRef,
  runCode,
  stopExecution,
  running,
  pyodideStatus,
  stdin,
  setStdin,
  output,
  setOutput,
  rightPanelVisible,
  minimap,
  wordWrap,
}: DesktopProps) {
  const isInitializing = pyodideStatus === "loading" || pyodideStatus === "resetting";

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Editor Panel */}
      <ResizablePanel defaultSize={rightPanelVisible ? 60 : 100} minSize={50}>
        <div className="h-full flex flex-col">
          {/* Language indicator */}
          <div className="px-4 py-2 bg-[#f0f0f0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${isInitializing
                  ? "bg-amber-500 animate-pulse"
                  : pyodideStatus === "error"
                    ? "bg-red-500"
                    : "bg-emerald-500"
                  }`}
              ></div>
              <span className="text-xs font-medium text-muted-foreground">
                Python 3.14
              </span>
            </div>
            {running && (
              <span className="text-xs text-amber-500 flex items-center gap-1 animate-pulse font-mono">
                Executing...
              </span>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 p-2 bg-[#f0f0f0]">
            <div className="h-full rounded-2xl overflow-hidden">
              <Monac
                getCurrentCode={getCurrentCode}
                setCurrentCode={setCurrentCode}
                fontSize={fontSize}
                editorRef={editorRef}
                minimap={minimap}
                wordWrap={wordWrap}
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
                  <div className="p-4 bg-[#f0f0f0] h-full flex flex-col">
                    <div className="flex flex-wrap gap-2">
                      {running ? (
                        <Button
                          onClick={stopExecution}
                          className="flex-1 min-w-0 rounded-2xl"
                          variant="destructive"
                        >
                          <Square className="h-4 w-4 mr-2 fill-current" />
                          Stop Process
                        </Button>
                      ) : (
                        <Button
                          onClick={runCode}
                          className="flex-1 min-w-0 rounded-2xl"
                          variant="default"
                          disabled={isInitializing}
                        >
                          {isInitializing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Loading Runtime...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Run Code
                            </>
                          )}
                        </Button>
                      )}
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          title="Reset Editor"
                          className="rounded-lg"
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
                          title="Download script.py"
                          className="rounded-lg"
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
                          title="Copy Code"
                          className="rounded-lg"
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
    """Calculate the nth Fibonacci number"""
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
                            infiniteloop: `# Demonstration of infinite loop handling
# Babel IDE will terminate this process cleanly without hanging your browser!
print("Starting infinite loop...")
count = 0
while True:
    count += 1
`,
                          };

                          if (pythonExamples[example]) {
                            setCurrentCode(pythonExamples[example]);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full bg-white shadow-none">
                          <SelectValue placeholder="Load example..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fibonacci">Fibonacci (Standard Input)</SelectItem>
                          <SelectItem value="sorting">Bubble Sort</SelectItem>
                          <SelectItem value="infiniteloop">Infinite Loop Test (Timeout / Stop)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Input Panel */}
                <ResizablePanel defaultSize={25} minSize={25}>
                  <div className="p-4 h-full flex flex-col bg-[#f0f0f0]">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <label className="text-sm font-medium">
                        Standard Input (stdin)
                      </label>
                    </div>
                    <textarea
                      className="flex-1 w-full p-3 rounded-2xl bg-white border-0 text-sm font-mono resize-none focus:outline-none"
                      value={stdin}
                      onChange={(e) => setStdin(e.target.value)}
                      placeholder="Input provided to input() lines..."
                    />
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Output Panel */}
                <ResizablePanel defaultSize={60} minSize={30}>
                  <div className="p-4 h-full flex flex-col bg-[#f0f0f0]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        <label className="text-sm font-medium">
                          Console Output
                        </label>
                      </div>
                      <Badge
                        className="cursor-pointer bg-red-600 rounded-xl hover:bg-red-700 text-white"
                        onClick={() => setOutput("")}
                      >
                        <Trash />
                        Clear
                      </Badge>
                    </div>
                    <div className="flex-1 bg-black rounded-3xl px-3 py-5 font-mono text-sm whitespace-pre-wrap overflow-auto border">
                      <div className="text-green-500">
                        {output || (
                          <span className="text-gray-400">
                            Output will appear here when you run code...
                            {"\n"}
                            {"\n"}Tip: Use Ctrl + Enter (or Cmd + Enter) to run quickly.
                            {"\n"}Infinite loops and long scripts are cleanly terminated by timeout or Stop button.
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
  );
}

export default Desktop;
